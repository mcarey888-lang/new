import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PlannedRoute } from "./plannedRouteApi";

export interface PersonalRouteHandoff {
  ownerUserId: string;
  savedAt: number;
  route: Pick<PlannedRoute, "id" | "name" | "geometry" | "lengthM" | "ascentM" | "fullySnapped">;
}

const key = (owner: string, id: string) =>
  `personal-route-handoff:${encodeURIComponent(owner)}:${encodeURIComponent(id)}`;

export function validPersonalRouteHandoff(
  value: unknown, ownerUserId: string, routeId?: string,
): value is PersonalRouteHandoff {
  if (!ownerUserId || !value || typeof value !== "object") return false;
  const context = value as PersonalRouteHandoff;
  const route = context.route;
  return context.ownerUserId === ownerUserId && Number.isFinite(context.savedAt) &&
    !!route && typeof route.id === "string" && !!route.id &&
    (!routeId || route.id === routeId) &&
    typeof route.name === "string" && !!route.name.trim() &&
    Number.isFinite(route.lengthM) && route.lengthM >= 0 &&
    (route.ascentM === null || (Number.isFinite(route.ascentM) && route.ascentM >= 0)) &&
    typeof route.fullySnapped === "boolean" &&
    Array.isArray(route.geometry) && route.geometry.length >= 2 &&
    route.geometry.every(point => point && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 &&
      Number.isFinite(point.lng) && Math.abs(point.lng) <= 180);
}

export function personalRouteHandoff(ownerUserId: string, route: PlannedRoute): PersonalRouteHandoff {
  const context: PersonalRouteHandoff = {
    ownerUserId, savedAt: Date.now(),
    route: {
      id: route.id, name: route.name, geometry: route.geometry,
      lengthM: route.lengthM, ascentM: route.ascentM, fullySnapped: route.fullySnapped,
    },
  };
  if (!validPersonalRouteHandoff(context, ownerUserId, route.id)) {
    throw new Error("This saved route has no usable geometry. Open it in the planner and save it again.");
  }
  return context;
}

export async function savePersonalRouteHandoff(context: PersonalRouteHandoff): Promise<void> {
  if (!validPersonalRouteHandoff(context, context.ownerUserId)) throw new Error("Invalid personal route.");
  await AsyncStorage.setItem(key(context.ownerUserId, context.route.id), JSON.stringify(context));
}

export async function readPersonalRouteHandoff(owner: string, id: string): Promise<PersonalRouteHandoff | null> {
  try {
    const raw = await AsyncStorage.getItem(key(owner, id));
    const context: unknown = raw ? JSON.parse(raw) : null;
    return validPersonalRouteHandoff(context, owner, id) &&
      Date.now() - context.savedAt <= 30 * 60 * 1000 ? context : null;
  } catch {
    return null;
  }
}

export function personalRouteTrackingParams(context: PersonalRouteHandoff) {
  return {
    trackingMode: "freehike" as const,
    plannedRouteId: context.route.id,
    plannedRouteName: context.route.name,
  };
}