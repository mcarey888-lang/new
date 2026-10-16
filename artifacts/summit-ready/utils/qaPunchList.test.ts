import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { expeditionArtworkUri } from "./mountainImage";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

describe("QA questionnaire and upgrade escape paths", () => {
  const quiz = read("app/questionnaire.tsx");
  const paywall = read("app/paywall.tsx");
  const setup = read("app/setup.tsx");
  it("takes the saved questionnaire through real goal setup, not a purchase gate", () => {
    expect(quiz).toContain('AsyncStorage.setItem(_quizKey');
    expect(quiz).toContain('router.replace("/setup")');
    expect(quiz).not.toContain('pathname: "/paywall"');
    expect(setup.indexOf("await setSummitGoal(newGoal)")).toBeLessThan(setup.indexOf('router.replace("/(tabs)/dashboard")'));
    expect(setup).toContain("setAvailableDays(data.availableDays)");
  });
  it("does not call step seven the last step", () => {
    expect(quiz).not.toContain("Last step — your training preferences");
  });
  it("gives every answer, including No, an explicit accessible name and selection state", () => {
    expect(quiz.match(/accessibilityLabel=\{label\}/g)).toHaveLength(2);
    expect(quiz).toContain("accessibilityState={{ selected: active }}");
    expect(quiz).toContain("accessibilityState={{ selected }}");
  });
  it("provides a free exit independently of subscription offerings", () => {
    expect(paywall).toContain('testID="paywall-continue-free"');
    expect(paywall).toContain('testID="paywall-close"');
    expect(paywall).toContain("else if (router.canGoBack()) router.back()");
    expect(paywall).toContain('else router.replace("/(tabs)/dashboard")');
    expect(paywall).toContain('Platform.OS === "ios"');
    expect(paywall).toContain("Native-store subscriptions are purchased and managed");
  });
  it("only mounts the notice on the focused dashboard and remembers the questionnaire acknowledgement", () => {
    expect(read("app/(tabs)/dashboard.tsx")).toContain("{isFocused && showBaselineModal && <Modal");
    expect(quiz).toContain('await AsyncStorage.setItem("baseline_popup_seen", "1")');
  });
});

describe("expedition artwork identity", () => {
  it("requests Kilimanjaro by name, forbids map fallback, and escapes old tile caches", () => {
    const uri = expeditionArtworkUri("Kilimanjaro");
    const parsed = new URL(uri, "https://example.test");
    expect(parsed.searchParams.get("name")).toBe("Kilimanjaro");
    expect(parsed.searchParams.get("fallback")).toBe("illustration");
    expect(parsed.searchParams.get("artworkRevision")).toBe("expedition-identity-v1");
  });
  it("still prioritises approved artwork for the existing collection", () => {
    expect(expeditionArtworkUri("Ben Nevis")).toContain("approvedHeroRevision=");
  });
  it("uses explicit image dimensions and readable country instead of unreliable flag glyphs", () => {
    const card = read("components/VirtualMountainCard.tsx");
    expect(card).not.toContain("{bundle.flag}");
    expect(card).toContain("{bundle.country}");
    expect(card).toContain('width: "100%", height: "100%"');
    expect(card).toContain('backgroundColor: "#0A1525"');
  });
});
