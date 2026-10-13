import { createRecordedElevation, recordElevation, type ElevationSample } from "./recordedElevation";
import type { RecordingEvent, RawRecordingFix } from "./recordingEvidence";

export interface ElevationQuality {
  status: "reliable" | "partial" | "unavailable";
  accepted: number;
  total: number;
  gaps: number;
  missingAccuracy: number;
  rejected: number;
  label: string;
  expectedSeconds?: number;
  coveredSeconds?: number;
}

/** Coverage is separate from the filtered total. Zero is not proof of a flat walk. */
export function elevationQuality(points: Array<Omit<ElevationSample, "alt"|"ts"> & { alt?: number | null; ts?:number }>, expectedSeconds?:number, events: RecordingEvent[] = []): ElevationQuality {
  let state = createRecordedElevation();
  let accepted = 0, gaps = 0, missingAccuracy = 0;
  let coveredSeconds = 0;
  const intervals: Array<[number,number]> = [];
  let start = -Infinity;
  for (const event of [...events].filter(e=>Number.isFinite(e.ts)).sort((a,b)=>a.ts-b.ts)) {
    if (event.type === "start" || event.type === "resume") start = event.ts;
    else if (Number.isFinite(start) || start === -Infinity) {
      intervals.push([start,event.ts]); start = NaN;
    }
  }
  if (!Number.isNaN(start)) intervals.push([start,Infinity]);
  let intervalCursor = 0;
  const activeOverlap = (from: number,to: number) => {
    while(intervalCursor<intervals.length && intervals[intervalCursor][1]<=from)intervalCursor++;
    let seconds=0;
    for(let i=intervalCursor;i<intervals.length&&intervals[i][0]<to;i++){
      const [a,b]=intervals[i];
      seconds+=Math.max(0,Math.min(to,b)-Math.max(from,a))/1000;
    }
    return seconds;
  };
  for (const p of points) {
    const next = recordElevation(state, { ...p, alt: p.alt ?? null, ts:p.ts??NaN });
    if (next.last !== state.last && next.last?.ts === p.ts) {
      accepted++;
      if (p.altAcc == null) missingAccuracy++;
      if (state.last && typeof p.ts==="number") {
        const delta = p.ts-state.last.ts;
        const activeSeconds = activeOverlap(state.last.ts,p.ts);
        if (delta > 0 && delta <= 30_000) coveredSeconds += activeSeconds;
        else if (activeSeconds > 30) gaps++;
      }
    }
    state = next;
  }
  const total = points.length;
  const knownDuration=typeof expectedSeconds==="number"&&Number.isFinite(expectedSeconds)&&expectedSeconds>0;
  const coverage=knownDuration?Math.min(1,coveredSeconds/expectedSeconds):null;
  const status = accepted < 2 || (coverage!==null && coverage<.1) ? "unavailable" :
    !knownDuration || accepted<10 || coveredSeconds<30 || accepted / Math.max(total, 1) < 0.9 || (coverage!==null&&coverage<.7) || gaps > 0 || missingAccuracy > 0 ? "partial" : "reliable";
  return {
    status, accepted, total, gaps, missingAccuracy, rejected: total - accepted,
    expectedSeconds:knownDuration?expectedSeconds:undefined, coveredSeconds,
    label: status === "unavailable" ? "Elevation unavailable — insufficient usable altitude readings" :
      status === "partial" ? "Partial GPS elevation estimate — gaps or uncertain altitude; small climbs may be omitted" :
      "Filtered GPS elevation estimate — small climbs may be omitted",
  };
}

/** Recompute from evidence, not a cached historical "reliable" badge. TimeTaken
 * is the legacy fallback only; new saves retain exact active recording seconds. */
export function recordedHikeElevationQuality(hike: {
  trackPoints?: Parameters<typeof elevationQuality>[0];
  rawGPSFixes?: RawRecordingFix[];
  recordingEvents?: RecordingEvent[];
  recordingDurationSeconds?: number;
  timeTaken?: number;
}): ElevationQuality {
  const points = hike.rawGPSFixes?.length ? hike.rawGPSFixes.filter(p=>p.acceptedForTrace) : hike.trackPoints??[];
  return elevationQuality(points,hike.recordingDurationSeconds??(hike.timeTaken!=null?hike.timeTaken*60:undefined),hike.recordingEvents);
}
