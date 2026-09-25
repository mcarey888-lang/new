import { createHash, randomUUID } from "node:crypto";
import { db, pool, cachedMountains } from "@workspace/db";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import {
  canonicalImageSubject,
  clearMountainImageMemoryCache,
  scenicCandidateScore,
} from "../../routes/mountain-image.js";
import { defaultImageProvider, type ImageProvider } from "./imageProvider.js";
import { uploadMountainHeroIllustration } from "./artworkStorage.js";
import { logger } from "../../lib/logger.js";

const WIKI_HEADERS = { "User-Agent": "SummitReady/1.0 (mountain hero review)" };
const REVIEW_VERSION = "v1";
const APPROVED_VERSION = "v1";

export interface MountainHeroCandidate {
  id: string;
  title: string;
  imageUrl: string;
  sourcePageUrl: string;
  source: "Wikimedia Commons" | "AI-generated illustration";
  width: number;
  height: number;
  license: string | null;
  artist: string | null;
  score: number;
}

interface MountainRecord {
  id: string;
  canonicalSourceKey: string;
  name: string;
  country: string | null;
  region: string | null;
  area: string | null;
  elevationM: number | null;
  prominenceM: number | null;
}

interface ReviewRecord {
  status: "pending" | "approved";
  imageUrl?: string;
  selected?: MountainHeroCandidate;
  rejectedUrls?: string[];
  updatedAt: string;
}

export type MountainHeroGenerationStatus = "idle" | "generating" | "ready" | "failed";

export interface MountainHeroGenerationRecord {
  status: MountainHeroGenerationStatus;
  jobId?: string;
  startedAt?: string;
  updatedAt: string;
  candidate?: MountainHeroCandidate;
  error?: string;
}

const reviewKey = (id: string) => `hero-review:${REVIEW_VERSION}:${id}`;
const generationKey = (id: string) => `hero-generation:${REVIEW_VERSION}:${id}`;
const approvedKey = (name: string) =>
  `hero-approved:${APPROVED_VERSION}:${canonicalImageSubject(name).toLowerCase()}`;
const GENERATION_STALE_AFTER_MS = 10 * 60 * 1000;

function decodeMetadata(value?: string): string | null {
  if (!value) return null;
  return value.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim() || null;
}

async function getMountain(id: string): Promise<MountainRecord | null> {
  const result = await pool.query<MountainRecord>(`
    SELECT
      id::text AS "id",
      canonical_source_key AS "canonicalSourceKey",
      name,
      country,
      region,
      area,
      elevation_m::float8 AS "elevationM",
      prominence_m::float8 AS "prominenceM"
    FROM public.mountains
    WHERE id = $1::uuid
      AND canonical_source_key IS NOT NULL
    LIMIT 1
  `, [id]);
  return result.rows[0] ?? null;
}

