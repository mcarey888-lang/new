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
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { SigChallenge } from "@/components/ChallengeDetailSheet";
import type { Session, SummitGoal, NearbyHill } from "@/context/AppContext";
import { englishPlaceName } from "@/utils/placeNames";
import { isRouteCompleted } from "@/utils/stateReliability";
import { mergeActivityKinds } from "@/utils/activityReliability";
import {
  VerifiedMountainChooser,
  type VerifiedMountainChoice,
} from "@/components/VerifiedMountainChooser";

const ExpeditionMountainProgress = React.lazy(async () => {
  const module = await import("@/components/ExpeditionMountainProgress");
  return { default: module.ExpeditionMountainProgress };
});

const CinematicPrototype = React.lazy(async () => {
  const module = await import("@/components/CinematicPrototype");
  return { default: module.CinematicPrototype };
});

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

function metricMatchPercent(actual: number, target: number): number | null {
  if (actual <= 0 || target <= 0) return null;
  return Math.round((Math.min(actual, target) / Math.max(actual, target)) * 100);
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

function mountainArtworkSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^(mount|jebel|jbel|djebel)-/, "")
    .replace(/^-+|-+$/g, "");
}

type CommunityStats = {
  totalRoutes: number;
  totalElev: number;
  topRouteName: string;
  topRouteElev: number;
  mostRepeatedName: string | null;
  mostRepeatedCount: number | null;
};

function CommunityActivityCard({
  stats,
  loading,
}: {
  stats: CommunityStats | null;
  loading: boolean;
}) {
  return (
    <View style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 16 }}>
      <View style={[s.sectionRow, { marginBottom: 10 }]}>
        <Text style={s.sectionLabel}>COMMUNITY ACTIVITY</Text>
        <TouchableOpacity onPress={() => router.push("/community-routes" as any)}>
          <Text style={s.viewAllLink}>View all routes</Text>
        </TouchableOpacity>
      </View>

      <View style={[s.card, { padding: 16 }]}>
        {loading ? (
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 20 }}>
            <ActivityIndicator size="small" color={T.green} />
          </View>
        ) : !stats ? (
          <View style={{ alignItems: "center", paddingVertical: 20 }}>
            <Mountain size={24} color={T.textDim} />
            <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: T.textMuted, marginTop: 8 }}>
              No community routes shared yet
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, gap: 12 }}>
              <View>
                <Text style={{ fontSize: 24, fontFamily: "Inter_700Bold", color: "#fff" }}>
                  {stats.totalRoutes}
                </Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: T.textMuted }}>
                  Routes shared by the community
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: T.green }}>
                  {stats.totalElev.toLocaleString()}m
                </Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: T.textMuted }}>
                  Combined route gain
                </Text>
              </View>
            </View>
            <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
            <View style={{ flex: 1.2, gap: 12 }}>
              <View>
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.blue, marginBottom: 2 }}>
                  TOP ELEVATION ROUTE
                </Text>
                <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" }} numberOfLines={1}>
                  {stats.topRouteName}
                </Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim }}>
                  ▲ {stats.topRouteElev.toLocaleString()}m gain
                </Text>
              </View>
              {stats.mostRepeatedName && (
                <View>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.orange, marginBottom: 2 }}>
                    MOST REPEATED
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" }} numberOfLines={1}>
                    {stats.mostRepeatedName}
                  </Text>
                  {stats.mostRepeatedCount && (
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim }}>
                      {stats.mostRepeatedCount.toLocaleString()} contributions
                    </Text>
                  )}
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
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
  routeIdentityKey?: string;
  summitIdentityKey?: string;
  objectiveType?: "manual_summit";
  region: string;
  distance?: number;
  elevation?: number;
}

interface VerifiedTargetRouteChoice {
  identityKey: string;
  routeName: string;
  startPoint: string | null;
  distanceKm: number | null;
  totalAscentMetres: number | null;
  typicalDurationHours: number | null;
}

