export function isMountainHeroImageRejected(reviewData: string | null | undefined, imageUrl: string): boolean {
  if (!reviewData) return false;
  try {
    const review = JSON.parse(reviewData) as { rejectedUrls?: string[] };
    return (review.rejectedUrls ?? []).includes(imageUrl);
  } catch {
    return true;
  }
}