export async function listMountainHeroReviews(input: {
  page: number;
  pageSize: number;
  search?: string;
  status?: "all" | "review-required" | "approved";
  sort?: "prominence" | "elevation" | "name";
}) {
  const offset = (input.page - 1) * input.pageSize;
  const search = input.search?.trim() ?? "";
  const params: unknown[] = [search, input.status ?? "all", input.pageSize, offset];
  const where = `
    m.canonical_source_key IS NOT NULL
    AND ($1 = '' OR m.name ILIKE '%' || $1 || '%' OR COALESCE(m.country, '') ILIKE '%' || $1 || '%' OR COALESCE(m.region, '') ILIKE '%' || $1 || '%')
    AND (
      $2 = 'all'
      OR ($2 = 'approved' AND review.slug IS NOT NULL)
      OR ($2 = 'review-required' AND review.slug IS NULL)
    )
  `;
  const orderBy = input.sort === "name"
    ? "m.name, m.country NULLS LAST, m.id"
    : input.sort === "elevation"
      ? "m.elevation_m DESC NULLS LAST, m.prominence_m DESC NULLS LAST, m.name, m.id"
      : "m.prominence_m DESC NULLS LAST, m.elevation_m DESC NULLS LAST, m.name, m.id";
  const [rowsResult, countResult] = await Promise.all([
    pool.query<MountainRecord & { reviewData: string | null }>(`
      SELECT
        m.id::text AS "id",
        m.canonical_source_key AS "canonicalSourceKey",
        m.name,
        m.country,
        m.region,
        m.area,
        m.elevation_m::float8 AS "elevationM",
        m.prominence_m::float8 AS "prominenceM",
        review.data AS "reviewData"
      FROM public.mountains m
      LEFT JOIN public.cached_mountains review
        ON review.slug = 'hero-review:${REVIEW_VERSION}:' || m.id::text
      WHERE ${where}
       ORDER BY ${orderBy}
      LIMIT $3 OFFSET $4
    `, params),
    pool.query<{ total: string }>(`
      SELECT COUNT(*)::text AS total
      FROM public.mountains m
      LEFT JOIN public.cached_mountains review
        ON review.slug = 'hero-review:${REVIEW_VERSION}:' || m.id::text
      WHERE ${where}
    `, params.slice(0, 2)),
  ]);

  return {
    mountains: rowsResult.rows.map(row => {
      let review: ReviewRecord | null = null;
      if (row.reviewData) {
        try { review = JSON.parse(row.reviewData) as ReviewRecord; } catch { review = null; }
      }
      const { reviewData: _, ...mountain } = row;
      return {
        ...mountain,
        status: review?.status ?? "pending",
        approvedImageUrl: review?.imageUrl ?? null,
        approvedSource: review?.selected ?? null,
      };
    }),
    total: Number(countResult.rows[0]?.total ?? 0),
    page: input.page,
    pageSize: input.pageSize,
  };
}

