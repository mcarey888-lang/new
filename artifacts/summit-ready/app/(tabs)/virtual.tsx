/**
 * Virtual tab — Outdoor Mountain Simulation
 *
 * Pick a famous goal mountain, specify where you hike, and the app finds real
 * local summits whose combined elevation + distance match the goal's demands.
 * Log real outdoor hikes as you complete them and track your progress toward
 * matching the full mountain's stats — e.g. "2,563m of 4,810m gained toward
 * your Mont Blanc equivalent."
 *
 * No treadmills, no indoor sessions, no equipment pairing — entirely outdoor.
 */

import {
  Mountain, MapPin, RefreshCw, Compass, AlertTriangle,
  ChevronDown, ChevronUp, Plus, CheckCircle, Info,
} from "lucide-react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
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

import { useApp } from "@/context/AppContext";
import { confirmModeSwitch } from "@/utils/modeSwitch";
import { T } from "@/constants/theme";
import { ProgressRing } from "@/components/ProgressRing";
import { useScreenView } from "@/lib/analytics";
import type {
  NearbyHill, SimulationScoreBreakdown, SummitGoal, TargetMountain,
} from "@/context/AppContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

// ── Helpers ────────────────────────────────────────────────────────────────────

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
function diffColor(diff: string): string {
  if (diff === "Easy")     return T.green;
  if (diff === "Moderate") return T.blue;
  if (diff === "Hard")     return T.orange;
  return "#FF4444";
}
function altColor(exp: string): string {
  if (exp === "None")     return T.green;
  if (exp === "Moderate") return T.blue;
  if (exp === "High")     return T.orange;
  return "#FF4444";
}

interface VirtualExpeditionResponse {
  targetProfile: TargetMountain & { notes?: string | null };
  recommendedHills: NearbyHill[];
  simulationScore: number;
  scoreBreakdown: SimulationScoreBreakdown;
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function VirtualScreen() {
  useScreenView("virtual_tab");
  const insets = useSafeAreaInsets();
  const { summitGoal, trainingPlan, patchGoal, setSummitGoal } = useApp();

  // Expedition data fetch state
  const hasCachedData =
    !!summitGoal?.simulationScore &&
    !!summitGoal?.targetMountain &&
    !!summitGoal?.virtualHills?.length;

  const [loading, setLoading]       = useState(!hasCachedData && !!summitGoal);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  // Simulation-score accordion
  const [scoreExpanded, setScoreExpanded] = useState(false);

  // Hill expand/collapse state (index → expanded)
  const [expandedHill, setExpandedHill] = useState<number | null>(null);

  // Log hike modal
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [logElev, setLogElev]   = useState("");
  const [logDist, setLogDist]   = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [logSaving, setLogSaving] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const heroUri =
    imageError || !summitGoal
      ? null
      : `${API_BASE}/mountain-image?name=${encodeURIComponent(summitGoal.mountainName)}`;

  // ── Fetch expedition data ──────────────────────────────────────────────────
  async function fetchExpedition(force = false) {
    if (!summitGoal) return;
    if (!force && hasCachedData) return;
    setLoading(true);
    setFetchError(null);
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
        targetMountain:           data.targetProfile,
        simulationScore:          data.simulationScore,
        simulationScoreBreakdown: data.scoreBreakdown,
        virtualHills:             data.recommendedHills,
      });
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Couldn't load expedition data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchExpedition(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Log hike submission ────────────────────────────────────────────────────
  async function handleLogHike() {
    const elevM = parseFloat(logElev);
    const distKm = parseFloat(logDist);
    if (!summitGoal || isNaN(elevM) || elevM <= 0) return;
    setLogSaving(true);
    try {
      const prev = summitGoal.virtualHikeProgress ?? { elevationGained: 0, distanceCovered: 0, hikesLogged: 0 };
      await patchGoal({
        virtualHikeProgress: {
          elevationGained: prev.elevationGained + elevM,
          distanceCovered: prev.distanceCovered + (isNaN(distKm) ? 0 : distKm),
          hikesLogged:     prev.hikesLogged + 1,
        },
      });
      setLogElev("");
      setLogDist("");
      setLogNotes("");
      setLogSuccess(true);
      successTimer.current = setTimeout(() => {
        setLogSuccess(false);
        setLogModalVisible(false);
      }, 1400);
    } finally {
      setLogSaving(false);
    }
  }

