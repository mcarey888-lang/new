import type { EvidenceReference } from "./challengeDomain";

export function compareCodeUnits(a: string, b: string): number {
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = a.charCodeAt(index) - b.charCodeAt(index);
    if (difference) return difference;
  }
  return a.length - b.length;
}

export function canonicalEvidenceSerialization(value: EvidenceReference): string {
  return JSON.stringify(Object.keys(value).sort().map((key) => [
    key,
    value[key as keyof EvidenceReference],
  ]));
}

/** Positive means a is the authoritative successor; zero means identical authority. */
export function compareEvidenceAuthority(a: EvidenceReference, b: EvidenceReference): number {
  const correction = (a.correctionVersion ?? 0) - (b.correctionVersion ?? 0);
  if (correction) return correction;
  const cursor = compareCodeUnits(a.sourceCursor ?? "", b.sourceCursor ?? "");
  if (cursor) return cursor;
  const revoked = Number(a.qualificationStatus === "revoked") - Number(b.qualificationStatus === "revoked");
  if (revoked) return revoked;
  return compareCodeUnits(canonicalEvidenceSerialization(a), canonicalEvidenceSerialization(b));
}

export function selectAuthoritativeEvidence(
  prior: EvidenceReference | undefined,
  incoming: EvidenceReference,
): EvidenceReference {
  return prior && compareEvidenceAuthority(incoming, prior) < 0 ? prior : incoming;
}