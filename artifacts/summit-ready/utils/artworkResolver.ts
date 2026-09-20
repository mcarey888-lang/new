const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

export interface ArtworkResolution {
  url: string;
}

export async function resolveTrainingBasecampArtwork(): Promise<string | null> {
  if (!__DEV__) return null;
  
  try {
    const res = await fetch(`${API_BASE}/artwork/resolve/SR-TRAIN-BASECAMP-001/hero`);
    if (!res.ok) return null;
    
    const data = await res.json() as ArtworkResolution;
    if (data && data.url && typeof data.url === "string") {
      if (/^https?:\/\//.test(data.url)) return data.url;
      const origin = process.env.EXPO_PUBLIC_DOMAIN
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
        : "";
      return `${origin}${data.url.startsWith("/") ? data.url : `/${data.url}`}`;
    }
    return null;
  } catch (err) {
    return null;
  }
}
