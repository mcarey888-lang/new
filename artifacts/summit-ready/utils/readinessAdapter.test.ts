import { describe, it, expect } from "vitest";
import { createReadinessInput } from "./readinessAdapter";
import { SummitGoal, Session, ExploreHike, TrainingWeek } from "@/context/AppContext";

describe("readinessAdapter", () => {
  it("should map summit goal to readiness target", () => {
    const goal: SummitGoal = {
      mountainName: "Matterhorn",
      summitDate: "2024-08-01",
      distance: 12,
      elevationGain: 1200,
      highestAltitude: 4478,
      difficulty: "Hard",
      fitnessLevel: "Average",
      location: "Zermatt",
      maxRadius: 50,
      equipment: ["none"],
      trainingDaysPerWeek: 4,
      hillDaysPerWeek: 2,
    };

    const input = createReadinessInput("user_123", "2024-01-01T00:00:00Z", goal, [], [], []);
    
    expect(input.ownerId).toBe("user_123");
    expect(input.target.distanceKm).toBe(12);
    expect(input.target.ascentM).toBe(1200);
    expect(input.target.summitDate).toBe("2024-08-01");
  });

  it("should map sessions and explore hikes to evidence", () => {
    const goal: SummitGoal = {
      mountainName: "Matterhorn",
      summitDate: "2024-08-01",
      distance: 12,
      elevationGain: 1200,
      highestAltitude: 4478,
      difficulty: "Hard",
      fitnessLevel: "Average",
      location: "Zermatt",
      maxRadius: 50,
      equipment: ["none"],
      trainingDaysPerWeek: 4,
      hillDaysPerWeek: 2,
    };

    const sessions: Session[] = [
      {
        id: "sess_1",
        date: "2024-01-01T10:00:00Z",
        type: "cardio",
        distance: 5,
        elevationGain: 100,
        duration: 30,
        effort: 3,
        notes: "",
        completed: true,
        weekNumber: 1,
      },
      {
        id: "sess_2",
        date: "2024-01-02T10:00:00Z",
        type: "cardio",
        gymSubtype: "treadmill",
        distance: 5,
        elevationGain: 200,
        duration: 40,
        effort: 3,
        notes: "",
        completed: true,
        weekNumber: 1,
      },
      {
        id: "sess_3",
        date: "2024-01-03T10:00:00Z",
        type: "cardio",
        distance: 5,
        elevationGain: 200,
        duration: 40,
        effort: 3,
        notes: "",
        completed: false, // Should be ignored
        weekNumber: 1,
      }
    ];

    const exploreHikes: ExploreHike[] = [
      {
        id: "hike_1",
        name: "Test Hike",
        date: "2024-01-05T10:00:00Z",
        distance: 10,
        elevationGain: 500,
        timeTaken: 120,
        notes: "",
      }
    ];

    const input = createReadinessInput("user_123", "2024-01-10T00:00:00Z", goal, sessions, exploreHikes, []);

    expect(input.evidence.length).toBe(3); // 2 sessions + 1 hike
    
    const sess1 = input.evidence.find(e => e.evidenceId === "sess_1")!;
    expect(sess1.source).toBe("manual");
    expect(sess1.distanceKm).toBe(5);

    const sess2 = input.evidence.find(e => e.evidenceId === "sess_2")!;
    expect(sess2.source).toBe("indoor");

    const hike1 = input.evidence.find(e => e.evidenceId === "hike_1")!;
    expect(hike1.source).toBe("tracked_gps");
    expect(hike1.distanceKm).toBe(10);
    expect(hike1.ascentM).toBe(500);
  });
});
