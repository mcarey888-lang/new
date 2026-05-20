import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import {
  AlertCircle,
  BarChart2,
  Map,
  Minus,
  Mountain,
  Plus,
  Search,
  TrendingUp,
  X,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { T } from "@/constants/theme";
import type { NearbyHill } from "@/context/AppContext";
import type { ChallengeMetric } from "@/constants/challenges";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const LOC_KEY = "summitready_hikes_location";

interface PlannedHill {
  hill: NearbyHill;
  reps: number;
}

interface Props {
  targetValue: number;
  metric: ChallengeMetric;
  color: string;
  currentProgress?: number;
}

// ─── Animated fill bar ─────────────────────────────────────────────────────

function FillBar({
  planned,
  alreadyDone,
  target,
  color,
}: {
  planned: number;
  alreadyDone: number;
  target: number;
  color: string;
}) {
  const donePct  = Math.min(100, Math.round((alreadyDone / target) * 100));
  const planPct  = Math.min(100, Math.round(((alreadyDone + planned) / target) * 100));
  const totalPct = Math.min(100, planPct);

  const doneWidth = useSharedValue(0);
  const planWidth = useSharedValue(0);

  useEffect(() => {
    doneWidth.value = withSpring(donePct, { damping: 18, stiffness: 90 });
  }, [donePct]);

  useEffect(() => {
    planWidth.value = withSpring(Math.max(0, totalPct - donePct), { damping: 18, stiffness: 90 });
  }, [totalPct, donePct]);

  const doneStyle  = useAnimatedStyle(() => ({ width: `${doneWidth.value}%` as any }));
  const planStyle  = useAnimatedStyle(() => ({ width: `${planWidth.value}%` as any }));

  const remaining = Math.max(0, target - alreadyDone - planned);

  return (
    <View style={fb.wrap}>
      {/* Numbers row */}
      <View style={fb.row}>
        <View>
          <Text style={fb.labelSmall}>Logged so far</Text>
          <Text style={[fb.numBig, { color }]}>
            {alreadyDone.toLocaleString()}
            <Text style={fb.unit}>m</Text>
          </Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={fb.labelSmall}>Planned sessions</Text>
          <Text style={[fb.numBig, { color: T.orange }]}>
            +{planned.toLocaleString()}
            <Text style={fb.unit}>m</Text>
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={fb.labelSmall}>Still needed</Text>
          <Text style={fb.numBig}>
            {remaining.toLocaleString()}
            <Text style={fb.unit}>m</Text>
          </Text>
        </View>
      </View>

      {/* Bar */}
      <View style={fb.track}>
        <Animated.View style={[fb.doneFill, doneStyle, { backgroundColor: color }]} />
        <Animated.View style={[fb.planFill, planStyle, { backgroundColor: T.orange }]} />
      </View>

      {/* Labels */}
      <View style={fb.row}>
        <Text style={[fb.barLabel, { color }]}>
          {donePct}% logged
        </Text>
        {planned > 0 && (
          <Text style={[fb.barLabel, { color: T.orange }]}>
            +{Math.max(0, totalPct - donePct)}% planned
          </Text>
        )}
        <Text style={fb.barLabel}>
          Target: {target.toLocaleString()}m
        </Text>
      </View>
    </View>
  );
}

const fb = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  labelSmall: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted, marginBottom: 2 },
  numBig: { fontSize: 18, fontFamily: "Inter_700Bold", color: T.text },
  unit: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  track: {
    height: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden", flexDirection: "row",
  },
  doneFill:  { height: 10, borderRadius: 5 },
  planFill:  { height: 10, borderRadius: 5, opacity: 0.55 },
  barLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textDim },
});

// ─── Main component ─────────────────────────────────────────────────────────

