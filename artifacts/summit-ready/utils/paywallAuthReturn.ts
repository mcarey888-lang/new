import { router, useLocalSearchParams } from "expo-router";

type PaywallReturnParams = {
  returnTo?: string;
  score?: string;
  mountain?: string;
  fromQuestionnaire?: string;
  plan?: string;
};

export function usePaywallAuthReturn() {
  const params = useLocalSearchParams<PaywallReturnParams>();
  const authParams = params.returnTo === "paywall"
    ? {
        returnTo: "paywall",
        ...(params.score && { score: params.score }),
        ...(params.mountain && { mountain: params.mountain }),
        ...(params.fromQuestionnaire === "true" && { fromQuestionnaire: "true" }),
        ...(params.plan === "annual" && { plan: "annual" }),
      }
    : {};

  function finishAuthentication() {
    if (params.returnTo === "paywall") {
      router.replace({ pathname: "/paywall", params: authParams });
    } else {
      router.replace("/");
    }
  }

  return { authParams, finishAuthentication };
}