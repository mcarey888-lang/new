/**
 * VirtualExpeditionView
 *
 * Shown on the Plan tab when summitGoal.mode === "virtual".
 * Fetches POST /api/virtual-expedition on first load (or on manual refresh),
 * caches the result onto summitGoal via patchGoal, then renders:
 *   - Target mountain card (name, country, notes)
 *   - Recommended hill(s) — single or Sat/Sun weekend pairing
 *   - Overall Physical Simulation Score with threshold label
 *   - Per-dimension breakdown with altitude context note
 *   - Manual "Refresh recommendation" action
 */

import { Mountain, RefreshCw, MapPin, Info, AlertTriangle } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
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

import type { NearbyHill, SimulationScoreBreakdown, SummitGoal, TargetMountain } from "@/context/AppContext";
import { T } from "@/constants/theme";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

// ── Score helpers ──────────────────────────────────────────────────────────────

function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Partial";
  return "Weak";
}

function scoreColor(score: number): string {
  if (score >= 80) return T.green;
  if (score >= 60) return T.blue;
  if (score >= 40) return T.orange;
  return T.red;
}

function scoreDimColor(score: number): string {
  if (score >= 70) return T.green;
  if (score >= 40) return T.orange;
  return T.red;
}

// ── Dimension metadata ────────────────────────────────────────────────────────

const DIMENSIONS: { key: keyof SimulationScoreBreakdown; label: string; emoji: string }[] = [
  { key: "elevation",       label: "Elevation gain",      emoji: "▲" },
  { key: "duration",        label: "Duration & distance", emoji: "⏱" },
  { key: "altitude",        label: "Altitude",            emoji: "⛰" },
  { key: "consecutiveDays", label: "Consecutive days",    emoji: "📅" },
];

// ── API response types ────────────────────────────────────────────────────────

