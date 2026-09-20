import { describe, expect, it } from "vitest";
import type { EvidenceReference } from "./challengeDomain";
import { compareCodeUnits, compareEvidenceAuthority, selectAuthoritativeEvidence } from "./evidenceAuthority";

const evidence = (overrides: Partial<EvidenceReference> = {}): EvidenceReference => ({
  evidenceId: "e", lineageId: "lineage", ownerUserId: "owner", sourceType: "canonical_activity",
  sourceId: "source", evidenceClass: "trusted_gps_outdoor", occurredAt: "2026-01-01T00:00:00Z",
  qualificationStatus: "eligible", correctionVersion: 1, sourceCursor: "2026-01-01T00:00:00Z",
  ...overrides,
});

function reduce(order: EvidenceReference[]): EvidenceReference {
  return order.reduce<EvidenceReference | undefined>(
    (prior, item) => selectAuthoritativeEvidence(prior, item),
    undefined,
  )!;
}

describe("evidence authority", () => {
  it("uses normative correction, cursor, revoked, then canonical fallback order", () => {
    expect(reduce([evidence({ correctionVersion: 2, sourceCursor: "z" }), evidence({ correctionVersion: 3, sourceCursor: "a" })]).correctionVersion).toBe(3);
    expect(reduce([evidence({ sourceCursor: "a" }), evidence({ sourceCursor: "b" })]).sourceCursor).toBe("b");
    expect(reduce([evidence(), evidence({ qualificationStatus: "revoked" })]).qualificationStatus).toBe("revoked");
    const a = evidence({ evidenceId: "a", sourceCursor: "" });
    const b = evidence({ evidenceId: "b", sourceCursor: "" });
    expect(reduce([a, b].reverse()).evidenceId).toBe(reduce([a, b]).evidenceId);
  });

  it("is order-independent across replay/restart and exact retries", () => {
    const low = evidence({ correctionVersion: 1, sourceCursor: "z" });
    const high = evidence({ correctionVersion: 2, sourceCursor: "a" });
    const revoked = evidence({ correctionVersion: 2, sourceCursor: "a", qualificationStatus: "revoked" });
    expect(reduce([low, high])).toEqual(reduce([high, low]));
    expect(reduce([high, revoked])).toEqual(reduce([revoked, high]));
    expect(compareEvidenceAuthority(high, high)).toBe(0);
    expect(reduce([high, high])).toEqual(high);
  });

  it("orders precomposed and decomposed UTF-16 strings independently of arrival order", () => {
    const precomposed = evidence({ evidenceId: "é", sourceCursor: "" });
    const decomposed = evidence({ evidenceId: "e\u0301", sourceCursor: "" });
    expect(compareCodeUnits("é", "e\u0301")).not.toBe(0);
    expect(reduce([precomposed, decomposed]).evidenceId)
      .toBe(reduce([decomposed, precomposed]).evidenceId);
  });
});