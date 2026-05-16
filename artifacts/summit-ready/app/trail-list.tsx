import { ArrowLeft, Search, SlidersHorizontal, X } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useState } from "react";
import {
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
import type { TrailDifficulty, TrailTerrain, TrailBestFor, TrailRouteType } from "@/constants/trailData";
import { TrailCard } from "@/components/TrailCard";

type Difficulty = TrailDifficulty | "All";
type Terrain = TrailTerrain | "All";
type BestFor = TrailBestFor | "All";
type RouteType = TrailRouteType | "All";

const DIFFICULTIES: Difficulty[] = ["All", "Easy", "Moderate", "Hard"];
const TERRAINS: Terrain[] = ["All", "woodland", "hill", "mountain", "coastal", "road", "mixed"];
const BEST_FOR: BestFor[] = ["All", "training", "family walk", "summit prep", "scenic walk"];
const ROUTE_TYPES: RouteType[] = ["All", "loop", "out-and-back", "point-to-point"];

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
  const { savedTrailIds, completedTrailIds, customRoutes } = useApp();

  const [query, setQuery] = useState(params.q ?? "");
  const [showFilters, setShowFilters] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("All");
  const [terrain, setTerrain] = useState<Terrain>("All");
  const [bestFor, setBestFor] = useState<BestFor>("All");
  const [routeType, setRouteType] = useState<RouteType>("All");

  const allTrails = useMemo(
    () => [...customRoutes, ...SAMPLE_TRAILS],
    [customRoutes]
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
            placeholder="Search by name, location, difficulty…"
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
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <Text style={s.resultCount}>
            {filtered.length} trail{filtered.length !== 1 ? "s" : ""}
            {hasActiveFilters || query ? " found" : ""}
          </Text>
        </Animated.View>

        {/* Trail list */}
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
  filterBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  filterBtnActive: { backgroundColor: T.greenDim },
  filterDot: { position: "absolute", top: 8, right: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: T.green },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: T.text },
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
