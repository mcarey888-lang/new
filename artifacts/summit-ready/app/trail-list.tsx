import { ArrowLeft, MapPin, Search, SlidersHorizontal, X, RefreshCw } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import { T } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { SAMPLE_TRAILS } from "@/constants/trailData";
import type { Trail, TrailDifficulty, TrailTerrain, TrailBestFor, TrailRouteType } from "@/constants/trailData";
import { TrailCard } from "@/components/TrailCard";
import {
  LIVE_TRAILS_CACHE_KEY,
  makeTrailId,
  loadLiveTrailsCache,
  saveLiveTrailsCache,
} from "@/utils/liveTrailsCache";

export { LIVE_TRAILS_CACHE_KEY };
export type { LiveTrailsCache } from "@/utils/liveTrailsCache";

type Difficulty = TrailDifficulty | "All";
type Terrain = TrailTerrain | "All";
type BestFor = TrailBestFor | "All";
type RouteType = TrailRouteType | "All";

const DIFFICULTIES: Difficulty[] = ["All", "Easy", "Moderate", "Hard"];
const TERRAINS: Terrain[] = ["All", "woodland", "hill", "mountain", "coastal", "road", "mixed"];
const BEST_FOR: BestFor[] = ["All", "training", "family walk", "summit prep", "scenic walk"];
const ROUTE_TYPES: RouteType[] = ["All", "loop", "out-and-back", "point-to-point"];

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

