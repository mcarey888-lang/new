import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  platform: "android",
  failWrite: false,
  store: new Map<string, string>(),
  sdk: {
    setAnalyticsCollectionEnabled: vi.fn(async (_enabled: boolean) => {}),
    setConsent: vi.fn(async (_settings: unknown) => {}),
    resetAnalyticsData: vi.fn(async () => {}),
    logEvent: vi.fn(async (_name: string, _params: unknown) => {}),
    logScreenView: vi.fn(async (_params: unknown) => {}),
  },
}));
vi.mock("react-native", () => ({ Platform: { get OS() { return mock.platform; } } }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "00000000-0000-4000-8000-000000000001" }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: async (key: string) => mock.store.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    if (mock.failWrite) throw new Error("Synthetic storage failure");
    mock.store.set(key, value);
  },
  removeItem: async (key: string) => { mock.store.delete(key); },
  multiRemove: async (keys: string[]) => keys.forEach(key => mock.store.delete(key)),
} }));
vi.mock("@react-native-firebase/analytics", () => ({ default: () => mock.sdk }));
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); mock.store.clear();
  mock.platform = "android"; mock.failWrite = false;
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })));
});
describe("SDK and relay runtime consent (mock SDKs; no real measurement)", () => {
  it("treats an upgraded install with malformed or absent consent as no consent", async () => {
    mock.store.set("summitready_privacy_choice_v1", '{"version":0,"analytics":true}');
    const privacy = await import("../lib/privacy");
    await privacy.initialiseNativePrivacy();
    expect(privacy.optionalAllowed("analytics")).toBe(false);
    expect(mock.sdk.setAnalyticsCollectionEnabled).not.toHaveBeenCalledWith(true);
  });
  it("does not resurrect an old grant if saving withdrawal fails", async () => {
    const privacy = await import("../lib/privacy");
    await privacy.savePrivacyChoice(true, true);
    mock.failWrite = true;
    await expect(privacy.savePrivacyChoice(false, false)).rejects.toThrow("Synthetic storage failure");
    expect(privacy.optionalAllowed("analytics")).toBe(false);
    expect(privacy.optionalAllowed("advertising")).toBe(false);
    expect(mock.store.has("summitready_privacy_choice_v1")).toBe(false);
    vi.resetModules();
    const restarted = await import("../lib/privacy");
    await restarted.privacyReady;
    expect(restarted.optionalAllowed("analytics")).toBe(false);
  });
  it("allows iOS analytics only after consent and never emits Reddit conversions", async () => {
    mock.platform = "ios";
    const privacy = await import("../lib/privacy");
    const analytics = await import("../lib/analytics");
    await analytics.logAnalyticsEvent("login");
    expect(mock.sdk.logEvent).not.toHaveBeenCalled();
    await privacy.savePrivacyChoice(true, true);
    await analytics.logAnalyticsEvent("login", { method: "google" });
    await analytics.logFirstOpenForReddit();
    expect(mock.sdk.logEvent).toHaveBeenCalledWith("login", { method: "google" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not initialise native measurement from the browser app", async () => {
    mock.platform = "web";
    const privacy = await import("../lib/privacy");
    const analytics = await import("../lib/analytics");
    await privacy.savePrivacyChoice(true, true);
    await analytics.logAnalyticsEvent("login");
    await analytics.logFirstOpenForReddit();
    expect(mock.sdk.setAnalyticsCollectionEnabled).not.toHaveBeenCalled();
    expect(mock.sdk.logEvent).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("drops optional events before any choice, including first_open", async () => {
    const analytics = await import("../lib/analytics");
    await analytics.logAnalyticsEvent("login", { method: "google" });
    await analytics.logFirstOpenForReddit();
    expect(mock.sdk.logEvent).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(mock.store.has("analytics_install_id_v1")).toBe(false);
  });
  it("allows only selected analytics, filters sensitive event parameters and stops on withdrawal", async () => {
    const privacy = await import("../lib/privacy");
    const analytics = await import("../lib/analytics");
    await privacy.savePrivacyChoice(true, false);
    await analytics.logAnalyticsEvent("readiness_test_completed", { readiness_score: 78, mountain_name: "Synthetic", method: "email" });
    expect(mock.sdk.logEvent).toHaveBeenCalledWith("readiness_test_completed", { method: "email" });
    await analytics.logFirstOpenForReddit();
    expect(fetch).not.toHaveBeenCalled();
    await privacy.savePrivacyChoice(false, false);
    await analytics.logAnalyticsEvent("login");
    expect(mock.sdk.logEvent).toHaveBeenCalledTimes(1);
    expect(mock.sdk.setConsent).toHaveBeenLastCalledWith({ analyticsStorage: false, adStorage: false, adUserData: false, adPersonalization: false });
    expect(mock.sdk.resetAnalyticsData).toHaveBeenCalled();
  });
  it("separates Reddit choice, includes consent and discards its identifier on withdrawal", async () => {
    const privacy = await import("../lib/privacy");
    const analytics = await import("../lib/analytics");
    await privacy.savePrivacyChoice(false, true);
    await analytics.logFirstOpenForReddit();
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.advertisingConsent).toBe(true);
    expect(body.installId).toBeTruthy();
    expect(body).not.toHaveProperty("advertisingId");
    expect(mock.sdk.logEvent).not.toHaveBeenCalled();
    await privacy.savePrivacyChoice(false, false);
    await analytics.logFirstOpenForReddit();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mock.store.has("analytics_install_id_v1")).toBe(false);
  });
});
