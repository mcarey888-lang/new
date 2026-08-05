/**
 * Atlas GitHub Publishing Service
 * ─────────────────────────────────
 * Publishes approved Atlas assets directly to the GitHub repository.
 *
 * Flow per publish run:
 *   1. Fetch master image buffer from object storage
 *   2. Generate responsive WebP versions (desktop 3840px, tablet 1920px, mobile 1080px)
 *   3. Create Git blobs for all image files + updated manifest
 *   4. Create a single Git tree + commit (clean history, one commit per publish batch)
 *   5. Update the branch ref
 *   6. Store commit hash back in the DB
 *
 * Uses the GitHub Git Data API for atomic commits.
 */

import sharp from "sharp";
import { db, atlasAssets, atlasBrands, atlasAssetTypes } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { fetchAtlasImageBuffer } from "./atlasStorage.js";

// ── Config ────────────────────────────────────────────────────────────────────

const REPO   = "mcarey888-lang/Atlas";
const BRANCH = "main";
const GH_API = "https://api.github.com";

function getToken(): string {
  const t = process.env.ATLAS_GITHUB_TOKEN;
  if (!t) throw new Error("ATLAS_GITHUB_TOKEN is not set");
  return t;
}

// ── GitHub API helper ─────────────────────────────────────────────────────────

async function gh(path: string, opts: RequestInit = {}): Promise<Response> {
  return fetch(`${GH_API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
}

async function ghJson<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const r = await gh(path, opts);
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`GitHub ${opts.method ?? "GET"} ${path} → ${r.status}: ${body}`);
  }
  return r.json() as Promise<T>;
}

// ── Git Data API helpers ──────────────────────────────────────────────────────

async function getBranchSha(): Promise<string> {
  const data = await ghJson<{ object: { sha: string } }>(`/repos/${REPO}/git/ref/heads/${BRANCH}`);
  return data.object.sha;
}

async function getCommitTree(commitSha: string): Promise<string> {
  const data = await ghJson<{ tree: { sha: string } }>(`/repos/${REPO}/git/commits/${commitSha}`);
  return data.tree.sha;
}

async function createBlob(content: Buffer): Promise<string> {
  const data = await ghJson<{ sha: string }>(`/repos/${REPO}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content: content.toString("base64"), encoding: "base64" }),
  });
  return data.sha;
}

interface TreeFile { path: string; sha: string; }

async function createTree(baseSha: string, files: TreeFile[]): Promise<string> {
  const data = await ghJson<{ sha: string }>(`/repos/${REPO}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseSha,
      tree: files.map(f => ({ path: f.path, mode: "100644", type: "blob", sha: f.sha })),
    }),
  });
  return data.sha;
}

async function createCommit(message: string, treeSha: string, parentSha: string): Promise<string> {
  const data = await ghJson<{ sha: string }>(`/repos/${REPO}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
  });
  return data.sha;
}

