import type { EvidenceReference } from "./challengeDomain";

export type ElevationBankEventLike = {
  activityId: string;
  sourceId: string;
  sourceType: string;
  revision: number;
  status: "credited" | "corrected" | "revoked";
  creditedAscentM: number;
  evidenceClass: string;
  ruleVersion: string;
  effectiveAt: string;
  eventAt: string;
};

export function mapElevationBankEventToEvidence(
  event: ElevationBankEventLike,
  ownerUserId: string,
): EvidenceReference | null {
  const classes: Record<string, EvidenceReference["evidenceClass"] | undefined> = {
    quality_accepted: "trusted_gps_outdoor",
    verified_activity: "trusted_gps_outdoor",
    recorded_unverified: "recorded_unverified",
    unverified_manual: "manual_outdoor",
    manual: "manual_outdoor",
    indoor: "indoor",
  };
  const evidenceClass = classes[event.evidenceClass];
  const eventEpoch = Date.parse(event.eventAt);
  if (!evidenceClass || !event.activityId || !event.sourceId || !ownerUserId ||
      !Number.isSafeInteger(eventEpoch)) return null;
  return {
    evidenceId: `elevation-bank:${event.activityId}`,
    lineageId: `elevation-bank:${event.activityId}`,
    ownerUserId,
    sourceType: "canonical_activity",
    sourceId: event.sourceId,
    activityId: event.activityId,
    evidenceClass,
    occurredAt: event.effectiveAt,
    qualificationStatus: event.status === "revoked"
      ? "revoked"
      : evidenceClass === "trusted_gps_outdoor" ? "eligible" : "pending",
    qualificationPurpose: "eligible_real_elevation",
    qualificationRuleVersion: event.ruleVersion,
    value: event.creditedAscentM,
    correctionVersion: eventEpoch,
    sourceCursor: `${event.eventAt}|${String(event.revision).padStart(12, "0")}|${event.ruleVersion}`,
  };
}