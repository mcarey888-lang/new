/**
 * Device-local, self-reported ascent. This never changes the server's
 * evidence-qualified credit ledger or awards verified activity credit.
 */
export interface ManualBankSession {
  id: string;
  activityId?: string;
  sourceHikeId?: string;
  completed: boolean;
  elevationGain: number;
  date: string;
  type: string;
  hillName?: string;
  distance: number;
}

export interface ManualBankHike {
  id: string;
  activityId?: string;
  elevationGain: number;
  date: string;
  name: string;
  distance: number;
  notes?: string;
  trackPoints?: readonly { lat: number; lon: number }[];
}

export type ManualBankAscent =
  | { status: "available"; lifetimeM: number; monthM: number; activities: number }
  | { status: "unavailable" };

const day = (date: string) => date.slice(0, 10);

export function calculateManualBankAscent(
  sessions: readonly ManualBankSession[],
  hikes: readonly ManualBankHike[],
  now = new Date(),
): ManualBankAscent {
  const currentMonth = now.toISOString().slice(0, 7);
  const manualHikes = hikes.filter(hike =>
    (!hike.trackPoints || hike.trackPoints.length === 0)
    && !hike.notes?.startsWith("GPS tracked hike.")
    && !hike.activityId,
  );
  const pairedSessions = new Set<string>();
  let lifetimeM = 0;
  let monthM = 0;
  let activities = 0;

  function add(elevationGain: number, date: string): boolean {
    if (!Number.isFinite(elevationGain) || elevationGain < 0) return false;
    const metres = Math.round(elevationGain);
    lifetimeM += metres;
    if (day(date).slice(0, 7) === currentMonth) monthM += metres;
    activities += 1;
    return true;
  }

  for (const hike of manualHikes) {
    if (!add(hike.elevationGain, hike.date)) return { status: "unavailable" };
    // The Log a Session modal also saves the hike as a completed training
    // session. Old records lack the shared activityId, so pair exact copies.
    const paired = sessions.find(session =>
      session.completed && !pairedSessions.has(session.id)
      && (session.sourceHikeId === hike.id
        || (!session.activityId && session.type === "bigDay"
          && day(session.date) === day(hike.date)
          && session.hillName === hike.name
          && session.distance === hike.distance
          && session.elevationGain === hike.elevationGain)),
    );
    if (paired) pairedSessions.add(paired.id);
  }

  for (const session of sessions) {
    // GPS activities have a separate recorded-evidence pipeline. Plan entries
    // copied from a hike and sessions not yet completed are not new ascent.
    if (!session.completed || session.activityId || pairedSessions.has(session.id)) continue;
    if (!add(session.elevationGain, session.date)) return { status: "unavailable" };
  }

  return { status: "available", lifetimeM, monthM, activities };
}