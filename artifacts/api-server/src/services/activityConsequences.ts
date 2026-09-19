import type { QualificationEvaluation } from "./canonicalQualificationEvaluator";
import {
  evaluateElevationBankCredit,
  type ElevationBankActivity,
  type ElevationBankQualification,
  type ElevationBankWriteResult,
} from "./elevationBank";
import type {
  ElevationLedgerEvidenceClass,
  ExpeditionContributionInput,
} from "./stage2LedgerPlanning";
import type { ExpeditionContributionWrite } from "./stage2Ledgers";

export type ConsequenceActivity = ElevationBankActivity & {
  links: readonly ConsequenceLink[];
  sourceType?: string;
  sourceId?: string;
};

export type ConsequenceLink = {
  linkType:
    | "training_plan"
    | "training_session"
    | "expedition"
    | "expedition_stage"
    | "canonical_hill"
    | "canonical_route"
    | "community_route"
    | "challenge";
  targetId: string;
  metadata?: Record<string, unknown>;
};

export type ConsequenceEffect =
  | {
      kind: "elevation_bank";
      idempotencyKey: string;
      qualification: QualificationEvaluation;
    }
  | {
      kind: "training_completion";
      idempotencyKey: string;
      trainingPlanId?: string;
      trainingSessionId: string;
      qualification: QualificationEvaluation | undefined;
      status: "ready" | "pending_legacy_handoff";
    }
  | {
      kind: "readiness_impact";
      idempotencyKey: string;
      trainingSessionId: string;
      qualification: QualificationEvaluation;
      status: "pending_legacy_rules";
    }
  | {
      kind: "expedition_contribution";
      idempotencyKey: string;
      expeditionId?: string;
      expeditionStageId: string;
      qualification: QualificationEvaluation | undefined;
      status: "ready" | "pending_legacy_rule";
      simulatedOnly: true;
    }
  | {
      kind: "challenge_hook";
      idempotencyKey: string;
      challengeId: string;
      qualification: QualificationEvaluation;
      status: "pending_legacy_hook";
    }
  | {
      kind: "achievement_hook";
      idempotencyKey: string;
      achievementKey: string;
      status: "pending_legacy_hook";
    }
  | {
      kind: "mountain_route_evidence";
      idempotencyKey: string;
      targetId: string;
      targetType: "mountain" | "route";
      status: "recorded";
      realSummitEligible: boolean;
    };

export type ConsequenceSummary = {
  activityId: string;
  status: "complete" | "pending" | "ineligible";
  elevationBank: {
    status: "eligible" | "ineligible" | "pending" | "not_linked";
    creditedAscentM: number | null;
    reason?: string;
  };
  training: {
    sessionIds: readonly string[];
    completion: "ready" | "pending_legacy_handoff" | "not_linked";
    readiness: "pending_legacy_rules" | "not_linked";
  };
  expedition: {
    stageIds: readonly string[];
    contribution: "ready" | "pending_legacy_rule" | "not_linked";
    simulatedOnly: true;
  };
  challenges: {
    challengeIds: readonly string[];
    status: "pending_legacy_hook" | "not_linked";
  };
  mountainRoute: {
    targets: readonly string[];
    evidenceRecorded: boolean;
    realSummitEligible: boolean;
  };
  effects: readonly ConsequenceEffect[];
};

export type ConsequencePlanInput = {
  activity: ConsequenceActivity;
  qualifications?: readonly QualificationEvaluation[];
  /**
   * The explicit Expedition rule/context supplied by the existing Expedition
   * owner. The resolver never infers a stage rule from names or metrics.
   */
  expeditionRule?: {
    expeditionId: string;
    runId: string;
    stageKey: string;
    ruleVersion: string;
    scoreVersion: string;
    activityKind: string;
    acceptedMetric: number;
    acceptedElevationM?: number;
    allowedActivityKinds: readonly string[];
    allowedEvidenceClasses: readonly string[];
  };
};

