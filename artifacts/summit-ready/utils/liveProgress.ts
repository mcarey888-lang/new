/**
 * Expedition progress while a hike is still being recorded.
 *
 * The mountain fills as you climb, which means adding the ascent recorded so
 * far to what the expedition has already banked. That ascent has not been
 * credited yet — it is credited when the hike is saved — so the two are kept
 * apart in what the panel says, even though the artwork shows their sum. A
 * fill that only moves after you finish is not an elevation-driven fill, and
 * a caption that folds an uncredited figure into the banked one is a claim
 * the ledger has not agreed to.
 */

export interface LiveProgress {
  /** Metres the expedition had before this hike. */
  bankedM: number;
  /** Metres recorded in this hike so far, not yet credited. */
  liveM: number;
  /** What the artwork should fill to. */
  shownM: number;
  targetM: number;
  /** 0–1, clamped. The existing limit, kept. */
  percent: number;
  /** True once the sum reaches the target. */
  atTarget: boolean;
}

/** The two figures this needs, as the expedition presentation reports them. */
export interface BankedProgress {
  currentSimulatedElevationM: number;
  targetSimulatedElevationM: number;
}

export function liveProgress(
  presentation: BankedProgress,
  recordedGainM: number,
): LiveProgress {
  const banked = finite(presentation.currentSimulatedElevationM);
  const target = finite(presentation.targetSimulatedElevationM);
  const live = finite(recordedGainM);
  const shown = banked + live;
  /* Clamped, as the committed calculation is: an expedition does not go past
     its own summit because somebody kept walking. */
  const percent = target > 0 ? Math.min(1, shown / target) : 0;
  return {
    bankedM: banked,
    liveM: live,
    shownM: shown,
    targetM: target,
    percent,
    atTarget: target > 0 && shown >= target,
  };
}

/** What to say under the mountain. Null when there is nothing true to say. */
export function liveProgressCaption(progress: LiveProgress): string | null {
  if (progress.targetM <= 0) return null;
  const remaining = Math.max(0, Math.round(progress.targetM - progress.shownM));
  if (progress.liveM <= 0) {
    return remaining > 0
      ? `${Math.round(progress.bankedM)} m of ${Math.round(progress.targetM)} m · ${remaining} m to go`
      : `${Math.round(progress.targetM)} m of ${Math.round(progress.targetM)} m`;
  }
  /* The recorded part is named as this hike's and not yet counted, because
     it is not counted until the hike is saved. */
  const head = `${Math.round(progress.bankedM)} m banked · +${Math.round(progress.liveM)} m this hike`;
  return remaining > 0 ? `${head} · ${remaining} m to go` : `${head} · target reached`;
}

function finite(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}
