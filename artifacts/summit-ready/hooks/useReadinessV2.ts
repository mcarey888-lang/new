import { useMemo } from "react";
import { useAuth } from "@clerk/expo";
import { useApp } from "@/context/AppContext";
import { evaluateReadiness } from "@/utils/readinessV2";
import { selectReadinessNextAction, ReadinessActionCandidate, ReadinessActionContext } from "@/utils/readinessActions";
import { createReadinessInput } from "@/utils/readinessAdapter";

export function useReadinessV2() {
  const { userId } = useAuth();
  const { summitGoal, sessions, trainingPlan, exploreHikes } = useApp();

  return useMemo(() => {
    if (!summitGoal) return null;

    const ownerId = userId ?? "local";
    const asOf = new Date().toISOString();

    const input = createReadinessInput(
      ownerId,
      asOf,
      summitGoal,
      sessions,
      exploreHikes,
      trainingPlan
    );

    const result = evaluateReadiness(input);

    const asOf7DaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const input7DaysAgo = createReadinessInput(
      ownerId,
      asOf7DaysAgo,
      summitGoal,
      sessions,
      exploreHikes,
      trainingPlan
    );
    const result7DaysAgo = evaluateReadiness(input7DaysAgo);
    const trend = result.overallScore !== null && result7DaysAgo.overallScore !== null 
      ? result.overallScore - result7DaysAgo.overallScore 
      : null;

    const actionCandidates: ReadinessActionCandidate[] = [
      {
        actionId: "focus_endurance",
        label: "Long slow distance",
        focusDimension: "endurance",
        projectedEvidence: {
          evidenceId: "proj",
          ownerId,
          source: "manual",
          completedAt: asOf,
          distanceKm: (input.target.distanceKm || 10) * 0.5,
          durationMinutes: 120,
        }
      },
      {
        actionId: "focus_elevation",
        label: "Hill repeats",
        focusDimension: "elevationCapacity",
        projectedEvidence: {
          evidenceId: "proj2",
          ownerId,
          source: "manual",
          completedAt: asOf,
          ascentM: (input.target.ascentM || 500) * 0.3,
          durationMinutes: 90,
        }
      },
      {
        actionId: "focus_consistency",
        label: "Recovery hike",
        focusDimension: "consistency",
        projectedEvidence: {
          evidenceId: "proj3",
          ownerId,
          source: "manual",
          completedAt: asOf,
          distanceKm: 3,
          ascentM: 100,
          durationMinutes: 45,
        }
      }
    ];

    const actionContext: ReadinessActionContext = {
      input,
      result,
      candidates: actionCandidates,
      overloadDetected: false,
    };

    const nextAction = selectReadinessNextAction(actionContext);

    return { result, nextAction, trend, input };
  }, [summitGoal, sessions, trainingPlan, exploreHikes, userId]);
}
