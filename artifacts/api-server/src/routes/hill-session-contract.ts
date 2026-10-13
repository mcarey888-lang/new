import { z } from "zod";
export const SaveTrackedSchema = z.object({
  activityId:z.string().min(8).max(128), plannedHillName:z.string(), plannedRouteName:z.string().optional(),
  hillId:z.number().int().optional(), routeId:z.number().int().optional(),
  trainingSessionId:z.string().optional(), trainingPlanId:z.string().optional(),
  targetReps:z.number().int().min(1).optional(), estimatedGainPerRepM:z.number().int().optional(),
  estimatedTotalGainM:z.number().int().optional(), occurredAt:z.coerce.date().optional(),
  recordedDistanceKm:z.number().nonnegative().optional(),
  recordedElevationGainM:z.number().int().nonnegative().optional(),
  recordedDurationSeconds:z.number().int().nonnegative().optional(),
  highestElevationM:z.number().optional(), lowestElevationM:z.number().optional(),
  rawGpsTrack:z.array(z.unknown()).max(100_000).optional(),
  elevationProfile:z.array(z.unknown()).max(100_000).optional(),
});
