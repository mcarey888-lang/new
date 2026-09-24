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
export function mountainImageUri(
  mountainName: string | null | undefined,
  size?: { width: number; height: number },
): string | null {
  const name = mountainName?.trim();
  if (!name) return null;
  const dimensions = size ? `&width=${size.width}&height=${size.height}` : "";
  return `${API_BASE}/mountain-image?name=${encodeURIComponent(name)}${dimensions}`;
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
