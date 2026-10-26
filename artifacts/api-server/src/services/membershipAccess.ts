import { accessFromEntitlements, type MembershipAccess } from "@workspace/membership";

type VerifiedAccess = { access: MembershipAccess; validUntil: number; refreshAt: number };
const cache = new Map<string, VerifiedAccess>();
let credential: { value: string; expiresAt: number } | undefined;
let definitions: { names: Map<string, string>; until: number } | undefined;

async function revenueCatToken(): Promise<string> {
  if (credential && credential.expiresAt > Date.now() + 30_000) return credential.value;
  const host = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const identity = process.env.REPL_IDENTITY
    ? `repl ${process.env.REPL_IDENTITY}`
    : process.env.WEB_REPL_RENEWAL ? `depl ${process.env.WEB_REPL_RENEWAL}` : null;
  if (!host || !identity) throw new Error("RevenueCat server connection is unavailable");
  const response = await fetch(`https://${host}/api/v2/connection?include_secrets=true&connector_names=revenuecat`, {
    headers: { Accept: "application/json", "X-Replit-Token": identity },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("RevenueCat server connection failed");
  const body = await response.json() as any;
  const settings = body.items?.[0]?.settings;
  const value = settings?.access_token || settings?.oauth?.credentials?.access_token;
  if (typeof value !== "string") throw new Error("RevenueCat server connection is missing");
  const expiresAt = Date.parse(settings.expires_at ?? "");
  credential = { value, expiresAt: Number.isFinite(expiresAt) ? expiresAt : Date.now() + 60_000 };
  return value;
}

async function readRevenueCat(path: string): Promise<any> {
  const response = await fetch(`https://api.revenuecat.com/v2/${path}`, {
    headers: { Authorization: `Bearer ${await revenueCatToken()}`, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (response.status === 404 && path.includes("/customers/")) return { items: [] };
  if (!response.ok) throw new Error("RevenueCat verification is temporarily unavailable");
  return response.json();
}

export function usableCachedAccess(value: VerifiedAccess | undefined, now: number): MembershipAccess | null {
  return value && value.validUntil > now ? value.access : null;
}

/** Server-to-server authority. Never accepts client entitlement or free flags. */
export async function verifiedMembership(userId: string, refresh = false): Promise<MembershipAccess> {
  const now = Date.now();
  const previous = cache.get(userId);
  if (!refresh && previous && previous.refreshAt > now) return previous.access;
  const project = process.env.REVENUECAT_PROJECT_ID;
  if (!project) throw new Error("RevenueCat project is not configured");
  try {
    if (!definitions || definitions.until < now) {
      const result = await readRevenueCat(`projects/${encodeURIComponent(project)}/entitlements?limit=100`);
      if (!Array.isArray(result.items)) throw new Error("Invalid RevenueCat entitlement response");
      definitions = { names: new Map(result.items.map((e: any) => [e.id, e.lookup_key])), until: now + 300_000 };
    }
    const environment = process.env.NODE_ENV === "production" ? "production" : "sandbox";
    const prefix = `projects/${encodeURIComponent(project)}/customers/${encodeURIComponent(userId)}`;
    const [result, subscriptions] = await Promise.all([
      readRevenueCat(`${prefix}/active_entitlements?limit=100`),
      readRevenueCat(`${prefix}/subscriptions?environment=${environment}&limit=100`),
    ]);
    if (!Array.isArray(result.items) || result.next_page) throw new Error("Incomplete RevenueCat access response");
    if (!Array.isArray(subscriptions.items) || subscriptions.next_page) throw new Error("Incomplete RevenueCat subscription response");
    const environmentEntitlements = new Set(subscriptions.items
      .filter((s: any) => s.environment === environment && s.gives_access === true)
      .flatMap((s: any) => (s.entitlements?.items ?? []).map((e: any) => e.id)));
    const active = result.items.filter((e: any) => environmentEntitlements.has(e.entitlement_id) && (e.expires_at === null || (
      typeof e.expires_at === "number" && e.expires_at > now
    )));
    const ids = active.map((e: any) => definitions!.names.get(e.entitlement_id)).filter((id: unknown): id is string => typeof id === "string");
    const access = accessFromEntitlements(ids);
    const ends = active.map((e: any) => e.expires_at as number | null).filter((t: number | null): t is number => t !== null);
    // Network errors may retain already verified access only through its known end.
    // A successful response without entitlement always replaces earlier access.
    const validUntil = active.length ? Math.min(now + 24 * 60 * 60_000, ...ends) : now + 30_000;
    cache.set(userId, { access, validUntil, refreshAt: Math.min(now + 30_000, validUntil) });
    if (cache.size > 10_000) cache.delete(cache.keys().next().value!);
    return access;
  } catch (error) {
    const retained = usableCachedAccess(previous, now);
    if (retained) return retained;
    throw error;
  }
}
