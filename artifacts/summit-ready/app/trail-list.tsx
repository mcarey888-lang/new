import {
  ArrowLeft,
  Footprints,
  Mountain,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react-native";
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
import { router } from "expo-router";
import { T } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { CURATED_HILLS } from "@/constants/trailData";
import type { Trail, TrailDifficulty, TrailRegion } from "@/constants/trailData";
import { TrailCard } from "@/components/TrailCard";

const DIFFICULTIES: Array<TrailDifficulty | "All"> = ["All", "Easy", "Moderate", "Hard"];

const ALL_REGIONS: Array<TrailRegion | "All"> = [
  "All",
  "Scottish Highlands",
  "Lake District",
  "Peak District",
  "Snowdonia",
  "Yorkshire Dales",
  "Brecon Beacons",
  "Isle of Skye",
  "Cairngorms",
  "Ireland",
];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipActive]} activeOpacity={0.75}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function TrailListScreen() {
  const insets = useSafeAreaInsets();
  const { savedTrailIds, completedTrailIds, trainingPlan } = useApp();

  const currentWeek = useMemo(
    () => trainingPlan.find((w) => w.isCurrentWeek) ?? null,
    [trainingPlan],
  );

  function isGoodForWeek(trail: Trail): boolean {
    if (!currentWeek) return false;
    const target = currentWeek.targetElevation;
    if (target <= 0) return false;
    return trail.elevationGain >= target * 0.5 && trail.elevationGain <= target * 2.5;
  }

  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<TrailDifficulty | "All">("All");
  const [region, setRegion] = useState<TrailRegion | "All">("All");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return CURATED_HILLS.filter((t) => {
      if (query.trim()) {
        const q = query.toLowerCase();
        const match =
          t.name.toLowerCase().includes(q) ||
          t.location.toLowerCase().includes(q) ||
          (t.region ?? "").toLowerCase().includes(q);
        if (!match) return false;
      }
      if (difficulty !== "All" && t.difficulty !== difficulty) return false;
      if (region !== "All" && (t.region ?? "") !== region) return false;
      return true;
    });
  }, [query, difficulty, region]);

  const hasActiveFilters = difficulty !== "All" || region !== "All";
  const headerPaddingTop = Platform.OS === "web" ? 60 : insets.top + 16;

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: headerPaddingTop, paddingBottom: 48 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <ArrowLeft size={20} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>EXPLORE</Text>
            <Text style={s.title}>Browse Hills</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowFilters((v) => !v)}
            style={[s.iconBtn, showFilters && s.iconBtnActive]}
            activeOpacity={0.8}
          >
            <SlidersHorizontal size={17} color={showFilters ? T.green : T.textMuted} />
            {hasActiveFilters && <View style={s.filterDot} />}
          </TouchableOpacity>
        </Animated.View>

        {/* Start Hiking banner */}
        <Animated.View entering={FadeInDown.delay(30).duration(400)}>
          <TouchableOpacity
            style={s.hikeBtn}
            onPress={() => router.push("/hike-tracking")}
            activeOpacity={0.82}
          >
            <LinearGradient
              colors={["#1A3D2B", "#163322"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.hikeGrad}
            >
              <View style={s.hikeIcon}>
                <Footprints size={20} color={T.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.hikeTitle}>Start Hiking</Text>
                <Text style={s.hikeSub}>Live GPS tracking — draw your route as you walk</Text>
              </View>
              <Text style={s.hikeArrow}>›</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Search */}
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={s.searchWrap}>
          <Search size={15} color={T.textMuted} />
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search hills, regions…"
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
                <TouchableOpacity onPress={() => { setDifficulty("All"); setRegion("All"); }}>
                  <Text style={s.clearText}>Clear all</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={s.filterSection}>
              <Text style={s.filterLabel}>Difficulty</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {DIFFICULTIES.map((d) => (
                  <Chip key={d} label={d} active={difficulty === d} onPress={() => setDifficulty(d)} />
                ))}
              </ScrollView>
            </View>

            <View style={s.filterSection}>
              <Text style={s.filterLabel}>Region</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {ALL_REGIONS.map((r) => (
                  <Chip key={r} label={r} active={region === r} onPress={() => setRegion(r as TrailRegion | "All")} />
                ))}
              </ScrollView>
            </View>
          </Animated.View>
        )}

        {/* Result count */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={s.countRow}>
          <Mountain size={13} color={T.textDim} />
          <Text style={s.countText}>
            {filtered.length} hill{filtered.length !== 1 ? "s" : ""}
            {hasActiveFilters || query ? " found" : " — pick your next challenge"}
          </Text>
        </Animated.View>

        {/* List */}
        <View style={s.list}>
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>🔍</Text>
              <Text style={s.emptyTitle}>No hills found</Text>
              <Text style={s.emptyBody}>Try adjusting your search or filters.</Text>
            </View>
          ) : (
            filtered.map((trail) => (
              <View key={trail.id}>
                <TrailCard
                  trail={trail}
                  isSaved={savedTrailIds.includes(trail.id)}
                  isCompleted={completedTrailIds.includes(trail.id)}
                  isGoodForWeek={isGoodForWeek(trail)}
                  onPress={() => router.push({ pathname: "/trail-detail", params: { id: trail.id } })}
                />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 12 },

  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  eyebrow: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.textDim, letterSpacing: 1.2 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.text },
  iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  iconBtnActive: { backgroundColor: T.greenDim },
  filterDot: { position: "absolute", top: 7, right: 7, width: 6, height: 6, borderRadius: 3, backgroundColor: T.green },

  hikeBtn: { borderRadius: 18, overflow: "hidden" },
  hikeGrad: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 16, paddingVertical: 16,
    borderWidth: 1, borderColor: "rgba(62,207,117,0.25)", borderRadius: 18,
  },
  hikeIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(62,207,117,0.15)", alignItems: "center", justifyContent: "center" },
  hikeTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.green },
  hikeSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.45)", marginTop: 2 },
  hikeArrow: { fontSize: 26, color: T.green, lineHeight: 30, marginLeft: 4 },

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
  filterSection: { gap: 8 },
  filterLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border },
  chipActive: { backgroundColor: T.greenDim, borderColor: T.green + "60" },
  chipText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  chipTextActive: { fontFamily: "Inter_600SemiBold", color: T.green },

  countRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  countText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim },

  list: { gap: 10 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.text },
  emptyBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" },
});
