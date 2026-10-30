import { router, useLocalSearchParams } from "expo-router";

type PaywallReturnParams = {
  returnTo?: string;
  next?: string;
  tier?: string;
  trigger?: string;
  score?: string;
  mountain?: string;
  goal?: string;
  fromQuestionnaire?: string;
  plan?: string;
};

/** Only these post-paywall intents may be carried through sign-in. */
export const SAFE_PAYWALL_RETURN = ["questionnaire", "training_basecamp"] as const;
const SAFE_TRIGGER = /^[a-z0-9_]{1,40}$/;

export function sanitisePaywallParams(params: PaywallReturnParams): Record<string, string> {
  const intent = params.next ?? params.returnTo;
  return {
    ...((params.tier === "expeditions" || params.tier === "pro") && { tier: params.tier }),
    ...(params.trigger && SAFE_TRIGGER.test(params.trigger) && { trigger: params.trigger }),
    ...(intent && (SAFE_PAYWALL_RETURN as readonly string[]).includes(intent) && { returnTo: intent }),
    ...(params.score && /^\d{1,3}$/.test(params.score) && { score: params.score }),
    ...(params.mountain && { mountain: params.mountain.slice(0, 120) }),
    ...(params.goal && { goal: params.goal.slice(0, 120) }),
    ...(params.fromQuestionnaire === "true" && { fromQuestionnaire: "true" }),
    ...((params.plan === "annual" || params.plan === "monthly") && { plan: params.plan }),
  };
}

export function usePaywallAuthReturn() {
  const params = useLocalSearchParams<PaywallReturnParams>();
  const isPaywall = params.returnTo === "paywall";
  const paywallParams = isPaywall ? sanitisePaywallParams({ ...params, returnTo: undefined }) : {};
  // Auth screens use returnTo="paywall"; the paywall's own intent travels as `next`.
  const { returnTo: next, ...rest } = paywallParams;
  const authParams: Record<string, string> = isPaywall
    ? { returnTo: "paywall", ...rest, ...(next && { next }) }
    : {};

  function finishAuthentication() {
    if (isPaywall) {
      router.replace({ pathname: "/paywall", params: paywallParams });
    } else {
      router.replace("/");
    }
  }

  return { authParams, finishAuthentication };
}
