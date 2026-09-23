/**
 * The mountain image endpoint the app already serves.
 *
 * Extracted while rolling the approved visuals out beyond Training Basecamp so
 * every screen that shows a mountain photograph asks for it the same way. This
 * is the EXISTING production service — no new asset, no new source, and no
 * prototype imagery. Curated artwork still comes from the artwork resolver;
 * this is the fallback that resolver already falls back to.
 */
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

/** Null for a blank name, so a caller renders the designed gradient instead. */
export function mountainImageUri(mountainName: string | null | undefined): string | null {
  const name = mountainName?.trim();
  if (!name) return null;
  return `${API_BASE}/mountain-image?name=${encodeURIComponent(name)}`;
}