interface VirtualExpeditionResponse {
  targetProfile: TargetMountain & { notes?: string | null };
  recommendedHills: NearbyHill[];
  simulationScore: number;
  scoreBreakdown: SimulationScoreBreakdown;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface VirtualExpeditionViewProps {
  summitGoal: SummitGoal;
  patchGoal: (updates: Partial<SummitGoal>) => Promise<void>;
  insets: { top: number; bottom: number };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VirtualExpeditionView({ summitGoal, patchGoal, insets }: VirtualExpeditionViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCachedData =
    !!summitGoal.simulationScore &&
    !!summitGoal.targetMountain &&
    !!summitGoal.simulationScoreBreakdown;

  async function fetchExpedition(force = false) {
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
      setError(err instanceof Error ? err.message : "Couldn't load expedition data. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-fetch on first render if no cached data
  useEffect(() => { void fetchExpedition(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const topPad = Platform.OS === "web" ? 56 : insets.top + 16;
  const botPad = Platform.OS === "web" ? 120 : insets.bottom + 120;

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading && !hasCachedData) {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center" }}>
            <Mountain size={26} color={T.blue} />
          </View>
          <ActivityIndicator color={T.blue} size="small" />
          <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted }}>
            Building your expedition plan…
          </Text>
        </View>
      </LinearGradient>
    );
  }

  // ── Error state (no cached data) ─────────────────────────────────────────────
  if (error && !hasCachedData) {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 }}>
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: T.redDim, alignItems: "center", justifyContent: "center" }}>
            <AlertTriangle size={26} color={T.red} />
          </View>
          <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: T.white, textAlign: "center" }}>
            Couldn't load expedition
          </Text>
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 19 }}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={() => void fetchExpedition(true)}
            style={{ paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, backgroundColor: T.blue }}
          >
            <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" }}>Try again</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // ── Main render (has cached data) ────────────────────────────────────────────
  const target = summitGoal.targetMountain!;
  const score = summitGoal.simulationScore!;
  const breakdown = summitGoal.simulationScoreBreakdown!;
  const hills = summitGoal.virtualHills ?? [];
  const isWeekend = hills.length >= 2;
  const sc = scoreColor(score);

  // Altitude context: show explanatory note when altitude score is low and the
  // target is meaningfully higher than what local hills can replicate.
  const maxLocalASL = hills.reduce<number>((m, h) => Math.max(m, h.summitElevationASL ?? 0), 0);
  const showAltitudeNote = breakdown.altitude < 50 && target.summitElevation > 1500;

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad, paddingHorizontal: 16, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Screen heading ──────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(0).duration(400)}>
          <Text style={s.screenTitle}>Virtual Expedition</Text>
          <Text style={s.screenSub}>
            Simulating {summitGoal.mountainName} from {summitGoal.location}
          </Text>
        </Animated.View>

        {/* ── Target mountain card ─────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(40).duration(400)}>
          <View style={s.card}>
            <LinearGradient colors={[T.blueDim, "transparent"]} style={StyleSheet.absoluteFill} />
            <View style={s.cardHeader}>
              <View style={s.cardIconWrap}>
                <Mountain size={18} color={T.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{target.name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
                  <MapPin size={11} color={T.textDim} />
                  <Text style={s.cardSub}>{target.country}</Text>
                </View>
              </View>
              <View style={[s.diffBadge, { backgroundColor: diffColor(target.difficulty) + "22", borderColor: diffColor(target.difficulty) + "50" }]}>
                <Text style={[s.diffText, { color: diffColor(target.difficulty) }]}>{target.difficulty}</Text>
              </View>
            </View>

            {/* Stats row */}
            <View style={s.statsRow}>
              <StatChip label="Summit" value={`${target.summitElevation}m`} />
              <View style={s.statDivider} />
              <StatChip label="Gain" value={`${target.totalElevationGain}m`} />
              <View style={s.statDivider} />
              <StatChip label="Distance" value={`${target.totalDistance}km`} />
              <View style={s.statDivider} />
              <StatChip label="Days" value={`${target.estimatedDays}`} />
            </View>

            {/* Route notes */}
            {target.notes ? (
              <Text style={s.notes}>{target.notes}</Text>
            ) : null}
          </View>
        </Animated.View>

        {/* ── Recommended hill(s) ──────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <Text style={s.sectionLabel}>YOUR SIMULATION HILLS</Text>
          {isWeekend ? (
            <View style={{ gap: 8 }}>
              {hills.slice(0, 2).map((hill, idx) => (
                <HillCard key={hill.name} hill={hill} dayLabel={idx === 0 ? "Saturday" : "Sunday"} />
              ))}
            </View>
          ) : (
            hills.slice(0, 1).map(hill => (
              <HillCard key={hill.name} hill={hill} />
            ))
          )}
        </Animated.View>

        {/* ── Overall simulation score ─────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(120).duration(400)}>
          <View style={[s.card, { alignItems: "center", paddingVertical: 24 }]}>
            <LinearGradient
              colors={[sc + "18", "transparent"]}
              style={StyleSheet.absoluteFill}
            />
            <Text style={s.sectionLabel}>PHYSICAL SIMULATION SCORE</Text>
            <Text style={[s.scoreBig, { color: sc }]}>{score}</Text>
            <View style={[s.scoreLabelBadge, { backgroundColor: sc + "22", borderColor: sc + "40" }]}>
              <Text style={[s.scoreLabelText, { color: sc }]}>{scoreLabel(score)}</Text>
            </View>
            <Text style={s.scoreCaption}>
              {score >= 80
                ? `Your training on local hills closely matches what ${target.name} demands.`
                : score >= 60
                ? `You're covering the key demands well. Keep building elevation and distance.`
                : score >= 40
                ? `Good foundation. Focus on increasing weekly elevation and back-to-back sessions.`
                : `Your local hills have real limitations for this target — see the breakdown below.`}
            </Text>
          </View>
        </Animated.View>

        {/* ── Per-dimension breakdown ──────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(160).duration(400)}>
          <Text style={s.sectionLabel}>SCORE BREAKDOWN</Text>
          <View style={s.card}>
            {DIMENSIONS.map((dim, idx) => {
              const val = breakdown[dim.key] as number;
              const dc = scoreDimColor(val);
              const isAltitude = dim.key === "altitude";
              return (
                <View
                  key={dim.key}
                  style={[s.dimRow, idx < DIMENSIONS.length - 1 && s.dimRowBorder]}
                >
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={s.dimEmoji}>{dim.emoji}</Text>
                      <Text style={s.dimLabel}>{dim.label}</Text>
                      <Text style={[s.dimPct, { color: dc }]}>{val}%</Text>
                    </View>
                    {/* Bar */}
                    <View style={s.dimBarTrack}>
                      <View style={[s.dimBarFill, { width: `${val}%` as any, backgroundColor: dc }]} />
                    </View>
                    {/* Altitude context note */}
                    {isAltitude && showAltitudeNote && (
                      <View style={s.altNote}>
                        <Info size={11} color={T.orange} style={{ marginTop: 1 }} />
                        <Text style={s.altNoteText}>
                          {maxLocalASL > 0
                            ? `Your local hills reach ~${maxLocalASL}m ASL — ${target.name} summits at ${target.summitElevation}m. Altitude preparation can't be replicated by local hills alone. Consider altitude tents or a pre-trip acclimatisation week.`
                            : `${target.name} summits at ${target.summitElevation}m. Local training hills can't replicate high-altitude conditions. Consider altitude acclimatisation before your expedition.`}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* ── Refresh action ───────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <TouchableOpacity
            onPress={() => void fetchExpedition(true)}
            activeOpacity={0.75}
            disabled={loading}
            style={s.refreshBtn}
          >
            {loading
              ? <ActivityIndicator color={T.textMuted} size="small" />
              : <RefreshCw size={14} color={T.textMuted} />
            }
            <Text style={s.refreshText}>
              {loading ? "Refreshing…" : "Refresh recommendation"}
            </Text>
          </TouchableOpacity>
          <Text style={s.refreshHint}>
            Use this if you change location or want a new hill suggestion.
          </Text>
        </Animated.View>

        {/* ── Inline error banner (shown if refresh fails but cached data exists) */}
        {error && hasCachedData && (
          <View style={s.errorBanner}>
            <AlertTriangle size={13} color={T.orange} />
            <Text style={s.errorBannerText}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: T.white }}>{value}</Text>
      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 1, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
}

function HillCard({ hill, dayLabel }: { hill: NearbyHill; dayLabel?: string }) {
  return (
    <View style={s.hillCard}>
      <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
      {dayLabel && (
        <Text style={s.hillDay}>{dayLabel}</Text>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={s.hillIconWrap}>
          <Text style={{ fontSize: 20 }}>{hill.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.hillName}>{hill.name}</Text>
          <Text style={s.hillSub}>{hill.surface} · {hill.grade} · {hill.distance}km away</Text>
        </View>
      </View>
      <View style={s.hillStats}>
        <HillStat value={`${hill.elevation}m`} label="per rep" />
        <View style={s.hillStatDivider} />
        <HillStat value={`×${hill.repeats}`} label="reps" />
        <View style={s.hillStatDivider} />
        <HillStat value={`${hill.totalElevation}m`} label="total gain" />
        {hill.summitElevationASL ? (
          <>
            <View style={s.hillStatDivider} />
            <HillStat value={`${hill.summitElevationASL}m`} label="summit ASL" />
          </>
        ) : null}
      </View>
    </View>
  );
}

function HillStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: T.white }}>{value}</Text>
      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

// ── Difficulty colour helper ───────────────────────────────────────────────────

function diffColor(diff: string): string {
  if (diff === "Easy")    return T.green;
  if (diff === "Moderate") return T.blue;
  if (diff === "Hard")    return T.orange;
  return "#FF4444"; // Alpine
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screenTitle: {
    fontSize: 24, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 4,
  },
  screenSub: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim,
    letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 8,
  },
  card: {
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.border,
    padding: 16, overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12,
  },
  cardIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center",
  },
  cardTitle: {
    fontSize: 16, fontFamily: "Inter_700Bold", color: T.white,
  },
  cardSub: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted,
  },
  diffBadge: {
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
  },
  diffText: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
  },
  statsRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 6,
    marginBottom: 12,
  },
  statDivider: {
    width: 1, height: 30, backgroundColor: T.border,
  },
  notes: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 19,
  },

  // Hill card
  hillCard: {
    backgroundColor: T.card, borderRadius: 14,
    borderWidth: 1, borderColor: T.border,
    padding: 14, gap: 10, overflow: "hidden",
  },
  hillDay: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: T.green,
    textTransform: "uppercase", letterSpacing: 1, marginBottom: -4,
  },
  hillIconWrap: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: T.greenDim,
    alignItems: "center", justifyContent: "center",
  },
  hillName: {
    fontSize: 15, fontFamily: "Inter_700Bold", color: T.white,
  },
  hillSub: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1,
  },
  hillStats: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 6,
  },
  hillStatDivider: { width: 1, height: 26, backgroundColor: T.border },

  // Score
  scoreBig: {
    fontSize: 64, fontFamily: "Inter_700Bold", lineHeight: 70, marginTop: 8,
  },
  scoreLabelBadge: {
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 10,
    borderWidth: 1, marginTop: 8, marginBottom: 10,
  },
  scoreLabelText: {
    fontSize: 14, fontFamily: "Inter_700Bold",
  },
  scoreCaption: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted,
    textAlign: "center", lineHeight: 19, paddingHorizontal: 8,
  },

  // Dimensions
  dimRow: {
    paddingVertical: 12,
  },
  dimRowBorder: {
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  dimEmoji: {
    fontSize: 13,
  },
  dimLabel: {
    fontSize: 13, fontFamily: "Inter_500Medium", color: T.text, flex: 1,
  },
  dimPct: {
    fontSize: 13, fontFamily: "Inter_700Bold",
  },
  dimBarTrack: {
    height: 5, backgroundColor: T.surface, borderRadius: 3, overflow: "hidden",
  },
  dimBarFill: {
    height: 5, borderRadius: 3,
  },
  altNote: {
    flexDirection: "row", gap: 6, alignItems: "flex-start",
    backgroundColor: T.orange + "10", borderRadius: 8,
    padding: 9, marginTop: 4,
    borderWidth: 1, borderColor: T.orange + "25",
  },
  altNoteText: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted,
    lineHeight: 17, flex: 1,
  },

  // Refresh
  refreshBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 13, borderRadius: 14,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
  },
  refreshText: {
    fontSize: 14, fontFamily: "Inter_500Medium", color: T.textMuted,
  },
  refreshHint: {
    fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim,
    textAlign: "center", marginTop: 6,
  },
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: T.orange + "12", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: T.orange + "30",
  },
  errorBannerText: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, flex: 1,
  },
});
