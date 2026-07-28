/**
 * Virtual mode — Local Hills screen
 * Shows the hills near the user's location that match the target mountain's
 * elevation and distance demands, with a "why these hills?" explainer.
 */

import { Mountain, RefreshCw, Compass, MapPin, AlertTriangle } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
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

import { useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";
import { useScreenView } from "@/lib/analytics";
import type { NearbyHill, SummitGoal, TargetMountain } from "@/context/AppContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

function diffColor(diff: string): string {
  if (diff === "Easy")     return T.green;
  if (diff === "Moderate") return T.blue;
  if (diff === "Hard")     return T.orange;
  return "#FF4444";
}

interface VirtualExpeditionResponse {
  targetProfile: TargetMountain & { notes?: string | null };
  recommendedHills: NearbyHill[];
  simulationScore: number;
  scoreBreakdown: import("@/context/AppContext").SimulationScoreBreakdown;
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function VirtualHillsScreen() {
  useScreenView("virtual_hills");
  const insets = useSafeAreaInsets();
  const { summitGoal, patchGoal } = useApp();

  const hasCachedData =
    !!summitGoal?.simulationScore &&
    !!summitGoal?.targetMountain &&
    !!summitGoal?.virtualHills?.length;

  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function fetchExpedition() {
    if (!summitGoal) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/virtual-expedition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetMountain: summitGoal.mountainName,
          userLocation: summitGoal.location,
          radius: summitGoal.maxRadius ?? 30,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server error ${res.status}`);
      }
      const data: VirtualExpeditionResponse = await res.json();
      await patchGoal({
        targetMountain: data.targetProfile,
        simulationScore: data.simulationScore,
        simulationScoreBreakdown: data.scoreBreakdown,
        virtualHills: data.recommendedHills,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load hill data.");
    } finally {
      setLoading(false);
    }
  }

  if (!summitGoal) {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
        <Mountain size={36} color={T.blue} />
        <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: T.white }}>No summit set</Text>
        <TouchableOpacity onPress={() => router.push("/setup")} style={{ paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, backgroundColor: T.blue }}>
          <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>Choose your summit</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  const hills  = summitGoal.virtualHills ?? [];
  const target = summitGoal.targetMountain;
  const topPad = Platform.OS === "web" ? 56 : insets.top + 16;
  const botPad = Platform.OS === "web" ? 120 : insets.bottom + 120;
  const isWeekend = hills.length >= 2;

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad, paddingHorizontal: 16, gap: 14 }}
      >
        {/* ── Screen header ───────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(0).duration(400)}>
          <Text style={s.screenTitle}>Local Hills</Text>
          <Text style={s.screenSub}>
            Hills near {summitGoal.location} that count toward {summitGoal.mountainName}
          </Text>
        </Animated.View>

        {/* ── Explainer card ──────────────────────────────────────────────────── */}
        {target && (
          <Animated.View entering={FadeInDown.delay(40).duration(400)}>
            <View style={s.explainerCard}>
              <LinearGradient colors={[T.blueDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View style={s.explainerIcon}>
                  <Compass size={16} color={T.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.explainerTitle}>Why these hills?</Text>
                  <Text style={s.explainerText}>
                    {target.name} demands {target.totalElevationGain}m of elevation gain over {target.totalDistance}km.
                    {isWeekend
                      ? ` These two hills, ridden back-to-back over a weekend, replicate that combined effort — matching both the total ascent and the consecutive-day demand of the summit.`
                      : ` This hill, repeated ${hills[0]?.repeats ?? 1} times, matches the total elevation demand of the summit.`}
                    {target.altitudeExposure !== "None"
                      ? ` Note: altitude above ${hills[0]?.summitElevationASL ?? "?"}m cannot be replicated locally — consider additional acclimatisation.`
                      : ""}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── No data state ──────────────────────────────────────────────────── */}
        {!hasCachedData && !loading && (
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <View style={[s.card, { alignItems: "center", gap: 14, paddingVertical: 32 }]}>
              <Mountain size={30} color={T.blue} />
              <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: T.white }}>No hills matched yet</Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 19 }}>
                Tap below to search for hills near {summitGoal.location} that match {summitGoal.mountainName}'s demands.
              </Text>
              {error && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <AlertTriangle size={13} color={T.orange} />
                  <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: T.orange }}>{error}</Text>
                </View>
              )}
              <TouchableOpacity
                onPress={fetchExpedition}
                disabled={loading}
                style={{ paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, backgroundColor: T.blue }}
              >
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>Find my hills</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* ── Loading ────────────────────────────────────────────────────────── */}
        {loading && (
          <View style={[s.card, { alignItems: "center", gap: 12, paddingVertical: 32 }]}>
            <ActivityIndicator color={T.blue} />
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted }}>
              Searching hills near {summitGoal.location}…
            </Text>
          </View>
        )}

        {/* ── Hill cards ─────────────────────────────────────────────────────── */}
        {hills.length > 0 && (
          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={{ gap: 10 }}>
            <Text style={s.sectionLabel}>
              {isWeekend ? "YOUR WEEKEND PAIRING" : "YOUR HILL"}
            </Text>
            {hills.map((hill, idx) => (
              <HillCard
                key={hill.name}
                hill={hill}
                dayLabel={isWeekend ? (idx === 0 ? "Saturday" : "Sunday") : undefined}
                target={target}
              />
            ))}
          </Animated.View>
        )}

        {/* ── Target matchup summary ─────────────────────────────────────────── */}
        {target && hills.length > 0 && (
          <Animated.View entering={FadeInDown.delay(120).duration(400)}>
            <Text style={s.sectionLabel}>HOW THESE HILLS MATCH {target.name.toUpperCase()}</Text>
            <View style={s.card}>
              <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
              {[
                {
                  label: "Elevation gain",
                  local: `${hills.reduce((t, h) => t + h.totalElevation, 0)}m`,
                  target_val: `${target.totalElevationGain}m`,
                },
                {
                  label: "Distance",
                  local: `~${hills.reduce((t, h) => t + (h.routeDistance ?? h.distance * 2), 0).toFixed(0)}km`,
                  target_val: `${target.totalDistance}km`,
                },
                {
                  label: "Days on feet",
                  local: isWeekend ? "2 days" : "1 day",
                  target_val: `${target.estimatedDays} day${target.estimatedDays > 1 ? "s" : ""}`,
                },
              ].map((row, i, arr) => (
                <View key={row.label} style={[s.matchRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.border }]}>
                  <Text style={s.matchLabel}>{row.label}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={s.matchLocal}>{row.local}</Text>
                    <Text style={{ fontSize: 11, color: T.textDim }}>vs</Text>
                    <Text style={s.matchTarget}>{row.target_val}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Refresh ─────────────────────────────────────────────────────────── */}
        {hasCachedData && (
          <Animated.View entering={FadeInDown.delay(160).duration(400)}>
            <TouchableOpacity
              onPress={fetchExpedition}
              disabled={loading}
              activeOpacity={0.75}
              style={s.refreshBtn}
            >
              {loading
                ? <ActivityIndicator color={T.textMuted} size="small" />
                : <RefreshCw size={13} color={T.textMuted} />}
              <Text style={s.refreshText}>{loading ? "Searching…" : "Refresh hill recommendations"}</Text>
            </TouchableOpacity>
            <Text style={s.refreshHint}>
              Use this if you change your location or want different hill options.
            </Text>
          </Animated.View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

// ── Hill card ──────────────────────────────────────────────────────────────────

function HillCard({
  hill,
  dayLabel,
  target,
}: {
  hill: NearbyHill;
  dayLabel?: string;
  target?: TargetMountain | null;
}) {
  return (
    <View style={s.hillCard}>
      <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
      {dayLabel && <Text style={s.hillDay}>{dayLabel}</Text>}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={s.hillIconWrap}>
          <Text style={{ fontSize: 22 }}>{hill.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.hillName}>{hill.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
            <MapPin size={11} color={T.textDim} />
            <Text style={s.hillMeta}>{hill.surface} · {hill.grade} · {hill.distance}km away</Text>
          </View>
        </View>
        <View style={[s.gradeBadge, { backgroundColor: diffColor(hill.grade) + "22", borderColor: diffColor(hill.grade) + "50" }]}>
          <Text style={[s.gradeText, { color: diffColor(hill.grade) }]}>{hill.grade}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        <HillStat value={`${hill.elevation}m`} label="per rep" />
        <View style={s.statDiv} />
        <HillStat value={`×${hill.repeats}`} label="reps" />
        <View style={s.statDiv} />
        <HillStat value={`${hill.totalElevation}m`} label="total gain" />
        {hill.summitElevationASL ? (
          <>
            <View style={s.statDiv} />
            <HillStat value={`${hill.summitElevationASL}m`} label="summit ASL" />
          </>
        ) : null}
      </View>

      {/* Route type badge */}
      {hill.routeType && (
        <Text style={s.routeType}>
          {hill.routeType === "circular" ? "🔄 Circular route" : hill.routeType === "out-and-back" ? "↔️ Out & back" : "⛰ Hill repeats"}
          {hill.estimatedTime ? `  ·  ~${hill.estimatedTime}` : ""}
        </Text>
      )}
    </View>
  );
}

function HillStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: T.white }}>{value}</Text>
      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screenTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 4 },
  screenSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18 },
  sectionLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim,
    letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 8,
  },
  card: {
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.border,
    padding: 16, overflow: "hidden",
  },
  explainerCard: {
    backgroundColor: T.card, borderRadius: 14,
    borderWidth: 1, borderColor: T.blueDim,
    padding: 14, overflow: "hidden",
  },
  explainerIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center",
  },
  explainerTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 4 },
  explainerText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18 },
  hillCard: {
    backgroundColor: T.card, borderRadius: 14,
    borderWidth: 1, borderColor: T.border,
    padding: 14, gap: 10, overflow: "hidden",
  },
  hillDay: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: T.green,
    textTransform: "uppercase", letterSpacing: 1,
  },
  hillIconWrap: {
    width: 46, height: 46, borderRadius: 13,
    backgroundColor: T.greenDim, alignItems: "center", justifyContent: "center",
  },
  hillName: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.white },
  hillMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  gradeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  gradeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statsRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface, borderRadius: 10,
    paddingVertical: 9, paddingHorizontal: 6,
  },
  statDiv: { width: 1, height: 24, backgroundColor: T.border },
  routeType: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim },
  matchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  matchLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: T.text, flex: 1 },
  matchLocal: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.green },
  matchTarget: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },
  refreshBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    paddingVertical: 13, borderRadius: 14,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
  },
  refreshText: { fontSize: 14, fontFamily: "Inter_500Medium", color: T.textMuted },
  refreshHint: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center", marginTop: 6 },
});
