import type { NearbyHill } from "@/context/AppContext";

export interface SignatureStageMetrics {
  routeKey?: string | null;
  routeName: string;
  region?: string | null;
  distanceKm: number | null;
  ascentM: number | null;
  estimatedHours?: number | null;
  difficulty?: string | null;
}

function fallbackRouteKey(routeName: string): string {
  return routeName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function signatureStageToNearbyHill(stage: SignatureStageMetrics): NearbyHill {
  const stableKey = `signature-route:${stage.routeKey?.trim() || fallbackRouteKey(stage.routeName)}`;
  const distanceKm = Math.max(0, stage.distanceKm ?? 0);
  const ascentM = Math.max(0, stage.ascentM ?? 0);

  return {
    name: stage.routeName,
    routeName: stage.routeName,
    routeIdentityKey: stableKey,
    routeId: stableKey,
    dataSource: "signature_challenge_db",
    routeDataStatus: distanceKm > 0 && ascentM > 0 ? "curated_complete" : "unavailable",
    confidence: "curated",
    elevation: ascentM,
    distance: distanceKm,
    routeDistance: distanceKm > 0 ? distanceKm : undefined,
    repeats: 1,
    totalElevation: ascentM,
    surface: "mixed",
    grade: stage.difficulty ?? "Hard",
    emoji: "⛰️",
    estimatedTime: stage.estimatedHours
      ? `${Math.floor(stage.estimatedHours)}h`
      : undefined,
  };
}

export function signatureStageTotals(stages: SignatureStageMetrics[]) {
  return stages.reduce(
    (totals, stage) => ({
      ascentM: totals.ascentM + Math.max(0, stage.ascentM ?? 0),
      distanceKm: totals.distanceKm + Math.max(0, stage.distanceKm ?? 0),
    }),
    { ascentM: 0, distanceKm: 0 },
  );
}