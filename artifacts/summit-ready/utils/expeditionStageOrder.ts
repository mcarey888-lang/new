import type { NearbyHill } from "../context/AppContext";
import { isRouteCompleted, routeCompletionKey } from "./stateReliability";

/** Match persisted identities, never stage numbers or a potentially duplicate name. */
export function findExpeditionStage(hills: readonly NearbyHill[], key: string): NearbyHill | null {
  const matches = hills.filter(hill => routeCompletionKey(hill) === key);
  return matches.length === 1 ? matches[0] : null;
}

/** Move only unfinished stages. Completed slots, hill facts and identities survive unchanged. */
export function chooseNextExpeditionStage(
  hills: readonly NearbyHill[],
  completedRoutes: readonly string[],
  key: string,
): NearbyHill[] | null {
  const completed = [...completedRoutes];
  const selected = findExpeditionStage(hills, key);
  if (!selected || isRouteCompleted(completed, selected)) return null;
  const unfinished = hills.filter(hill => !isRouteCompleted(completed, hill));
  const reordered = [selected, ...unfinished.filter(hill => hill !== selected)];
  let next = 0;
  return hills.map(hill => isRouteCompleted(completed, hill) ? hill : reordered[next++]);
}
