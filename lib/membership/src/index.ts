/** Shared feature policy. Only verified RevenueCat/store evidence grants paid access. */
export type MembershipTier = "explore" | "expeditions" | "pro";
export const MEMBERSHIP = {
  entitlements: { expeditions: "expeditions", pro: "pro", legacy: "premium" },
  offerings: { expeditions: "expeditions", pro: "pro", legacy: "default" },
  // Deliberately not a guessed catalogue ID. No existing expedition yet has
  // sufficient verified stage content to meet the owner's starter requirement.
  starterExpeditionId: null as string | null,
  // Enable only after native store grouping/replacement is configured and verified.
  nativeUpgradesVerified: false,
  coaching: { proposedMonthlyRequests: 30, status: "proposed" as const },
  // Measured from the store response timestamp, never from a cache read/retry.
  maxCachedAccessMs: 24 * 60 * 60_000,
} as const;

export interface MembershipAccess {
  tier: MembershipTier;
  fullExpeditions: boolean;
  training: boolean;
  legacy: boolean;
}

export function accessFromEntitlements(active: readonly string[]): MembershipAccess {
  const legacy = active.includes(MEMBERSHIP.entitlements.legacy);
  const training = legacy || active.includes(MEMBERSHIP.entitlements.pro);
  const fullExpeditions = training || active.includes(MEMBERSHIP.entitlements.expeditions);
  return { tier: training ? "pro" : fullExpeditions ? "expeditions" : "explore", fullExpeditions, training, legacy };
}

export function canUseExpedition(access: MembershipAccess, catalogueId: string | null | undefined): boolean {
  return access.fullExpeditions || (
    MEMBERSHIP.starterExpeditionId !== null && catalogueId === MEMBERSHIP.starterExpeditionId
  );
}

export function activeEntitlementIds(
  info: { entitlements?: { active?: Record<string, { isActive?: boolean; expirationDate?: string | null }> } } | null | undefined,
  now = Date.now(),
): string[] {
  return Object.entries(info?.entitlements?.active ?? {}).filter(([, e]) =>
    e.isActive !== false && (!e.expirationDate || new Date(e.expirationDate).getTime() > now)
  ).map(([id]) => id);
}

type CachedCustomerInfo = Parameters<typeof activeEntitlementIds>[0] & {
  requestDate?: string;
};

/**
 * SDK CustomerInfo may itself be cached. A successful SDK cache read must not
 * restart its offline allowance. Missing/invalid evidence never grants access.
 * Known entitlement expiry can shorten, but never extend, this 24-hour limit.
 */
export function cachedEntitlementIds(
  info: CachedCustomerInfo | null | undefined,
  now = Date.now(),
): string[] {
  const requestedAt = Date.parse(info?.requestDate ?? "");
  if (!Number.isFinite(requestedAt) || requestedAt > now + 5 * 60_000 ||
      now >= requestedAt + MEMBERSHIP.maxCachedAccessMs) return [];
  return activeEntitlementIds(info, now);
}

export function tierForPackage(
  packageId: string,
  offeringId: string | undefined,
): Exclude<MembershipTier, "explore"> | null {
  // Never infer a paid tier from array position or a display name.
  if (offeringId === MEMBERSHIP.offerings.expeditions || /^expeditions_(monthly|annual)$/.test(packageId)) return "expeditions";
  if (offeringId === MEMBERSHIP.offerings.pro || offeringId === MEMBERSHIP.offerings.legacy || /^pro_(monthly|annual)$/.test(packageId)) return "pro";
  return null;
}