export function HillPlannerSection({ targetValue, metric, color, currentProgress = 0 }: Props) {
  const [location, setLocation] = useState("");
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<NearbyHill | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [planned, setPlanned]   = useState<PlannedHill[]>([]);
  const searchRef = useRef<TextInput>(null);

  // Pre-fill location from Hills cache
  useEffect(() => {
    AsyncStorage.getItem(LOC_KEY).then(v => { if (v) setLocation(v); });
  }, []);

  const totalPlannedElev = planned.reduce((s, p) => s + p.hill.elevation * p.reps, 0);
  const totalPlannedHikes = planned.reduce((s, p) => s + p.reps, 0);
  const plannedValue = metric === "elevation" ? totalPlannedElev : totalPlannedHikes;

  async function doSearch() {
    const q = search.trim();
    if (q.length < 2) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/hills-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hillName: q, location: location.trim() }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json() as { hill: NearbyHill };
      setResult(data.hill);
    } catch {
      setError("Hill not found — try a different name or spelling.");
    } finally {
      setLoading(false);
    }
  }

  function addHill(hill: NearbyHill) {
    setPlanned(prev => {
      const existing = prev.find(p => p.hill.name === hill.name);
      if (existing) {
        return prev.map(p => p.hill.name === hill.name ? { ...p, reps: p.reps + 1 } : p);
      }
      return [...prev, { hill, reps: 1 }];
    });
    setResult(null);
    setSearch("");
  }

  function setReps(name: string, reps: number) {
    if (reps <= 0) {
      setPlanned(prev => prev.filter(p => p.hill.name !== name));
    } else {
      setPlanned(prev => prev.map(p => p.hill.name === name ? { ...p, reps } : p));
    }
  }

  return (
    <View style={s.container}>
      <LinearGradient colors={[color + "0A", "transparent"]} style={StyleSheet.absoluteFill} />

      {/* Section header */}
      <View style={s.header}>
        <View style={[s.headerIcon, { backgroundColor: color + "20" }]}>
          <Mountain size={15} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Plan Your Hills</Text>
          <Text style={s.subtitle}>
            Pick hills and set reps to see how much elevation you can build.
          </Text>
        </View>
      </View>

      {/* Elevation fill bar — always visible */}
      {metric === "elevation" && (
        <Animated.View entering={FadeInDown.duration(400)}>
          <FillBar
            planned={totalPlannedElev}
            alreadyDone={currentProgress}
            target={targetValue}
            color={color}
          />
        </Animated.View>
      )}

      {/* Hike-count summary */}
      {metric === "hikes" && planned.length > 0 && (
        <View style={s.hikeCount}>
          <BarChart2 size={14} color={color} />
          <Text style={[s.hikeCountText, { color }]}>
            {totalPlannedHikes} planned session{totalPlannedHikes !== 1 ? "s" : ""}
            {" "}· {Math.max(0, targetValue - currentProgress - totalPlannedHikes)} more needed
          </Text>
        </View>
      )}

      {/* Selected hills */}
      {planned.length > 0 && (
        <View style={s.selectedList}>
          {planned.map((p, i) => {
            const contrib = p.hill.elevation * p.reps;
            return (
              <Animated.View key={p.hill.name} entering={FadeInDown.delay(i * 40).duration(300)} style={s.selectedCard}>
                <LinearGradient colors={[color + "0C", "transparent"]} style={StyleSheet.absoluteFill} />

                <View style={s.selectedTop}>
                  <View style={[s.selectedEmoji, { backgroundColor: color + "18" }]}>
                    <Text style={s.emojiText}>{p.hill.emoji || "⛰️"}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.hillName}>{p.hill.name}</Text>
                    <Text style={s.hillMeta}>
                      {p.hill.elevation}m gain per rep · {p.hill.surface}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setReps(p.hill.name, 0)}
                    hitSlop={8}
                    style={s.removeBtn}
                  >
                    <X size={13} color={T.textDim} />
                  </TouchableOpacity>
                </View>

                {/* Rep controls + contribution */}
                <View style={s.repRow}>
                  <View style={s.repControls}>
                    <TouchableOpacity
                      onPress={() => setReps(p.hill.name, p.reps - 1)}
                      style={s.repBtn}
                      activeOpacity={0.7}
                    >
                      <Minus size={13} color={T.text} />
                    </TouchableOpacity>
                    <View style={s.repValWrap}>
                      <Text style={s.repVal}>{p.reps}</Text>
                      <Text style={s.repLbl}>rep{p.reps !== 1 ? "s" : ""}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setReps(p.hill.name, p.reps + 1)}
                      style={s.repBtn}
                      activeOpacity={0.7}
                    >
                      <Plus size={13} color={T.text} />
                    </TouchableOpacity>
                  </View>

                  {/* Mini contribution bar */}
                  <View style={s.contribWrap}>
                    <View style={s.contribBar}>
                      <View
                        style={[
                          s.contribFill,
                          {
                            width: `${Math.min(100, (contrib / targetValue) * 100)}%` as any,
                            backgroundColor: color,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[s.contribText, { color }]}>
                      {metric === "elevation"
                        ? `+${contrib.toLocaleString()}m`
                        : `+${p.reps} session${p.reps !== 1 ? "s" : ""}`}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* Search */}
      <View style={s.searchBlock}>
        <View style={s.locRow}>
          <Map size={12} color={T.textMuted} />
          <TextInput
            style={s.locInput}
            value={location}
            onChangeText={v => { setLocation(v); AsyncStorage.setItem(LOC_KEY, v); }}
            placeholder="Your location (optional)"
            placeholderTextColor={T.textDim}
            autoCorrect={false}
            autoCapitalize="words"
          />
        </View>

        <View style={s.searchRow}>
          <View style={s.searchInputWrap}>
            <Search size={13} color={T.textMuted} />
            <TextInput
              ref={searchRef}
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search a hill name…"
              placeholderTextColor={T.textDim}
              returnKeyType="search"
              onSubmitEditing={doSearch}
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { setSearch(""); setResult(null); setError(null); }} hitSlop={8}>
                <X size={11} color={T.textDim} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[s.searchBtn, { backgroundColor: color }, (search.trim().length < 2 || loading) && { opacity: 0.4 }]}
            onPress={doSearch}
            disabled={search.trim().length < 2 || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator size="small" color={T.bg} />
              : <Search size={15} color={T.bg} />
            }
          </TouchableOpacity>
        </View>

        {/* Error */}
        {error && (
          <Animated.View entering={FadeInDown.duration(300)} style={s.errorRow}>
            <AlertCircle size={12} color={T.red} />
            <Text style={s.errorText}>{error}</Text>
          </Animated.View>
        )}

        {/* Search result */}
        {result && (
          <Animated.View entering={FadeInDown.duration(300)} style={s.resultCard}>
            <View style={[s.resultEmoji, { backgroundColor: color + "18" }]}>
              <Text style={s.emojiText}>{result.emoji || "⛰️"}</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.resultName}>{result.name}</Text>
              <View style={s.resultMeta}>
                <TrendingUp size={11} color={T.orange} />
                <Text style={s.resultMetaText}>{result.elevation}m gain</Text>
                <Text style={s.resultMetaDot}>·</Text>
                <Text style={s.resultMetaText}>{result.surface}</Text>
                <Text style={s.resultMetaDot}>·</Text>
                <Text style={s.resultMetaText}>{result.grade}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[s.addBtn, { backgroundColor: color }]}
              onPress={() => addHill(result)}
              activeOpacity={0.85}
            >
              <Plus size={14} color={T.bg} />
              <Text style={s.addBtnText}>Add</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      {/* Empty state hint */}
      {planned.length === 0 && !result && (
        <Text style={s.hint}>
          Search a hill above to start planning your route to the target.
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border,
    padding: 16, gap: 14, overflow: "hidden",
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  headerIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  title: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 17 },

  hikeCount: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: T.surface, borderRadius: 10, padding: 10 },
  hikeCountText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  selectedList: { gap: 8 },
  selectedCard: {
    backgroundColor: T.surface, borderRadius: 13, borderWidth: 1, borderColor: T.border,
    padding: 12, gap: 10, overflow: "hidden",
  },
  selectedTop: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  selectedEmoji: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  emojiText: { fontSize: 17 },
  hillName: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text },
  hillMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  removeBtn: { padding: 4, marginTop: 2 },

  repRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  repControls: { flexDirection: "row", alignItems: "center", gap: 6 },
  repBtn: {
    width: 30, height: 30, backgroundColor: T.card, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: T.border,
  },
  repValWrap: { alignItems: "center", minWidth: 38 },
  repVal: { fontSize: 18, fontFamily: "Inter_700Bold", color: T.text, lineHeight: 22 },
  repLbl: { fontSize: 9, fontFamily: "Inter_400Regular", color: T.textMuted },

  contribWrap: { flex: 1, gap: 4 },
  contribBar: { height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" },
  contribFill: { height: 5, borderRadius: 3 },
  contribText: { fontSize: 12, fontFamily: "Inter_700Bold", textAlign: "right" },

  searchBlock: { gap: 8 },
  locRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: T.surface, borderRadius: 10, borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  locInput: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: T.text },

  searchRow: { flexDirection: "row", gap: 8 },
  searchInputWrap: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: T.surface, borderRadius: 10, borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 10,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: T.text, paddingVertical: 10 },
  searchBtn: {
    width: 42, height: 42, borderRadius: 11,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },

  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.red },

  resultCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border,
    padding: 12,
  },
  resultEmoji: { width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  resultName: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text },
  resultMeta: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  resultMetaText: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  resultMetaDot: { fontSize: 11, color: T.textDim },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8, flexShrink: 0 },
  addBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.bg },

  hint: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center", paddingVertical: 4 },
});
