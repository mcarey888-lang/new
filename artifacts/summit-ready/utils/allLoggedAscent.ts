export interface LoggedSessionAscent {
  id: string;
  activityId?: string;
  completed: boolean;
  elevationGain: number;
}

export interface LoggedHikeAscent {
  id: string;
  activityId?: string;
  elevationGain: number;
}

export type AllLoggedAscent =
  | { status: "available"; ascentM: number }
  | { status: "unavailable"; reason: "incomplete_activity_data" };

/**
 * Totals completed local training sessions and logged hikes. A shared
 * activityId is the canonical identity when a tracked hike is also surfaced
 * as a completed training session; otherwise each local record remains
 * independently countable.
 */
export function calculateAllLoggedAscent(
  sessions: readonly LoggedSessionAscent[],
  hikes: readonly LoggedHikeAscent[],
): AllLoggedAscent {
  const seen = new Set<string>();
  let ascentM = 0;

  // Prefer the logged hike's recorded ascent when it is also represented as
  // a session. This preserves GPS-recorded ascent rather than a plan estimate.
  const activities: Array<{
    kind: "hike" | "session";
    id: string;
    activityId?: string;
    elevationGain: number;
  }> = [
    ...hikes.map((hike) => ({ ...hike, kind: "hike" as const })),
    ...sessions
      .filter((session) => session.completed)
      .map((session) => ({ ...session, kind: "session" as const })),
  ];

  for (const activity of activities) {
    const identity = activity.activityId
      ? `activity:${activity.activityId}`
      : `${activity.kind}:${activity.id}`;
    if (seen.has(identity)) continue;
    seen.add(identity);

    if (!Number.isFinite(activity.elevationGain) || activity.elevationGain < 0) {
      return { status: "unavailable", reason: "incomplete_activity_data" };
    }
    ascentM += activity.elevationGain;
  }

  return { status: "available", ascentM };
}