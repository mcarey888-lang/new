/** Conservative GPS-only ascent. Raw fixes remain stored independently. */
export interface ElevationSample {
  alt: number | null;
  ts: number;
  altAcc?: number | null;
}

export interface RecordedElevationState {
  gain: number;
  loss: number;
  last: ElevationSample | null;
  window: number[];
  extreme: number | null;
  direction: "up" | "down" | null;
}

export function createRecordedElevation(gain = 0, loss = 0): RecordedElevationState {
  return { gain, loss, last: null, window: [], extreme: null, direction: null };
}

export function recordElevation(
  state: RecordedElevationState,
  sample: ElevationSample,
): RecordedElevationState {
  const { alt, ts, altAcc } = sample;
  if (alt == null || !Number.isFinite(alt) || !Number.isFinite(ts) ||
      alt < -500 || alt > 9000 ||
      (altAcc != null && (!Number.isFinite(altAcc) || altAcc < 0 || altAcc > 20))) {
    return state;
  }
  if (state.last && ts <= state.last.ts) return state;
  const gapSeconds = state.last ? (ts - state.last.ts) / 1000 : 0;
  // Never credit a jump across a GPS outage or a pause as climbing.
  if (!state.last || gapSeconds > 30) {
    return { ...state, last: sample, window: [alt], extreme: alt, direction: null };
  }
  // Reject sudden vertical jumps even when horizontal GPS looks good.
  if (Math.abs(alt - state.last.alt!) > Math.max(5, gapSeconds * 1.5)) return state;
  const window = [...state.window, alt].slice(-5);
  const sorted = [...window].sort((a, b) => a - b);
  const smooth = sorted[Math.floor(sorted.length / 2)];
  // A reversal must exceed three reported vertical-error radii; otherwise
  // ordinary satellite drift can repeatedly award both ascent and descent.
  const threshold = Math.max(8, (altAcc || 8) * 3, (state.last.altAcc || 8) * 3);
  let { gain, loss, extreme, direction } = state;
  extreme ??= smooth;
  if (direction === "up" && smooth > extreme) {
    gain += smooth - extreme;
    extreme = smooth;
  } else if (direction === "down" && smooth < extreme) {
    loss += extreme - smooth;
    extreme = smooth;
  } else if (smooth - extreme >= threshold) {
    gain += smooth - extreme;
    extreme = smooth;
    direction = "up";
  } else if (extreme - smooth >= threshold) {
    loss += extreme - smooth;
    extreme = smooth;
    direction = "down";
  }
  return { gain, loss, last: sample, window, extreme, direction };
}

/** Pausing breaks altitude continuity without resetting accumulated gain. */
export function breakElevationContinuity(state: RecordedElevationState): RecordedElevationState {
  return { ...state, last: null, window: [], extreme: null, direction: null };
}
