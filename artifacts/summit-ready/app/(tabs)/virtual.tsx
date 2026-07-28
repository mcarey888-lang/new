/**
 * Virtual tab — Mountain Bundle Discovery + Outdoor Progress Tracker
 *
 * Browse-first design: custom search at top, curated bundles below.
 * No onboarding required — works for any user regardless of mode.
 *
 * Free tier: 3 curated bundles always accessible.
 * Premium: all bundles + unlimited custom search.
 */

import {
  Mountain, Search, MapPin, ChevronRight, Lock,
  ArrowLeft, RefreshCw, CheckCircle, Plus, Compass,
  ChevronDown, ChevronUp, Info, AlertTriangle, Star,
  SlidersHorizontal, LayoutGrid, LayoutList,
} from "lucide-react-native";
import { VirtualMountainCard } from "@/components/VirtualMountainCard";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
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
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useSubscription } from "@/lib/revenuecat";
import { T } from "@/constants/theme";
import { ProgressRing } from "@/components/ProgressRing";
import { useScreenView } from "@/lib/analytics";
import { VIRTUAL_BUNDLES, FREE_BUNDLE_IDS, type VirtualBundle } from "@/data/virtualBundles";
import type {
  NearbyHill, SimulationScoreBreakdown, SummitGoal, TargetMountain,
} from "@/context/AppContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ExpeditionResult {
  targetProfile: TargetMountain & { notes?: string | null };
  recommendedHills: NearbyHill[];
  simulationScore: number;
  scoreBreakdown: SimulationScoreBreakdown;
}

type ViewMode = "browse" | "results" | "progress";

// ── Helpers ────────────────────────────────────────────────────────────────────

