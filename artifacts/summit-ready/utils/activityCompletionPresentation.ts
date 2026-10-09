import type {
  ElevationBankResponse,
  ElevationBankUnavailable,
} from "@workspace/api-client-react";
import type { ExpeditionPresentationState } from "./expeditionProgress";

export type CompletionPresentationInput = {
  activityId: string;
  title: string;
  distanceKm?: number | null;
  ascentM?: number | null;
  durationSecs?: number | null;
  trackingMode?: string | null;
  trainingSessionKey?: string | null;
  expeditionId?: string | null;
  expeditionStageName?: string | null;
  isOffline: boolean;
  elevationBank?: ElevationBankResponse | ElevationBankUnavailable;
  expeditionProgress?: ExpeditionPresentationState | null;
  challengeAchievement?: ChallengeAchievementConsequenceInput;
};

export type ChallengeAchievementConsequenceInput =
  | {
      status: "confirmed";
      challengeTitles?: readonly string[];
      achievementTitles?: readonly string[];
    }
  | { status: "pending" | "unavailable"; reason: string };

export type ChallengeAchievementPresentation =
  | {
      status: "confirmed";
      challengeTitles: readonly string[];
      achievementTitles: readonly string[];
    }
  | { status: "pending" | "unavailable"; reason: string }
  | { status: "not_linked" };

export type CompletionPresentation = {
  title: string;
  metrics: {
    distanceKm: number;
    ascentM: number;
    durationSecs: number;
  };
  elevationBank:
    | {
        status: "credited";
        creditedAscentM: number;
        lifetimeAscentM: number;
        everestEquivalent: number;
      }
    | {
        status: "pending" | "unavailable" | "not_eligible";
      };
  training:
    | { status: "linked"; sessionKey: string }
    | { status: "not_linked" };
  expedition:
    | {
        status: "simulated";
        stageName: string;
        simulatedPercent: number;
        completedStageCount: number;
        totalStageCount: number;
        nextStageName: string | null;
        isComplete: boolean;
      }
    | { status: "not_linked" };
  /**
   * Where this activity's record currently is.
   *
   * "synced" is claimed only on evidence — a credit for this activity id in
   * the elevation bank. Without that the honest answer is that it is saved
   * here and waiting, which is also true and does not promise a server has
   * it. Saying "Synced" because a request was sent is how somebody wipes an
   * app believing their hikes are safe.
   */
  sync: "saved_locally" | "sync_pending" | "synced";
  challengeAchievement: ChallengeAchievementPresentation;
};

export function buildActivityCompletionPresentation(
  input: CompletionPresentationInput,
): CompletionPresentation {
  const safeMetric = (value: number | null | undefined): number =>
    typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
  const credited = input.elevationBank?.status === "available"
    ? input.elevationBank.recentCredits.find(
    (credit) =>
      (credit.activityId === input.activityId || credit.sourceId === input.activityId)
      && (credit.status === "credited" || credit.status === "corrected"),
      )
    : undefined;

  return {
    title: input.title.trim() || "Hike",
    metrics: {
      distanceKm: safeMetric(input.distanceKm),
      ascentM: safeMetric(input.ascentM),
      durationSecs: safeMetric(input.durationSecs),
    },
    elevationBank: credited && input.elevationBank?.status === "available"
      ? {
          status: "credited",
          creditedAscentM: credited.creditedAscentM,
          lifetimeAscentM: input.elevationBank.lifetimeAscentM,
          everestEquivalent: input.elevationBank.everestEquivalent,
        }
      : {
        status: !input.elevationBank
          ? "not_eligible"
          : input.elevationBank.status === "unavailable"
            ? "unavailable"
            : "pending",
        },
    training: input.trainingSessionKey
      ? { status: "linked", sessionKey: input.trainingSessionKey }
      : { status: "not_linked" },
    expedition: input.expeditionId
      ? {
          status: "simulated",
          stageName: input.expeditionStageName?.trim() || "Expedition stage",
          simulatedPercent: input.expeditionProgress?.progress.simulatedPercent ?? 0,
          completedStageCount: input.expeditionProgress?.progress.completedStageCount ?? 0,
          totalStageCount: input.expeditionProgress?.progress.totalStageCount ?? 0,
          nextStageName: input.expeditionProgress?.nextStage?.name ?? null,
          isComplete: input.expeditionProgress?.progress.isComplete ?? false,
        }
      : { status: "not_linked" },
    sync: input.isOffline ? "saved_locally" : credited ? "synced" : "sync_pending",
    challengeAchievement: input.challengeAchievement
      ? input.challengeAchievement.status === "confirmed"
        ? {
            status: "confirmed",
            challengeTitles: input.challengeAchievement.challengeTitles ?? [],
            achievementTitles: input.challengeAchievement.achievementTitles ?? [],
          }
        : input.challengeAchievement
      : { status: "not_linked" },
  };
}
