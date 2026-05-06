import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Linking } from "react-native";
import React, { useState, useMemo, useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp, NearbyHill } from "@/context/AppContext";
import { T } from "@/constants/theme";

const GRADE_COLOR: Record<string, string> = {
  "Easy": T.green,
  "Easy–Mod": T.green,
  "Moderate": T.blue,
  "Hard": T.orange,
  "Alpine": "#FF4444",
};

const GRADE_SCORE: Record<string, number> = {
  "Easy": 5,
  "Easy–Mod": 4,
  "Moderate": 3,
  "Hard": 2,
  "Alpine": 1,
};

const RADIUS_STEPS = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
type SortKey = "distance" | "elevation" | "popularity";

function sortHills(hills: NearbyHill[], by: SortKey): NearbyHill[] {
  const sorted = [...hills];
  if (by === "distance") {
    sorted.sort((a, b) => a.distance - b.distance);
  } else if (by === "elevation") {
    sorted.sort((a, b) => b.elevation - a.elevation);
  } else {
    // popularity: higher grade score = more accessible = more popular, then closer first
    sorted.sort((a, b) => {
      const gs = (GRADE_SCORE[b.grade] ?? 3) - (GRADE_SCORE[a.grade] ?? 3);
      return gs !== 0 ? gs : a.distance - b.distance;
    });
  }
  return sorted;
}

