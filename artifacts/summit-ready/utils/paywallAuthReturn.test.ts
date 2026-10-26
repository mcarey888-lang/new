import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, getParams } = vi.hoisted(() => ({
  replace: vi.fn(),
  getParams: vi.fn(),
}));

vi.mock("expo-router", () => ({
  router: { replace },
  useLocalSearchParams: getParams,
}));

import { sanitisePaywallParams, usePaywallAuthReturn } from "./paywallAuthReturn";

describe("paywall sign-in return", () => {
  beforeEach(() => {
    replace.mockReset();
    getParams.mockReset();
  });

  it("returns to the same questionnaire paywall after authentication", () => {
    getParams.mockReturnValue({
      returnTo: "paywall",
      score: "27",
      mountain: "Mont Blanc",
      fromQuestionnaire: "true",
      plan: "annual",
    });
    const { authParams, finishAuthentication } = usePaywallAuthReturn();
    expect(authParams).toEqual({
      returnTo: "paywall",
      score: "27",
      mountain: "Mont Blanc",
      fromQuestionnaire: "true",
      plan: "annual",
    });
    finishAuthentication();
    expect(replace).toHaveBeenCalledWith({
      pathname: "/paywall",
      params: { score: "27", mountain: "Mont Blanc", fromQuestionnaire: "true", plan: "annual" },
    });
  });

  it("preserves tier, trigger, goal and safe training intent", () => {
    getParams.mockReturnValue({
      returnTo: "paywall",
      next: "questionnaire",
      tier: "pro",
      trigger: "mode_select_training",
      mountain: "Ben Nevis",
      goal: "Summit in June",
      plan: "monthly",
    });
    const { authParams, finishAuthentication } = usePaywallAuthReturn();
    expect(authParams).toEqual({
      returnTo: "paywall",
      next: "questionnaire",
      tier: "pro",
      trigger: "mode_select_training",
      mountain: "Ben Nevis",
      goal: "Summit in June",
      plan: "monthly",
    });
    finishAuthentication();
    expect(replace).toHaveBeenCalledWith({
      pathname: "/paywall",
      params: {
        returnTo: "questionnaire",
        tier: "pro",
        trigger: "mode_select_training",
        mountain: "Ben Nevis",
        goal: "Summit in June",
        plan: "monthly",
      },
    });
  });

  it("drops unsafe return targets and unknown tiers", () => {
    expect(sanitisePaywallParams({ returnTo: "https://evil.example", tier: "gold", trigger: "x y" })).toEqual({});
  });

  it("keeps ordinary sign-in routing unchanged", () => {
    getParams.mockReturnValue({});
    usePaywallAuthReturn().finishAuthentication();
    expect(replace).toHaveBeenCalledWith("/");
  });
});
