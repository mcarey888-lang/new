import {
  evaluateReadiness,
  type ReadinessDimensionName,
  type ReadinessEvidence,
  type ReadinessInput,
  type ReadinessResult,
} from "./readinessV2";

export type ReadinessActionCandidate = {
  actionId: string;
  label: string;
  scheduledDate?: string | null;
  focusDimension: ReadinessDimensionName;
  /** Explicit, estimated evidence for projection only. */
  projectedEvidence?: ReadinessEvidence;
};

export type ReadinessActionContext = {
  input: ReadinessInput;
  result: ReadinessResult;
  candidates: readonly ReadinessActionCandidate[];
  /** Supplied by an existing effort/fatigue boundary; never inferred here. */
  overloadDetected?: boolean;
};

export type ReadinessProjectedImpact = {
  before: number;
  after: number;
  delta: number;
  estimated: true;
};

export type ReadinessNextAction = {
  actionId: string;
  label: string;
  focusDimension: ReadinessDimensionName;
  scheduledDate?: string | null;
  projectedImpact?: ReadinessProjectedImpact;
};

const DIMENSION_ORDER: ReadinessDimensionName[] = [
  "endurance",
  "elevationCapacity",
  "consistency",
  "mountainExperience",
];

function dateRank(value?: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function metricCount(evidence?: ReadinessEvidence): number {
  if (!evidence) return 0;
  return [evidence.distanceKm, evidence.ascentM, evidence.durationMinutes].filter(
    (value) => typeof value === "number" && Number.isFinite(value) && value > 0,
  ).length;
}

function actionRank(
  action: ReadinessActionCandidate,
  gaps: readonly ReadinessDimensionName[],
  overloadDetected: boolean,
): [number, number, number, string] {
  const recoveryRank = overloadDetected && action.focusDimension === "consistency" ? 0 : 1;
  const gapRank = gaps.indexOf(action.focusDimension);
  return [
    recoveryRank,
    gapRank < 0 ? DIMENSION_ORDER.length : gapRank,
    dateRank(action.scheduledDate),
    action.actionId,
  ];
}

function compareRank(
  left: [number, number, number, string],
  right: [number, number, number, string],
): number {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return 0;
}

function project(
  input: ReadinessInput,
  result: ReadinessResult,
  action: ReadinessActionCandidate,
): ReadinessProjectedImpact | undefined {
  if (result.overallScore === null || metricCount(action.projectedEvidence) === 0) return undefined;
  const evidence = action.projectedEvidence;
  if (!evidence) return undefined;
  const projectedEvidence: ReadinessEvidence = {
    ...evidence,
    evidenceId: `projected:${action.actionId}`,
    ownerId: input.ownerId,
    completed: true,
    completedAt: input.asOf,
  };
  const projectedInput: ReadinessInput = {
    ...input,
    evidence: [
      ...input.evidence,
      projectedEvidence,
    ],
  };
  const projected = evaluateReadiness(projectedInput);
  if (projected.overallScore === null) return undefined;
  const delta = Math.min(20, Math.max(0, projected.overallScore - result.overallScore));
  return {
    before: result.overallScore,
    after: Math.min(100, result.overallScore + delta),
    delta,
    estimated: true,
  };
}

export function selectReadinessNextAction(
  context: ReadinessActionContext,
): ReadinessNextAction | undefined {
  const { result } = context;
  if (result.state === "unavailable") return undefined;
  const overloadDetected = context.overloadDetected === true;
  const candidates = [...context.candidates].sort((left, right) =>
    compareRank(
      actionRank(left, result.gaps, overloadDetected),
      actionRank(right, result.gaps, overloadDetected),
    ),
  );
  const selected = candidates[0];
  if (!selected) return undefined;
  return {
    actionId: selected.actionId,
    label: selected.label,
    focusDimension: selected.focusDimension,
    scheduledDate: selected.scheduledDate,
    projectedImpact: project(context.input, result, selected),
  };
}