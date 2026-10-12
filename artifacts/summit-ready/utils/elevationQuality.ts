import { createRecordedElevation, recordElevation, type ElevationSample } from "./recordedElevation";

export interface ElevationQuality {
  status: "reliable" | "partial" | "unavailable";
  accepted: number;
  total: number;
  gaps: number;
  missingAccuracy: number;
  rejected: number;
  label: string;
}

/** Coverage is separate from the filtered total. Zero is not proof of a flat walk. */
export function elevationQuality(points: Array<Omit<ElevationSample, "alt"|"ts"> & { alt?: number | null; ts?:number }>, expectedSeconds?:number): ElevationQuality {
  let state = createRecordedElevation();
  let accepted = 0, gaps = 0, missingAccuracy = 0;
  for (const p of points) {
    const next = recordElevation(state, { ...p, alt: p.alt ?? null, ts:p.ts??NaN });
    if (next.last !== state.last && next.last?.ts === p.ts) {
      accepted++;
      if (p.altAcc == null) missingAccuracy++;
      if (state.last && typeof p.ts==="number" && p.ts - state.last.ts > 30_000) gaps++;
    }
    state = next;
  }
  const total = points.length;
  const stamps=points.map(p=>p.ts).filter((ts):ts is number=>typeof ts==="number"&&Number.isFinite(ts));
  const coverage=expectedSeconds&&expectedSeconds>0&&stamps.length>1
    ? Math.max(0,(stamps[stamps.length-1]-stamps[0])/1000)/expectedSeconds : 1;
  const status = accepted < 2 || coverage<.1 ? "unavailable" :
    accepted / Math.max(total, 1) < 0.9 || coverage<.7 || gaps > 0 || missingAccuracy > 0 ? "partial" : "reliable";
  return {
    status, accepted, total, gaps, missingAccuracy, rejected: total - accepted,
    label: status === "unavailable" ? "Elevation unavailable — insufficient usable altitude readings" :
      status === "partial" ? "Partial GPS elevation estimate — gaps or uncertain altitude; small climbs may be omitted" :
      "Filtered GPS elevation estimate — small climbs may be omitted",
  };
}
