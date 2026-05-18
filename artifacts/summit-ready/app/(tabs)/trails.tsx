import {
  AlertCircle,
  BarChart2,
  Check,
  CheckCircle,
  ChevronRight,
  Compass,
  Info,
  Lock,
  Map,
  MapPin,
  Minus,
  Mountain,
  Pencil,
  Plus,
  PlusCircle,
  Radio,
  RefreshCw,
  Repeat,
  Search,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { openMapsForHill } from "@/utils/openMaps";
import {
  ActivityIndicator,
  Alert,
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
import { useApp, type ExploreHike, type NearbyHill } from "@/context/AppContext";
import { T } from "@/constants/theme";
import { useSubscription } from "@/lib/revenuecat";
import { LogHikeModal } from "@/components/LogHikeModal";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FREE_HILLS_LIMIT = 3;

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
const ELEV_STEPS   = [0, 50, 100, 150, 200, 300, 400, 500, 600, 800];

type SortKey = "distance" | "elevation" | "popularity";
type FilterChip = "all" | "hikes" | "hills";

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

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function CategoryCard({
  emoji, title, subtitle, color, onPress, badge,
}: {
  emoji: string; title: string; subtitle: string;
  color: string; onPress: () => void; badge?: number;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={cc.card} activeOpacity={0.82}>
      <LinearGradient
        colors={[color + "14", "transparent"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />
      <View style={[cc.iconBox, { backgroundColor: color + "22" }]}>
        <Text style={cc.emoji}>{emoji}</Text>
      </View>
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text style={cc.title} numberOfLines={1}>{title}</Text>
        <Text style={cc.subtitle} numberOfLines={1}>
          {badge != null && badge > 0 ? `${badge} ${subtitle}` : subtitle}
        </Text>
      </View>
      {badge != null && badge > 0 && (
        <View style={[cc.badge, { backgroundColor: color + "22" }]}>
          <Text style={[cc.badgeText, { color }]}>{badge}</Text>
        </View>
      )}
      <ChevronRight size={15} color={T.textDim} />
    </TouchableOpacity>
  );
}

const cc = StyleSheet.create({
  card: {
    backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border,
    padding: 14, flexDirection: "row", alignItems: "center", gap: 10,
    overflow: "hidden", minHeight: 72,
  },
  iconBox: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  emoji: { fontSize: 18 },
  title: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  badgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
});

function LoggedHikeRow({ hike, onDelete }: { hike: ExploreHike; onDelete: (id: string) => void }) {
  const dateStr = new Date(hike.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return (
    <View style={lh.row}>
      <View style={lh.iconWrap}><Map size={14} color={T.green} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={lh.name}>{hike.name}</Text>
        <View style={lh.meta}>
          <Text style={lh.dim}>{dateStr}</Text>
          <Text style={lh.dot}>·</Text>
          <Text style={lh.dim}>{hike.distance}km</Text>
          <Text style={lh.dot}>·</Text>
          <Text style={lh.dim}>{hike.elevationGain}m gain</Text>
          <Text style={lh.dot}>·</Text>
          <Text style={lh.dim}>{hike.timeTaken}min</Text>
        </View>
        {!!hike.notes && <Text style={lh.notes}>{hike.notes}</Text>}
      </View>
      <TouchableOpacity
        onPress={() => {
          if (Platform.OS === "web") { onDelete(hike.id); return; }
          Alert.alert("Delete session?", "This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => onDelete(hike.id) },
          ]);
        }}
        style={lh.delBtn} hitSlop={8}
      >
        <Trash2 size={14} color={T.red} />
      </TouchableOpacity>
    </View>
  );
}

const lh = StyleSheet.create({
  row: {
    backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.border,
    padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 12,
  },
  iconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: T.greenDim, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  name: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },
  meta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
  dim: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  dot: { fontSize: 12, color: T.textDim },
  notes: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, fontStyle: "italic" },
  delBtn: { padding: 4, flexShrink: 0 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function TrailsScreen() {
  const insets = useSafeAreaInsets();
  const {
    appMode,
    exploreHikes, deleteExploreHike,
    savedTrailIds, completedTrailIds, customRoutes,
    summitGoal, trainingPlan, nearbyHills, hillsLoading,
    fetchNearbyHills, hillsInPlan, addHillToPlan, addToNearbyHills, updateGoalLocation,
  } = useApp();
  const { isSubscribed } = useSubscription();

  const isSummit = appMode === "summit";

  // Default chip: summit users land on hills, explore users land on all
  const [activeChip, setActiveChip] = useState<FilterChip>(isSummit ? "hills" : "all");
  const [logVisible, setLogVisible] = useState(false);

  // Hills state
  const [localRadius, setLocalRadius] = useState(summitGoal?.maxRadius ?? 25);
  const [userChangedRadius, setUserChangedRadius] = useState(false);
  const [minElevation, setMinElevation] = useState(0);
  const [userChangedMinElev, setUserChangedMinElev] = useState(false);
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

  useEffect(() => {
    if (summitGoal?.location && !editingLoc) setLocText(summitGoal.location);
  }, [summitGoal?.location]);

  useEffect(() => {
    if (!userChangedRadius && summitGoal?.maxRadius) setLocalRadius(summitGoal.maxRadius);
  }, [summitGoal?.maxRadius, userChangedRadius]);

  // Update chip default when mode changes
  useEffect(() => {
    setActiveChip(isSummit ? "hills" : "all");
  }, [isSummit]);

  const radiusChanged = userChangedRadius && localRadius !== (summitGoal?.maxRadius ?? 25);
  const settingsChanged = radiusChanged || (userChangedMinElev && minElevation !== 0);

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
      setLocalRadius(RADIUS_STEPS.reduce((p, c) => Math.abs(c - localRadius) < Math.abs(p - localRadius) ? c : p));
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

  async function confirmLoc() {
    const trimmed = locText.trim();
    if (trimmed.length >= 2) {
      await updateGoalLocation(trimmed);
      setEditingLoc(false);
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

  // ── Hikes section ────────────────────────────────────────────────────────

  function HikesSection() {
    return (
      <View style={{ gap: 10 }}>
        <CategoryCard
          emoji="🗺️" title="Browse Trails" subtitle="Explore routes near you"
          color={T.blue} onPress={() => router.push("/trail-list")}
        />
        <CategoryCard
          emoji="🔖" title="Saved Routes" subtitle="Trails you've bookmarked"
          color={T.blue} badge={savedTrailIds.length}
          onPress={() => router.push("/trails-saved")}
        />
        <CategoryCard
          emoji="✅" title="Completed Trails" subtitle="Trails you've finished"
          color={T.green} badge={completedTrailIds.length}
          onPress={() => router.push("/trails-completed")}
        />
        <TouchableOpacity style={s.createCard} onPress={() => router.push("/trails-create")} activeOpacity={0.82}>
          <LinearGradient
            colors={[T.purple + "14", "transparent"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          />
          <View style={[s.createIcon, { backgroundColor: T.purple + "22" }]}>
            <Pencil size={18} color={T.purple} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.createTitle}>Create My Own Route</Text>
            <Text style={s.createSubtitle}>
              {customRoutes.length > 0
                ? `${customRoutes.length} custom route${customRoutes.length !== 1 ? "s" : ""} saved`
                : "Add a personalised trail to your library"}
            </Text>
          </View>
          <ChevronRight size={16} color={T.textDim} />
        </TouchableOpacity>
      </View>
    );
  }

  // ── Hills section ────────────────────────────────────────────────────────

  function HillsSection() {
    return (
      <View style={{ gap: 0 }}>
        {/* Location header */}
        <View style={s.hillsHeader}>
          <View style={{ flex: 1 }}>
            {editingLoc ? (
              <View style={s.locEditRow}>
                <TextInput
                  ref={locInputRef}
                  style={s.locInput}
                  value={locText}
                  onChangeText={setLocText}
                  placeholderTextColor={T.textMuted}
                  placeholder="City, Country"
                  returnKeyType="done"
                  onSubmitEditing={confirmLoc}
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={confirmLoc} style={s.locActionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Check size={16} color={T.green} />
                </TouchableOpacity>
                <TouchableOpacity onPress={cancelLoc} style={s.locActionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={16} color={T.textMuted} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => { setLocText(summitGoal?.location ?? ""); setEditingLoc(true); setTimeout(() => locInputRef.current?.focus(), 80); }}
                style={s.locRow} activeOpacity={0.7}
              >
                <MapPin size={12} color={T.textMuted} />
                <Text style={s.locText}>
                  {summitGoal ? summitGoal.location : "Tap to set location"}
                </Text>
                <Pencil size={11} color={T.textMuted} style={{ marginTop: 1 }} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stats context */}
        <View style={s.ctxCard}>
          <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
          <View style={s.ctxRow}>
            <View style={s.ctxItem}>
              <Text style={s.ctxVal}>{weekTarget}m</Text>
              <Text style={s.ctxLbl}>This week target</Text>
            </View>
            <View style={s.ctxDivider} />
            <View style={s.ctxItem}>
              <Text style={s.ctxVal}>{targetElev}m</Text>
              <Text style={s.ctxLbl}>Summit goal</Text>
            </View>
            <View style={s.ctxDivider} />
            <View style={s.ctxItem}>
              <Text style={s.ctxVal}>{nearbyHills.length}</Text>
              <Text style={s.ctxLbl}>Hills found</Text>
            </View>
          </View>
        </View>

        {/* Controls */}
        <View style={s.controlCard}>
          <View style={s.controlRow}>
            <View style={s.controlLabelRow}>
              <Radio size={13} color={T.green} />
              <Text style={s.controlLabel}>Search radius</Text>
            </View>
            <View style={s.stepper}>
              <TouchableOpacity onPress={() => stepRadius(-1)} disabled={localRadius <= RADIUS_STEPS[0]}
                style={[s.stepBtn, localRadius <= RADIUS_STEPS[0] && { opacity: 0.3 }]} activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Minus size={14} color={T.white} />
              </TouchableOpacity>
              <View style={s.stepValBox}>
                <Text style={[s.stepVal, radiusChanged && { color: T.orange }]}>
                  {localRadius}<Text style={s.stepUnit}> km</Text>
                </Text>
              </View>
              <TouchableOpacity onPress={() => stepRadius(1)} disabled={localRadius >= RADIUS_STEPS[RADIUS_STEPS.length - 1]}
                style={[s.stepBtn, localRadius >= RADIUS_STEPS[RADIUS_STEPS.length - 1] && { opacity: 0.3 }]} activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Plus size={14} color={T.white} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.controlDivider} />

          <View style={s.controlRow}>
            <View style={s.controlLabelRow}>
              <Mountain size={13} color={T.orange} />
              <Text style={s.controlLabel}>Min elevation</Text>
            </View>
            <View style={s.stepper}>
              <TouchableOpacity onPress={() => stepMinElev(-1)} disabled={minElevation <= ELEV_STEPS[0]}
                style={[s.stepBtn, minElevation <= ELEV_STEPS[0] && { opacity: 0.3 }]} activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Minus size={14} color={T.white} />
              </TouchableOpacity>
              <View style={s.stepValBox}>
                {minElevation === 0
                  ? <Text style={s.stepVal}>Any</Text>
                  : <Text style={[s.stepVal, { color: T.orange }]}>{minElevation}<Text style={s.stepUnit}>m+</Text></Text>
                }
              </View>
              <TouchableOpacity onPress={() => stepMinElev(1)} disabled={minElevation >= ELEV_STEPS[ELEV_STEPS.length - 1]}
                style={[s.stepBtn, minElevation >= ELEV_STEPS[ELEV_STEPS.length - 1] && { opacity: 0.3 }]} activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Plus size={14} color={T.white} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.controlDivider} />

          <View style={s.controlRow}>
            <View style={s.controlLabelRow}>
              <SlidersHorizontal size={13} color={T.blue} />
              <Text style={s.controlLabel}>Sort by</Text>
            </View>
            <View style={s.sortChips}>
              {(["distance", "elevation", "popularity"] as SortKey[]).map(key => (
                <TouchableOpacity key={key} onPress={() => setSortBy(key)}
                  style={[s.sortChip, sortBy === key && s.sortChipActive]} activeOpacity={0.7}>
                  <Text style={[s.sortChipText, sortBy === key && s.sortChipTextActive]}>
                    {key === "distance" ? "Distance" : key === "elevation" ? "Elevation" : "Popularity"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Hill search */}
        <View style={s.searchCard}>
          <View style={s.searchLabelRow}>
            <Search size={13} color={T.purple} />
            <Text style={s.searchLabel}>Search for a specific hill</Text>
          </View>
          <Text style={s.searchHint}>Know a hill you want to train on? Search for it by name.</Text>
          <View style={s.searchRow}>
            <TextInput
              ref={searchInputRef}
              style={s.searchInput}
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
              style={[s.searchBtn, (searchLoading || searchText.trim().length < 2) && { opacity: 0.45 }]}
              activeOpacity={0.75}
            >
              {searchLoading ? <ActivityIndicator size="small" color={T.white} /> : <Search size={16} color={T.white} />}
            </TouchableOpacity>
          </View>

          {searchError && (
            <View style={s.searchErrRow}>
              <AlertCircle size={13} color={T.red} />
              <Text style={s.searchErrText}>{searchError}</Text>
            </View>
          )}

          {searchResult && (
            <View style={s.searchResult}>
              <LinearGradient colors={[T.purpleDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <View style={s.searchResultTop}>
                <Text style={s.searchResultEmoji}>{searchResult.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.searchResultName}>{searchResult.name}</Text>
                  <Text style={s.searchResultSub}>{searchResult.surface}</Text>
                </View>
                <View style={[s.searchGradeBadge, { backgroundColor: (GRADE_COLOR[searchResult.grade] ?? T.blue) + "25" }]}>
                  <Text style={[s.searchGradeText, { color: GRADE_COLOR[searchResult.grade] ?? T.blue }]}>{searchResult.grade}</Text>
                </View>
              </View>
              <View style={s.searchResultStats}>
                <View style={s.searchStat}><TrendingUp size={11} color={T.orange} /><Text style={s.searchStatVal}>{searchResult.elevation}m</Text><Text style={s.searchStatLbl}>per rep</Text></View>
                <View style={s.searchStat}><MapPin size={11} color={T.green} /><Text style={s.searchStatVal}>{searchResult.distance}km</Text><Text style={s.searchStatLbl}>away</Text></View>
                <View style={s.searchStat}><Repeat size={11} color={T.textMuted} /><Text style={s.searchStatVal}>{searchResult.repeats}×</Text><Text style={s.searchStatLbl}>recs</Text></View>
                <View style={s.searchStat}><BarChart2 size={11} color={T.purple} /><Text style={s.searchStatVal}>{searchResult.totalElevation}m</Text><Text style={s.searchStatLbl}>total</Text></View>
              </View>
              <TouchableOpacity
                onPress={handleAddSearchResult} disabled={searchAdded}
                style={[s.searchAddBtn, searchAdded && { backgroundColor: T.greenDim, borderColor: T.green + "50" }]}
                activeOpacity={0.75}
              >
                {searchAdded ? <CheckCircle size={14} color={T.green} /> : <PlusCircle size={14} color={T.purple} />}
                <Text style={[s.searchAddText, searchAdded && { color: T.green }]}>
                  {searchAdded ? "Added to your hills!" : "Add to my hills"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Fetch button */}
        <TouchableOpacity
          onPress={() => fetchNearbyHills(localRadius, minElevation > 0 ? minElevation : undefined)}
          disabled={hillsLoading}
          style={[s.fetchBtn, hillsLoading && { opacity: 0.7 }]}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={settingsChanged ? [T.orangeDim, T.orangeDim] : nearbyHills.length > 0 ? [T.surface, T.surface] : [T.greenDim, T.greenDim]}
            style={s.fetchBtnInner}
          >
            {hillsLoading ? (
              <><ActivityIndicator size="small" color={T.green} /><Text style={s.fetchBtnText}>Finding hills…</Text></>
            ) : settingsChanged ? (
              <><Search size={15} color={T.orange} /><Text style={[s.fetchBtnText, { color: T.orange }]}>Search {localRadius}km{minElevation > 0 ? ` · min ${minElevation}m` : ""}</Text></>
            ) : (
              <>{nearbyHills.length > 0 ? <RefreshCw size={15} color={T.green} /> : <Zap size={15} color={T.green} />}
                <Text style={s.fetchBtnText}>{nearbyHills.length > 0 ? "Refresh hills with AI" : "Find hills with AI"}</Text></>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Outside-radius notice */}
        {minElevation > 0 && nearbyHills.length > 0 && nearbyHills.some(h => h.distance > localRadius) && (
          <View style={s.outsideRadiusNote}>
            <Info size={13} color={T.orange} />
            <Text style={s.outsideRadiusText}>
              Some results are beyond {localRadius}km — no {minElevation}m+ hills were found closer.
            </Text>
          </View>
        )}

        {/* Empty state */}
        {nearbyHills.length === 0 && !hillsLoading && (
          <View style={s.emptyCard}>
            <Text style={s.emptyEmoji}>🏔️</Text>
            <Text style={s.emptyTitle}>No hills loaded yet</Text>
            <Text style={s.emptyText}>
              Tap "Find hills with AI" above to find real training hills near {summitGoal?.location ?? "your location"}.
            </Text>
          </View>
        )}

        {/* Hill cards */}
        {displayedHills.map((hill, i) => {
          const total = hill.elevation * hill.repeats;
          const pct = Math.min(100, Math.round((total / weekTarget) * 100));
          const gc = GRADE_COLOR[hill.grade] ?? T.blue;
          const inPlan = hillsInPlan.includes(hill.name);
          const wasJustAdded = justAdded === hill.name;
          const isLocked = !isSubscribed && i >= FREE_HILLS_LIMIT;

          if (isLocked && i === FREE_HILLS_LIMIT) {
            return (
              <Animated.View key={i} entering={FadeInDown.delay(120 + i * 60).duration(400)}>
                <TouchableOpacity onPress={() => router.push("/paywall")} activeOpacity={0.85} style={s.lockedCard}>
                  <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
                  <View style={s.lockedIconWrap}><Lock size={22} color={T.green} /></View>
                  <Text style={s.lockedTitle}>{nearbyHills.length - FREE_HILLS_LIMIT} more hills found nearby</Text>
                  <Text style={s.lockedSub}>
                    Upgrade to Summit Ready Pro to see all {nearbyHills.length} results, sort by elevation, and add any hill to your plan.
                  </Text>
                  <View style={s.lockedBtn}>
                    <Zap size={13} color={T.bg} />
                    <Text style={s.lockedBtnText}>Unlock all hills</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          }
          if (isLocked) return null;

          return (
            <Animated.View key={i} entering={FadeInDown.delay(120 + i * 60).duration(400)}>
              <View style={s.hillCard}>
                <LinearGradient colors={[gc + "08", "transparent"]} style={StyleSheet.absoluteFill} />
                {sortBy === "distance" && (
                  <View style={s.rankBadge}><Text style={s.rankText}>#{i + 1} closest</Text></View>
                )}
                {sortBy === "elevation" && (
                  <View style={[s.rankBadge, { backgroundColor: T.orangeDim }]}>
                    <Text style={[s.rankText, { color: T.orange }]}>#{i + 1} highest</Text>
                  </View>
                )}
                {sortBy === "popularity" && i === 0 && (
                  <View style={[s.rankBadge, { backgroundColor: T.purpleDim }]}>
                    <Text style={[s.rankText, { color: T.purple }]}>Most popular</Text>
                  </View>
                )}
                <View style={s.hillTop}>
                  <View style={[s.hillIconBox, { backgroundColor: gc + "18" }]}>
                    <Text style={s.hillEmoji}>{hill.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.hillName}>{hill.name}</Text>
                    <Text style={s.hillSurface}>{hill.surface}</Text>
                  </View>
                  <View style={[s.gradeBadge, { backgroundColor: gc + "20" }]}>
                    <Text style={[s.gradeText, { color: gc }]}>{hill.grade}</Text>
                  </View>
                </View>
                <View style={s.hillStats}>
                  <View style={s.hillStat}><MapPin size={12} color={T.green} /><Text style={s.hillStatVal}>{hill.distance}km</Text><Text style={s.hillStatLbl}>away</Text></View>
                  <View style={s.hillStat}><TrendingUp size={12} color={T.orange} /><Text style={s.hillStatVal}>{hill.elevation}m</Text><Text style={s.hillStatLbl}>per climb</Text></View>
                  <View style={s.hillStat}><Repeat size={12} color={T.textMuted} /><Text style={s.hillStatVal}>{hill.repeats}×</Text><Text style={s.hillStatLbl}>repeats</Text></View>
                </View>
                <View style={s.repeatBox}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={s.repeatTitle}>{hill.repeats}× repeats = {total}m total elevation</Text>
                    <Text style={[s.pctText, { color: pct >= 80 ? T.green : T.orange }]}>{pct}%</Text>
                  </View>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: pct >= 80 ? T.green : T.orange }]} />
                  </View>
                  <Text style={s.progressCaption}>of this week's elevation target</Text>
                </View>
                <View style={s.actionRow}>
                  <TouchableOpacity
                    style={[s.addPlanBtn, inPlan && { backgroundColor: T.greenDim, borderColor: T.green + "50" }, wasJustAdded && { backgroundColor: T.green + "25" }]}
                    activeOpacity={inPlan ? 1 : 0.7}
                    onPress={() => !inPlan && handleAddToPlan(hill)}
                    disabled={inPlan}
                  >
                    {wasJustAdded ? <CheckCircle size={14} color={T.green} /> : inPlan ? <Check size={14} color={T.green} /> : <PlusCircle size={14} color={T.blue} />}
                    <Text style={[s.addPlanText, inPlan && { color: T.green }]}>
                      {wasJustAdded ? "Added!" : inPlan ? "In your plan" : "Add to plan"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.mapBtn} activeOpacity={0.7} onPress={() => openMapsForHill(hill.lat, hill.lng, hill.name)}>
                    <Map size={14} color={T.green} />
                    <Text style={s.mapBtnText}>Map</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.detailsBtn} activeOpacity={0.7}
                    onPress={() => router.push({ pathname: "/hill-detail", params: { name: hill.name, location: summitGoal?.location ?? "", lat: hill.lat?.toString() ?? "", lng: hill.lng?.toString() ?? "", elevation: hill.elevation.toString(), distance: hill.distance.toString(), grade: hill.grade, surface: hill.surface, emoji: hill.emoji } })}
                  >
                    <Info size={14} color={T.purple} />
                    <Text style={s.detailsBtnText}>Details</Text>
                  </TouchableOpacity>
                </View>
                {wasJustAdded && (
                  <View style={s.impactNote}>
                    <Zap size={12} color={T.green} />
                    <Text style={s.impactText}>Plan updated — hill sessions recalculated for {hill.name}</Text>
                  </View>
                )}
              </View>
            </Animated.View>
          );
        })}
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: Platform.OS === "web" ? 60 : insets.top + 20, paddingBottom: 120 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(40).duration(600)} style={s.header}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.eyebrow}>{isSummit ? "SUMMIT MODE" : "EXPLORE MODE"}</Text>
            <Text style={s.title}>Trails</Text>
          </View>
          <TouchableOpacity style={s.logFab} onPress={() => setLogVisible(true)} activeOpacity={0.85}>
            <Plus size={15} color={T.green} />
            <Text style={s.logFabText}>Log session</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Stats strip */}
        <Animated.View entering={FadeInDown.delay(60).duration(600)} style={s.statsStrip}>
          <View style={s.statItem}>
            <Text style={[s.statVal, { color: T.blue }]}>{savedTrailIds.length}</Text>
            <Text style={s.statLbl}>Saved</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statVal, { color: T.green }]}>{completedTrailIds.length}</Text>
            <Text style={s.statLbl}>Completed</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statVal, { color: T.purple }]}>{customRoutes.length}</Text>
            <Text style={s.statLbl}>Custom</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statVal, { color: T.orange }]}>{exploreHikes.length}</Text>
            <Text style={s.statLbl}>Sessions</Text>
          </View>
        </Animated.View>

        {/* Filter chips */}
        <Animated.View entering={FadeInDown.delay(80).duration(600)} style={s.chipRow}>
          {([
            { key: "all",   label: "All Routes" },
            { key: "hikes", label: "Hikes" },
            { key: "hills", label: "Training Hills" },
          ] as { key: FilterChip; label: string }[]).map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              onPress={() => setActiveChip(key)}
              style={[s.chip, activeChip === key && s.chipActive]}
              activeOpacity={0.75}
            >
              <Text style={[s.chipText, activeChip === key && s.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Content by chip */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)}>
          {activeChip === "all" && (
            <View style={{ gap: 10 }}>
              <CategoryCard
                emoji="🗺️" title="Browse Trails" subtitle="Explore routes near you"
                color={T.blue} onPress={() => router.push("/trail-list")}
              />
              <CategoryCard
                emoji="⛰️" title="Training Hills" subtitle="Find hills to build elevation"
                color={T.orange} onPress={() => setActiveChip("hills")}
              />
              <CategoryCard
                emoji="🔖" title="Saved Routes" subtitle="Trails you've bookmarked"
                color={T.blue} badge={savedTrailIds.length}
                onPress={() => router.push("/trails-saved")}
              />
              <CategoryCard
                emoji="✅" title="Completed Trails" subtitle="Trails you've finished"
                color={T.green} badge={completedTrailIds.length}
                onPress={() => router.push("/trails-completed")}
              />
              <TouchableOpacity style={s.createCard} onPress={() => router.push("/trails-create")} activeOpacity={0.82}>
                <LinearGradient colors={[T.purple + "14", "transparent"]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                <View style={[s.createIcon, { backgroundColor: T.purple + "22" }]}>
                  <Pencil size={18} color={T.purple} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.createTitle}>Create My Own Route</Text>
                  <Text style={s.createSubtitle}>
                    {customRoutes.length > 0 ? `${customRoutes.length} custom route${customRoutes.length !== 1 ? "s" : ""} saved` : "Add a personalised trail to your library"}
                  </Text>
                </View>
                <ChevronRight size={16} color={T.textDim} />
              </TouchableOpacity>
            </View>
          )}

          {activeChip === "hikes" && <HikesSection />}
          {activeChip === "hills" && <HillsSection />}
        </Animated.View>

        {/* Recent activity — always shown */}
        <Animated.View entering={FadeInDown.delay(120).duration(600)} style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Recent activity</Text>
          {exploreHikes.length > 0 && (
            <TouchableOpacity onPress={() => setLogVisible(true)} style={s.addBtn}>
              <Plus size={13} color={T.green} />
              <Text style={s.addBtnText}>Log</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {exploreHikes.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(140).duration(600)} style={s.emptyActivity}>
            <Compass size={28} color={T.textDim} />
            <Text style={s.emptyActivityTitle}>No sessions logged yet</Text>
            <Text style={s.emptyActivityBody}>Tap "Log session" above after a hike to record your sessions.</Text>
          </Animated.View>
        ) : (
          <View style={s.activityList}>
            {exploreHikes.map((hike, i) => (
              <Animated.View key={hike.id} entering={FadeInDown.delay(140 + i * 40).duration(500)}>
                <LoggedHikeRow hike={hike} onDelete={deleteExploreHike} />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      <LogHikeModal visible={logVisible} onClose={() => setLogVisible(false)} />
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 16 },

  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  eyebrow: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.textDim, letterSpacing: 1.2 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.text },
  logFab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: T.greenDim, borderRadius: 12, borderWidth: 1, borderColor: T.green + "40",
    paddingHorizontal: 14, paddingVertical: 9,
  },
  logFabText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.green },

  statsStrip: {
    flexDirection: "row", backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.border, padding: 14, justifyContent: "space-around",
  },
  statItem: { alignItems: "center", gap: 3 },
  statVal: { fontSize: 18, fontFamily: "Inter_700Bold", color: T.blue },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted },
  statDivider: { width: 1, backgroundColor: T.border },

  chipRow: { flexDirection: "row", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    borderWidth: 1, borderColor: T.border, backgroundColor: T.surface,
  },
  chipActive: { borderColor: T.green + "60", backgroundColor: T.greenDim },
  chipText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  chipTextActive: { color: T.green },

  createCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border,
    padding: 14, overflow: "hidden",
  },
  createIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  createTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },
  createSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.text },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: T.greenDim, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: T.green + "30",
  },
  addBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.green },
  emptyActivity: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyActivityTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.text },
  emptyActivityBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" },
  activityList: { gap: 8 },

  // Hills
  hillsHeader: { marginBottom: 10 },
  locRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  locText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },
  locEditRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  locInput: {
    flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: T.white,
    backgroundColor: T.surface, borderRadius: 10, borderWidth: 1, borderColor: T.green + "50",
    paddingHorizontal: 10, paddingVertical: 6,
  },
  locActionBtn: {
    width: 30, height: 30, alignItems: "center", justifyContent: "center",
    borderRadius: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
  },

  ctxCard: {
    backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.green + "30",
    overflow: "hidden", marginBottom: 10,
  },
  ctxRow: { flexDirection: "row", paddingVertical: 14 },
  ctxItem: { flex: 1, alignItems: "center", gap: 3 },
  ctxVal: { fontSize: 19, fontFamily: "Inter_700Bold", color: T.white },
  ctxLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" },
  ctxDivider: { width: 1, backgroundColor: T.border, marginVertical: 4 },

  controlCard: {
    backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border,
    overflow: "hidden", marginBottom: 10, paddingHorizontal: 16, paddingVertical: 14,
  },
  controlRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 40 },
  controlDivider: { height: 1, backgroundColor: T.border, marginVertical: 12 },
  controlLabelRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  controlLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.text },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: T.surface,
    borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center",
  },
  stepValBox: { minWidth: 64, alignItems: "center" },
  stepVal: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.white },
  stepUnit: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  sortChips: { flexDirection: "row", gap: 6 },
  sortChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1, borderColor: T.border, backgroundColor: T.surface,
  },
  sortChipActive: { borderColor: T.blue + "60", backgroundColor: T.blueDim },
  sortChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  sortChipTextActive: { color: T.blue },

  searchCard: {
    backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.purple + "35",
    overflow: "hidden", marginBottom: 10, paddingHorizontal: 16, paddingVertical: 14, gap: 10,
  },
  searchLabelRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  searchLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.text },
  searchHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 17, marginTop: -4 },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  searchInput: {
    flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: T.white,
    backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.purple + "40",
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: T.purple, alignItems: "center", justifyContent: "center" },
  searchErrRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  searchErrText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.red, flex: 1 },
  searchResult: { borderRadius: 14, borderWidth: 1, borderColor: T.purple + "40", overflow: "hidden", padding: 12, gap: 10 },
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
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    paddingVertical: 10, borderRadius: 12, borderWidth: 1,
    borderColor: T.purple + "50", backgroundColor: T.purpleDim,
  },
  searchAddText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.purple },

  fetchBtn: { borderRadius: 14, overflow: "hidden", marginBottom: 10 },
  fetchBtnInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 13, borderWidth: 1, borderColor: T.green + "40", borderRadius: 14,
  },
  fetchBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.green },
  outsideRadiusNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: T.orangeDim, borderRadius: 12, borderWidth: 1,
    borderColor: T.orange + "40", padding: 12, marginBottom: 10,
  },
  outsideRadiusText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: T.orange, lineHeight: 17 },
  emptyCard: {
    backgroundColor: T.card, borderRadius: 20, borderWidth: 1, borderColor: T.border,
    padding: 32, alignItems: "center", gap: 10, marginBottom: 10,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.white },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 20 },
  lockedCard: {
    borderRadius: 18, borderWidth: 1, borderColor: T.green + "40",
    backgroundColor: T.card, overflow: "hidden", alignItems: "center", padding: 24, gap: 10, marginBottom: 8,
  },
  lockedIconWrap: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: T.greenDim,
    borderWidth: 1, borderColor: T.green + "50", alignItems: "center", justifyContent: "center",
  },
  lockedTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.white, textAlign: "center" },
  lockedSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 19 },
  lockedBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: T.green, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4,
  },
  lockedBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.bg },
  hillCard: {
    backgroundColor: T.card, borderRadius: 20, borderWidth: 1, borderColor: T.border,
    padding: 16, marginBottom: 10, overflow: "hidden", gap: 12,
  },
  rankBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, backgroundColor: T.greenDim, marginBottom: -4 },
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
  repeatBox: { backgroundColor: T.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: T.border },
  repeatTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.text },
  pctText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  progressTrack: { height: 6, backgroundColor: T.border, borderRadius: 3, overflow: "hidden", marginBottom: 5 },
  progressFill: { height: 6, borderRadius: 3 },
  progressCaption: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  actionRow: { flexDirection: "row", gap: 8 },
  addPlanBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: T.blue + "40", backgroundColor: T.blueDim,
  },
  addPlanText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.blue },
  mapBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: T.green + "40",
  },
  mapBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.green },
  detailsBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1,
    borderColor: T.purple + "40", backgroundColor: T.purpleDim,
  },
  detailsBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.purple },
  impactNote: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 8, backgroundColor: T.greenDim, borderRadius: 10, marginTop: -4,
  },
  impactText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.green, flex: 1 },
});
