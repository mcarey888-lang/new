/**
 * The mountain image endpoint the app already serves.
 *
 * This is the EXISTING production service — no new asset, no new source, and
 * no prototype imagery. Selected approved peaks use this canonical photo
 * ahead of legacy challenge art; other subjects keep their existing artwork
 * priority and use this endpoint as a fallback.
 */
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

// The original, unversioned photo URL was cacheable for 30 days. Give the
// approved collection a new stable URL so existing devices request its
// replacement once; approved responses themselves are served with no-store.
const APPROVED_HERO_REVISION = "approved-30-20260925";

const APPROVED_MOUNTAIN_IMAGE_NAMES = new Set([
  "ben nevis",
  "snowdon",
  "yr wyddfa",
  "snowdon yr wyddfa",
  "scafell pike",
  "ben lomond",
  "helvellyn",
  "tryfan",
  "buachaille etive mor",
  "cadair idris",
  "cader idris",
  "cadair idris cader idris",
  "pen y fan",
  "old man of coniston",
  "the old man of coniston",
  "blencathra",
  "great gable",
  "catbells",
  "cat bells",
  "schiehallion",
  "suilven",
  "liathach",
  "an teallach",
  "ben macdui",
  "cairn gorm",
  "cairngorm",
  "ben aan",
  "ben a an",
  "the cobbler",
  "ben arthur",
  "the cobbler ben arthur",
  "stac pollaidh",
  "aonach eagach",
  "crib goch",
  "glyder fawr",
  "kinder scout",
  "mam tor",
  "ingleborough",
  "pen-y-ghent",
  "roseberry topping",
].map(normalizeMountainName));

function normalizeMountainName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** True only for the curated mountain set whose approved photos supersede challenge art. */
export function hasApprovedMountainImage(mountainName: string | null | undefined): boolean {
  if (!mountainName?.trim()) return false;
  const subject = normalizeMountainName(mountainName);
  if (APPROVED_MOUNTAIN_IMAGE_NAMES.has(subject)) return true;
  return [...APPROVED_MOUNTAIN_IMAGE_NAMES].some(name => {
    const suffix = subject.startsWith(`${name} `) ? subject.slice(name.length + 1) : "";
    return !!suffix
      && /\b(?:ridge|edge|route|trail|path|way|walk|hike|horseshoe|round|traverse|circuit|loop|approach|track|scramble|via)\b/.test(suffix)
      && !/\b(?:to|and)\b/.test(suffix);
  });
}

/** Preserve identity/route/location params while escaping old cached photos. */
export function appendApprovedImageRevision(uri: string, mountainName: string): string {
  if (!hasApprovedMountainImage(mountainName) || uri.includes("approvedHeroRevision=")) return uri;
  return `${uri}${uri.includes("?") ? "&" : "?"}approvedHeroRevision=${APPROVED_HERO_REVISION}`;
}

/** Null for a blank name, so a caller renders the designed gradient instead. */
export function mountainImageUri(
  mountainName: string | null | undefined,
  size?: { width: number; height: number },
): string | null {
  const name = mountainName?.trim();
  if (!name) return null;
  const dimensions = size ? `&width=${size.width}&height=${size.height}` : "";
  return appendApprovedImageRevision(`${API_BASE}/mountain-image?name=${encodeURIComponent(name)}${dimensions}`, name);
}

/**
 * The photographic subject for a training session.
 *
 * A session is a real place when the plan has assigned a hill to it; otherwise
 * the objective the whole plan is for is the honest subject. It is never a
 * stock image and never another mountain — if neither is known this returns
 * null and the caller draws the designed gradient instead.
 */
export function sessionImageSubject(input: {
  assignedHillName?: string | null;
  mountainName?: string | null;
}): string | null {
  return input.assignedHillName?.trim() || input.mountainName?.trim() || null;
}
