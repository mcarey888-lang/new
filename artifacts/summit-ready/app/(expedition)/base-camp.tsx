/**
 * Base Camp — Expedition home tab.
 * v2 redesign matching the reference mockup.
 */

import { useUser } from "@clerk/expo";
import {
  Mountain, Search, SlidersHorizontal, Bookmark, Heart,
  ChevronRight, TrendingUp, Camera, Plus, Trophy, Clock,
  MapPin, RefreshCw, AlertTriangle, Play,
} from "lucide-react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Modal, Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";
import { useScreenView } from "@/lib/analytics";
import { ChallengeDetailSheet, stripSuffix } from "@/components/ChallengeDetailSheet";
import { ExpeditionMountainProgress } from "@/components/ExpeditionMountainProgress";
import type { SigChallenge } from "@/components/ChallengeDetailSheet";
import type { Session, SummitGoal, NearbyHill } from "@/context/AppContext";

// Keep expo-av and the bundled completion MP4 out of the normal Expedition
// entry path. Native module/asset initialisation failures are not catchable by
// React error boundaries, so load the video component only after completion.
const CompletionCinematic = React.lazy(async () => {
  const module = await import("@/components/CompletionCinematic");
  return { default: module.CompletionCinematic };
});

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const PILL_OFFSET = 52;

