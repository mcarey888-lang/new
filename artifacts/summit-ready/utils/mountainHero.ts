export type MountainHeroStatus = {
  status: "ready" | "generating" | "failed" | "unavailable";
  imageUrl?: string;
  jobId?: string;
  error?: string;
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const GENERATED_IMAGE_PATH = new RegExp(
  `^/api/artwork/mountains/(${UUID})/generated/${UUID}$`, "i",
);

/** Only immutable, server-generated mountain artwork URLs are used as direct image sources. */
export function generatedMountainHeroUrl(
  imageUrl: string | undefined,
  apiBase: string,
  mountainId: string,
): string | null {
  const match = imageUrl?.match(GENERATED_IMAGE_PATH);
  if (!match || match[1]?.toLowerCase() !== mountainId.toLowerCase()) return null;
  return `${apiBase.replace(/\/api\/?$/, "")}${imageUrl}`;
}

export function canonicalMountainImageUrl(
  apiBase: string,
  mountainId: string,
  name: string,
  location: string,
  revision?: string | null,
): string {
  const params = new URLSearchParams({
    mountainId, name, location, width: "960", height: "620",
  });
  if (revision) params.set("revision", revision);
  return `${apiBase}/mountain-image?${params.toString()}`;
}

export class MountainHeroRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly retryAfterMs: number | null) {
    super(message);
    this.name = "MountainHeroRequestError";
  }
}

export async function fetchMountainHeroStatus(
  mountainId: string,
  apiBase: string,
  getToken: () => Promise<string | null>,
  request: boolean,
): Promise<MountainHeroStatus> {
  const token = await getToken();
  if (!token) throw new Error("Sign in to request a mountain hero image.");
  const path = request ? "request-hero" : "hero-status";
  const response = await fetch(`${apiBase}/artwork/mountains/${encodeURIComponent(mountainId)}/${path}`, {
    method: request ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    const retrySeconds = Number(response.headers.get("Retry-After"));
    const retryAfterMs = Number.isFinite(retrySeconds) && retrySeconds > 0
      ? retrySeconds * 1000
      : null;
    throw new MountainHeroRequestError(
      body?.error || `Mountain image request failed (${response.status})`,
      response.status,
      retryAfterMs,
    );
  }
  return response.json() as Promise<MountainHeroStatus>;
}