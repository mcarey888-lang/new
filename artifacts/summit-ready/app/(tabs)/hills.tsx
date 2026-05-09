import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Linking } from "react-native";
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
    sorted.sort((a, b) => {
      const gs = (GRADE_SCORE[b.grade] ?? 3) - (GRADE_SCORE[a.grade] ?? 3);
      return gs !== 0 ? gs : a.distance - b.distance;
    });
  }
  return sorted;
}

export default function HillsScreen() {
  const insets = useSafeAreaInsets();
  const {
    summitGoal, trainingPlan, nearbyHills, hillsLoading,
    fetchNearbyHills, hillsInPlan, addHillToPlan, addToNearbyHills, updateGoalLocation,
  } = useApp();

  const [localRadius, setLocalRadius] = useState(summitGoal?.maxRadius ?? 25);
  const [userChangedRadius, setUserChangedRadius] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("distance");

  const [editingLoc, setEditingLoc] = useState(false);
  const [locText, setLocText] = useState(summitGoal?.location ?? "");
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const locInputRef = useRef<TextInput>(null);

  // Hill search state
  const [searchText, setSearchText] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<NearbyHill | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchAdded, setSearchAdded] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // Sync location text when goal loads
  useEffect(() => {
    if (summitGoal?.location && !editingLoc) {
      setLocText(summitGoal.location);
    }
  }, [summitGoal?.location]);

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

  function startEditLoc() {
    setLocText(summitGoal?.location ?? "");
    setEditingLoc(true);
    setTimeout(() => locInputRef.current?.focus(), 80);
  }

  async function confirmLoc() {
    const trimmed = locText.trim();
    if (trimmed.length >= 2) {
      await updateGoalLocation(trimmed);
      setEditingLoc(false);
      // Auto-fetch with new location
      await fetchNearbyHills(localRadius);
    } else {
      setEditingLoc(false);
      setLocText(summitGoal?.location ?? "");
    }
  }

  function cancelLoc() {
    setEditingLoc(false);
    setLocText(summitGoal?.location ?? "");
  }

  async function handleAddToPlan(hill: NearbyHill) {
    await addHillToPlan(hill);
    setJustAdded(hill.name);
    setTimeout(() => setJustAdded(null), 2000);
  }

  async function handleHillSearch() {
    const query = searchText.trim();
    if (query.length < 2) return;
    setSearchLoading(true);
    setSearchResult(null);
    setSearchError(null);
    setSearchAdded(false);
    try {
      const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
        : "/api";
      const res = await fetch(`${API_BASE}/hills-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hillName: query, location: summitGoal?.location ?? "" }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json() as { hill: NearbyHill };
      setSearchResult(data.hill);
    } catch {
      setSearchError("Couldn't find that hill — try a different name or spelling.");
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleAddSearchResult() {
    if (!searchResult) return;
    await addToNearbyHills(searchResult);
    setSearchAdded(true);
  }

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Platform.OS === "web" ? 56 : insets.top + 16,
            paddingBottom: Platform.OS === "web" ? 110 : insets.bottom + 130,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Nearby Hills</Text>

            {/* Editable location */}
            {editingLoc ? (
              <View style={styles.locEditRow}>
                <TextInput
                  ref={locInputRef}
                  style={styles.locInput}
                  value={locText}
                  onChangeText={setLocText}
                  placeholderTextColor={T.textMuted}
                  placeholder="City, Country"
                  returnKeyType="done"
                  onSubmitEditing={confirmLoc}
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={confirmLoc} style={styles.locActionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="check" size={16} color={T.green} />
                </TouchableOpacity>
                <TouchableOpacity onPress={cancelLoc} style={styles.locActionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="x" size={16} color={T.textMuted} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={startEditLoc} style={styles.locRow} activeOpacity={0.7}>
                <Text style={styles.subtitle}>
                  {summitGoal ? summitGoal.location : "Tap to set location"}
                </Text>
                <Feather name="edit-2" size={12} color={T.textMuted} style={{ marginTop: 1 }} />
              </TouchableOpacity>
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

        {/* Radius + Sort Controls */}
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

            <View style={styles.controlDivider} />

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
                    style={[styles.sortChip, sortBy === key && styles.sortChipActive]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.sortChipText, sortBy === key && styles.sortChipTextActive]}>
                      {key === "distance" ? "Distance" : key === "elevation" ? "Elevation" : "Popularity"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Hill Search */}
        <Animated.View entering={FadeInDown.delay(90).duration(400)}>
          <View style={styles.searchCard}>
            <View style={styles.searchLabelRow}>
              <Feather name="search" size={13} color={T.purple} />
              <Text style={styles.searchLabel}>Search for a specific hill</Text>
            </View>
            <Text style={styles.searchHint}>Know a hill you want to train on? Search for it by name.</Text>
            <View style={styles.searchRow}>
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                value={searchText}
                onChangeText={t => { setSearchText(t); setSearchResult(null); setSearchError(null); setSearchAdded(false); }}
                placeholder="e.g. Pendle Hill, Ben Nevis…"
                placeholderTextColor={T.textDim}
                returnKeyType="search"
                onSubmitEditing={handleHillSearch}
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={handleHillSearch}
                disabled={searchLoading || searchText.trim().length < 2}
                style={[styles.searchBtn, (searchLoading || searchText.trim().length < 2) && { opacity: 0.45 }]}
                activeOpacity={0.75}
              >
                {searchLoading
                  ? <ActivityIndicator size="small" color={T.white} />
                  : <Feather name="search" size={16} color={T.white} />}
              </TouchableOpacity>
            </View>

            {/* Error */}
            {searchError && (
              <View style={styles.searchErrRow}>
                <Feather name="alert-circle" size={13} color={T.red} />
                <Text style={styles.searchErrText}>{searchError}</Text>
              </View>
            )}

            {/* Result preview */}
            {searchResult && (
              <View style={styles.searchResult}>
                <LinearGradient colors={[T.purpleDim, "transparent"]} style={StyleSheet.absoluteFill} />
                <View style={styles.searchResultTop}>
                  <Text style={styles.searchResultEmoji}>{searchResult.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultName}>{searchResult.name}</Text>
                    <Text style={styles.searchResultSub}>{searchResult.surface}</Text>
                  </View>
                  <View style={[styles.searchGradeBadge, { backgroundColor: (GRADE_COLOR[searchResult.grade] ?? T.blue) + "25" }]}>
                    <Text style={[styles.searchGradeText, { color: GRADE_COLOR[searchResult.grade] ?? T.blue }]}>{searchResult.grade}</Text>
                  </View>
                </View>
                <View style={styles.searchResultStats}>
                  <View style={styles.searchStat}>
                    <Feather name="trending-up" size={11} color={T.orange} />
                    <Text style={styles.searchStatVal}>{searchResult.elevation}m</Text>
                    <Text style={styles.searchStatLbl}>per rep</Text>
                  </View>
                  <View style={styles.searchStat}>
                    <Feather name="map-pin" size={11} color={T.green} />
                    <Text style={styles.searchStatVal}>{searchResult.distance}km</Text>
                    <Text style={styles.searchStatLbl}>away</Text>
                  </View>
                  <View style={styles.searchStat}>
                    <Feather name="repeat" size={11} color={T.textMuted} />
                    <Text style={styles.searchStatVal}>{searchResult.repeats}×</Text>
                    <Text style={styles.searchStatLbl}>recs</Text>
                  </View>
                  <View style={styles.searchStat}>
                    <Feather name="bar-chart-2" size={11} color={T.purple} />
                    <Text style={styles.searchStatVal}>{searchResult.totalElevation}m</Text>
                    <Text style={styles.searchStatLbl}>total</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={handleAddSearchResult}
                  disabled={searchAdded}
                  style={[styles.searchAddBtn, searchAdded && { backgroundColor: T.greenDim, borderColor: T.green + "50" }]}
                  activeOpacity={0.75}
                >
                  <Feather name={searchAdded ? "check-circle" : "plus-circle"} size={14} color={searchAdded ? T.green : T.purple} />
                  <Text style={[styles.searchAddText, searchAdded && { color: T.green }]}>
                    {searchAdded ? "Added to your hills!" : "Add to my hills"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
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
                  <Text style={[styles.fetchBtnText, { color: T.orange }]}>Search {localRadius}km radius</Text>
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
          const inPlan = hillsInPlan.includes(hill.name);
          const wasJustAdded = justAdded === hill.name;

          return (
            <Animated.View key={i} entering={FadeInDown.delay(120 + i * 60).duration(400)}>
              <View style={styles.hillCard}>
                <LinearGradient colors={[gc + "08", "transparent"]} style={StyleSheet.absoluteFill} />

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

                {/* Action buttons */}
                <View style={styles.actionRow}>
                  {/* Add to Plan */}
                  <TouchableOpacity
                    style={[
                      styles.addPlanBtn,
                      inPlan && { backgroundColor: T.greenDim, borderColor: T.green + "50" },
                      wasJustAdded && { backgroundColor: T.green + "25" },
                    ]}
                    activeOpacity={inPlan ? 1 : 0.7}
                    onPress={() => !inPlan && handleAddToPlan(hill)}
                    disabled={inPlan}
                  >
                    <Feather
                      name={wasJustAdded ? "check-circle" : inPlan ? "check" : "plus-circle"}
                      size={14}
                      color={inPlan ? T.green : T.blue}
                    />
                    <Text style={[styles.addPlanText, inPlan && { color: T.green }]}>
                      {wasJustAdded ? "Added!" : inPlan ? "In your plan" : "Add to plan"}
                    </Text>
                  </TouchableOpacity>

                  {/* Map link */}
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
                    <Text style={styles.mapBtnText}>Map</Text>
                  </TouchableOpacity>
                </View>

                {/* Plan impact note */}
                {wasJustAdded && (
                  <View style={styles.impactNote}>
                    <Feather name="zap" size={12} color={T.green} />
                    <Text style={styles.impactText}>
                      Plan updated — hill sessions recalculated for {hill.name}
                    </Text>
                  </View>
                )}
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
  locRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },
  locEditRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  locInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.white,
    backgroundColor: T.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.green + "50",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  locActionBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
  },
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
  sortChipActive: { borderColor: T.blue + "60", backgroundColor: T.blueDim },
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

  actionRow: { flexDirection: "row", gap: 8 },
  addPlanBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.blue + "40",
    backgroundColor: T.blueDim,
  },
  addPlanText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.blue },
  mapBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.green + "40",
  },
  mapBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.green },

  impactNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: T.greenDim,
    borderRadius: 10,
    marginTop: -4,
  },
  impactText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.green, flex: 1 },

  searchCard: {
    backgroundColor: T.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.purple + "35",
    overflow: "hidden",
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  searchLabelRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  searchLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.text },
  searchHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 17, marginTop: -4 },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.white,
    backgroundColor: T.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.purple + "40",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchBtn: {
    width: 42, height: 42,
    borderRadius: 12,
    backgroundColor: T.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  searchErrRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  searchErrText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.red, flex: 1 },
  searchResult: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.purple + "40",
    overflow: "hidden",
    padding: 12,
    gap: 10,
  },
  searchResultTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchResultEmoji: { fontSize: 24 },
  searchResultName: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white },
  searchResultSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  searchGradeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  searchGradeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  searchResultStats: { flexDirection: "row", gap: 12 },
  searchStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  searchStatVal: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.white },
  searchStatLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim },
  searchAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.purple + "50",
    backgroundColor: T.purpleDim,
  },
  searchAddText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.purple },
});
