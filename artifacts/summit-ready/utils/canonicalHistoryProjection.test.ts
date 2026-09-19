import { describe, expect, it } from "vitest";
import { buildPrivateHistoryDisplay } from "./canonicalHistoryProjection";

const shared = {
  id: "canonical-1",
  sourceId: "offline-1",
  title: "Shared GPS hike",
  occurredAt: "2026-09-20T10:00:00.000Z",
  matchedContexts: ["training", "expeditions", "mountains_free_hike"] as const,
  evidenceState: "recorded_unverified",
  lifecycle: "synced",
};

describe("private canonical history display", () => {
  it("shows one physical row in All and once in each selected context", () => {
    const input = {
      legacy: [
        { legacyKey: "linked", title: "Old copy", occurredAt: "2026-09-20T10:00:00.000Z", canonicalActivityId: "canonical-1" },
        { legacyKey: "old", title: "Legacy-only", occurredAt: "2026-09-18T10:00:00.000Z" },
      ],
      canonical: { status: "active" as const, items: [shared] },
    };
    expect(buildPrivateHistoryDisplay(input).items.filter((item) => item.kind === "canonical")).toHaveLength(1);
    expect(buildPrivateHistoryDisplay({ ...input, filter: "training" }).items.filter((item) => item.kind === "canonical")).toHaveLength(1);
    expect(buildPrivateHistoryDisplay(input).items.map((item) => item.title)).toEqual(["Shared GPS hike", "Legacy-only"]);
  });

  it("preserves all legacy history while shadowed or unavailable", () => {
    const legacy = [
      { legacyKey: "one", title: "Manual log", occurredAt: "2026-09-19T10:00:00.000Z" },
      { legacyKey: "two", title: "Old GPS", occurredAt: "2026-09-18T10:00:00.000Z" },
    ];
    const result = buildPrivateHistoryDisplay({
      legacy,
      canonical: { status: "shadowed", reason: "legacy_equivalence_not_proven", items: [] },
    });
    expect(result.status).toBe("legacy_fallback");
    expect(result.items.map((item) => item.legacyKey)).toEqual(["one", "two"]);
  });

  it("does not re-show a linked canonical row hidden by the selected context", () => {
    const result = buildPrivateHistoryDisplay({
      filter: "training",
      legacy: [
        { legacyKey: "linked-expedition", title: "Expedition copy", occurredAt: shared.occurredAt, canonicalActivityId: "expedition-only" },
        { legacyKey: "legacy-only", title: "Unlinked legacy", occurredAt: "2026-09-18T10:00:00.000Z" },
      ],
      canonical: {
        status: "active",
        items: [{
          ...shared,
          id: "expedition-only",
          matchedContexts: ["expeditions"],
        }],
      },
    });
    expect(result.items.map((item) => item.title)).toEqual(["Unlinked legacy"]);
  });

  it("does not fuzzy-match similar legacy entries", () => {
    const result = buildPrivateHistoryDisplay({
      legacy: [{ legacyKey: "similar", title: "Shared GPS hike", occurredAt: shared.occurredAt }],
      canonical: { status: "active", items: [shared] },
    });
    expect(result.items).toHaveLength(2);
  });
});