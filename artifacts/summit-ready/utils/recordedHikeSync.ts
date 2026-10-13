import type { ExploreHike } from "@/context/AppContext";
import { enqueueSyncPending } from "./syncOutbox";
import { privateRecordedHikeBackup } from "./recordedHikeRecovery";
import { activityApiBase } from "./activityServiceOrigin";
import { recordedHikeElevationQuality } from "./elevationQuality";
export async function queueRecordedHikeSync(owner: string,hike: ExploreHike) {
  await enqueueSyncPending(owner,{id:`private-hike:${hike.id}`,kind:"private-hike",method:"PUT",
    url:`${activityApiBase}/recorded-hikes`,body:privateRecordedHikeBackup(hike)});
  const quality=recordedHikeElevationQuality(hike);
  await enqueueSyncPending(owner,{id:`canonical-activity:${hike.id}`,kind:"canonical-activity",method:"POST",
    url:`${activityApiBase}/explore-hike/canonicalize`,body:{
      exploreHikeId:hike.id,occurredAt:hike.date,activityKind:"hiking",
      durationSeconds:Math.round(hike.recordingDurationSeconds??hike.timeTaken*60),distanceKm:hike.distance,recordedAscentM:Math.round(hike.elevationGain),
      evidenceClassification:!(hike.trackPoints?.length)?"estimated_manual":quality.status==="reliable"?"gps_recorded":"unavailable_untrusted",
      sourceSnapshot:{recordingId:hike.id,elevationQuality:quality,source:"user_recording"},
      ...(hike.expeditionId?{explicitLinks:[{linkType:"expedition",targetId:hike.expeditionId}]}:{}),
    }});
}
