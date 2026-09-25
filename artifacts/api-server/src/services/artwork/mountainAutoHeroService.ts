import { createHash, randomUUID } from "node:crypto";
import { db, pool, cachedMountains } from "@workspace/db";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { defaultImageProvider, type ImageProvider } from "./imageProvider.js";
import { uploadMountainHeroIllustration } from "./artworkStorage.js";
import type { MountainHeroCandidate } from "./mountainHeroReview.js";
import { canonicalImageSubject, parseMountainIllustrationPath } from "../../routes/mountain-image.js";
import { logger } from "../../lib/logger.js";
import { isMountainHeroImageRejected } from "./mountainHeroReviewState.js";
import {
  getCanonicalMountainById,
  resolveCanonicalMountainIdentity,
  type CanonicalMountainIdentity,
} from "../mountain/canonicalMountainIdentity.js";

const AUTO_VERSION = "v1";
const AUTO_PREFIX = `hero-auto:${AUTO_VERSION}:`;
const REVIEW_PREFIX = "hero-review:v1:";
const APPROVED_PREFIX = "hero-approved:v1:";
const approvedMountainKey = (id: string) => `${APPROVED_PREFIX}id:${id}`;
const GLOBAL_LOCK_KEY = "summitready:mountain-auto-hero-queue:v1";
const MAX_ACTIVE_GENERATIONS = 3;
const USER_DAILY_LIMIT = 2;
const IP_DAILY_LIMIT = 6;
const FAILURE_COOLDOWN_MS = 30 * 60 * 1000;
const GENERATION_LEASE_MS = 15 * 60 * 1000;
const HEARTBEAT_MS = 2 * 60 * 1000;
const MAX_REFERENCE_BYTES = 8 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WIKI_HEADERS = { "User-Agent": "SummitReady/1.0 (canonical mountain hero generation)" };

export type AutoHeroMountain = CanonicalMountainIdentity;

export interface MountainAutoHeroRecord {
  status: "generating" | "ready" | "failed";
  jobId?: string;
  startedAt?: string;
  updatedAt: string;
  candidate?: MountainHeroCandidate;
  error?: string;
  retryAfter?: string;
}

export type ExistingMountainAutoHeroRequest =
  | { kind: "ready"; imageUrl: string }
  | { kind: "generating"; jobId: string }
  | { kind: "cooldown"; error: string; retryAfterSeconds: number }
  | null;

export type MountainAutoHeroStatus =
  | { status: "ready"; imageUrl: string }
  | { status: "generating"; jobId: string }
  | { status: "failed"; jobId?: string; error: string }
  | { status: "unavailable" };

export class MountainHeroRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export async function getCataloguedMountainById(id: string): Promise<AutoHeroMountain | null> {
  return getCanonicalMountainById(id);
}

export function buildMountainHeroPrompt(mountain: AutoHeroMountain, hasReference: boolean): string {
  const location = [mountain.region, mountain.country].filter(Boolean).join(", ") || "location not recorded";
  const elevation = mountain.elevationM === null ? "not recorded" : `${Math.round(mountain.elevationM)} m`;
  const grounding = hasReference
    ? "Use the supplied exact-match reference photograph only as geographic and landform grounding; create a new realistic image, not a copy."
    : "No trustworthy exact-match reference photograph is available. Create a clearly AI-generated depiction guided only by the canonical name and location; do not present invented details as documentary fact.";
  return [
    `Create one realistic, photo-style landscape hero depicting the canonical catalogued mountain ${mountain.name}.`,
    `Canonical location: ${location}. Canonical elevation: ${elevation}.`,
    grounding,
    "Keep the main summit recognizable and naturally proportioned; use plausible regional terrain, weather, and vegetation without adding unsupported landmarks.",
    "This is AI-generated artwork, not an authentic documentary photograph. Do not add text, labels, logos, borders, watermarks, people in close-up, or fictional structures.",
    "Wide landscape composition, natural light, high photographic detail, restrained color, suitable as a mountain detail-page hero.",
  ].join(" ");
}

function autoKey(id: string) {
  return `${AUTO_PREFIX}${id}`;
}

function parseRecord(data?: string | null): MountainAutoHeroRecord | null {
  if (!data) return null;
  try {
    return JSON.parse(data) as MountainAutoHeroRecord;
  } catch {
    throw new Error("Mountain hero generation record is invalid");
  }
}

