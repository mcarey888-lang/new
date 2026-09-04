export function authenticatedJsonHeaders(token: string | null): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function authenticatedHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function tokenBelongsToUser(token: string, userId: string): boolean {
  try {
    const encoded = token.split(".")[1];
    if (!encoded) return false;
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(globalThis.atob(padded)) as { sub?: unknown };
    return payload.sub === userId;
  } catch {
    return false;
  }
}

export async function responseError(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => ({})) as { error?: string };
  return new Error(body.error ?? `${fallback} (${res.status})`);
}