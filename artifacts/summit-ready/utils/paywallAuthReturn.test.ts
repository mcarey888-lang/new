import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, getParams } = vi.hoisted(() => ({
  replace: vi.fn(),
  getParams: vi.fn(),
}));

vi.mock("expo-router", () => ({
  router: { replace },
  useLocalSearchParams: getParams,
}));

import { usePaywallAuthReturn } from "./paywallAuthReturn";

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
      params: authParams,
    });
  });

  it("keeps ordinary sign-in routing unchanged", () => {
    getParams.mockReturnValue({});
    usePaywallAuthReturn().finishAuthentication();
    expect(replace).toHaveBeenCalledWith("/");
  });
});