/**
 * Base Camp — Expedition shell home screen.
 * Shows the active virtual expedition: hero mountain image, simulation score,
 * target mountain profile, and recommended local hills.
 *
 * Adapted from v-home.tsx. Mode switching is handled by ModeTogglePill
 * (no in-screen switch button needed here).
 */

import {
  Mountain, MapPin, RefreshCw, ChevronRight, AlertTriangle,
} from "lucide-react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";
import { ProgressRing } from "@/components/ProgressRing";
import { useScreenView } from "@/lib/analytics";
import type { NearbyHill, SummitGoal, TargetMountain } from "@/context/AppContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

// Extra top padding for the ModeTogglePill overlay
const PILL_OFFSET = 52;

// ── Helpers ────────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 80) return T.green;
  if (score >= 60) return T.blue;
  if (score >= 40) return T.orange;
  return T.red;
}

function scoreLabel(score: number) {
  if (score >= 80) return "Excellent match";
  if (score >= 60) return "Good match";
  if (score >= 40) return "Partial match";
  return "Early stages";
}

interface VirtualExpeditionResponse {
  targetProfile: TargetMountain & { notes?: string | null };
  recommendedHills: NearbyHill[];
  simulationScore: number;
  scoreBreakdown: import("@/context/AppContext").SimulationScoreBreakdown;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function HillRow({ hill, index }: { hill: NearbyHill; index: number }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(400)}
      style={s.hillRow}
    >
      <View style={s.hillIcon}>
        <Mountain size={14} color={T.blue} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.hillName}>{hill.name}</Text>
        <Text style={s.hillSub}>
          {hill.elevation}m gain · {hill.distance}km · {hill.repeats}× rep
        </Text>
      </View>
      <ChevronRight size={14} color={T.textDim} />
    </Animated.View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function BaseCampScreen() {
  useScreenView("expedition_base_camp");
  const insets = useSafeAreaInsets();
  const { summitGoal, trainingPlan, patchGoal, setSummitGoal } = useApp();

  const hasCachedData =
    !!summitGoal?.simulationScore &&
    !!summitGoal?.targetMountain &&
    !!summitGoal?.simulationScoreBreakdown;

  const [loading, setLoading] = useState(!hasCachedData);
  const [error, setError]     = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const heroUri = imgError || !summitGoal
    ? null
    : `${API_BASE}/mountain-image?name=${encodeURIComponent(summitGoal.mountainName)}&width=800&height=400`;

  async function fetchExpedition(force = false) {
    if (!summitGoal) return;
    if (!force && hasCachedData) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/virtual-expedition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetMountain: summitGoal.mountainName,
          userLocation:   summitGoal.location,
          radius:         summitGoal.maxRadius ?? 30,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server error ${res.status}`);
      }
      const data: VirtualExpeditionResponse = await res.json();
      await patchGoal({
        targetMountain:            data.targetProfile,
        simulationScore:           data.simulationScore,
        simulationScoreBreakdown:  data.scoreBreakdown,
        virtualHills:              data.recommendedHills,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load expedition data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchExpedition(); }, []); // eslint-disable-line

  // ── No goal ──────────────────────────────────────────────────────────────────
  if (!summitGoal) {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 32, marginTop: PILL_OFFSET }}>
          <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center" }}>
            <Mountain size={36} color={T.blue} />
          </View>
          <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: T.white, textAlign: "center" }}>
            Choose your expedition
          </Text>
          <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 21 }}>
            Browse virtual mountains and select one to start your expedition.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(expedition)/mountains" as any)}
            style={{ paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16, backgroundColor: T.blue }}
          >
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Browse Mountains</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  const topInset  = Platform.OS === "web" ? 20 : insets.top;
  const score     = summitGoal.simulationScore ?? 0;
  const hills     = summitGoal.virtualHills ?? [];
  const sc        = scoreColor(score);
  const target    = summitGoal.targetMountain;

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120 }}
      >
        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <View style={s.heroWrap}>
          {heroUri ? (
            <ExpoImage
              source={{ uri: heroUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <LinearGradient
              colors={["#0E2240", "#071428", T.bg]}
              style={StyleSheet.absoluteFill}
            />
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.50)", "transparent"]}
            style={[StyleSheet.absoluteFill, { height: "45%" }]}
          />
          <LinearGradient
            colors={["transparent", "rgba(6,10,20,0.88)", T.bg]}
            style={[StyleSheet.absoluteFill, { top: "38%" }]}
          />

          {/* Top row — pill offset + refresh */}
          <View style={[s.heroTopRow, { paddingTop: topInset + PILL_OFFSET + 8 }]}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={() => fetchExpedition(true)}
              style={s.refreshBtn}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator size="small" color={T.blue} />
                : <RefreshCw size={16} color={T.blue} />
              }
            </TouchableOpacity>
          </View>

          {/* Mountain name block */}
          <View style={s.heroNameBlock}>
            <Text style={s.heroMountain}>{summitGoal.mountainName}</Text>
            {target && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <MapPin size={12} color="rgba(255,255,255,0.55)" />
                <Text style={s.heroSub}>
                  {target.country}  ·  {target.summitElevation.toLocaleString()}m
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Score card ─────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(120).duration(450)} style={s.scoreCard}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.scoreLabel}>SIMULATION SCORE</Text>
            {loading && !hasCachedData ? (
              <ActivityIndicator color={T.blue} />
            ) : error ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={14} color={T.orange} />
                <Text style={{ fontSize: 12, color: T.orange, fontFamily: "Inter_400Regular", flex: 1 }}>{error}</Text>
              </View>
            ) : (
              <>
                <Text style={[s.scoreBig, { color: sc }]}>{score}</Text>
                <Text style={[s.scoreDesc, { color: sc }]}>{scoreLabel(score)}</Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 2 }}>
                  Your local hills vs {summitGoal.mountainName}'s demands
                </Text>
              </>
            )}
          </View>
          {!loading && !error && (
            <ProgressRing
              size={88}
              strokeWidth={7}
              score={score}
              color={sc}
              label={`${score}`}
            />
          )}
        </Animated.View>

        {/* ── Your hills ─────────────────────────────────────────────────────── */}
        {hills.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(450)} style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>YOUR EQUIVALENT HILLS</Text>
              <TouchableOpacity onPress={() => router.push("/(expedition)/route" as any)}>
                <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: T.blue }}>See route →</Text>
              </TouchableOpacity>
            </View>
            {hills.slice(0, 4).map((h, i) => (
              <HillRow key={h.name + i} hill={h} index={i} />
            ))}
            {hills.length > 4 && (
              <Text style={{ fontSize: 12, color: T.textDim, fontFamily: "Inter_400Regular", marginTop: 6 }}>
                +{hills.length - 4} more hills
              </Text>
            )}
          </Animated.View>
        )}

        {/* ── Target profile ─────────────────────────────────────────────────── */}
        {target && (
          <Animated.View entering={FadeInDown.delay(300).duration(450)} style={s.section}>
            <Text style={s.sectionTitle}>EXPEDITION PROFILE</Text>
            <View style={s.profileGrid}>
              <StatCell label="Summit" value={`${target.summitElevation.toLocaleString()}m`} />
              <StatCell label="Elevation gain" value={`${target.totalElevationGain.toLocaleString()}m`} />
              <StatCell label="Difficulty" value={target.difficulty} />
              <StatCell label="Duration" value={`${target.estimatedDays} day${target.estimatedDays > 1 ? "s" : ""}`} />
            </View>
            {target.notes && (
              <Text style={s.profileNotes}>{target.notes}</Text>
            )}
          </Animated.View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statCell}>
      <Text style={s.statLabel}>{label.toUpperCase()}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  // Hero
  heroWrap: { height: 260, overflow: "hidden" },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  refreshBtn: {
    width: 36, height: 36,
    borderRadius: 12,
    backgroundColor: T.blueDim,
    alignItems: "center",
    justifyContent: "center",
  },
  heroNameBlock: {
    position: "absolute",
    bottom: 14,
    left: 16,
    right: 16,
    gap: 4,
  },
  heroMountain: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    lineHeight: 33,
  },
  heroSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
  },

  // Score card
  scoreCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 14,
    marginTop: -4,
    marginBottom: 8,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 12,
  },
  scoreLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: T.textDim,
    letterSpacing: 1,
  },
  scoreBig: {
    fontSize: 38,
    fontFamily: "Inter_700Bold",
    lineHeight: 42,
  },
  scoreDesc: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },

  // Section
  section: {
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    gap: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: T.textDim,
    letterSpacing: 1,
  },

  // Hill row
  hillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  hillIcon: {
    width: 28, height: 28,
    borderRadius: 8,
    backgroundColor: T.blueDim,
    alignItems: "center",
    justifyContent: "center",
  },
  hillName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: T.white,
  },
  hillSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
  },

  // Profile grid
  profileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statCell: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    padding: 10,
    gap: 3,
  },
  statLabel: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: T.textDim,
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: T.white,
  },
  profileNotes: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    lineHeight: 18,
    paddingTop: 4,
  },
});