async function fetchLiveTrails(location: string, radius: number): Promise<Trail[]> {
  const res = await fetch(`${API_BASE}/trails-lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location, radius }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json() as { trails: Omit<Trail, "id">[] };
  return data.trails.map((t) => ({
    ...t,
    id: makeTrailId(t.name, t.location),
  }));
}

function Chip<T extends string>({ label, active, onPress }: { label: T; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.chip, active && s.chipActive]}
      activeOpacity={0.75}
    >
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.filterRow}>
      <Text style={s.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {options.map((o) => (
          <Chip key={o} label={o} active={value === o} onPress={() => onChange(o)} />
        ))}
      </ScrollView>
    </View>
  );
}

export default function TrailListScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string }>();
  const { savedTrailIds, completedTrailIds, customRoutes, summitGoal } = useApp();

  const [query, setQuery] = useState(params.q ?? "");
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSearching, setLocationSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("All");
  const [terrain, setTerrain] = useState<Terrain>("All");
  const [bestFor, setBestFor] = useState<BestFor>("All");
  const [routeType, setRouteType] = useState<RouteType>("All");

  const [liveTrails, setLiveTrails] = useState<Trail[]>([]);
  const [trailsLoading, setTrailsLoading] = useState(false);
  const [trailsError, setTrailsError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const liveTrailsRef = useRef<Trail[]>([]);

  const defaultLocation = summitGoal?.location ?? null;
  const radius = summitGoal?.maxRadius ?? 30;

  const loadTrails = useCallback(async (forceRefresh = false, overrideLocation?: string) => {
    const loc = overrideLocation ?? defaultLocation;
    if (!loc) {
      setLiveTrails(SAMPLE_TRAILS);
      liveTrailsRef.current = SAMPLE_TRAILS;
      setUsingFallback(true);
      return;
    }

    setTrailsLoading(true);
    setTrailsError(null);

    if (!forceRefresh && !overrideLocation) {
      const cached = await loadLiveTrailsCache(loc, radius);
      if (cached && cached.length > 0) {
        setLiveTrails(cached);
        liveTrailsRef.current = cached;
        setLocationLabel(loc);
        setUsingFallback(false);
        setTrailsLoading(false);
        return;
      }
    }

    try {
      const trails = await fetchLiveTrails(loc, radius);
      if (!overrideLocation) await saveLiveTrailsCache(trails, loc, radius);
      setLiveTrails(trails);
      liveTrailsRef.current = trails;
      setLocationLabel(loc);
      setUsingFallback(false);
    } catch {
      setTrailsError("Could not load trails — showing sample data.");
      const current = liveTrailsRef.current;
      if (current.length === 0) {
        setLiveTrails(SAMPLE_TRAILS);
        liveTrailsRef.current = SAMPLE_TRAILS;
        setUsingFallback(true);
      }
    } finally {
      setTrailsLoading(false);
    }
  }, [defaultLocation, radius]);

  useEffect(() => {
    loadTrails(false);
  }, [loadTrails]);

  const searchByLocation = useCallback(async () => {
    const trimmed = locationQuery.trim();
    if (!trimmed) {
      setLocationQuery("");
      loadTrails(true, defaultLocation ?? undefined);
      return;
    }
    setLocationSearching(true);
    await loadTrails(true, trimmed);
    setLocationSearching(false);
  }, [locationQuery, loadTrails, defaultLocation]);

  const clearLocationSearch = useCallback(() => {
    setLocationQuery("");
    loadTrails(false, defaultLocation ?? undefined);
  }, [loadTrails, defaultLocation]);

  const baseTrails = liveTrails.length > 0 ? liveTrails : SAMPLE_TRAILS;

  const allTrails = useMemo(
    () => [...customRoutes, ...baseTrails],
    [customRoutes, baseTrails]
  );

  const filtered = useMemo(() => {
    return allTrails.filter((t) => {
      if (query.trim()) {
        const q = query.toLowerCase();
        const match =
          t.name.toLowerCase().includes(q) ||
          t.location.toLowerCase().includes(q) ||
          t.difficulty.toLowerCase().includes(q) ||
          t.terrain.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (difficulty !== "All" && t.difficulty !== difficulty) return false;
      if (terrain !== "All" && t.terrain !== terrain) return false;
      if (routeType !== "All" && t.routeType !== routeType) return false;
      if (bestFor !== "All" && !t.bestFor.includes(bestFor as TrailBestFor)) return false;
      return true;
    });
  }, [allTrails, query, difficulty, terrain, bestFor, routeType]);

  const hasActiveFilters =
    difficulty !== "All" || terrain !== "All" || bestFor !== "All" || routeType !== "All";

  function clearFilters() {
    setDifficulty("All");
    setTerrain("All");
    setBestFor("All");
    setRouteType("All");
  }

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: Platform.OS === "web" ? 60 : insets.top + 16, paddingBottom: 40 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <ArrowLeft size={20} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>EXPLORE TRAILS</Text>
            <Text style={s.title}>All Trails</Text>
          </View>
          <TouchableOpacity
            onPress={() => loadTrails(true)}
            style={s.refreshBtn}
            activeOpacity={0.7}
            disabled={trailsLoading}
          >
            {trailsLoading
              ? <ActivityIndicator size="small" color={T.green} />
              : <RefreshCw size={17} color={T.textMuted} />
            }
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowFilters((v) => !v)}
            style={[s.filterBtn, showFilters && s.filterBtnActive]}
          >
            <SlidersHorizontal size={17} color={showFilters ? T.green : T.textMuted} />
            {hasActiveFilters && <View style={s.filterDot} />}
          </TouchableOpacity>
        </Animated.View>

        {/* Search bar */}
        <Animated.View entering={FadeInDown.delay(60).duration(400)} style={s.searchWrap}>
          <Search size={15} color={T.textMuted} />
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, difficulty…"
            placeholderTextColor={T.textDim}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
              <X size={14} color={T.textMuted} />
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Location search bar */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={[s.locationWrap, locationQuery.length > 0 && s.locationWrapActive]}>
          <MapPin size={15} color={locationQuery.length > 0 ? T.green : T.textMuted} />
          <TextInput
            style={s.searchInput}
            value={locationQuery}
            onChangeText={setLocationQuery}
            placeholder="Enter location, town or postcode…"
            placeholderTextColor={T.textDim}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
            onSubmitEditing={searchByLocation}
            blurOnSubmit={false}
          />
          {locationQuery.length > 0 && !locationSearching && (
            <TouchableOpacity onPress={clearLocationSearch} hitSlop={8}>
              <X size={14} color={T.textMuted} />
            </TouchableOpacity>
          )}
          {locationSearching
            ? <ActivityIndicator size="small" color={T.green} style={{ marginLeft: 4 }} />
            : locationQuery.length > 0
              ? (
                <TouchableOpacity onPress={searchByLocation} style={s.searchAreaBtn} activeOpacity={0.75}>
                  <Text style={s.searchAreaBtnText}>Search</Text>
                </TouchableOpacity>
              )
              : null
          }
        </Animated.View>

        {/* Location / status banner */}
        {!trailsLoading && (locationLabel || trailsError || usingFallback) && (
          <Animated.View entering={FadeInDown.delay(90).duration(300)} style={[
            s.banner,
            trailsError ? s.bannerError : (usingFallback ? s.bannerWarn : s.bannerOk),
          ]}>
            <Text style={[s.bannerText, trailsError ? s.bannerTextError : (usingFallback ? s.bannerTextWarn : s.bannerTextOk)]}>
              {trailsError
                ? trailsError
                : usingFallback
                  ? "No location set — showing sample UK trails"
                  : `Trails near ${locationLabel}`}
            </Text>
          </Animated.View>
        )}

        {/* Loading state */}
        {trailsLoading && liveTrails.length === 0 && (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={T.green} />
            <Text style={s.loadingText}>Finding trails near {defaultLocation ?? "you"}…</Text>
          </View>
        )}

        {/* Filters */}
        {showFilters && (
          <Animated.View entering={FadeInDown.duration(300)} style={s.filtersCard}>
            <View style={s.filtersHeader}>
              <Text style={s.filtersTitle}>Filters</Text>
              {hasActiveFilters && (
                <TouchableOpacity onPress={clearFilters}>
                  <Text style={s.clearText}>Clear all</Text>
                </TouchableOpacity>
              )}
            </View>
            <FilterRow label="Difficulty" options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
            <FilterRow label="Terrain" options={TERRAINS} value={terrain} onChange={setTerrain} />
            <FilterRow label="Route type" options={ROUTE_TYPES} value={routeType} onChange={setRouteType} />
            <FilterRow label="Best for" options={BEST_FOR} value={bestFor} onChange={setBestFor} />
          </Animated.View>
        )}

        {/* Results count */}
        {(!trailsLoading || liveTrails.length > 0) && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <Text style={s.resultCount}>
              {filtered.length} trail{filtered.length !== 1 ? "s" : ""}
              {hasActiveFilters || query || locationQuery ? " found" : ""}
            </Text>
          </Animated.View>
        )}

        {/* Trail list */}
        {(!trailsLoading || liveTrails.length > 0) && (
          <View style={s.list}>
            {filtered.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyEmoji}>🔍</Text>
                <Text style={s.emptyTitle}>No trails found</Text>
                <Text style={s.emptyBody}>Try adjusting your search or filters.</Text>
              </View>
            ) : (
              filtered.map((trail, i) => (
                <Animated.View key={trail.id} entering={FadeInDown.delay(i * 40).duration(400)}>
                  <TrailCard
                    trail={trail}
                    isSaved={savedTrailIds.includes(trail.id)}
                    isCompleted={completedTrailIds.includes(trail.id)}
                    onPress={() =>
                      router.push({ pathname: "/trail-detail", params: { id: trail.id } })
                    }
                  />
                </Animated.View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  eyebrow: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.textDim, letterSpacing: 1.2 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.text },
  refreshBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  filterBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  filterBtnActive: { backgroundColor: T.greenDim },
  filterDot: { position: "absolute", top: 8, right: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: T.green },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  locationWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  locationWrapActive: { borderColor: T.green + "60" },
  searchAreaBtn: {
    backgroundColor: T.greenDim, borderRadius: 8, borderWidth: 1, borderColor: T.green + "50",
    paddingHorizontal: 10, paddingVertical: 5, flexShrink: 0,
  },
  searchAreaBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.green },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: T.text },
  banner: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  bannerOk: { backgroundColor: T.greenDim, borderColor: T.green + "40" },
  bannerWarn: { backgroundColor: T.surface, borderColor: T.border },
  bannerError: { backgroundColor: "#2a1a1a", borderColor: "#c0392b40" },
  bannerText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  bannerTextOk: { color: T.green },
  bannerTextWarn: { color: T.textMuted },
  bannerTextError: { color: "#e74c3c" },
  loadingWrap: { alignItems: "center", paddingVertical: 48, gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted },
  filtersCard: { backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border, padding: 16, gap: 14 },
  filtersHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  filtersTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text },
  clearText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.green },
  filterRow: { gap: 8 },
  filterLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border },
  chipActive: { backgroundColor: T.greenDim, borderColor: T.green + "60" },
  chipText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, textTransform: "capitalize" },
  chipTextActive: { fontFamily: "Inter_600SemiBold", color: T.green },
  resultCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim },
  list: { gap: 10 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.text },
  emptyBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" },
});