async function commonsSearch(query: string, mountainName: string): Promise<MountainHeroCandidate[]> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: "30",
    prop: "imageinfo",
    iiprop: "url|dimensions|mime|extmetadata",
    iiurlwidth: "1280",
    format: "json",
    formatversion: "2",
  }).toString();
  const response = await fetch(url, {
    headers: WIKI_HEADERS,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Wikimedia search failed (${response.status})`);
  const data = await response.json() as {
    query?: { pages?: Array<{
      title: string;
      imageinfo?: Array<{
        thumburl?: string;
        url?: string;
        descriptionurl?: string;
        mime?: string;
        width?: number;
        height?: number;
        extmetadata?: Record<string, { value?: string }>;
      }>;
    }> };
  };
  return (data.query?.pages ?? []).flatMap(page => {
    const info = page.imageinfo?.[0];
    const imageUrl = info?.thumburl ?? info?.url;
    const width = info?.width ?? 0;
    const height = info?.height ?? 0;
    const combined = `${page.title} ${imageUrl ?? ""}`;
    if (!info || !imageUrl || !/^image\/(?:jpeg|png|webp)$/.test(info.mime ?? "") ||
        width < 1000 || height < 600 || height > width * 1.15 ||
        /\.(?:pdf|djvu|svg|gif)\b/i.test(combined) ||
        /\b(?:map|diagram|painting|drawing|logo|poster|book|journal|memorial|sign)\b/i.test(combined)) {
      return [];
    }
    const score = scenicCandidateScore(page.title, mountainName, width, height);
    if (score < -100) return [];
    const sourcePageUrl = info.descriptionurl ?? info.url ?? imageUrl;
    return [{
      id: createHash("sha1").update(imageUrl).digest("hex").slice(0, 16),
      title: page.title.replace(/^File:/, ""),
      imageUrl,
      sourcePageUrl,
      source: "Wikimedia Commons" as const,
      width,
      height,
      license: decodeMetadata(info.extmetadata?.LicenseShortName?.value),
      artist: decodeMetadata(info.extmetadata?.Artist?.value),
      score,
    }];
  });
}

export async function findMountainHeroCandidates(id: string) {
  const mountain = await getMountain(id);
  if (!mountain) throw new Error("Mountain not found");
  const cleanRegion = mountain.region?.replace(/^\s*\d+[A-Z]?\s*:\s*/i, "").trim();
  const location = [cleanRegion, mountain.country].filter(Boolean).join(" ");
  const queries = [
    `${mountain.name} ${location} mountain landscape photograph`,
    `${mountain.name} ${location} scenic panorama`,
    `${mountain.name} mountain photograph`,
  ];
  const results = (await Promise.all(queries.map(query => commonsSearch(query, mountain.name))))
    .flat();
  const unique = new Map(results.map(candidate => [candidate.imageUrl, candidate]));
  const [review] = await db.select({ data: cachedMountains.data })
    .from(cachedMountains)
    .where(eq(cachedMountains.slug, reviewKey(id)))
    .limit(1);
  let rejected = new Set<string>();
  let reviewRecord: ReviewRecord | null = null;
  if (review?.data) {
    try {
      reviewRecord = JSON.parse(review.data) as ReviewRecord;
      rejected = new Set(reviewRecord.rejectedUrls ?? []);
    } catch { /* ignore */ }
  }
  const generation = await readMountainHeroGeneration(id);
  return {
    mountain: {
      ...mountain,
      status: reviewRecord?.status ?? "pending",
      approvedImageUrl: reviewRecord?.imageUrl ?? null,
      approvedSource: reviewRecord?.selected ?? null,
    },
    candidates: [...unique.values()]
      .filter(candidate => !rejected.has(candidate.imageUrl))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .concat(generation.candidate && !rejected.has(generation.candidate.imageUrl)
        ? [generation.candidate]
        : []),
  };
}

async function readMountainHeroGeneration(id: string): Promise<MountainHeroGenerationRecord> {
  const [row] = await db.select({ data: cachedMountains.data })
    .from(cachedMountains)
    .where(eq(cachedMountains.slug, generationKey(id)))
    .limit(1);
  let record: MountainHeroGenerationRecord = { status: "idle", updatedAt: new Date(0).toISOString() };
  if (row?.data) {
    try {
      record = JSON.parse(row.data) as MountainHeroGenerationRecord;
    } catch {
      throw new Error("Mountain generation state is invalid");
    }
  }
  const leaseTimestamp = record.updatedAt || record.startedAt;
  if (record.status === "generating" && leaseTimestamp &&
      Date.now() - Date.parse(leaseTimestamp) > GENERATION_STALE_AFTER_MS) {
    const failed: MountainHeroGenerationRecord = {
      ...record,
      status: "failed",
      error: "Generation worker expired before completing; retry is available",
      updatedAt: new Date().toISOString(),
    };
    await pool.query(`
      UPDATE public.cached_mountains
      SET data = $2, cached_at = NOW()
      WHERE slug = $1
        AND data::jsonb->>'status' = 'generating'
        AND data::jsonb->>'jobId' = $3
    `, [generationKey(id), JSON.stringify(failed), record.jobId]);
    return failed;
  }
  return record;
}

export async function getMountainHeroGeneration(id: string): Promise<MountainHeroGenerationRecord> {
  if (!await getMountain(id)) throw new Error("Mountain not found");
  const generation = await readMountainHeroGeneration(id);
  if (!generation.candidate) return generation;
  const [review] = await db.select({ data: cachedMountains.data })
    .from(cachedMountains)
    .where(eq(cachedMountains.slug, reviewKey(id)))
    .limit(1);
  let rejectedUrls: string[] = [];
  if (review?.data) {
    try {
      rejectedUrls = (JSON.parse(review.data) as ReviewRecord).rejectedUrls ?? [];
    } catch {
      // Keep the generation result visible if the independent review record is malformed.
    }
  }
  return withoutRejectedMountainHeroCandidate(generation, rejectedUrls);
}

export function withoutRejectedMountainHeroCandidate(
  generation: MountainHeroGenerationRecord,
  rejectedUrls: readonly string[],
): MountainHeroGenerationRecord {
  if (!generation.candidate || !rejectedUrls.includes(generation.candidate.imageUrl)) return generation;
  const { candidate: _rejected, ...visibleGeneration } = generation;
  return visibleGeneration;
}

/** Persist a generation claim atomically across all API processes. */
export async function startMountainHeroGeneration(id: string): Promise<MountainHeroGenerationRecord> {
  if (!await getMountain(id)) throw new Error("Mountain not found");
  const previous = await readMountainHeroGeneration(id);
  const jobId = randomUUID();
  const startedAt = new Date().toISOString();
  const record: MountainHeroGenerationRecord = {
    status: "generating",
    jobId,
    startedAt,
    updatedAt: startedAt,
    ...(previous.candidate ? { candidate: previous.candidate } : {}),
  };
  const claim = await pool.query(`
    INSERT INTO public.cached_mountains (slug, data, cached_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (slug) DO UPDATE
      SET data = EXCLUDED.data, cached_at = NOW()
      WHERE COALESCE(public.cached_mountains.data::jsonb->>'status', 'idle') <> 'generating'
    RETURNING slug
  `, [generationKey(id), JSON.stringify(record)]);
  if (claim.rowCount === 0) throw new Error("Mountain artwork generation is already in progress");
  return record;
}

async function saveMountainHeroGeneration(
  id: string,
  jobId: string,
  update: (current: MountainHeroGenerationRecord) => MountainHeroGenerationRecord,
): Promise<void> {
  const current = await readMountainHeroGeneration(id);
  if (current.jobId !== jobId || current.status !== "generating") return;
  const next = update(current);
  await pool.query(`
    UPDATE public.cached_mountains
    SET data = $2, cached_at = NOW()
    WHERE slug = $1
      AND data::jsonb->>'status' = 'generating'
      AND data::jsonb->>'jobId' = $3
  `, [generationKey(id), JSON.stringify(next), jobId]);
}

/** One provider request per job; the result is persisted only as a review candidate. */
export async function runMountainHeroGeneration(
  id: string,
  jobId: string,
  provider: ImageProvider = defaultImageProvider,
): Promise<void> {
  const heartbeat = setInterval(() => {
    void saveMountainHeroGeneration(id, jobId, (current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
    })).catch((error) => logger.warn({ err: error, mountainId: id, jobId }, "Mountain artwork generation lease heartbeat failed"));
  }, 2 * 60 * 1000);
  heartbeat.unref();
  try {
    const mountain = await getMountain(id);
    if (!mountain) throw new Error("Mountain not found");
    const location = [mountain.area, mountain.region, mountain.country]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(", ");
    const prompt = [
      `Create one distinctive AI-generated mountain landscape illustration inspired specifically by ${mountain.name}${location ? ` (${location})` : ""}.`,
      "This must read clearly as original illustrated artwork, not an authentic photograph and not documentary evidence.",
      "Use a refined hand-painted editorial travel-poster style with natural mountain forms, atmospheric depth, elegant color, and no text, labels, logos, borders, or watermark.",
      "Create an artistic interpretation of this named mountain and its regional landscape, not a claim of photographic accuracy.",
    ].join(" ");
    const generated = await provider.generate(prompt, { size: "1536x1024" });
    if (!generated.buffer.length) throw new Error("Image provider returned an empty image");
    const metadata = await sharp(generated.buffer).metadata();
    const contentType = metadata.format === "png" ? "image/png" : metadata.format === "jpeg" ? "image/jpeg" : null;
    if (!contentType) throw new Error("Image provider returned an unsupported image format");
    const imageUrl = await uploadMountainHeroIllustration(id, jobId, generated.buffer, contentType);
    const generatedAt = new Date().toISOString();
    const candidate: MountainHeroCandidate = {
      id: jobId,
      title: `${mountain.name} — AI-generated illustration (not a photograph)`,
      imageUrl,
      sourcePageUrl: imageUrl,
      source: "AI-generated illustration",
      width: metadata.width ?? 1536,
      height: metadata.height ?? 1024,
      license: null,
      artist: `Generated with ${generated.provider}`,
      score: 0,
    };
    await saveMountainHeroGeneration(id, jobId, (current) => ({
      status: "ready",
      jobId,
      startedAt: current.startedAt,
      updatedAt: generatedAt,
      candidate,
    }));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await saveMountainHeroGeneration(id, jobId, (current) => ({
      ...current,
      status: "failed",
      error: reason,
      updatedAt: new Date().toISOString(),
    }));
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}

function getGeneratedMountainOwner(imageUrl: string): string | null {
  try {
    const path = new URL(imageUrl, "https://mountain-artwork.invalid").pathname;
    const match = path.match(/^\/api\/artwork\/mountains\/([^/]+)\/generated\/[^/]+$/);
    return match ? decodeURIComponent(match[1]!) : null;
  } catch {
    return null;
  }
}

export function isGeneratedMountainCandidateOwnedBy(
  candidate: MountainHeroCandidate,
  mountainId: string,
  storedCandidate?: MountainHeroCandidate,
): boolean {
  if (candidate.source !== "AI-generated illustration" || !storedCandidate) return false;
  return candidate.id === storedCandidate.id &&
    candidate.imageUrl === storedCandidate.imageUrl &&
    getGeneratedMountainOwner(storedCandidate.imageUrl) === mountainId;
}

export async function approveMountainHero(id: string, candidate: MountainHeroCandidate) {
  const mountain = await getMountain(id);
  if (!mountain) throw new Error("Mountain not found");
  const generation = await readMountainHeroGeneration(id);
  const isGenerated = candidate.source === "AI-generated illustration" ||
    candidate.imageUrl === generation.candidate?.imageUrl;
  let selectedCandidate = candidate;
  if (isGenerated) {
    if (!isGeneratedMountainCandidateOwnedBy(candidate, id, generation.candidate)) {
      throw new Error("Generated candidate does not belong to this mountain");
    }
    selectedCandidate = generation.candidate!;
  } else if (!candidate.imageUrl.startsWith("https://")) {
    throw new Error("Invalid image URL");
  } else if (getGeneratedMountainOwner(candidate.imageUrl)) {
    throw new Error("Generated candidate does not belong to this mountain");
  }
  const record: ReviewRecord = {
    status: "approved",
    imageUrl: selectedCandidate.imageUrl,
    selected: selectedCandidate,
    updatedAt: new Date().toISOString(),
  };
  await Promise.all([
    db.insert(cachedMountains).values({ slug: reviewKey(id), data: JSON.stringify(record) })
      .onConflictDoUpdate({
        target: cachedMountains.slug,
        set: { data: JSON.stringify(record), cachedAt: new Date() },
      }),
    db.insert(cachedMountains).values({
      slug: approvedKey(mountain.name),
      data: JSON.stringify({
        imageUrl: selectedCandidate.imageUrl,
        mountainId: id,
        source: selectedCandidate,
        approvedAt: record.updatedAt,
      }),
    }).onConflictDoUpdate({
      target: cachedMountains.slug,
      set: {
        data: JSON.stringify({
          imageUrl: selectedCandidate.imageUrl,
          mountainId: id,
          source: selectedCandidate,
          approvedAt: record.updatedAt,
        }),
        cachedAt: new Date(),
      },
    }),
  ]);
  clearMountainImageMemoryCache(mountain.name);
  return { mountain, approved: true, candidate: selectedCandidate };
}

export async function rejectMountainHeroCandidate(id: string, imageUrl: string) {
  const mountain = await getMountain(id);
  if (!mountain) throw new Error("Mountain not found");
  const [existing] = await db.select({ data: cachedMountains.data })
    .from(cachedMountains)
    .where(eq(cachedMountains.slug, reviewKey(id)))
    .limit(1);
  let current: ReviewRecord = { status: "pending", rejectedUrls: [], updatedAt: new Date().toISOString() };
  if (existing?.data) {
    try { current = { ...current, ...JSON.parse(existing.data) as ReviewRecord }; } catch { /* ignore */ }
  }
  current.rejectedUrls = [...new Set([...(current.rejectedUrls ?? []), imageUrl])];
  current.updatedAt = new Date().toISOString();
  await db.insert(cachedMountains).values({ slug: reviewKey(id), data: JSON.stringify(current) })
    .onConflictDoUpdate({
      target: cachedMountains.slug,
      set: { data: JSON.stringify(current), cachedAt: new Date() },
    });
  return { rejected: true };
}