import { describe, it, expect } from "vitest";
import { parsePrivacyChoice, permits } from "./privacyConsent";
describe("optional measurement consent", () => {
  it.each([null, "", "broken", "{}", '{"version":0,"analytics":true,"advertising":true}'])("fails closed for %s", raw => {
    const choice = parsePrivacyChoice(raw);
    expect(permits(choice, "analytics")).toBe(false);
    expect(permits(choice, "advertising")).toBe(false);
  });
  it("separates analytics, advertising, decline and withdrawal", () => {
    const analytics = parsePrivacyChoice('{"version":1,"analytics":true,"advertising":false}');
    expect(permits(analytics, "analytics")).toBe(true);
    expect(permits(analytics, "advertising")).toBe(false);
    const withdrawn = parsePrivacyChoice('{"version":1,"analytics":false,"advertising":false}');
    expect(permits(withdrawn, "analytics")).toBe(false);
    expect(permits(withdrawn, "advertising")).toBe(false);
  });
});
