/**
 * Admin session token helpers for Atlas Media Studio.
 *
 * All API calls that hit admin-protected endpoints must include the session
 * token returned by POST /api/admin/login as an Authorization Bearer header.
 *
 * The token is stored in sessionStorage (tab-scoped, cleared on close).
 */

export const TOKEN_KEY = "summit_admin_token";

export function getAdminToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

/**
 * Fetch wrapper that automatically attaches the admin token to every request.
 * Use this instead of raw `fetch` for all /api/atlas calls.
 */
export async function adminApiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token = getAdminToken();
  const r = await fetch(input, {
    ...init,
    headers: {
      ...init.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return r;
}

/**
 * Like adminApiFetch but throws on non-OK responses and returns parsed JSON.
 */
export async function adminApiFetchJson<T = unknown>(
  path: string,
  opts?: RequestInit,
): Promise<T> {
  const r = await adminApiFetch(path, opts);
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}
