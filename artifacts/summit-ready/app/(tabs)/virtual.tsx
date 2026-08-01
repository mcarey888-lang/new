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
  SlidersHorizontal, LayoutGrid, LayoutList, Globe, Clock,
} from "lucide-react-native";
import { VirtualMountainCard } from "@/components/VirtualMountainCard";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import { ChallengeDetailSheet, stripSuffix } from "@/components/ChallengeDetailSheet";
import { VIRTUAL_BUNDLES, FREE_BUNDLE_IDS, type VirtualBundle } from "@/data/virtualBundles";
import type {
  NearbyHill, SimulationScoreBreakdown, SummitGoal, TargetMountain,
} from "@/context/AppContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

// ── Region data ────────────────────────────────────────────────────────────────

const FILTER_REGIONS = [
  { name: "All Regions" },
  { name: "Lake District" },
  { name: "Snowdonia" },
  { name: "Scotland" },
  { name: "Peak District" },
  { name: "Yorkshire Dales" },
  { name: "Dartmoor" },
];

const BROWSE_REGIONS = [
  { name: "Lake District", slug: "Helvellyn",    expeditions: 24 },
  { name: "Snowdonia",     slug: "Snowdon",       expeditions: 18 },
  { name: "Scotland",      slug: "Ben Nevis",     expeditions: 22 },
  { name: "Peak District", slug: "Kinder Scout",  expeditions: 16 },
];

function bundleMatchesRegion(bundle: VirtualBundle, region: string): boolean {
  if (region === "All Regions") return true;
  if (region === "Scotland") return bundle.regionCountry === "Scotland";
  return bundle.regionDisplay === region;
}

