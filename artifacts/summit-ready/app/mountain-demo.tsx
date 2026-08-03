/**
 * Mountain Progress — Developer Demo
 *
 * Drag the slider to scrub through the full route animation.
 * All stage markers, the progress marker, and the summit state
 * respond in real time so the component can be tuned without live hike data.
 */

import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Mountain } from "lucide-react-native";

import MountainProgress, { ExpeditionStage } from "@/components/MountainProgress";
import { T } from "@/constants/theme";
import { useScreenView } from "@/lib/analytics";

// ── Demo expedition data ──────────────────────────────────────────────────────

const TARGET_ELEVATION = 2100;

const DEMO_STAGES: ExpeditionStage[] = [
  { name: "Base Approach",   elevationGain: 700, status: "upcoming" },
  { name: "Ridge Section",   elevationGain: 600, status: "upcoming" },
  { name: "Summit Push",     elevationGain: 800, status: "upcoming" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeStages(
  currentGain: number,
  totalGain: number,
  stages: ExpeditionStage[],
): ExpeditionStage[] {
  let cum = 0;
  return stages.map((s) => {
    cum += s.elevationGain;
    const threshold = totalGain > 0 ? cum / totalGain : 0;
    const progress  = totalGain > 0 ? currentGain / totalGain : 0;
    return {
      ...s,
      status:
        progress >= threshold
          ? "completed"
          : progress >= threshold - 0.06
          ? "active"
          : "upcoming",
    };
  });
}

function pctStr(n: number) {
  return `${Math.round(n * 100)}%`;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MountainDemoScreen() {
  useScreenView("mountain_demo");
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;

  const [pct, setPct]           = useState(0);          // 0–1
  const [summitSeen, setSummitSeen] = useState(false);

  const currentElevation = Math.round(pct * TARGET_ELEVATION);
  const stages           = computeStages(currentElevation, TARGET_ELEVATION, DEMO_STAGES);

  // Active stage label for the subtitle
  let activeIdx = -1;
  for (let i = stages.length - 1; i >= 0; i--) {
    if (stages[i].status === "completed") { activeIdx = i; break; }
  }
  const nextStage = stages.find(s => s.status !== "completed");
  const statusLine =
    pct >= 1      ? "🏔️  Summit reached!" :
    activeIdx < 0 ? `Next: ${DEMO_STAGES[0].name}` :
    nextStage     ? `Climbing: ${nextStage.name}` :
                    "Expedition complete";

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 12, paddingBottom: insets.bottom + 32 },
        ]}
      >

        {/* ── Header ───────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={22} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.title}>Mountain Progress</Text>
            <Text style={styles.subtitle}>Developer Preview</Text>
          </View>
          <View style={styles.devBadge}>
            <Text style={styles.devBadgeText}>DEV</Text>
          </View>
        </View>

        {/* ── Component ────────────────────────────────────────────────── */}
        <MountainProgress
          targetElevationGain={TARGET_ELEVATION}
          currentElevationGain={currentElevation}
          stages={stages}
          onSummitReached={() => setSummitSeen(true)}
          style={styles.mountainCard}
        />

        {/* ── Live stats strip ─────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatPill
            label="ELEVATION"
            value={`${currentElevation.toLocaleString()}m`}
            sub={`of ${TARGET_ELEVATION.toLocaleString()}m`}
            color={T.green}
          />
          <StatPill
            label="PROGRESS"
            value={pctStr(pct)}
            sub={statusLine}
            color={pct >= 1 ? "#FFD700" : T.blue}
          />
          <StatPill
            label="STAGES"
            value={`${stages.filter(s => s.status === "completed").length}/${stages.length}`}
            sub="completed"
            color={T.textMuted}
          />
        </View>

        {/* ── Slider ───────────────────────────────────────────────────── */}
        <View style={styles.sliderCard}>
          <View style={styles.sliderHeader}>
            <Mountain size={14} color={T.green} />
            <Text style={styles.sliderLabel}>Elevation Progress</Text>
            <Text style={styles.sliderValue}>{pctStr(pct)}</Text>
          </View>

          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            step={0.001}
            value={pct}
            onValueChange={setPct}
            minimumTrackTintColor={T.green}
            maximumTrackTintColor="rgba(255,255,255,0.12)"
            thumbTintColor={T.green}
          />

          <View style={styles.sliderTicks}>
            {DEMO_STAGES.map((s, i) => {
              let cumFrac = 0;
              for (let j = 0; j <= i; j++) cumFrac += DEMO_STAGES[j].elevationGain;
              cumFrac /= TARGET_ELEVATION;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.tickBtn, { left: `${cumFrac * 100}%` as any }]}
                  onPress={() => setPct(cumFrac)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <View style={[
                    styles.tick,
                    { backgroundColor: pct >= cumFrac ? T.green : "rgba(255,255,255,0.25)" },
                  ]} />
                  <Text style={styles.tickLabel}>{`S${i + 1}`}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Stage breakdown ──────────────────────────────────────────── */}
        <View style={styles.stagesCard}>
          <Text style={styles.sectionLabel}>STAGES</Text>
          {DEMO_STAGES.map((s, i) => {
            const st = stages[i];
            const done = st.status === "completed";
            return (
              <View key={i} style={[styles.stageRow, i === DEMO_STAGES.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[styles.stageDot, { backgroundColor: done ? T.green : "rgba(255,255,255,0.15)" }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stageName, done && { color: T.green }]}>
                    {`Stage ${i + 1} · ${s.name}`}
                  </Text>
                  <Text style={styles.stageMeta}>{`▲ ${s.elevationGain.toLocaleString()}m gain`}</Text>
                </View>
                <Text style={[styles.stageStatus, { color: done ? T.green : T.textDim }]}>
                  {done ? "Complete" : st.status === "active" ? "Active" : "Upcoming"}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Summit reached banner */}
        {summitSeen && (
          <View style={styles.summitBanner}>
            <Text style={styles.summitEmoji}>🏔️</Text>
            <Text style={styles.summitText}>Summit reached! onSummitReached fired.</Text>
          </View>
        )}

      </ScrollView>
    </LinearGradient>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({ label, value, sub, color }: {
  label: string; value: string; sub: string; color: string;
}) {
  return (
    <View style={styles.statPill}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 14 },

  header: {
    flexDirection: "row", alignItems: "center", marginBottom: 4,
  },
  title:    { fontSize: 20, fontFamily: "Inter_700Bold",    color: T.white },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 1 },

  devBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: "rgba(255,165,0,0.18)", borderWidth: 1,
    borderColor: "rgba(255,165,0,0.35)",
  },
  devBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "rgba(255,165,0,0.9)", letterSpacing: 1 },

  mountainCard: { width: "100%", borderRadius: 16 },

  statsRow: {
    flexDirection: "row", gap: 8,
  },
  statPill: {
    flex: 1, alignItems: "center", padding: 10, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    gap: 2,
  },
  statValue: { fontSize: 17, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 9,  fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 1 },
  statSub:   { fontSize: 9,  fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center" },

  sliderCard: {
    padding: 16, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  sliderHeader: {
    flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 6,
  },
  sliderLabel: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  sliderValue: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.green },
  slider: { width: "100%", height: 36 },

  sliderTicks: { flexDirection: "row", position: "relative", height: 24 },
  tickBtn: { position: "absolute", alignItems: "center", transform: [{ translateX: -8 }] },
  tick:    { width: 2, height: 8, borderRadius: 1, marginBottom: 2 },
  tickLabel: { fontSize: 8, fontFamily: "Inter_700Bold", color: T.textDim },

  stagesCard: {
    padding: 14, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  sectionLabel: {
    fontSize: 9, fontFamily: "Inter_700Bold", color: T.textDim,
    letterSpacing: 1.2, marginBottom: 10,
  },
  stageRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
  },
  stageDot:    { width: 8, height: 8, borderRadius: 4 },
  stageName:   { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.white },
  stageMeta:   { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 1 },
  stageStatus: { fontSize: 11, fontFamily: "Inter_500Medium" },

  summitBanner: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 14,
    borderRadius: 12, backgroundColor: "rgba(255,215,0,0.12)",
    borderWidth: 1, borderColor: "rgba(255,215,0,0.30)",
  },
  summitEmoji: { fontSize: 22 },
  summitText:  { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#FFD700" },
});
