export type ExpeditionCatalogueItem = {
  challengeId: string; challengeName: string; targetMountainName: string;
  difficulty: string | null; recommendedDays: number;
  adventureScore: number | null; totalAscentM: number | null;
  regions: string | null; featured: boolean;
  heroImage?: string | null; cardImage?: string | null;
  thumbnailImage?: string | null; approved?: boolean;
};

/** Active catalogue membership is independent of editorial Featured status. */
export async function fetchActiveExpeditionCatalogue(
  apiBase: string,
  signal?: AbortSignal,
): Promise<ExpeditionCatalogueItem[]> {
  const response = await fetch(`${apiBase.replace(/\/+$/, "")}/sx/challenges`, { signal });
  if (!response.ok) throw new Error("Could not load expeditions. Please try again.");
  const data = await response.json();
  if (!Array.isArray(data?.challenges) || data.challenges.some((item: unknown) =>
    !item || typeof item !== "object" ||
    typeof (item as ExpeditionCatalogueItem).challengeId !== "string" ||
    typeof (item as ExpeditionCatalogueItem).challengeName !== "string")) {
    throw new Error("The expedition catalogue could not be read. Please try again.");
  }
  return data.challenges;
}
