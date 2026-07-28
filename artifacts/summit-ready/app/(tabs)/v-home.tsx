/**
 * Virtual mode Home screen
 * Aspirational, hiker-focused — centres on the dream summit and local hills
 * that build toward it, not on training metrics or session logs.
 */

import { Mountain, MapPin, RefreshCw, Compass, ChevronRight, AlertTriangle } from "lucide-react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { confirmModeSwitch } from "@/utils/modeSwitch";
import { T } from "@/constants/theme";
import { ProgressRing } from "@/components/ProgressRing";
import { useScreenView } from "@/lib/analytics";
import type { NearbyHill, SummitGoal, TargetMountain } from "@/context/AppContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

// ── Score helpers ──────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return T.green;
  if (score >= 60) return T.blue;
  if (score >= 40) return T.orange;
  return T.red;
}

function scoreLabel(score: number): string {
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

// ── Main screen ────────────────────────────────────────────────────────────────

export default function VirtualHomeScreen() {
  useScreenView("virtual_home");
  const insets = useSafeAreaInsets();
  const { summitGoal, trainingPlan, patchGoal, setSummitGoal } = useApp();

  const hasCachedData =
    !!summitGoal?.simulationScore &&
    !!summitGoal?.targetMountain &&
    !!summitGoal?.simulationScoreBreakdown;

  const [loading, setLoading] = useState(!hasCachedData);
  const [error, setError]   = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const heroUri = imageError || !summitGoal
    ? null
    : `${API_BASE}/mountain-image?name=${encodeURIComponent(summitGoal.mountainName)}`;

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
      setError(err instanceof Error ? err.message : "Couldn't load expedition data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchExpedition(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!summitGoal) {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
        <Mountain size={40} color={T.blue} />
        <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: T.white, textAlign: "center" }}>
          No summit chosen yet
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/setup")}
          style={{ paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14, backgroundColor: T.blue }}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Choose your summit</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  const topInset = Platform.OS === "web" ? 20 : insets.top;
  const score    = summitGoal.simulationScore ?? 0;
  const hills    = summitGoal.virtualHills ?? [];
  const sc       = scoreColor(score);
  const target   = summitGoal.targetMountain;

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120 }}
      >
        {/* ── Hero image ─────────────────────────────────────────────────────── */}
        <View style={s.heroContainer}>
          {heroUri ? (
            <ImageBackground
              source={{ uri: heroUri }}
              style={s.heroImage}
              resizeMode="cover"
              onError={() => setImageError(true)}
            >
              <LinearGradient
                colors={["rgba(0,0,0,0.55)", "transparent"]}
                style={[StyleSheet.absoluteFill, { height: "50%" }]}
              />
              <LinearGradient
                colors={["transparent", "rgba(6,10,20,0.92)", T.bg]}
                style={[StyleSheet.absoluteFill, { top: "38%" }]}
              />
              <HeroOverlay
                summitGoal={summitGoal}
                topInset={topInset}
                onSwitchMode={() => confirmModeSwitch("expedition", summitGoal, trainingPlan, setSummitGoal)}
              />
            </ImageBackground>
          ) : (
            <LinearGradient colors={["#0E2240", "#071428", T.bg]} style={s.heroImage}>
              <View style={[StyleSheet.absoluteFillObject, { alignItems: "center", justifyContent: "center", marginBottom: 60 }]}>
                <Text style={{ fontSize: 72 }}>🏔️</Text>
              </View>
              <HeroOverlay
                summitGoal={summitGoal}
                topInset={topInset}
                onSwitchMode={() => confirmModeSwitch("expedition", summitGoal, trainingPlan, setSummitGoal)}
              />
            </LinearGradient>
          )}
        </View>

        {/* ── Simulation score ring ───────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(60).duration(500)} style={s.scoreSection}>
          {loading && !hasCachedData ? (
            <View style={[s.card, { alignItems: "center", gap: 12, paddingVertical: 32 }]}>
              <ActivityIndicator color={T.blue} />
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted }}>
                Finding your equivalent hills…
              </Text>
            </View>
          ) : error && !hasCachedData ? (
            <View style={[s.card, { alignItems: "center", gap: 12, paddingVertical: 24 }]}>
              <AlertTriangle size={22} color={T.orange} />
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" }}>
                {error}
              </Text>
              <TouchableOpacity
                onPress={() => void fetchExpedition(true)}
                style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 11, backgroundColor: T.blueDim, borderWidth: 1, borderColor: T.blue + "40" }}
              >
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.blue }}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[s.card, { alignItems: "center", paddingVertical: 28 }]}>
              <LinearGradient colors={[sc + "14", "transparent"]} style={StyleSheet.absoluteFill} />
              <Text style={s.scoreLabel}>LOCAL HILL MATCH</Text>
              <ProgressRing
                score={score}
                size={140}
                strokeWidth={11}
                color={sc}
                sublabel={scoreLabel(score)}
              />
              <Text style={[s.scoreCaption, { color: T.textMuted, marginTop: 12 }]}>
                {score >= 80
                  ? `Your local hills closely replicate ${summitGoal.mountainName}'s demands.`
                  : score >= 60
                  ? `Good terrain match — keep building elevation reps.`
                  : score >= 40
                  ? `Solid foundation. Consistent hill days will close the gap.`
                  : `Every ascent counts. You're building the base for your dream.`}
              </Text>
              <TouchableOpacity
                onPress={() => void fetchExpedition(true)}
                disabled={loading}
                style={s.refreshBtn}
              >
                {loading
                  ? <ActivityIndicator color={T.textMuted} size="small" />
                  : <RefreshCw size={13} color={T.textMuted} />}
                <Text style={s.refreshText}>{loading ? "Refreshing…" : "Refresh"}</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        {/* ── This weekend's hills ────────────────────────────────────────────── */}
        {hills.length > 0 && (
          <Animated.View entering={FadeInDown.delay(120).duration(500)} style={{ paddingHorizontal: 16, gap: 10 }}>
            <Text style={s.sectionTitle}>THIS WEEKEND'S HILLS</Text>
            {hills.slice(0, 2).map((hill, idx) => (
              <TouchableOpacity
                key={hill.name}
                onPress={() => router.push("/(tabs)/v-hills")}
                activeOpacity={0.8}
                style={s.hillPreviewCard}
              >
                <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
                {hills.length >= 2 && (
                  <Text style={s.hillDayLabel}>{idx === 0 ? "Saturday" : "Sunday"}</Text>
                )}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={s.hillEmoji}>
                    <Text style={{ fontSize: 22 }}>{hill.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.hillName}>{hill.name}</Text>
                    <Text style={s.hillSub}>{hill.surface} · {hill.grade} · {hill.distance}km away</Text>
                  </View>
                  <ChevronRight size={16} color={T.textDim} />
                </View>
                <View style={s.hillStatsRow}>
                  <MiniStat value={`${hill.elevation}m`} label="per rep" />
                  <View style={s.hillStatDiv} />
                  <MiniStat value={`×${hill.repeats}`} label="reps" />
                  <View style={s.hillStatDiv} />
                  <MiniStat value={`${hill.totalElevation}m`} label="total gain" />
                </View>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}

        {/* ── Mountain preview card ───────────────────────────────────────────── */}
        {target && (
          <Animated.View entering={FadeInDown.delay(180).duration(500)} style={{ paddingHorizontal: 16, marginTop: 10 }}>
            <Text style={s.sectionTitle}>YOUR DREAM SUMMIT</Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/v-mountain")}
              activeOpacity={0.8}
              style={s.mountainPreviewCard}
            >
              <LinearGradient colors={[T.blueDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={s.mountainIconWrap}>
                  <Mountain size={20} color={T.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.mountainPreviewName}>{target.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
                    <MapPin size={11} color={T.textDim} />
                    <Text style={s.mountainPreviewSub}>{target.country} · {target.summitElevation}m summit · {target.difficulty}</Text>
                  </View>
                </View>
                <ChevronRight size={16} color={T.textDim} />
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Empty state if no hills yet ─────────────────────────────────────── */}
        {hills.length === 0 && !loading && (
          <Animated.View entering={FadeInDown.delay(120).duration(500)} style={{ paddingHorizontal: 16, marginTop: 10 }}>
            <View style={[s.card, { alignItems: "center", gap: 12, paddingVertical: 28 }]}>
              <Compass size={28} color={T.blue} />
              <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.white }}>
                Finding your hills…
              </Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 19 }}>
                We'll search for local hills near {summitGoal.location} that match {summitGoal.mountainName}'s demands.
              </Text>
              <TouchableOpacity
                onPress={() => void fetchExpedition(true)}
                style={{ paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12, backgroundColor: T.blue }}
              >
                <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" }}>Find my hills</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

// ── Hero overlay ───────────────────────────────────────────────────────────────

function HeroOverlay({
  summitGoal,
  topInset,
  onSwitchMode,
}: {
  summitGoal: SummitGoal;
  topInset: number;
  onSwitchMode: () => void;
}) {
  return (
    <View style={[s.heroOverlay, { paddingTop: topInset + 12 }]}>
      {/* Top row: logo + switch mode button */}
      <View style={s.heroTopRow}>
        <ExpoImage source={require("@/assets/images/logo.gif")} style={s.heroLogo} contentFit="contain" />
        <TouchableOpacity onPress={onSwitchMode} style={s.switchModeBtn} activeOpacity={0.8}>
          <Text style={s.switchModeBtnText}>⚡ Training</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom: aspirational headline */}
      <View style={s.heroBottom}>
        <Text style={s.heroLabel}>YOU'RE CHASING</Text>
        <Text style={s.heroMountainName} numberOfLines={2}>{summitGoal.mountainName}</Text>
        <View style={s.heroBadges}>
          <View style={s.heroBadge}>
            <MapPin size={11} color="rgba(255,255,255,0.7)" />
            <Text style={s.heroBadgeText}>{summitGoal.location}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Mini helpers ───────────────────────────────────────────────────────────────

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: T.white }}>{value}</Text>
      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Hero
  heroContainer: { marginHorizontal: 0 },
  heroImage: { width: "100%", height: 290 },
  heroOverlay: {
    flex: 1, paddingHorizontal: 18,
    justifyContent: "space-between", paddingBottom: 22,
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  heroLogo: { width: 160, height: 64 },
  switchModeBtn: {
    position: "absolute", right: 0, top: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 20, paddingHorizontal: 13, paddingVertical: 7,
  },
  switchModeBtnText: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.85)",
  },
  heroBottom: { gap: 4 },
  heroLabel: {
    fontSize: 11, fontFamily: "Inter_700Bold",
    color: T.blue, letterSpacing: 2, textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroMountainName: {
    fontSize: 32, fontFamily: "Inter_700Bold", color: "#fff",
    textShadowColor: "rgba(0,0,0,0.95)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    lineHeight: 38,
  },
  heroBadges: { flexDirection: "row", gap: 8, marginTop: 4 },
  heroBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  heroBadgeText: {
    fontSize: 11, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.8)",
  },

  // Score section
  scoreSection: { paddingHorizontal: 16, marginTop: 16 },
  scoreLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim,
    letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16,
  },
  scoreCaption: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, textAlign: "center", paddingHorizontal: 8 },
  refreshBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 12, paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 10, backgroundColor: T.surface,
    borderWidth: 1, borderColor: T.border,
  },
  refreshText: { fontSize: 12, fontFamily: "Inter_500Medium", color: T.textMuted },

  // Shared card
  card: {
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.border,
    padding: 16, overflow: "hidden",
  },

  // Section title
  sectionTitle: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim,
    letterSpacing: 1.5, textTransform: "uppercase",
    marginBottom: 8, marginLeft: 2,
  },

  // Hill preview card
  hillPreviewCard: {
    backgroundColor: T.card, borderRadius: 14,
    borderWidth: 1, borderColor: T.border,
    padding: 14, gap: 10, overflow: "hidden",
  },
  hillDayLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: T.green,
    textTransform: "uppercase", letterSpacing: 1,
  },
  hillEmoji: {
    width: 46, height: 46, borderRadius: 13,
    backgroundColor: T.greenDim, alignItems: "center", justifyContent: "center",
  },
  hillName: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.white },
  hillSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  hillStatsRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface, borderRadius: 10,
    paddingVertical: 9, paddingHorizontal: 6,
  },
  hillStatDiv: { width: 1, height: 24, backgroundColor: T.border },

  // Mountain preview card
  mountainPreviewCard: {
    backgroundColor: T.card, borderRadius: 14,
    borderWidth: 1, borderColor: T.border,
    padding: 14, overflow: "hidden",
  },
  mountainIconWrap: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center",
  },
  mountainPreviewName: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.white },
  mountainPreviewSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
});