function challengeMatchesRegion(regions: string | null, region: string): boolean {
  if (region === "All Regions") return true;
  if (!regions) return false;
  const r = regions.toLowerCase();
  if (region === "Scotland")      return r.includes("scotland") || r.includes("highland") || r.includes("cairngorm");
  if (region === "Snowdonia")     return r.includes("snowdonia") || r.includes("eryri") || r.includes("snowdon");
  if (region === "Lake District") return r.includes("lake district") || r.includes("cumbria");
  if (region === "Peak District") return r.includes("peak district") || r.includes("derbyshire");
  return r.includes(region.toLowerCase());
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface ExpeditionResult {
  targetProfile:    TargetMountain & { notes?: string | null };
  recommendedHills: NearbyHill[];
  simulationScore:  number;
  adventureScore?:  number;
  dnaMatchScore?:   number;
  scoreBreakdown:   SimulationScoreBreakdown;
  expedition?: {
    title: string; concept: string;
    days: Array<{ label: string; title: string; focus: string; routes: Array<{ name: string; why: string }> }>;
    alternatives: Record<string, string[]>;
    adventureScore: number; dnaMatchScore: number; dnaMatchNotes: string;
  } | null;
}

interface SigStage {
  stageOrder: number;
  routeName: string;
  region: string | null;
  distanceKm: number | null;
  ascentM: number | null;
  estimatedHours: number | null;
  difficulty: string | null;
  dnaContribution: string | null;
  whySelected: string | null;
}

interface SigChallenge {
  challengeId: string;
  challengeName: string;
  targetMountainName: string;
  targetRoute: string | null;
  recommendedDays: number;
  dnaMatchScore: number | null;
  adventureScore: number | null;
  totalAscentM: number | null;
  totalDistanceKm: number | null;
  estimatedHours: number | null;
  difficulty: string | null;
  routeDnaFocus: string | null;
  summary: string | null;
  regions: string | null;
  featured: boolean;
  stages: SigStage[];
  limitations: string[];
}

/** Normalise a mountain name to its slug (matches the API's toMountainSlug). */
function toMountainSlug(name: string): string {
  return name.toLowerCase()
    .replace(/[àáâãäå]/g, "a").replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i").replace(/[òóôõöø]/g, "o")
    .replace(/[ùúûü]/g, "u").replace(/[ñ]/g, "n")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
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

  // ── Customisation state ──────────────────────────────────────────────────────
  /** Radius in km for the hill search — shown as chips in both browse + results. */
  const [searchRadius, setSearchRadius] = useState<number>(30);
  /** Override the mountain's natural day count (null = use mountain's default). */
  const [customDays, setCustomDays] = useState<1 | 2 | null>(null);
  /** Whether the customise panel is expanded in the results view. */
  const [customOpen, setCustomOpen] = useState(false);
  /** Editable location shown inside the results customise panel. */
  const [customLocation, setCustomLocation] = useState("");

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

  // custom search expand/collapse
  const [customSearchOpen, setCustomSearchOpen] = useState(false);

  // region filter pill — can be pre-set by navigation param
  const [selectedRegion, setSelectedRegion] = useState("All Regions");

  // signature challenge (loaded alongside expedition results)
  const [sigChallenge, setSigChallenge] = useState<SigChallenge | null>(null);
  const [sigLoading, setSigLoading] = useState(false);
  const [sigExpanded, setSigExpanded] = useState(false);

  // featured list — shown in the browse section
  const [featuredList, setFeaturedList] = useState<Array<{
    challengeId: string; challengeName: string; targetMountainName: string;
    difficulty: string | null; recommendedDays: number;
    adventureScore: number | null; totalAscentM: number | null;
    regions: string | null; featured: boolean;
  }>>([]);
  const [selectedFeaturedId, setSelectedFeaturedId] = useState<string | null>(null);
  const browseScrollRef = useRef<any>(null);

  const { patchGoal } = useApp();

  // ── Auto-start from URL param (e.g. navigated here from base-camp) ────────────
  const { startMountain, region: regionParam } = useLocalSearchParams<{ startMountain?: string; region?: string }>();
  useEffect(() => {
    if (startMountain) {
      setSearchMountain(startMountain);
      void fetchExpedition(startMountain, regionParam ?? summitGoal?.location ?? "United Kingdom", searchRadius);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMountain]);

  // Pre-select region pill when navigated from Base Camp
  useEffect(() => {
    if (regionParam) setSelectedRegion(regionParam);
  }, [regionParam]);

  // Fetch featured signature challenges on mount
  React.useEffect(() => {
    fetch(`${API_BASE}/sx/featured`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setFeaturedList(d.challenges ?? []); })
      .catch(() => {});
  }, []);

  const topPad = Platform.OS === "web" ? 56 : insets.top + 16;
  const botPad = Platform.OS === "web" ? 120 : insets.bottom + 100;

  const isVirtualGoalActive = summitGoal?.mode === "virtual";

  // ── Fetch expedition ─────────────────────────────────────────────────────────
  async function fetchExpedition(
    mountain:     string,
    region:       string,
    radius        = searchRadius,
    daysOverride?: 1 | 2,
  ) {
    setLoading(true);
    setFetchError(null);
    setResults(null);
    try {
      const res = await fetch(`${API_BASE}/virtual-expedition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetMountain: mountain,
          userLocation:   region,
          radius,
          ...(daysOverride ? { daysOverride } : {}),
        }),
      });
      const body = await res.json() as ExpeditionResult & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Server error ${res.status}`);
      setResults(body);
      void fetchSigChallenge(mountain); // non-blocking — enhances results view
      setView("results");
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Couldn't load expedition data.");
    } finally {
      setLoading(false);
    }
  }

  // ── Fetch signature challenge ────────────────────────────────────────────────
  async function fetchSigChallenge(mountainName: string) {
    setSigChallenge(null);
    setSigLoading(true);
    setSigExpanded(false);
    try {
      const slug = toMountainSlug(mountainName);
      const res = await fetch(`${API_BASE}/sx/challenges/for-mountain/${slug}`);
      if (!res.ok) return;
      const body = await res.json() as { challenges: SigChallenge[] };
      if (body.challenges && body.challenges.length > 0) {
        const sorted = [...body.challenges].sort((a, b) => {
          if (a.featured && !b.featured) return -1;
          if (b.featured && !a.featured) return 1;
          return (b.adventureScore ?? 0) - (a.adventureScore ?? 0);
        });
        setSigChallenge(sorted[0] ?? null);
      }
    } catch {
      // fail silently — signature challenge is an enhancement, not required
    } finally {
      setSigLoading(false);
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
    setCustomLocation(bundle.region);
    void fetchExpedition(bundle.goalMountain, bundle.region, searchRadius, customDays ?? undefined);
  }

  // ── Custom search ────────────────────────────────────────────────────────────
  function handleSearch() {
    if (searchMountain.trim().length < 2 || searchRegion.trim().length < 2) return;
    setActiveBundle(null);
    setActiveSearch({ mountain: searchMountain.trim(), region: searchRegion.trim() });
    setCustomLocation(searchRegion.trim());
    void fetchExpedition(searchMountain.trim(), searchRegion.trim(), searchRadius, customDays ?? undefined);
  }

  // ── Regenerate with custom params ────────────────────────────────────────────
  function handleRegenerate() {
    const mountain = activeBundle?.goalMountain ?? activeSearch?.mountain;
    const region   = customLocation.trim() || activeBundle?.region || activeSearch?.region;
    if (!mountain || !region) return;
    setCustomOpen(false);
    void fetchExpedition(mountain, region, searchRadius, customDays ?? undefined);
  }

  // ── Set as goal ──────────────────────────────────────────────────────────────
  async function handleSetGoal() {
    if (!results) return;
    const mountainName = activeBundle?.goalMountain ?? activeSearch?.mountain ?? results.targetProfile.name;
    const location = customLocation.trim() || (activeBundle?.region ?? activeSearch?.region ?? "");

    const newGoal: SummitGoal = {
      mountainName,
      summitDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      distance: results.targetProfile.totalDistance,
      elevationGain: results.targetProfile.totalElevationGain,
      highestAltitude: results.targetProfile.summitElevation,
      difficulty: results.targetProfile.difficulty,
      fitnessLevel: summitGoal?.fitnessLevel ?? "Average",
      location,
      maxRadius: searchRadius,
      equipment: summitGoal?.equipment ?? ["none"],
      trainingDaysPerWeek: summitGoal?.trainingDaysPerWeek ?? 3,
      hillDaysPerWeek: summitGoal?.hillDaysPerWeek ?? 2,
      mode: "virtual",
      targetMountain: results.targetProfile,
      virtualHills: results.recommendedHills,
      simulationScore: results.dnaMatchScore ?? results.simulationScore,
      simulationScoreBreakdown: results.scoreBreakdown,
      expeditionPlan: results.expedition ?? null,
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

          {/* Region + customise bar */}
          <Animated.View entering={FadeInDown.delay(40).duration(350)}>
            <TouchableOpacity
              style={[s.card, { flexDirection: "row", alignItems: "center", gap: 10 }]}
              activeOpacity={0.8}
              onPress={() => setCustomOpen(v => !v)}
            >
              <MapPin size={14} color={T.green} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: T.text }}>
                  Equivalent hills in{" "}
                  <Text style={{ color: T.green, fontFamily: "Inter_700Bold" }}>
                    {customLocation || activeBundle?.regionDisplay || activeSearch?.region}
                  </Text>
                </Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 2 }}>
                  {searchRadius}km radius · {tp.estimatedDays === 1 ? "1 day" : "2 days"}{customDays ? " (custom)" : ""}
                </Text>
              </View>
              <View style={s.customisePill}>
                <SlidersHorizontal size={11} color={T.blue} />
                <Text style={s.customisePillText}>Edit</Text>
                {customOpen ? <ChevronUp size={11} color={T.blue} /> : <ChevronDown size={11} color={T.blue} />}
              </View>
            </TouchableOpacity>

            {/* Customise panel */}
            {customOpen && (
              <Animated.View entering={FadeInDown.duration(220)} style={s.customisePanel}>
                {/* Location */}
                <Text style={[s.inputLabel, { marginBottom: 6 }]}>Hiking location</Text>
                <View style={s.searchRow}>
                  <MapPin size={13} color={T.green} />
                  <TextInput
                    style={[s.searchInput, { flex: 1 }]}
                    value={customLocation}
                    onChangeText={setCustomLocation}
                    placeholder="e.g. Lake District"
                    placeholderTextColor={T.textDim}
                    returnKeyType="done"
                  />
                </View>

                {/* Radius */}
                <Text style={[s.inputLabel, { marginTop: 14, marginBottom: 6 }]}>Search radius</Text>
                <View style={s.chipRow}>
                  {[15, 30, 50, 80].map(r => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setSearchRadius(r)}
                      style={[s.chip, searchRadius === r && s.chipActive]}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.chipText, searchRadius === r && s.chipTextActive]}>{r}km</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Days */}
                <Text style={[s.inputLabel, { marginTop: 14, marginBottom: 6 }]}>Duration</Text>
                <View style={s.chipRow}>
                  {([
                    { label: "Mountain default", value: null },
                    { label: "1 day",            value: 1 as const },
                    { label: "2 days",            value: 2 as const },
                  ] as Array<{ label: string; value: 1 | 2 | null }>).map(opt => {
                    const active = customDays === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.label}
                        onPress={() => setCustomDays(opt.value)}
                        style={[s.chip, active && { backgroundColor: T.purple + "22", borderColor: T.purple + "50" }]}
                        activeOpacity={0.75}
                      >
                        <Text style={[s.chipText, active && { color: T.purple, fontFamily: "Inter_700Bold" }]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Regenerate */}
                <TouchableOpacity
                  onPress={handleRegenerate}
                  style={s.regenerateBtn}
                  activeOpacity={0.85}
                >
                  <RefreshCw size={14} color="#fff" />
                  <Text style={s.regenerateBtnText}>Regenerate expedition</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </Animated.View>

          {/* ── Signature Challenge card ────────────────────────────────────── */}
          {(sigLoading || sigChallenge) && (
            <Animated.View entering={FadeInDown.delay(50).duration(380)}>
              <View style={s.sigCard}>
                <LinearGradient colors={["#1a0e2e", "transparent"]} style={StyleSheet.absoluteFill} />

                {/* Header row */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <View style={s.sigBadge}>
                    <Star size={10} color={T.purple} fill={T.purple} />
                    <Text style={s.sigBadgeText}>SIGNATURE ADVENTURE</Text>
                  </View>
                  {sigChallenge && (
                    <View style={[s.sigBadge, { backgroundColor: diffColor(sigChallenge.difficulty ?? "") + "22", borderColor: diffColor(sigChallenge.difficulty ?? "") + "44" }]}>
                      <Text style={[s.sigBadgeText, { color: diffColor(sigChallenge.difficulty ?? "") }]}>{sigChallenge.difficulty}</Text>
                    </View>
                  )}
                </View>

                {sigLoading && !sigChallenge ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 }}>
                    <ActivityIndicator size="small" color={T.purple} />
                    <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: T.textDim }}>Finding curated adventure…</Text>
                  </View>
                ) : sigChallenge ? (
                  <>
                    <Text style={s.sigTitle}>{stripSuffix(sigChallenge.challengeName)}</Text>
                    {sigChallenge.targetRoute ? (
                      <Text style={s.sigRoute}>{sigChallenge.targetRoute}</Text>
                    ) : null}

                    {/* Scores row */}
                    <View style={{ flexDirection: "row", gap: 12, marginTop: 8, marginBottom: 10 }}>
                      {sigChallenge.dnaMatchScore != null && (
                        <View style={{ alignItems: "center" }}>
                          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: scoreColor(sigChallenge.dnaMatchScore) }}>{sigChallenge.dnaMatchScore}%</Text>
                          <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim }}>DNA Match</Text>
                        </View>
                      )}
                      {sigChallenge.adventureScore != null && (
                        <View style={{ alignItems: "center" }}>
                          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: T.orange }}>{sigChallenge.adventureScore}%</Text>
                          <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim }}>Adventure</Text>
                        </View>
                      )}
                      {sigChallenge.totalAscentM != null && (
                        <View style={{ alignItems: "center" }}>
                          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: T.green }}>{sigChallenge.totalAscentM.toLocaleString()}m</Text>
                          <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim }}>Total Ascent</Text>
                        </View>
                      )}
                      {sigChallenge.estimatedHours != null && (
                        <View style={{ alignItems: "center" }}>
                          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: T.blue }}>{sigChallenge.estimatedHours}h</Text>
                          <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim }}>Est. Time</Text>
                        </View>
                      )}
                    </View>

                    {/* Summary */}
                    {sigChallenge.summary ? (
                      <Text style={s.sigSummary} numberOfLines={sigExpanded ? undefined : 3}>{sigChallenge.summary}</Text>
                    ) : null}

                    {/* Stage cards */}
                    {sigChallenge.stages.map((stage) => (
                      <View key={stage.stageOrder} style={s.sigStage}>
                        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                          <View style={s.sigDayBubble}>
                            <Text style={s.sigDayBubbleText}>
                              {stage.stageOrder === 1 ? "Sat" : "Sun"}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.sigStageName}>{stage.routeName}</Text>
                            {stage.region ? <Text style={s.sigStageMeta}>{stage.region}</Text> : null}
                            <View style={{ flexDirection: "row", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                              {stage.distanceKm != null && <Text style={s.sigStatPill}>{stage.distanceKm}km</Text>}
                              {stage.ascentM != null && <Text style={s.sigStatPill}>▲ {stage.ascentM}m</Text>}
                              {stage.estimatedHours != null && <Text style={s.sigStatPill}>~{stage.estimatedHours}h</Text>}
                            </View>
                            {sigExpanded && stage.whySelected ? (
                              <Text style={[s.sigStageMeta, { marginTop: 4, color: T.textDim, fontStyle: "italic" }]}>{stage.whySelected}</Text>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    ))}

                    {/* Expand / collapse */}
                    <TouchableOpacity
                      onPress={() => setSigExpanded(v => !v)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8, alignSelf: "center" }}
                      activeOpacity={0.7}
                    >
                      {sigExpanded ? <ChevronUp size={13} color={T.textDim} /> : <ChevronDown size={13} color={T.textDim} />}
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim }}>
                        {sigExpanded ? "Show less" : "Why these routes?"}
                      </Text>
                    </TouchableOpacity>

                    {/* Limitations */}
                    {sigExpanded && sigChallenge.limitations.length > 0 && (
                      <View style={s.sigLimitations}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 }}>
                          <Info size={11} color={T.orange} />
                          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.orange }}>LIMITATIONS</Text>
                        </View>
                        {sigChallenge.limitations.map((lim, i) => (
                          <Text key={i} style={s.sigLimitationText}>• {lim}</Text>
                        ))}
                      </View>
                    )}
                  </>
                ) : null}
              </View>
            </Animated.View>
          )}

          {/* ── Nearby equivalent hills (AI-found) ──────────────────────────── */}
          {hills.length > 0 && (
            <View style={{ gap: 0 }}>
              <Text style={[s.sectionTitle, { paddingHorizontal: 4, marginBottom: 6, fontSize: 11, color: T.textMuted }]}>
                NEARBY TRAINING HILLS
              </Text>
            </View>
          )}

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

  const filteredBundles = VIRTUAL_BUNDLES.filter(b => bundleMatchesRegion(b, selectedRegion));
  const filteredFeatured = featuredList.filter(ch => challengeMatchesRegion(ch.regions, selectedRegion));

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView ref={browseScrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad }}>

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <Animated.View entering={FadeIn.duration(400)} style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <ExpoImage source={require("@/assets/images/logo.gif")} style={{ width: 140, height: 56, alignSelf: "center" }} contentFit="contain" />
          {/* Title row */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginTop: 4 }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={s.heroTitle}>Mountains</Text>
              <Text style={s.heroSub}>Explore signature expeditions or create{"\n"}your own adventure.</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
              <TouchableOpacity style={s.headerIconBtn} activeOpacity={0.75}>
                <Search size={15} color={T.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={s.headerIconBtn} activeOpacity={0.75}>
                <SlidersHorizontal size={15} color={T.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* ── Region filter pills ─────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 2 }}
          style={{ marginBottom: 16 }}
        >
          {FILTER_REGIONS.map(fr => {
            const active = selectedRegion === fr.name;
            return (
              <TouchableOpacity
                key={fr.name}
                onPress={() => setSelectedRegion(fr.name)}
                activeOpacity={0.8}
                style={[s.regionPill, active && s.regionPillActive]}
              >
                {fr.name === "All Regions"
                  ? <Globe size={11} color={active ? "#fff" : T.textMuted} />
                  : <Mountain size={11} color={active ? "#fff" : T.textMuted} />
                }
                <Text style={[s.regionPillText, active && s.regionPillTextActive]}>{fr.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

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
              <View style={{ alignItems: "center", gap: 2 }}>
                {summitGoal.simulationScore != null ? (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: scoreColor(summitGoal.simulationScore) }}>
                      {summitGoal.simulationScore}
                    </Text>
                    <Text style={{ fontSize: 9, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.45)", letterSpacing: 0.5 }}>
                      MATCH
                    </Text>
                  </View>
                ) : (
                  <ChevronRight size={18} color={T.blue} />
                )}
                {summitGoal.simulationScore != null && <ChevronRight size={12} color={T.blue} />}
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

        {/* ── Create Custom Route ──────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(40).duration(400)} style={{ paddingHorizontal: 16, marginBottom: 22 }}>
          <TouchableOpacity
            style={s.createRouteCard}
            activeOpacity={0.85}
            onPress={() => setCustomSearchOpen(v => !v)}
          >
            <LinearGradient colors={["rgba(29,78,148,0.35)", "rgba(29,78,148,0.08)"]} style={StyleSheet.absoluteFill} />
            <View style={s.createRouteIconWrap}>
              <Plus size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.createRouteTitle}>Create Custom Route</Text>
              <Text style={s.createRouteSub}>Choose your hills, set your goals{"\n"}and build your own expedition.</Text>
            </View>
            <ChevronRight size={16} color={T.blue} />
          </TouchableOpacity>

          {/* Expandable custom search */}
          {customSearchOpen && (
            <View style={[s.searchCard, { marginTop: 10 }]}>
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
              <View style={{ marginTop: 12 }}>
                <Text style={[s.inputLabel, { marginBottom: 6 }]}>Search radius</Text>
                <View style={s.chipRow}>
                  {[15, 30, 50, 80].map(r => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setSearchRadius(r)}
                      style={[s.chip, searchRadius === r && s.chipActive]}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.chipText, searchRadius === r && s.chipTextActive]}>{r}km</Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
          )}
        </Animated.View>

        {/* ── Browse by Region ────────────────────────────────────────────── */}
        {selectedRegion === "All Regions" && (
          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={{ marginBottom: 26 }}>
            <View style={{ paddingHorizontal: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={s.sectionHeading}>Browse by Region</Text>
              <TouchableOpacity activeOpacity={0.75}>
                <Text style={s.viewAllText}>View all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
            >
              {BROWSE_REGIONS.map(r => (
                <TouchableOpacity
                  key={r.name}
                  style={s.browseRegionCard}
                  activeOpacity={0.85}
                  onPress={() => setSelectedRegion(r.name)}
                >
                  <ExpoImage
                    source={{ uri: `${API_BASE}/mountain-image?name=${encodeURIComponent(r.slug)}&width=240&height=160` }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.82)"]}
                    locations={[0.3, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={{ position: "absolute", bottom: 10, left: 10, right: 10 }}>
                    <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" }}>{r.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 3 }}>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)" }}>
                        {r.expeditions} expeditions
                      </Text>
                      <ChevronRight size={10} color="rgba(255,255,255,0.4)" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* ── Popular Expeditions ──────────────────────────────────────────── */}
        {filteredFeatured.length > 0 && (
          <Animated.View entering={FadeInDown.delay(120).duration(400)} style={{ marginBottom: 26 }}>
            <View style={{ paddingHorizontal: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={s.sectionHeading}>Popular Expeditions</Text>
              <TouchableOpacity activeOpacity={0.75}>
                <Text style={s.viewAllText}>View all</Text>
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              {filteredFeatured.map(ch => (
                <TouchableOpacity
                  key={ch.challengeId}
                  style={s.popularCard}
                  activeOpacity={0.82}
                  onPress={() => setSelectedFeaturedId(ch.challengeId)}
                >
                  <LinearGradient colors={["rgba(255,255,255,0.025)", "transparent"]} style={StyleSheet.absoluteFill} />
                  {/* Thumbnail */}
                  <View style={s.popularThumb}>
                    <ExpoImage
                      source={{ uri: `${API_BASE}/mountain-image?name=${encodeURIComponent(ch.targetMountainName)}&width=160&height=160` }}
                      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 10 }}
                      contentFit="cover"
                    />
                    {ch.featured && (
                      <View style={s.featuredBadge}>
                        <Text style={s.featuredBadgeText}>FEATURED</Text>
                      </View>
                    )}
                  </View>
                  {/* Content */}
                  <View style={{ flex: 1 }}>
                    <Text style={s.popularTitle} numberOfLines={1}>{ch.challengeName}</Text>
                    <Text style={s.popularSub} numberOfLines={1}>
                      {ch.targetMountainName}{ch.regions ? ` · ${ch.regions.split(",")[0].trim()}` : ""}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
                      {ch.recommendedDays > 0 && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                          <Clock size={10} color={T.textMuted} />
                          <Text style={s.popularMeta}>{ch.recommendedDays} Day{ch.recommendedDays !== 1 ? "s" : ""}</Text>
                        </View>
                      )}
                      {ch.difficulty && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                          <Mountain size={10} color={T.textMuted} />
                          <Text style={s.popularMeta}>{ch.difficulty}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {/* Score ring */}
                  {ch.adventureScore != null && (
                    <View style={s.scoreBadgeWrap}>
                      <ProgressRing
                        score={ch.adventureScore}
                        size={46}
                        strokeWidth={3}
                        color={scoreColor(ch.adventureScore)}
                        hideScore
                      />
                      <Text style={[s.scoreBadgeText, { color: scoreColor(ch.adventureScore) }]}>{ch.adventureScore}%</Text>
                    </View>
                  )}
                  <ChevronRight size={14} color="rgba(255,255,255,0.18)" />
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── All Expeditions (bundles) ────────────────────────────────────── */}
        {filteredBundles.length > 0 && (
          <Animated.View entering={FadeInDown.delay(160).duration(400)} style={{ marginBottom: 10 }}>
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <Text style={s.sectionHeading}>
                {selectedRegion === "All Regions" ? "All Expeditions" : `${selectedRegion} Expeditions`}
              </Text>
            </View>
            <View style={{ paddingHorizontal: 16 }}>
              {filteredBundles.map((bundle, idx) => {
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
          </Animated.View>
        )}

        {/* ── Legend bar ───────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}>
          <View style={s.legendBar}>
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
            <View style={{ width: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.07)" }} />
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

      <ChallengeDetailSheet
        challengeId={selectedFeaturedId}
        onClose={() => setSelectedFeaturedId(null)}
        onStart={(challenge) => {
          setSelectedFeaturedId(null);
          // Commit directly to the challenge's pre-built stages —
          // no need to search for new hills since they are already defined.
          const region = challenge.regions?.split(/[,/]/)[0]?.trim()
            ?? summitGoal?.location
            ?? "United Kingdom";
          const hills: NearbyHill[] = challenge.stages.map(s => ({
            name:           s.routeName,
            elevation:      s.ascentM ?? 0,
            distance:       s.distanceKm ?? 0,
            repeats:        1,
            totalElevation: s.ascentM ?? 0,
            surface:        "mixed",
            grade:          s.difficulty ?? "Hard",
            emoji:          "⛰️",
            estimatedTime:  s.estimatedHours
              ? `${Math.floor(s.estimatedHours)}h`
              : undefined,
          }));
          const newGoal: SummitGoal = {
            mountainName:        challenge.challengeName,
            summitDate:          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
                                   .toISOString().slice(0, 10),
            distance:            challenge.totalDistanceKm ?? 0,
            elevationGain:       challenge.totalAscentM ?? 0,
            highestAltitude:     0,
            difficulty:          (challenge.difficulty as SummitGoal["difficulty"]) ?? "Hard",
            fitnessLevel:        summitGoal?.fitnessLevel ?? "Average",
            location:            region,
            maxRadius:           searchRadius,
            equipment:           summitGoal?.equipment ?? ["none"],
            trainingDaysPerWeek: summitGoal?.trainingDaysPerWeek ?? 3,
            hillDaysPerWeek:     summitGoal?.hillDaysPerWeek ?? 2,
            mode:                "virtual",
            virtualHills:        hills,
            simulationScore:     challenge.dnaMatchScore ?? undefined,
            targetMountain: {
              name:               challenge.targetMountainName,
              country:            region,
              summitElevation:    0,
              totalElevationGain: challenge.totalAscentM ?? 0,
              totalDistance:      challenge.totalDistanceKm ?? 0,
              estimatedDays:      Math.min(2, Math.max(1, challenge.recommendedDays)) as 1 | 2,
              difficulty:         (challenge.difficulty as SummitGoal["difficulty"]) ?? "Hard",
              altitudeExposure:   "None" as const,
            },
          };
          void setSummitGoal(newGoal).then(() => setView("progress"));
        }}
      />
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

  // Signature browse cards (horizontal scroll on Mountains browse)
  sigBrowseCard: {
    width: 190, height: 178, backgroundColor: "#120D20", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(139,92,246,0.22)",
    overflow: "hidden",
  },
  sigBrowseBadge: {
    backgroundColor: "rgba(139,92,246,0.28)", borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: "rgba(139,92,246,0.45)",
  },
  sigBrowseBadgeText: { fontSize: 7, fontFamily: "Inter_700Bold", color: "#C4AAEE", letterSpacing: 1 },
  sigBrowseTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff", lineHeight: 17 },
  sigBrowseMtn: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim, flex: 1 },

  // Signature challenge card
  sigCard: {
    backgroundColor: "#120D20", borderRadius: 16,
    borderWidth: 1, borderColor: "rgba(139,92,246,0.25)",
    padding: 14, gap: 0, overflow: "hidden",
  },
  sigBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(139,92,246,0.15)", borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: "rgba(139,92,246,0.3)",
    alignSelf: "flex-start",
  },
  sigBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: T.purple, letterSpacing: 1, textTransform: "uppercase" },
  sigTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 2 },
  sigRoute: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.purple, marginBottom: 4 },
  sigSummary: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18, marginBottom: 10 },
  sigStage: {
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10,
    padding: 10, marginBottom: 6, marginTop: 4,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  sigDayBubble: {
    width: 36, height: 36, borderRadius: 9,
    backgroundColor: T.purple + "22",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: T.purple + "44",
  },
  sigDayBubbleText: { fontSize: 11, fontFamily: "Inter_700Bold", color: T.purple },
  sigStageName: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.white },
  sigStageMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  sigStatPill: { fontSize: 11, fontFamily: "Inter_500Medium", color: T.textDim, backgroundColor: "#142236", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  sigLimitations: {
    backgroundColor: T.orange + "0F", borderRadius: 10, padding: 10, marginTop: 10,
    borderWidth: 1, borderColor: T.orange + "30",
  },
  sigLimitationText: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, lineHeight: 16, marginTop: 2 },

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

  // Customise panel
  customisePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: T.blueDim, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: T.blue + "40",
  },
  customisePillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.blue },
  customisePanel: {
    backgroundColor: "#0A1628", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    padding: 14, marginTop: 6, gap: 0,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 10,
    backgroundColor: "#142236",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  chipActive: { backgroundColor: T.blue + "22", borderColor: T.blue + "50" },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: T.textMuted },
  chipTextActive: { color: T.blue, fontFamily: "Inter_700Bold" },
  regenerateBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: T.blue, borderRadius: 12, paddingVertical: 11, marginTop: 14,
  },
  regenerateBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },

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

  // Region filter pills
  regionPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  regionPillActive: {
    backgroundColor: T.blue,
    borderColor: T.blue,
  },
  regionPillText: {
    fontSize: 12, fontFamily: "Inter_500Medium", color: T.textMuted,
  },
  regionPillTextActive: {
    color: "#fff", fontFamily: "Inter_700Bold",
  },

  // Section headings (larger than sectionTitle)
  sectionHeading: {
    fontSize: 17, fontFamily: "Inter_700Bold", color: T.white,
  },
  viewAllText: {
    fontSize: 13, fontFamily: "Inter_500Medium", color: T.blue,
  },

  // Create Custom Route card
  createRouteCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#0D1B2E", borderRadius: 16,
    borderWidth: 1, borderColor: "rgba(29,78,148,0.4)",
    padding: 14, overflow: "hidden",
  },
  createRouteIconWrap: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: T.blue,
    alignItems: "center", justifyContent: "center",
  },
  createRouteTitle: {
    fontSize: 15, fontFamily: "Inter_700Bold", color: T.white,
  },
  createRouteSub: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted,
    lineHeight: 17, marginTop: 2,
  },

  // Browse by Region cards
  browseRegionCard: {
    width: 160, height: 130, borderRadius: 14,
    overflow: "hidden", backgroundColor: "#0F1D30",
  },

  // Popular Expedition list cards
  popularCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#0D1B2E", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    padding: 10, overflow: "hidden",
  },
  popularThumb: {
    width: 68, height: 68, borderRadius: 10,
    backgroundColor: "#142236", overflow: "hidden",
  },
  popularTitle: {
    fontSize: 14, fontFamily: "Inter_700Bold", color: T.white,
  },
  popularSub: {
    fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2,
  },
  popularMeta: {
    fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim,
  },
  featuredBadge: {
    position: "absolute", bottom: 4, left: 4,
    backgroundColor: T.purple + "CC", borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  featuredBadgeText: {
    fontSize: 7, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.5,
  },
  scoreBadgeWrap: {
    width: 46, height: 46, alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  scoreBadgeText: {
    position: "absolute",
    fontSize: 10, fontFamily: "Inter_700Bold",
  },
});
