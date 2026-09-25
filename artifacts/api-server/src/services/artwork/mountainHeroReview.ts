import { createHash, randomUUID } from "node:crypto";
import { db, pool, cachedMountains, executeEngineReadOnlyQuery } from "@workspace/db";
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
import { buildMountainHeroPrompt, resolveMountainHeroReference } from "./mountainAutoHeroService.js";
import { getCanonicalMountainById } from "../mountain/canonicalMountainIdentity.js";
import { CANONICAL_TRUST_SQL } from "../mountain/canonicalMountainLookup.js";

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
  prompt?: string;
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

export function applyMountainHeroRejection(
  current: ReviewRecord,
  imageUrl: string,
  updatedAt: string,
): { record: ReviewRecord; unpublished: boolean } {
  const currentApprovedUrl = current.imageUrl ?? current.selected?.imageUrl;
  const unpublished = current.status === "approved" && currentApprovedUrl === imageUrl;
  const record: ReviewRecord = {
    ...current,
    rejectedUrls: [...new Set([...(current.rejectedUrls ?? []), imageUrl])],
    updatedAt,
  };
  if (unpublished) {
    record.status = "pending";
    delete record.imageUrl;
    delete record.selected;
  }
  return { record, unpublished };
}

export function isApprovalRecordForRejectedImage(data: string, mountainId: string, imageUrl: string): boolean {
  try {
    const approval = JSON.parse(data) as { mountainId?: string; imageUrl?: string };
    return approval.mountainId === mountainId && approval.imageUrl === imageUrl;
  } catch {
    return false;
  }
}

export type MountainHeroGenerationStatus = "idle" | "generating" | "ready" | "failed";

export interface MountainHeroGenerationRecord {
  status: MountainHeroGenerationStatus;
  jobId?: string;
  startedAt?: string;
  updatedAt: string;
  candidate?: MountainHeroCandidate;
  previousCandidates?: MountainHeroCandidate[];
  prompt?: string;
  error?: string;
}

const reviewKey = (id: string) => `hero-review:${REVIEW_VERSION}:${id}`;
const generationKey = (id: string) => `hero-generation:${REVIEW_VERSION}:${id}`;
const approvedKey = (name: string) =>
  `hero-approved:${APPROVED_VERSION}:${canonicalImageSubject(name).toLowerCase()}`;
const approvedMountainKey = (id: string) => `hero-approved:${APPROVED_VERSION}:id:${id}`;
const GENERATION_STALE_AFTER_MS = 10 * 60 * 1000;

function decodeMetadata(value?: string): string | null {
  if (!value) return null;
  return value.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim() || null;
}

async function getMountain(id: string): Promise<MountainRecord | null> {
  return getCanonicalMountainById(id);
}

export function readyGeneratedReviewIds(
  generationRows: readonly { slug: string; data: string }[],
  reviews: ReadonlyMap<string, ReviewRecord>,
): string[] {
  const prefix = `hero-generation:${REVIEW_VERSION}:`;
  return generationRows.flatMap((row) => {
    if (!row.slug.startsWith(prefix)) return [];
    const id = row.slug.slice(prefix.length);
    const review = reviews.get(id);
    if (review?.status === "approved") return [];
    try {
      const generation = JSON.parse(row.data) as MountainHeroGenerationRecord;
      const candidates = [generation.candidate, ...(generation.previousCandidates ?? [])];
      return candidates.some(candidate => candidate?.imageUrl &&
        !review?.rejectedUrls?.includes(candidate.imageUrl)) ? [id] : [];
    } catch {
      return [];
    }
  });
}