export default function HillsScreen() {
  const insets = useSafeAreaInsets();
  const { summitGoal, trainingPlan, nearbyHills, hillsLoading, fetchNearbyHills } = useApp();

  const [localRadius, setLocalRadius] = useState(summitGoal?.maxRadius ?? 25);
  const [userChangedRadius, setUserChangedRadius] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("distance");

  // Sync radius once the goal loads from storage (only if user hasn't manually changed it)
  useEffect(() => {
    if (!userChangedRadius && summitGoal?.maxRadius) {
      setLocalRadius(summitGoal.maxRadius);
    }
  }, [summitGoal?.maxRadius, userChangedRadius]);

  const radiusChanged = userChangedRadius && localRadius !== (summitGoal?.maxRadius ?? 25);

  const targetElev = summitGoal?.elevationGain ?? 1000;
  const currentWeek = trainingPlan.find(w => {
    const now = new Date();
    return new Date(w.startDate) <= now && new Date(w.endDate) >= now;
  });
  const weekTarget = currentWeek?.targetElevation ?? Math.round(targetElev * 0.5);

  const displayedHills = useMemo(() => sortHills(nearbyHills, sortBy), [nearbyHills, sortBy]);

  function stepRadius(dir: 1 | -1) {
    setUserChangedRadius(true);
    const idx = RADIUS_STEPS.indexOf(localRadius);
    if (idx === -1) {
      const nearest = RADIUS_STEPS.reduce((p, c) =>
        Math.abs(c - localRadius) < Math.abs(p - localRadius) ? c : p
      );
      setLocalRadius(nearest);
    } else {
      const next = idx + dir;
      if (next >= 0 && next < RADIUS_STEPS.length) setLocalRadius(RADIUS_STEPS[next]);
    }
  }

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Platform.OS === "web" ? 56 : insets.top + 16,
            paddingBottom: Platform.OS === "web" ? 50 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <View>
            <Text style={styles.title}>Nearby Hills</Text>
            {summitGoal && (
              <Text style={styles.subtitle}>Near {summitGoal.location}</Text>
            )}
          </View>
        </Animated.View>

        {/* Stats Context */}
        <Animated.View entering={FadeInDown.delay(60).duration(400)}>
          <View style={styles.ctxCard}>
            <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
            <View style={styles.ctxRow}>
              <View style={styles.ctxItem}>
                <Text style={styles.ctxVal}>{weekTarget}m</Text>
                <Text style={styles.ctxLbl}>This week target</Text>
              </View>
              <View style={styles.ctxDivider} />
              <View style={styles.ctxItem}>
                <Text style={styles.ctxVal}>{targetElev}m</Text>
                <Text style={styles.ctxLbl}>Summit goal</Text>
              </View>
              <View style={styles.ctxDivider} />
              <View style={styles.ctxItem}>
                <Text style={styles.ctxVal}>{nearbyHills.length}</Text>
                <Text style={styles.ctxLbl}>Hills found</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Radius Selector */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <View style={styles.controlCard}>
            <View style={styles.controlRow}>
              <View style={styles.controlLabelRow}>
                <Feather name="radio" size={13} color={T.green} />
                <Text style={styles.controlLabel}>Search radius</Text>
              </View>
              <View style={styles.radiusStepper}>
                <TouchableOpacity
                  onPress={() => stepRadius(-1)}
                  disabled={localRadius <= RADIUS_STEPS[0]}
                  style={[styles.stepBtn, localRadius <= RADIUS_STEPS[0] && { opacity: 0.3 }]}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="minus" size={14} color={T.white} />
                </TouchableOpacity>
                <View style={styles.radiusValueBox}>
                  <Text style={[styles.radiusValue, radiusChanged && { color: T.orange }]}>
                    {localRadius}
                    <Text style={styles.radiusUnit}> km</Text>
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => stepRadius(1)}
                  disabled={localRadius >= RADIUS_STEPS[RADIUS_STEPS.length - 1]}
                  style={[styles.stepBtn, localRadius >= RADIUS_STEPS[RADIUS_STEPS.length - 1] && { opacity: 0.3 }]}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="plus" size={14} color={T.white} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.controlDivider} />

            {/* Sort by */}
            <View style={styles.controlRow}>
              <View style={styles.controlLabelRow}>
                <Feather name="sliders" size={13} color={T.blue} />
                <Text style={styles.controlLabel}>Sort by</Text>
              </View>
              <View style={styles.sortChips}>
                {(["distance", "elevation", "popularity"] as SortKey[]).map(key => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setSortBy(key)}
                    style={[
                      styles.sortChip,
                      sortBy === key && styles.sortChipActive,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.sortChipText,
                      sortBy === key && styles.sortChipTextActive,
                    ]}>
                      {key === "distance" ? "Distance" : key === "elevation" ? "Elevation" : "Popularity"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Fetch / Refresh button */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <TouchableOpacity
            onPress={() => fetchNearbyHills(localRadius)}
            disabled={hillsLoading}
            style={[styles.fetchBtn, hillsLoading && { opacity: 0.7 }]}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={radiusChanged ? [T.orangeDim, T.orangeDim] : nearbyHills.length > 0 ? [T.surface, T.surface] : [T.greenDim, T.greenDim]}
              style={styles.fetchBtnInner}
            >
              {hillsLoading ? (
                <>
                  <ActivityIndicator size="small" color={T.green} />
                  <Text style={styles.fetchBtnText}>Finding hills within {localRadius}km…</Text>
                </>
              ) : radiusChanged ? (
                <>
                  <Feather name="search" size={15} color={T.orange} />
                  <Text style={[styles.fetchBtnText, { color: T.orange }]}>
                    Search {localRadius}km radius
                  </Text>
                </>
              ) : (
                <>
                  <Feather name={nearbyHills.length > 0 ? "refresh-cw" : "zap"} size={15} color={T.green} />
                  <Text style={styles.fetchBtnText}>
                    {nearbyHills.length > 0 ? "Refresh hills with AI" : "Find hills with AI"}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Empty state */}
        {nearbyHills.length === 0 && !hillsLoading && (
          <Animated.View entering={FadeInDown.delay(120).duration(400)}>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🏔️</Text>
              <Text style={styles.emptyTitle}>No hills loaded yet</Text>
              <Text style={styles.emptyText}>
                Tap "Find hills with AI" above and we'll find real training hills near {summitGoal?.location ?? "your location"}.
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Hill Cards */}
        {displayedHills.map((hill, i) => {
          const total = hill.elevation * hill.repeats;
          const pct = Math.min(100, Math.round((total / weekTarget) * 100));
          const gc = GRADE_COLOR[hill.grade] ?? T.blue;

          return (
            <Animated.View key={i} entering={FadeInDown.delay(120 + i * 60).duration(400)}>
              <View style={styles.hillCard}>
                <LinearGradient colors={[gc + "08", "transparent"]} style={StyleSheet.absoluteFill} />

                {/* Sort indicator badge */}
                {sortBy === "distance" && (
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>#{i + 1} closest</Text>
                  </View>
                )}
                {sortBy === "elevation" && (
                  <View style={[styles.rankBadge, { backgroundColor: T.orangeDim }]}>
                    <Text style={[styles.rankText, { color: T.orange }]}>#{i + 1} highest</Text>
                  </View>
                )}
                {sortBy === "popularity" && i === 0 && (
                  <View style={[styles.rankBadge, { backgroundColor: T.purpleDim }]}>
                    <Text style={[styles.rankText, { color: T.purple }]}>Most popular</Text>
                  </View>
                )}

                <View style={styles.hillTop}>
                  <View style={[styles.hillIconBox, { backgroundColor: gc + "18" }]}>
                    <Text style={styles.hillEmoji}>{hill.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hillName}>{hill.name}</Text>
                    <Text style={styles.hillSurface}>{hill.surface}</Text>
                  </View>
                  <View style={[styles.gradeBadge, { backgroundColor: gc + "20" }]}>
                    <Text style={[styles.gradeText, { color: gc }]}>{hill.grade}</Text>
                  </View>
                </View>

                <View style={styles.hillStats}>
                  <View style={styles.hillStat}>
                    <Feather name="map-pin" size={12} color={T.green} />
                    <Text style={styles.hillStatVal}>{hill.distance}km</Text>
                    <Text style={styles.hillStatLbl}>away</Text>
                  </View>
                  <View style={styles.hillStat}>
                    <Feather name="trending-up" size={12} color={T.orange} />
                    <Text style={styles.hillStatVal}>{hill.elevation}m</Text>
                    <Text style={styles.hillStatLbl}>per climb</Text>
                  </View>
                  <View style={styles.hillStat}>
                    <Feather name="repeat" size={12} color={T.textMuted} />
                    <Text style={styles.hillStatVal}>{hill.repeats}×</Text>
                    <Text style={styles.hillStatLbl}>repeats</Text>
                  </View>
                </View>

                <View style={styles.repeatBox}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={styles.repeatTitle}>
                      {hill.repeats}× repeats = {total}m total elevation
                    </Text>
                    <Text style={[styles.pctText, { color: pct >= 80 ? T.green : T.orange }]}>{pct}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${pct}%` as any, backgroundColor: pct >= 80 ? T.green : T.orange },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressCaption}>of this week's elevation target</Text>
                </View>

                <TouchableOpacity
                  style={styles.mapBtn}
                  activeOpacity={0.7}
                  onPress={() =>
                    Linking.openURL(
                      `https://www.openstreetmap.org/search?query=${encodeURIComponent(hill.name)}`
                    )
                  }
                >
                  <Feather name="map" size={14} color={T.green} />
                  <Text style={styles.mapBtnText}>View on map</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.white },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },
  ctxCard: {
    backgroundColor: T.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.green + "30",
    overflow: "hidden",
    marginBottom: 12,
  },
  ctxRow: { flexDirection: "row", paddingVertical: 14 },
  ctxItem: { flex: 1, alignItems: "center", gap: 3 },
  ctxVal: { fontSize: 19, fontFamily: "Inter_700Bold", color: T.white },
  ctxLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" },
  ctxDivider: { width: 1, backgroundColor: T.border, marginVertical: 4 },

  controlCard: {
    backgroundColor: T.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.cardBorder,
    overflow: "hidden",
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 0,
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 40,
  },
  controlDivider: { height: 1, backgroundColor: T.border, marginVertical: 12 },
  controlLabelRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  controlLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.text },

  radiusStepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radiusValueBox: { minWidth: 64, alignItems: "center" },
  radiusValue: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.white },
  radiusUnit: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },

  sortChips: { flexDirection: "row", gap: 6 },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  sortChipActive: {
    borderColor: T.blue + "60",
    backgroundColor: T.blueDim,
  },
  sortChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  sortChipTextActive: { color: T.blue },

  fetchBtn: { borderRadius: 14, overflow: "hidden", marginBottom: 14 },
  fetchBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: T.green + "40",
    borderRadius: 14,
  },
  fetchBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.green },
  emptyCard: {
    backgroundColor: T.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.cardBorder,
    padding: 32,
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.white },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 20 },
  hillCard: {
    backgroundColor: T.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.cardBorder,
    padding: 16,
    marginBottom: 12,
    overflow: "hidden",
    gap: 12,
  },
  rankBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: T.greenDim,
    marginBottom: -4,
  },
  rankText: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.green, letterSpacing: 0.5 },
  hillTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  hillIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  hillEmoji: { fontSize: 22 },
  hillName: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 2 },
  hillSurface: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  gradeBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 },
  gradeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  hillStats: { flexDirection: "row", gap: 16 },
  hillStat: { flexDirection: "row", alignItems: "center", gap: 5 },
  hillStatVal: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white },
  hillStatLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  repeatBox: {
    backgroundColor: T.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: T.border,
  },
  repeatTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.text },
  pctText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  progressTrack: { height: 6, backgroundColor: T.border, borderRadius: 3, overflow: "hidden", marginBottom: 5 },
  progressFill: { height: 6, borderRadius: 3 },
  progressCaption: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  mapBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.green + "40",
  },
  mapBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.green },
});