export function resolveExistingMountainAutoHeroRequest(
  record: MountainAutoHeroRecord | null,
  now = Date.now(),
): ExistingMountainAutoHeroRequest {
  if (record?.status === "ready" && record.candidate?.imageUrl) {
    return { kind: "ready", imageUrl: record.candidate.imageUrl };
  }
  if (record?.status === "generating" && record.jobId) {
    return { kind: "generating", jobId: record.jobId };
  }
  if (record?.status === "failed" && record.retryAfter && Date.parse(record.retryAfter) > now) {
    return {
      kind: "cooldown",
      error: record.error ?? "Mountain hero generation is cooling down after a failure",
      retryAfterSeconds: Math.ceil((Date.parse(record.retryAfter) - now) / 1000),
    };
  }
  return null;
}

async function readRecord(id: string): Promise<MountainAutoHeroRecord | null> {
  const result = await pool.query<{ data: string }>(
    "SELECT data FROM public.cached_mountains WHERE slug = $1 LIMIT 1",
    [autoKey(id)],
  );
  return parseRecord(result.rows[0]?.data);
}

async function readApprovedImage(mountain: AutoHeroMountain): Promise<string | null> {
  const keys = [
    approvedMountainKey(mountain.id),
    `${APPROVED_PREFIX}${canonicalImageSubject(mountain.name).toLowerCase()}`,
  ];
  for (const key of keys) {
    const [row] = await db.select({ data: cachedMountains.data })
      .from(cachedMountains)
      .where(eq(cachedMountains.slug, key))
      .limit(1);
    if (!row?.data) continue;
    try {
      const approved = JSON.parse(row.data) as { mountainId?: string; imageUrl?: string };
      const generatedOwner = typeof approved.imageUrl === "string"
        ? parseMountainIllustrationPath(approved.imageUrl)
        : null;
      if (approved.mountainId === mountain.id && typeof approved.imageUrl === "string" &&
          (!generatedOwner || generatedOwner.mountainId === mountain.id) &&
          !await isRejectedImageUrl(mountain.id, approved.imageUrl)) return approved.imageUrl;
    } catch {
      // A malformed legacy name-keyed approval is not trusted.
    }
  }
  return null;
}

async function isRejected(mountainId: string, candidate?: MountainHeroCandidate): Promise<boolean> {
  if (!candidate) return false;
  return isRejectedImageUrl(mountainId, candidate.imageUrl);
}

async function isRejectedImageUrl(mountainId: string, imageUrl: string): Promise<boolean> {
  const [row] = await db.select({ data: cachedMountains.data })
    .from(cachedMountains)
    .where(eq(cachedMountains.slug, `${REVIEW_PREFIX}${mountainId}`))
    .limit(1);
  if (!row?.data) return false;
  return isMountainHeroImageRejected(row.data, imageUrl);
}