  function openLogModal() {
    setLogElev("");
    setLogDist("");
    setLogNotes("");
    setLogSuccess(false);
    setLogModalVisible(true);
  }

  const topInset = Platform.OS === "web" ? 20 : insets.top;
  const botPad   = Platform.OS === "web" ? 120 : insets.bottom + 120;

  // ── No goal set ─────────────────────────────────────────────────────────────
  if (!summitGoal) {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 20, padding: 32 }}>
        <View style={{ width: 68, height: 68, borderRadius: 20, backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center" }}>
          <Mountain size={32} color={T.blue} />
        </View>
        <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: T.white, textAlign: "center" }}>
          Pick a goal mountain
        </Text>
        <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 21 }}>
          Choose a famous summit — Mont Blanc, Kilimanjaro, Everest Base Camp — and the app will find real local hills that replicate its physical demands.
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/setup")}
          style={{ paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, backgroundColor: T.blue }}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Choose a goal mountain</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  const target   = summitGoal.targetMountain;
  const hills    = summitGoal.virtualHills ?? [];
  const score    = summitGoal.simulationScore ?? 0;
  const breakdown = summitGoal.simulationScoreBreakdown;
  const progress = summitGoal.virtualHikeProgress ?? { elevationGained: 0, distanceCovered: 0, hikesLogged: 0 };
  const isVirtual = summitGoal.mode === "virtual";

  const elevTarget = target?.totalElevationGain ?? 0;
  const distTarget = target?.totalDistance ?? 0;
  const elevPct = elevTarget > 0 ? Math.min(1, progress.elevationGained / elevTarget) : 0;
  const distPct = distTarget > 0 ? Math.min(1, progress.distanceCovered / distTarget) : 0;

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: botPad }}
      >
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        {heroUri ? (
          <ImageBackground
            source={{ uri: heroUri }}
            style={s.hero}
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
            <HeroContent
              summitGoal={summitGoal}
              topInset={topInset}
              isVirtual={isVirtual}
              onSwitchMode={() =>
                confirmModeSwitch(
                  isVirtual ? "expedition" : "virtual",
                  summitGoal,
                  trainingPlan,
                  setSummitGoal,
                )
              }
            />
          </ImageBackground>
        ) : (
          <LinearGradient colors={["#0E2240", "#071428", T.bg]} style={s.hero}>
            <View style={[StyleSheet.absoluteFillObject, { alignItems: "center", justifyContent: "center", marginBottom: 60 }]}>
              <Text style={{ fontSize: 72 }}>🏔️</Text>
            </View>
            <HeroContent
              summitGoal={summitGoal}
              topInset={topInset}
              isVirtual={isVirtual}
              onSwitchMode={() =>
                confirmModeSwitch(
                  isVirtual ? "expedition" : "virtual",
                  summitGoal,
                  trainingPlan,
                  setSummitGoal,
                )
              }
            />
          </LinearGradient>
        )}

        {/* ── Real hike progress tracker ────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(40).duration(500)} style={s.section}>
          {loading && !hasCachedData ? (
            <View style={[s.card, { alignItems: "center", gap: 12, paddingVertical: 32 }]}>
              <ActivityIndicator color={T.blue} />
              <Text style={s.mutedText}>Finding your equivalent hills…</Text>
            </View>
          ) : fetchError && !hasCachedData ? (
            <View style={[s.card, { alignItems: "center", gap: 12, paddingVertical: 24 }]}>
              <AlertTriangle size={22} color={T.orange} />
              <Text style={[s.mutedText, { textAlign: "center" }]}>{fetchError}</Text>
              <TouchableOpacity
                onPress={() => void fetchExpedition(true)}
                style={s.retryBtn}
              >
                <Text style={s.retryBtnText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : target ? (
            <View style={s.card}>
              <LinearGradient colors={[T.blue + "10", "transparent"]} style={StyleSheet.absoluteFill} />

              <Text style={s.sectionLabel}>YOUR PROGRESS TOWARD {summitGoal.mountainName.toUpperCase()}</Text>

              {/* Elevation progress bar */}
              <View style={{ gap: 6 }}>
                <View style={s.progressLabelRow}>
                  <Text style={s.progressBarLabel}>▲ Elevation gained</Text>
                  <Text style={s.progressBarValue}>
                    <Text style={{ color: T.green, fontFamily: "Inter_700Bold" }}>
                      {progress.elevationGained.toLocaleString()}m
                    </Text>
                    {"  "}
                    <Text style={{ color: T.textDim }}>of {target.totalElevationGain.toLocaleString()}m</Text>
                  </Text>
                </View>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${Math.round(elevPct * 100)}%` as `${number}%`, backgroundColor: T.green }]} />
                </View>
                <Text style={s.progressPct}>{Math.round(elevPct * 100)}% of goal elevation</Text>
              </View>

              {/* Distance progress bar */}
              <View style={{ gap: 6, marginTop: 12 }}>
                <View style={s.progressLabelRow}>
                  <Text style={s.progressBarLabel}>↔ Distance covered</Text>
                  <Text style={s.progressBarValue}>
                    <Text style={{ color: T.orange, fontFamily: "Inter_700Bold" }}>
                      {progress.distanceCovered.toFixed(1)}km
                    </Text>
                    {"  "}
                    <Text style={{ color: T.textDim }}>of {target.totalDistance}km</Text>
                  </Text>
                </View>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${Math.round(distPct * 100)}%` as `${number}%`, backgroundColor: T.orange }]} />
                </View>
                <Text style={s.progressPct}>{Math.round(distPct * 100)}% of goal distance</Text>
              </View>

              {/* Hike count stat */}
              {progress.hikesLogged > 0 && (
                <View style={[s.hikeCountRow, { marginTop: 12 }]}>
                  <CheckCircle size={14} color={T.green} />
                  <Text style={s.hikeCountText}>
                    {progress.hikesLogged} {progress.hikesLogged === 1 ? "hike" : "hikes"} logged
                  </Text>
                </View>
              )}

              {/* Log hike CTA */}
              <TouchableOpacity
                onPress={openLogModal}
                activeOpacity={0.85}
                style={s.logHikeBtn}
              >
                <Plus size={16} color="#fff" />
                <Text style={s.logHikeBtnText}>Log a Completed Hike</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </Animated.View>

        {/* ── Equivalent hills ──────────────────────────────────────────────── */}
        {(hills.length > 0 || (!loading && hasCachedData)) && (
          <Animated.View entering={FadeInDown.delay(80).duration(500)} style={s.section}>
            <Text style={s.sectionTitle}>YOUR EQUIVALENT HILLS</Text>

            {hills.length === 0 ? (
              <View style={[s.card, { alignItems: "center", gap: 12, paddingVertical: 24 }]}>
                <Compass size={24} color={T.blue} />
                <Text style={[s.mutedText, { textAlign: "center" }]}>
                  No hill recommendations yet.{"\n"}Tap refresh to find hills near {summitGoal.location}.
                </Text>
              </View>
            ) : (
              <>
                {/* Why these hills explainer */}
                {target && (
                  <View style={[s.explainerCard, { marginBottom: 10 }]}>
                    <LinearGradient colors={[T.blueDim, "transparent"]} style={StyleSheet.absoluteFill} />
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                      <View style={s.explainerIcon}>
                        <Info size={14} color={T.blue} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.explainerTitle}>Why these hills?</Text>
                        <Text style={s.explainerText}>
                          {target.name} demands {target.totalElevationGain.toLocaleString()}m of elevation gain over {target.totalDistance}km.
                          {hills.length >= 2
                            ? ` These two hills, hiked back-to-back over a weekend, replicate that combined effort and consecutive-day demand.`
                            : ` This hill, repeated ${hills[0]?.repeats ?? 1} times, matches the total elevation demand.`}
                          {target.altitudeExposure !== "None"
                            ? ` Note: altitude above ~${hills[0]?.summitElevationASL ?? "?"}m ASL cannot be replicated locally — plan acclimatisation separately.`
                            : ""}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Hill cards */}
                <View style={{ gap: 10 }}>
                  {hills.slice(0, 2).map((hill, idx) => {
                    const isExpanded = expandedHill === idx;
                    const dayLabel = hills.length >= 2 ? (idx === 0 ? "Saturday" : "Sunday") : undefined;
                    return (
                      <TouchableOpacity
                        key={hill.name}
                        activeOpacity={0.85}
                        onPress={() => setExpandedHill(isExpanded ? null : idx)}
                        style={s.hillCard}
                      >
                        <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
                        {dayLabel && <Text style={s.hillDay}>{dayLabel}</Text>}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View style={s.hillEmoji}>
                            <Text style={{ fontSize: 22 }}>{hill.emoji}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.hillName}>{hill.name}</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                              <MapPin size={10} color={T.textDim} />
                              <Text style={s.hillMeta}>{hill.surface} · {hill.grade} · {hill.distance}km away</Text>
                            </View>
                          </View>
                          {isExpanded
                            ? <ChevronUp size={16} color={T.textDim} />
                            : <ChevronDown size={16} color={T.textDim} />}
                        </View>
                        <View style={s.hillStatsRow}>
                          <HillStat value={`${hill.elevation}m`} label="per rep" />
                          <View style={s.hillStatDiv} />
                          <HillStat value={`×${hill.repeats}`} label="reps" />
                          <View style={s.hillStatDiv} />
                          <HillStat value={`${hill.totalElevation}m`} label="total gain" />
                          {hill.summitElevationASL ? (
                            <>
                              <View style={s.hillStatDiv} />
                              <HillStat value={`${hill.summitElevationASL}m`} label="summit ASL" />
                            </>
                          ) : null}
                        </View>
                        {isExpanded && target && (
                          <View style={[s.hillExplainBox, { marginTop: 4 }]}>
                            <Text style={s.hillExplainText}>
                              {hill.name} contributes {hill.totalElevation}m of elevation — {Math.round(hill.totalElevation / target.totalElevationGain * 100)}% of {target.name}'s total gain.
                              {hill.routeType === "circular"
                                ? " Circular route — no retracing."
                                : hill.routeType === "out-and-back"
                                ? " Out-and-back route."
                                : " Hill repeats — ascend and descend the same slope multiple times."}
                              {hill.estimatedTime ? ` Estimated time: ~${hill.estimatedTime}.` : ""}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Matchup summary row */}
                {target && (
                  <View style={[s.card, { marginTop: 10 }]}>
                    <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
                    <Text style={s.sectionLabel}>COMBINED HILLS vs {target.name.toUpperCase()}</Text>
                    {[
                      { label: "Elevation gain", local: `${hills.reduce((t, h) => t + h.totalElevation, 0).toLocaleString()}m`, goal: `${target.totalElevationGain.toLocaleString()}m` },
                      { label: "Distance", local: `~${hills.reduce((t, h) => t + (h.routeDistance ?? h.distance * 2), 0).toFixed(0)}km`, goal: `${target.totalDistance}km` },
                      { label: "Days", local: hills.length >= 2 ? "2 days" : "1 day", goal: `${target.estimatedDays} day${target.estimatedDays > 1 ? "s" : ""}` },
                    ].map((row, i, arr) => (
                      <View key={row.label} style={[s.matchRow, i < arr.length - 1 && s.matchRowBorder]}>
                        <Text style={s.matchLabel}>{row.label}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={[s.matchValue, { color: T.green }]}>{row.local}</Text>
                          <Text style={{ fontSize: 11, color: T.textDim }}>vs</Text>
                          <Text style={[s.matchValue, { color: T.textMuted }]}>{row.goal}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Refresh button */}
                <TouchableOpacity
                  onPress={() => void fetchExpedition(true)}
                  disabled={loading}
                  activeOpacity={0.75}
                  style={[s.refreshBtn, { marginTop: 8 }]}
                >
                  {loading
                    ? <ActivityIndicator color={T.textMuted} size="small" />
                    : <RefreshCw size={13} color={T.textMuted} />}
                  <Text style={s.refreshText}>{loading ? "Searching…" : "Refresh hill recommendations"}</Text>
                </TouchableOpacity>
                <Text style={s.refreshHint}>Use this if you change your location or want different options.</Text>
              </>
            )}
          </Animated.View>
        )}

        {/* ── Goal mountain profile ─────────────────────────────────────────── */}
        {target && (
          <Animated.View entering={FadeInDown.delay(120).duration(500)} style={s.section}>
            <Text style={s.sectionTitle}>GOAL MOUNTAIN PROFILE</Text>
            <View style={s.card}>
              <LinearGradient colors={[T.blueDim, "transparent"]} style={StyleSheet.absoluteFill} />
              {/* Header row */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={s.mountainIconWrap}>
                  <Mountain size={18} color={T.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.mountainName}>{target.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <MapPin size={10} color={T.textDim} />
                    <Text style={s.mountainMeta}>{target.country}</Text>
                  </View>
                </View>
                {/* Badges */}
                <View style={[s.badge, { backgroundColor: diffColor(target.difficulty) + "22", borderColor: diffColor(target.difficulty) + "50" }]}>
                  <Text style={[s.badgeText, { color: diffColor(target.difficulty) }]}>{target.difficulty}</Text>
                </View>
              </View>

              {/* Stats row */}
              <View style={[s.statsRow, { marginTop: 12 }]}>
                <MiniStat value={`${target.summitElevation.toLocaleString()}m`} label="Summit" accent={T.blue} />
                <View style={s.statDivider} />
                <MiniStat value={`${target.totalElevationGain.toLocaleString()}m`} label="Total gain" accent={T.green} />
                <View style={s.statDivider} />
                <MiniStat value={`${target.totalDistance}km`} label="Distance" accent={T.orange} />
                <View style={s.statDivider} />
                <MiniStat value={`${target.estimatedDays}d`} label="Days" accent={T.purple} />
              </View>

              {/* Altitude exposure badge if relevant */}
              {target.altitudeExposure !== "None" && (
                <View style={[s.badge, { alignSelf: "flex-start", marginTop: 10, backgroundColor: altColor(target.altitudeExposure) + "22", borderColor: altColor(target.altitudeExposure) + "50" }]}>
                  <Text style={[s.badgeText, { color: altColor(target.altitudeExposure) }]}>⛰ {target.altitudeExposure} altitude</Text>
                </View>
              )}

              {/* Route notes */}
              {target.notes && (
                <Text style={s.notesText}>{target.notes}</Text>
              )}
            </View>
          </Animated.View>
        )}

        {/* ── Simulation score ──────────────────────────────────────────────── */}
        {score > 0 && (
          <Animated.View entering={FadeInDown.delay(160).duration(500)} style={s.section}>
            <TouchableOpacity
              onPress={() => setScoreExpanded(v => !v)}
              activeOpacity={0.85}
              style={s.card}
            >
              <LinearGradient colors={[scoreColor(score) + "10", "transparent"]} style={StyleSheet.absoluteFill} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <ProgressRing score={score} size={56} strokeWidth={5} color={scoreColor(score)} />
                <View style={{ flex: 1 }}>
                  <Text style={s.sectionLabel}>LOCAL HILL MATCH SCORE</Text>
                  <Text style={[s.scoreCaption, { color: scoreColor(score) }]}>
                    {scoreLabel(score)} — your local hills match {score}% of {summitGoal.mountainName}'s physical demands.
                  </Text>
                </View>
                {scoreExpanded
                  ? <ChevronUp size={16} color={T.textDim} />
                  : <ChevronDown size={16} color={T.textDim} />}
              </View>
            </TouchableOpacity>

            {scoreExpanded && breakdown && (
              <Animated.View entering={FadeInDown.duration(250)} style={[s.card, { marginTop: 6 }]}>
                <Text style={[s.sectionLabel, { marginBottom: 4 }]}>SCORE BREAKDOWN</Text>
                {(
                  [
                    { key: "elevation" as const,       label: "Elevation gain",    emoji: "▲" },
                    { key: "duration" as const,        label: "Duration",          emoji: "⏱" },
                    { key: "altitude" as const,        label: "Altitude exposure", emoji: "⛰" },
                    { key: "consecutiveDays" as const, label: "Consecutive days",  emoji: "📅" },
                  ] as Array<{ key: keyof SimulationScoreBreakdown; label: string; emoji: string }>
                ).map((dim, idx, arr) => {
                  const val = (breakdown[dim.key] as number) ?? 0;
                  const dc = val >= 70 ? T.green : val >= 40 ? T.orange : T.red;
                  return (
                    <View key={dim.key} style={[s.dimRow, idx < arr.length - 1 && s.dimRowBorder]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5 }}>
                        <Text style={{ fontSize: 12 }}>{dim.emoji}</Text>
                        <Text style={s.dimLabel}>{dim.label}</Text>
                        <Text style={[s.dimPct, { color: dc }]}>{val}%</Text>
                      </View>
                      <View style={s.dimBarTrack}>
                        <View style={[s.dimBarFill, { width: `${val}%` as `${number}%`, backgroundColor: dc }]} />
                      </View>
                      {dim.key === "altitude" && target && target.summitElevation > 1500 && val < 50 && (
                        <View style={s.altNote}>
                          <Info size={11} color={T.orange} style={{ marginTop: 1 }} />
                          <Text style={s.altNoteText}>
                            {target.name} summits at {target.summitElevation.toLocaleString()}m ASL — local hills can't replicate this altitude. Plan acclimatisation separately.
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </Animated.View>
            )}
          </Animated.View>
        )}

        {/* Inline error when refresh fails but cached data is present */}
        {fetchError && hasCachedData && (
          <View style={[s.section, { marginTop: 0 }]}>
            <View style={s.errorBanner}>
              <AlertTriangle size={13} color={T.orange} />
              <Text style={s.errorBannerText}>{fetchError}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Log Hike Modal ────────────────────────────────────────────────────── */}
      <Modal
        visible={logModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLogModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }}
            activeOpacity={1}
            onPress={() => !logSaving && setLogModalVisible(false)}
          />
          <View style={s.modalSheet}>
            <LinearGradient colors={["#0F1D30", "#0A1628"]} style={StyleSheet.absoluteFill} />

            {logSuccess ? (
              <View style={{ alignItems: "center", paddingVertical: 32, gap: 12 }}>
                <CheckCircle size={44} color={T.green} />
                <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: T.white }}>Hike logged!</Text>
                <Text style={s.mutedText}>Your progress has been updated.</Text>
              </View>
            ) : (
              <>
                <Text style={s.modalTitle}>Log a Completed Hike</Text>
                <Text style={[s.mutedText, { marginBottom: 20 }]}>
                  Record the elevation gain and distance from a real outdoor hike toward your {summitGoal.mountainName} goal.
                </Text>

                <Text style={s.inputLabel}>Elevation Gain (metres) *</Text>
                <TextInput
                  style={s.input}
                  value={logElev}
                  onChangeText={setLogElev}
                  keyboardType="numeric"
                  placeholder="e.g. 650"
                  placeholderTextColor={T.textDim}
                />

                <Text style={[s.inputLabel, { marginTop: 12 }]}>Distance (km)</Text>
                <TextInput
                  style={s.input}
                  value={logDist}
                  onChangeText={setLogDist}
                  keyboardType="numeric"
                  placeholder="e.g. 12.5"
                  placeholderTextColor={T.textDim}
                />

                <Text style={[s.inputLabel, { marginTop: 12 }]}>Notes (optional)</Text>
                <TextInput
                  style={[s.input, { minHeight: 68, textAlignVertical: "top" }]}
                  value={logNotes}
                  onChangeText={setLogNotes}
                  multiline
                  placeholder="How did it go? Which hill?"
                  placeholderTextColor={T.textDim}
                />

                <TouchableOpacity
                  onPress={handleLogHike}
                  disabled={logSaving || !logElev || parseFloat(logElev) <= 0}
                  activeOpacity={0.85}
                  style={[
                    s.logHikeBtn,
                    { marginTop: 20 },
                    (!logElev || parseFloat(logElev) <= 0) && { opacity: 0.45 },
                  ]}
                >
                  {logSaving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.logHikeBtnText}>Save Hike</Text>}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setLogModalVisible(false)}
                  style={{ marginTop: 10, alignItems: "center", paddingVertical: 10 }}
                >
                  <Text style={s.mutedText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </LinearGradient>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function HeroContent({
  summitGoal, topInset, isVirtual, onSwitchMode,
}: {
  summitGoal: SummitGoal;
  topInset: number;
  isVirtual: boolean;
  onSwitchMode: () => void;
}) {
  return (
    <View style={[s.heroOverlay, { paddingTop: topInset + 12 }]}>
      <View style={s.heroTopRow}>
        <ExpoImage
          source={require("@/assets/images/logo.gif")}
          style={{ width: 160, height: 64 }}
          contentFit="contain"
        />
        <TouchableOpacity onPress={onSwitchMode} style={s.modeChip} activeOpacity={0.8}>
          <Text style={s.modeChipText}>
            {isVirtual ? "⚡ Training mode" : "🏔 Virtual mode"}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={s.heroBottom}>
        <Text style={s.heroLabel}>YOU'RE CHASING</Text>
        <Text style={s.heroMountainName} numberOfLines={2}>{summitGoal.mountainName}</Text>
        <View style={s.heroBadges}>
          <View style={s.heroBadge}>
            <MapPin size={11} color="rgba(255,255,255,0.7)" />
            <Text style={s.heroBadgeText}>{summitGoal.location}</Text>
          </View>
          <View style={[s.heroBadge, { backgroundColor: "rgba(74,159,245,0.3)" }]}>
            <Mountain size={11} color={T.blue} />
            <Text style={[s.heroBadgeText, { color: T.blue }]}>Virtual simulation</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function MiniStat({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: accent }}>{value}</Text>
      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 1 }}>{label}</Text>
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
  // Hero
  hero: { width: "100%", height: 290 },
  heroOverlay: {
    flex: 1, paddingHorizontal: 18,
    justifyContent: "space-between", paddingBottom: 22,
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  modeChip: {
    position: "absolute", right: 0, top: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  modeChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.85)" },
  heroBottom: { gap: 4 },
  heroLabel: {
    fontSize: 11, fontFamily: "Inter_700Bold", color: T.blue,
    letterSpacing: 2, textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.9)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  heroMountainName: {
    fontSize: 32, fontFamily: "Inter_700Bold", color: "#fff", lineHeight: 38,
    textShadowColor: "rgba(0,0,0,0.95)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10,
  },
  heroBadges: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" },
  heroBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  heroBadgeText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)" },

  // Layout
  section: { paddingHorizontal: 16, marginTop: 14 },
  sectionTitle: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim,
    letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, marginLeft: 2,
  },
  sectionLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim,
    letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 10,
  },

  // Cards
  card: {
    backgroundColor: "#0F1D30", borderRadius: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    padding: 16, overflow: "hidden",
  },
  explainerCard: {
    backgroundColor: "#0F1D30", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(74,159,245,0.2)",
    padding: 14, overflow: "hidden",
  },
  explainerIcon: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center",
  },
  explainerTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 3 },
  explainerText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18 },

  // Progress bars
  progressLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressBarLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: T.text },
  progressBarValue: { fontSize: 12, fontFamily: "Inter_400Regular" },
  barTrack: { height: 8, backgroundColor: "#142236", borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  progressPct: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim },
  hikeCountRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  hikeCountText: { fontSize: 13, fontFamily: "Inter_500Medium", color: T.green },

  // Log hike button
  logHikeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: T.blue, borderRadius: 13,
    paddingVertical: 12, paddingHorizontal: 20, marginTop: 16,
  },
  logHikeBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },

  // Hill cards
  hillCard: {
    backgroundColor: "#0F1D30", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    padding: 14, gap: 10, overflow: "hidden",
  },
  hillDay: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.green, textTransform: "uppercase", letterSpacing: 1 },
  hillEmoji: { width: 44, height: 44, borderRadius: 12, backgroundColor: T.greenDim, alignItems: "center", justifyContent: "center" },
  hillName: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.white },
  hillMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  hillStatsRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#142236", borderRadius: 10, paddingVertical: 9, paddingHorizontal: 6,
  },
  hillStatDiv: { width: 1, height: 22, backgroundColor: "rgba(255,255,255,0.07)" },
  hillExplainBox: {
    backgroundColor: T.blueDim, borderRadius: 8,
    padding: 10, borderWidth: 1, borderColor: "rgba(74,159,245,0.2)",
  },
  hillExplainText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 17 },

  // Mountain profile
  mountainIconWrap: { width: 40, height: 40, borderRadius: 11, backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center" },
  mountainName: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.white },
  mountainMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  statsRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#142236", borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 6,
  },
  statDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.07)" },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  notesText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 19, marginTop: 10 },

  // Matchup
  matchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 9 },
  matchRowBorder: { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  matchLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: T.text, flex: 1 },
  matchValue: { fontSize: 13, fontFamily: "Inter_700Bold" },

  // Score breakdown
  scoreCaption: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  dimRow: { paddingVertical: 10 },
  dimRowBorder: { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  dimLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: T.text, flex: 1 },
  dimPct: { fontSize: 13, fontFamily: "Inter_700Bold" },
  dimBarTrack: { height: 5, backgroundColor: "#142236", borderRadius: 3, overflow: "hidden" },
  dimBarFill: { height: 5, borderRadius: 3 },
  altNote: {
    flexDirection: "row", gap: 6, alignItems: "flex-start",
    backgroundColor: T.orange + "10", borderRadius: 8, padding: 8, marginTop: 6,
    borderWidth: 1, borderColor: T.orange + "25",
  },
  altNoteText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 16, flex: 1 },

  // Refresh
  refreshBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    paddingVertical: 12, borderRadius: 12,
    backgroundColor: "#142236", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  refreshText: { fontSize: 13, fontFamily: "Inter_500Medium", color: T.textMuted },
  refreshHint: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center", marginTop: 5 },

  // Error
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: T.orange + "12", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: T.orange + "30",
  },
  errorBannerText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, flex: 1 },

  // Misc
  mutedText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 19 },
  retryBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10, backgroundColor: T.blueDim, borderWidth: 1, borderColor: T.blue + "40" },
  retryBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.blue },

  // Modal
  modalSheet: {
    backgroundColor: "#0F1D30",
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    padding: 24, paddingBottom: 40,
    overflow: "hidden",
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 6 },
  inputLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    backgroundColor: "#142236", borderRadius: 11,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    color: T.white, fontFamily: "Inter_400Regular", fontSize: 15,
    paddingHorizontal: 14, paddingVertical: 12,
  },
});
