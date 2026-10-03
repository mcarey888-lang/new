import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@clerk/expo";
import { ChevronRight, Route } from "lucide-react-native";
import { BASECAMP, TYPE } from "@/constants/tokens";
import { describeRoute, listRoutes, type PlannedRoute } from "@/utils/plannedRouteApi";
import { FollowRouteButton } from "./FollowRouteButton";

export function SavedRoutesSection() {
  const { userId, isLoaded, getToken } = useAuth();
  const tokenGetter = useRef(getToken);
  tokenGetter.current = getToken;
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{
    owner: string; routes: PlannedRoute[]; error: string | null; loading: boolean;
  } | null>(null);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setResult(null);
    if (!isLoaded || !userId) return;
    const owner = userId;
    setResult({ owner, routes: [], error: null, loading: true });
    void listRoutes(() => tokenGetter.current()).then(response => {
      if (cancelled) return;
      setResult({
        owner, loading: false,
        routes: response.ok ? response.value : [],
        error: response.ok ? null : response.reason,
      });
    });
    return () => { cancelled = true; };
  }, [isLoaded, userId, retry]));

  const current = result?.owner === userId ? result : null;
  const openPlanner = (id?: string) => router.push({
    pathname: "/route-planner",
    params: id ? { plannedRouteId: id } : {},
  });

  return (
    <View style={styles.section} testID="track-saved-routes">
      <Text style={styles.kicker}>YOUR PERSONAL PLANS</Text>
      <View style={styles.heading}>
        <Text style={styles.title}>Saved routes</Text>
        <Pressable onPress={() => openPlanner()} accessibilityRole="button"
          accessibilityLabel="Plan a new route" style={styles.action}>
          <Text style={styles.actionText}>Plan a route</Text>
        </Pressable>
      </View>
      {!isLoaded || (userId && (!current || current.loading)) ? (
        <ActivityIndicator color={BASECAMP.accent} accessibilityLabel="Loading saved routes" />
      ) : !userId ? (
        <Text style={styles.message}>Sign in to see your saved routes.</Text>
      ) : current?.error ? (
        <View>
          <Text style={styles.message}>Could not load saved routes: {current.error}</Text>
          <Pressable onPress={() => setRetry(value => value + 1)}
            accessibilityRole="button" accessibilityLabel="Retry saved routes" style={styles.action}>
            <Text style={styles.actionText}>Try again</Text>
          </Pressable>
        </View>
      ) : !current?.routes.length ? (
        <Text style={styles.message}>No saved routes yet. Draw and save one in the planner.</Text>
      ) : current.routes.map(route => (
        <View key={route.id}>
        <Pressable onPress={() => openPlanner(route.id)}
          accessibilityRole="button" accessibilityLabel={`Open saved route: ${route.name}`}
          accessibilityHint="Opens your personal route in the map planner"
          testID={`track-saved-route-${route.id}`} style={styles.row}>
          <Route size={20} color={BASECAMP.accent} />
          <View style={styles.copy}>
            <Text style={styles.name} numberOfLines={2}>{route.name}</Text>
            <Text style={styles.meta}>{describeRoute(route)}</Text>
          </View>
          <ChevronRight size={18} color={BASECAMP.textMuted} />
        </Pressable>
        <FollowRouteButton route={route} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28, backgroundColor: BASECAMP.glass, padding: 14, borderRadius: 16 },
  kicker: { ...TYPE.eyebrow, color: BASECAMP.textDim, marginBottom: 7 },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  title: { ...TYPE.title, color: BASECAMP.text, fontSize: 21, flexShrink: 1 },
  action: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  actionText: { ...TYPE.caption, color: BASECAMP.accent },
  message: { ...TYPE.body, color: BASECAMP.textMuted, paddingVertical: 8 },
  row: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderColor: BASECAMP.hairline },
  copy: { flex: 1, minWidth: 0 },
  name: { ...TYPE.body, color: BASECAMP.textStrong, fontFamily: "Inter_600SemiBold" },
  meta: { ...TYPE.caption, color: BASECAMP.textMuted, marginTop: 4 },
});