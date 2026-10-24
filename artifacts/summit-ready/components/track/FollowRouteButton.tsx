import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { BASECAMP, TYPE } from "@/constants/tokens";
import type { PlannedRoute } from "@/utils/plannedRouteApi";

/** Following a plan opens its map; it must not create or replace a recording. */
export function FollowRouteButton({ route, onFollow }: {
  route: PlannedRoute;
  onFollow?: (route: PlannedRoute) => void;
}) {
  const follow = () => {
    if (onFollow) {
      onFollow(route);
      return;
    }
    // A saved-route list outside the map opens the same planner experience.
    router.push({ pathname: "/route-planner", params: { plannedRouteId: route.id } });
  };
  return (
    <Pressable onPress={follow} style={styles.button}
      accessibilityRole="button" accessibilityLabel={`Follow saved route: ${route.name}`}
      testID={`follow-saved-route-${route.id}`}>
      <Text style={styles.label}>Follow route</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 8, justifyContent: "center" },
  label: { ...TYPE.body, color: BASECAMP.accent, fontFamily: "Inter_600SemiBold" },
});