export type ConsequenceEffectWriters = {
  creditElevationBank?: (
    activity: ElevationBankActivity,
    qualification: ElevationBankQualification,
  ) => Promise<ElevationBankWriteResult>;
  completeTrainingSession?: (input: {
    activityId: string;
    trainingPlanId?: string;
    trainingSessionId: string;
    idempotencyKey: string;
  }) => Promise<{ status: "completed" | "deduplicated" | "pending" }>;
  applyReadinessImpact?: (input: {
    activityId: string;
    trainingSessionId: string;
    qualification: QualificationEvaluation;
    idempotencyKey: string;
  }) => Promise<{ status: "applied" | "deduplicated" | "pending" }>;
  contributeExpedition?: (
    input: ExpeditionContributionInput,
  ) => Promise<ExpeditionContributionWrite>;
  applyChallengeHook?: (input: {
    activityId: string;
    challengeId: string;
    idempotencyKey: string;
  }) => Promise<{ status: "applied" | "deduplicated" | "pending" }>;
  applyAchievementHook?: (input: {
    activityId: string;
    achievementKey: string;
    idempotencyKey: string;
  }) => Promise<{ status: "applied" | "deduplicated" | "pending" }>;
  recordMountainRouteEvidence?: (input: {
    activityId: string;
    targetId: string;
    realSummitEligible: boolean;
    idempotencyKey: string;
  }) => Promise<{ status: "recorded" | "deduplicated" | "pending" }>;
  hasApplied?: (idempotencyKey: string) => Promise<boolean>;
  markApplied?: (idempotencyKey: string) => Promise<void>;
};

function linksOf(
  activity: ConsequenceActivity,
  linkType: ConsequenceLink["linkType"],
): ConsequenceLink[] {
  return activity.links.filter((link) => link.linkType === linkType);
}

function firstQualification(
  qualifications: readonly QualificationEvaluation[],
  purpose: QualificationEvaluation["purpose"],
): QualificationEvaluation | undefined {
  return qualifications.find((qualification) => qualification.purpose === purpose);
}

function eligibleQualification(
  qualifications: readonly QualificationEvaluation[],
  purpose: QualificationEvaluation["purpose"],
): QualificationEvaluation | undefined {
  const qualification = firstQualification(qualifications, purpose);
  return qualification?.status === "eligible" ? qualification : undefined;
}

