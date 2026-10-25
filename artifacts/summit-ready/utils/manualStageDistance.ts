import type { NearbyHill, Session } from "@/context/AppContext";
import { expeditionRouteIdentityMatches } from "./stateReliability";

/** Expedition catalogue distances describe the full route, not a one-way leg. */
export function manualStageDistance(
  stage: Pick<NearbyHill, "routeDistance" | "distance">, reps: number,
): number {
  const km = Number.isFinite(stage.routeDistance) && stage.routeDistance! > 0
    ? stage.routeDistance! : stage.distance;
  return Math.round(Math.max(0, km) * reps * 10) / 10;
}

/** Presentation-only repair for the exact legacy manual-log doubling bug.
 * Never infer GPS distance from a planned route or rewrite stored evidence. */
export function completedStageSessionDistance(session: Session, stages: NearbyHill[]): number {
  if (session.activityId || session.sourceHikeId || session.type !== "hill" ||
      !session.completed || !session.expeditionId || !session.hillName ||
      !Number.isInteger(session.reps) || session.reps! < 1 ||
      session.notes !== `${session.hillName} — ${session.reps} rep${session.reps !== 1 ? "s" : ""}`) {
    return session.distance;
  }
  const matches = stages.filter(stage => expeditionRouteIdentityMatches(stage, {
    ...session, name: session.hillName!,
  }));
  if (matches.length !== 1) return session.distance;
  const stage = matches[0]!;
  const oldDistance = Math.round(stage.distance * session.reps! * 2 * 10) / 10;
  return Math.abs(session.distance - oldDistance) < 0.001
    ? manualStageDistance(stage, session.reps!) : session.distance;
}
