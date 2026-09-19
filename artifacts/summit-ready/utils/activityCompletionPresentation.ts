import type {
  ElevationBankResponse,
  ElevationBankUnavailable,
} from "@workspace/api-client-react";

export type CompletionPresentationInput = {
  activityId: string;
  title: string;
  distanceKm: number;
  ascentM: number;
  durationSecs: number;
  trackingMode?: string | null;
  trainingSessionKey?: string | null;
  expeditionId?: string | null;
  expeditionStageName?: string | null;
  isOffline: boolean;
  elevationBank?: ElevationBankResponse | ElevationBankUnavailable;
};

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
        status: "pending" | "unavailable";
      };
  training:
    | { status: "linked"; sessionKey: string }
    | { status: "not_linked" };
  expedition:
    | { status: "simulated"; stageName: string }
    | { status: "not_linked" };
  sync: "saved_locally" | "ready_to_sync";
};

export function buildActivityCompletionPresentation(
  input: CompletionPresentationInput,
): CompletionPresentation {
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
      distanceKm: input.distanceKm,
      ascentM: input.ascentM,
      durationSecs: input.durationSecs,
    },
    elevationBank: credited && input.elevationBank?.status === "available"
      ? {
          status: "credited",
          creditedAscentM: credited.creditedAscentM,
          lifetimeAscentM: input.elevationBank.lifetimeAscentM,
          everestEquivalent: input.elevationBank.everestEquivalent,
        }
      : {
          status: input.elevationBank?.status === "unavailable"
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
        }
      : { status: "not_linked" },
    sync: input.isOffline ? "saved_locally" : "ready_to_sync",
  };
}
