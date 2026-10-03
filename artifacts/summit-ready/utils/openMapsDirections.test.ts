import { beforeEach, describe, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({ Platform: { OS: "web" }, openURL: vi.fn(), alert: vi.fn() }));
vi.mock("react-native", () => ({
  Platform: native.Platform, Linking: { openURL: native.openURL },
  Alert: { alert: native.alert }, ActionSheetIOS: {},
}));
import { openMapDirections } from "./openMaps";
beforeEach(() => { native.Platform.OS = "web"; vi.resetAllMocks(); native.openURL.mockResolvedValue(undefined); });
describe("real access-point directions", () => {
  it("uses Android navigation to exact parking coordinates rather than a summit-name search", async () => {
    native.Platform.OS = "android";
    expect(await openMapDirections(56.811, -5.076, "Visitor car park")).toBe(true);
    expect(native.openURL.mock.calls[0][0]).toContain("google.navigation:q=56.811,-5.076");
    expect(native.openURL.mock.calls[0][0]).toContain("Visitor%20car%20park");
  });
  it("uses Apple Maps on iOS and carries the destination name", async () => {
    native.Platform.OS = "ios";
    await openMapDirections(56.811, -5.076, "Visitor car park");
    expect(native.openURL.mock.calls[0][0]).toContain("maps://?daddr=56.811,-5.076&q=Visitor%20car%20park");
  });
  it("falls back to the same coordinate destination in a browser if the native app is missing", async () => {
    native.Platform.OS = "android";
    native.openURL.mockRejectedValueOnce(new Error("No installed handler"));
    expect(await openMapDirections(56.811, -5.076, "Visitor car park")).toBe(true);
    expect(native.openURL.mock.calls[1][0]).toContain("destination=56.811,-5.076");
  });
  it("fails visibly when neither app nor browser opens", async () => {
    native.Platform.OS = "ios";
    native.openURL.mockRejectedValue(new Error("Unavailable"));
    expect(await openMapDirections(56.811, -5.076, "Visitor car park")).toBe(false);
    expect(native.alert).toHaveBeenCalled();
  });
  it("does not open a destination with absent or invalid coordinates", async () => {
    expect(await openMapDirections(NaN, -5, "Car park")).toBe(false);
    expect(native.openURL).not.toHaveBeenCalled();
  });
});