import {
  CHALLENGE_DOMAIN_VERSION,
  type AchievementDefinition,
  type AchievementEvaluationResult,
  type ChallengeDefinition,
  type ChallengeEvaluationResult,
  type ChallengeWindowSpec,
  type ResolvedChallengeWindow,
  type EvidenceReference,
  type EvaluationReason,
} from "./challengeDomain";
import { compareEvidenceAuthority } from "./evidenceAuthority";

const sortedEvidence = (evidence: readonly EvidenceReference[]): EvidenceReference[] =>
  [...evidence].sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));

export const evidenceLineageId = (evidence: EvidenceReference): string =>
  evidence.lineageId ?? evidence.evidenceId;

const latestEvidenceByLineage = (evidence: readonly EvidenceReference[]): EvidenceReference[] => {
  const latest = new Map<string, EvidenceReference>();
  for (const item of evidence) {
    const key = evidenceLineageId(item);
    const current = latest.get(key);
    if (!current || compareEvidenceAuthority(item, current) >= 0) {
      latest.set(key, item);
    }
  }
  return sortedEvidence([...latest.values()]);
};

const parseDate = (value: string): number | null => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function resolveExplicitWindow(
  spec: ChallengeWindowSpec,
  windowKey: string,
): { windowKey: string; startInclusive: number | null; endExclusive: number | null } {
  return {
    windowKey,
    startInclusive: spec.startInclusive ? parseDate(spec.startInclusive) : null,
    endExclusive: spec.endExclusive ? parseDate(spec.endExclusive) : null,
  };
}

export function resolveCalendarMonth(year: number, month: number, timezone: string): ResolvedChallengeWindow {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Calendar month requires an explicit year and month");
  }
  const key = `${year}-${String(month).padStart(2, "0")}`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const next = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  const zonedMidnight = (y: number, m: number) => earliestLocalDateInstant(y, m, 1, timezone);
  return { windowKey: key, startInclusive: zonedMidnight(year, month), endExclusive: zonedMidnight(nextYear, nextMonth), timezone };
}

export function earliestLocalDateInstant(
  year: number,
  month: number,
  day: number,
  timezone: string,
): string {
  const target = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const dateKey = (instant: number) => {
    const parts = dateFormatter.formatToParts(new Date(instant));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };
  let low = Date.UTC(year, month - 1, day) - 36 * 60 * 60 * 1000;
  let high = Date.UTC(year, month - 1, day) + 36 * 60 * 60 * 1000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (dateKey(middle) >= target) high = middle;
    else low = middle + 1;
  }
  return new Date(low).toISOString();
}

export function resolveCalendarMonthForInstant(
  instant: string,
  timezone: string,
): ResolvedChallengeWindow {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new Error("Calendar month requires a valid instant");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return resolveCalendarMonth(Number(values.year), Number(values.month), timezone);
}

export function resolveRollingWindow(anchorInstant: string, durationDays: number, timezone: string): ResolvedChallengeWindow {
  const anchor = parseDate(anchorInstant);
  if (anchor === null || !Number.isInteger(durationDays) || durationDays <= 0) {
    throw new Error("Rolling window requires a valid anchor instant and positive duration");
  }
  const end = new Date(anchor).toISOString();
  const start = new Date(anchor - durationDays * 24 * 60 * 60 * 1000).toISOString();
  return { windowKey: `rolling:${start}:${end}`, startInclusive: start, endExclusive: end, timezone };
}

export function resolveLocalEvidenceBucket(
  instant: string,
  timezone: string,
  granularity: "day" | "week",
): string {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new Error("Evidence bucket requires a valid instant");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  const local = new Date(Date.UTC(values.year, values.month - 1, values.day));
  if (granularity === "day") return `day:${values.year}-${String(values.month).padStart(2, "0")}-${String(values.day).padStart(2, "0")}`;
  const day = local.getUTCDay() || 7;
  local.setUTCDate(local.getUTCDate() - day + 1);
  return `week:${local.toISOString().slice(0, 10)}`;
}