const REGIONS = [
  { name: "Snowdonia",     slug: "Snowdon",      routes: 48 },
  { name: "Lake District", slug: "Helvellyn",    routes: 52 },
  { name: "Scotland",      slug: "Ben Nevis",    routes: 41 },
  { name: "Peak District", slug: "Kinder Scout", routes: 33 },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function greetingTime() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function diffColor(d: string | null) {
  if (d === "Easy")     return T.green;
  if (d === "Moderate") return T.blue;
  if (d === "Hard")     return T.orange;
  return "#FF4444";
}

function weeklyElevation(sessions: Session[]): number {
  const now    = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return sessions
    .filter(s => new Date(s.date) >= monday)
    .reduce((sum, s) => sum + (s.elevationGain ?? 0), 0);
}

function calcTrailTime(sessions: Session[]): { hours: number; minutes: number } {
  // Naismith's rule: 5 km/h + 10 min per 100 m ascent
  const totalMin = sessions.reduce((sum, s) => {
    const distKm = s.distance ?? 0;
    const elevM  = s.elevationGain ?? 0;
    return sum + (distKm / 5 * 60) + (elevM / 100 * 10);
  }, 0);
  return { hours: Math.floor(totalMin / 60), minutes: Math.round(totalMin % 60) };
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Convert a stored artwork path (/api/artwork/image/…) to a fully-qualified URL.
 * Falls back to null so callers can chain a mountain-image fallback.
 */
function artworkUrl(storedPath: string | null | undefined): string | null {
  if (!storedPath) return null;
  // API_BASE ends with "/api"; stored paths start with "/api/artwork/..."
  // Strip the trailing /api to avoid doubling the prefix.
  const base = API_BASE.replace(/\/api$/, "");
  return base + storedPath;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface FeaturedChallenge {
  challengeId: string;
  challengeName: string;
  targetMountainName: string;
  difficulty: string | null;
  recommendedDays: number;
  adventureScore: number | null;
  totalAscentM: number | null;
  regions: string | null;
  /** AI-generated artwork paths stored as /api/artwork/image/:id/:crop */
  heroImage?:      string | null;
  cardImage?:      string | null;
  thumbnailImage?: string | null;
  approved?:       boolean;
}

interface StageData {
  name: string;
  region: string;
  distance?: number;
  elevation?: number;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StageDot({ done, active, index }: { done: boolean; active: boolean; index: number }) {
  return (
    <View style={[
      s.stageDot,
      done    && s.stageDotDone,
      active  && s.stageDotActive,
      !done && !active && s.stageDotUpcoming,
    ]}>
      {done
        ? <Text style={{ fontSize: 10, color: "#fff", fontFamily: "Inter_700Bold" }}>✓</Text>
        : <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: active ? "#4FC3F7" : "rgba(255,255,255,0.3)" }}>
            {index + 1}
          </Text>
      }
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function BaseCampScreen() {
  useScreenView("expedition_base_camp");
  const insets = useSafeAreaInsets();
  const { summitGoal, sessions, patchGoal, setSummitGoal, unlockedAchievements,
          startExpedition, expeditions, activeExpeditionId, activeExpedition } = useApp();
  const { user } = useUser();

  const firstName = user?.firstName ?? "Adventurer";

  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [featured,  setFeatured]  = useState<FeaturedChallenge[]>([]);
  const [featLoading, setFeatLoading] = useState(false);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [routePickerOpen, setRoutePickerOpen] = useState(false);
  const [challengeHeroUri, setChallengeHeroUri] = useState<string | null>(null);
  // Keep artwork + fallback errors separate so artwork failure silently
  // falls back to the Wikimedia mountain photo rather than going blank.
  const [artworkError,  setArtworkError]  = useState(false);
  const [fallbackError, setFallbackError] = useState(false);
  const [showCompletion,         setShowCompletion]         = useState(false);

  // Dismisses the completion modal.
  const handleCompletionContinue = useCallback(() => {
    setShowCompletion(false);
  }, []);

  const hasCachedData = !!summitGoal?.simulationScore && !!summitGoal?.targetMountain;

  // ── Derived ──────────────────────────────────────────────────────────────────
  const myWeeklyElev = useMemo(() => weeklyElevation(sessions), [sessions]);
  const totalTrained = useMemo(() => sessions.reduce((s, sess) => s + (sess.elevationGain ?? 0), 0), [sessions]);
  const totalDistKm  = useMemo(() => sessions.reduce((s, sess) => s + (sess.distance ?? 0), 0), [sessions]);
  const trailTime    = useMemo(() => calcTrailTime(sessions), [sessions]);

  const leaderboard = useMemo(() => [
    { name: "Alex H.",  elev: 12450, isUser: false },
    { name: "You",      elev: myWeeklyElev, isUser: true },
    { name: "Sarah M.", elev: 8310,  isUser: false },
  ].sort((a, b) => b.elev - a.elev).map((e, i) => ({ ...e, rank: i + 1 })), [myWeeklyElev]);

  const target    = summitGoal?.targetMountain;
  const totalGoal = finiteNumber(target?.totalElevationGain, finiteNumber(summitGoal?.elevationGain));
  const score     = summitGoal?.simulationScore ?? 0;
  const pct       = totalGoal > 0 ? Math.min(100, Math.round(totalTrained / totalGoal * 100)) : 0;

  // Trigger only when this mounted screen observes an incomplete → complete
  // transition. Returning users whose stored expedition is already complete
  // must not open the native video merely by entering Expedition mode.
  const previousCompletionRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (totalGoal <= 0) {
      previousCompletionRef.current = null;
      return;
    }

    const isComplete = totalGoal > 0 && totalTrained >= totalGoal;
    const previous = previousCompletionRef.current;
    if (previous === false && isComplete) {
      setShowCompletion(true);
    }
    previousCompletionRef.current = isComplete;
  }, [totalGoal, totalTrained]);

  // Normalize API/AsyncStorage hills before rendering. Older stored goals can
  // omit fields even though NearbyHill marks them as required.
  const virtualHills = useMemo<NearbyHill[]>(() => {
    const raw = summitGoal?.virtualHills;
    if (!Array.isArray(raw)) return [];

    return raw.flatMap((value, index) => {
      if (!value || typeof value !== "object") return [];
      const hill = value as NearbyHill;
      const name = typeof hill.name === "string" && hill.name.trim()
        ? hill.name.trim()
        : `Stage ${index + 1}`;

      return [{
        ...hill,
        name,
        distance: finiteNumber(hill.distance),
        elevation: finiteNumber(hill.elevation),
        totalElevation: finiteNumber(hill.totalElevation, finiteNumber(hill.elevation)),
      }];
    });
  }, [summitGoal?.virtualHills]);

  // Stage timeline — use virtualHills as named hill checkpoints (the actual
  // places the user will train), falling back to expeditionPlan day titles.
  const stages: StageData[] = useMemo(() => {
    if (virtualHills.length > 0) {
      return virtualHills.map(h => ({
        name: h.name, region: "",
        distance: h.distance,
        elevation: h.totalElevation ?? h.elevation,
      }));
    }
    const days = (summitGoal as any)?.expeditionPlan?.days as any[] | null | undefined;
    if (days && days.length > 0) {
      return days.map((d: any, i: number) => ({
        name:      d.routes?.[0]?.name ?? d.title ?? `Stage ${i + 1}`,
        region:    "",
        distance:  undefined,
        elevation: undefined,
      }));
    }
    return [];
  }, [summitGoal, virtualHills]);

  // Use explicit completedRoutes[] from the library for accurate stage tracking.
  // Falls back to summitGoal.completedRoutes (migrated goals) then empty array.
  const storedCompletedRoutes = activeExpedition?.completedRoutes ?? summitGoal?.completedRoutes;
  const completedRoutes: string[] = Array.isArray(storedCompletedRoutes)
    ? storedCompletedRoutes.filter((name): name is string => typeof name === "string")
    : [];
  const completedStages = stages.filter(s => completedRoutes.includes(s.name)).length;
  // Route-completion percentage drives the progress ring and stage dots.
  const routePct = stages.length > 0
    ? Math.round(completedStages / stages.length * 100)
    : pct; // fall back to elevation-based pct when no stages loaded yet

  // Next incomplete route — first hill whose name is not yet in completedRoutes.
  const nextHill = virtualHills.find(h => !completedRoutes.includes(h.name));
  const nextEst  = nextHill
    ? `Est. ${Math.round((nextHill.distance ?? 0) / 5)}–${Math.round((nextHill.distance ?? 0) / 3)}h`
    : "";
  const journalUrls  = virtualHills.slice(0, 3).map(
    h => `${API_BASE}/mountain-image?name=${encodeURIComponent(h.name)}&width=200&height=200`,
  );
  // AI expedition concept (shown below title when present)
  const concept = (summitGoal as any)?.expeditionPlan?.concept as string | undefined;

  // ── Fetches ──────────────────────────────────────────────────────────────────
  async function fetchExpedition(force = false, mountainOverride?: string) {
    // Allow starting fresh from a challenge card even without an existing goal
    if (!summitGoal && !mountainOverride) return;
    if (!force && !mountainOverride && hasCachedData) return;
    setLoading(true); setError(null);
    try {
      const mountain = mountainOverride ?? summitGoal!.mountainName;
      const location = summitGoal?.location ?? "United Kingdom";
      const radius   = summitGoal?.maxRadius ?? 30;
      const res = await fetch(`${API_BASE}/virtual-expedition`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ targetMountain: mountain, userLocation: location, radius }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({})) as any;
        throw new Error(b.error ?? "Error");
      }
      const data = await res.json();

      if (mountainOverride) {
        // Starting a new expedition — add to Adventure Library and make it active.
        await startExpedition({
          challengeName:            mountain,
          targetMountainName:       data.targetProfile?.name ?? mountain,
          targetMountain:           data.targetProfile,
          virtualHills:             data.recommendedHills,
          simulationScore:          data.dnaMatchScore ?? data.simulationScore,
          simulationScoreBreakdown: data.scoreBreakdown,
          expeditionPlan:           data.expedition ?? null,
          location,
          maxRadius:                radius,
          fitnessLevel:             summitGoal?.fitnessLevel ?? "Average",
        });
      } else {
        // Refreshing an existing expedition in-place
        await patchGoal({
          targetMountain:  data.targetProfile,
          simulationScore: data.dnaMatchScore ?? data.simulationScore,
          virtualHills:    data.recommendedHills,
          expeditionPlan:  data.expedition ?? null,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchExpedition(); }, []); // eslint-disable-line
  useEffect(() => {
    setFeatLoading(true);
    fetch(`${API_BASE}/sx/featured`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setFeatured(d.challenges ?? []); })
      .catch(() => {})
      .finally(() => setFeatLoading(false));
  }, []);

  // Fetch approved artwork for the active expedition's challenge
  useEffect(() => {
    const cid = activeExpedition?.challengeId;
    if (!cid) return;
    fetch(`${API_BASE}/sx/challenges/${encodeURIComponent(cid)}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: any) => {
        if (!d) return;
        const ch   = d.challenge ?? d;           // endpoint wraps under { challenge: ... }
        const path = ch.heroImage ?? ch.cardImage ?? null;
        const url  = artworkUrl(path);
        if (url && ch.approved) setChallengeHeroUri(url);
      })
      .catch(() => {});
  }, [activeExpedition?.challengeId]); // eslint-disable-line

  const topInset = Platform.OS === "web" ? 20 : insets.top;
  // Snapshot before any narrowing so closures inside conditional branches
  // can still read the (possibly-null) goal without TypeScript complaining.
  const currentGoal: SummitGoal | null = summitGoal;

  // ────────────────────────────────────────────────────────────────────────────
  // EMPTY STATE
  // ────────────────────────────────────────────────────────────────────────────
  if (!summitGoal) {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

          {/* ── Hero ──────────────────────────────────────────────────────── */}
          <View style={s.emptyHero}>
            <ExpoImage
              source={require("@/assets/images/hero-base-camp.png")}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            <LinearGradient
              colors={["rgba(0,0,0,0.28)", "rgba(0,0,0,0.12)", "rgba(6,10,20,0.88)"]}
              locations={[0, 0.42, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={{ paddingTop: PILL_OFFSET + topInset + 18, paddingHorizontal: 20, paddingBottom: 22 }}>
              <Text style={s.emptyGreeting}>{greetingTime()}, {firstName}</Text>
              <Text style={s.emptyHeadline}>{"Ready for your\nnext adventure?"}</Text>
              <Text style={s.emptySubtitle}>Train local. Conquer anywhere.</Text>
            </View>
          </View>

          {/* ── Search bar ─────────────────────────────────────────────────── */}
          <TouchableOpacity
            style={s.searchBar}
            activeOpacity={0.8}
            onPress={() => router.push("/(expedition)/mountains" as any)}
          >
            <Search size={15} color="rgba(255,255,255,0.38)" />
            <Text style={s.searchPlaceholder}>Search mountains, routes or regions</Text>
            <SlidersHorizontal size={15} color="rgba(255,255,255,0.38)" />
          </TouchableOpacity>

          {/* ── Suggested Signature Expeditions ───────────────────────────── */}
          <View style={[s.sectionRow, { marginHorizontal: 16, marginTop: 22, marginBottom: 10 }]}>
            <Text style={s.sectionLabel}>SUGGESTED SIGNATURE EXPEDITIONS</Text>
            <TouchableOpacity onPress={() => router.push("/(expedition)/mountains" as any)}>
              <Text style={s.viewAllLink}>View all</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 4 }}
            style={{ marginBottom: 20 }}
          >
            {featLoading && (
              <ActivityIndicator color={T.purple} style={{ paddingHorizontal: 40, paddingVertical: 30 }} />
            )}
            {featured.slice(0, 6).map((ch, idx) => {
              const matchPct   = ch.adventureScore != null ? Math.min(99, Math.round(ch.adventureScore)) : null;
              const isPopular  = idx === 0;
              return (
                <TouchableOpacity
                  key={ch.challengeId}
                  style={s.expCard}
                  activeOpacity={0.85}
                  onPress={() => setSelectedChallengeId(ch.challengeId)}
                >
                  {/* Image */}
                  <View style={s.expCardImg}>
                    <ExpoImage
                      source={{
                        uri: (ch.approved && artworkUrl(ch.cardImage ?? ch.heroImage))
                          || `${API_BASE}/mountain-image?name=${encodeURIComponent(ch.targetMountainName)}&width=400&height=280`,
                      }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                    <LinearGradient
                      colors={["transparent", "rgba(10,6,20,0.55)"]}
                      locations={[0.45, 1]}
                      style={StyleSheet.absoluteFill}
                    />
                    {isPopular && (
                      <View style={s.popularBadge}>
                        <Text style={s.popularText}>⬡ Popular</Text>
                      </View>
                    )}
                    <View style={s.bookmarkBtn}>
                      <Bookmark size={11} color="rgba(255,255,255,0.75)" />
                    </View>
                    {matchPct != null && (
                      <View style={[s.matchCircle, { borderColor: matchPct >= 80 ? T.green : T.orange }]}>
                        <Text style={[s.matchCircleText, { color: matchPct >= 80 ? T.green : T.orange }]}>
                          {matchPct}%
                        </Text>
                      </View>
                    )}
                  </View>
                  {/* Info */}
                  <View style={s.expCardBody}>
                    <Text style={s.expCardTitle} numberOfLines={2}>{stripSuffix(ch.challengeName)}</Text>
                    <Text style={s.expCardMeta}>
                      {ch.recommendedDays} {ch.recommendedDays === 1 ? "Day" : "Days"}
                      {ch.difficulty ? ` • ${ch.difficulty}` : ""}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── Leaderboard + Community Highlight ─────────────────────────── */}
          <View style={{ flexDirection: "row", gap: 10, marginHorizontal: 16, marginBottom: 16 }}>
            {/* Leaderboard */}
            <View style={[s.card, { flex: 1 }]}>
              <View style={[s.sectionRow, { marginBottom: 10 }]}>
                <Text style={s.sectionLabel}>THIS WEEK'S{"\n"}LEADERBOARD</Text>
                <TouchableOpacity><Text style={s.viewAllLink}>View all</Text></TouchableOpacity>
              </View>
              {leaderboard.map(e => (
                <View key={e.name} style={[s.lbRow, e.isUser && s.lbRowYou]}>
                  <Text style={[s.lbRank, e.isUser && { color: T.green }]}>{e.rank}</Text>
                  <View style={[s.lbAvatar, e.isUser && { backgroundColor: "rgba(62,207,117,0.18)" }]}>
                    <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: e.isUser ? T.green : T.blue }}>
                      {e.name.slice(0, 1)}
                    </Text>
                  </View>
                  <Text style={[s.lbName, e.isUser && { color: T.white, fontFamily: "Inter_700Bold" }]}>{e.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Text style={[s.lbElev, e.isUser && { color: T.green }]}>
                      {e.elev > 0 ? `${e.elev.toLocaleString()}m` : "–"}
                    </Text>
                    <Mountain size={9} color={e.isUser ? T.green : T.textDim} />
                  </View>
                </View>
              ))}
            </View>

            {/* Community Highlight */}
            <View style={[s.card, { width: 142 }]}>
              <Text style={[s.sectionLabel, { marginBottom: 10 }]}>COMMUNITY{"\n"}HIGHLIGHT</Text>
              <View style={s.communityImg}>
                <ExpoImage
                  source={{ uri: `${API_BASE}/mountain-image?name=Helvellyn&width=300&height=220` }}
                  style={[StyleSheet.absoluteFill, { borderRadius: 10 }]}
                  contentFit="cover"
                />
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.84)"]}
                  locations={[0.28, 1]}
                  style={[StyleSheet.absoluteFill, { borderRadius: 10 }]}
                />
                <View style={{ position: "absolute", bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff", lineHeight: 13 }}>
                    Striding Edge Sunrise
                  </Text>
                  <Text style={{ fontSize: 8, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.52)", marginTop: 2 }}>
                    Helvellyn, Lake District
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 }}>
                    <Heart size={8} color={T.orange} fill={T.orange} />
                    <Text style={{ fontSize: 9, fontFamily: "Inter_600SemiBold", color: T.orange }}>128</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* ── Popular Regions ────────────────────────────────────────────── */}
          <View style={[s.sectionRow, { marginHorizontal: 16, marginBottom: 10 }]}>
            <Text style={s.sectionLabel}>POPULAR REGIONS</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
            style={{ marginBottom: 20 }}
          >
            {REGIONS.map(r => (
              <TouchableOpacity
                key={r.name}
                style={s.regionCard}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: "/(expedition)/mountains" as any, params: { region: r.name } })}
              >
                <ExpoImage
                  source={{ uri: `${API_BASE}/mountain-image?name=${encodeURIComponent(r.slug)}&width=240&height=160` }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.72)"]}
                  locations={[0.3, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={{ position: "absolute", bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" }}>{r.name}</Text>
                  <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.58)", marginTop: 1 }}>
                    {r.routes} routes
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

        </ScrollView>

        <ChallengeDetailSheet
          challengeId={selectedChallengeId}
          onClose={() => setSelectedChallengeId(null)}
          onStart={(ch: SigChallenge) => {
            setSelectedChallengeId(null);
            // Build the goal IMMEDIATELY from challenge data so the active state
            // renders instantly with no API round-trip.
            const hills: NearbyHill[] = ch.stages.map(s => ({
              name:           s.routeName,
              elevation:      s.ascentM ?? 0,
              distance:       s.distanceKm ?? 0,
              repeats:        1,
              totalElevation: s.ascentM ?? 0,
              surface:        "mixed",
              grade:          s.difficulty ?? "Hard",
              emoji:          "⛰️",
              estimatedTime:  s.estimatedHours ? `${Math.floor(s.estimatedHours)}h` : undefined,
            }));
            // Add to Adventure Library and make active — preserves all existing progress.
            void startExpedition({
              challengeId:        ch.challengeId,
              challengeName:      ch.challengeName,
              // targetMountainName drives the hero image API — use the real peak name.
              targetMountainName: ch.targetMountainName,
              targetMountain: {
                name:               ch.targetMountainName,
                country:            ch.regions?.split(/[,/]/)[0]?.trim() ?? "United Kingdom",
                summitElevation:    0,
                totalElevationGain: ch.totalAscentM ?? 0,
                totalDistance:      ch.totalDistanceKm ?? 0,
                estimatedDays:      (Math.min(2, Math.max(1, ch.recommendedDays)) as 1 | 2),
                difficulty:         (ch.difficulty as SummitGoal["difficulty"]) ?? "Hard",
                altitudeExposure:   "None" as const,
              },
              virtualHills:    hills,
              simulationScore: ch.dnaMatchScore ?? undefined,
              location:        ch.regions ?? currentGoal?.location ?? "United Kingdom",
              maxRadius:       currentGoal?.maxRadius ?? 30,
              fitnessLevel:    currentGoal?.fitnessLevel ?? "Average",
            });
          }}
        />
      </LinearGradient>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ACTIVE EXPEDITION STATE
  // ────────────────────────────────────────────────────────────────────────────
  // Use the real mountain name for the photo lookup; challengeName ("Matterhorn Ridge")
  // won't match — the API needs the actual peak ("Matterhorn").
  const heroMountain = target?.name ?? summitGoal.mountainName;
  // Prefer approved AI artwork; silently fall back to Wikimedia photo on any
  // artwork error, rather than going blank.
  const heroUri = (challengeHeroUri && !artworkError)
    ? challengeHeroUri
    : fallbackError
      ? null
      : `${API_BASE}/mountain-image?name=${encodeURIComponent(heroMountain)}&width=800&height=600`;

  // Use mountainName (the challenge/expedition name the user chose) — not the
  // AI-generated expeditionPlan.title which changes on every generation.
  const expTitle = summitGoal.mountainName;
  const expSub   = summitGoal.location
    ? `Simulated in ${summitGoal.location}`
    : target
      ? `${target.country ?? ""}  ·  ${(target.summitElevation ?? 0).toLocaleString()}m ASL`
      : "";

  const ACHIEVEMENT_COLORS = [T.orange, T.green, T.blue, T.purple];

  return (
    <>
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120 }}
      >

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <View style={s.activeHero}>
          {heroUri ? (
            <ExpoImage
              source={{ uri: heroUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              onError={() => {
                // If the artwork URL failed, fall back to the mountain photo.
                // If even the fallback failed, go blank (gradient).
                if (challengeHeroUri && !artworkError) {
                  setArtworkError(true);
                } else {
                  setFallbackError(true);
                }
              }}
            />
          ) : (
            <LinearGradient colors={["#0E2240", "#071428"]} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.52)", "transparent"]}
            style={[StyleSheet.absoluteFill, { height: "42%" as any }]}
          />
          <LinearGradient
            colors={["transparent", "rgba(6,10,20,0.88)", T.bg]}
            style={[StyleSheet.absoluteFill, { top: "44%" as any }]}
          />

          <View style={[s.activeHeroContent, { paddingTop: PILL_OFFSET + topInset + 12 }]}>
            {/* Active badge + refresh */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={s.activeBadge}>
                <View style={s.activeBadgeDot} />
                <Text style={s.activeBadgeText}>ACTIVE EXPEDITION</Text>
              </View>
              <TouchableOpacity
                onPress={() => fetchExpedition(true)}
                style={s.refreshBtn}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator size="small" color={T.blue} />
                  : <RefreshCw size={14} color={T.blue} />}
              </TouchableOpacity>
            </View>

            {/* Title + progress row */}
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginTop: 10 }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text
                  style={[
                    s.activeTitle,
                    (expTitle?.length ?? 0) > 22 && { fontSize: 26, lineHeight: 31 },
                    (expTitle?.length ?? 0) > 32 && { fontSize: 22, lineHeight: 27 },
                  ]}
                >
                  {expTitle}
                </Text>
                {!!expSub && <Text style={s.activeSub}>{expSub}</Text>}
                {!!concept && (
                  <Text style={s.expConcept} numberOfLines={3}>{concept}</Text>
                )}
              </View>
              {/* Overall progress — elevation-based */}
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.40)", letterSpacing: 0.5, marginBottom: 2 }}>
                  OVERALL PROGRESS
                </Text>
                <Text style={{ fontSize: 42, fontFamily: "Inter_700Bold", color: pct > 0 ? T.green : "rgba(255,255,255,0.85)", lineHeight: 46 }}>
                  {pct}%
                </Text>
                <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.40)", marginTop: 1 }}>
                  {totalTrained.toLocaleString()}m of {totalGoal.toLocaleString()}m
                </Text>
              </View>
            </View>

            {/* Choose Route — opens picker so user can select any incomplete route */}
            <TouchableOpacity
              style={s.quickStartBtn}
              activeOpacity={0.85}
              onPress={() => {
                if (completedRoutes.length > 0 && !nextHill) {
                  router.push("/(expedition)/expedition-complete" as any);
                } else {
                  setRoutePickerOpen(true);
                }
              }}
            >
              <LinearGradient
                colors={completedRoutes.length > 0 && !nextHill
                  ? ["#7C3AED", "#5B21B6"]
                  : [T.green, "#2AB860"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.quickStartGrad}
              >
                <Play size={14} color="#fff" fill="#fff" />
                <Text style={s.quickStartText}>
                  {completedRoutes.length > 0 && !nextHill
                    ? "View Expedition Completion 🎉"
                    : "Choose Route"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Mountain Progress — centrepiece of Expedition Mode ───────────── */}
        <Animated.View entering={FadeInDown.delay(60).duration(400)} style={{ marginTop: 14 }}>
          {/* mountainImageRef placed on the inner mountain image view via ExpeditionMountainProgress */}
          <ExpeditionMountainProgress
            targetElevation={totalGoal}
            currentElevation={totalTrained}
            stages={virtualHills}
            completedRoutes={completedRoutes}
            days={target?.estimatedDays ?? 1}
            highestPoint={target?.summitElevation ?? 0}
            allDone={completedRoutes.length > 0 && !nextHill}
            onStagePress={(hillName) => {
              const hill = virtualHills.find(h => h.name === hillName);
              if (!hill) {
                router.push({ pathname: "/hike-tracking" as any, params: { hillName } });
                return;
              }
              router.push({
                pathname: "/hill-detail",
                params: {
                  name:           hill.name,
                  location:       hill.name,
                  lat:            hill.lat?.toString()       ?? "",
                  lng:            hill.lng?.toString()       ?? "",
                  elevation:      (hill.totalElevation ?? hill.elevation ?? 0).toString(),
                  distance:       (hill.distance ?? 0).toString(),
                  grade:          hill.grade   ?? "",
                  surface:        hill.surface ?? "",
                  emoji:          hill.emoji   ?? "⛰️",
                  expeditionMode: "true",
                },
              });
            }}
            onCtaPress={() => {
              if (completedRoutes.length > 0 && !nextHill) {
                router.push("/(expedition)/expedition-complete" as any);
              } else {
                setRoutePickerOpen(true);
              }
            }}
          />
        </Animated.View>

        {/* ── Next Up + Prepare for Success ─────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(140).duration(400)} style={{ flexDirection: "row", gap: 10, marginHorizontal: 14, marginTop: 10 }}>
          {/* Next Up */}
          <View style={[s.card, { flex: 1 }]}>
            <Text style={[s.sectionLabel, { marginBottom: 10 }]}>NEXT UP</Text>
            {nextHill ? (
              <>
                <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                  <View style={s.nextHillThumb}>
                    <ExpoImage
                      source={{ uri: `${API_BASE}/mountain-image?name=${encodeURIComponent(nextHill.name)}&width=160&height=120` }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.nextHillName} numberOfLines={2}>{nextHill.name}</Text>
                    <Text style={s.nextHillMeta}>{nextHill.distance ?? 0} km · {(nextHill.totalElevation ?? nextHill.elevation ?? 0).toLocaleString()} m gain</Text>
                    <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 2 }}>{nextEst}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={s.nextHillBtn}
                  onPress={() => router.push("/(expedition)/route" as any)}
                >
                  <Text style={s.nextHillBtnText}>View Route</Text>
                  <ChevronRight size={12} color={T.blue} />
                </TouchableOpacity>
              </>
            ) : (
              <Text style={{ fontSize: 12, color: T.textDim, fontFamily: "Inter_400Regular" }}>Loading…</Text>
            )}
          </View>

          {/* Prepare for Success */}
          <View style={[s.card, { flex: 1 }]}>
            <Text style={[s.sectionLabel, { marginBottom: 10 }]}>PREPARE FOR SUCCESS</Text>
            <Text style={s.coachText} numberOfLines={5}>
              {pct < 25
                ? "Build your base. Focus on consistent hill sessions with good elevation gain."
                : pct < 50
                  ? "Good work! Keep your leg strength and hydration high for your next stage."
                  : pct < 80
                    ? "You're making great progress. Add longer days to sharpen your endurance."
                    : "You're nearly there! Taper well and trust your training before the final push."}
            </Text>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10 }}
              onPress={() => router.push("/(tabs)/plan" as any)}
            >
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.blue }}>View Training Plan</Text>
              <ChevronRight size={12} color={T.blue} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Expedition Journal + Recent Achievements ───────────────────────── */}
        <Animated.View entering={FadeInDown.delay(180).duration(400)} style={{ flexDirection: "row", gap: 10, marginHorizontal: 14, marginTop: 10 }}>
          {/* Journal */}
          <View style={[s.card, { flex: 1 }]}>
            <View style={[s.sectionRow, { marginBottom: 10 }]}>
              <Text style={s.sectionLabel}>EXPEDITION{"\n"}JOURNAL</Text>
              <TouchableOpacity><Text style={s.viewAllLink}>View all</Text></TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", gap: 5 }}>
              {journalUrls.map((uri, i) => (
                <View key={i} style={s.journalThumb}>
                  <ExpoImage source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                </View>
              ))}
              <TouchableOpacity
                style={[s.journalThumb, s.journalAdd]}
                onPress={() => router.push("/(expedition)/track" as any)}
              >
                <Plus size={16} color="rgba(255,255,255,0.5)" />
                <Text style={{ fontSize: 7, color: "rgba(255,255,255,0.4)", fontFamily: "Inter_600SemiBold", marginTop: 2 }}>
                  Add Photo
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Achievements */}
          <View style={[s.card, { flex: 1 }]}>
            <View style={[s.sectionRow, { marginBottom: 10 }]}>
              <Text style={s.sectionLabel}>RECENT{"\n"}ACHIEVEMENTS</Text>
              <TouchableOpacity><Text style={s.viewAllLink}>View all</Text></TouchableOpacity>
            </View>
            {unlockedAchievements.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 8 }}>
                <Trophy size={22} color="rgba(255,255,255,0.15)" />
                <Text style={{ fontSize: 9, color: T.textDim, fontFamily: "Inter_400Regular", marginTop: 4, textAlign: "center" }}>
                  Complete sessions to earn badges
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {unlockedAchievements.slice(0, 4).map((id, i) => (
                  <View key={id} style={[s.achieveBadge, { backgroundColor: ACHIEVEMENT_COLORS[i % 4] + "22", borderColor: ACHIEVEMENT_COLORS[i % 4] + "44" }]}>
                    <Trophy size={16} color={ACHIEVEMENT_COLORS[i % 4]} />
                  </View>
                ))}
              </View>
            )}
          </View>
        </Animated.View>

        {/* Error */}
        {error && (
          <View style={s.errorBanner}>
            <AlertTriangle size={13} color={T.orange} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

      </ScrollView>

      {/* ── Route picker modal ────────────────────────────────────────────────── */}
      <Modal
        visible={routePickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRoutePickerOpen(false)}
      >
        <TouchableOpacity
          style={s.pickerBackdrop}
          activeOpacity={1}
          onPress={() => setRoutePickerOpen(false)}
        />
        <View style={s.pickerSheet}>
          <View style={s.pickerHandle} />
          <Text style={s.pickerTitle}>Choose Your Route</Text>
          <Text style={s.pickerSub}>All routes are available — climb in any order you like.</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 12 }}>
            {stages.map((stage, idx) => {
              const done = completedRoutes.includes(stage.name);
              return (
                <TouchableOpacity
                  key={stage.name + idx}
                  activeOpacity={done ? 1 : 0.75}
                  onPress={done ? undefined : () => {
                    setRoutePickerOpen(false);
                    router.push({
                      pathname: "/hike-tracking" as any,
                      params: { hillName: stage.name },
                    });
                  }}
                  style={[s.pickerRow, done && s.pickerRowDone]}
                >
                  {/* Stage number / tick */}
                  <View style={[s.pickerBadge, done && s.pickerBadgeDone]}>
                    <Text style={[s.pickerBadgeText, done && { color: "#fff" }]}>
                      {done ? "✓" : idx + 1}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[s.pickerRouteName, done && s.pickerRouteNameDone]}>
                      {stage.name}
                    </Text>
                    <Text style={s.pickerRouteSub}>
                      {stage.elevation != null ? `${Math.round(stage.elevation)}m gain · ` : ""}
                      {stage.distance?.toFixed(1) ?? "?"}km
                    </Text>
                  </View>
                  {done ? (
                    <Text style={s.pickerDoneLabel}>DONE</Text>
                  ) : (
                    <View style={s.pickerStartBtn}>
                      <Play size={10} color="#fff" fill="#fff" />
                      <Text style={s.pickerStartText}>Start</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </Modal>

    </LinearGradient>

    {/* Do not evaluate expo-av or the MP4 until genuine completion. */}
    {showCompletion && (
      <Suspense fallback={<View style={StyleSheet.absoluteFill} />}>
        <CompletionCinematic
          visible
          expeditionName={expTitle ?? "Your Expedition"}
          totalElevationM={totalTrained}
          onContinue={handleCompletionContinue}
        />
      </Suspense>
    )}
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({

  // ── Empty state ──
  emptyHero: { overflow: "hidden" },
  emptyGreeting: { fontSize: 15, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginBottom: 6 },
  emptyHeadline: { fontSize: 30, fontFamily: "Inter_700Bold", color: "#fff", lineHeight: 36, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)" },

  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12,
  },
  searchPlaceholder: {
    flex: 1, fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
  },

  // Expedition cards (horizontal)
  expCard: {
    width: 155, backgroundColor: "#0F1628",
    borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  expCardImg: { height: 116, overflow: "hidden" },
  expCardBody: { padding: 10 },
  expCardTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff", lineHeight: 17, marginBottom: 4 },
  expCardMeta:  { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)" },

  popularBadge: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: "rgba(62,207,117,0.22)",
    borderWidth: 1, borderColor: "rgba(62,207,117,0.45)",
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  popularText: { fontSize: 8, fontFamily: "Inter_700Bold", color: T.green, letterSpacing: 0.5 },
  bookmarkBtn: {
    position: "absolute", top: 8, right: 8,
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center", justifyContent: "center",
  },
  matchCircle: {
    position: "absolute", bottom: 8, right: 8,
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.5, backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  matchCircleText: { fontSize: 9, fontFamily: "Inter_700Bold" },

  // Leaderboard
  lbRow: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
  },
  lbRowYou: { backgroundColor: "rgba(62,207,117,0.05)", borderRadius: 8, paddingHorizontal: 4, marginHorizontal: -4 },
  lbRank:   { fontSize: 12, fontFamily: "Inter_700Bold", color: T.textMuted, width: 14, textAlign: "center" },
  lbAvatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center",
  },
  lbName: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: T.text },
  lbElev: { fontSize: 11, fontFamily: "Inter_700Bold", color: T.textMuted },

  // Community
  communityImg: { height: 130, borderRadius: 10, overflow: "hidden" },

  // Regions
  regionCard: {
    width: 115, height: 110, borderRadius: 13, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },

  // ── Active state ──
  activeHero: { overflow: "hidden" },
  activeHeroContent: { paddingHorizontal: 16, paddingBottom: 20 },
  activeBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start",
    borderWidth: 1, borderColor: "rgba(62,207,117,0.45)",
    borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5,
    backgroundColor: "rgba(62,207,117,0.08)",
  },
  activeBadgeDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: T.green },
  activeBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.green, letterSpacing: 0.8 },
  activeTitle: { fontSize: 32, fontFamily: "Inter_700Bold", color: "#fff", lineHeight: 37 },
  activeSub:   { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.52)", marginTop: 4, lineHeight: 18 },

  refreshBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },

  expConcept: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.54)", lineHeight: 18,
    marginTop: 8,
  },
  quickStartBtn: {
    marginTop: 14, borderRadius: 14, overflow: "hidden",
    alignSelf: "stretch",
  },
  quickStartGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 13, paddingHorizontal: 20, borderRadius: 14,
  },
  quickStartText: {
    fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff",
  },

  // Stage timeline
  stageDot: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  stageDotDone:    { backgroundColor: T.green, borderColor: T.green },
  stageDotActive:  { backgroundColor: "#0a1e38", borderColor: "#4FC3F7", borderWidth: 2 },
  stageDotUpcoming:{ backgroundColor: "transparent", borderColor: "rgba(255,255,255,0.2)", borderWidth: 2 },
  stageLine: { flex: 1, height: 2 },
  stageLabel:       { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: 6, lineHeight: 12 },
  stageLabelDone:   { color: "rgba(255,255,255,0.42)" },
  stageLabelActive: { color: "#fff" },
  stageStatus:       { fontSize: 8, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.32)", textAlign: "center", marginTop: 3 },
  stageStatusDone:   { color: T.green },
  stageStatusActive: { color: "#4FC3F7" },

  // Stats row
  statCol: { flex: 1, alignItems: "center", paddingVertical: 6 },
  statColBorder: { borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.07)" },
  statLabel: { fontSize: 7, fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 0.8, textAlign: "center", marginBottom: 4 },
  statValue: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.white, textAlign: "center" },
  statSub:   { fontSize: 9, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 2 },

  // Next up
  nextHillThumb: {
    width: 52, height: 52, borderRadius: 10, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  nextHillName: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.white, lineHeight: 16 },
  nextHillMeta: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 3, lineHeight: 14 },
  nextHillBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginTop: 10, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
  },
  nextHillBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.blue },

  // Coaching
  coachText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18 },

  // Journal
  journalThumb: {
    flex: 1, aspectRatio: 1, borderRadius: 8, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  journalAdd: {
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderStyle: "dashed",
  },

  // Achievements
  achieveBadge: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },

  // Shared card / section
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 18, padding: 14, overflow: "hidden",
  },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 1.2 },
  viewAllLink: { fontSize: 11, fontFamily: "Inter_500Medium", color: T.blue },

  // Error
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 14, marginTop: 10,
    backgroundColor: T.orange + "12", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: T.orange + "30",
  },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, flex: 1 },

  // Route picker modal
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  pickerSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0F1E2E",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 20, paddingTop: 12,
    maxHeight: "80%",
  },
  pickerHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "center", marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 18, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 4,
  },
  pickerSub: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18,
  },
  pickerRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  pickerRowDone: { opacity: 0.45 },
  pickerBadge: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.18)",
  },
  pickerBadgeDone: { backgroundColor: T.green, borderColor: T.green },
  pickerBadgeText: {
    fontSize: 12, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.6)",
  },
  pickerRouteName: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.white,
  },
  pickerRouteNameDone: { color: "rgba(255,255,255,0.45)" },
  pickerRouteSub: {
    fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted,
  },
  pickerDoneLabel: {
    fontSize: 9, fontFamily: "Inter_700Bold", color: T.green, letterSpacing: 0.8,
  },
  pickerStartBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: T.blue, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  pickerStartText: {
    fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff",
  },
});
