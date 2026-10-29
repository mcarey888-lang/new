/** Editions are identified by stable catalogue IDs, not mutable titles or dates.
 * Do not label user-created plans or unknown catalogue entries as old.
 */
export function expeditionEdition(challengeId?: string | null): "summit" | "original" | null {
  if (!challengeId) return null;
  if (/^SIG\d{3}-SUMMITS-\d+$/.test(challengeId)) return "summit";
  if (/^SIG\d{3}$/.test(challengeId) || challengeId === "EXP_483A3ED557774E939B1C045EEDE4CACD") return "original";
  return null;
}

export const EXPEDITION_EDITION_LABELS = {
  summit: "New · Summit stages",
  original: "Original",
} as const;
