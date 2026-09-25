import { describe, expect, it } from "vitest";
import { isRequirementMet } from "./readinessScore";
import type { AlpineRequirement, Session } from "@/context/AppContext";

const session = (weekNumber: number, elevationGain = 350): Session => ({
  id: String(weekNumber),
  date: "2026-09-01",
  type: "hill",
  distance: 6,
  elevationGain,
  duration: 120,
  effort: 3,
  notes: "",
  completed: true,
  weekNumber,
});

const requirement = (
  category: AlpineRequirement["category"],
  benchmark?: AlpineRequirement["benchmark"],
  benchmarkValue?: number,
): AlpineRequirement => ({
  id: category,
  category,
  label: category,
  detail: "Preparation guidance",
  benchmark,
  benchmarkValue,
});

describe("Alpine requirements", () => {
  it("does not mistake workouts for technical experience", () => {
    const technical = requirement("technical", "sessions_count", 1);
    expect(isRequirementMet(technical, [session(1)], 12)).toBe(false);
    expect(isRequirementMet(technical, [session(1)], 12, {
      technical: { status: "planned", source: "guided-trip", note: "Booked ice axe training" },
    })).toBe(false);
    expect(isRequirementMet(technical, [], 0, {
      technical: { status: "completed", source: "prior-experience", note: "Used crampons with a guide" },
    })).toBe(true);
  });

  it("does not count future acclimatisation as completed", () => {
    const altitude = requirement("altitude");
    expect(isRequirementMet(altitude, [], 0, {
      altitude: { status: "planned", source: "guided-trip", note: "Acclimatisation days booked" },
    })).toBe(false);
    expect(isRequirementMet(altitude, [], 0, {
      altitude: { status: "completed", source: "guided-trip", note: "Acclimatisation days completed" },
    })).toBe(true);
  });

  it("counts logged training targets, but not empty elapsed weeks", () => {
    expect(isRequirementMet(requirement("endurance", "sessions_count", 2), [session(1)], 2)).toBe(false);
    expect(isRequirementMet(requirement("endurance", "sessions_count", 2), [session(1), session(2)], 2)).toBe(true);
    const weeks = requirement("recovery", "weeks_training", 2);
    expect(isRequirementMet(weeks, [], 2)).toBe(false);
    expect(isRequirementMet(weeks, [session(1), session(2)], 2)).toBe(true);
    expect(isRequirementMet(weeks, [session(1)], 2)).toBe(false);
  });
});