import type { RecordedHikePoint } from "./recordedHikeRecovery";

export interface RawRecordingFix extends RecordedHikePoint {
  ts: number;
  source: "foreground" | "background";
  acceptedForTrace: boolean;
}
export interface RecordingEvent {
  type: "start" | "pause" | "resume" | "finish";
  ts: number;
}
/** Identity is independent of callback order. Evidence never substitutes for
 * the filtered navigable line or changes the release's elevation algorithm. */
export function rawFixKey(fix: RecordedHikePoint): string {
  return `${fix.ts}:${fix.lat}:${fix.lon}:${fix.alt}:${fix.acc}:${fix.altAcc}`;
}
export function appendRawFix(
  fixes: RawRecordingFix[], seen: Set<string>, fix: RawRecordingFix,
): boolean {
  const key = rawFixKey(fix);
  if (seen.has(key)) return false;
  seen.add(key);
  fixes.push({ ...fix });
  return true;
}
