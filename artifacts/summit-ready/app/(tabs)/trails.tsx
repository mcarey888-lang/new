import {
  Check, Radio, Minus, Plus, SlidersHorizontal, Search,
  AlertCircle, TrendingUp, MapPin, Repeat, BarChart2, CheckCircle,
  PlusCircle, RefreshCw, Zap, Lock, Map, Info, Mountain,
  Footprints, ChevronRight, Filter, ChevronDown,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { openMapsForHill } from "@/utils/openMaps";
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
import { useSubscription } from "@/lib/revenuecat";

const FREE_HILLS_LIMIT = 3;
const SUGGESTED_COUNT = 3;

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
const ELEV_STEPS = [0, 50, 100, 150, 200, 300, 400, 500, 600, 800];
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

export default function TrackScreen() {
  const insets = useSafeAreaInsets();
  const {
    summitGoal, trainingPlan, nearbyHills, hillsLoading, hillsError,
    fetchNearbyHills, myHills, addToMyHills, addToNearbyHills,
    appMode,
  } = useApp();

  const isExploreMode = appMode === "explore";
  const { isSubscribed } = useSubscription();

  const [localRadius, setLocalRadius] = useState(summitGoal?.maxRadius ?? 25);
  const [userChangedRadius, setUserChangedRadius] = useState(false);
  const [minElevation, setMinElevation] = useState(0);
  const [userChangedMinElev, setUserChangedMinElev] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("elevation");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [allHillsOpen, setAllHillsOpen] = useState(false);

  const [locText, setLocText] = useState(summitGoal?.location ?? "");
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const searchCardY = useRef<number>(0);

  const [searchText, setSearchText] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<NearbyHill | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchAdded, setSearchAdded] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (summitGoal?.location) setLocText(summitGoal.location);
  }, [summitGoal?.location]);

  useEffect(() => {
    if (!userChangedRadius && summitGoal?.maxRadius) setLocalRadius(summitGoal.maxRadius);
  }, [summitGoal?.maxRadius, userChangedRadius]);

  useEffect(() => {
    if (searchResult) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: searchCardY.current, animated: true });
      }, 100);
    }
  }, [searchResult]);

  const radiusChanged = userChangedRadius && localRadius !== (summitGoal?.maxRadius ?? 25);
  const settingsChanged = radiusChanged || (userChangedMinElev && minElevation !== 0);

  const currentWeek = trainingPlan.find(w => {
    const now = new Date();
    return new Date(w.startDate) <= now && new Date(w.endDate) >= now;
  });
  const weekTarget = currentWeek?.targetElevation ?? Math.round((summitGoal?.elevationGain ?? 1000) * 0.5);

  const suggestedHills = useMemo(
    () => sortHills(nearbyHills, "elevation").slice(0, SUGGESTED_COUNT),
    [nearbyHills]
  );
  const allSortedHills = useMemo(() => sortHills(nearbyHills, sortBy), [nearbyHills, sortBy]);

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

  function stepMinElev(dir: 1 | -1) {
    setUserChangedMinElev(true);
    const idx = ELEV_STEPS.indexOf(minElevation);
    if (idx === -1) {
      setMinElevation(0);
    } else {
      const next = idx + dir;
      if (next >= 0 && next < ELEV_STEPS.length) setMinElevation(ELEV_STEPS[next]);
    }
  }

  async function handleAddToMyHills(hill: NearbyHill) {
    await addToMyHills(hill);
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
      const res = await fetch(`${API_BASE}/hills-unified`, {
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
        ref={scrollRef}
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
            <Text style={styles.title}>Track</Text>
          </View>
        </Animated.View>

        {/* START HIKING Hero */}
        <Animated.View entering={FadeInDown.delay(40).duration(500)}>
          <TouchableOpacity
            onPress={() => router.push("/hike-tracking")}
            activeOpacity={0.88}
            style={styles.startHero}
          >
            <LinearGradient
              colors={["#1E8C4E", "#14703D"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.startHeroLeft}>
              <View style={styles.startHeroIconWrap}>
                <Footprints size={26} color="#fff" />
              </View>
              <View style={{ gap: 4 }}>
                <Text style={styles.startHeroTitle}>Start Hiking</Text>
                <Text style={styles.startHeroSub}>Track your route in real time</Text>
              </View>
            </View>
            <View style={styles.startHeroArrow}>
              <ChevronRight size={20} color="#fff" />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* SEARCH HILLS */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <View style={styles.sectionHeader}>
            <Search size={14} color={T.purple} />
            <Text style={styles.sectionTitle}>Search Hills</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View
            style={styles.searchCard}
            onLayout={e => { searchCardY.current = e.nativeEvent.layout.y; }}
          >
            <Text style={styles.searchHint}>Know a hill you want to train on? Search by name.</Text>
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
                  : <Search size={16} color={T.white} />}
              </TouchableOpacity>
            </View>

            {searchError && (
              <View style={styles.searchErrRow}>
                <AlertCircle size={13} color={T.red} />
                <Text style={styles.searchErrText}>{searchError}</Text>
              </View>
            )}

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
                  <View style={styles.searchStat}><TrendingUp size={11} color={T.orange} /><Text style={styles.searchStatVal}>{searchResult.elevation}m</Text><Text style={styles.searchStatLbl}>per rep</Text></View>
                  <View style={styles.searchStat}><MapPin size={11} color={T.green} /><Text style={styles.searchStatVal}>{searchResult.distance}km</Text><Text style={styles.searchStatLbl}>away</Text></View>
                  <View style={styles.searchStat}><Repeat size={11} color={T.textMuted} /><Text style={styles.searchStatVal}>{searchResult.repeats}×</Text><Text style={styles.searchStatLbl}>recs</Text></View>
                  <View style={styles.searchStat}><BarChart2 size={11} color={T.purple} /><Text style={styles.searchStatVal}>{searchResult.totalElevation}m</Text><Text style={styles.searchStatLbl}>total</Text></View>
                </View>
                <TouchableOpacity
                  onPress={handleAddSearchResult}
                  disabled={searchAdded}
                  style={[styles.searchAddBtn, searchAdded && { backgroundColor: T.greenDim, borderColor: T.green + "50" }]}
                  activeOpacity={0.75}
                >
                  {searchAdded ? <CheckCircle size={14} color={T.green} /> : <PlusCircle size={14} color={T.purple} />}
                  <Text style={[styles.searchAddText, searchAdded && { color: T.green }]}>
                    {searchAdded ? "Added to your hills!" : "Add to my hills"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>

        {/* FIND HILLS WITH AI (collapsible) */}
        <Animated.View entering={FadeInDown.delay(140).duration(400)}>
          <TouchableOpacity
            style={styles.findHillsToggle}
            activeOpacity={0.75}
            onPress={() => setFiltersOpen(v => !v)}
          >
            <View style={styles.findHillsToggleLeft}>
              <Filter size={14} color={T.green} />
              <Text style={styles.findHillsToggleText}>Find hills with AI</Text>
              {nearbyHills.length > 0 && (
                <View style={styles.hillCountBadge}>
                  <Text style={styles.hillCountText}>{nearbyHills.length}</Text>
                </View>
              )}
            </View>
            <ChevronDown size={14} color={T.textMuted} style={filtersOpen ? { transform: [{ rotate: "180deg" }] } : {}} />
          </TouchableOpacity>
        </Animated.View>

        {filtersOpen && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <View style={styles.controlCard}>
              <View style={styles.controlRow}>
                <View style={styles.controlLabelRow}>
                  <MapPin size={13} color={T.green} />
                  <Text style={styles.controlLabel}>Location</Text>
                </View>
                <TextInput
                  style={styles.inlineLocInput}
                  value={locText}
                  onChangeText={setLocText}
                  placeholder="Town, city or postcode…"
                  placeholderTextColor={T.textDim}
                  returnKeyType="search"
                  onSubmitEditing={() => fetchNearbyHills(localRadius, minElevation > 0 ? minElevation : undefined, locText.trim() || undefined)}
                  autoCorrect={false}
                />
              </View>

              <View style={styles.controlDivider} />

              <View style={styles.controlRow}>
                <View style={styles.controlLabelRow}>
                  <Radio size={13} color={T.green} />
                  <Text style={styles.controlLabel}>Search radius</Text>
                </View>
                <View style={styles.radiusStepper}>
                  <TouchableOpacity onPress={() => stepRadius(-1)} disabled={localRadius <= RADIUS_STEPS[0]} style={[styles.stepBtn, localRadius <= RADIUS_STEPS[0] && { opacity: 0.3 }]} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Minus size={14} color={T.white} />
                  </TouchableOpacity>
                  <View style={styles.radiusValueBox}>
                    <Text style={[styles.radiusValue, radiusChanged && { color: T.orange }]}>{localRadius}<Text style={styles.radiusUnit}> km</Text></Text>
                  </View>
                  <TouchableOpacity onPress={() => stepRadius(1)} disabled={localRadius >= RADIUS_STEPS[RADIUS_STEPS.length - 1]} style={[styles.stepBtn, localRadius >= RADIUS_STEPS[RADIUS_STEPS.length - 1] && { opacity: 0.3 }]} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Plus size={14} color={T.white} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.controlDivider} />

              <View style={styles.controlRow}>
                <View style={styles.controlLabelRow}>
                  <Mountain size={13} color={T.orange} />
                  <Text style={styles.controlLabel}>Min elevation</Text>
                </View>
                <View style={styles.radiusStepper}>
                  <TouchableOpacity onPress={() => stepMinElev(-1)} disabled={minElevation <= ELEV_STEPS[0]} style={[styles.stepBtn, minElevation <= ELEV_STEPS[0] && { opacity: 0.3 }]} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Minus size={14} color={T.white} />
                  </TouchableOpacity>
                  <View style={styles.radiusValueBox}>
                    {minElevation === 0 ? <Text style={styles.radiusValue}>Any</Text> : <Text style={[styles.radiusValue, { color: T.orange }]}>{minElevation}<Text style={styles.radiusUnit}>m+</Text></Text>}
                  </View>
                  <TouchableOpacity onPress={() => stepMinElev(1)} disabled={minElevation >= ELEV_STEPS[ELEV_STEPS.length - 1]} style={[styles.stepBtn, minElevation >= ELEV_STEPS[ELEV_STEPS.length - 1] && { opacity: 0.3 }]} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Plus size={14} color={T.white} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.controlDivider} />

              <View style={styles.controlRow}>
                <View style={styles.controlLabelRow}>
                  <SlidersHorizontal size={13} color={T.blue} />
                  <Text style={styles.controlLabel}>Sort by</Text>
                </View>
                <View style={styles.sortChips}>
                  {(["distance", "elevation", "popularity"] as SortKey[]).map(key => (
                    <TouchableOpacity key={key} onPress={() => setSortBy(key)} style={[styles.sortChip, sortBy === key && styles.sortChipActive]} activeOpacity={0.7}>
                      <Text style={[styles.sortChipText, sortBy === key && styles.sortChipTextActive]}>
                        {key === "distance" ? "Nearest" : key === "elevation" ? "Highest" : "Popular"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => fetchNearbyHills(localRadius, minElevation > 0 ? minElevation : undefined, locText.trim() || undefined)}
              disabled={hillsLoading}
              style={[styles.fetchBtn, hillsLoading && { opacity: 0.7 }]}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={settingsChanged ? [T.orangeDim, T.orangeDim] : nearbyHills.length > 0 ? [T.surface, T.surface] : [T.greenDim, T.greenDim]}
                style={styles.fetchBtnInner}
              >
                {hillsLoading ? (
                  <><ActivityIndicator size="small" color={T.green} /><Text style={styles.fetchBtnText}>Finding hills…</Text></>
                ) : settingsChanged ? (
                  <><Search size={15} color={T.orange} /><Text style={[styles.fetchBtnText, { color: T.orange }]}>Search {localRadius}km{minElevation > 0 ? ` · min ${minElevation}m` : ""}</Text></>
                ) : (
                  <>{nearbyHills.length > 0 ? <RefreshCw size={15} color={T.green} /> : <Zap size={15} color={T.green} />}<Text style={styles.fetchBtnText}>{nearbyHills.length > 0 ? "Refresh hills with AI" : "Find hills with AI"}</Text></>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {hillsError && !hillsLoading && (
              <View style={styles.hillsErrorRow}>
                <Text style={styles.hillsErrorText}>{hillsError}</Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* NEARBY HILLS */}
        <Animated.View entering={FadeInDown.delay(120).duration(400)}>
          <View style={styles.sectionHeader}>
            <Mountain size={14} color={T.orange} />
            <Text style={styles.sectionTitle}>Nearby Hills</Text>
            {nearbyHills.length > 0 && (
              <Text style={styles.sectionSub}>
                {nearbyHills.length} result{nearbyHills.length !== 1 ? "s" : ""}
              </Text>
            )}
          </View>
        </Animated.View>

        {/* Explore-mode carry-over nudge */}
        {isExploreMode && nearbyHills.length > 0 && (
          <Animated.View entering={FadeInDown.delay(130).duration(400)}>
            <View style={styles.carryOverBanner}>
              <Text style={styles.carryOverText}>
                💡 Your hills and hike log carry over automatically if you switch to Summit Training mode.
              </Text>
            </View>
          </Animated.View>
        )}

        {nearbyHills.length === 0 && !hillsLoading && (
          <Animated.View entering={FadeInDown.delay(140).duration(400)}>
            <View style={styles.noHillsCard}>
              <Text style={styles.noHillsText}>
                No hills yet. Search by name above, or use "Find hills with AI" to discover hills near you. Tap "Add to my hills" to save them to your Hills tab.
              </Text>
            </View>
          </Animated.View>
        )}

        {hillsLoading && (
          <Animated.View entering={FadeInDown.delay(140).duration(400)}>
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={T.green} />
              <Text style={styles.loadingText}>Finding hills near {summitGoal?.location ?? "you"}…</Text>
            </View>
          </Animated.View>
        )}

        {(isExploreMode ? allSortedHills : suggestedHills).map((hill, i) => {
          const total = hill.elevation * hill.repeats;
          const pct = Math.min(100, Math.round((total / weekTarget) * 100));
          const gc = GRADE_COLOR[hill.grade] ?? T.blue;
          const inMyHills = myHills.some(h => h.name === hill.name);
          const wasJustAdded = justAdded === hill.name;
          const isLocked = !isSubscribed && i >= FREE_HILLS_LIMIT;
          if (isLocked) return null;

          return (
            <Animated.View key={hill.name + i} entering={FadeInDown.delay(140 + i * 50).duration(400)}>
              <View style={styles.hillCard}>
                <LinearGradient colors={[gc + "08", "transparent"]} style={StyleSheet.absoluteFill} />
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
                    <MapPin size={12} color={T.green} />
                    <Text style={styles.hillStatVal}>{hill.distance}km</Text>
                    <Text style={styles.hillStatLbl}>away</Text>
                  </View>
                  <View style={styles.hillStat}>
                    <TrendingUp size={12} color={T.orange} />
                    <Text style={styles.hillStatVal}>{hill.elevation}m</Text>
                    <Text style={styles.hillStatLbl}>per climb</Text>
                  </View>
                  <View style={styles.hillStat}>
                    <Repeat size={12} color={T.textMuted} />
                    <Text style={styles.hillStatVal}>{hill.repeats}×</Text>
                    <Text style={styles.hillStatLbl}>repeats</Text>
                  </View>
                </View>

                {!isExploreMode && (
                  <>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: pct >= 80 ? T.green : T.orange }]} />
                    </View>
                    <Text style={styles.progressCaption}>{total}m total · {pct}% of this week's target</Text>
                  </>
                )}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.addPlanBtn, inMyHills && { backgroundColor: T.greenDim, borderColor: T.green + "50" }]}
                    activeOpacity={inMyHills ? 1 : 0.7}
                    onPress={() => !inMyHills && handleAddToMyHills(hill)}
                    disabled={inMyHills}
                  >
                    {wasJustAdded ? <CheckCircle size={14} color={T.green} /> : inMyHills ? <Check size={14} color={T.green} /> : <PlusCircle size={14} color={T.blue} />}
                    <Text style={[styles.addPlanText, inMyHills && { color: T.green }]}>
                      {wasJustAdded ? "Added!" : inMyHills ? "In my hills" : "Add to my hills"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.mapBtn, isExploreMode && { flex: 1, justifyContent: "center" }]}
                    activeOpacity={0.7}
                    onPress={() => openMapsForHill(hill.lat, hill.lng, hill.name)}
                  >
                    <Map size={14} color={T.green} />
                    <Text style={styles.mapBtnText}>Map</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.detailsBtn, isExploreMode && { flex: 1, justifyContent: "center" }]}
                    activeOpacity={0.7}
                    onPress={() =>
                      router.push({
                        pathname: "/hill-detail",
                        params: {
                          name: hill.name,
                          location: summitGoal?.location ?? "",
                          lat: hill.lat?.toString() ?? "",
                          lng: hill.lng?.toString() ?? "",
                          elevation: hill.elevation.toString(),
                          distance: hill.distance.toString(),
                          grade: hill.grade,
                          surface: hill.surface,
                          emoji: hill.emoji,
                        },
                      })
                    }
                  >
                    <Info size={14} color={T.purple} />
                    <Text style={styles.detailsBtnText}>Details</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          );
        })}

        {/* View all hills toggle — only needed in summit mode (explore shows all by default) */}
        {!isExploreMode && nearbyHills.length > SUGGESTED_COUNT && (
          <Animated.View entering={FadeInDown.delay(260).duration(400)}>
            <TouchableOpacity
              style={styles.viewAllBtn}
              activeOpacity={0.75}
              onPress={() => setAllHillsOpen(v => !v)}
            >
              <Text style={styles.viewAllText}>
                {allHillsOpen ? "Show less" : `View all ${nearbyHills.length} hills`}
              </Text>
              <ChevronDown size={14} color={T.blue} style={allHillsOpen ? { transform: [{ rotate: "180deg" }] } : {}} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {allHillsOpen && allSortedHills.slice(SUGGESTED_COUNT).map((hill, idx) => {
          const i = idx + SUGGESTED_COUNT;
          const total = hill.elevation * hill.repeats;
          const pct = Math.min(100, Math.round((total / weekTarget) * 100));
          const gc = GRADE_COLOR[hill.grade] ?? T.blue;
          const inMyHills = myHills.some(h => h.name === hill.name);
          const wasJustAdded = justAdded === hill.name;
          const isLocked = !isSubscribed && i >= FREE_HILLS_LIMIT;
          if (isLocked && i === FREE_HILLS_LIMIT) {
            return (
              <Animated.View key={i} entering={FadeInDown.delay(60).duration(400)}>
                <TouchableOpacity onPress={() => router.push("/paywall")} activeOpacity={0.85} style={styles.lockedCard}>
                  <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
                  <View style={styles.lockedIconWrap}><Lock size={22} color={T.green} /></View>
                  <Text style={styles.lockedTitle}>{nearbyHills.length - FREE_HILLS_LIMIT} more hills found nearby</Text>
                  <Text style={styles.lockedSub}>Upgrade to Summit Ready Pro to see all {nearbyHills.length} results.</Text>
                  <View style={styles.lockedBtn}><Zap size={13} color={T.bg} /><Text style={styles.lockedBtnText}>Unlock all hills</Text></View>
                </TouchableOpacity>
              </Animated.View>
            );
          }
          if (isLocked) return null;

          return (
            <Animated.View key={hill.name + i} entering={FadeInDown.delay(60 + idx * 40).duration(400)}>
              <View style={styles.hillCard}>
                <LinearGradient colors={[gc + "08", "transparent"]} style={StyleSheet.absoluteFill} />
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
                  <View style={styles.hillStat}><MapPin size={12} color={T.green} /><Text style={styles.hillStatVal}>{hill.distance}km</Text><Text style={styles.hillStatLbl}>away</Text></View>
                  <View style={styles.hillStat}><TrendingUp size={12} color={T.orange} /><Text style={styles.hillStatVal}>{hill.elevation}m</Text><Text style={styles.hillStatLbl}>per climb</Text></View>
                  <View style={styles.hillStat}><Repeat size={12} color={T.textMuted} /><Text style={styles.hillStatVal}>{hill.repeats}×</Text><Text style={styles.hillStatLbl}>repeats</Text></View>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: pct >= 80 ? T.green : T.orange }]} />
                </View>
                <Text style={styles.progressCaption}>{total}m total · {pct}% of this week's target</Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.addPlanBtn, inMyHills && { backgroundColor: T.greenDim, borderColor: T.green + "50" }]}
                    activeOpacity={inMyHills ? 1 : 0.7}
                    onPress={() => !inMyHills && handleAddToMyHills(hill)}
                    disabled={inMyHills}
                  >
                    {wasJustAdded ? <CheckCircle size={14} color={T.green} /> : inMyHills ? <Check size={14} color={T.green} /> : <PlusCircle size={14} color={T.blue} />}
                    <Text style={[styles.addPlanText, inMyHills && { color: T.green }]}>
                      {wasJustAdded ? "Added!" : inMyHills ? "In my hills" : "Add to my hills"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.mapBtn} activeOpacity={0.7} onPress={() => openMapsForHill(hill.lat, hill.lng, hill.name)}>
                    <Map size={14} color={T.green} /><Text style={styles.mapBtnText}>Map</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.detailsBtn}
                    activeOpacity={0.7}
                    onPress={() => router.push({ pathname: "/hill-detail", params: { name: hill.name, location: summitGoal?.location ?? "", lat: hill.lat?.toString() ?? "", lng: hill.lng?.toString() ?? "", elevation: hill.elevation.toString(), distance: hill.distance.toString(), grade: hill.grade, surface: hill.surface, emoji: hill.emoji } })}
                  >
                    <Info size={14} color={T.purple} /><Text style={styles.detailsBtnText}>Details</Text>
                  </TouchableOpacity>
                </View>
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

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.white },
  startHero: {
    borderRadius: 20, overflow: "hidden", marginBottom: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 18,
  },
  startHeroLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  startHeroIconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  startHeroTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  startHeroSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" },
  startHeroArrow: { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text, letterSpacing: 0.5, flex: 1 },
  sectionSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },

  emptyCard: { backgroundColor: T.card, borderRadius: 20, borderWidth: 1, borderColor: T.cardBorder, padding: 28, alignItems: "center", gap: 10, marginBottom: 16 },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.white },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 19 },

  inlineLocInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: T.text, textAlign: "right", paddingVertical: 2 },
  hillsErrorRow: { backgroundColor: "#FF444420", borderRadius: 10, borderWidth: 1, borderColor: "#FF444440", padding: 12, marginTop: 8 },
  hillsErrorText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#FF6B6B", lineHeight: 18, textAlign: "center" },

  noHillsCard: { backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.cardBorder, padding: 16, marginBottom: 12 },
  noHillsText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 19 },
  carryOverBanner: { backgroundColor: T.blueDim, borderRadius: 12, borderWidth: 1, borderColor: T.blue + "30", paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10 },
  carryOverText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.blue, lineHeight: 18 },

  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, marginBottom: 8 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },

  hillCard: { backgroundColor: T.card, borderRadius: 20, borderWidth: 1, borderColor: T.cardBorder, padding: 16, marginBottom: 12, overflow: "hidden", gap: 12 },
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
  progressTrack: { height: 5, backgroundColor: T.border, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 5, borderRadius: 3 },
  progressCaption: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: -4 },

  viewAllBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, marginBottom: 4 },
  viewAllText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.blue },

  actionRow: { flexDirection: "row", gap: 8 },
  addPlanBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: T.blue + "40", backgroundColor: T.blueDim },
  addPlanText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.blue },
  mapBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: T.green + "40" },
  mapBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.green },
  detailsBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: T.purple + "40", backgroundColor: T.purpleDim },
  detailsBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.purple },

  searchCard: { backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.purple + "35", overflow: "hidden", marginBottom: 12, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  searchHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 17 },
  searchRow: { flexDirection: "row", gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: T.white, backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border, paddingHorizontal: 14, paddingVertical: 10 },
  searchBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: T.purple, alignItems: "center", justifyContent: "center" },
  searchErrRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  searchErrText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.red, flex: 1 },
  searchResult: { borderRadius: 14, borderWidth: 1, borderColor: T.purple + "35", overflow: "hidden", padding: 12, gap: 10 },
  searchResultTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchResultEmoji: { fontSize: 22 },
  searchResultName: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white },
  searchResultSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  searchGradeBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  searchGradeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  searchResultStats: { flexDirection: "row", gap: 16 },
  searchStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  searchStatVal: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.white },
  searchStatLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  searchAddBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: T.purple + "50", backgroundColor: T.purpleDim },
  searchAddText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.purple },

  findHillsToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.green + "35", paddingHorizontal: 16, paddingVertical: 13, marginBottom: 10 },
  findHillsToggleLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  findHillsToggleText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.text },
  hillCountBadge: { backgroundColor: T.greenDim, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  hillCountText: { fontSize: 11, fontFamily: "Inter_700Bold", color: T.green },

  controlCard: { backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.cardBorder, overflow: "hidden", marginBottom: 10, paddingHorizontal: 16, paddingVertical: 14 },
  controlRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 40 },
  controlDivider: { height: 1, backgroundColor: T.border, marginVertical: 10 },
  controlLabelRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  controlLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.text },
  radiusStepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center" },
  radiusValueBox: { minWidth: 64, alignItems: "center" },
  radiusValue: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.white },
  radiusUnit: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  sortChips: { flexDirection: "row", gap: 6 },
  sortChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: T.border, backgroundColor: T.surface },
  sortChipActive: { borderColor: T.blue + "60", backgroundColor: T.blueDim },
  sortChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  sortChipTextActive: { color: T.blue },
  fetchBtn: { borderRadius: 14, overflow: "hidden", marginBottom: 14 },
  fetchBtnInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderWidth: 1, borderColor: T.green + "40", borderRadius: 14 },
  fetchBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.green },

  lockedCard: { borderRadius: 18, borderWidth: 1, borderColor: T.green + "40", backgroundColor: T.card, overflow: "hidden", alignItems: "center", padding: 24, gap: 10, marginBottom: 8 },
  lockedIconWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: T.greenDim, borderWidth: 1, borderColor: T.green + "50", alignItems: "center", justifyContent: "center" },
  lockedTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.white, textAlign: "center" },
  lockedSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 19 },
  lockedBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: T.green, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  lockedBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.bg },

});