function diffColor(d: string) {
  if (d === "Easy")     return T.green;
  if (d === "Moderate") return T.blue;
  if (d === "Hard")     return T.orange;
  return "#FF4444";
}
function scoreColor(s: number) {
  if (s >= 80) return T.green;
  if (s >= 60) return T.blue;
  if (s >= 40) return T.orange;
  return T.red;
}
function scoreLabel(s: number) {
  if (s >= 80) return "Excellent match";
  if (s >= 60) return "Good match";
  if (s >= 40) return "Partial match";
  return "Early stages";
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function VirtualScreen() {
  useScreenView("virtual_tab");
  const insets = useSafeAreaInsets();
  const { summitGoal, setSummitGoal } = useApp();
  const { isSubscribed } = useSubscription();

  // view state
  const [view, setView] = useState<ViewMode>("browse");
  const [results, setResults] = useState<ExpeditionResult | null>(null);
  const [activeBundle, setActiveBundle] = useState<VirtualBundle | null>(null);
  const [activeSearch, setActiveSearch] = useState<{ mountain: string; region: string } | null>(null);

  // search inputs
  const [searchMountain, setSearchMountain] = useState("");
  const [searchRegion, setSearchRegion] = useState("");

  // fetch state
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // score accordion
  const [scoreOpen, setScoreOpen] = useState(false);

  // log hike modal (progress view)
  const [logModal, setLogModal] = useState(false);
  const [logElev, setLogElev] = useState("");
  const [logDist, setLogDist] = useState("");
  const [logSaving, setLogSaving] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);
  const logTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // upsell nudge
  const [upsellVisible, setUpsellVisible] = useState(false);

  // grid / list toggle (visual state — single-column list is default)
  const [gridView, setGridView] = useState(false);

  const { patchGoal } = useApp();

  const topPad = Platform.OS === "web" ? 56 : insets.top + 16;
  const botPad = Platform.OS === "web" ? 120 : insets.bottom + 100;

  const isVirtualGoalActive = summitGoal?.mode === "virtual";

  // ── Fetch expedition ─────────────────────────────────────────────────────────
  async function fetchExpedition(mountain: string, region: string) {
    setLoading(true);
    setFetchError(null);
    setResults(null);
    try {
      const res = await fetch(`${API_BASE}/virtual-expedition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetMountain: mountain, userLocation: region, radius: 40 }),
      });
      const body = await res.json() as ExpeditionResult & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Server error ${res.status}`);
      setResults(body);
      setView("results");
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Couldn't load expedition data.");
    } finally {
      setLoading(false);
    }
  }

  // ── Bundle tap ───────────────────────────────────────────────────────────────
  function handleBundleTap(bundle: VirtualBundle) {
    if (!bundle.free && !isSubscribed) {
      setUpsellVisible(true);
      return;
    }
    setActiveBundle(bundle);
    setActiveSearch(null);
    void fetchExpedition(bundle.goalMountain, bundle.region);
  }

  // ── Custom search ────────────────────────────────────────────────────────────
  function handleSearch() {
    if (searchMountain.trim().length < 2 || searchRegion.trim().length < 2) return;
    setActiveBundle(null);
    setActiveSearch({ mountain: searchMountain.trim(), region: searchRegion.trim() });
    void fetchExpedition(searchMountain.trim(), searchRegion.trim());
  }

  // ── Set as goal ──────────────────────────────────────────────────────────────
  async function handleSetGoal() {
    if (!results) return;
    const mountainName = activeBundle?.goalMountain ?? activeSearch?.mountain ?? results.targetProfile.name;
    const location = activeBundle?.region ?? activeSearch?.region ?? "";

    const newGoal: SummitGoal = {
      mountainName,
      summitDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      distance: results.targetProfile.totalDistance,
      elevationGain: results.targetProfile.totalElevationGain,
      highestAltitude: results.targetProfile.summitElevation,
      difficulty: results.targetProfile.difficulty,
      fitnessLevel: summitGoal?.fitnessLevel ?? "Average",
      location,
      maxRadius: 40,
      equipment: summitGoal?.equipment ?? ["none"],
      trainingDaysPerWeek: summitGoal?.trainingDaysPerWeek ?? 3,
      hillDaysPerWeek: summitGoal?.hillDaysPerWeek ?? 2,
      mode: "virtual",
      targetMountain: results.targetProfile,
      virtualHills: results.recommendedHills,
      simulationScore: results.simulationScore,
      simulationScoreBreakdown: results.scoreBreakdown,
    };
    await setSummitGoal(newGoal);
    setView("progress");
  }

  // ── Log hike ─────────────────────────────────────────────────────────────────
  async function handleLogHike() {
    const elevM = parseFloat(logElev);
    if (isNaN(elevM) || elevM <= 0) return;
    setLogSaving(true);
    try {
      const prev = summitGoal?.virtualHikeProgress ?? { elevationGained: 0, distanceCovered: 0, hikesLogged: 0 };
      const distKm = parseFloat(logDist);
      await patchGoal({
        virtualHikeProgress: {
          elevationGained: prev.elevationGained + elevM,
          distanceCovered: prev.distanceCovered + (isNaN(distKm) ? 0 : distKm),
          hikesLogged: prev.hikesLogged + 1,
        },
      });
      setLogElev("");
      setLogDist("");
      setLogSuccess(true);
      logTimer.current = setTimeout(() => {
        setLogSuccess(false);
        setLogModal(false);
      }, 1400);
    } finally {
      setLogSaving(false);
    }
  }

  // ── Loading overlay ──────────────────────────────────────────────────────────
  if (loading) {
    const label = activeBundle
      ? `Finding hills in ${activeBundle.regionDisplay}…`
      : `Searching ${activeSearch?.region ?? ""}…`;
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 20, padding: 32 }}>
        <View style={{ width: 68, height: 68, borderRadius: 20, backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={T.blue} size="large" />
        </View>
        <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: T.white, textAlign: "center" }}>
          {activeBundle ? activeBundle.goalMountain : searchMountain}
        </Text>
        <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" }}>
          {label}
        </Text>
      </LinearGradient>
    );
  }

  // ── Results view ─────────────────────────────────────────────────────────────
  if (view === "results" && results) {
    const tp = results.targetProfile;
    const hills = results.recommendedHills;
    const score = results.simulationScore;
    const bd = results.scoreBreakdown;
    const isWeekend = hills.length >= 2;
    const sc = scoreColor(score);
    const isFreeBundle = activeBundle ? activeBundle.free : true; // custom search is always settable

    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad, paddingHorizontal: 16, gap: 14 }}>

          {/* Back */}
          <TouchableOpacity onPress={() => { setView("browse"); setResults(null); setFetchError(null); }} style={s.backRow} activeOpacity={0.7}>
            <ArrowLeft size={16} color={T.textMuted} />
            <Text style={s.backText}>All mountains</Text>
          </TouchableOpacity>

          {/* Mountain header */}
          <Animated.View entering={FadeInDown.duration(350)}>
            <View style={[s.card, { gap: 10 }]}>
              <LinearGradient colors={[T.blueDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={s.mountainIconWrap}>
                  <Mountain size={20} color={T.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.mountainTitle}>{tp.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <MapPin size={10} color={T.textDim} />
                    <Text style={s.mountainSub}>{tp.country}</Text>
                  </View>
                </View>
                <View style={[s.badge, { backgroundColor: diffColor(tp.difficulty) + "22", borderColor: diffColor(tp.difficulty) + "40" }]}>
                  <Text style={[s.badgeText, { color: diffColor(tp.difficulty) }]}>{tp.difficulty}</Text>
                </View>
              </View>
              <View style={s.statsRow}>
                <StatCell value={`${tp.summitElevation.toLocaleString()}m`} label="Summit" accent={T.blue} />
                <View style={s.statDiv} />
                <StatCell value={`${tp.totalElevationGain.toLocaleString()}m`} label="Gain" accent={T.green} />
                <View style={s.statDiv} />
                <StatCell value={`${tp.totalDistance}km`} label="Distance" accent={T.orange} />
                <View style={s.statDiv} />
                <StatCell value={`${tp.estimatedDays}d`} label="Days" accent={T.purple} />
              </View>
              {tp.notes ? <Text style={s.notesText}>{tp.notes}</Text> : null}
            </View>
          </Animated.View>

          {/* Region */}
          <Animated.View entering={FadeInDown.delay(40).duration(350)}>
            <View style={[s.card, { flexDirection: "row", alignItems: "center", gap: 10 }]}>
              <MapPin size={14} color={T.green} />
              <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: T.text, flex: 1 }}>
                Equivalent hills in{" "}
                <Text style={{ color: T.green, fontFamily: "Inter_700Bold" }}>
                  {activeBundle?.regionDisplay ?? activeSearch?.region}
                </Text>
              </Text>
            </View>
          </Animated.View>

          {/* Hills */}
          {hills.map((hill, idx) => (
            <Animated.View key={hill.name} entering={FadeInDown.delay(60 + idx * 40).duration(350)}>
              <View style={s.hillCard}>
                <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
                {isWeekend && (
                  <Text style={s.hillDay}>{idx === 0 ? "Saturday" : "Sunday"}</Text>
                )}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={s.hillEmoji}>
                    <Text style={{ fontSize: 22 }}>{hill.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.hillName}>{hill.name}</Text>
                    <Text style={s.hillMeta}>{hill.surface} · {hill.grade} · {hill.distance}km away</Text>
                  </View>
                </View>
                <View style={s.hillStats}>
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
                {hill.routeType ? (
                  <Text style={s.routeType}>
                    {hill.routeType === "circular" ? "🔄 Circular" : hill.routeType === "out-and-back" ? "↔️ Out & back" : "⛰ Hill repeats"}
                    {hill.estimatedTime ? `  ·  ~${hill.estimatedTime}` : ""}
                  </Text>
                ) : null}
              </View>
            </Animated.View>
          ))}

          {/* Score */}
          <Animated.View entering={FadeInDown.delay(140).duration(350)}>
            <TouchableOpacity style={s.card} onPress={() => setScoreOpen(v => !v)} activeOpacity={0.85}>
              <LinearGradient colors={[sc + "10", "transparent"]} style={StyleSheet.absoluteFill} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <ProgressRing score={score} size={52} strokeWidth={5} color={sc} />
                <View style={{ flex: 1 }}>
                  <Text style={s.dimLabel}>Local hill match score</Text>
                  <Text style={[s.scoreCaption, { color: sc }]}>{scoreLabel(score)} — {score}% of {tp.name}'s demands replicated locally</Text>
                </View>
                {scoreOpen ? <ChevronUp size={15} color={T.textDim} /> : <ChevronDown size={15} color={T.textDim} />}
              </View>
            </TouchableOpacity>
            {scoreOpen && (
              <Animated.View entering={FadeInDown.duration(220)} style={[s.card, { marginTop: 6 }]}>
                {(
                  [
                    { key: "elevation" as const,       label: "Elevation gain",    emoji: "▲" },
                    { key: "duration" as const,        label: "Duration",          emoji: "⏱" },
                    { key: "altitude" as const,        label: "Altitude",          emoji: "⛰" },
                    { key: "consecutiveDays" as const, label: "Consecutive days",  emoji: "📅" },
                  ] as Array<{ key: keyof SimulationScoreBreakdown; label: string; emoji: string }>
                ).map((dim, idx, arr) => {
                  const val = (bd[dim.key] as number) ?? 0;
                  const dc = val >= 70 ? T.green : val >= 40 ? T.orange : T.red;
                  return (
                    <View key={dim.key} style={[s.dimRow, idx < arr.length - 1 && s.dimRowBorder]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Text style={{ fontSize: 11 }}>{dim.emoji}</Text>
                        <Text style={[s.dimLabel, { flex: 1 }]}>{dim.label}</Text>
                        <Text style={[s.dimPct, { color: dc }]}>{val}%</Text>
                      </View>
                      <View style={s.dimBarTrack}>
                        <View style={[s.dimBarFill, { width: `${val}%` as `${number}%`, backgroundColor: dc }]} />
                      </View>
                    </View>
                  );
                })}
              </Animated.View>
            )}
          </Animated.View>

          {/* CTA */}
          <Animated.View entering={FadeInDown.delay(180).duration(350)}>
            <TouchableOpacity onPress={() => void handleSetGoal()} style={s.setGoalBtn} activeOpacity={0.85}>
              <CheckCircle size={17} color="#fff" />
              <Text style={s.setGoalBtnText}>Set as my Virtual Goal</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center", marginTop: 6 }}>
              Your progress tracking will start from zero — log hikes as you complete them.
            </Text>
          </Animated.View>

          {fetchError ? (
            <View style={s.errorBanner}>
              <AlertTriangle size={13} color={T.orange} />
              <Text style={s.errorText}>{fetchError}</Text>
            </View>
          ) : null}
        </ScrollView>
      </LinearGradient>
    );
  }

  // ── Progress view (active goal tracker) ─────────────────────────────────────
  if (view === "progress" && summitGoal?.mode === "virtual" && summitGoal.targetMountain) {
    const tp = summitGoal.targetMountain;
    const hills = summitGoal.virtualHills ?? [];
    const score = summitGoal.simulationScore ?? 0;
    const progress = summitGoal.virtualHikeProgress ?? { elevationGained: 0, distanceCovered: 0, hikesLogged: 0 };
    const elevPct = tp.totalElevationGain > 0 ? Math.min(1, progress.elevationGained / tp.totalElevationGain) : 0;
    const distPct = tp.totalDistance > 0 ? Math.min(1, progress.distanceCovered / tp.totalDistance) : 0;
    const sc = scoreColor(score);

    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad, paddingHorizontal: 16, gap: 14 }}>
          {/* Back */}
          <TouchableOpacity onPress={() => setView("browse")} style={s.backRow} activeOpacity={0.7}>
            <ArrowLeft size={16} color={T.textMuted} />
            <Text style={s.backText}>Browse mountains</Text>
          </TouchableOpacity>

          {/* Goal header */}
          <Animated.View entering={FadeInDown.duration(350)}>
            <View style={[s.card, { gap: 4 }]}>
              <LinearGradient colors={[T.blueDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <Text style={s.progressGoalLabel}>YOU'RE CHASING</Text>
              <Text style={s.progressGoalName}>{summitGoal.mountainName}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                <MapPin size={10} color={T.textDim} />
                <Text style={s.progressGoalSub}>Training in {summitGoal.location}</Text>
              </View>
            </View>
          </Animated.View>

          {/* Progress bars */}
          <Animated.View entering={FadeInDown.delay(40).duration(350)}>
            <View style={s.card}>
              <Text style={s.sectionLabel}>YOUR REAL HIKE PROGRESS</Text>
              <View style={{ gap: 6 }}>
                <View style={s.progRow}>
                  <Text style={s.progBarLabel}>▲ Elevation gained</Text>
                  <Text style={s.progBarValue}>
                    <Text style={{ color: T.green, fontFamily: "Inter_700Bold" }}>{progress.elevationGained.toLocaleString()}m</Text>
                    {"  "}<Text style={{ color: T.textDim }}>of {tp.totalElevationGain.toLocaleString()}m</Text>
                  </Text>
                </View>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${Math.round(elevPct * 100)}%` as `${number}%`, backgroundColor: T.green }]} />
                </View>
                <Text style={s.progPct}>{Math.round(elevPct * 100)}% of goal elevation</Text>
              </View>
              <View style={{ gap: 6, marginTop: 12 }}>
                <View style={s.progRow}>
                  <Text style={s.progBarLabel}>↔ Distance covered</Text>
                  <Text style={s.progBarValue}>
                    <Text style={{ color: T.orange, fontFamily: "Inter_700Bold" }}>{progress.distanceCovered.toFixed(1)}km</Text>
                    {"  "}<Text style={{ color: T.textDim }}>of {tp.totalDistance}km</Text>
                  </Text>
                </View>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${Math.round(distPct * 100)}%` as `${number}%`, backgroundColor: T.orange }]} />
                </View>
                <Text style={s.progPct}>{Math.round(distPct * 100)}% of goal distance</Text>
              </View>
              {progress.hikesLogged > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
                  <CheckCircle size={13} color={T.green} />
                  <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: T.green }}>
                    {progress.hikesLogged} {progress.hikesLogged === 1 ? "hike" : "hikes"} logged
                  </Text>
                </View>
              )}
              <TouchableOpacity onPress={() => { setLogElev(""); setLogDist(""); setLogSuccess(false); setLogModal(true); }} style={s.logHikeBtn} activeOpacity={0.85}>
                <Plus size={15} color="#fff" />
                <Text style={s.logHikeBtnText}>Log a Completed Hike</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Hills */}
          {hills.length > 0 && (
            <Animated.View entering={FadeInDown.delay(80).duration(350)} style={{ gap: 8 }}>
              <Text style={s.sectionTitle}>YOUR EQUIVALENT HILLS</Text>
              {hills.slice(0, 2).map((hill, idx) => (
                <View key={hill.name} style={s.hillCard}>
                  <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
                  {hills.length >= 2 && <Text style={s.hillDay}>{idx === 0 ? "Saturday" : "Sunday"}</Text>}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={s.hillEmoji}><Text style={{ fontSize: 20 }}>{hill.emoji}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.hillName}>{hill.name}</Text>
                      <Text style={s.hillMeta}>{hill.surface} · {hill.grade} · {hill.distance}km away</Text>
                    </View>
                  </View>
                  <View style={s.hillStats}>
                    <HillStat value={`${hill.elevation}m`} label="per rep" />
                    <View style={s.hillStatDiv} />
                    <HillStat value={`×${hill.repeats}`} label="reps" />
                    <View style={s.hillStatDiv} />
                    <HillStat value={`${hill.totalElevation}m`} label="total gain" />
                  </View>
                </View>
              ))}
            </Animated.View>
          )}

          {/* Simulation score pill */}
          {score > 0 && (
            <Animated.View entering={FadeInDown.delay(120).duration(350)}>
              <View style={s.card}>
                <LinearGradient colors={[sc + "10", "transparent"]} style={StyleSheet.absoluteFill} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <ProgressRing score={score} size={48} strokeWidth={5} color={sc} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.sectionLabel}>HILL MATCH SCORE</Text>
                    <Text style={[s.scoreCaption, { color: sc }]}>{scoreLabel(score)} — {score}% match</Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Change goal */}
          <Animated.View entering={FadeInDown.delay(160).duration(350)}>
            <TouchableOpacity onPress={() => setView("browse")} style={s.changeGoalBtn} activeOpacity={0.8}>
              <RefreshCw size={13} color={T.textMuted} />
              <Text style={s.changeGoalText}>Browse different mountains</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>

        {/* Log hike modal */}
        <Modal visible={logModal} transparent animationType="slide" onRequestClose={() => setLogModal(false)}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} activeOpacity={1} onPress={() => !logSaving && setLogModal(false)} />
            <View style={s.modalSheet}>
              <LinearGradient colors={["#0F1D30", "#0A1628"]} style={StyleSheet.absoluteFill} />
              {logSuccess ? (
                <View style={{ alignItems: "center", paddingVertical: 28, gap: 10 }}>
                  <CheckCircle size={40} color={T.green} />
                  <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: T.white }}>Hike logged!</Text>
                  <Text style={{ fontSize: 13, color: T.textMuted, fontFamily: "Inter_400Regular" }}>Progress updated.</Text>
                </View>
              ) : (
                <>
                  <Text style={s.modalTitle}>Log a Completed Hike</Text>
                  <Text style={[s.modalSub, { marginBottom: 16 }]}>Record elevation and distance from a real outdoor hike toward your {summitGoal.mountainName} goal.</Text>
                  <Text style={s.inputLabel}>Elevation Gain (metres) *</Text>
                  <TextInput style={s.input} value={logElev} onChangeText={setLogElev} keyboardType="numeric" placeholder="e.g. 650" placeholderTextColor={T.textDim} />
                  <Text style={[s.inputLabel, { marginTop: 12 }]}>Distance (km)</Text>
                  <TextInput style={s.input} value={logDist} onChangeText={setLogDist} keyboardType="numeric" placeholder="e.g. 12.5" placeholderTextColor={T.textDim} />
                  <TouchableOpacity onPress={() => void handleLogHike()} disabled={logSaving || !logElev || parseFloat(logElev) <= 0} style={[s.logHikeBtn, { marginTop: 18 }, (!logElev || parseFloat(logElev) <= 0) && { opacity: 0.4 }]} activeOpacity={0.85}>
                    {logSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.logHikeBtnText}>Save Hike</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setLogModal(false)} style={{ marginTop: 8, alignItems: "center", paddingVertical: 10 }}>
                    <Text style={{ fontSize: 13, color: T.textMuted, fontFamily: "Inter_400Regular" }}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </LinearGradient>
    );
  }

  // ── Browse view (default) ────────────────────────────────────────────────────

  /** Derive per-bundle progress from the active virtual goal */
  function bundleProgress(bundle: VirtualBundle) {
    const isActive =
      summitGoal?.mode === "virtual" &&
      summitGoal.mountainName?.toLowerCase() === bundle.goalMountain.toLowerCase();

    if (!isActive || !summitGoal?.targetMountain) {
      return { progressPct: 0, elevationGained: 0, equivalentHills: bundle.exampleHills };
    }
    const gained = summitGoal.virtualHikeProgress?.elevationGained ?? 0;
    const goal   = summitGoal.targetMountain.totalElevationGain || bundle.totalElevationGain;
    const pct    = goal > 0 ? Math.min(100, Math.round((gained / goal) * 100)) : 0;
    const hills  = summitGoal.virtualHills?.map(h => h.name) ?? bundle.exampleHills;
    return { progressPct: pct, elevationGained: gained, equivalentHills: hills };
  }

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad }}>

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <Animated.View entering={FadeIn.duration(400)} style={{ paddingHorizontal: 16, marginBottom: 6 }}>
          <ExpoImage source={require("@/assets/images/logo.gif")} style={{ width: 140, height: 56, alignSelf: "center" }} contentFit="contain" />
          {/* Title row */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginTop: 4 }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={s.heroTitle}>Virtual Mountains</Text>
              <Text style={s.heroSub}>Train for the world's greatest adventures on your local hills</Text>
            </View>
            {/* Filter + grid toggle */}
            <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
              <TouchableOpacity
                style={s.headerIconBtn}
                activeOpacity={0.75}
                onPress={() => {/* filter: coming soon */}}
              >
                <SlidersHorizontal size={15} color={T.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.headerIconBtn, gridView && { borderColor: T.blue + "50", backgroundColor: T.blueDim }]}
                activeOpacity={0.75}
                onPress={() => setGridView(v => !v)}
              >
                {gridView
                  ? <LayoutList size={15} color={T.blue} />
                  : <LayoutGrid size={15} color={T.textMuted} />}
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* ── Active goal banner ───────────────────────────────────────────── */}
        {isVirtualGoalActive && summitGoal?.targetMountain && (
          <Animated.View entering={FadeInDown.duration(350)} style={{ paddingHorizontal: 16, marginBottom: 14 }}>
            <TouchableOpacity onPress={() => setView("progress")} activeOpacity={0.85} style={s.activeGoalBanner}>
              <LinearGradient colors={[T.blueDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <View style={{ flex: 1 }}>
                <Text style={s.activeGoalLabel}>ACTIVE GOAL</Text>
                <Text style={s.activeGoalName}>{summitGoal.mountainName}</Text>
                <Text style={s.activeGoalSub}>{summitGoal.location}</Text>
                {(summitGoal.virtualHikeProgress?.hikesLogged ?? 0) > 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <CheckCircle size={11} color={T.green} />
                    <Text style={{ fontSize: 11, color: T.green, fontFamily: "Inter_500Medium" }}>
                      {summitGoal.virtualHikeProgress!.hikesLogged}{" "}
                      {summitGoal.virtualHikeProgress!.hikesLogged === 1 ? "hike" : "hikes"} logged
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ alignItems: "center", gap: 4 }}>
                <ProgressRing score={summitGoal.simulationScore ?? 0} size={44} strokeWidth={4} color={scoreColor(summitGoal.simulationScore ?? 0)} />
                <ChevronRight size={14} color={T.blue} />
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Error banner ─────────────────────────────────────────────────── */}
        {fetchError && (
          <View style={[s.errorBanner, { marginHorizontal: 16, marginBottom: 12 }]}>
            <AlertTriangle size={13} color={T.orange} />
            <Text style={s.errorText}>{fetchError}</Text>
          </View>
        )}

        {/* ── Custom search ────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(60).duration(400)} style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={s.sectionTitle}>CUSTOM SEARCH</Text>
          <View style={s.searchCard}>
            <LinearGradient colors={[T.blueDim, "transparent"]} style={StyleSheet.absoluteFill} />
            <View style={s.searchRow}>
              <Mountain size={14} color={T.blue} />
              <TextInput
                style={[s.searchInput, { flex: 1 }]}
                value={searchMountain}
                onChangeText={setSearchMountain}
                placeholder="Goal mountain (e.g. Mont Blanc)"
                placeholderTextColor={T.textDim}
                returnKeyType="next"
              />
            </View>
            <View style={[s.searchRow, { marginTop: 10 }]}>
              <MapPin size={14} color={T.green} />
              <TextInput
                style={[s.searchInput, { flex: 1 }]}
                value={searchRegion}
                onChangeText={setSearchRegion}
                placeholder="Your hiking region (e.g. Lake District)"
                placeholderTextColor={T.textDim}
                returnKeyType="search"
                onSubmitEditing={handleSearch}
              />
            </View>
            <TouchableOpacity
              onPress={handleSearch}
              disabled={searchMountain.trim().length < 2 || searchRegion.trim().length < 2}
              style={[s.searchBtn, (searchMountain.trim().length < 2 || searchRegion.trim().length < 2) && { opacity: 0.4 }]}
              activeOpacity={0.85}
            >
              <Search size={15} color="#fff" />
              <Text style={s.searchBtnText}>Find Equivalent Hills</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Mountain cards ───────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16 }}>
          {VIRTUAL_BUNDLES.map((bundle, idx) => {
            const locked = !bundle.free && !isSubscribed;
            const prog = bundleProgress(bundle);
            return (
              <Animated.View key={bundle.id} entering={FadeInDown.delay(80 + idx * 30).duration(400)}>
                <VirtualMountainCard
                  bundle={bundle}
                  locked={locked}
                  onPress={() => handleBundleTap(bundle)}
                  progressPct={prog.progressPct}
                  elevationGained={prog.elevationGained}
                  equivalentHills={prog.equivalentHills}
                />
              </Animated.View>
            );
          })}
        </View>

        {/* ── Legend bar ───────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}>
          <View style={s.legendBar}>
            {/* Difficulty guide */}
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={s.legendTitle}>DIFFICULTY GUIDE</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  { label: "Easy",     color: T.green },
                  { label: "Moderate", color: T.blue },
                  { label: "Hard",     color: T.orange },
                  { label: "Expert",   color: T.red },
                ].map(({ label, color }) => (
                  <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color }} />
                    <Text style={s.legendItem}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
            {/* Separator */}
            <View style={{ width: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.07)" }} />
            {/* Route types */}
            <View style={{ gap: 6 }}>
              <Text style={s.legendTitle}>ROUTE TYPES</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  { label: "Trek",      color: "#FF9030" },
                  { label: "Alpine",    color: "#3ECF75" },
                  { label: "Technical", color: "#9B7FD4" },
                  { label: "Classic",   color: "#20CFCF" },
                ].map(({ label, color }) => (
                  <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: color }} />
                    <Text style={s.legendItem}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

      </ScrollView>

      {/* Upsell modal */}
      <Modal visible={upsellVisible} transparent animationType="fade" onRequestClose={() => setUpsellVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }} activeOpacity={1} onPress={() => setUpsellVisible(false)}>
          <View style={s.upsellSheet}>
            <LinearGradient colors={["#0F1D30", "#0A1628"]} style={StyleSheet.absoluteFill} />
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 20 }} />
            <View style={s.upsellIconWrap}>
              <Lock size={24} color={T.orange} />
            </View>
            <Text style={s.upsellTitle}>Unlock all mountains</Text>
            <Text style={s.upsellSub}>
              Premium gives you access to every bundle — Everest, Matterhorn, Aconcagua, and more — plus unlimited custom searches.
            </Text>
            <View style={s.upsellBullets}>
              {["9 additional mountain bundles", "Unlimited custom search", "Any mountain, any region"].map(t => (
                <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <CheckCircle size={13} color={T.green} />
                  <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted }}>{t}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={() => { setUpsellVisible(false); router.push("/paywall"); }} style={s.upsellBtn} activeOpacity={0.85}>
              <Star size={15} color="#fff" />
              <Text style={s.upsellBtnText}>Unlock Premium</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setUpsellVisible(false)} style={{ marginTop: 10, alignItems: "center", paddingVertical: 10 }}>
              <Text style={{ fontSize: 13, color: T.textMuted, fontFamily: "Inter_400Regular" }}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </LinearGradient>
  );
}

