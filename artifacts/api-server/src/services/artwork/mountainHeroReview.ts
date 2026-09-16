import { createHash } from "node:crypto";
import { db, pool, cachedMountains } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  canonicalImageSubject,
  clearMountainImageMemoryCache,
  scenicCandidateScore,
} from "../../routes/mountain-image.js";

const WIKI_HEADERS = { "User-Agent": "SummitReady/1.0 (mountain hero review)" };
const REVIEW_VERSION = "v1";
const APPROVED_VERSION = "v1";

export interface MountainHeroCandidate {
  id: string;
  title: string;
  imageUrl: string;
  sourcePageUrl: string;
  source: "Wikimedia Commons";
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

const reviewKey = (id: string) => `hero-review:${REVIEW_VERSION}:${id}`;
const approvedKey = (name: string) =>
  `hero-approved:${APPROVED_VERSION}:${canonicalImageSubject(name).toLowerCase()}`;

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
  status?: "all" | "pending" | "approved";
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
      OR ($2 = 'pending' AND review.slug IS NULL)
    )
  `;
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
      ORDER BY m.prominence_m DESC NULLS LAST, m.elevation_m DESC NULLS LAST, m.name, m.id
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
      .slice(0, 12),
  };
}

export async function approveMountainHero(id: string, candidate: MountainHeroCandidate) {
  const mountain = await getMountain(id);
  if (!mountain) throw new Error("Mountain not found");
  if (!candidate.imageUrl.startsWith("https://")) throw new Error("Invalid image URL");
  const record: ReviewRecord = {
    status: "approved",
    imageUrl: candidate.imageUrl,
    selected: candidate,
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
        imageUrl: candidate.imageUrl,
        mountainId: id,
        source: candidate,
        approvedAt: record.updatedAt,
      }),
    }).onConflictDoUpdate({
      target: cachedMountains.slug,
      set: {
        data: JSON.stringify({
          imageUrl: candidate.imageUrl,
          mountainId: id,
          source: candidate,
          approvedAt: record.updatedAt,
        }),
        cachedAt: new Date(),
      },
    }),
  ]);
  clearMountainImageMemoryCache(mountain.name);
  return { mountain, approved: true, candidate };
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