interface PendingBaseExpeditionRequest {
  force: boolean;
  mountainOverride?: string;
  targetRouteIdentityKey?: string;
  targetCountry?: string;
  targetRegion?: string;
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
  const { summitGoal: publicGoal, sessions, patchGoal, setSummitGoal, unlockedAchievements,
          startExpedition, expeditions, activeExpeditionId, activeExpedition, exploreHikes } = useApp();
  const summitGoal: SummitGoal | null = activeExpedition
    ? {
        ...(publicGoal ?? {
          summitDate: "", distance: 0, elevationGain: 0, highestAltitude: 0,
          difficulty: "Hard", fitnessLevel: activeExpedition.fitnessLevel,
          location: activeExpedition.location, maxRadius: activeExpedition.maxRadius,
          equipment: ["none"], trainingDaysPerWeek: 3, hillDaysPerWeek: 2,
        }),
        mountainName: activeExpedition.challengeName,
        targetMountain: activeExpedition.targetMountain,
        virtualHills: activeExpedition.virtualHills,
        expeditionPlan: activeExpedition.expeditionPlan,
        simulationScore: activeExpedition.simulationScore,
        simulationScoreBreakdown: activeExpedition.simulationScoreBreakdown,
        virtualHikeProgress: activeExpedition.virtualHikeProgress,
        completedRoutes: activeExpedition.completedRoutes,
      }
    : null;
  const { user } = useUser();

