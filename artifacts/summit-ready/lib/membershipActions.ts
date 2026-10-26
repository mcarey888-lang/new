import { router } from "expo-router";
import { authorizeMembershipAction } from "@workspace/api-client-react";
import { canUseExpedition, type MembershipAccess } from "@workspace/membership";

export class MembershipRequiredError extends Error {
  constructor(readonly tier: "pro" | "expeditions") {
    super(`${tier === "pro" ? "SummitReady Pro" : "Expeditions"} access is required`);
    this.name = "MembershipRequiredError";
  }
}

export function assertMembership(access: MembershipAccess, feature: "training" | "expedition", expeditionId?: string) {
  if (feature === "training" ? access.training : canUseExpedition(access, expeditionId)) return;
  const tier = feature === "training" ? "pro" : "expeditions";
  router.push({ pathname: "/paywall", params: { tier, trigger: feature } });
  throw new MembershipRequiredError(tier);
}

/** Re-check server authority before new personalised generation or expedition start.
 * Offline store-SDK entitlement evidence stays valid; a server denial is never ignored.
 */
export async function authorizeNewAction(access: MembershipAccess, feature: "training" | "expedition", expeditionId?: string) {
  assertMembership(access, feature, expeditionId);
  try {
    await authorizeMembershipAction({ feature, expeditionId });
  } catch (error: any) {
    if (error?.status === 401 || error?.status === 403) throw error;
    // A transport outage does not revoke an existing store-verified entitlement.
    // APIs independently re-check authority when syncing paid operations.
    if (!(feature === "training" ? access.training : canUseExpedition(access, expeditionId))) throw error;
  }
}