function evidenceReason(
  definition: ChallengeDefinition | AchievementDefinition,
  evidence: EvidenceReference,
  strictPurpose = false,
): EvaluationReason {
  const qualification = "eligibility" in definition ? definition.eligibility : definition.qualification;
  const scope = "scope" in definition ? definition.scope : "personal";
  if (evidence.qualificationStatus === "revoked") return "activity_revoked";
  if (evidence.qualificationStatus === "pending") return "pending";
  if (!qualification.allowedEvidenceClasses.includes(evidence.evidenceClass)) {
    if (evidence.evidenceClass === "manual_outdoor") return "manual_personal_only";
    if (evidence.evidenceClass === "indoor") return "indoor_personal_only";
    if (evidence.evidenceClass === "simulated_expedition") return "simulated_expedition_only";
    return "ineligible";
  }
  if (
    scope === "competitive_candidate" &&
    (!qualification.competitiveEligible ||
      ("metadata" in definition && !definition.metadata.competitiveEligible))
  ) {
    return "competitive_not_enabled";
  }
  if (qualification.requireQualificationStatus &&
      evidence.qualificationStatus !== qualification.requireQualificationStatus) {
    return "ineligible";
  }
  if (evidence.qualificationPurpose !== qualification.purpose) {
    return "semantic_mismatch";
  }
  if (qualification.purpose === "canonical" &&
      (!evidence.sdeTargetId ||
        !(/^(sde:mountain:[^:]+|sde:route:[^@]+@[^@]+)$/.test(evidence.sdeTargetId)) ||
        !evidence.provenanceHash)) {
    return "missing_provenance";
  }
  if ("scope" in definition && definition.scope === "competitive_candidate") {
    if (qualification.competitivePurpose &&
        evidence.competitivePurpose !== qualification.competitivePurpose) return "competitive_not_enabled";
    if (qualification.requireCompetitiveStatus && evidence.competitiveStatus !== "eligible") {
      return "competitive_not_enabled";
    }
  }
  if (qualification.requiredQualificationRuleVersion &&
      evidence.qualificationRuleVersion !== qualification.requiredQualificationRuleVersion) {
    return "ineligible";
  }
  return "eligible";
}

function inWindow(
  evidence: EvidenceReference,
  window: ReturnType<typeof resolveExplicitWindow>,
  strict = false,
  requireExactBucket = true,
): boolean {
  if (strict && (!evidence.windowBucketKey || (requireExactBucket && evidence.windowBucketKey !== window.windowKey))) return false;
  const occurredAt = parseDate(evidence.occurredAt);
  if (occurredAt === null) return false;
  if (window.startInclusive !== null && occurredAt < window.startInclusive) return false;
  if (window.endExclusive !== null && occurredAt >= window.endExclusive) return false;
  return true;
}

function valueFor(definition: ChallengeDefinition, evidence: EvidenceReference): number {
  switch (definition.family) {
    case "monthly_elevation":
    case "cumulative_elevation":
      return Math.max(0, evidence.value ?? 0);
    case "hiking_distance":
      return Math.max(0, evidence.distanceKm ?? 0);
    case "mountain_count":
    case "summit_count":
    case "activity_consistency":
    case "expedition_milestone":
    case "training_milestone":
    case "readiness_milestone":
      return 1;
  }
}

function familyAllows(definition: ChallengeDefinition, evidence: EvidenceReference): boolean {
  switch (definition.family) {
    case "mountain_count":
      return Boolean(evidence.mountainId || evidence.sdeTargetId?.startsWith("sde:mountain:"));
    case "summit_count":
      return evidence.summitCompleted === true || evidence.evidenceClass === "canonical_summit";
    case "expedition_milestone":
      return evidence.evidenceClass === "simulated_expedition" &&
        (evidence.expeditionStageCompleted === true || evidence.expeditionCompleted === true);
    case "training_milestone":
      return evidence.sourceType === "training_session";
    case "readiness_milestone":
      return evidence.sourceType === "training_session" && evidence.qualificationPurpose === "readiness";
    default:
      return true;
  }
}

