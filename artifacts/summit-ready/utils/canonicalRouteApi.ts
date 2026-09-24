import type { CanonicalRouteRecord } from "./routeIntelligence";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

export type CanonicalRouteApiResult = {
  status: "available" | "degraded" | "ambiguous" | "unavailable";
  reasons: string[];
  record: CanonicalRouteRecord | null;
};

export async function fetchCanonicalRouteRecord(
  routeId: string,
  mountainId: string,
  getToken?: () => Promise<string | null>,
): Promise<CanonicalRouteApiResult> {
  const params = new URLSearchParams({ routeId, mountainId });
  try {
    const token = getToken ? await getToken() : null;
    const response = await fetch(`${API_BASE}/canonical-routes?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const body = await response.json().catch(() => null) as Partial<CanonicalRouteApiResult> | null;
    if (!response.ok || !body) {
      return {
        status: body?.status === "ambiguous" ? "ambiguous" : "unavailable",
        reasons: body?.reasons ?? ["unavailable"],
        record: null,
      };
    }
    return {
      status: body.status ?? "unavailable",
      reasons: body.reasons ?? [],
      record: body.record as CanonicalRouteRecord | null,
    };
  } catch {
    return { status: "unavailable", reasons: ["unavailable"], record: null };
  }
}

export async function hydrateCanonicalRouteRecords(
  references: readonly { routeId?: string | null; mountainId?: string | null }[],
  getToken?: () => Promise<string | null>,
): Promise<CanonicalRouteRecord[]> {
  const records = await Promise.all(
    references
      .filter((reference): reference is { routeId: string; mountainId: string } =>
        Boolean(reference.routeId && reference.mountainId))
      .map(reference => fetchCanonicalRouteRecord(reference.routeId, reference.mountainId, getToken)),
  );
  return records
    .map(result => result.record)
    .filter((record): record is CanonicalRouteRecord => Boolean(record));
}