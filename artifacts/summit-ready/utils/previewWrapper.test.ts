import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(__dirname, "../scripts/sync-preview-wrapper.js"), "utf8");
const inlineScript = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!inlineScript) throw new Error("Missing preview entry script");

function entryFor(search: string): string {
  let destination = "";
  const history = { replaceState: (_state: unknown, _title: string, path: string) => {
    destination = path;
  }};
  new Function("window", "history", inlineScript)({ location: { search } }, history);
  return destination;
}

describe("mobile preview entry", () => {
  it("keeps the preview root within the dynamic phone viewport without disabling zoom", () => {
    expect(source).toContain("height: 100dvh");
    expect(source).toContain("margin: 0; width: 100%");
    expect(source).toContain("min-width: 0; min-height: 0");
    expect(source).not.toMatch(/user-scalable=no|maximum-scale=1/);
  });
  it("renders the actual onboarding and bypasses saved-session redirects only in development web preview", () => {
    const landing = readFileSync(join(__dirname, "../app/index.tsx"), "utf8");
    expect(landing).toContain('const previewOnboarding = __DEV__ && Platform.OS === "web"');
    expect(landing).toContain('import OnboardingScreen from "./onboarding"');
    expect(landing).toContain("if (previewOnboarding) return <OnboardingScreen />;");
    expect(landing).toContain("if (previewOnboarding) return;");
    expect(landing.indexOf("if (previewOnboarding) return;"))
      .toBeLessThan(landing.indexOf("if (!shouldStartSignedInLandingRedirect("));
  });
  it("preserves the preview flag for navigation after Expo mounts", () => {
    expect(entryFor("?preview=onboarding")).toBe("/?preview=onboarding");
  });
  it("preserves the normal preview and existing query parameters", () => {
    expect(entryFor("")).toBe("/");
    expect(entryFor("?demo=sample")).toBe("/?demo=sample");
  });
  it("does not accept arbitrary route or external URL injection", () => {
    expect(entryFor("?preview=https://example.com")).toBe("/?preview=https://example.com");
  });
});