  const firstName = user?.firstName ?? "Adventurer";

  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [featured,  setFeatured]  = useState<FeaturedChallenge[]>([]);
  const [featLoading, setFeatLoading] = useState(false);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [routePickerOpen, setRoutePickerOpen] = useState(false);
  const [targetRoutePickerOpen, setTargetRoutePickerOpen] = useState(false);
  const [targetRouteChoices, setTargetRouteChoices] = useState<VerifiedTargetRouteChoice[]>([]);
  const [pendingTargetRouteRequest, setPendingTargetRouteRequest] = useState<PendingBaseExpeditionRequest | null>(null);
  const [mountainChoices, setMountainChoices] = useState<VerifiedMountainChoice[]>([]);
  const [mountainChooserOpen, setMountainChooserOpen] = useState<boolean>(false);
  const [pendingMountainRequest, setPendingMountainRequest] = useState<PendingBaseExpeditionRequest | null>(null);
  const [challengeHeroUri, setChallengeHeroUri] = useState<string | null>(null);
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);
  const [communityLoading, setCommunityLoading] = useState(true);

  // Keep artwork + fallback errors separate so artwork failure silently
  // falls back to the Wikimedia mountain photo rather than going blank.
  const [artworkError,  setArtworkError]  = useState(false);
  const [fallbackError, setFallbackError] = useState(false);
  const [cinematicActive,        setCinematicActive]        = useState(false);
  const [cinematicReplayTrigger, setCinematicReplayTrigger] = useState(0);
  const [showCompletion,         setShowCompletion]         = useState(false);
  const scrollRef        = useRef<import("react-native").ScrollView>(null);
  const mountainRef      = useRef<import("react-native").View>(null);

  // Dismisses the completion modal and zooms back out to the expedition screen
  const handleCompletionContinue = useCallback(() => {
    setShowCompletion(false);
    setCinematicActive(false);
  }, []);

  // Called by CinematicPrototype once zoom reaches the handoff position
  const handleCinematicReady = useCallback(() => {
    // Show the modal immediately — it fades in over 400 ms so the frozen
    // handoff frame still reads as one continuous shot.
    // Reset the zoom at the same instant: the Modal covers the screen fully
    // so the 800 ms zoom-out plays invisibly underneath. When the user
    // presses Continue the app is already back at 100 % scale.
    setShowCompletion(true);
    setCinematicActive(false);
  }, []);

  const hasCachedData = !!summitGoal?.simulationScore && !!summitGoal?.targetMountain;

  // ── Derived ──────────────────────────────────────────────────────────────────
  const myWeeklyElev = useMemo(() => weeklyElevation(sessions), [sessions]);

  // Use explicit activeExpedition progress for true expedition mode progress.
  const activeProgress = activeExpedition?.virtualHikeProgress ?? summitGoal?.virtualHikeProgress;
  const linkedExpeditionActivities = useMemo(() => {
    if (!activeExpeditionId) return [];
    return mergeActivityKinds(
      sessions.filter(item => item.expeditionId === activeExpeditionId),
      exploreHikes.filter(item => item.expeditionId === activeExpeditionId),
    );
  }, [activeExpeditionId, exploreHikes, sessions]);
  const linkedExpeditionElevation = linkedExpeditionActivities.reduce(
    (sum, activity) => sum + Math.max(0, activity.elevationGain ?? 0),
    0,
  );
  const linkedExpeditionDistance = linkedExpeditionActivities.reduce(
    (sum, activity) => sum + Math.max(0, activity.distance ?? 0),
    0,
  );
  // Linked activities are the live source of truth. Keep the persisted aggregate
  // as a compatibility floor for older GPS hikes that predate activity linking.
  const totalTrained = Math.max(activeProgress?.elevationGained ?? 0, linkedExpeditionElevation);
  const totalDistanceCovered = Math.max(
    activeProgress?.distanceCovered ?? 0,
    linkedExpeditionDistance,
  );

  const trailTime    = useMemo(() => calcTrailTime(sessions), [sessions]);

  const target    = summitGoal?.targetMountain;
  const totalGoal = target?.totalElevationGain ?? summitGoal?.elevationGain ?? 0;
  const targetDist = target?.totalDistance ?? summitGoal?.distance ?? 0;
  const score     = summitGoal?.simulationScore ?? 0;
  const pct       = totalGoal > 0 ? Math.min(100, Math.round(totalTrained / totalGoal * 100)) : 0;

  // ── DNA Match Breakdown ──────────────────────────────────────────────────────
  const suggestedHills = summitGoal?.virtualHills ?? [];
  const suggestedGain = suggestedHills.reduce(
    (acc, h) => acc + (h.totalElevation ?? h.elevation * Math.max(1, h.repeats ?? 1)),
    0,
  );
  const hasCompleteRouteDistance = suggestedHills.length > 0
    && suggestedHills.every(h => (h.routeDistance ?? 0) > 0);
  const suggestedDist = suggestedHills.reduce(
    (acc, h) => acc + ((h.routeDistance ?? 0) * Math.max(1, h.repeats ?? 1)),
    0,
  );

  const elevMatch = metricMatchPercent(suggestedGain, totalGoal);
  const distMatch = hasCompleteRouteDistance
    ? metricMatchPercent(suggestedDist, targetDist)
    : null;

  const targetSteepness = targetDist > 0 ? (totalGoal / (targetDist * 1000)) : 0; // m / m
  const suggestedSteepness = hasCompleteRouteDistance && suggestedDist > 0
    ? suggestedGain / (suggestedDist * 1000)
    : 0;
  const steepnessMatch = hasCompleteRouteDistance
    ? metricMatchPercent(suggestedSteepness, targetSteepness)
    : null;

  const steepnessRatio = suggestedSteepness > 0 ? `1:${Math.round(1 / suggestedSteepness)}` : "—";
  const targetSteepnessRatio = targetSteepness > 0 ? `1:${Math.round(1 / targetSteepness)}` : "—";

  // ── Auto-trigger cinematic at 90 % progress ──────────────────────────────
  const cinematicTriggeredRef = useRef(false);
  useEffect(() => {
    if (pct >= 75 && totalGoal > 0 && !cinematicTriggeredRef.current) {
      cinematicTriggeredRef.current = true;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      setTimeout(() => {
        setCinematicReplayTrigger(t => t + 1);
        setCinematicActive(true);
      }, 200);
    }
  }, [pct, totalGoal]);

  // Stage timeline — use virtualHills as named hill checkpoints (the actual
  // places the user will train), falling back to expeditionPlan day titles.
  const stages: StageData[] = useMemo(() => {
    const hills = summitGoal?.virtualHills;
    if (hills && hills.length > 0) {
      return hills.map(h => ({
        name: h.name, routeIdentityKey: h.routeIdentityKey, summitIdentityKey: h.summitIdentityKey,
        objectiveType: h.objectiveType, region: "",
        distance: h.distance, elevation: h.elevation,
      }));
    }
    const days = (summitGoal as any)?.expeditionPlan?.days as any[] | null | undefined;
    if (days && days.length > 0) {
      return days.map((d: any, i: number) => ({
        name:      d.routes?.[0]?.name ?? d.title ?? `Stage ${i + 1}`,
        routeIdentityKey: d.routes?.[0]?.routeIdentityKey,
        region:    "",
        distance:  undefined,
        elevation: undefined,
      }));
    }
    return [];
  }, [summitGoal]);

  // Use explicit completedRoutes[] from the library for accurate stage tracking.
  // Falls back to summitGoal.completedRoutes (migrated goals) then empty array.
  const completedRoutes: string[] = activeExpedition?.completedRoutes
    ?? summitGoal?.completedRoutes ?? [];
  const completedSummitNames = [...new Set(
    suggestedHills
      .filter(hill => isRouteCompleted(completedRoutes, hill))
      .map(hill => hill.name.trim())
      .filter(Boolean),
  )];
  const completedStages = stages.filter(s => isRouteCompleted(completedRoutes, s)).length;
  // Route-completion percentage drives the progress ring and stage dots.
  const routePct = stages.length > 0
    ? Math.round(completedStages / stages.length * 100)
    : pct; // fall back to elevation-based pct when no stages loaded yet

  // Next incomplete route — first hill whose name is not yet in completedRoutes.
  const nextHill = summitGoal?.virtualHills?.find(h => !isRouteCompleted(completedRoutes, h))
                   ?? summitGoal?.virtualHills?.[0];
  const nextEst  = nextHill
    ? `Est. ${Math.round(nextHill.distance / 5)}–${Math.round(nextHill.distance / 3)}h`
    : "";
  const journalUrls  = (summitGoal?.virtualHills ?? []).slice(0, 3).map(
    h => `${API_BASE}/mountain-image?name=${encodeURIComponent(h.name)}&width=200&height=200`,
  );
  // AI expedition concept (shown below title when present)
  const concept = (summitGoal as any)?.expeditionPlan?.concept as string | undefined;

  // ── Fetches ──────────────────────────────────────────────────────────────────
  async function fetchExpedition(
    force = false,
    mountainOverride?: string,
    targetRouteIdentityKey?: string,
    targetCountry?: string,
    targetRegion?: string,
  ) {
    // Allow starting fresh from a challenge card even without an existing goal
    if (!summitGoal && !mountainOverride) return;
    if (!force && !mountainOverride && hasCachedData) return;
    setLoading(true); setError(null);
    try {
      const mountain = mountainOverride ?? summitGoal!.mountainName;
      const location = summitGoal?.location ?? "United Kingdom";
      const radius   = summitGoal?.maxRadius ?? 30;
      const savedRouteIdentityKey = mountainOverride
        ? undefined
        : activeExpedition?.virtualExpeditionProvenance?.selectedTargetRouteIdentityKey
          ?? summitGoal?.virtualExpeditionProvenance?.selectedTargetRouteIdentityKey
          ?? undefined;
      const request: PendingBaseExpeditionRequest = {
        force,
        ...(mountainOverride ? { mountainOverride } : {}),
        ...(targetRouteIdentityKey ?? savedRouteIdentityKey
          ? { targetRouteIdentityKey: targetRouteIdentityKey ?? savedRouteIdentityKey }
          : {}),
        ...(targetCountry ? { targetCountry } : {}),
        ...(targetRegion ? { targetRegion } : {}),
      };
      const res = await fetch(`${API_BASE}/virtual-expedition`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetMountain: mountain,
          userLocation: location,
          radius,
          targetRouteIdentityKey: request.targetRouteIdentityKey,
          targetCountry: request.targetCountry,
          targetRegion: request.targetRegion,
          requireVerifiedRouteSelection: true,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({})) as any;
        if (
          res.status === 409
          && b.code === "AMBIGUOUS_MOUNTAIN"
          && Array.isArray(b.candidates)
          && b.candidates.length > 0
        ) {
          setMountainChoices(b.candidates);
          setPendingMountainRequest(request);
          setMountainChooserOpen(true);
          return;
        }
        if (
          res.status === 409
          && b.code === "TARGET_ROUTE_SELECTION_REQUIRED"
          && Array.isArray(b.routes)
          && b.routes.length > 0
        ) {
          setTargetRouteChoices(b.routes);
          setPendingTargetRouteRequest(request);
          setTargetRoutePickerOpen(true);
          return;
        }
        throw new Error(b.error ?? "Error");
      }
      const data = await res.json();
      setTargetRoutePickerOpen(false);
      setTargetRouteChoices([]);
      setPendingTargetRouteRequest(null);
      setMountainChooserOpen(false);
      setMountainChoices([]);
      setPendingMountainRequest(null);

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
          virtualExpeditionProvenance: data.provenance,
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
          virtualExpeditionProvenance: data.provenance,
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

  // Fetch community stats
  useEffect(() => {
    setCommunityLoading(true);
    fetch(`${API_BASE}/tracked-routes`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d || !d.routes) return;
        const routes: any[] = d.routes;
        if (routes.length === 0) return;

        let totalElev = 0;
        let topRoute: any = null;
        let mostRepeated: any = null;

        for (const r of routes) {
          totalElev += (r.elevationGain || 0);
          if (!topRoute || (r.elevationGain || 0) > (topRoute.elevationGain || 0)) {
            topRoute = r;
          }
          if (r.contributionCount && (!mostRepeated || r.contributionCount > mostRepeated.contributionCount)) {
            mostRepeated = r;
          }
        }

        setCommunityStats({
          totalRoutes: routes.length,
          totalElev,
          topRouteName: topRoute?.name || "Unknown Route",
          topRouteElev: topRoute?.elevationGain || 0,
          mostRepeatedName: mostRepeated?.name || null,
          mostRepeatedCount: mostRepeated?.contributionCount || null,
        });
      })
      .catch(() => {})
      .finally(() => setCommunityLoading(false));
  }, []);

  // Prefer approved library artwork for either the exact challenge or its
  // target mountain. Custom expeditions do not have a challenge ID.
  useEffect(() => {
    const cid = activeExpedition?.challengeId;
    const mountainName =
      activeExpedition?.targetMountainName
      ?? activeExpedition?.targetMountain?.name
      ?? summitGoal?.targetMountain?.name
      ?? summitGoal?.mountainName;

    setChallengeHeroUri(null);
    setArtworkError(false);
    setFallbackError(false);

    const controller = new AbortController();
    void (async () => {
      try {
        let candidates: any[] = [];

        if (cid) {
          const response = await fetch(
            `${API_BASE}/sx/challenges/${encodeURIComponent(cid)}`,
            { signal: controller.signal },
          );
          if (response.ok) {
            const data = await response.json();
            candidates = [data.challenge ?? data];
          }
        }

        if (!candidates.some(ch => ch?.approved && (ch.heroImage || ch.cardImage)) && mountainName) {
          const slug = mountainArtworkSlug(mountainName);
          const response = await fetch(
            `${API_BASE}/sx/challenges/for-mountain/${encodeURIComponent(slug)}`,
            { signal: controller.signal },
          );
          if (response.ok) {
            const data = await response.json();
            candidates = [...candidates, ...(data.challenges ?? [])];
          }
        }

        const approved = candidates.find(ch => ch?.approved && (ch.heroImage || ch.cardImage));
        const url = artworkUrl(approved?.heroImage ?? approved?.cardImage);
        if (url) setChallengeHeroUri(url);
      } catch {
        // The canonical mountain-photo endpoint remains the fallback.
      }
    })();

    return () => controller.abort();
  }, [
    activeExpedition?.challengeId,
    activeExpedition?.targetMountainName,
    activeExpedition?.targetMountain?.name,
    summitGoal?.targetMountain?.name,
    summitGoal?.mountainName,
  ]);

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
        <VerifiedMountainChooser
          visible={mountainChooserOpen}
          candidates={mountainChoices}
          onClose={() => {
            setMountainChooserOpen(false);
            setPendingMountainRequest(null);
          }}
          onSelect={(candidate) => {
            const pending = pendingMountainRequest;
            if (!pending) return;
            setMountainChooserOpen(false);
            void fetchExpedition(
              pending.force,
              pending.mountainOverride,
              pending.targetRouteIdentityKey,
              candidate.country,
              candidate.region ?? undefined,
            );
          }}
        />
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

          <CommunityActivityCard stats={communityStats} loading={communityLoading} />

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
      ? `${target.country}  ·  ${target.summitElevation.toLocaleString()}m ASL`
      : "";

  const ACHIEVEMENT_COLORS = [T.orange, T.green, T.blue, T.purple];

  return (
    <React.Suspense
      fallback={
        <LinearGradient
          colors={T.bgGrad}
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color={T.blue} />
        </LinearGradient>
      }
    >
    <>
    <VerifiedMountainChooser
      visible={mountainChooserOpen}
      candidates={mountainChoices}
      onClose={() => {
        setMountainChooserOpen(false);
        setPendingMountainRequest(null);
      }}
      onSelect={(candidate) => {
        const pending = pendingMountainRequest;
        if (!pending) return;
        setMountainChooserOpen(false);
        void fetchExpedition(
          pending.force,
          pending.mountainOverride,
          pending.targetRouteIdentityKey,
          candidate.country,
          candidate.region ?? undefined,
        );
      }}
    />
    <CinematicPrototype
      active={cinematicActive}
      mountainRef={mountainRef}
      onCinematicReady={handleCinematicReady}
      onDismiss={() => setCinematicActive(false)}
      snapToIdentity={showCompletion}
    >
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>

      <ScrollView
        ref={scrollRef}
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
                    expTitle.length > 22 && { fontSize: 26, lineHeight: 31 },
                    expTitle.length > 32 && { fontSize: 22, lineHeight: 27 },
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

            <TouchableOpacity
              style={[s.quickStartBtn, { marginTop: 8 }]}
              activeOpacity={0.85}
              testID="free-hike-base-camp-cta"
              onPress={() => {
                if (!activeExpeditionId) return;
                router.push({
                  pathname: "/hike-tracking" as any,
                  params: { trackingMode: "freehike", expeditionId: activeExpeditionId },
                });
              }}
              disabled={!activeExpeditionId}
            >
              <LinearGradient
                colors={["#69CEF5", "#45B7E8"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.quickStartGrad}
              >
                <MapPin size={14} color="#071428" />
                <Text style={[s.quickStartText, { color: "#071428" }]}>Free Hike</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Mountain Progress — centrepiece of Expedition Mode ───────────── */}
        <Animated.View entering={FadeInDown.delay(60).duration(400)} style={{ marginTop: 14 }}>
          {/* mountainImageRef placed on the inner mountain image view via ExpeditionMountainProgress */}
          <ExpeditionMountainProgress
            targetElevation={totalGoal}
            targetDistance={targetDist}
            currentElevation={totalTrained}
            stages={summitGoal.virtualHills ?? []}
            completedRoutes={completedRoutes}
            days={target?.estimatedDays ?? 1}
            highestPoint={target?.summitElevation ?? 0}
            allDone={completedRoutes.length > 0 && !nextHill}
            mountainImageRef={mountainRef}
            replayTrigger={cinematicReplayTrigger}
            onStagePress={(pressedHill) => {
              const hill = pressedHill;
              router.push({
                pathname: "/hill-detail",
                params: {
                  name:           hill.name,
                  location:       summitGoal.location ?? "",
                  lat:            hill.lat?.toString()       ?? "",
                  lng:            hill.lng?.toString()       ?? "",
                  elevation:      (hill.elevation ?? 0).toString(),
                  distance:       hill.distance.toString(),
                  routeDistance:  hill.routeDistance?.toString() ?? "",
                  estimatedTime:  hill.estimatedTime ?? "",
                  routeType:      hill.routeType ?? "",
                  grade:          hill.grade   ?? "",
                  surface:        hill.surface ?? "",
                  emoji:          hill.emoji   ?? "⛰️",
                  expeditionMode: "true",
                  expeditionId: activeExpeditionId ?? "",
                  routeIdentityKey: hill.routeIdentityKey ?? "",
                  summitIdentityKey: hill.summitIdentityKey ?? "",
                  objectiveType: hill.objectiveType ?? "",
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

        {/* ── DNA Match Breakdown ──────────────────────────────────────────── */}
        <View style={s.dnaCard}>
          <View style={[s.sectionRow, { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" }]}>
            <Text style={s.sectionLabel}>MOUNTAIN DNA MATCH</Text>
            {score > 0 && (
              <View style={s.overallScoreBadge}>
                <Text style={s.overallScoreText}>{score}% overall</Text>
              </View>
            )}
          </View>

          <View style={s.dnaGrid}>
            <View style={s.dnaCol}>
              <Text style={s.dnaVal}>{elevMatch !== null ? `${elevMatch}%` : "—"}</Text>
              <Text style={s.dnaLbl}>Elevation</Text>
              <Text style={s.dnaSub}>{suggestedGain.toLocaleString()}m / {totalGoal.toLocaleString()}m</Text>
            </View>
            <View style={s.dnaDiv} />
            <View style={s.dnaCol}>
              <Text style={s.dnaVal}>{distMatch !== null ? `${distMatch}%` : "—"}</Text>
              <Text style={s.dnaLbl}>Distance</Text>
              <Text style={s.dnaSub}>
                {hasCompleteRouteDistance
                  ? `${suggestedDist.toFixed(1)}km / ${targetDist.toFixed(1)}km`
                  : "Route data unavailable"}
              </Text>
            </View>
            <View style={s.dnaDiv} />
            <View style={s.dnaCol}>
              <Text style={s.dnaVal}>{steepnessMatch !== null ? `${steepnessMatch}%` : "—"}</Text>
              <Text style={s.dnaLbl}>Steepness</Text>
              <Text style={s.dnaSub}>
                {hasCompleteRouteDistance
                  ? `${steepnessRatio} vs ${targetSteepnessRatio}`
                  : "Route data unavailable"}
              </Text>
            </View>
          </View>
          <Text style={s.dnaNote}>
            Stage DNA compares each local route with an equal share of the full mountain target.
          </Text>
        </View>

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
                      source={{ uri: `${API_BASE}/mountain-image?name=${encodeURIComponent(englishPlaceName(nextHill.name))}&width=160&height=120` }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.nextHillName} numberOfLines={2}>{englishPlaceName(nextHill.name)}</Text>
                    <Text style={s.nextHillMeta}>{nextHill.distance} km · {nextHill.elevation.toLocaleString()} m gain</Text>
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

        <CommunityActivityCard stats={communityStats} loading={communityLoading} />

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
              const done = isRouteCompleted(completedRoutes, stage);
              return (
                <TouchableOpacity
                  key={stage.name + idx}
                  activeOpacity={done ? 1 : 0.75}
                  onPress={done ? undefined : () => {
                    setRoutePickerOpen(false);
                    router.push({
                      pathname: "/hike-tracking" as any,
                      params: {
                        hillName: stage.name,
                        routeIdentityKey: stage.routeIdentityKey ?? "",
                        summitIdentityKey: stage.summitIdentityKey ?? "",
                        objectiveType: stage.objectiveType ?? "",
                        trackingMode: "expedition-route",
                        expeditionId: activeExpeditionId,
                      },
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
                      {englishPlaceName(stage.name)}
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

      {/* Verified target-route selection — shown only when canonical routes differ. */}
      <Modal
        visible={targetRoutePickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setTargetRoutePickerOpen(false)}
      >
        <TouchableOpacity
          style={s.pickerBackdrop}
          activeOpacity={1}
          onPress={() => setTargetRoutePickerOpen(false)}
        />
        <View style={s.pickerSheet}>
          <View style={s.pickerHandle} />
          <Text style={s.pickerTitle}>Choose the target route</Text>
          <Text style={s.pickerSub}>
            These verified routes have materially different ascent and distance facts. Choose the route you want your local expedition to simulate.
          </Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 12 }}>
            {targetRouteChoices.map((routeChoice, index) => (
              <TouchableOpacity
                key={routeChoice.identityKey}
                activeOpacity={0.75}
                style={s.pickerRow}
                onPress={() => {
                  const pending = pendingTargetRouteRequest;
                  setTargetRoutePickerOpen(false);
                  if (pending) {
                    void fetchExpedition(
                      pending.force,
                      pending.mountainOverride,
                      routeChoice.identityKey,
                      pending.targetCountry,
                      pending.targetRegion,
                    );
                  }
                }}
              >
                <View style={s.pickerBadge}>
                  <Text style={s.pickerBadgeText}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.pickerRouteName}>{routeChoice.routeName}</Text>
                  <Text style={s.pickerRouteSub}>
                    {[
                      routeChoice.startPoint ? `From ${routeChoice.startPoint}` : null,
                      routeChoice.totalAscentMetres != null
                        ? `${routeChoice.totalAscentMetres.toLocaleString()}m ascent`
                        : null,
                      routeChoice.distanceKm != null ? `${routeChoice.distanceKm}km` : null,
                      routeChoice.typicalDurationHours != null
                        ? `${routeChoice.typicalDurationHours}h`
                        : null,
                    ].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <ChevronRight size={16} color={T.blue} />
              </TouchableOpacity>
            ))}
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </Modal>

    </LinearGradient>
    </CinematicPrototype>

    {/* Completion cinematic — Modal sits above tab bar, covers everything */}
    <CompletionCinematic
      visible={showCompletion}
      preload={cinematicActive}
      expeditionName={expTitle ?? "Your Expedition"}
      totalElevationM={totalTrained}
      totalDistanceKm={totalDistanceCovered}
      summitNames={completedSummitNames}
      onContinue={handleCompletionContinue}
    />
    </>
    </React.Suspense>
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
  // ── DNA Match Breakdown & Free Hike CTA ──
  dnaCard: {
    marginHorizontal: 14,
    marginTop: 14,
    backgroundColor: "#080F20",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  overallScoreBadge: {
    backgroundColor: "rgba(62,207,117,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  overallScoreText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: T.green,
  },
  dnaGrid: {
    flexDirection: "row",
    paddingVertical: 14,
  },
  dnaCol: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  dnaDiv: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  dnaVal: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  dnaLbl: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: T.blue,
    letterSpacing: 0.5,
    marginTop: 4,
    textTransform: "uppercase",
  },
  dnaSub: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.40)",
    marginTop: 2,
    textAlign: "center",
  },
  dnaNote: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    fontSize: 10,
    lineHeight: 14,
    fontFamily: "Inter_400Regular",
    color: T.textDim,
    textAlign: "center",
  },
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
