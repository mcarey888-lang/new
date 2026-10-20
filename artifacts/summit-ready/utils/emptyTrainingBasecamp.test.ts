import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { openExpeditionExplore } from "./openExpeditionExplore";

const read = (file: string) => readFileSync(join(__dirname, "..", file), "utf8");
const screen = read("app/(tabs)/dashboard.tsx");
const empty = read("components/basecamp/BasecampNoGoal.tsx");

describe("Training Basecamp without a goal", () => {
  it("uses the new screen only in the no-goal branch", () => {
    expect(screen).toContain("if (!summitGoal) return <BasecampNoGoal />;");
    const emptyReturn = screen.indexOf("return <BasecampNoGoal />");
    expect(screen.slice(emptyReturn)).toMatch(
      /return <BasecampNoGoal \/>;\s+const currentWeek = getCurrentWeek\(trainingPlan\);/,
    );
  });

  it("keeps goal setup and removes the three legacy actions and fake progress", () => {
    expect(empty).toContain('router.push("/questionnaire")');
    expect(empty).not.toMatch(/Start Hiking|Find Hills|Challenges|\(tabs\)\/hills|\(tabs\)\/challenges|fakeWeek/);
    expect(empty).toContain("Training plan");
    expect(empty).toContain("Readiness");
    expect(empty).toContain("Coach");
  });

  it("has one accessible Explore action with loading, retry and explicit mode-switch messaging", () => {
    expect(empty.match(/testID="no-goal-explore"/g)).toHaveLength(1);
    expect(empty).toContain('router.replace("/(expedition)/mountains")');
    expect(empty).toContain("if (busy.current) return;");
    expect(empty).toContain('accessibilityState={{ disabled: switching, busy: switching }}');
    expect(empty).toContain('accessibilityRole="alert"');
    expect(empty).toContain("Browse mountains in Expedition mode");
    expect(empty).not.toMatch(/setSummitGoal|clearPlan|startExpedition|fetch\(/);
  });

  it("awaits shell persistence before navigating to Explore", async () => {
    let release!: () => void;
    const swap = vi.fn(() => new Promise<void>(resolve => { release = resolve; }));
    const navigate = vi.fn();
    const opening = openExpeditionExplore(swap, navigate);
    expect(swap).toHaveBeenCalledExactlyOnceWith("expedition");
    expect(navigate).not.toHaveBeenCalled();
    release();
    await opening;
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("does not navigate if changing shells fails", async () => {
    const navigate = vi.fn();
    await expect(openExpeditionExplore(
      async () => { throw new Error("Storage unavailable"); }, navigate,
    )).rejects.toThrow("Storage unavailable");
    expect(navigate).not.toHaveBeenCalled();
  });
});
