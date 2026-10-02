/**
 * Saving and loading routes the person drew themselves.
 *
 * WHY THE APP DOES THIS AND NOT THE MAP PAGE
 * ------------------------------------------
 * The map is a web page in a WebView. It has no Clerk session, and giving it
 * one would mean putting a token into a URL or into page script — somewhere it
 * can be read, logged, or left in history. The app holds the session, so the
 * app does the saving: the page hands up the route it drew, and this module
 * sends it with the signed-in person's token.
 *
 * Every call returns a result rather than throwing. Saving a route is
 * something a person does standing on a hillside with one bar of signal, and a
 * failure needs to be a message on screen, not a crash.
 */

const API_BASE =
  process.env.EXPO_PUBLIC_MAP_BASE ??
  (process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
    : "/api");

export interface PlannedRoutePoint { lat: number; lng: number }

export interface PlannedRouteLeg {
  kind: "routed" | "gap" | "offPath" | "straight" | "pending";
  lengthM?: number | null;
}

export interface PlannedRoute {
  id: string;
  name: string;
  /** Which summit this route climbs. Null when it is not about one. */
  hillSlug: string | null;
  anchors: PlannedRoutePoint[];
  geometry: PlannedRoutePoint[];
  legs: PlannedRouteLeg[];
  lengthM: number;
  /** Null means unknown, and must stay null. A route whose heights could not
   *  be read has unknown ascent, not zero — telling someone a mountain day is
   *  flat is a confident wrong answer. */
  ascentM: number | null;
  descentM: number | null;
  fullySnapped: boolean;
  updatedAt?: string;
}

export interface SaveDraft {
  id?: string;
  name: string;
  hillSlug?: string | null;
  anchors: PlannedRoutePoint[];
  geometry: PlannedRoutePoint[];
  legs?: PlannedRouteLeg[];
  lengthM: number;
  ascentM?: number | null;
  descentM?: number | null;
  profile?: unknown;
  fullySnapped?: boolean;
}

export type ApiResult<T> =
  | { ok: true; value: T }
  /** `reason` is for the person, `signedOut` so the caller can send them to
   *  sign in rather than showing a dead end. */
  | { ok: false; reason: string; signedOut?: boolean };

type GetToken = () => Promise<string | null>;

async function call<T>(
  path: string,
  init: RequestInit,
  getToken: GetToken,
  read: (body: unknown) => T,
): Promise<ApiResult<T>> {
  let token: string | null = null;
  try {
    token = await getToken();
  } catch {
    return { ok: false, reason: "Could not check you are signed in", signedOut: true };
  }
  /* Checked before the request rather than after a 401. A route is somebody's
     work, and losing it to a round trip that was never going to succeed is
     avoidable. */
  if (!token) return { ok: false, reason: "Sign in to save routes", signedOut: true };

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (res.status === 401) return { ok: false, reason: "Sign in to save routes", signedOut: true };
    if (!res.ok) {
      /* The server's own reason where it gave one: "a route needs a name" is
         something the person can act on, where "save failed" is not. */
      const reason = typeof body?.["error"] === "string" ? (body["error"] as string) : "Could not reach the server";
      return { ok: false, reason };
    }
    return { ok: true, value: read(body) };
  } catch {
    return { ok: false, reason: "No connection" };
  }
}

export function saveRoute(draft: SaveDraft, getToken: GetToken): Promise<ApiResult<PlannedRoute>> {
  return call(
    "/planned-routes",
    { method: "POST", body: JSON.stringify(draft) },
    getToken,
    body => (body as { route: PlannedRoute }).route,
  );
}

/** All of this person's routes, or only the ones planned for one summit. */
export function listRoutes(
  getToken: GetToken,
  hillSlug?: string | null,
): Promise<ApiResult<PlannedRoute[]>> {
  const path = hillSlug
    ? `/planned-routes?hill=${encodeURIComponent(hillSlug)}`
    : "/planned-routes";
  return call(path, { method: "GET" }, getToken, body => {
    const routes = (body as { routes?: unknown })?.routes;
    return Array.isArray(routes) ? (routes as PlannedRoute[]) : [];
  });
}

export function loadRoute(id: string, getToken: GetToken): Promise<ApiResult<PlannedRoute>> {
  return call(
    `/planned-routes/${encodeURIComponent(id)}`,
    { method: "GET" },
    getToken,
    body => (body as { route: PlannedRoute }).route,
  );
}

export function deleteRoute(id: string, getToken: GetToken): Promise<ApiResult<string>> {
  return call(
    `/planned-routes/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    getToken,
    body => String((body as { deleted?: unknown })?.deleted ?? id),
  );
}

/**
 * How a saved route should be described in a list.
 *
 * Ascent is omitted entirely when it is unknown rather than shown as a dash
 * next to a number — a row reading "4.2 km · 0 m" is read as a flat walk, and
 * "4.2 km" alone is honestly silent about the climb.
 */
export function describeRoute(route: Pick<PlannedRoute, "lengthM" | "ascentM" | "fullySnapped">): string {
  const parts = [`${(route.lengthM / 1000).toFixed(2)} km`];
  if (typeof route.ascentM === "number") parts.push(`↑${route.ascentM} m`);
  if (!route.fullySnapped) parts.push("not all on paths");
  return parts.join(" · ");
}
