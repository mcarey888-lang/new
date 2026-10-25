type ExpeditionArtwork = {
  challengeId: string; approved?: boolean | null; imageVersion?: number | null;
  heroImage?: string | null; cardImage?: string | null; thumbnailImage?: string | null;
};

/** A regional expedition represents its own approved composition, not just
 * the mountain that inspired it. Never substitute another challenge's art. */
export function approvedExpeditionArtwork(
  challenge: ExpeditionArtwork | null | undefined,
  crop: "hero" | "card" | "thumbnail",
  apiBase: string,
): string | null {
  if (!challenge?.approved) return null;
  const choices = crop === "hero" ? [challenge.heroImage, challenge.cardImage]
    : crop === "card" ? [challenge.cardImage, challenge.heroImage]
    : [challenge.thumbnailImage, challenge.cardImage, challenge.heroImage];
  const path = choices.find(value => value && ["hero", "card", "thumbnail"]
    .some(kind => value === `/api/artwork/image/${challenge.challengeId}/${kind}`));
  if (!path) return null;
  // Stable current-approved URL: the server rechecks approval and serves its
  // exact approved version. New namespace also escapes older year-long caches.
  return `${apiBase.replace(/\/api\/?$/, "")}${path}?approved=1&artwork=expedition-v1&v=${challenge.imageVersion ?? 0}`;
}
