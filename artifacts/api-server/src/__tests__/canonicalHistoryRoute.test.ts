import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "@clerk/express";
import {
  canonicalHistoryProjectionEnabled,
  createCanonicalHistoryHandler,
  serializeCanonicalHistoryResponse,
  type CanonicalActivityLinkRow,
  type CanonicalActivityRow,
  type CanonicalHistoryRouteDependencies,
} from "../routes/canonical-history";

vi.mock("@clerk/express", () => ({ getAuth: vi.fn() }));

function activity(
  id: string,
  ownerUserId: string,
  lifecycle: string = "synced",
): CanonicalActivityRow {
  return {
    id,
    ownerUserId,
    sourceType: "tracked_hill_session",
    sourceId: `source-${id}`,
    sourceVersion: null,
    sourcePayloadHash: "hash",
    sourceSnapshot: {},
    primaryContext: "free_hike",
    activityKind: "outdoor_hike",
    occurredAt: new Date("2026-09-20T10:00:00Z"),
    startedAt: null,
    endedAt: null,
    durationSeconds: 100,
    distanceKm: 4,
    recordedAscentM: 200,
    validatedAscentM: null,
    descentM: null,
    lifecycle,
    evidenceState: "recorded_unverified",
    visibility: "private",
    createdAt: new Date("2026-09-20T10:00:00Z"),
    updatedAt: new Date("2026-09-20T10:00:00Z"),
  };
}

describe("canonical history read boundary", () => {
  const previousNode = process.env.NODE_ENV;
  const previousFlag = process.env.CANONICAL_HISTORY_PROJECTION_ENABLED;
  let readActivities: ReturnType<typeof vi.fn>;
  let readLinks: ReturnType<typeof vi.fn>;
  let dependencies: CanonicalHistoryRouteDependencies;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.CANONICAL_HISTORY_PROJECTION_ENABLED = "true";
    readActivities = vi.fn().mockResolvedValue([activity("active", "clerk-owner-a")]);
    readLinks = vi.fn().mockResolvedValue([] as CanonicalActivityLinkRow[]);
    dependencies = { readActivities, readLinks };
    vi.mocked(getAuth).mockReturnValue({ userId: "clerk-owner-a" } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (previousNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNode;
    if (previousFlag === undefined) delete process.env.CANONICAL_HISTORY_PROJECTION_ENABLED;
    else process.env.CANONICAL_HISTORY_PROJECTION_ENABLED = previousFlag;
  });

  function invoke(
    handler: ReturnType<typeof createCanonicalHistoryHandler>,
    request: Record<string, unknown> = {},
  ) {
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
    return Promise.resolve(handler({
      log: { error: vi.fn() },
      query: {},
      ...request,
    } as never, response as never, vi.fn())).then(() => ({ statusCode, payload }));
  }

  it("is disabled outside test/development even when the flag is set", () => {
    process.env.NODE_ENV = "production";
    expect(canonicalHistoryProjectionEnabled()).toBe(false);
    process.env.NODE_ENV = "test";
    expect(canonicalHistoryProjectionEnabled()).toBe(true);
  });

  it("requires Clerk authentication before either canonical read", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: null } as never);
    const result = await invoke(createCanonicalHistoryHandler(dependencies));
    expect(result.statusCode).toBe(401);
    expect(readActivities).not.toHaveBeenCalled();
    expect(readLinks).not.toHaveBeenCalled();
  });

  it("rejects an invalid filter before either canonical read", async () => {
    const result = await invoke(createCanonicalHistoryHandler(dependencies), {
      query: { filter: "not-a-filter" },
    });
    expect(result.statusCode).toBe(400);
    expect(readActivities).not.toHaveBeenCalled();
    expect(readLinks).not.toHaveBeenCalled();
  });

  it("returns shadowed without reading the database when disabled", async () => {
    process.env.CANONICAL_HISTORY_PROJECTION_ENABLED = "false";
    const result = await invoke(createCanonicalHistoryHandler(dependencies));
    expect(result.statusCode).toBe(200);
    expect(result.payload).toEqual({
      status: "shadowed",
      reason: "legacy_equivalence_not_proven",
      items: [],
    });
    expect(readActivities).not.toHaveBeenCalled();
    expect(readLinks).not.toHaveBeenCalled();
  });

  it("passes Clerk userId to both reads and ignores owner spoofing", async () => {
    const result = await invoke(createCanonicalHistoryHandler(dependencies), {
      query: { ownerUserId: "attacker", filter: "all" },
      body: { ownerUserId: "attacker" },
    });
    expect(result.statusCode).toBe(200);
    expect(readActivities).toHaveBeenCalledWith("clerk-owner-a");
    expect(readLinks).toHaveBeenCalledWith("clerk-owner-a", ["active"]);
    expect(JSON.stringify(result.payload)).not.toContain("clerk-owner-a");
  });

  it("excludes deleted rows and never serializes ownerUserId", async () => {
    readActivities.mockResolvedValue([
      activity("active", "clerk-owner-a"),
      activity("deleted", "clerk-owner-a", "deleted"),
      activity("other-owner", "attacker"),
    ]);
    const result = await invoke(createCanonicalHistoryHandler(dependencies));
    expect(result.payload).toMatchObject({
      status: "active",
      items: [{ id: "active" }],
    });
    expect((result.payload as { items: unknown[] }).items).toHaveLength(1);
    expect(JSON.stringify(result.payload)).not.toContain("ownerUserId");
    expect(JSON.stringify(result.payload)).not.toContain("attacker");
  });

  it("returns 503 when a canonical dependency fails", async () => {
    readActivities.mockRejectedValue(new Error("database details"));
    const result = await invoke(createCanonicalHistoryHandler(dependencies));
    expect(result.statusCode).toBe(503);
    expect(result.payload).toEqual({
      status: "unavailable",
      reason: "canonical_dependency_unavailable",
      items: [],
    });
  });

  it("serializes shadowed responses without owner identifiers", () => {
    const response = serializeCanonicalHistoryResponse("shadowed", []);
    expect(response).toEqual({
      status: "shadowed",
      reason: "legacy_equivalence_not_proven",
      items: [],
    });
    expect(response).not.toHaveProperty("ownerUserId");
  });
});