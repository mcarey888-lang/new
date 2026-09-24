/**
 * Onboarding / Pro — the rules, guarded.
 *
 * The flow is locked at SIX screens; the AI Coach's boundary is stated on the
 * screen rather than assumed; and no figure appears anywhere in a flow that
 * runs before the user has recorded anything.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BANK_NOTE, COACH_BOUNDARY, ONBOARDING_INTENTS, ONBOARDING_PATHS,
  ONBOARDING_STEPS, destinationFor, routeForIntent, shellForIntent, stepPosition,
} from "./onboardingSteps";

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("the flow is six screens", () => {
  it("has exactly six, in the approved order", () => {
    expect(ONBOARDING_STEPS).toHaveLength(6);
    expect(ONBOARDING_STEPS.map(s => s.id)).toEqual([
      "welcome", "paths", "bank", "coach", "intent", "ready",
    ]);
  });

  it("carries the approved headlines", () => {
    const headlines = ONBOARDING_STEPS.map(s => s.headline.replace(/\n/g, " "));
    expect(headlines).toEqual([
      "HIGHER EVERY DAY",
      "TWO WAYS TO GO HIGHER",
      "EVERY METRE COUNTS.",
      "YOUR AI MOUNTAIN COACH",
      "WHAT BRINGS YOU HERE?",
      "YOU'RE READY TO BEGIN",
    ]);
  });

  it("reports its own position from the list, so a seventh cannot hide", () => {
    expect(stepPosition("welcome")).toEqual({ index: 0, total: 6 });
    expect(stepPosition("ready")).toEqual({ index: 5, total: 6 });
  });

  it("is rendered from the list and nothing else", () => {
    const body = code(read("app/onboarding.tsx"));
    expect(body).toMatch(/ONBOARDING_STEPS\[index\]/);
    expect(body).toMatch(/ONBOARDING_STEPS\.length/);
    /* No step is hard-coded into the screen. */
    expect(body).not.toMatch(/step7|seventh|steps\.push/i);
  });
});

describe("no figures in a flow that runs before anything is recorded", () => {
  it("the step copy contains no numbers", () => {
    const copy = [
      ...ONBOARDING_STEPS.map(s => `${s.headline} ${s.lede ?? ""} ${s.cta ?? ""}`),
      ...ONBOARDING_PATHS.map(p => `${p.title} ${p.body}`),
      ...ONBOARDING_INTENTS.map(i => `${i.title} ${i.why} ${i.destination}`),
      BANK_NOTE, COACH_BOUNDARY,
    ].join(" ");
    expect(copy).not.toMatch(/\d/);
  });

  it("the Elevation Bank screen says yours starts at zero", () => {
    expect(BANK_NOTE).toMatch(/starts at zero/);
  });

  it("the screen renders no demonstration total", () => {
    const body = code(read("app/onboarding.tsx"));
    expect(body).not.toMatch(/lifetimeAscent|BANK_DEMO|monthly|yearOnYear/);
    expect(body).not.toMatch(/Mont Blanc|Kilimanjaro|Everest|Helvellyn/);
  });
});

describe("the AI Coach boundary is on the screen", () => {
  it("says the engines calculate and the coach explains", () => {
    expect(COACH_BOUNDARY).toMatch(/engines calculate/i);
    expect(COACH_BOUNDARY).toMatch(/never invents/i);
    expect(COACH_BOUNDARY).toMatch(/readiness/i);
    expect(COACH_BOUNDARY).toMatch(/rank/i);
    expect(COACH_BOUNDARY).toMatch(/route fact/i);
  });

  it("uses the existing mascot asset rather than new artwork", () => {
    const body = code(read("app/onboarding.tsx"));
    expect(body).toMatch(/require\("@\/assets\/mascot\.webp"\)/);
    /* Nothing is drawn to stand in for the mascot. */
    expect(body).not.toMatch(/<Svg|<Path |<Circle /);
  });
});

describe("intent decides where you land, and nothing else", () => {
  it("maps to a real shell and a real route", () => {
    expect(shellForIntent("expedition")).toBe("expedition");
    expect(shellForIntent("training")).toBe("training");
    expect(shellForIntent("explore")).toBe("training");
    expect(shellForIntent(null)).toBe("training");

    expect(routeForIntent("expedition")).toBe("/(expedition)/mountains");
    expect(routeForIntent("explore")).toBe("/(tabs)/explore");
    expect(routeForIntent("training")).toBe("/(tabs)/dashboard");
    expect(routeForIntent(null)).toBe("/(tabs)/dashboard");
  });

  it("names the destination it will open", () => {
    expect(destinationFor("expedition")?.destination).toBe("Expeditions");
    expect(destinationFor(null)).toBeNull();
    expect(destinationFor("nonsense")).toBeNull();
  });

  it("grants no entitlement and touches no billing", () => {
    const body = code(read("app/onboarding.tsx"));
    expect(body).not.toMatch(/purchase|revenuecat|entitlement|subscription|offerings/i);
  });
});

describe("the subscription architecture is untouched", () => {
  const paywall = code(read("app/paywall.tsx"));

  it("still buys and restores through the existing hook", () => {
    expect(paywall).toMatch(/useSubscription\(\)/);
    expect(paywall).toMatch(/await purchase\(selectedPkg\)/);
    expect(paywall).toMatch(/await restore\(\)/);
    expect(paywall).toMatch(/offerings\?\.current/);
  });

  it("still states the store's renewal and cancellation terms", () => {
    const raw = read("app/paywall.tsx");
    expect(raw).toMatch(/Google Play account/);
    expect(raw).toMatch(/Apple ID account/);
    expect(raw).toMatch(/automatically renews unless cancelled/);
  });

  it("prices come from the store, never from the source", () => {
    expect(paywall).toMatch(/priceString/);
    /* No hard-coded currency amount anywhere in the screen. */
    expect(paywall).not.toMatch(/[£$€]\s?\d/);
  });

  it("draws on the shared tokens", () => {
    expect(paywall).toMatch(/from "@\/constants\/tokens"/);
  });
});

describe("the landing screen opens the flow", () => {
  it("Get started goes to onboarding, Sign in still goes to auth", () => {
    const body = code(read("app/index.tsx"));
    expect(body).toMatch(/router\.push\("\/onboarding" as any\)/);
    expect(body).toMatch(/\(auth\)\/sign-in/);
  });

  it("the route is registered", () => {
    expect(code(read("app/_layout.tsx"))).toMatch(/Stack\.Screen name="onboarding"/);
  });
});