export async function listMountainHeroReviews(input: {
  page: number;
  pageSize: number;
  search?: string;
  status?: "all" | "review-required" | "approved" | "generated-review";
  sort?: "prominence" | "elevation" | "name";
}) {
  const offset = (input.page - 1) * input.pageSize;
  const search = input.search?.trim() ?? "";
  const status = input.status ?? "all";
  const reviewRows = await pool.query<{ slug: string; data: string }>(
    "SELECT slug, data FROM public.cached_mountains WHERE slug LIKE $1",
    [`hero-review:${REVIEW_VERSION}:%`],
  );
  const reviews = new Map<string, ReviewRecord>();
  for (const row of reviewRows.rows) {
    try {
      reviews.set(row.slug.slice(`hero-review:${REVIEW_VERSION}:`.length), JSON.parse(row.data) as ReviewRecord);
    } catch { /* Malformed review state cannot authorize an approval. */ }
  }
  const approvedIds = [...reviews].filter(([, review]) => review.status === "approved").map(([id]) => id);
  let generatedReviewIds: string[] = [];
  if (status === "generated-review") {
    const generationRows = await pool.query<{ slug: string; data: string }>(
      "SELECT slug, data FROM public.cached_mountains WHERE slug LIKE $1",
      [`hero-generation:${REVIEW_VERSION}:%`],
    );
    generatedReviewIds = readyGeneratedReviewIds(generationRows.rows, reviews);
  }
  const statusClause = status === "approved"
    ? "AND m.id::text = ANY($2::text[])"
    : status === "review-required"
      ? "AND NOT (m.id::text = ANY($2::text[]))"
      : status === "generated-review"
        ? "AND m.id::text = ANY($2::text[])"
      : "";
  const queryParams: unknown[] = status === "all" ? [search] :
    [search, status === "generated-review" ? generatedReviewIds : approvedIds];
  const orderBy = input.sort === "name"
    ? "m.name, m.country NULLS LAST, m.id"
    : input.sort === "elevation"
      ? "m.elevation_m DESC NULLS LAST, m.prominence_m DESC NULLS LAST, m.name, m.id"
      : "m.prominence_m DESC NULLS LAST, m.elevation_m DESC NULLS LAST, m.name, m.id";
  const [rowsResult, countResult] = await Promise.all([
    executeEngineReadOnlyQuery<Record<string, unknown>>(`
      SELECT
        m.id::text AS "id",
        m.canonical_source_key AS "canonicalSourceKey",
        m.name,
        m.country,
        m.region,
        m.area,
        m.elevation_m::float8 AS "elevationM",
        m.prominence_m::float8 AS "prominenceM"
      FROM public.mountains m
      WHERE ${CANONICAL_TRUST_SQL}
        AND m.canonical_source_key IS NOT NULL
        AND btrim(m.canonical_source_key) <> ''
        AND ($1 = '' OR m.name ILIKE '%' || $1 || '%' OR COALESCE(m.country, '') ILIKE '%' || $1 || '%' OR COALESCE(m.region, '') ILIKE '%' || $1 || '%')
        ${statusClause}
      ORDER BY ${orderBy}
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `, [...queryParams, input.pageSize, offset]),
    executeEngineReadOnlyQuery<Record<string, unknown>>(`
      SELECT COUNT(*)::text AS total
      FROM public.mountains m
      WHERE ${CANONICAL_TRUST_SQL}
        AND m.canonical_source_key IS NOT NULL
        AND btrim(m.canonical_source_key) <> ''
        AND ($1 = '' OR m.name ILIKE '%' || $1 || '%' OR COALESCE(m.country, '') ILIKE '%' || $1 || '%' OR COALESCE(m.region, '') ILIKE '%' || $1 || '%')
        ${statusClause}
    `, queryParams),
  ]);
  const rows = rowsResult as unknown as (MountainRecord & { id: string })[];
  const reviewByMountainId = new Map<string, ReviewRecord>();
  if (rows.length) {
    const reviewData = await pool.query<{ slug: string; data: string }>(
      "SELECT slug, data FROM public.cached_mountains WHERE slug = ANY($1::text[])",
      [rows.map((row) => `hero-review:${REVIEW_VERSION}:${row.id}`)],
    );
    for (const row of reviewData.rows) {
      try {
        reviewByMountainId.set(row.slug.slice(`hero-review:${REVIEW_VERSION}:`.length), JSON.parse(row.data) as ReviewRecord);
      } catch { /* malformed review state is treated as pending */ }
    }
  }

  return {
    mountains: rows.map(mountain => {
      const review = reviewByMountainId.get(mountain.id) ?? null;
      return {
        ...mountain,
        status: review?.status ?? "pending",
        approvedImageUrl: review?.imageUrl ?? null,
        approvedSource: review?.selected ?? null,
      };
    }),
    total: Number(countResult[0]?.total ?? 0),
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
  const [autoHero] = await db.select({ data: cachedMountains.data })
    .from(cachedMountains)
    .where(eq(cachedMountains.slug, `hero-auto:v1:${id}`))
    .limit(1);
  let autoCandidate: MountainHeroCandidate | null = null;
  if (autoHero?.data) {
    try {
      const record = JSON.parse(autoHero.data) as { status?: string; candidate?: MountainHeroCandidate };
      if (record.status === "ready" && record.candidate) autoCandidate = record.candidate;
    } catch { /* malformed auto state is not an admin candidate */ }
  }
  const aiCandidates = [generation.candidate, autoCandidate]
    .filter((candidate): candidate is MountainHeroCandidate =>
      Boolean(candidate && !rejected.has(candidate.imageUrl)),
    );
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
      .concat(aiCandidates.filter((candidate, index) =>
        aiCandidates.findIndex((item) => item.id === candidate.id) === index,
      )),
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
  if (!generation.candidate && !generation.previousCandidates?.length) return generation;
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
  const previousCandidates = generation.previousCandidates?.filter(candidate => !rejectedUrls.includes(candidate.imageUrl));
  return {
    ...generation,
    ...(generation.candidate && rejectedUrls.includes(generation.candidate.imageUrl) ? { candidate: undefined } : {}),
    ...(previousCandidates ? { previousCandidates } : {}),
  };
}

export function validateMountainHeroPrompt(prompt: unknown): string {
  if (typeof prompt !== "string") throw new Error("Prompt must be text");
  const trimmed = prompt.trim();
  if (trimmed.length < 20 || trimmed.length > 4000) {
    throw new Error("Prompt must be between 20 and 4000 characters");
  }
  return trimmed;
}

export async function getDefaultMountainHeroPrompt(id: string) {
  const mountain = await getMountain(id);
  if (!mountain) throw new Error("Mountain not found");
  const reference = await resolveMountainHeroReference(mountain);
  return { prompt: buildMountainHeroPrompt(mountain, Boolean(reference)), hasReference: Boolean(reference) };
}

/** Persist a generation claim atomically across all API processes. */
export async function startMountainHeroGeneration(id: string, prompt?: string): Promise<MountainHeroGenerationRecord> {
  const validatedPrompt = prompt === undefined ? undefined : validateMountainHeroPrompt(prompt);
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
    ...(previous.previousCandidates ? { previousCandidates: previous.previousCandidates } : {}),
    ...(validatedPrompt ? { prompt: validatedPrompt } : {}),
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
    const reference = await resolveMountainHeroReference(mountain);
    const claimed = await readMountainHeroGeneration(id);
    if (claimed.jobId !== jobId || claimed.status !== "generating") return;
    const prompt = claimed.prompt ?? buildMountainHeroPrompt(mountain, Boolean(reference));
    const generated = await provider.generate(prompt, {
      size: "1536x1024",
      ...(reference ? { referenceImages: [reference] } : {}),
    });
    if (!generated.buffer.length) throw new Error("Image provider returned an empty image");
    const metadata = await sharp(generated.buffer, { limitInputPixels: 24_000_000 }).metadata();
    if (!["png", "jpeg"].includes(metadata.format ?? "")) {
      throw new Error("Image provider returned an unsupported image format");
    }
    const validatedImage = await sharp(generated.buffer, { limitInputPixels: 24_000_000 })
      .rotate()
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
    if (!validatedImage.length) throw new Error("Image provider returned an invalid image");
    const imageUrl = await uploadMountainHeroIllustration(id, jobId, validatedImage, "image/jpeg");
    const generatedAt = new Date().toISOString();
    const candidate: MountainHeroCandidate = {
      id: jobId,
      title: `${mountain.name} — AI-generated depiction (not a documentary photograph)`,
      imageUrl,
      sourcePageUrl: imageUrl,
      source: "AI-generated illustration",
      width: metadata.width ?? 1536,
      height: metadata.height ?? 1024,
      license: null,
      artist: `Generated with ${generated.provider}`,
      score: 0,
      prompt,
    };
    await saveMountainHeroGeneration(id, jobId, (current) => promoteMountainHeroCandidate(current, candidate, generatedAt));
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

export function promoteMountainHeroCandidate(
  current: MountainHeroGenerationRecord,
  candidate: MountainHeroCandidate,
  generatedAt: string,
): MountainHeroGenerationRecord {
  const previousCandidates = [
    ...(current.candidate ? [current.candidate] : []),
    ...(current.previousCandidates ?? []),
  ].filter((item, index, all) => all.findIndex(other => other.imageUrl === item.imageUrl) === index).slice(0, 10);
  return {
    ...current,
    status: "ready",
    updatedAt: generatedAt,
    candidate,
    previousCandidates,
  };
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
  const [existingReview] = await db.select({ data: cachedMountains.data })
    .from(cachedMountains)
    .where(eq(cachedMountains.slug, reviewKey(id)))
    .limit(1);
  if (existingReview?.data) {
    try {
      const review = JSON.parse(existingReview.data) as ReviewRecord;
      if (review.rejectedUrls?.includes(candidate.imageUrl)) {
        throw new Error("Rejected mountain hero candidates cannot be approved");
      }
    } catch (error) {
      if (error instanceof Error && error.message === "Rejected mountain hero candidates cannot be approved") throw error;
    }
  }
  const generation = await readMountainHeroGeneration(id);
  const [autoHero] = await db.select({ data: cachedMountains.data })
    .from(cachedMountains)
    .where(eq(cachedMountains.slug, `hero-auto:v1:${id}`))
    .limit(1);
  let autoCandidate: MountainHeroCandidate | undefined;
  if (autoHero?.data) {
    try {
      const auto = JSON.parse(autoHero.data) as { candidate?: MountainHeroCandidate };
      autoCandidate = auto.candidate;
    } catch { /* ignored; manual candidate ownership is still checked below */ }
  }
  const isGenerated = candidate.source === "AI-generated illustration" ||
    candidate.imageUrl === generation.candidate?.imageUrl ||
    candidate.imageUrl === autoCandidate?.imageUrl;
  let selectedCandidate = candidate;
  if (isGenerated) {
    const storedCandidate = candidate.imageUrl === generation.candidate?.imageUrl
      ? generation.candidate
      : generation.previousCandidates?.find(item => item.imageUrl === candidate.imageUrl) ?? autoCandidate;
    if (!isGeneratedMountainCandidateOwnedBy(candidate, id, storedCandidate)) {
      throw new Error("Generated candidate does not belong to this mountain");
    }
    selectedCandidate = storedCandidate!;
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
  const approvedRecord = JSON.stringify({
    imageUrl: selectedCandidate.imageUrl,
    mountainId: id,
    source: selectedCandidate,
    approvedAt: record.updatedAt,
  });
  const storeApproval = (slug: string) => db.insert(cachedMountains).values({
    slug,
    data: approvedRecord,
  }).onConflictDoUpdate({
    target: cachedMountains.slug,
    set: { data: approvedRecord, cachedAt: new Date() },
  });
  await Promise.all([
    db.insert(cachedMountains).values({ slug: reviewKey(id), data: JSON.stringify(record) })
      .onConflictDoUpdate({
        target: cachedMountains.slug,
        set: { data: JSON.stringify(record), cachedAt: new Date() },
      }),
    storeApproval(approvedMountainKey(id)),
    storeApproval(approvedKey(mountain.name)),
  ]);
  clearMountainImageMemoryCache(mountain.name, mountain.id);
  return { mountain, approved: true, candidate: selectedCandidate };
}

export async function rejectMountainHeroCandidate(id: string, imageUrl: string) {
  const mountain = await getMountain(id);
  if (!mountain) throw new Error("Mountain not found");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ data: string }>(
      "SELECT data FROM public.cached_mountains WHERE slug = $1 FOR UPDATE",
      [reviewKey(id)],
    );
    let current: ReviewRecord = { status: "pending", rejectedUrls: [], updatedAt: new Date().toISOString() };
    if (existing.rows[0]?.data) {
      try { current = { ...current, ...JSON.parse(existing.rows[0].data) as ReviewRecord }; } catch { /* reset malformed review state */ }
    }
    const { record: rejectedReview, unpublished: unpublishingCurrent } =
      applyMountainHeroRejection(current, imageUrl, new Date().toISOString());
    await client.query(`
      INSERT INTO public.cached_mountains (slug, data, cached_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data, cached_at = NOW()
    `, [reviewKey(id), JSON.stringify(rejectedReview)]);

    if (unpublishingCurrent) {
      for (const slug of [approvedMountainKey(id), approvedKey(mountain.name)]) {
        const approval = await client.query<{ data: string }>(
          "SELECT data FROM public.cached_mountains WHERE slug = $1 FOR UPDATE",
          [slug],
        );
        if (!approval.rows[0]?.data) continue;
        if (isApprovalRecordForRejectedImage(approval.rows[0].data, id, imageUrl)) {
          await client.query("DELETE FROM public.cached_mountains WHERE slug = $1", [slug]);
        }
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* transaction may already be closed */ }
    throw error;
  } finally {
    client.release();
  }
  clearMountainImageMemoryCache(mountain.name, mountain.id);
  return { rejected: true };
}