// BundleCard removed — replaced by VirtualMountainCard component

// ── Mini components ────────────────────────────────────────────────────────────

function StatCell({ value, label, accent }: { value: string; label: string; accent: string }) {
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
      <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: T.white }}>{value}</Text>
      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Header
  heroTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.white, marginTop: 4 },
  heroSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 17, marginTop: 3 },

  // Page header buttons
  headerIconBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },

  // Legend bar
  legendBar: {
    backgroundColor: "#0F1D30",
    borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    padding: 14,
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  legendTitle: {
    fontSize: 8, fontFamily: "Inter_700Bold", color: T.textDim,
    letterSpacing: 0.9, textTransform: "uppercase",
  },
  legendItem: {
    fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted,
  },

  // Active goal banner
  activeGoalBanner: {
    backgroundColor: "#0F1D30", borderRadius: 16,
    borderWidth: 1, borderColor: T.blue + "40",
    padding: 14, flexDirection: "row", alignItems: "center", gap: 12, overflow: "hidden",
  },
  activeGoalLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: T.blue, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 },
  activeGoalName: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.white },
  activeGoalSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },

  // Section labels
  sectionTitle: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 1.5, textTransform: "uppercase" },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 10 },

  // Search card
  searchCard: {
    backgroundColor: "#0F1D30", borderRadius: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    padding: 14, overflow: "hidden",
  },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", paddingBottom: 10 },
  searchInput: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.white },
  searchBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: T.blue, borderRadius: 12,
    paddingVertical: 12, marginTop: 12,
  },
  searchBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },

  // Bundle card
  bundleCard: {
    backgroundColor: "#0F1D30", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    padding: 14, marginBottom: 10, overflow: "hidden",
  },
  bundleEmoji: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  bundleMountainName: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.white },
  bundleRegion: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  bundleTagline: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 3, lineHeight: 16 },
  bundleHills: { fontSize: 11, fontFamily: "Inter_500Medium", color: T.green, marginTop: 2 },
  bundleSummit: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.blue },
  bundleSummitLabel: { fontSize: 9, fontFamily: "Inter_400Regular", color: T.textDim },
  lockBadge: { width: 26, height: 26, borderRadius: 8, backgroundColor: T.orangeDim, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: T.orange + "40" },

  // Cards
  card: {
    backgroundColor: "#0F1D30", borderRadius: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    padding: 16, overflow: "hidden",
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  badgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  statsRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#142236", borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 6, marginTop: 10,
  },
  statDiv: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.07)" },
  notesText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18, marginTop: 6 },

  // Mountain header
  mountainIconWrap: { width: 40, height: 40, borderRadius: 11, backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center" },
  mountainTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.white },
  mountainSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },

  // Hills
  hillCard: {
    backgroundColor: "#0F1D30", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    padding: 13, gap: 9, overflow: "hidden",
  },
  hillDay: { fontSize: 9, fontFamily: "Inter_700Bold", color: T.green, textTransform: "uppercase", letterSpacing: 1 },
  hillEmoji: { width: 42, height: 42, borderRadius: 11, backgroundColor: T.greenDim, alignItems: "center", justifyContent: "center" },
  hillName: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white },
  hillMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  hillStats: { flexDirection: "row", alignItems: "center", backgroundColor: "#142236", borderRadius: 9, paddingVertical: 8, paddingHorizontal: 6 },
  hillStatDiv: { width: 1, height: 20, backgroundColor: "rgba(255,255,255,0.07)" },
  routeType: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim },

  // Score
  scoreCaption: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginTop: 2 },
  dimRow: { paddingVertical: 8 },
  dimRowBorder: { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  dimLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: T.text },
  dimPct: { fontSize: 12, fontFamily: "Inter_700Bold" },
  dimBarTrack: { height: 4, backgroundColor: "#142236", borderRadius: 3, overflow: "hidden" },
  dimBarFill: { height: 4, borderRadius: 3 },

  // CTA
  setGoalBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: T.green, borderRadius: 14, paddingVertical: 14,
  },
  setGoalBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },

  // Progress view
  progressGoalLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: T.blue, letterSpacing: 1.8, textTransform: "uppercase" },
  progressGoalName: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.white, marginTop: 2 },
  progressGoalSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  progRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progBarLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: T.text },
  progBarValue: { fontSize: 12, fontFamily: "Inter_400Regular" },
  barTrack: { height: 7, backgroundColor: "#142236", borderRadius: 4, overflow: "hidden" },
  barFill: { height: 7, borderRadius: 4 },
  progPct: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim },
  logHikeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    backgroundColor: T.blue, borderRadius: 12, paddingVertical: 11, marginTop: 14,
  },
  logHikeBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  changeGoalBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    paddingVertical: 12, borderRadius: 12,
    backgroundColor: "#142236", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  changeGoalText: { fontSize: 13, fontFamily: "Inter_500Medium", color: T.textMuted },

  // Navigation
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  backText: { fontSize: 13, fontFamily: "Inter_500Medium", color: T.textMuted },

  // Error
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: T.orange + "12", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: T.orange + "30",
  },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, flex: 1 },

  // Modal
  modalSheet: {
    backgroundColor: "#0F1D30",
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    padding: 24, paddingBottom: 40, overflow: "hidden",
  },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 4 },
  modalSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18 },
  inputLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textMuted, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    backgroundColor: "#142236", borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    color: T.white, fontFamily: "Inter_400Regular", fontSize: 15,
    paddingHorizontal: 13, paddingVertical: 11,
  },

  // Upsell
  upsellSheet: {
    backgroundColor: "#0F1D30",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    padding: 24, paddingBottom: 44, overflow: "hidden",
  },
  upsellIconWrap: { width: 60, height: 60, borderRadius: 18, backgroundColor: T.orangeDim, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 14 },
  upsellTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: T.white, textAlign: "center", marginBottom: 8 },
  upsellSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 19, marginBottom: 16 },
  upsellBullets: { gap: 8, marginBottom: 20 },
  upsellBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: T.orange, borderRadius: 14, paddingVertical: 14,
  },
  upsellBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
});
