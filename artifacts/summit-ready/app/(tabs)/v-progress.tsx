/**
 * Virtual mode — My Journey screen
 * Shows the user's simulation score as a large progress ring, a distance
 * progress bar, per-dimension breakdown, and aspirational motivational copy.
 * Reads entirely from cached summitGoal fields (no additional fetches).
 */

import { Mountain, Compass } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
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
import { ProgressRing } from "@/components/ProgressRing";
import { useScreenView } from "@/lib/analytics";
import type { SimulationScoreBreakdown } from "@/context/AppContext";

// ── Score helpers ──────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return T.green;
  if (score >= 60) return T.blue;
  if (score >= 40) return T.orange;
  return T.red;
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Partial";
  return "Early stages";
}

function scoreMotivation(score: number, mountainName: string): string {
  if (score >= 80) {
    return `You could attempt ${mountainName} now. Your local hills closely replicate everything the summit demands — elevation, duration, and consecutive-day effort. Now it's about committing to the date.`;
  }
  if (score >= 60) {
    return `You've built a strong base for ${mountainName}. More hill repeats and back-to-back weekend sessions will close the final gap. You're doing the right things.`;
  }
  if (score >= 40) {
    return `You're getting there. ${mountainName} is calling, and your local terrain is answering. Focus on increasing your weekly elevation gain — every summit rep counts.`;
  }
  return `Every journey starts somewhere, and yours starts on the hills near you. Regular weekend ascents are your fastest route to ${mountainName}. Keep going.`;
}

const DIMENSIONS: { key: keyof SimulationScoreBreakdown; label: string; description: string; emoji: string }[] = [
  {
    key: "elevation",
    label: "Elevation match",
    description: "How well your local hills cover the total elevation gain",
    emoji: "▲",
  },
  {
    key: "duration",
    label: "Duration match",
    description: "Whether the total distance and time on feet is comparable",
    emoji: "⏱",
  },
  {
    key: "altitude",
    label: "Altitude exposure",
    description: "How close your local summit heights are to the target's ASL",
    emoji: "⛰",
  },
  {
    key: "consecutiveDays",
    label: "Consecutive days",
    description: "Whether the back-to-back day demand is met",
    emoji: "📅",
  },
];

