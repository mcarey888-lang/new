import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getAuth } from "@clerk/express";
import {
  createElevationBankHandler,
  serializeElevationBankResponse,
  type ElevationBankRouteDependencies,
} from "../routes/elevation-bank";
import type { ElevationBankCreditRow } from "../routes/elevation-bank";

vi.mock("@clerk/express", () => ({ getAuth: vi.fn() }));

function credit(
  ownerUserId: string,
  activityId: string,
  status: "credited" | "corrected" = "credited",
): ElevationBankCreditRow {
  return {
    id: `${ownerUserId}-${activityId}`,
    ownerUserId,
    activityId,
    sourceId: `source-${activityId}`,
    sourceType: "explore_hike",
    revision: status === "corrected" ? 2 : 1,
    status,
    creditedAscentM: status === "corrected" ? 640 : 700,
    evidenceClass: "quality_accepted",
    ruleVersion: "elevation-bank-v1",
    correctionOfRevision: status === "corrected" ? 1 : null,
    reasonCodes: [],
    effectiveAt: new Date("2026-09-20T10:00:00Z"),
    createdAt: new Date("2026-09-20T10:00:00Z"),
  };
}

describe("Elevation Bank API response contract", () => {
  it("serializes only the owner's effective summary/recent rows", () => {
    const response = serializeElevationBankResponse(
      {
        lifetimeAscentM: 640,
        periodAscentM: 640,
        creditedActivities: 1,
        everestEquivalent: 0.1,
      },
      [credit("owner-a", "activity-a", "corrected")],
    );

    expect(response).toEqual({
      status: "available",
      lifetimeAscentM: 640,
      periodAscentM: 640,
      creditedActivities: 1,
      everestEquivalent: 0.1,
      recentCredits: [{
        activityId: "activity-a",
        sourceId: "source-activity-a",
        sourceType: "explore_hike",
        revision: 2,
        status: "corrected",
        creditedAscentM: 640,
        evidenceClass: "quality_accepted",
        ruleVersion: "elevation-bank-v1",
        effectiveAt: "2026-09-20T10:00:00.000Z",
      }],
    });
    expect(response.recentCredits).not.toContainEqual(
      expect.objectContaining({ activityId: "activity-other" }),
    );
  });

  it("preserves empty totals without inventing legacy values", () => {
    const response = serializeElevationBankResponse(
      {
        lifetimeAscentM: 0,
        periodAscentM: 0,
        creditedActivities: 0,
        everestEquivalent: 0,
      },
      [],
    );
    expect(response.lifetimeAscentM).toBe(0);
    expect(response.recentCredits).toEqual([]);
  });
});

describe("GET /elevation-bank handler boundary", () => {
  const summary = {
    lifetimeAscentM: 640,
    periodAscentM: 640,
    creditedActivities: 1,
    everestEquivalent: 0.1,
  };
  let dependencies: ElevationBankRouteDependencies;
  let summaryRead: ReturnType<typeof vi.fn>;
  let recentRead: ReturnType<typeof vi.fn>;
  let assertAvailable: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    summaryRead = vi.fn().mockResolvedValue(summary);
    recentRead = vi.fn().mockResolvedValue([]);
    assertAvailable = vi.fn();
    dependencies = {
      assertAvailable,
      getSummary: summaryRead,
      getRecent: recentRead,
    };
    vi.mocked(getAuth).mockReturnValue({ userId: "clerk-owner-a" } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function invoke(handler: ReturnType<typeof createElevationBankHandler>, request: Record<string, unknown>) {
    let statusCode = 200;
    let payload: unknown;
    const response = {
      status(code: number) {
        statusCode = code;
        return response;
      },
      json(value: unknown) {
        payload = value;
        return response;
      },
    };
    return Promise.resolve(handler(
      {
        log: { error: vi.fn() },
        ...request,
      } as never,
      response as never,
      vi.fn(),
    )).then(() => ({ statusCode, payload }));
  }

  it("requires Clerk authentication before reading either ledger view", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: null } as never);
    const result = await invoke(createElevationBankHandler(dependencies), {});

    expect(result.statusCode).toBe(401);
    expect(summaryRead).not.toHaveBeenCalled();
    expect(recentRead).not.toHaveBeenCalled();
  });

  it("uses Clerk user ID for both reads and ignores query/body owner IDs", async () => {
    const result = await invoke(createElevationBankHandler(dependencies), {
      query: { ownerUserId: "attacker" },
      body: { ownerUserId: "attacker" },
    });

    expect(result.statusCode).toBe(200);
    expect(summaryRead).toHaveBeenCalledWith(
      "clerk-owner-a",
      expect.objectContaining({ from: expect.any(Date) }),
    );
    expect(recentRead).toHaveBeenCalledWith("clerk-owner-a", 12);
    expect(result.payload).toMatchObject({
      status: "available",
      lifetimeAscentM: 640,
    });
  });

  it("returns canonical source identity without exposing owner identity", async () => {
    recentRead.mockResolvedValue([
      credit("clerk-owner-a", "canonical-activity-a"),
    ]);
    const result = await invoke(createElevationBankHandler(dependencies), {});

    expect(result.payload).toMatchObject({
      recentCredits: [{
        activityId: "canonical-activity-a",
        sourceId: "source-canonical-activity-a",
        sourceType: "explore_hike",
      }],
    });
    expect(JSON.stringify(result.payload)).not.toContain("clerk-owner-a");
  });

  it("returns a stable unavailable response when the development gate is closed", async () => {
    assertAvailable.mockImplementation(() => {
      throw new Error("Stage 2 ledger schema availability gate is disabled");
    });
    const result = await invoke(createElevationBankHandler(dependencies), {});

    expect(result.statusCode).toBe(503);
    expect(result.payload).toEqual({
      status: "unavailable",
      reason: "development_dependency_unavailable",
    });
    expect(summaryRead).not.toHaveBeenCalled();
    expect(recentRead).not.toHaveBeenCalled();
  });

  it("returns load_failed without leaking database details", async () => {
    summaryRead.mockRejectedValue(new Error("connection details should not escape"));
    const result = await invoke(createElevationBankHandler(dependencies), {});

    expect(result.statusCode).toBe(500);
    expect(result.payload).toEqual({
      status: "unavailable",
      reason: "load_failed",
    });
  });
});