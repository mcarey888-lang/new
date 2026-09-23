/**
 * Readiness history for the Full Readiness chart.
 *
 * This replays the EXISTING Readiness 2.0 engine at past `asOf` dates. It adds
 * no scoring of its own.
 *
 * The result is RECONSTRUCTED history, not recorded history: activity
 * inclusion and recency respect each sample date, but the summit goal, the
 * plan's session count and any later edits or deletions to an activity are
 * today's. `utils/readinessHistory.ts` documents the boundary in full.
 *
 * Only the selected period is evaluated, and the result is memoised on the
 * inputs that can change it, so switching period costs one pass and scrolling
 * costs none.
 */
import { useMemo } from "react";
import { useAuth } from "@clerk/expo";
import { useApp } from "@/context/AppContext";
import { evaluateReadiness } from "@/utils/readinessV2";
import { createReadinessInput } from "@/utils/readinessAdapter";
import { earliestEvidenceAt } from "@/utils/readinessEvidencePresentation";
import {
  buildReadinessHistory,
  type HistoryPeriod,
  type ReadinessHistorySeries,
} from "@/utils/readinessHistory";

export function useReadinessHistory(period: HistoryPeriod): ReadinessHistorySeries | null {
  const { userId } = useAuth();
  const { summitGoal, sessions, trainingPlan, exploreHikes } = useApp();

  return useMemo(() => {
    if (!summitGoal) return null;
    const ownerId = userId ?? "local";

    return buildReadinessHistory({
      period,
      now: new Date(),
      earliestEvidenceAt: earliestEvidenceAt(sessions, exploreHikes),
      evaluate: (asOfIso) => {
        const input = createReadinessInput(
          ownerId, asOfIso, summitGoal, sessions, exploreHikes, trainingPlan,
        );
        return evaluateReadiness(input).overallScore ?? null;
      },
    });
  }, [period, summitGoal, sessions, trainingPlan, exploreHikes, userId]);
}