export function evaluateChallenge(
  ownerUserId: string,
  definition: ChallengeDefinition,
  evidence: readonly EvidenceReference[],
  windowInput: ResolvedChallengeWindow | string,
  evaluatedAt?: string,
): ChallengeEvaluationResult {
  const legacyWindow = typeof windowInput === "string";
  const windowKey = legacyWindow ? windowInput : windowInput.windowKey;
  const window = legacyWindow
    ? resolveExplicitWindow(definition.window, windowKey)
    : {
        windowKey,
        startInclusive: parseDate(windowInput.startInclusive),
        endExclusive: parseDate(windowInput.endExclusive),
      };
  const invalidResolvedWindow = !legacyWindow &&
    (window.startInclusive === null || window.endExclusive === null ||
      window.endExclusive <= window.startInclusive);
  if (definition.availability && definition.availability.status !== "available") {
    const progressIdentity = [ownerUserId, definition.definitionId, definition.version, definition.ruleVersion, windowKey].join(":");
    return {
      definitionId: definition.definitionId, windowKey, reason: definition.availability.status,
      acceptedEvidenceIds: [], rejectedEvidence: [],
      progress: {
        ownerUserId, definitionId: definition.definitionId, definitionVersion: CHALLENGE_DOMAIN_VERSION,
        windowKey, status: definition.availability.status, value: 0, target: definition.target,
        evidenceIds: [], evaluationVersion: definition.ruleVersion,
        pendingReason: definition.availability.reason, correctionVersion: 0, progressIdentity,
        contributionIdentities: [],
      },
    };
  }
  const rejectedEvidence: { evidenceId: string; reason: EvaluationReason }[] = [];
  const accepted: EvidenceReference[] = [];
  const seen = new Set<string>();
  let hasPending = false;
  let hasRevoked = false;

  for (const item of latestEvidenceByLineage(evidence)) {
    if (seen.has(evidenceLineageId(item))) continue;
    seen.add(evidenceLineageId(item));
    if (item.ownerUserId !== ownerUserId) {
      rejectedEvidence.push({ evidenceId: item.evidenceId, reason: "cross_owner_evidence" });
      continue;
    }
    const reason = evidenceReason(definition, item, !legacyWindow);
    if (reason === "pending") {
      hasPending = true;
      rejectedEvidence.push({ evidenceId: item.evidenceId, reason });
      continue;
    }
    if (reason === "activity_revoked") hasRevoked = true;
    if (invalidResolvedWindow || reason !== "eligible" || !inWindow(
      item, window, !legacyWindow, definition.family !== "activity_consistency",
    )) {
      rejectedEvidence.push({ evidenceId: item.evidenceId, reason: reason === "eligible" ? "outside_window" : reason });
      continue;
    }
    if (familyAllows(definition, item)) accepted.push(item);
    else rejectedEvidence.push({ evidenceId: item.evidenceId, reason: "ineligible" });
  }

  const acceptedEvidenceIds = accepted.map((item) => item.evidenceId);
  const uniqueMountainIds = new Set(
    accepted.map((item) => item.mountainId ?? item.sdeTargetId).filter((value): value is string => Boolean(value)),
  );
  const value = definition.family === "mountain_count" ? uniqueMountainIds.size :
    definition.family === "activity_consistency" ? new Set(accepted.map((item) => item.windowBucketKey ?? item.occurredAt.slice(0, 10))).size :
    accepted.reduce((total, item) => total + valueFor(definition, item), 0);
  const status = hasRevoked && accepted.length === 0 ? "revoked" :
    hasPending && accepted.length === 0 ? "pending" :
    accepted.length === 0 ? "unavailable" :
    value >= definition.target ? "completed" : "active";
  const reason: EvaluationReason = status === "revoked" ? "activity_revoked" :
    status === "pending" ? "pending" :
    status === "unavailable" ? (rejectedEvidence[0]?.reason ?? "unavailable") : "eligible";
  const progressIdentity = [
    ownerUserId, definition.definitionId, definition.version, definition.ruleVersion, windowKey,
  ].join(":");
  const contributionIdentities = accepted.map((item) => [
    ownerUserId, definition.definitionId, definition.version, definition.ruleVersion, windowKey, evidenceLineageId(item),
  ].join(":"));

  return {
    definitionId: definition.definitionId,
    windowKey,
    reason,
    acceptedEvidenceIds,
    rejectedEvidence,
    progress: {
      ownerUserId,
      definitionId: definition.definitionId,
      definitionVersion: CHALLENGE_DOMAIN_VERSION,
      windowKey,
      status,
      value: Math.min(definition.target, value),
      target: definition.target,
      evidenceIds: acceptedEvidenceIds,
      lastEvaluatedAt: evaluatedAt,
      evaluationVersion: definition.ruleVersion,
      pendingReason: status === "pending" ? "Waiting for evidence qualification or sync" : undefined,
      correctionVersion: accepted.reduce((max, item) => Math.max(max, item.correctionVersion ?? 0), 0),
      progressIdentity,
      contributionIdentities,
    },
  };
}

