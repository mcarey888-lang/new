import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@clerk/expo";
import { BASECAMP, TYPE } from "@/constants/tokens";
import type { PlannedRoute } from "@/utils/plannedRouteApi";
import { readActiveHike } from "@/utils/activeHikeSession";
import type { HikeCheckpoint } from "@/utils/hikeReliability";
import {
  personalRouteHandoff, personalRouteTrackingParams, savePersonalRouteHandoff,
} from "@/utils/personalRouteHandoff";

export function FollowRouteButton({ route }: { route: PlannedRoute }) {
  const { userId } = useAuth();
  const currentOwner = useRef(userId);
  currentOwner.current = userId;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const follow = async () => {
    if (busy) return;
    setError(null);
    setActiveId(null);
    if (!userId) { setError("Sign in to follow your saved route."); return; }
    const owner = userId;
    setBusy(true);
    try {
      const active = await readActiveHike<HikeCheckpoint>(owner);
      if (currentOwner.current !== owner) return;
      if (active) {
        setActiveId(active.routeId);
        setError("Finish or resume your current hike before starting another.");
        return;
      }
      const context = personalRouteHandoff(owner, route);
      await savePersonalRouteHandoff(context);
      if (currentOwner.current !== owner) return;
      router.push({ pathname: "/hike-tracking", params: personalRouteTrackingParams(context) });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not prepare this route. Try again.");
    } finally { setBusy(false); }
  };

  return (
    <View>
      <Pressable onPress={follow} disabled={busy} style={styles.button}
        accessibilityRole="button" accessibilityLabel={`Follow saved route: ${route.name}`}
        testID={`follow-saved-route-${route.id}`}>
        <Text style={styles.label}>{busy ? "Preparing route…" : "Follow route"}</Text>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
      {activeId && <Pressable style={styles.button} accessibilityRole="button"
        accessibilityLabel="Resume current hike"
        onPress={() => router.push({ pathname: "/hike-tracking", params: { restore: "1", routeId: activeId } })}>
        <Text style={styles.label}>Resume current hike</Text>
      </Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 8, justifyContent: "center" },
  label: { ...TYPE.body, color: BASECAMP.accent, fontFamily: "Inter_600SemiBold" },
  error: { ...TYPE.caption, color: BASECAMP.textMuted, maxWidth: 340 },
});