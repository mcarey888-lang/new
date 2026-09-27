import { describe, expect, it, vi } from "vitest";
import type { SummitGoal, TrainingWeek } from "@/context/AppContext";
import { restoreTrainingPlan } from "./trainingPlanRestore";

const trainingGoal: SummitGoal = {
  mountainName: "Mont Blanc",
  summitDate: "2027-01-10",
  distance: 16,
  elevationGain: 1700,
  highestAltitude: 4809,
  difficulty: "Alpine",
  fitnessLevel: "Average",
  location: "Chamonix",
  maxRadius: 30,
  equipment: ["none"],
  trainingDaysPerWeek: 4,
  hillDaysPerWeek: 2,
};

describe("restoring the Training plan", () => {
  it("regenerates weeks when a saved Training goal has an empty plan", () => {
    const generated = [{ weekNumber: 1, sessions: [{ label: "First session" }] }] as TrainingWeek[];
    const generate = vi.fn(() => generated);
    expect(restoreTrainingPlan([], trainingGoal, generate)).toBe(generated);
    expect(generate).toHaveBeenCalledWith(trainingGoal);
  });

  it("preserves an existing plan, including its edits", () => {
    const edited = [{ weekNumber: 1, sessions: [{ label: "My edited session" }] }] as TrainingWeek[];
    const generate = vi.fn(() => [] as TrainingWeek[]);
    expect(restoreTrainingPlan(edited, trainingGoal, generate)).toBe(edited);
    expect(generate).not.toHaveBeenCalled();
  });

  it("does not generate an Expedition plan when no Training goal exists", () => {
    const generate = vi.fn(() => [] as TrainingWeek[]);
    expect(restoreTrainingPlan([], null, generate)).toEqual([]);
    expect(generate).not.toHaveBeenCalled();
  });
});