function uniqueLinks(links: readonly ConsequenceLink[]): ConsequenceLink[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.linkType}\u001f${link.targetId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function qualificationAsElevation(
  qualification: QualificationEvaluation,
): ElevationBankQualification {
  return {
    purpose: qualification.purpose,
    status: qualification.status,
    evidenceClass: qualification.evidenceClass,
    creditedMetric: qualification.creditedMetric,
    persistablePurpose: qualification.persistablePurpose,
    ruleVersion: qualification.ruleVersion,
  };
}

function toElevationLedgerEvidenceClass(
  value: string,
): ElevationLedgerEvidenceClass | undefined {
  switch (value) {
    case "recorded_unverified":
    case "quality_accepted":
    case "verified_activity":
    case "unverified_manual":
    case "indoor_training":
    case "unavailable_untrusted":
      return value;
    default:
      return undefined;
  }
}

function mapElevationLedgerEvidenceClasses(
  values: readonly string[],
): ElevationLedgerEvidenceClass[] | undefined {
  const mapped = values.map(toElevationLedgerEvidenceClass);
  if (mapped.some((value) => value === undefined)) return undefined;
  return mapped as ElevationLedgerEvidenceClass[];
}

export function planActivityConsequences(
  input: ConsequencePlanInput,
): ConsequenceSummary {
  const { activity } = input;
  const qualifications = (input.qualifications ?? []).filter(
    (qualification) => qualification.activityId === activity.id,
  );
  const effects: ConsequenceEffect[] = [];
  const trainingLinks = uniqueLinks([
    ...linksOf(activity, "training_session"),
  ]);
  const trainingPlanLink = linksOf(activity, "training_plan")[0];
  const expeditionLinks = uniqueLinks([
    ...linksOf(activity, "expedition_stage"),
  ]);
  const challengeLinks = uniqueLinks(linksOf(activity, "challenge"));
  const mountainRouteLinks = uniqueLinks([
    ...linksOf(activity, "canonical_hill"),
    ...linksOf(activity, "canonical_route"),
    ...linksOf(activity, "community_route"),
  ]);
  const elevationQualification = eligibleQualification(
    qualifications,
    "personal_elevation",
  );
  const elevationQualificationResult = firstQualification(
    qualifications,
    "personal_elevation",
  );
  const elevationBankDecision = elevationQualificationResult
    ? evaluateElevationBankCredit(
      activity,
      qualificationAsElevation(elevationQualificationResult),
    )
    : undefined;
  const readinessQualification = eligibleQualification(qualifications, "readiness");
  const expeditionQualification = eligibleQualification(
    qualifications,
    "expedition_progress",
  );
  const challengeQualification = eligibleQualification(
    qualifications,
    "challenge_eligibility",
  );
  const realSummitQualification = eligibleQualification(
    qualifications,
    "real_summit_evidence",
  );

  if (elevationBankDecision?.status === "eligible" && elevationQualification) {
    effects.push({
      kind: "elevation_bank",
      idempotencyKey: `${activity.id}:elevation_bank:${elevationQualification.ruleVersion}`,
      qualification: elevationQualification,
    });
  }

  for (const link of trainingLinks) {
    const idempotencyKey = `${activity.id}:training:${link.targetId}`;
    effects.push({
      kind: "training_completion",
      idempotencyKey,
      trainingPlanId: trainingPlanLink?.targetId,
      trainingSessionId: link.targetId,
      qualification: readinessQualification,
      status: readinessQualification ? "ready" : "pending_legacy_handoff",
    });
    if (readinessQualification) {
      effects.push({
        kind: "readiness_impact",
        idempotencyKey: `${idempotencyKey}:readiness:${readinessQualification.ruleVersion}`,
        trainingSessionId: link.targetId,
        qualification: readinessQualification,
        status: "pending_legacy_rules",
      });
    }
  }

  for (const link of expeditionLinks) {
    effects.push({
      kind: "expedition_contribution",
      idempotencyKey: `${activity.id}:expedition:${link.targetId}:${input.expeditionRule?.ruleVersion ?? "pending"}`,
      expeditionId: linksOf(activity, "expedition")[0]?.targetId,
      expeditionStageId: link.targetId,
      qualification: expeditionQualification ?? firstQualification(qualifications, "expedition_progress"),
      status: expeditionQualification
        && input.expeditionRule
        && linksOf(activity, "expedition").some(
          (link) => link.targetId === input.expeditionRule?.expeditionId,
        )
        && input.expeditionRule.stageKey === link.targetId
        && input.expeditionRule.activityKind === activity.activityKind
        && input.expeditionRule.acceptedMetric === expeditionQualification.creditedMetric
        && (input.expeditionRule.acceptedElevationM ?? null)
          === (activity.validatedAscentM ?? activity.recordedAscentM ?? null)
        && mapElevationLedgerEvidenceClasses(input.expeditionRule.allowedEvidenceClasses)
        && toElevationLedgerEvidenceClass(expeditionQualification.evidenceClass)
        ? "ready"
        : "pending_legacy_rule",
      simulatedOnly: true,
    });
  }

  for (const link of challengeLinks) {
    if (!challengeQualification) continue;
    effects.push({
      kind: "challenge_hook",
      idempotencyKey: `${activity.id}:challenge:${link.targetId}`,
      challengeId: link.targetId,
      qualification: challengeQualification,
      status: "pending_legacy_hook",
    });
  }

  if (challengeQualification) {
    for (const link of challengeLinks) {
      effects.push({
        kind: "achievement_hook",
        idempotencyKey: `${activity.id}:achievement:challenge:${link.targetId}`,
        achievementKey: `challenge:${link.targetId}`,
        status: "pending_legacy_hook",
      });
    }
  }

  for (const link of mountainRouteLinks) {
    const isSdeTarget = link.targetId.startsWith("sde:");
    const realSummitEligible = Boolean(
      realSummitQualification
      && isSdeTarget
      && link.linkType !== "community_route",
    );
    effects.push({
      kind: "mountain_route_evidence",
      idempotencyKey: `${activity.id}:evidence:${link.linkType}:${link.targetId}`,
      targetId: link.targetId,
      targetType: link.linkType === "canonical_route" || link.linkType === "community_route"
        ? "route"
        : "mountain",
      status: "recorded",
      realSummitEligible,
    });
  }

  const hasPending = effects.some((effect) =>
    effect.kind === "training_completion"
      ? effect.status === "pending_legacy_handoff"
      : effect.kind === "readiness_impact"
        ? effect.status === "pending_legacy_rules"
        : effect.kind === "expedition_contribution"
          ? effect.status === "pending_legacy_rule"
          : effect.kind === "challenge_hook" || effect.kind === "achievement_hook"
            ? effect.status === "pending_legacy_hook"
            : false,
  );

  return {
    activityId: activity.id,
    status: effects.length === 0
      ? "ineligible"
      : hasPending ? "pending" : "complete",
    elevationBank: {
      status: elevationBankDecision?.status === "eligible"
        ? "eligible"
        : firstQualification(qualifications, "personal_elevation")
          ? "ineligible"
          : "not_linked",
      creditedAscentM: elevationBankDecision?.status === "eligible"
        ? elevationBankDecision.creditedAscentM
        : null,
      ...(elevationBankDecision?.status === "eligible"
        ? {}
        : { reason: "Personal elevation qualification is not eligible for Elevation Bank" }),
    },
    training: {
      sessionIds: trainingLinks.map((link) => link.targetId),
      completion: trainingLinks.length === 0
        ? "not_linked"
        : readinessQualification
          ? "ready"
          : "pending_legacy_handoff",
      readiness: readinessQualification ? "pending_legacy_rules" : "not_linked",
    },
    expedition: {
      stageIds: expeditionLinks.map((link) => link.targetId),
      contribution: expeditionLinks.length === 0
        ? "not_linked"
        : expeditionQualification
          && input.expeditionRule
          && linksOf(activity, "expedition").some(
            (link) => link.targetId === input.expeditionRule?.expeditionId,
          )
          && expeditionLinks.some(
            (link) => link.targetId === input.expeditionRule?.stageKey,
          )
          && input.expeditionRule.activityKind === activity.activityKind
          && input.expeditionRule.acceptedMetric === expeditionQualification.creditedMetric
          && (input.expeditionRule.acceptedElevationM ?? null)
            === (input.activity.validatedAscentM ?? input.activity.recordedAscentM ?? null)
          && mapElevationLedgerEvidenceClasses(input.expeditionRule.allowedEvidenceClasses)
          && toElevationLedgerEvidenceClass(expeditionQualification.evidenceClass)
          ? "ready"
          : "pending_legacy_rule",
      simulatedOnly: true,
    },
    challenges: {
      challengeIds: challengeLinks.map((link) => link.targetId),
      status: challengeLinks.length > 0 && challengeQualification
        ? "pending_legacy_hook"
        : "not_linked",
    },
    mountainRoute: {
      targets: mountainRouteLinks.map((link) => link.targetId),
      evidenceRecorded: mountainRouteLinks.length > 0,
      realSummitEligible: effects.some((effect) =>
        effect.kind === "mountain_route_evidence" && effect.realSummitEligible,
      ),
    },
    effects,
  };
}

export type AppliedConsequence = {
  idempotencyKey: string;
  kind: ConsequenceEffect["kind"];
  status: "applied" | "deduplicated" | "pending" | "skipped";
};

export async function applyActivityConsequences(
  input: ConsequencePlanInput,
  writers: ConsequenceEffectWriters,
): Promise<{
  summary: ConsequenceSummary;
  applied: readonly AppliedConsequence[];
}> {
  const summary = planActivityConsequences(input);
  const applied: AppliedConsequence[] = [];
  const alreadyApplied = new Set<string>();

  for (const effect of summary.effects) {
    if (alreadyApplied.has(effect.idempotencyKey)) continue;
    alreadyApplied.add(effect.idempotencyKey);
    if (writers.hasApplied && await writers.hasApplied(effect.idempotencyKey)) {
      applied.push({ idempotencyKey: effect.idempotencyKey, kind: effect.kind, status: "deduplicated" });
      continue;
    }

    let status: AppliedConsequence["status"] = "pending";
    if (
      effect.kind === "elevation_bank"
      && writers.creditElevationBank
      && effect.qualification
    ) {
      const result = await writers.creditElevationBank(
        input.activity,
        qualificationAsElevation(effect.qualification),
      );
      status = result.status === "created" ? "applied" : result.status === "deduplicated" ? "deduplicated" : "pending";
    } else if (effect.kind === "training_completion" && writers.completeTrainingSession) {
      const result = await writers.completeTrainingSession({
        activityId: input.activity.id,
        trainingPlanId: effect.trainingPlanId,
        trainingSessionId: effect.trainingSessionId,
        idempotencyKey: effect.idempotencyKey,
      });
      status = result.status === "completed" ? "applied" : result.status === "deduplicated" ? "deduplicated" : "pending";
    } else if (effect.kind === "readiness_impact" && writers.applyReadinessImpact) {
      const result = await writers.applyReadinessImpact({
        activityId: input.activity.id,
        trainingSessionId: effect.trainingSessionId,
        qualification: effect.qualification,
        idempotencyKey: effect.idempotencyKey,
      });
      status = result.status === "applied" ? "applied" : result.status === "deduplicated" ? "deduplicated" : "pending";
    } else if (
      effect.kind === "expedition_contribution"
      && writers.contributeExpedition
      && input.expeditionRule
      && effect.status === "ready"
      && effect.qualification?.status === "eligible"
    ) {
      const allowedEvidenceClasses = mapElevationLedgerEvidenceClasses(
        input.expeditionRule.allowedEvidenceClasses,
      );
      const evidenceClass = toElevationLedgerEvidenceClass(
        effect.qualification.evidenceClass,
      );
      if (!allowedEvidenceClasses || !evidenceClass) {
        applied.push({
          idempotencyKey: effect.idempotencyKey,
          kind: effect.kind,
          status: "pending",
        });
        continue;
      }
      const result = await writers.contributeExpedition({
        ownerUserId: input.activity.ownerUserId,
        runId: input.expeditionRule.runId,
        expeditionId: input.expeditionRule.expeditionId,
        activityId: input.activity.id,
        stageRule: {
          stageKey: input.expeditionRule.stageKey,
          ruleVersion: input.expeditionRule.ruleVersion,
          scoreVersion: input.expeditionRule.scoreVersion,
          allowedActivityKinds: input.expeditionRule.allowedActivityKinds,
          allowedEvidenceClasses,
        },
        activityKind: input.activity.activityKind,
        evidenceClass,
        acceptedMetric: effect.qualification.creditedMetric ?? 0,
        acceptedElevationM: input.activity.validatedAscentM ?? input.activity.recordedAscentM ?? undefined,
        realSummitClaim: false,
      });
      status = result.status === "created" ? "applied" : result.status === "deduplicated" ? "deduplicated" : "pending";
    } else if (effect.kind === "challenge_hook" && writers.applyChallengeHook) {
      const result = await writers.applyChallengeHook({
        activityId: input.activity.id,
        challengeId: effect.challengeId,
        idempotencyKey: effect.idempotencyKey,
      });
      status = result.status === "applied" ? "applied" : result.status === "deduplicated" ? "deduplicated" : "pending";
    } else if (effect.kind === "achievement_hook" && writers.applyAchievementHook) {
      const result = await writers.applyAchievementHook({
        activityId: input.activity.id,
        achievementKey: effect.achievementKey,
        idempotencyKey: effect.idempotencyKey,
      });
      status = result.status === "applied" ? "applied" : result.status === "deduplicated" ? "deduplicated" : "pending";
    } else if (effect.kind === "mountain_route_evidence" && writers.recordMountainRouteEvidence) {
      const result = await writers.recordMountainRouteEvidence({
        activityId: input.activity.id,
        targetId: effect.targetId,
        realSummitEligible: effect.realSummitEligible,
        idempotencyKey: effect.idempotencyKey,
      });
      status = result.status === "recorded" ? "applied" : result.status === "deduplicated" ? "deduplicated" : "pending";
    }

    if (status === "applied" && writers.markApplied) {
      await writers.markApplied(effect.idempotencyKey);
    }
    applied.push({ idempotencyKey: effect.idempotencyKey, kind: effect.kind, status });
  }

  return { summary, applied };
}