export class ExpeditionDetailError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfterSeconds = 0) {
    super(message);
    this.name = "ExpeditionDetailError";
  }
}

export function retryAfterSeconds(value: string | null, now = Date.now()): number {
  if (!value) return 60;
  const numeric = Number(value);
  const seconds = Number.isFinite(numeric) ? numeric : (Date.parse(value) - now) / 1000;
  return Number.isFinite(seconds) && seconds >= 0 ? Math.max(1, Math.ceil(seconds)) : 60;
}

/** Fetch only the selected catalogue detail; never generates a replacement. */
export async function requestExpeditionDetail<T>(
  apiBase: string, challengeId: string, signal: AbortSignal,
): Promise<T> {
  const response = await fetch(`${apiBase}/sx/challenges/${encodeURIComponent(challengeId)}`, { signal });
  if (response.status === 429) {
    throw new ExpeditionDetailError(
      "Expedition browsing is temporarily busy. Please wait, then try again. Nothing has been changed.",
      429, retryAfterSeconds(response.headers.get("Retry-After")),
    );
  }
  if (!response.ok) throw new ExpeditionDetailError(
    response.status === 404 ? "This expedition is no longer available."
      : "Could not load this expedition. Please try again.", response.status,
  );
  const body = await response.json();
  if (!body?.challenge || typeof body.challenge !== "object" || body.challenge.challengeId !== challengeId)
    throw new ExpeditionDetailError("The expedition response was incomplete. Please try again.", 502);
  return body.challenge as T;
}
