const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

export interface ArtworkResolution {
  assetId: string;
  version: number;
  placement: "hero";
  derivativePath: string;
  url: string;
}

export interface ResolvedTrainingBasecampArtwork extends ArtworkResolution {
  uri: string;
}

export interface TrainingBasecampArtworkContext {
  devProfileId: string | null;
  mountainName: string;
}

export const TRAINING_BASECAMP_ARTWORK = {
  assetId: "SR-MTN-MONTBLANC-001",
  version: 1,
  placement: "hero",
  derivativePath: "/api/artwork/batches/batch-01/SR-MTN-MONTBLANC-001/v1/hero",
} as const;

export async function resolveTrainingBasecampArtwork(
  context: TrainingBasecampArtworkContext,
): Promise<ResolvedTrainingBasecampArtwork | null> {
  if (
    !__DEV__
    || context.devProfileId !== "active_hillwalker"
    || context.mountainName.trim() !== "Mont Blanc"
  ) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(
      `${API_BASE}/artwork/resolve/${TRAINING_BASECAMP_ARTWORK.assetId}/${TRAINING_BASECAMP_ARTWORK.placement}`,
      { signal: controller.signal },
    );
    if (!res.ok) return null;

    const data = await res.json() as ArtworkResolution;
    if (
      data?.assetId !== TRAINING_BASECAMP_ARTWORK.assetId
      || data.version !== TRAINING_BASECAMP_ARTWORK.version
      || data.placement !== TRAINING_BASECAMP_ARTWORK.placement
      || data.derivativePath !== TRAINING_BASECAMP_ARTWORK.derivativePath
      || typeof data.url !== "string"
      || data.url.length === 0
    ) {
      return null;
    }

    const origin = process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "";
    const uri = /^https?:\/\//.test(data.url)
      ? data.url
      : `${origin}${data.url.startsWith("/") ? data.url : `/${data.url}`}`;
    return { ...data, uri };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