export async function getMountainAutoHeroStatus(id: string): Promise<MountainAutoHeroStatus> {
  const mountain = await getCataloguedMountainById(id);
  if (!mountain) return { status: "unavailable" };
  const approvedImage = await readApprovedImage(mountain);
  if (approvedImage) return { status: "ready", imageUrl: approvedImage };
  let record = await readRecord(id);
  if (!record) return { status: "unavailable" };
  if (record.status === "generating" && Date.now() - Date.parse(record.updatedAt) > GENERATION_LEASE_MS) {
    const staleUpdatedAt = record.updatedAt;
    const staleJobId = record.jobId;
    record = {
      ...record,
      status: "failed",
      error: "Generation worker expired before completing; retry after the cooldown",
      retryAfter: new Date(Date.now() + FAILURE_COOLDOWN_MS).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const staleUpdate = await pool.query(`
      UPDATE public.cached_mountains SET data = $2, cached_at = NOW()
      WHERE slug = $1 AND data::jsonb->>'status' = 'generating'
        AND data::jsonb->>'jobId' = $3
        AND data::jsonb->>'updatedAt' = $4
    `, [autoKey(id), JSON.stringify(record), staleJobId, staleUpdatedAt]);
    if ((staleUpdate.rowCount ?? 0) === 0) record = await readRecord(id) ?? record;
  }
  if (record.status === "generating" && record.jobId) {
    return { status: "generating", jobId: record.jobId };
  }
  if (record.status === "ready" && record.candidate && !await isRejected(id, record.candidate)) {
    return { status: "ready", imageUrl: record.candidate.imageUrl };
  }
  if (record.status === "failed") {
    return {
      status: "failed",
      ...(record.jobId ? { jobId: record.jobId } : {}),
      error: record.error ?? "Mountain hero generation failed",
    };
  }
  return { status: "unavailable" };
}

export async function requestMountainAutoHero(
  id: string,
  userId: string,
  clientIp: string,
): Promise<{ status: "ready"; imageUrl: string } | { status: "generating"; jobId: string; started: boolean }> {
  const mountain = await getCataloguedMountainById(id);
  if (!mountain) throw new MountainHeroRequestError("Mountain is not a canonical catalogued mountain", 404);
  const approvedImage = await readApprovedImage(mountain);
  if (approvedImage) return { status: "ready", imageUrl: approvedImage };

  const client = await pool.connect();
  let launch: { jobId: string } | null = null;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [GLOBAL_LOCK_KEY]);
    await client.query("DELETE FROM public.cached_mountains WHERE slug LIKE 'mountain-auto-rate:%' AND cached_at < NOW() - INTERVAL '31 days'");
    const existingResult = await client.query<{ data: string }>(
      "SELECT data FROM public.cached_mountains WHERE slug = $1 FOR UPDATE",
      [autoKey(id)],
    );
    let existing = parseRecord(existingResult.rows[0]?.data);
    const now = Date.now();
    if (existing?.status === "generating" && now - Date.parse(existing.updatedAt) > GENERATION_LEASE_MS) {
      const staleUpdatedAt = existing.updatedAt;
      const staleJobId = existing.jobId;
      existing = {
        ...existing,
        status: "failed",
        error: "Generation worker expired before completing; retry after the cooldown",
        retryAfter: new Date(now + FAILURE_COOLDOWN_MS).toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const staleUpdate = await client.query(`
        UPDATE public.cached_mountains SET data = $2, cached_at = NOW()
        WHERE slug = $1 AND data::jsonb->>'status' = 'generating'
          AND data::jsonb->>'jobId' = $3 AND data::jsonb->>'updatedAt' = $4
      `, [autoKey(id), JSON.stringify(existing), staleJobId, staleUpdatedAt]);
      if ((staleUpdate.rowCount ?? 0) === 0) {
        const current = await client.query<{ data: string }>(
          "SELECT data FROM public.cached_mountains WHERE slug = $1 FOR UPDATE",
          [autoKey(id)],
        );
        existing = parseRecord(current.rows[0]?.data);
      }
    }
    const existingRequest = resolveExistingMountainAutoHeroRequest(existing, now);
    if (existingRequest?.kind === "ready" && existing?.candidate) {
      if (await isRejected(id, existing.candidate)) {
        await client.query("ROLLBACK");
        throw new MountainHeroRequestError("This generated mountain hero was rejected by an administrator", 409);
      }
      await client.query("COMMIT");
      return { status: "ready", imageUrl: existingRequest.imageUrl };
    }
    if (existingRequest?.kind === "generating") {
      await client.query("COMMIT");
      return { status: "generating", jobId: existingRequest.jobId, started: false };
    }
    if (existingRequest?.kind === "cooldown") {
      await client.query("ROLLBACK");
      throw new MountainHeroRequestError(
        existingRequest.error,
        429,
        existingRequest.retryAfterSeconds,
      );
    }

    const active = await client.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count
      FROM public.cached_mountains
      WHERE slug LIKE $1
        AND data::jsonb->>'status' = 'generating'
        AND COALESCE((data::jsonb->>'updatedAt')::timestamptz, cached_at) > NOW() - INTERVAL '15 minutes'
    `, [`${AUTO_PREFIX}%`]);
    if (active.rows[0]?.count >= MAX_ACTIVE_GENERATIONS) {
      await client.query("ROLLBACK");
      throw new MountainHeroRequestError("Mountain hero generation capacity is temporarily full; retry shortly", 503, 60);
    }

    const day = new Date().toISOString().slice(0, 10);
    const userHash = createHash("sha256").update(userId).digest("hex");
    const ipHash = createHash("sha256").update(clientIp || "unknown").digest("hex");
    const rateKeys = [
      { key: `mountain-auto-rate:user:${userHash}:${day}`, limit: USER_DAILY_LIMIT, label: "user" },
      { key: `mountain-auto-rate:ip:${ipHash}:${day}`, limit: IP_DAILY_LIMIT, label: "network" },
    ];
    for (const quota of rateKeys) {
      const usageResult = await client.query<{ data: string }>(
        "SELECT data FROM public.cached_mountains WHERE slug = $1 FOR UPDATE",
        [quota.key],
      );
      const usage = usageResult.rows[0]?.data ? JSON.parse(usageResult.rows[0].data) as { count?: number } : { count: 0 };
      const count = Number(usage.count ?? 0);
      if (count >= quota.limit) {
        await client.query("ROLLBACK");
        throw new MountainHeroRequestError(`Daily mountain hero generation limit reached for this ${quota.label}`, 429, 3600);
      }
    }
    for (const quota of rateKeys) {
      const usageResult = await client.query<{ data: string }>(
        "SELECT data FROM public.cached_mountains WHERE slug = $1 FOR UPDATE",
        [quota.key],
      );
      const usage = usageResult.rows[0]?.data ? JSON.parse(usageResult.rows[0].data) as { count?: number } : { count: 0 };
      await client.query(`
        INSERT INTO public.cached_mountains (slug, data, cached_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data, cached_at = NOW()
      `, [quota.key, JSON.stringify({ count: Number(usage.count ?? 0) + 1 })]);
    }
    const jobId = randomUUID();
    const timestamp = new Date().toISOString();
    const record: MountainAutoHeroRecord = { status: "generating", jobId, startedAt: timestamp, updatedAt: timestamp };
    await client.query(`
      INSERT INTO public.cached_mountains (slug, data, cached_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data, cached_at = NOW()
    `, [autoKey(id), JSON.stringify(record)]);
    await client.query("COMMIT");
    launch = { jobId };
    return { status: "generating", jobId, started: true };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* transaction may already be closed */ }
    throw error;
  } finally {
    client.release();
    if (launch) void runMountainAutoHeroGeneration(id, launch.jobId).catch(() => undefined);
  }
}

export async function resolveMountainHeroReference(mountain: AutoHeroMountain): Promise<{ buffer: Buffer; mimeType: string; name: string } | null> {
  const location = [mountain.region, mountain.country].filter(Boolean).join(" ");
  const [uniqueIdentity, exactIdentity] = await Promise.all([
    resolveCanonicalMountainIdentity(mountain.name).catch(() => null),
    resolveCanonicalMountainIdentity(mountain.name, location || undefined).catch(() => null),
  ]);
  if (!exactIdentity || exactIdentity.id !== mountain.id) return null;
  const nameIsUnique = uniqueIdentity?.id === mountain.id;
  if (nameIsUnique) {
    const { getCuratedMountainReferenceImage } = await import("../../routes/mountain-image.js");
    const curated = await getCuratedMountainReferenceImage(mountain.name).catch(() => null);
    if (curated) {
      const downloaded = await downloadReferenceImage(curated, mountain.name).catch(() => null);
      if (downloaded) return downloaded;
    }
  }
  const { findMountainHeroCandidates } = await import("./mountainHeroReview.js");
  const found = await findMountainHeroCandidates(mountain.id).catch(() => null);
  const exactName = normalizeReferenceTitle(mountain.name);
  const requiredLocationTerms = nameIsUnique
    ? []
    : [mountain.region, mountain.country].filter((part): part is string => Boolean(part?.trim()))
        .map(normalizeReferenceTitle);
  const candidate = found?.candidates.find((item) =>
    item.source === "Wikimedia Commons" &&
    normalizeReferenceTitle(item.title).includes(exactName) &&
    requiredLocationTerms.every((term) => normalizeReferenceTitle(item.title).includes(term)) &&
    item.score >= 0,
  );
  if (!candidate) return null;
  return downloadReferenceImage(candidate.imageUrl, candidate.title).catch(() => null);
}

function normalizeReferenceTitle(value: string): string {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function downloadReferenceImage(
  rawUrl: string,
  name: string,
): Promise<{ buffer: Buffer; mimeType: string; name: string } | null> {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return null; }
  if (url.protocol !== "https:" || url.hostname !== "upload.wikimedia.org" || url.username || url.password) return null;
  const response = await fetch(url, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(7000), redirect: "error" });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) return null;
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_REFERENCE_BYTES) return null;
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      byteLength += part.value.byteLength;
      if (byteLength > MAX_REFERENCE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(Buffer.from(part.value));
    }
  } finally {
    reader.releaseLock();
  }
  if (!byteLength) return null;
  const bytes = Buffer.concat(chunks, byteLength);
  const metadata = await sharp(bytes, { limitInputPixels: 24_000_000 }).metadata();
  if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") ||
      (metadata.width ?? 0) < 512 || (metadata.height ?? 0) < 350) return null;
  const normalized = await sharp(bytes, { limitInputPixels: 24_000_000 })
    .rotate()
    .resize(1536, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
  if (!normalized.length || normalized.length > MAX_REFERENCE_BYTES) return null;
  return { buffer: normalized, mimeType: "image/jpeg", name: name.slice(0, 120) };
}

async function writeAutoRecord(id: string, jobId: string, record: MountainAutoHeroRecord): Promise<boolean> {
  const result = await pool.query(`
    UPDATE public.cached_mountains SET data = $2, cached_at = NOW()
    WHERE slug = $1
      AND data::jsonb->>'jobId' = $3
      AND data::jsonb->>'status' = 'generating'
  `, [autoKey(id), JSON.stringify(record), jobId]);
  return (result.rowCount ?? 0) > 0;
}

export async function runMountainAutoHeroGeneration(
  id: string,
  jobId: string,
  provider: ImageProvider = defaultImageProvider,
): Promise<void> {
  const heartbeat = setInterval(() => {
    void (async () => {
      const current = await readRecord(id);
      if (!current || current.jobId !== jobId || current.status !== "generating") return;
      await pool.query(`
        UPDATE public.cached_mountains
        SET data = $2, cached_at = NOW()
        WHERE slug = $1
          AND data::jsonb->>'jobId' = $3
          AND data::jsonb->>'status' = 'generating'
          AND data::jsonb->>'updatedAt' = $4
      `, [autoKey(id), JSON.stringify({ ...current, updatedAt: new Date().toISOString() }), jobId, current.updatedAt]);
    })().catch((error) => logger.warn({ err: error, mountainId: id, jobId }, "Auto mountain hero heartbeat failed"));
  }, HEARTBEAT_MS);
  heartbeat.unref();
  try {
    const mountain = await getCataloguedMountainById(id);
    if (!mountain) throw new Error("Mountain is no longer in the canonical catalogue");
    const reference = await resolveMountainHeroReference(mountain);
    const prompt = buildMountainHeroPrompt(mountain, Boolean(reference));
    const generated = await provider.generate(prompt, {
      size: "1536x1024",
      ...(reference ? { referenceImages: [reference] } : {}),
    });
    if (!generated.buffer.length) throw new Error("Image provider returned an empty image");
    const metadata = await sharp(generated.buffer, { limitInputPixels: 24_000_000 }).metadata();
    if (!["png", "jpeg"].includes(metadata.format ?? "") ||
        (metadata.width ?? 0) < 512 || (metadata.height ?? 0) < 350) {
      throw new Error("Image provider returned an invalid hero image");
    }
    const validatedImage = await sharp(generated.buffer, { limitInputPixels: 24_000_000 })
      .rotate()
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
    if (!validatedImage.length) throw new Error("Image provider returned an invalid hero image");
    const imageUrl = await uploadMountainHeroIllustration(id, jobId, validatedImage, "image/jpeg");
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
    };
    const ready: MountainAutoHeroRecord = {
      status: "ready",
      jobId,
      updatedAt: new Date().toISOString(),
      candidate,
    };
    if (!await writeAutoRecord(id, jobId, ready)) {
      throw new Error("Mountain hero generation lease was lost before image publication");
    }
    const { clearMountainImageMemoryCache } = await import("../../routes/mountain-image.js");
    clearMountainImageMemoryCache(mountain.name, mountain.id);
  } catch (error) {
    const current = await readRecord(id);
    if (current?.jobId === jobId && current.status === "generating") {
      const failedAt = Date.now();
      const failed: MountainAutoHeroRecord = {
        status: "failed",
        jobId,
        startedAt: current.startedAt,
        updatedAt: new Date(failedAt).toISOString(),
        error: error instanceof Error ? error.message : String(error),
        retryAfter: new Date(failedAt + FAILURE_COOLDOWN_MS).toISOString(),
      };
      await writeAutoRecord(id, jobId, failed);
    }
    logger.error({ err: error, mountainId: id, jobId }, "Automatic mountain hero generation failed");
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}

export function isMountainHeroRequestId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function autoMountainHeroCacheKey(id: string): string {
  return autoKey(id);
}