function dimColor(score: number): string {
  if (score >= 70) return T.green;
  if (score >= 40) return T.orange;
  return T.red;
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function VirtualProgressScreen() {
  useScreenView("virtual_progress");
  const insets = useSafeAreaInsets();
  const { summitGoal } = useApp();

  const topPad = Platform.OS === "web" ? 56 : insets.top + 16;
  const botPad = Platform.OS === "web" ? 120 : insets.bottom + 120;

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

  const score     = summitGoal.simulationScore ?? 0;
  const breakdown = summitGoal.simulationScoreBreakdown;
  const target    = summitGoal.targetMountain;
  const sc        = scoreColor(score);

  // No data yet — prompt to visit home
  if (!breakdown || !score) {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingTop: topPad, paddingHorizontal: 16, paddingBottom: botPad, alignItems: "center", justifyContent: "center", gap: 16 }}>
          <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center" }}>
            <Compass size={28} color={T.blue} />
          </View>
          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: T.white, textAlign: "center" }}>
            No journey data yet
          </Text>
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 19 }}>
            Visit the Home tab to load your expedition match and start tracking your journey to {summitGoal.mountainName}.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/virtual")}
            style={{ paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, backgroundColor: T.blue }}
          >
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad, paddingHorizontal: 16, gap: 16 }}
      >
        {/* ── Screen header ───────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(0).duration(400)}>
          <Text style={s.screenTitle}>My Journey</Text>
          <Text style={s.screenSub}>How your local training stacks up against {summitGoal.mountainName}</Text>
        </Animated.View>

        {/* ── Main score ring ─────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(40).duration(500)}>
          <View style={[s.card, { alignItems: "center", paddingVertical: 32 }]}>
            <LinearGradient colors={[sc + "14", "transparent"]} style={StyleSheet.absoluteFill} />
            <Text style={s.sectionLabel}>YOUR SIMULATION SCORE</Text>
            <ProgressRing
              score={score}
              size={164}
              strokeWidth={13}
              color={sc}
              sublabel={scoreLabel(score)}
            />
            <View style={[s.scoreBadge, { backgroundColor: sc + "22", borderColor: sc + "40", marginTop: 16 }]}>
              <Text style={[s.scoreBadgeText, { color: sc }]}>
                {scoreLabel(score)} match for {summitGoal.mountainName}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Motivational copy ───────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(80).duration(500)}>
          <View style={[s.card, { gap: 8 }]}>
            <LinearGradient colors={["rgba(62,207,117,0.05)", "transparent"]} style={StyleSheet.absoluteFill} />
            <Text style={s.sectionLabel}>WHERE YOU STAND</Text>
            <Text style={s.motivationText}>
              {scoreMotivation(score, summitGoal.mountainName)}
            </Text>
          </View>
        </Animated.View>

        {/* ── Target snapshot ─────────────────────────────────────────────────── */}
        {target && (
          <Animated.View entering={FadeInDown.delay(120).duration(500)}>
            <Text style={s.sectionLabel}>THE GOAL</Text>
            <View style={s.targetRow}>
              <TargetChip label="Summit" value={`${target.summitElevation}m`} accent={T.blue} />
              <TargetChip label="Total gain" value={`${target.totalElevationGain}m`} accent={T.green} />
              <TargetChip label="Distance" value={`${target.totalDistance}km`} accent={T.orange} />
              <TargetChip label="Days" value={`${target.estimatedDays}`} accent={T.purple} />
            </View>
          </Animated.View>
        )}

        {/* ── Per-dimension breakdown ─────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(160).duration(500)}>
          <Text style={s.sectionLabel}>SCORE BREAKDOWN</Text>
          <View style={s.card}>
            {DIMENSIONS.map((dim, idx) => {
              const val = (breakdown[dim.key] as number) ?? 0;
              const dc  = dimColor(val);
              return (
                <View key={dim.key} style={[s.dimRow, idx < DIMENSIONS.length - 1 && s.dimRowBorder]}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                      <Text style={s.dimEmoji}>{dim.emoji}</Text>
                      <Text style={s.dimLabel}>{dim.label}</Text>
                      <Text style={[s.dimPct, { color: dc }]}>{val}%</Text>
                    </View>
                    <Text style={s.dimDesc}>{dim.description}</Text>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width: `${val}%` as any, backgroundColor: dc }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* ── Altitude note ────────────────────────────────────────────────────── */}
        {target && target.summitElevation > 2000 && (breakdown.altitude ?? 0) < 60 && (
          <Animated.View entering={FadeInDown.delay(200).duration(500)}>
            <View style={[s.card, { flexDirection: "row", gap: 10, alignItems: "flex-start" }]}>
              <Text style={{ fontSize: 20, marginTop: 2 }}>⛰</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.sectionLabel, { color: T.orange, marginBottom: 4 }]}>ALTITUDE NOTE</Text>
                <Text style={s.altNoteText}>
                  {target.name} summits at {target.summitElevation}m ASL. Local hills can't replicate high-altitude conditions.
                  Consider an acclimatisation trip or altitude tent protocol as you approach your goal date.
                </Text>
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TargetChip({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={[s.targetChip, { borderColor: accent + "30" }]}>
      <LinearGradient colors={[accent + "14", "transparent"]} style={StyleSheet.absoluteFill} />
      <Text style={[s.targetChipValue, { color: accent }]}>{value}</Text>
      <Text style={s.targetChipLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screenTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 4 },
  screenSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18 },
  card: {
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.border,
    padding: 16, overflow: "hidden",
  },
  sectionLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim,
    letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 12,
  },
  scoreBadge: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 12, borderWidth: 1,
  },
  scoreBadgeText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  motivationText: {
    fontSize: 14, fontFamily: "Inter_400Regular", color: T.text, lineHeight: 22,
  },
  targetRow: { flexDirection: "row", gap: 8 },
  targetChip: {
    flex: 1, backgroundColor: T.card, borderRadius: 12,
    borderWidth: 1, padding: 10, alignItems: "center", overflow: "hidden", gap: 2,
  },
  targetChipValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  targetChipLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" },
  dimRow: { paddingVertical: 12 },
  dimRowBorder: { borderBottomWidth: 1, borderBottomColor: T.border },
  dimEmoji: { fontSize: 13 },
  dimLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: T.text, flex: 1 },
  dimPct: { fontSize: 13, fontFamily: "Inter_700Bold" },
  dimDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, lineHeight: 15 },
  barTrack: { height: 5, backgroundColor: T.surface, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 5, borderRadius: 3 },
  altNoteText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18 },
});
