import type { NearbyHill } from "../context/AppContext";

/** Use the same identity and route facts as Explore, including on older plans. */
export function hillDetailNavigation(hill: NearbyHill, location: string) {
  return {
    pathname: "/hill-detail" as const,
    params: {
      name: hill.name,
      routeIdentityKey: hill.routeIdentityKey ?? "",
      summitIdentityKey: hill.summitIdentityKey ?? "",
      location,
      lat: hill.lat?.toString() ?? "",
      lng: hill.lng?.toString() ?? "",
      elevation: hill.elevation.toString(),
      distance: hill.distance.toString(),
      routeDistance: hill.routeDistance?.toString() ?? "",
      estimatedTime: hill.estimatedTime ?? "",
      routeType: hill.routeType ?? "",
      grade: hill.grade,
      surface: hill.surface,
      emoji: hill.emoji,
    },
  };
}
