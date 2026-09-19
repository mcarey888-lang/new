import { describe, it, expect } from "vitest";
import { createReadinessInput } from "./readinessAdapter";
import { evaluateReadiness } from "./readinessV2";
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

  it("preserves one physical activity identity across a tracked session and hike retry", () => {
    const goal: SummitGoal = {
      mountainName: "Test Mountain",
      summitDate: "2025-08-01",
      distance: 12,
      elevationGain: 1200,
      highestAltitude: 2000,
      difficulty: "Hard",
      fitnessLevel: "Average",
      location: "Test",
      maxRadius: 50,
      equipment: ["none"],
      trainingDaysPerWeek: 4,
      hillDaysPerWeek: 2,
    };
    const session: Session = {
      id: "session-copy",
      activityId: "physical-activity-1",
      date: "2025-01-02T10:00:00Z",
      type: "cardio",
      distance: 8,
      elevationGain: 400,
      duration: 90,
      effort: 3,
      notes: "",
      completed: true,
      weekNumber: 1,
    };
    const hike: ExploreHike = {
      id: "hike-copy",
      activityId: "physical-activity-1",
      name: "Tracked copy",
      date: "2025-01-02T10:00:00Z",
      distance: 8,
      elevationGain: 400,
      timeTaken: 90,
      notes: "",
      syncState: "queued",
    };

    const input = createReadinessInput(
      "owner-1",
      "2025-01-03T00:00:00Z",
      goal,
      [session],
      [hike],
      [],
    );

    expect(input.evidence).toHaveLength(2);
    expect(input.evidence.every(item => item.canonicalActivityId === "physical-activity-1")).toBe(true);
    expect(input.evidence.find(item => item.source === "canonical_gps")?.gpsQuality).toBe("trusted");
    expect(input.evidence.find(item => item.source === "tracked_gps")?.syncState).toBe("queued");
    const result = evaluateReadiness(input);
    expect(result.includedEvidenceIds).toEqual(["session-copy"]);
    expect(result.excludedEvidence).toContainEqual({
      evidenceId: "hike-copy",
      reason: "duplicate_activity_evidence",
    });
  });

  it("includes locally saved GPS evidence immediately and excludes unfinished plan sessions", () => {
    const goal: SummitGoal = {
      mountainName: "Test Mountain",
      summitDate: "2025-08-01",
      distance: 12,
      elevationGain: 1200,
      highestAltitude: 2000,
      difficulty: "Moderate",
      fitnessLevel: "Average",
      location: "Test",
      maxRadius: 50,
      equipment: ["none"],
      trainingDaysPerWeek: 4,
      hillDaysPerWeek: 2,
    };
    const input = createReadinessInput(
      "owner-1",
      "2025-01-03T00:00:00Z",
      goal,
      [{
        id: "unfinished",
        date: "2025-01-02T10:00:00Z",
        type: "cardio",
        distance: 5,
        elevationGain: 100,
        duration: 45,
        effort: 2,
        notes: "",
        completed: false,
        weekNumber: 1,
      }],
      [{
        id: "local-hike",
        activityId: "local-physical-1",
        name: "Offline Hike",
        date: "2025-01-02T10:00:00Z",
        distance: 7,
        elevationGain: 300,
        timeTaken: 75,
        notes: "",
        syncState: "local_only",
      }],
      [],
    );

    expect(input.evidence).toHaveLength(1);
    expect(input.evidence[0]).toMatchObject({
      evidenceId: "local-hike",
      canonicalActivityId: "local-physical-1",
      syncState: "local_only",
    });
  });
});