async function updateRef(commitSha: string): Promise<void> {
  await ghJson(`/repos/${REPO}/git/refs/heads/${BRANCH}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commitSha }),
  });
}

// ── Responsive image generation ───────────────────────────────────────────────

async function generateResponsiveVersions(masterBuffer: Buffer): Promise<{
  desktop: Buffer; tablet: Buffer; mobile: Buffer;
}> {
  const [desktop, tablet, mobile] = await Promise.all([
    sharp(masterBuffer).resize(3840, null, { fit: "inside", kernel: "lanczos3" }).webp({ quality: 88 }).toBuffer(),
    sharp(masterBuffer).resize(1920, null, { fit: "inside", kernel: "lanczos3" }).webp({ quality: 88 }).toBuffer(),
    sharp(masterBuffer).resize(1080, null, { fit: "inside", kernel: "lanczos3" }).webp({ quality: 88 }).toBuffer(),
  ]);
  return { desktop, tablet, mobile };
}

// ── Filename slug builder ─────────────────────────────────────────────────────

function buildFilenameSlug(assetTypeSlug: string, sceneVars: Record<string, string>): string {
  const parts = [assetTypeSlug];
  // Append primary scene vars (scene, task) as slug segments
  const primary = ["scene", "task"].map(k => sceneVars[k]).filter(Boolean);
  if (primary.length > 0) {
    parts.push(primary.join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  }
  return parts.join("-");
}

// ── Manifest helpers ──────────────────────────────────────────────────────────

interface ManifestAsset {
  slug:       string;
  desktop:    string;
  tablet:     string;
  mobile:     string;
  assetId:    string;
  commitHash: string;
  publishedAt: string;
}

interface BrandManifest {
  brand:   string;
  updated: string;
  assets:  Record<string, ManifestAsset>;
}

async function fetchExistingManifest(manifestPath: string): Promise<BrandManifest | null> {
  const r = await gh(`/repos/${REPO}/contents/${manifestPath}?ref=${BRANCH}`);
  if (r.status === 404) return null;
  if (!r.ok) return null;
  const json = await r.json() as { content: string };
  try {
    const decoded = Buffer.from(json.content, "base64").toString("utf8");
    return JSON.parse(decoded) as BrandManifest;
  } catch {
    return null;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssetPublishResult {
  assetId:  string;
  slug:     string;
  status:   "published" | "failed" | "skipped";
  reason?:  string;
  files?:   string[];
}

export interface GitHubPublishResult {
  ok:           boolean;
  commitHash?:  string;
  results:      AssetPublishResult[];
  manifestPath?: string;
  reason?:      string;
}

export interface GitHubStatusResult {
  repo:           string;
  branch:         string;
  rateLimit:      { remaining: number; limit: number; resetAt: string };
  latestCommit?:  { sha: string; message: string; date: string };
  ok:             boolean;
}

// ── Core publish function ─────────────────────────────────────────────────────

/**
 * Publish a set of approved asset IDs (must all belong to the same brand)
 * as a single Git commit. Pass `brandId` to auto-select all approved+unpublished.
 */
export async function publishAtlasAssets(
  assetIds: string[],
  brandId?: number,
): Promise<GitHubPublishResult> {
  // Resolve which assets to publish
  let targetIds = assetIds;
  if (targetIds.length === 0 && brandId !== undefined) {
    const rows = await db
      .select({ assetId: atlasAssets.assetId })
      .from(atlasAssets)
      .where(and(
        eq(atlasAssets.brandId, brandId),
        eq(atlasAssets.approved, true),
        eq(atlasAssets.published, false),
        eq(atlasAssets.archived, false),
      ));
    targetIds = rows.map(r => r.assetId);
  }

  if (targetIds.length === 0) {
    return { ok: true, results: [], reason: "No assets to publish" };
  }

  // Load all asset records with brand + type joins
  const rows = await db
    .select({
      assetId:         atlasAssets.assetId,
      sceneVars:       atlasAssets.sceneVars,
      title:           atlasAssets.title,
      approved:        atlasAssets.approved,
      published:       atlasAssets.published,
      brandId:         atlasAssets.brandId,
      assetTypeId:     atlasAssets.assetTypeId,
      brandName:       atlasBrands.name,
      brandSlug:       atlasBrands.slug,
      githubFolder:    atlasBrands.githubFolder,
      assetTypeSlug:   atlasAssetTypes.slug,
      githubSubfolder: atlasAssetTypes.githubSubfolder,
    })
    .from(atlasAssets)
    .innerJoin(atlasBrands,     eq(atlasAssets.brandId,     atlasBrands.id))
    .innerJoin(atlasAssetTypes, eq(atlasAssets.assetTypeId, atlasAssetTypes.id))
    .where(inArray(atlasAssets.assetId, targetIds));

  const results: AssetPublishResult[] = [];
  const treeFiles: TreeFile[] = [];
  const slugMap: Map<string, string> = new Map(); // assetId → slug

  // Validate brand consistency + folder config
  const brands = new Set(rows.map(r => r.brandSlug));
  if (brands.size > 1) {
    return { ok: false, results: [], reason: "All assets in a publish batch must belong to the same brand" };
  }

  const first = rows[0];
  if (!first?.githubFolder) {
    return { ok: false, results: [], reason: `Brand "${first?.brandName}" has no GitHub folder configured. Update it in the seed.` };
  }

  const githubFolder = first.githubFolder.replace(/\/$/, ""); // strip trailing slash
  const manifestPath = `${githubFolder}/media-manifest.json`;

  // Get current branch state for the commit
  const branchSha    = await getBranchSha();
  const baseTreeSha  = await getCommitTree(branchSha);

  // Load existing manifest
  const existingManifest = await fetchExistingManifest(manifestPath);
  const manifestAssets: Record<string, ManifestAsset> = existingManifest?.assets ?? {};

  // Process each asset
  for (const row of rows) {
    if (!row.approved) {
      results.push({ assetId: row.assetId, slug: "", status: "skipped", reason: "Not approved" });
      continue;
    }

    try {
      const masterBuffer = await fetchAtlasImageBuffer(row.assetId);
      const { desktop, tablet, mobile } = await generateResponsiveVersions(masterBuffer);

      const slug  = buildFilenameSlug(row.assetTypeSlug, (row.sceneVars ?? {}) as Record<string, string>);
      const sub   = row.githubSubfolder ? row.githubSubfolder.replace(/\/$/, "") : row.assetTypeSlug;
      const base  = `${githubFolder}/${sub}`;
      const files = [
        { suffix: "desktop", buf: desktop },
        { suffix: "tablet",  buf: tablet  },
        { suffix: "mobile",  buf: mobile  },
      ];

      const publishedPaths: string[] = [];
      for (const { suffix, buf } of files) {
        const filename = `${slug}-${suffix}.webp`;
        const fullPath = `${base}/${filename}`;
        const blobSha  = await createBlob(buf);
        treeFiles.push({ path: fullPath, sha: blobSha });
        publishedPaths.push(`/${sub}/${filename}`);
      }

      slugMap.set(row.assetId, slug);
      results.push({ assetId: row.assetId, slug, status: "published", files: publishedPaths });

      // Update manifest entry (commit hash filled in after commit)
      manifestAssets[row.assetTypeSlug] = {
        slug,
        desktop: `/${sub}/${slug}-desktop.webp`,
        tablet:  `/${sub}/${slug}-tablet.webp`,
        mobile:  `/${sub}/${slug}-mobile.webp`,
        assetId: row.assetId,
        commitHash: "", // filled below
        publishedAt: new Date().toISOString(),
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      results.push({ assetId: row.assetId, slug: "", status: "failed", reason });
    }
  }

  const published = results.filter(r => r.status === "published");
  if (published.length === 0) {
    return { ok: false, results, reason: "No assets were successfully prepared" };
  }

  // Build + upload manifest blob
  const updatedManifest: BrandManifest = {
    brand:   first.brandName,
    updated: new Date().toISOString(),
    assets:  manifestAssets,
  };
  const manifestBlob = await createBlob(Buffer.from(JSON.stringify(updatedManifest, null, 2), "utf8"));
  treeFiles.push({ path: manifestPath, sha: manifestBlob });

  // Build descriptive commit message
  const assetNames = published.map(r => r.slug).join(", ");
  const commitMessage = `feat(media): add ${first.brandName.toLowerCase()} assets — ${assetNames}\n\n${published.length} asset(s) published via Atlas Asset Studio`;

  // Commit everything in one shot
  const newTreeSha   = await createTree(baseTreeSha, treeFiles);
  const commitSha    = await createCommit(commitMessage, newTreeSha, branchSha);
  await updateRef(commitSha);

  // Backfill commit hash into manifest and DB
  for (const key of Object.keys(manifestAssets)) {
    manifestAssets[key].commitHash = commitSha;
  }

  const now = new Date();
  for (const r of published) {
    const slug = slugMap.get(r.assetId)!;
    await db
      .update(atlasAssets)
      .set({
        published:          true,
        publishedAt:        now,
        publishedFilename:  slug,
        gitCommitHash:      commitSha,
        githubPublishedAt:  now,
        updatedAt:          now,
      })
      .where(eq(atlasAssets.assetId, r.assetId));
  }

  return { ok: true, commitHash: commitSha, results, manifestPath };
}

// ── GitHub status ─────────────────────────────────────────────────────────────

export async function getGitHubStatus(): Promise<GitHubStatusResult> {
  try {
    const [rateRes, branchRes] = await Promise.all([
      gh("/rate_limit"),
      gh(`/repos/${REPO}/branches/${BRANCH}`),
    ]);

    const rateJson = await rateRes.json() as { rate: { remaining: number; limit: number; reset: number } };
    const rl = rateJson.rate;

    const branchJson = await branchRes.json() as {
      commit?: { sha: string; commit: { message: string; author: { date: string } } };
    };
    const latestCommit = branchJson.commit ? {
      sha:     branchJson.commit.sha,
      message: branchJson.commit.commit.message.split("\n")[0],
      date:    branchJson.commit.commit.author.date,
    } : undefined;

    return {
      repo: REPO, branch: BRANCH, ok: true,
      rateLimit: { remaining: rl.remaining, limit: rl.limit, resetAt: new Date(rl.reset * 1000).toISOString() },
      latestCommit,
    };
  } catch (err) {
    return {
      repo: REPO, branch: BRANCH, ok: false,
      rateLimit: { remaining: 0, limit: 5000, resetAt: "" },
      reason: err instanceof Error ? err.message : String(err),
    } as GitHubStatusResult;
  }
}

// ── Approved-but-unpublished count per brand ──────────────────────────────────

export async function getPublishQueue(brandId?: number) {
  const q = db
    .select({
      assetId:        atlasAssets.assetId,
      brandId:        atlasAssets.brandId,
      sceneVars:      atlasAssets.sceneVars,
      title:          atlasAssets.title,
      published:      atlasAssets.published,
      gitCommitHash:  atlasAssets.gitCommitHash,
      githubPublishedAt: atlasAssets.githubPublishedAt,
      publishedFilename: atlasAssets.publishedFilename,
      brandName:      atlasBrands.name,
      brandSlug:      atlasBrands.slug,
      githubFolder:   atlasBrands.githubFolder,
      assetTypeName:  atlasAssetTypes.name,
      assetTypeSlug:  atlasAssetTypes.slug,
      githubSubfolder: atlasAssetTypes.githubSubfolder,
    })
    .from(atlasAssets)
    .innerJoin(atlasBrands,     eq(atlasAssets.brandId,     atlasBrands.id))
    .innerJoin(atlasAssetTypes, eq(atlasAssets.assetTypeId, atlasAssetTypes.id))
    .where(
      brandId !== undefined
        ? and(eq(atlasAssets.brandId, brandId), eq(atlasAssets.approved, true), eq(atlasAssets.archived, false))
        : and(eq(atlasAssets.approved, true), eq(atlasAssets.archived, false))
    );
  return q;
}
