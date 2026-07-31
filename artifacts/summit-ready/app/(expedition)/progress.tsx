/**
 * Progress — Expedition progress screen.
 * Matches reference design: big progress ring, overall % label,
 * elevation progress bar, completed sections with dates,
 * Next Up section, and expedition stats grid.
 */

import {
  Mountain, CheckCircle, Circle, ChevronRight, Clock,
  TrendingUp, Map, Footprints, Target,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  Platform, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";
import { ProgressRing } from "@/components/ProgressRing";
import { useScreenView } from "@/lib/analytics";
import type { Session, NearbyHill } from "@/context/AppContext";

const PILL_OFFSET = 52;

// ── Helpers ────────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return T.green;
  if (score >= 60) return T.blue;
  if (score >= 40) return T.orange;
  return T.red;
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function relativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Minimal bar chart using Views
function SimpleBarChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height: 50 }}>
      {data.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1, borderRadius: 3,
            height: Math.max(4, (v / max) * 50),
            backgroundColor: i === data.length - 1 ? T.green : T.blue + "60",
          }}
        />
      ))}
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function ExpeditionProgressScreen() {
  useScreenView("expedition_progress");
  const insets = useSafeAreaInsets();
  const { summitGoal, sessions } = useApp();

  const target = summitGoal?.targetMountain;
  const hills  = summitGoal?.virtualHills ?? [];
  const score  = summitGoal?.simulationScore ?? 0;
  const sc     = scoreColor(score);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalElevGoal = target?.totalElevationGain ?? summitGoal?.elevationGain ?? 0;
  const totalTrained  = useMemo(
    () => sessions.reduce((s, sess) => s + (sess.elevationGain ?? 0), 0),
    [sessions],
  );
  const totalDistKm = useMemo(
    () => sessions.reduce((s, sess) => s + (sess.distance ?? 0), 0),
    [sessions],
  );
  const totalDuration = useMemo(
    () => sessions.reduce((s, sess) => s + (sess.duration ?? 0), 0),
    [sessions],
  );
  const totalHikes = sessions.length;
  const pct = totalElevGoal > 0 ? Math.min(100, Math.round(totalTrained / totalElevGoal * 100)) : 0;

  // Completed hills — those whose combined elevation has been "covered" by sessions
  // We mark hills as complete proportionally: if the user has trained X% of goal,
  // the first X% of hills (by cumulative elevation) are "completed".
  const completedHills = useMemo(() => {
    if (hills.length === 0 || totalTrained === 0) return [];
    let cumulative = 0;
    const completed: NearbyHill[] = [];
    for (const hill of hills) {
      const hillElev = hill.elevation * hill.repeats;
      cumulative += hillElev;
      if (cumulative <= totalTrained) completed.push(hill);
    }
    return completed;
  }, [hills, totalTrained]);

  const nextHill = hills.find(h => !completedHills.includes(h));

  // Last 8 weeks of elevation for mini chart
  const chartData = useMemo(() => {
    const weeks: number[] = new Array(8).fill(0);
    const now = Date.now();
    sessions.forEach(s => {
      const weeksAgo = Math.floor((now - new Date(s.date).getTime()) / (7 * 86400000));
      if (weeksAgo < 8) weeks[7 - weeksAgo] += s.elevationGain ?? 0;
    });
    return weeks;
  }, [sessions]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!summitGoal || !target) {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 32, marginTop: PILL_OFFSET }}>
          <View style={{ width: 66, height: 66, borderRadius: 18, backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={30} color={T.blue} />
          </View>
          <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: T.white, textAlign: "center" }}>
            No expedition yet
          </Text>
          <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 21 }}>
            Start a virtual expedition to track your progress toward a summit.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(expedition)/mountains" as any)}
            style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, backgroundColor: T.blue }}
          >
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>Choose Mountain</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  const topInset = Platform.OS === "web" ? 20 : insets.top;

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120 }}
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <View style={{ paddingTop: topInset + PILL_OFFSET + 12, paddingHorizontal: 16, paddingBottom: 4 }}>
          <Text style={s.pageTitle}>Expedition Progress</Text>
        </View>

        {/* ── Overall progress ring ──────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(60).duration(420)} style={s.ringCard}>
          <LinearGradient colors={["rgba(255,255,255,0.04)", "transparent"]} style={StyleSheet.absoluteFill} />
          <View style={{ alignItems: "center" }}>
            <Text style={s.overallLabel}>OVERALL PROGRESS</Text>
            <ProgressRing size={130} strokeWidth={10} score={pct} color={sc} label={`${pct}`} />
            <Text style={s.ringPct}>%</Text>
          </View>
          <View style={{ alignItems: "center", marginTop: 12, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
              <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: T.white }}>
                {totalTrained.toLocaleString()}m
              </Text>
              <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: T.textDim }}>
                / {totalElevGoal.toLocaleString()}m
              </Text>
            </View>
            <View style={s.overallBarTrack}>
              <View style={[s.overallBarFill, { width: `${pct}%` as any, backgroundColor: sc }]} />
            </View>
          </View>
        </Animated.View>

        {/* ── Activity chart ─────────────────────────────────────────────────── */}
        {sessions.length > 0 && (
          <Animated.View entering={FadeInDown.delay(120).duration(400)} style={s.chartCard}>
            <LinearGradient colors={["rgba(255,255,255,0.03)", "transparent"]} style={StyleSheet.absoluteFill} />
            <Text style={s.sectionTitle}>ELEVATION GAIN (8 WEEKS)</Text>
            <View style={{ marginTop: 12 }}>
              <SimpleBarChart data={chartData} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              {["8w ago", "", "", "", "", "", "", "This week"].map((l, i) => (
                <Text key={i} style={{ fontSize: 8, fontFamily: "Inter_400Regular", color: T.textDim }}>{l}</Text>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Completed sections ─────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(180).duration(400)} style={s.sectionCard}>
          <LinearGradient colors={["rgba(255,255,255,0.03)", "transparent"]} style={StyleSheet.absoluteFill} />
          <Text style={s.sectionTitle}>COMPLETED SECTIONS</Text>
          {completedHills.length === 0 ? (
            <View style={{ paddingVertical: 16, alignItems: "center", gap: 6 }}>
              <Circle size={22} color={T.textDim} />
              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: T.textMuted, textAlign: "center" }}>
                Log your first hill session to track completed sections
              </Text>
            </View>
          ) : (
            completedHills.map((hill, i) => {
              // Find the most recent session that could correspond to this hill
              const relSessions = sessions.filter(s => s.hillName === hill.name || !s.hillName);
              const lastSess = relSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
              return (
                <View key={hill.name + i} style={[s.completedRow, i === completedHills.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={s.checkWrap}>
                    <CheckCircle size={18} color={T.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.completedName}>{hill.name}</Text>
                    <Text style={s.completedSub}>
                      {hill.elevation}m gain · {hill.distance}km
                      {lastSess ? ` · ${relativeDate(lastSess.date)}` : ""}
                    </Text>
                  </View>
                  <ChevronRight size={14} color={T.textDim} />
                </View>
              );
            })
          )}

          {/* Next Up */}
          {nextHill && (
            <View style={s.nextUpRow}>
              <Text style={s.nextUpLabel}>NEXT UP</Text>
              <View style={[s.completedRow, { borderBottomWidth: 0, marginTop: 4 }]}>
                <View style={[s.checkWrap, { opacity: 0.4 }]}>
                  <Mountain size={16} color={T.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.completedName}>{nextHill.name}</Text>
                  <Text style={s.completedSub}>{nextHill.elevation}m gain · {nextHill.distance}km</Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push("/hike-tracking" as any)}
                  style={s.startBtn}
                  activeOpacity={0.85}
                >
                  <Text style={s.startBtnText}>Start →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>

        {/* ── Expedition stats ───────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(240).duration(400)}>
          <Text style={s.statsHeader}>EXPEDITION STATS</Text>
          <View style={s.statsGrid}>
            <StatCell icon={<Footprints size={16} color={T.blue} />} value={String(totalHikes)} label="Total Hikes" />
            <StatCell icon={<Map size={16} color={T.green} />} value={`${totalDistKm.toFixed(0)}km`} label="Total Distance" />
            <StatCell icon={<TrendingUp size={16} color={T.orange} />} value={`${(totalTrained / 1000).toFixed(1)}km`} label="Total Elev Gain" />
            <StatCell icon={<Clock size={16} color="#9B7FD4" />} value={fmtDuration(totalDuration)} label="Time on Trail" />
          </View>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCell({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <View style={s.statCell}>
      <LinearGradient colors={["rgba(255,255,255,0.04)", "transparent"]} style={StyleSheet.absoluteFill} />
      {icon}
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  pageTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 8 },
  sectionTitle: { fontSize: 9, fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 1.2, marginBottom: 4 },

  ringCard: {
    marginHorizontal: 14, marginBottom: 12, padding: 20,
    borderRadius: 20, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", gap: 0,
  },
  overallLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 1.2, marginBottom: 14 },
  ringPct: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.white, marginTop: -24 },
  overallBarTrack: { height: 6, width: 200, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.10)", overflow: "hidden", marginTop: 8 },
  overallBarFill: { height: 6, borderRadius: 3 },

  chartCard: {
    marginHorizontal: 14, marginBottom: 12, padding: 14,
    borderRadius: 16, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },

  sectionCard: {
    marginHorizontal: 14, marginBottom: 12, padding: 14,
    borderRadius: 16, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  completedRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
  },
  checkWrap: { width: 28, alignItems: "center" },
  completedName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.white },
  completedSub:  { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },

  nextUpRow: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
  },
  nextUpLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: T.blue, letterSpacing: 1.2 },
  startBtn: { backgroundColor: T.blue, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  startBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },

  statsHeader: {
    fontSize: 9, fontFamily: "Inter_700Bold", color: T.textDim,
    letterSpacing: 1.2, marginHorizontal: 14, marginBottom: 8,
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginHorizontal: 14 },
  statCell: {
    width: "47%", padding: 14, borderRadius: 14, gap: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: T.white },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim },
});