export function evaluateAchievement(
  ownerUserId: string,
  definition: AchievementDefinition,
  evidence: readonly EvidenceReference[],
  earnedAt: string,
): AchievementEvaluationResult {
  if (definition.availability && definition.availability.status !== "available") {
    return { achievementId: definition.achievementId, award: null, reason: definition.availability.status, acceptedEvidenceIds: [] };
  }
  const accepted: EvidenceReference[] = [];
  const rejected: EvaluationReason[] = [];
  let hasPending = false;
  const ownerEvidence = evidence.filter((item) => item.ownerUserId === ownerUserId);
  for (const item of latestEvidenceByLineage(ownerEvidence)) {
    const reason = evidenceReason(definition, item);
    if (reason === "pending") {
      hasPending = true;
      continue;
    }
    if (reason !== "eligible") {
      rejected.push(reason === "ineligible" ? "semantic_mismatch" : reason);
      continue;
    }
    const conditionMatches =
      (definition.condition.kind === "first_canonical_mountain" &&
        item.evidenceClass === "trusted_gps_outdoor" &&
        Boolean(item.sdeTargetId?.startsWith("sde:mountain:"))) ||
      (definition.condition.kind === "cumulative_elevation" &&
        item.evidenceClass === "trusted_gps_outdoor" &&
        typeof item.value === "number" && item.value > 0) ||
      (definition.condition.kind === "first_expedition_stage" &&
        item.evidenceClass === "simulated_expedition" &&
        item.expeditionStageCompleted === true) ||
      (definition.condition.kind === "training_block_complete" &&
        item.sourceType === "training_session" &&
        item.trainingBlockCompleted === true);
    if (conditionMatches) accepted.push(item);
    else rejected.push("semantic_mismatch");
  }
  const uniqueEvidence = [...new Map(accepted.map((item) => [evidenceLineageId(item), item])).values()];
  const mountainCount = new Set(
    uniqueEvidence.map((item) => item.mountainId ?? item.sdeTargetId).filter(Boolean),
  ).size;
  const metric = definition.condition.kind === "cumulative_elevation"
    ? uniqueEvidence.reduce((sum, item) => sum + Math.max(0, item.value ?? 0), 0)
    : definition.condition.kind === "first_canonical_mountain"
      ? mountainCount
      : uniqueEvidence.length;
  const target = definition.condition.kind === "cumulative_elevation"
    ? definition.condition.targetMetres
    : definition.condition.targetCount;
  const evidenceIds = uniqueEvidence.map((item) => item.evidenceId).sort();
  if (hasPending && uniqueEvidence.length === 0) {
    return { achievementId: definition.achievementId, award: null, reason: "pending", acceptedEvidenceIds: [] };
  }
  if (metric < target) {
    return {
      achievementId: definition.achievementId,
      award: null,
      reason: uniqueEvidence.length > 0 ? "threshold_not_met" : (rejected[0] ?? "unavailable"),
      acceptedEvidenceIds: evidenceIds,
    };
  }
  const awardIdentity = `${ownerUserId}:${definition.achievementId}:${definition.version}:${definition.ruleVersion}`;
  return {
    achievementId: definition.achievementId,
    reason: "eligible",
    acceptedEvidenceIds: evidenceIds,
    award: {
      awardIdentity,
      ownerUserId,
      achievementId: definition.achievementId,
      achievementVersion: definition.version,
      status: "confirmed",
      evidenceIds,
      earnedAt,
      ruleVersion: definition.ruleVersion,
      correctionVersion: [...accepted, ...latestEvidenceByLineage(ownerEvidence)
        .filter((item) => item.qualificationStatus === "revoked")]
        .reduce((max, item) => Math.max(max, item.correctionVersion ?? 0), 0),
    },
  };
}