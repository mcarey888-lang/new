/**
 * Track — Expedition activity hub.
 * Matches reference design: GPS indicator, large "Track Activity" header,
 * stats from recent sessions, and a prominent "Start Activity" CTA
 * that launches the full hike-tracking screen.
 */

import {
  Radio, Play, TrendingUp, Map, Clock, Footprints,
  ChevronRight, Mountain, Activity, Zap,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useState } from "react";
import {
  Platform, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ACTIVE_HIKE_KEY = "summitready_active_hike_session";

function useActiveHike() {
  const [activeHike, setActiveHike] = useState<{ routeName: string; trackStartMs: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        const raw = await AsyncStorage.getItem(ACTIVE_HIKE_KEY);
        if (!raw || !mounted) return;
        const session = JSON.parse(raw);
        const ageMs = Date.now() - (session.savedAt ?? 0);
        if (ageMs < 24 * 60 * 60 * 1000) setActiveHike(session);
      } catch { /* ignore */ }
    }
    check();
    // Re-check each time the screen comes into focus
    const id = setInterval(check, 3000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return activeHike;
}

import { useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";
import { useScreenView } from "@/lib/analytics";

const PILL_OFFSET = 52;

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function relativeDate(dateStr: string): string {
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function TrackScreen() {
  useScreenView("expedition_track");
  const insets = useSafeAreaInsets();
  const { sessions, summitGoal } = useApp();
  const activeHike = useActiveHike();

  const topInset = Platform.OS === "web" ? 20 : insets.top;

  const totalElev = useMemo(() => sessions.reduce((s, sess) => s + (sess.elevationGain ?? 0), 0), [sessions]);
  const totalDist = useMemo(() => sessions.reduce((s, sess) => s + (sess.distance ?? 0), 0), [sessions]);
  const totalTime = useMemo(() => sessions.reduce((s, sess) => s + (sess.duration ?? 0), 0), [sessions]);
  const avgPace   = useMemo(() => {
    if (totalDist < 0.1 || totalTime === 0) return null;
    const minPerKm = totalTime / totalDist;
    const m = Math.floor(minPerKm);
    const s = Math.round((minPerKm - m) * 60);
    return `${m}:${s.toString().padStart(2, "0")}/km`;
  }, [totalDist, totalTime]);

  const recentSessions = useMemo(
    () => [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
    [sessions],
  );

  const nextHill = summitGoal?.virtualHills?.[0];

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120 }}
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <View style={{ paddingTop: topInset + PILL_OFFSET + 12, paddingHorizontal: 16, paddingBottom: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            {/* GPS status pill */}
            <View style={s.gpsPill}>
              <View style={s.gpsDot} />
              <Text style={s.gpsText}>GPS</Text>
            </View>
            <Text style={s.pageTitle}>Track Activity</Text>
          </View>
          <View style={s.settingsBtn}>
            <Activity size={18} color={T.textMuted} />
          </View>
        </View>

        {/* ── Resume active tracking banner ────────────────────────────────── */}
        {activeHike && (
          <Animated.View entering={FadeInDown.delay(30).duration(350)} style={{ marginHorizontal: 14, marginBottom: 12 }}>
            <TouchableOpacity
              onPress={() => router.push("/hike-tracking" as any)}
              style={s.resumeBanner}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={["rgba(62,207,117,0.18)", "rgba(62,207,117,0.08)"]}
                style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
              />
              <View style={s.resumeDot} />
              <View style={{ flex: 1 }}>
                <Text style={s.resumeTitle}>Tracking active</Text>
                <Text style={s.resumeSub} numberOfLines={1}>{activeHike.routeName || "Hike in progress"}</Text>
              </View>
              <ChevronRight size={18} color={T.green} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Lifetime stats big card ───────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(60).duration(420)} style={s.statsCard}>
          <LinearGradient colors={["rgba(255,255,255,0.05)", "transparent"]} style={StyleSheet.absoluteFill} />
          <View style={s.bigStatRow}>
            <View style={s.bigStat}>
              <Text style={[s.bigStatValue, { color: T.green }]}>{totalDist.toFixed(2)}</Text>
              <Text style={s.bigStatUnit}>km</Text>
            </View>
            <View style={s.bigStatDiv} />
            <View style={s.bigStat}>
              <Text style={[s.bigStatValue, { color: T.blue }]}>{(totalElev / 1000).toFixed(2)}</Text>
              <Text style={s.bigStatUnit}>km↑</Text>
            </View>
            <View style={s.bigStatDiv} />
            <View style={s.bigStat}>
              <Text style={[s.bigStatValue, { color: T.orange }]}>{avgPace ?? "--"}</Text>
              <Text style={s.bigStatUnit}>avg pace</Text>
            </View>
          </View>
          <View style={s.subStatRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Clock size={12} color={T.textDim} />
              <Text style={s.subStatText}>{fmtDuration(totalTime)} total</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Footprints size={12} color={T.textDim} />
              <Text style={s.subStatText}>{sessions.length} sessions</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Start Activity CTA ───────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={{ marginHorizontal: 14, marginBottom: 14 }}>
          {nextHill && (
            <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: T.textDim, marginBottom: 8 }}>
              Next mission: <Text style={{ color: T.green }}>{nextHill.name}</Text> · {nextHill.elevation}m gain
            </Text>
          )}
          <TouchableOpacity
            onPress={() => router.push("/hike-tracking" as any)}
            style={s.startBtn}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={[T.green, "#2AB85A"]}
              style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
            />
            <Play size={20} color="#fff" fill="#fff" />
            <Text style={s.startBtnText}>Start Activity</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              onPress={() => router.push("/log-hill" as any)}
              style={s.secondaryBtn}
              activeOpacity={0.8}
            >
              <Mountain size={15} color={T.blue} />
              <Text style={s.secondaryBtnText}>Log Hill Session</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/trails" as any)}
              style={s.secondaryBtn}
              activeOpacity={0.8}
            >
              <Map size={15} color={T.blue} />
              <Text style={s.secondaryBtnText}>Find Hills</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Recent sessions ───────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(180).duration(400)} style={s.recentCard}>
          <LinearGradient colors={["rgba(255,255,255,0.03)", "transparent"]} style={StyleSheet.absoluteFill} />
          <View style={s.cardHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Zap size={13} color={T.orange} />
              <Text style={s.cardTitle}>RECENT ACTIVITY</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(tabs)/hikes" as any)}>
              <Text style={s.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {recentSessions.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: "center", gap: 8 }}>
              <Activity size={28} color={T.textDim} />
              <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.textMuted, textAlign: "center" }}>
                No activities yet
              </Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center" }}>
                Start tracking to see your history here
              </Text>
            </View>
          ) : (
            recentSessions.map((sess, i) => (
              <View key={sess.id ?? i} style={[s.sessionRow, i === recentSessions.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={s.sessionIcon}>
                  <Mountain size={14} color={T.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sessionName} numberOfLines={1}>
                    {sess.hillName ?? "Training Session"}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <Map size={10} color={T.textDim} />
                      <Text style={s.sessionMeta}>{sess.distance?.toFixed(1) ?? "0"}km</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <TrendingUp size={10} color={T.textDim} />
                      <Text style={s.sessionMeta}>{sess.elevationGain}m gain</Text>
                    </View>
                    {sess.duration > 0 && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <Clock size={10} color={T.textDim} />
                        <Text style={s.sessionMeta}>{fmtDuration(sess.duration)}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={s.sessionDate}>{relativeDate(sess.date)}</Text>
              </View>
            ))
          )}
        </Animated.View>

        {/* ── Quick stats mini grid ─────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", gap: 8, marginHorizontal: 14 }}>
          {[
            { icon: <TrendingUp size={16} color={T.blue} />, val: `${totalElev.toLocaleString()}m`, lbl: "Elev Gain" },
            { icon: <Clock size={16} color={T.orange} />, val: fmtDuration(totalTime), lbl: "Time on Trail" },
          ].map(({ icon, val, lbl }) => (
            <View key={lbl} style={s.miniStatCard}>
              <LinearGradient colors={["rgba(255,255,255,0.04)", "transparent"]} style={StyleSheet.absoluteFill} />
              {icon}
              <Text style={s.miniStatVal}>{val}</Text>
              <Text style={s.miniStatLbl}>{lbl}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  gpsPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    marginBottom: 4,
  },
  gpsDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: T.green },
  gpsText: { fontSize: 11, fontFamily: "Inter_700Bold", color: T.green, letterSpacing: 1 },
  pageTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.white },
  settingsBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },

  statsCard: {
    marginHorizontal: 14, marginBottom: 14, padding: 16,
    borderRadius: 20, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    gap: 12,
  },
  bigStatRow: { flexDirection: "row", alignItems: "center" },
  bigStat: { flex: 1, alignItems: "center" },
  bigStatValue: { fontSize: 22, fontFamily: "Inter_700Bold", lineHeight: 26 },
  bigStatUnit:  { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 2 },
  bigStatDiv: { width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.08)" },
  subStatRow: {
    flexDirection: "row", justifyContent: "center", gap: 20,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
  },
  subStatText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim },

  startBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 18, borderRadius: 18, overflow: "hidden",
  },
  startBtnText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },

  secondaryBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  secondaryBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.blue },

  recentCard: {
    marginHorizontal: 14, marginBottom: 14, padding: 14,
    borderRadius: 18, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  cardTitle: { fontSize: 9, fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 1.2 },
  viewAll: { fontSize: 11, fontFamily: "Inter_500Medium", color: T.blue },

  sessionRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  sessionIcon: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: T.greenDim, alignItems: "center", justifyContent: "center",
  },
  sessionName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.white },
  sessionMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim },
  sessionDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim },

  miniStatCard: {
    flex: 1, padding: 14, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    gap: 6, overflow: "hidden",
  },
  miniStatVal: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.white },
  miniStatLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim },

  resumeBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 16, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(62,207,117,0.30)",
    backgroundColor: "rgba(62,207,117,0.06)",
  },
  resumeDot: {
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: T.green,
    shadowColor: T.green, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
  },
  resumeTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.green },
  resumeSub:   { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
});
