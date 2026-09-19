/**
 * Expedition Mountains — Mountain Bundle Discovery + Outdoor Progress Tracker
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
  Alert,
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
  NearbyHill, SimulationScoreBreakdown, TargetMountain, VirtualExpeditionProvenance,
} from "@/context/AppContext";
import {
  VerifiedRouteChooser,
  type VerifiedTargetRouteChoice,
} from "@/components/VerifiedRouteChooser";
import {
  VerifiedMountainChooser,
  type VerifiedMountainChoice,
} from "@/components/VerifiedMountainChooser";
import {
  calculateManualDna, canShowManualChoices, requiresExtraDay, hydrateManualSnapshot,
  normalizeManualTechnicalTarget,
  buildManualSaveSnapshot,
  CUSTOM_EXPEDITION_LABELS,
  dispatchCreationChoice,
  applySelectionChange,
  assignObjectiveDay,
  confirmSuggestionFlow,
  confirmExtraDayFlow,
} from "@/utils/manualExpedition";
import { mountainSuggestions } from "@/constants/mountains";
import {
  signatureStageToNearbyHill,
  signatureStageTotals,
} from "@/utils/signatureExpedition";

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
  { name: "Lake District", slug: "Helvellyn",    expeditions: 24, challengeId: "SIG052" },
  { name: "Snowdonia",     slug: "Snowdon",       expeditions: 18, challengeId: "SIG053" },
  { name: "Scotland",      slug: "Ben Nevis",     expeditions: 22, challengeId: "SIG051" },
  { name: "Peak District", slug: "Kinder Scout",  expeditions: 16, challengeId: "SIG060" },
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
  resolutionOnly?: boolean;
  routeSelectionRequired?: boolean;
  targetProfile:    TargetMountain & { notes?: string | null };
  recommendedHills: NearbyHill[];
  simulationScore:  number;
  adventureScore?:  number;
  dnaMatchScore?:   number;
  scoreBreakdown:   SimulationScoreBreakdown;
  provenance?: VirtualExpeditionProvenance;
  expedition?: {
    title: string; concept: string;
    days: Array<{ label: string; title: string; focus: string; routes: Array<{ name: string; routeIdentityKey?: string; routeId?: string; routeName?: string; why: string }> }>;
    alternatives: Record<string, string[]>;
    adventureScore: number; dnaMatchScore: number; dnaMatchNotes: string;
  } | null;
  /** Optional server-provided improvement suggestion (older API responses omit it). */
  improveYourMatch?: ImproveYourMatch | null;
  manualBuilder?: ManualBuilder | null;
  eligibleSummitPool?: ManualSummitGroup[];
  targetDna?: ManualBuilder["targetDna"];
  suggestNextSummit?: ManualBuilder["suggestion"];
}

interface ManualRoute {
  summitName: string;
  summitIdentityKey: string;
  summitId?: string | null;
  summitElevationASL?: number | null;
  routeName?: string | null;
  routeIdentityKey: string;
  routeId?: string | null;
  routeGainM: number;
  routeDistanceKm?: number | null;
  estimatedAverageGradientPercent?: number | null;
  gradientIsEstimated?: boolean;
  difficulty?: string | null;
  technicalCharacter?: string | null;
  provenance?: { dataSource?: string; routeDataStatus?: string; confidence?: string };
  distanceFromSearchLocationKm?: number | null;
}
interface ManualSummitGroup {
  summitName: string;
  summitIdentityKey: string;
  summitElevationASL?: number | null;
  routes: ManualRoute[];
}
interface ManualBuilder {
  eligibleSummitPool: ManualSummitGroup[];
  selectedRouteIdentityKeys: string[];
  targetDna: {
    elevationGainM: number; distanceKm: number;
    averageGradientPercent?: number | null; technicalCharacter?: string | null;
  };
  liveDna: {
    combinedGainM: number; combinedDistanceKm: number;
    gainMatchPercentage: number; distanceMatchPercentage: number;
    overallScore: number; estimatedAverageGradientPercent?: number | null;
    gradientSimilarityPercentage: number; technicalSuitabilityPercentage: number;
    remainingGainM: number; remainingDistanceKm: number; range: string;
  };
  suggestion?: { recommendedSummit?: NearbyHill; projectedTotals?: { gain?: number; distance?: number }; requiresConfirmation?: boolean; eligibleAlternatives?: NearbyHill[] } | null;
}

interface ImproveYourMatch {
  recommendedSummit?: NearbyHill;
  current?: { gain?: number; distance?: number; gainRatio?: number; distanceRatio?: number };
  projected?: { gain?: number; distance?: number; gainRatio?: number; distanceRatio?: number };
  provenance?: {
    dataSource?: string;
    routeDataStatus?: string;
    confidence?: string;
    [key: string]: unknown;
  };
  scheduleFit?: {
    fitsExistingSchedule?: boolean;
    assessment?: string;
    additionalDayRecommended?: boolean;
    assignments?: ScheduleAssignment[];
  };
  scheduleAssignments?: ScheduleAssignment[];
  eligibleAlternatives?: NearbyHill[];
}

interface ScheduleAssignment {
  day: number;
  summitName: string;
  summitIdentityKey?: string;
  routeIdentityKey?: string | null;
  routeName?: string | null;
  gain: number;
  distance?: number | null;
  dataSource?: string | null;
  routeDataStatus?: string | null;
  relationship?: "continuous_combined_route" | "separate_objective";
  confidence?: string;
  reason?: string;
  transitionConsideration?: string;
}

function hillGain(hill: NearbyHill): number {
  return hill.totalElevation || (hill.elevation * Math.max(1, hill.repeats || 1));
}
function hillDistance(hill: NearbyHill): number {
  return hill.routeDistance ?? hill.distance * Math.max(1, hill.repeats || 1);
}
function plannedTotals(hills: NearbyHill[]) {
  return hills.reduce((totals, hill) => ({
    gain: totals.gain + hillGain(hill),
    distance: totals.distance + hillDistance(hill),
  }), { gain: 0, distance: 0 });
}
function matchPercent(gain: number, distance: number, target: TargetMountain): number {
  const axisMatch = (actual: number, targetValue: number) =>
    actual > 0 && targetValue > 0 ? Math.min(actual, targetValue) / Math.max(actual, targetValue) : 0;
  return Math.round(((axisMatch(gain, target.totalElevationGain)
    + axisMatch(distance, target.totalDistance)) / 2) * 100);
}

function summitLabel(hill: NearbyHill): string {
  return hill.summitName ?? hill.name;
}
function routeLabel(hill: NearbyHill): string {
  const route = hill.routeName ?? hill.name;
  return route && route !== summitLabel(hill) ? route : "";
}
function summitIdentity(hill: NearbyHill): string {
  return hill.summitIdentityKey ?? hill.canonicalParentIdentityKey ?? hill.summitId ?? summitLabel(hill).trim().toLowerCase();
}
function routeTechnicalSuitability(route: ManualRoute, targetCharacter?: string | null): number {
  const text = `${route.technicalCharacter ?? ""} ${route.difficulty ?? ""}`.toLowerCase();
  const target = (targetCharacter ?? "").toLowerCase();
  const level = text.includes("alpine") || text.includes("technical") ? 5
    : text.includes("scramble") || text.includes("hard") || text.includes("exposed") ? 4
      : text.includes("moderate") ? 3 : 2;
  const targetLevel = target.includes("alpine") || target.includes("technical") ? 5
    : target.includes("scramble") || target.includes("hard") ? 4
      : target.includes("moderate") ? 3 : 2;
  return Math.round((1 - Math.abs(level - targetLevel) / 5) * 100);
}
function assignmentText(assignments: ScheduleAssignment[]): string {
  const grouped = new Map<number, ScheduleAssignment[]>();
  assignments.forEach(item => grouped.set(item.day, [...(grouped.get(item.day) ?? []), item]));
  return [...grouped.entries()].sort((a, b) => a[0] - b[0]).map(([day, items]) => {
    const lines = items.map(item => {
      const route = item.routeName && item.routeName !== item.summitName ? ` via ${item.routeName}` : "";
      const provenance = [item.dataSource, item.routeDataStatus].filter(Boolean).join(" / ") || "provenance unavailable";
      const relationship = item.relationship === "continuous_combined_route" ? "continuous combined route" : "separate objective";
      return `• ${item.summitName}${route} — +${item.gain.toLocaleString()}m / ${item.distance == null ? "distance unavailable" : `${item.distance.toFixed(1)}km`} · ${provenance} · ${relationship} · ${item.confidence ?? "unknown"} confidence\n  ${item.reason ?? "No scheduling reason provided."}${item.transitionConsideration ? ` ${item.transitionConsideration}` : ""}`;
    });
    return `Day ${day}\n${lines.join("\n")}`;
  }).join("\n\n");
}

interface PendingExpeditionRequest {
  mountain: string;
  region: string;
  radius: number;
  daysOverride?: 1 | 2 | 3;
  includeSignatureChallenge: boolean;
  targetRouteIdentityKey?: string;
  targetCountry?: string;
  targetRegion?: string;
  mode?: "automatic" | "manual";
  selectedRouteIdentityKeys?: string[];
  resolveOnly?: boolean;
}

interface SigStage {
  stageOrder: number;
  routeKey: string | null;
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

/**
 * Convert a stored artwork path (/api/artwork/image/…) to a fully-qualified URL.
 * API_BASE ends with "/api"; stored paths already start with "/api/", so strip
 * the trailing segment to avoid doubling the prefix.
 */
function artworkUrl(storedPath: string | null | undefined): string | null {
  if (!storedPath) return null;
  const base = API_BASE.replace(/\/api$/, "");
  return base + storedPath;
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

export default function ExpeditionMountainsScreen() {
  useScreenView("virtual_tab");
  const insets = useSafeAreaInsets();
  const {
    activeExpedition,
    activeExpeditionId,
    patchExpedition,
    startExpedition,
  } = useApp();
  const { isSubscribed } = useSubscription();

  // view state
  const [view, setView] = useState<ViewMode>("browse");
  const [results, setResults] = useState<ExpeditionResult | null>(null);
  const [improvementDismissed, setImprovementDismissed] = useState(false);
  const [alternativeOpen, setAlternativeOpen] = useState(false);
  const [activeBundle, setActiveBundle] = useState<VirtualBundle | null>(null);
  const [activeSearch, setActiveSearch] = useState<{ mountain: string; region: string } | null>(null);

  // search inputs
  const [searchMountain, setSearchMountain] = useState("");
  const [searchRegion, setSearchRegion] = useState("");
  const [showMountainSuggestions, setShowMountainSuggestions] = useState(false);

  // ── Customisation state ──────────────────────────────────────────────────────
  /** Radius in km for the hill search — shown as chips in both browse + results. */
  const [searchRadius, setSearchRadius] = useState<number>(30);
  /** Override the mountain's natural day count (null = use mountain's default). */
  const [customDays, setCustomDays] = useState<1 | 2 | 3 | null>(null);
  /** Whether the customise panel is expanded in the results view. */
  const [customOpen, setCustomOpen] = useState(false);
  /** Editable location shown inside the results customise panel. */
  const [customLocation, setCustomLocation] = useState("");

  // fetch state
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [routeChoices, setRouteChoices] = useState<VerifiedTargetRouteChoice[]>([]);
  const [routeChooserOpen, setRouteChooserOpen] = useState<boolean>(false);
  const [pendingRouteRequest, setPendingRouteRequest] = useState<PendingExpeditionRequest | null>(null);
  const [mountainChoices, setMountainChoices] = useState<VerifiedMountainChoice[]>([]);
  const [mountainChooserOpen, setMountainChooserOpen] = useState<boolean>(false);
  const [manualSelectedKeys, setManualSelectedKeys] = useState<string[]>([]);
  const [manualDayAssignments, setManualDayAssignments] = useState<Record<string, number>>({});
  const [manualSearch, setManualSearch] = useState("");
  const [manualFilter, setManualFilter] = useState<"all" | "verified">("all");
  const [manualSuggestedKey, setManualSuggestedKey] = useState<string | null>(null);

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
  const [creationChoice, setCreationChoice] = useState<"automatic" | "manual" | null>(null);
  const [setupResolved, setSetupResolved] = useState(false);

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
    heroImage?: string | null; cardImage?: string | null;
    thumbnailImage?: string | null; approved?: boolean;
  }>>([]);
  const [selectedFeaturedId, setSelectedFeaturedId] = useState<string | null>(null);
  const browseScrollRef = useRef<any>(null);

  // ── Auto-start from URL param (e.g. navigated here from base-camp) ────────────
  const { startMountain, region: regionParam } = useLocalSearchParams<{ startMountain?: string; region?: string }>();
  useEffect(() => {
    if (startMountain) {
      setSearchMountain(startMountain);
      void fetchExpedition(startMountain, regionParam ?? activeExpedition?.location ?? "United Kingdom", searchRadius);
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

  const isExpeditionActive = !!activeExpedition;
  // One normalized target character is shared by the live builder and save path.
  const normalizedManualTechnicalTarget = normalizeManualTechnicalTarget(
    results?.manualBuilder?.targetDna?.technicalCharacter
      ?? results?.targetDna?.technicalCharacter
      ?? results?.targetProfile.difficulty,
  );
  const matchingMountains = mountainSuggestions(searchMountain);

  function updateSearchMountain(value: string) {
    setSearchMountain(value);
    setShowMountainSuggestions(true);
    setSetupResolved(false);
    setCreationChoice(null);
  }

  function selectSearchMountain(value: string) {
    setSearchMountain(value);
    setShowMountainSuggestions(false);
    setSetupResolved(false);
    setCreationChoice(null);
  }

  // ── Fetch expedition ─────────────────────────────────────────────────────────
  async function fetchExpedition(
    mountain:     string,
    region:       string,
    radius        = searchRadius,
    daysOverride?: 1 | 2 | 3,
    includeSignatureChallenge = false,
    targetRouteIdentityKey?: string,
    targetCountry?: string,
    targetRegion?: string,
    mode: "automatic" | "manual" = "automatic",
    selectedRouteIdentityKeys: string[] = [],
    resolveOnly = false,
  ) {
    setLoading(true);
    setFetchError(null);
    setResults(null);
    if (!includeSignatureChallenge) {
      setSigChallenge(null);
      setSigLoading(false);
      setSigExpanded(false);
    }
    try {
      const requestedMountain = mountain.trim().toLowerCase();
      const activeMountainNames = [
        activeExpedition?.challengeName,
        activeExpedition?.targetMountainName,
        activeExpedition?.targetMountain?.name,
      ].filter((name): name is string => !!name).map(name => name.trim().toLowerCase());
      const activeRouteKey = activeMountainNames.includes(requestedMountain)
        ? activeExpedition?.virtualExpeditionProvenance?.selectedTargetRouteIdentityKey ?? undefined
        : undefined;
      const currentResultRouteKey =
        results?.targetProfile.name.trim().toLowerCase() === requestedMountain
          ? results.provenance?.selectedTargetRouteIdentityKey ?? undefined
          : undefined;
      const persistedRouteKey = activeRouteKey ?? currentResultRouteKey;
      const request: PendingExpeditionRequest = {
        mountain,
        region,
        radius,
        ...(daysOverride ? { daysOverride } : {}),
        includeSignatureChallenge,
        ...(targetRouteIdentityKey ?? persistedRouteKey
          ? { targetRouteIdentityKey: targetRouteIdentityKey ?? persistedRouteKey }
          : {}),
        ...(targetCountry ? { targetCountry } : {}),
        ...(targetRegion ? { targetRegion } : {}),
        mode,
        selectedRouteIdentityKeys,
        resolveOnly,
      };
      const res = await fetch(`${API_BASE}/virtual-expedition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetMountain: mountain,
          userLocation:   region,
          radius,
          ...(daysOverride ? { daysOverride } : {}),
          requireVerifiedRouteSelection: true,
          ...(request.targetRouteIdentityKey
            ? { targetRouteIdentityKey: request.targetRouteIdentityKey }
            : {}),
          ...(request.targetCountry ? { targetCountry: request.targetCountry } : {}),
          ...(request.targetRegion ? { targetRegion: request.targetRegion } : {}),
          mode,
          ...(selectedRouteIdentityKeys.length ? { selectedRouteIdentityKeys } : {}),
          resolveOnly,
        }),
      });
      const body = await res.json() as ExpeditionResult & {
        error?: string;
        code?: string;
        routes?: VerifiedTargetRouteChoice[];
        candidates?: VerifiedMountainChoice[];
      };
      if (
        res.status === 409
        && body.code === "AMBIGUOUS_MOUNTAIN"
        && Array.isArray(body.candidates)
        && body.candidates.length > 0
      ) {
        setMountainChoices(body.candidates);
        setPendingRouteRequest(request);
        setMountainChooserOpen(true);
        return;
      }
      if (
        res.status === 409
        && body.code === "TARGET_ROUTE_SELECTION_REQUIRED"
        && Array.isArray(body.routes)
        && body.routes.length > 0
      ) {
        setRouteChoices(body.routes);
        setPendingRouteRequest(request);
        setRouteChooserOpen(true);
        return;
      }
      if (!res.ok) throw new Error(body.error ?? `Server error ${res.status}`);
      setRouteChooserOpen(false);
      setRouteChoices([]);
      setPendingRouteRequest(null);
      setMountainChooserOpen(false);
      setMountainChoices([]);
       setResults({ ...body, resolutionOnly: resolveOnly });
       if (resolveOnly) {
         setSetupResolved(true);
         setCreationChoice(null);
       }
       if (mode === "manual") {
         const suggestion = body.manualBuilder?.suggestion ?? body.suggestNextSummit;
         setManualSuggestedKey(
           suggestion?.recommendedSummit?.routeIdentityKey
           ?? suggestion?.recommendedSummit?.routeId
           ?? null,
         );
       }
      setImprovementDismissed(false);
      setAlternativeOpen(false);
      if (includeSignatureChallenge) {
        void fetchSigChallenge(mountain); // non-blocking — curated bundles only
      }
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
    void fetchExpedition(
      bundle.goalMountain,
      bundle.region,
      searchRadius,
      customDays ?? undefined,
      true,
    );
  }

  // ── Custom search ────────────────────────────────────────────────────────────
  function handleSearch() {
    if (searchMountain.trim().length < 2 || searchRegion.trim().length < 2) return;
    setActiveBundle(null);
    setActiveSearch({ mountain: searchMountain.trim(), region: searchRegion.trim() });
    setCustomLocation(searchRegion.trim());
    setCreationChoice(null);
    setSetupResolved(false);
  }

  function chooseCreationMode(mode: "automatic" | "manual") {
    if (!results || !canShowManualChoices({
      targetMountain: results.targetProfile.name,
      targetRouteIdentityKey: results.provenance?.selectedTargetRouteIdentityKey,
      days: customDays,
      routeSelectionRequired: results.provenance?.routeSelectionRequired ?? results.routeSelectionRequired ?? false,
    })) return;
    setCreationChoice(mode);
    const setup = {
      targetMountain: results.targetProfile.name,
      targetRouteIdentityKey: results.provenance?.selectedTargetRouteIdentityKey,
      days: customDays,
      routeSelectionRequired: results.provenance?.routeSelectionRequired ?? results.routeSelectionRequired ?? false,
    };
    void dispatchCreationChoice({ ...setup, location: customLocation || searchRegion, radius: searchRadius }, async payload => {
      await fetchExpedition(results.targetProfile.name, customLocation || searchRegion,
        searchRadius, payload.daysOverride as 1 | 2 | 3, false,
        payload.targetRouteIdentityKey ?? undefined, undefined, undefined,
        payload.mode, [], payload.resolveOnly);
    }, mode);
  }

  function resolveTarget() {
    if (searchMountain.trim().length < 2 || searchRegion.trim().length < 2 || customDays == null) return;
    void fetchExpedition(searchMountain.trim(), searchRegion.trim(), searchRadius,
      customDays ?? undefined, false, undefined, undefined, undefined, "manual", [], true);
  }

  // ── Regenerate with custom params ────────────────────────────────────────────
  function handleRegenerate() {
    const mountain = activeBundle?.goalMountain ?? activeSearch?.mountain;
    const region   = customLocation.trim() || activeBundle?.region || activeSearch?.region;
    if (!mountain || !region) return;
    setCustomOpen(false);
    void fetchExpedition(
      mountain,
      region,
      searchRadius,
      customDays ?? undefined,
      activeBundle !== null,
    );
  }

  // ── Set as goal ──────────────────────────────────────────────────────────────
  async function handleSetGoal() {
    if (!results) return;
    const mountainName = activeBundle?.goalMountain ?? activeSearch?.mountain ?? results.targetProfile.name;
    const location = customLocation.trim() || (activeBundle?.region ?? activeSearch?.region ?? "");

    await startExpedition({
      challengeName:            mountainName,
      targetMountainName:       results.targetProfile.name ?? mountainName,
      targetMountain:           results.targetProfile,
      virtualHills:             results.recommendedHills,
      simulationScore:          matchPercent(plannedTotals(results.recommendedHills).gain, plannedTotals(results.recommendedHills).distance, results.targetProfile),
      simulationScoreBreakdown: { ...results.scoreBreakdown, overall: matchPercent(plannedTotals(results.recommendedHills).gain, plannedTotals(results.recommendedHills).distance, results.targetProfile) },
      expeditionPlan:           results.expedition ?? null,
      ...(results.provenance
        ? { virtualExpeditionProvenance: results.provenance }
        : {}),
      location,
      maxRadius:                searchRadius,
      fitnessLevel:             activeExpedition?.fitnessLevel ?? "Average",
    });
    router.replace("/(expedition)/base-camp" as any);
  }

  function openManualBuilder() {
    if (!results) return;
    const saved = activeExpedition?.manualBuilderState;
    const targetRouteKey = results.provenance?.selectedTargetRouteIdentityKey ?? null;
    const canRestore = !!saved
      && (saved.targetRouteIdentityKey ?? null) === targetRouteKey;
    const restored = canRestore ? hydrateManualSnapshot({
      selectedRouteIdentityKeys: saved?.selectedRouteIdentityKeys ?? [],
      dayAssignments: saved?.dayAssignments ?? {},
      dna: {} as any,
      routes: [],
    }) : { keys: [], assignments: {} };
    const restoredKeys = restored.keys;
    setManualSelectedKeys(restored.keys);
    setManualDayAssignments(restored.assignments);
    setManualSearch("");
    void fetchExpedition(
      activeBundle?.goalMountain ?? activeSearch?.mountain ?? results.targetProfile.name,
      customLocation || activeBundle?.region || activeSearch?.region || "",
      searchRadius, customDays ?? undefined, false,
      results.provenance?.selectedTargetRouteIdentityKey ?? undefined,
       undefined, undefined, "manual", restoredKeys,
    );
  }

  function manualRouteForKey(key: string): ManualRoute | null {
    const groups = results?.manualBuilder?.eligibleSummitPool ?? results?.eligibleSummitPool ?? [];
    for (const group of groups) {
      const route = group.routes.find(item => item.routeIdentityKey === key);
      if (route) return route;
    }
    return null;
  }

  function manualControllerState() {
    const groups = results?.manualBuilder?.eligibleSummitPool ?? results?.eligibleSummitPool ?? [];
    const routes = Object.fromEntries(groups.flatMap(group => group.routes.map(route => [
      route.routeIdentityKey,
      {
        gainM: route.routeGainM,
        distanceKm: route.routeDistanceKm ?? 0,
        averageGradientPercent: route.estimatedAverageGradientPercent,
        technicalSuitability: routeTechnicalSuitability(route, normalizedManualTechnicalTarget),
        summitIdentityKey: route.summitIdentityKey,
      },
    ])));
    const targetDna = results?.manualBuilder?.targetDna ?? results?.targetDna;
    return {
      keys: manualSelectedKeys,
      assignments: manualDayAssignments,
      routes,
      target: {
        gainM: targetDna?.elevationGainM ?? results?.targetProfile.totalElevationGain ?? 0,
        distanceKm: targetDna?.distanceKm ?? results?.targetProfile.totalDistance ?? 0,
        averageGradientPercent: targetDna?.averageGradientPercent,
      },
    };
  }

  function applyManualSelection(
    action: { type: "add" | "remove" | "replace" | "reorder"; key: string; replacementKey?: string; direction?: -1 | 1 },
  ) {
    const next = applySelectionChange(manualControllerState(), action);
    setManualSelectedKeys(next.keys);
    setManualDayAssignments(next.assignments);
  }

  function toggleManualRoute(route: ManualRoute) {
    const current = manualSelectedKeys;
    const sameSummit = current.some(key => manualRouteForKey(key)?.summitIdentityKey === route.summitIdentityKey);
    if (current.includes(route.routeIdentityKey)) {
      applyManualSelection({ type: "remove", key: route.routeIdentityKey });
    } else if (sameSummit) {
      // A summit remains one objective; selecting another route replaces its route.
      const previousKey = current.find(key =>
        manualRouteForKey(key)?.summitIdentityKey === route.summitIdentityKey);
      if (previousKey) {
        applyManualSelection({
          type: "replace",
          key: previousKey,
          replacementKey: route.routeIdentityKey,
        });
      }
    } else {
      applyManualSelection({ type: "add", key: route.routeIdentityKey });
    }
  }

  function moveManualRoute(key: string, direction: -1 | 1) {
    applyManualSelection({ type: "reorder", key, direction });
  }

  function assignManualDay(routeKey: string, day: number) {
    const next = assignObjectiveDay({
      assignments: manualDayAssignments,
      selectedKeys: manualSelectedKeys,
      days: customDays ?? results?.targetProfile.estimatedDays ?? 1,
    }, routeKey, day);
    if (!next.accepted) {
      setFetchError("reason" in next
        ? next.reason
        : "These routes must remain separate objectives.");
      return;
    }
    setManualDayAssignments(next.assignments);
  }

  function suggestManualRoute() {
    if (!results) return;
    void fetchExpedition(
      activeBundle?.goalMountain ?? activeSearch?.mountain ?? results.targetProfile.name,
      customLocation || activeBundle?.region || activeSearch?.region || "",
      searchRadius, customDays ?? undefined, false,
      results.provenance?.selectedTargetRouteIdentityKey ?? undefined,
      undefined, undefined, "manual", manualSelectedKeys,
    );
  }

  function saveManualExpedition() {
    if (!results) return;
    void (async () => {
      const selected = manualSelectedKeys.map(manualRouteForKey).filter((item): item is ManualRoute => !!item);
      const hills = selected.map((route): NearbyHill => ({
        name: route.summitName,
        summitName: route.summitName,
        summitIdentityKey: route.summitIdentityKey,
        objectiveType: "manual_summit",
        summitId: route.summitId ?? route.summitIdentityKey,
        routeName: route.routeName ?? undefined,
        routeIdentityKey: route.routeIdentityKey,
        routeId: route.routeId ?? route.routeIdentityKey,
        elevation: route.routeGainM, totalElevation: route.routeGainM,
        distance: route.routeDistanceKm ?? 0, routeDistance: route.routeDistanceKm ?? undefined,
        repeats: 1, surface: route.technicalCharacter ?? "summit route",
        grade: route.difficulty ?? "Unknown", emoji: "⛰️",
        summitElevationASL: route.summitElevationASL ?? undefined,
        dataSource: route.provenance?.dataSource, routeDataStatus: route.provenance?.routeDataStatus,
        confidence: route.provenance?.confidence,
      }));
      const totals = plannedTotals(hills);
      const targetDna = results.manualBuilder?.targetDna ?? results.targetDna;
      const targetGradient = targetDna?.averageGradientPercent ?? (
        results.targetProfile.totalDistance > 0
          ? results.targetProfile.totalElevationGain / (results.targetProfile.totalDistance * 10) : null);
      const dna = calculateManualDna(selected.map(route => ({
        gainM: route.routeGainM,
        distanceKm: route.routeDistanceKm ?? 0,
        averageGradientPercent: route.estimatedAverageGradientPercent,
        technicalSuitability: routeTechnicalSuitability(route, normalizedManualTechnicalTarget),
      })), {
        gainM: results.targetProfile.totalElevationGain,
        distanceKm: results.targetProfile.totalDistance,
        averageGradientPercent: targetGradient,
      });
      const score = dna.overall;
      const maxDay = selected.reduce((max, route, index) =>
        Math.max(max, manualDayAssignments[route.routeIdentityKey] ?? index + 1), 1);
      const selectedAssignments = Object.fromEntries(selected
        .filter(route => manualDayAssignments[route.routeIdentityKey] != null)
        .map(route => [route.routeIdentityKey, manualDayAssignments[route.routeIdentityKey]]));
      const saveSnapshot = buildManualSaveSnapshot({
        selectedRouteIdentityKeys: selected.map(route => route.routeIdentityKey),
        dayAssignments: selectedAssignments,
        dna,
        routes: selected.map(route => ({
          routeIdentityKey: route.routeIdentityKey,
          summitIdentityKey: route.summitIdentityKey,
          dataSource: route.provenance?.dataSource,
          confidence: route.provenance?.confidence,
        })),
      });
      const requiresConfirmedExtraDay = requiresExtraDay(
        manualDayAssignments, selected.map(route => route.routeIdentityKey), results.targetProfile.estimatedDays);
      if (requiresConfirmedExtraDay) {
        const prompt = `This plan uses day ${maxDay}, beyond the selected ${results.targetProfile.estimatedDays}-day duration. Add the extra day?`;
        const confirmed = await confirmExtraDayFlow(
          maxDay,
          results.targetProfile.estimatedDays,
          () => Platform.OS === "web"
            ? window.confirm(prompt)
            : new Promise<boolean>(resolve => Alert.alert("Add another day?", prompt, [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Add day", onPress: () => resolve(true) },
            ], { cancelable: true, onDismiss: () => resolve(false) })),
        );
        if (!confirmed) return;
      }
      const days = Array.from({ length: maxDay }, (_, dayIndex) => ({
        label: maxDay === 1 ? "Expedition day" : `Day ${dayIndex + 1}`,
        title: dayIndex === 0 ? "Primary ascent day" : "Summit objective day",
        focus: "selected summit route objective",
        routes: selected
          .filter(route => (manualDayAssignments[route.routeIdentityKey] ?? selected.indexOf(route) + 1) === dayIndex + 1)
          .map(route => ({
            name: route.summitName,
            routeName: route.routeName ?? undefined,
            routeId: route.routeId ?? route.routeIdentityKey,
            routeIdentityKey: route.routeIdentityKey,
            assignmentDay: dayIndex + 1,
            relationship: "separate_objective" as const,
            schedulingConfidence: "estimated" as const,
            provenance: route.provenance?.dataSource,
            confidence: route.provenance?.confidence,
            why: `+${route.routeGainM}m · ${route.routeDistanceKm ?? "distance unavailable"}km · ${route.provenance?.confidence ?? "unknown"} confidence · separate objective`,
          })),
      })).filter(day => day.routes.length > 0);
      await startExpedition({
        challengeName: results.targetProfile.name,
        targetMountainName: results.targetProfile.name,
        targetMountain: results.targetProfile,
        virtualHills: hills,
        simulationScore: score,
         simulationScoreBreakdown: {
           overall: dna.overall, elevation: dna.gainMatch, distance: dna.distanceMatch,
           gradient: dna.gradientSimilarity, technicalSuitability: dna.technicalSuitability,
           duration: dna.range === "within" || dna.range === "within_widened" ? 100 : 50,
           altitude: 0, consecutiveDays: 0,
         },
        expeditionPlan: {
          title: `${results.targetProfile.name}: selected summits`,
          concept: "A user-selected expedition using trusted summit and route identities.",
          days,
          alternatives: {},
          adventureScore: score,
          dnaMatchScore: score,
           dnaMatchNotes: `Manual DNA snapshot: ${dna.gainMatch}% gain, ${dna.distanceMatch}% distance, ${dna.gradientSimilarity}% gradient similarity, ${dna.technicalSuitability}% technical suitability; ${dna.range}.`,
        },
        virtualExpeditionProvenance: results.provenance
          ? { ...results.provenance, matchMethod: "manual_builder_v1",
              manualSnapshot: {
                selectedRouteIdentityKeys: selected.map(route => route.routeIdentityKey),
                routes: selected.map(route => ({
                  routeIdentityKey: route.routeIdentityKey,
                  summitIdentityKey: route.summitIdentityKey,
                  dataSource: route.provenance?.dataSource,
                  confidence: route.provenance?.confidence,
                })),
              } }
          : undefined,
        manualBuilderState: {
          selectedRouteIdentityKeys: saveSnapshot.selectedRouteIdentityKeys,
          dayAssignments: saveSnapshot.dayAssignments,
          targetRouteIdentityKey: results.provenance?.selectedTargetRouteIdentityKey,
          dnaBreakdown: {
            overall: score, gainMatch: dna.gainMatch, distanceMatch: dna.distanceMatch,
            gradientSimilarity: dna.gradientSimilarity, technicalSuitability: dna.technicalSuitability,
            estimatedAverageGradientPercent: dna.averageGradientPercent, range: dna.range,
          },
        },
        location: customLocation || activeSearch?.region || "",
        maxRadius: searchRadius,
        fitnessLevel: activeExpedition?.fitnessLevel ?? "Average",
      });
      router.replace("/(expedition)/base-camp" as any);
    })().catch(err => setFetchError(err instanceof Error ? err.message : "Could not save expedition."));
  }

  async function handleAddImprovement(hill: NearbyHill) {
    if (!results) return;
    const projected = plannedTotals([...results.recommendedHills, hill]);
    const rec = results.improveYourMatch;
    const isRecommended = !!rec?.recommendedSummit && (
      (rec.recommendedSummit.routeIdentityKey && rec.recommendedSummit.routeIdentityKey === hill.routeIdentityKey)
      || summitIdentity(rec.recommendedSummit) === summitIdentity(hill)
    );
    const targetDays = results.targetProfile.estimatedDays;
    // The API's assignments are authoritative for the primary recommendation.
    // Alternatives intentionally get a new day unless the exact route identity
    // proves that they are the same continuous objective. Summit coordinates
    // are never treated as trailheads.
    const serverAssignments = isRecommended
      ? (rec?.scheduleAssignments ?? rec?.scheduleFit?.assignments ?? [])
      : [];
    const assignments: ScheduleAssignment[] = serverAssignments.length > 0
      ? serverAssignments
      : [
        ...results.recommendedHills.map((existing, index): ScheduleAssignment => ({
          day: index + 1,
          summitName: summitLabel(existing),
          summitIdentityKey: summitIdentity(existing),
          routeIdentityKey: existing.routeIdentityKey ?? null,
          routeName: routeLabel(existing) || null,
          gain: hillGain(existing),
          distance: hillDistance(existing),
          dataSource: undefined,
          routeDataStatus: undefined,
          relationship: "separate_objective",
          confidence: "high",
          reason: "Current objective receives a stable dedicated day.",
          transitionConsideration: "No transition distance is added to route totals.",
        })),
        (() => {
          const relatedIndex = results.recommendedHills.findIndex(existing =>
            !!existing.routeIdentityKey && existing.routeIdentityKey === hill.routeIdentityKey);
          return {
            day: relatedIndex >= 0 ? relatedIndex + 1 : results.recommendedHills.length + 1,
            summitName: summitLabel(hill),
            summitIdentityKey: summitIdentity(hill),
            routeIdentityKey: hill.routeIdentityKey ?? null,
            routeName: routeLabel(hill) || null,
            gain: hillGain(hill),
            distance: hillDistance(hill),
            dataSource: undefined,
            routeDataStatus: undefined,
            relationship: relatedIndex >= 0 ? "continuous_combined_route" : "separate_objective",
            confidence: relatedIndex >= 0 ? "medium" : "estimated",
            reason: relatedIndex >= 0
              ? "The exact route identity supports a continuous combined route."
              : "Alternative has no trustworthy same-route/trailhead evidence; keep it as a separate objective.",
            transitionConsideration: relatedIndex >= 0
              ? "Same route identity; no additional trailhead transition assumed."
              : "Summit coordinates are not trailheads; transition evidence is unavailable.",
          } satisfies ScheduleAssignment;
        })(),
      ];
    const maxAssignedDay = assignments.reduce((max, item) => Math.max(max, item.day), 0);
    const extraDay = maxAssignedDay > targetDays;
    const scheduleSummary = assignmentText(assignments);
    const confirmationTitle = extraDay ? "Add another day?" : "Confirm schedule change";
    const confirmationMessage = `${scheduleSummary}\n\n${extraDay
      ? `This reaches day ${maxAssignedDay}, beyond the current ${targetDays}-day target.`
      : "Review the assigned objectives before changing your plan."}`;
    const confirmed = Platform.OS === "web"
      ? window.confirm(`${confirmationTitle}\n\n${confirmationMessage}`)
      : await new Promise<boolean>(resolve => {
          Alert.alert(
            confirmationTitle,
            confirmationMessage,
            [{ text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: extraDay ? "Confirm duration change" : "Confirm addition", onPress: () => resolve(true) }],
            { cancelable: true, onDismiss: () => resolve(false) },
          );
        });
    if (!confirmed) return;
    const nextHills = [...results.recommendedHills, hill];
    const nextTarget = extraDay
      ? { ...results.targetProfile, estimatedDays: maxAssignedDay }
      : results.targetProfile;
    const nextScore = matchPercent(projected.gain, projected.distance, nextTarget);
    const axisScore = (actual: number, targetValue: number) =>
      actual > 0 && targetValue > 0
        ? Math.round(100 * Math.min(actual, targetValue) / Math.max(actual, targetValue))
        : 0;
    const route = {
      name: routeLabel(hill) || hill.name,
      routeName: routeLabel(hill) || undefined,
      routeId: hill.routeId,
      why: "Confirmed optional match improvement",
      routeIdentityKey: hill.routeIdentityKey,
    };
    const nextPlan = results.expedition
      ? { ...results.expedition, days: extraDay
          ? [...results.expedition.days, { label: `Day ${results.expedition.days.length + 1}`, title: hill.name, focus: "Additional summit", routes: [route] }]
          : results.expedition.days.map((day, index) =>
            index === results.expedition!.days.length - 1
              ? { ...day, routes: [...day.routes, route] }
              : day) }
      : results.expedition;
    setResults({
      ...results,
      targetProfile: nextTarget,
      recommendedHills: nextHills,
      simulationScore: nextScore,
      dnaMatchScore: nextScore,
      scoreBreakdown: {
        ...results.scoreBreakdown,
        overall: nextScore,
        elevation: axisScore(projected.gain, nextTarget.totalElevationGain),
        distance: axisScore(projected.distance, nextTarget.totalDistance),
      },
      expedition: nextPlan,
    });
    setImprovementDismissed(true);
    setAlternativeOpen(false);
    // This remains a prospective result. The user still controls activation
    // with the existing Set as my Virtual Goal action.
  }

  // ── Log hike ─────────────────────────────────────────────────────────────────
  async function handleLogHike() {
    const elevM = parseFloat(logElev);
    if (isNaN(elevM) || elevM <= 0) return;
    setLogSaving(true);
    try {
      if (!activeExpedition || !activeExpeditionId) return;
      const prev = activeExpedition.virtualHikeProgress;
      const distKm = parseFloat(logDist);
      await patchExpedition(activeExpeditionId, {
        virtualHikeProgress: {
          elevationGained: prev.elevationGained + elevM,
          distanceCovered: prev.distanceCovered + (isNaN(distKm) ? 0 : distKm),
          hikesLogged: prev.hikesLogged + 1,
          creditedHikeIds: prev.creditedHikeIds,
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
      ? `Finding summits in ${activeBundle.regionDisplay}…`
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

  const routeChooser = (
    <VerifiedRouteChooser
      visible={routeChooserOpen}
      routes={routeChoices}
      onClose={() => setRouteChooserOpen(false)}
      onSelect={(route) => {
        const pending = pendingRouteRequest;
        if (!pending) return;
        setRouteChooserOpen(false);
        void fetchExpedition(
          pending.mountain,
          pending.region,
          pending.radius,
          pending.daysOverride,
          pending.includeSignatureChallenge,
          route.identityKey,
          pending.targetCountry,
          pending.targetRegion,
          pending.mode,
          pending.selectedRouteIdentityKeys,
           pending.resolveOnly,
        );
      }}
    />
  );
  const mountainChooser = (
    <VerifiedMountainChooser
      visible={mountainChooserOpen}
      candidates={mountainChoices}
      onClose={() => {
        setMountainChooserOpen(false);
        setPendingRouteRequest(null);
      }}
      onSelect={(candidate) => {
        const pending = pendingRouteRequest;
        if (!pending) return;
        setMountainChooserOpen(false);
        void fetchExpedition(
          pending.mountain,
          pending.region,
          pending.radius,
          pending.daysOverride,
          pending.includeSignatureChallenge,
          pending.targetRouteIdentityKey,
          candidate.country,
          candidate.region ?? undefined,
          pending.mode,
          pending.selectedRouteIdentityKeys,
          pending.resolveOnly,
        );
      }}
    />
  );

  // ── Results view ─────────────────────────────────────────────────────────────
  if (view === "results" && results) {
    const tp = results.targetProfile;
    const hills = results.recommendedHills;
    const manual = results.manualBuilder;
    if (results.resolutionOnly && setupResolved && !creationChoice) {
      return (
        <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad, paddingHorizontal: 16, gap: 14 }}>
            <View style={[s.card, { gap: 8 }]}>
              <Text style={s.mountainTitle}>{tp.name}</Text>
              <Text style={s.mountainSub}>Target route: {results.provenance?.selectedTargetRouteName ?? "verified route selected"}</Text>
              <Text style={s.improveCandidateMeta}>Area: {customLocation || searchRegion} · {searchRadius}km · {tp.estimatedDays} day{tp.estimatedDays === 1 ? "" : "s"}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity testID="find-equivalent-summits" onPress={() => chooseCreationMode("automatic")} style={[s.choiceCard, { borderColor: T.green + "55" }]}>
                <Text style={s.choiceTitle}>Find Equivalent Summits</Text><Text style={s.choiceCopy}>Launch the unchanged deterministic automatic planner.</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="choose-your-own-summits" onPress={() => chooseCreationMode("manual")} style={[s.choiceCard, { borderColor: T.blue + "55" }]}>
                <Text style={s.choiceTitle}>Choose Your Own Summits</Text><Text style={s.choiceCopy}>Open the manual builder with this resolved target route.</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </LinearGradient>
      );
    }
    if (manual) {
      const pool = (manual.eligibleSummitPool ?? results.eligibleSummitPool ?? [])
        .filter(group => manualSearch.trim().length === 0
          || group.summitName.toLowerCase().includes(manualSearch.trim().toLowerCase())
          || group.routes.some(route => (route.routeName ?? "").toLowerCase().includes(manualSearch.trim().toLowerCase())))
        .filter(group => manualFilter === "all" || group.routes.some(route => route.provenance?.confidence === "verified"));
      const selected = manualSelectedKeys.map(manualRouteForKey).filter((item): item is ManualRoute => !!item);
      const dna = calculateManualDna(selected.map(route => ({
        gainM: route.routeGainM, distanceKm: route.routeDistanceKm ?? 0,
        averageGradientPercent: route.estimatedAverageGradientPercent,
        technicalSuitability: routeTechnicalSuitability(route, normalizedManualTechnicalTarget),
      })), {
        gainM: manual.targetDna.elevationGainM,
        distanceKm: manual.targetDna.distanceKm,
        averageGradientPercent: manual.targetDna.averageGradientPercent,
      });
      const { gainM: gain, distanceKm: distance, gainMatch, distanceMatch, overall } = dna;
      return (
        <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad, paddingHorizontal: 16, gap: 12 }}>
            <TouchableOpacity onPress={() => { setView("browse"); setResults(null); }} style={s.backRow}>
              <ArrowLeft size={16} color={T.textMuted} /><Text style={s.backText}>Back to choices</Text>
            </TouchableOpacity>
            <View style={[s.card, { gap: 8 }]}>
              <Text style={s.mountainTitle}>{tp.name}</Text>
              <Text style={s.mountainSub}>Target route: {results.provenance?.selectedTargetRouteName ?? "selected route facts unavailable"}</Text>
              <Text style={s.mountainSub}>Target route DNA · {tp.totalElevationGain.toLocaleString()}m simulated gain · {tp.totalDistance}km</Text>
              <Text style={s.improveCandidateMeta}>Target average gradient: {manual.targetDna.averageGradientPercent == null ? "unavailable" : `${manual.targetDna.averageGradientPercent}% (estimated)`}</Text>
              <Text style={s.improveCandidateMeta}>Target technical character: {manual.targetDna.technicalCharacter ?? "unavailable"}</Text>
            </View>
            <View style={[s.card, { gap: 8 }]}>
              <Text style={s.sectionTitle}>Live expedition DNA</Text>
              <Text style={s.manualHeadline}>{overall}% match</Text>
              <Text style={s.improveCandidateMeta}>Gain {gain.toLocaleString()}m / {manual.targetDna.elevationGainM.toLocaleString()}m · {gainMatch}% · {gain < manual.targetDna.elevationGainM ? `${Math.round(manual.targetDna.elevationGainM - gain)}m gain remaining` : "gain above target"}</Text>
              <Text style={s.improveCandidateMeta}>Distance {distance.toFixed(1)}km / {manual.targetDna.distanceKm}km · {distanceMatch}% · {distance < manual.targetDna.distanceKm ? `${(manual.targetDna.distanceKm - distance).toFixed(1)}km remaining` : "distance above target"}</Text>
              <Text style={s.improveCandidateMeta}>Estimated average gradient {dna.averageGradientPercent == null ? "unavailable" : `${dna.averageGradientPercent}%`} · Gradient similarity {dna.gradientSimilarity}% · Technical suitability {dna.technicalSuitability}%</Text>
              <Text style={s.improveCandidateMeta}>{gain === 0 ? "No summits selected yet." : dna.range === "within" ? "Within the preferred range." : dna.range === "within_widened" ? "Within the widened preferred range." : dna.range === "below" ? "Below the preferred range." : "Above the preferred range."}</Text>
            </View>
            <View style={s.card}>
              <Text style={s.sectionTitle}>Selected Summits</Text>
              {selected.length === 0
                ? <Text style={s.improveCandidateMeta}>No selected summits yet. Add an eligible summit route below.</Text>
                : selected.map((route, index) => (
                  <View key={route.routeIdentityKey} style={s.manualRouteRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.manualRouteName}>{route.summitName} · via {route.routeName ?? "summit route"}</Text>
                      <Text style={s.improveCandidateMeta}>Day {manualDayAssignments[route.routeIdentityKey] ?? index + 1} · {route.routeGainM}m · {route.routeDistanceKm ?? "—"}km</Text>
                    </View>
                    <TouchableOpacity testID={`move-up-${route.routeIdentityKey}`} onPress={() => moveManualRoute(route.routeIdentityKey, -1)}><ChevronUp size={16} color={T.blue} /></TouchableOpacity>
                    <TouchableOpacity testID={`move-down-${route.routeIdentityKey}`} onPress={() => moveManualRoute(route.routeIdentityKey, 1)}><ChevronDown size={16} color={T.blue} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => assignManualDay(route.routeIdentityKey, Math.max(1, (manualDayAssignments[route.routeIdentityKey] ?? index + 1) - 1))}><Text style={s.manualAdd}>Day −</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => assignManualDay(route.routeIdentityKey, (manualDayAssignments[route.routeIdentityKey] ?? index + 1) + 1)}><Text style={s.manualAdd}>Day +</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                      setManualSelectedKeys(current => current.filter(key => key !== route.routeIdentityKey));
                      setManualDayAssignments(current => {
                        const next = { ...current }; delete next[route.routeIdentityKey]; return next;
                      });
                    }}><Text style={s.manualAdd}>Remove</Text></TouchableOpacity>
                  </View>
                ))}
            </View>
            <View style={s.searchRow}>
              <Search size={14} color={T.blue} />
              <TextInput value={manualSearch} onChangeText={setManualSearch} placeholder="Search summits or routes" placeholderTextColor={T.textDim} style={[s.searchInput, { flex: 1 }]} />
            </View>
            <View style={s.chipRow}>
              {(["all", "verified"] as const).map(filter => (
                <TouchableOpacity key={filter} onPress={() => setManualFilter(filter)} style={[s.chip, manualFilter === filter && s.chipActive]}>
                  <Text style={[s.chipText, manualFilter === filter && s.chipTextActive]}>{filter === "all" ? "All eligible summits" : "Verified facts"}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {pool.length === 0 ? (
              <View style={s.card}><Text style={s.sectionTitle}>No eligible summits found</Text><Text style={s.improveCandidateMeta}>There are no safe canonical summit routes matching this area and filter. Try a wider radius.</Text></View>
            ) : pool.map(group => (
              <View key={group.summitIdentityKey} style={s.card}>
                <Text style={s.hillName}>{group.summitName}</Text>
                <Text style={s.hillMeta}>{group.summitElevationASL == null ? "Summit elevation unavailable" : `${group.summitElevationASL.toLocaleString()}m summit elevation`}</Text>
                {group.routes.map(route => {
                  const chosen = manualSelectedKeys.includes(route.routeIdentityKey);
                  return (
                    <TouchableOpacity key={route.routeIdentityKey} onPress={() => toggleManualRoute(route)} style={[s.manualRouteRow, chosen && s.manualRouteChosen]}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={s.manualRouteName}>{route.routeName ? `via ${route.routeName}` : "Summit route"}</Text>
                        <Text style={s.improveCandidateMeta}>▲ {route.routeGainM}m · {route.routeDistanceKm == null ? "distance unavailable" : `${route.routeDistanceKm}km`} · {route.estimatedAverageGradientPercent == null ? "gradient unavailable" : `${route.estimatedAverageGradientPercent}% estimated gradient`}</Text>
                        <Text style={s.improveCandidateMeta}>{route.difficulty ?? "Difficulty unavailable"} · {route.provenance?.dataSource ?? "provenance unavailable"} · {route.provenance?.confidence ?? "unknown"} confidence</Text>
                        <Text style={s.improveCandidateMeta}>{route.distanceFromSearchLocationKm == null ? "Distance from search location unavailable" : `${route.distanceFromSearchLocationKm}km from search location`}</Text>
                      </View>
                      <Text style={s.manualAdd}>{chosen ? "Remove" : "Add"}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            <TouchableOpacity onPress={suggestManualRoute} style={s.improveSecondary}>
              <Compass size={15} color={T.blue} /><Text style={s.improveSecondaryText}>Suggest My Next Summit</Text>
            </TouchableOpacity>
            {manual.suggestion?.recommendedSummit && (
              <View style={s.improveCard}>
                <Text style={s.improveTitle}>Suggest My Next Summit</Text>
                <Text style={s.improveCandidateName}>{summitLabel(manual.suggestion.recommendedSummit)}</Text>
                <Text style={s.improveCandidateMeta}>
                  Projected totals: {manual.suggestion.projectedTotals?.gain ?? "—"}m gain · {manual.suggestion.projectedTotals?.distance ?? "—"}km · server-authoritative deterministic suggestion.
                </Text>
                <TouchableOpacity
                  onPress={() => void (async () => {
                    const key = manualSuggestedKey ?? manual.suggestion?.recommendedSummit?.routeIdentityKey;
                    const route = key ? manualRouteForKey(key) : null;
                    if (!route) { setFetchError("Suggested route is no longer available in the eligible pool."); return; }
                    const state = manualControllerState();
                    const controllerRoute = state.routes[route.routeIdentityKey];
                    if (!controllerRoute) {
                      setFetchError("Suggested route metrics are no longer available.");
                      return;
                    }
                    const message = `Add ${route.summitName}${route.routeName ? ` via ${route.routeName}` : ""}?`;
                    const next = await confirmSuggestionFlow(
                      state,
                      { key: route.routeIdentityKey, route: controllerRoute },
                      () => Platform.OS === "web"
                        ? window.confirm(message)
                        : new Promise<boolean>(resolve => Alert.alert("Confirm suggested summit", message, [
                          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                          { text: "Add summit", onPress: () => resolve(true) },
                        ], { cancelable: true, onDismiss: () => resolve(false) })),
                    );
                    if (next.keys.length !== state.keys.length) {
                      setManualSelectedKeys(next.keys);
                      setManualDayAssignments(next.assignments);
                    }
                  })()}
                  style={s.improvePrimary}
                >
                  <Plus size={15} color="#fff" /><Text style={s.improvePrimaryText}>Confirm and add summit</Text>
                </TouchableOpacity>
                {(manual.suggestion.eligibleAlternatives ?? []).slice(0, 3).map(alternative => (
                  <Text key={alternative.routeIdentityKey ?? alternative.name} style={s.improveCandidateMeta}>
                    Alternative: {summitLabel(alternative)}{routeLabel(alternative) ? ` via ${routeLabel(alternative)}` : ""} · projected route facts supplied by server
                  </Text>
                ))}
              </View>
            )}
            <TouchableOpacity onPress={saveManualExpedition} disabled={selected.length === 0} style={[s.setGoalBtn, selected.length === 0 && { opacity: 0.45 }]}>
              <CheckCircle size={17} color="#fff" /><Text style={s.setGoalBtnText}>Save My Expedition</Text>
            </TouchableOpacity>
          </ScrollView>
        </LinearGradient>
      );
    }
    const currentTotals = plannedTotals(hills);
    const score = matchPercent(currentTotals.gain, currentTotals.distance, tp);
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
                <StatCell value={`${tp.summitElevation.toLocaleString()}m`} label="Real Summit" accent={T.blue} />
                <View style={s.statDiv} />
                <StatCell value={`${tp.totalElevationGain.toLocaleString()}m`} label="Simulated Gain" accent={T.green} />
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
                  Equivalent summits in{" "}
                  <Text style={{ color: T.green, fontFamily: "Inter_700Bold" }}>
                    {customLocation || activeBundle?.regionDisplay || activeSearch?.region}
                  </Text>
                </Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 2 }}>
                  {searchRadius}km radius · {tp.estimatedDays} {tp.estimatedDays === 1 ? "day" : "days"}{customDays ? " (custom)" : ""}
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
                    { label: "3 days",            value: 3 as const },
                  ] as Array<{ label: string; value: 1 | 2 | 3 | null }>).map(opt => {
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

          {/* Creation choices: automatic remains the default deterministic flow. */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity testID="find-equivalent-summits" onPress={() => { /* current result is already the automatic plan */ }} style={[s.choiceCard, { borderColor: T.green + "55" }]}>
              <Text style={s.choiceTitle}>Find Equivalent Summits</Text>
              <Text style={s.choiceCopy}>Build the closest local match from trusted summit and route data.</Text>
              <Text style={s.choiceActive}>Current automatic plan</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="choose-your-own-summits" onPress={openManualBuilder} style={[s.choiceCard, { borderColor: T.blue + "55" }]}>
              <Text style={s.choiceTitle}>Choose Your Own Summits</Text>
              <Text style={s.choiceCopy}>Select routes you know and watch your expedition DNA update.</Text>
              <Text style={s.choiceActive}>Open manual builder</Text>
            </TouchableOpacity>
          </View>

          {/* ── Signature Challenge card ────────────────────────────────────── */}
          {activeBundle && (sigLoading || sigChallenge) && (
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
                NEARBY TRAINING SUMMITS
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
                    {hill.routeType === "circular" ? "🔄 Circular" : hill.routeType === "out-and-back" ? "↔️ Out & back" : "⛰ Summit repeats"}
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
                  <Text style={s.dimLabel}>Local summit match score</Text>
                  <Text style={[s.scoreCaption, { color: sc }]}>{scoreLabel(score)} — {score}% of {tp.name}'s demands replicated locally</Text>
                </View>
                {scoreOpen ? <ChevronUp size={15} color={T.textDim} /> : <ChevronDown size={15} color={T.textDim} />}
              </View>
            </TouchableOpacity>
            {scoreOpen && (
              <Animated.View entering={FadeInDown.duration(220)} style={[s.card, { marginTop: 6 }]}>
                {[
                  { key: "elevation", label: "Elevation gain match", emoji: "▲", value: bd.elevation },
                  { key: "distance", label: "Distance match", emoji: "↔", value: bd.distance ?? bd.gradient },
                  ...(bd.technicalSuitability != null
                    ? [{ key: "technical", label: "Technical suitability", emoji: "⛰", value: bd.technicalSuitability }]
                    : []),
                ].map((dim, idx, arr) => {
                  const val = dim.value ?? 0;
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
                <Text style={[s.improveCandidateMeta, { marginTop: 8 }]}>
                  Schedule: {tp.estimatedDays} day{tp.estimatedDays === 1 ? "" : "s"}
                  {bd.duration != null ? ` · duration suitability ${bd.duration}%` : ""}
                </Text>
              </Animated.View>
            )}
          </Animated.View>

          {/* Optional server recommendation; the automatic plan is untouched until confirmation. */}
          {(() => {
            const recommendation = results.improveYourMatch;
            const candidate = recommendation?.recommendedSummit;
            const gainTarget = tp.totalElevationGain;
            const distanceTarget = tp.totalDistance;
            const gain = recommendation?.current?.gain ?? currentTotals.gain;
            const distance = recommendation?.current?.distance ?? currentTotals.distance;
            const belowTarget = gain < gainTarget * 0.9 || distance < distanceTarget * 0.9;
            if (!recommendation || !candidate || improvementDismissed || !belowTarget) return null;
            const calculatedProjected = plannedTotals([...hills, candidate]);
            const projected = {
              gain: recommendation.projected?.gain ?? calculatedProjected.gain,
              distance: recommendation.projected?.distance ?? calculatedProjected.distance,
            };
            const ratioPercent = (ratio: number | undefined, total: number, target: number) =>
              ratio == null ? Math.round(total > 0 ? total / Math.max(1, target) * 100 : 0) : Math.round(ratio <= 1 ? ratio * 100 : ratio);
            const gainPct = ratioPercent(recommendation.projected?.gainRatio, projected.gain, gainTarget);
            const distancePct = ratioPercent(recommendation.projected?.distanceRatio, projected.distance, distanceTarget);
            const alternatives = (recommendation.eligibleAlternatives ?? []).filter((alternative, index, all) =>
              all.findIndex(item => summitIdentity(item) === summitIdentity(alternative)) === index);
            const currentGainPct = ratioPercent(recommendation.current?.gainRatio, gain, gainTarget);
            const currentDistancePct = ratioPercent(recommendation.current?.distanceRatio, distance, distanceTarget);
            return (
              <Animated.View entering={FadeInDown.duration(220)} style={s.improveCard}>
                <Text style={s.improveTitle}>Improve your match</Text>
                <Text style={s.improveIntro}>Your current plan is below the normal target range.</Text>
                <View style={s.improveMetrics}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.improveMetricLabel}>Elevation gain</Text>
                    <Text style={s.improveMetricValue}>{gain.toLocaleString()}m / {gainTarget.toLocaleString()}m</Text>
                    <Text style={s.improveRemaining}>{Math.max(0, gainTarget - gain).toLocaleString()}m remaining · {currentGainPct}% achieved</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.improveMetricLabel}>Distance</Text>
                    <Text style={s.improveMetricValue}>{distance.toFixed(1)}km / {distanceTarget}km</Text>
                    <Text style={s.improveRemaining}>{Math.max(0, distanceTarget - distance).toFixed(1)}km remaining · {currentDistancePct}% achieved</Text>
                  </View>
                </View>
                <View style={s.improveCandidate}>
                  <Text style={s.improveCandidateLabel}>RECOMMENDED SUMMIT</Text>
                   <Text style={s.improveCandidateName}>{summitLabel(candidate)}</Text>
                   {routeLabel(candidate) ? <Text style={s.improveCandidateMeta}>via {routeLabel(candidate)}</Text> : null}
                  <Text style={s.improveCandidateMeta}>+{hillGain(candidate).toLocaleString()}m gain · +{hillDistance(candidate).toFixed(1)}km · projected {projected.gain.toLocaleString()}m ({gainPct}%), {projected.distance.toFixed(1)}km ({distancePct}%)</Text>
                   <Text style={s.improveCandidateMeta}>{recommendation.scheduleFit?.additionalDayRecommended ? "Needs an additional day" : recommendation.scheduleFit?.assessment ?? (recommendation.scheduleFit?.fitsExistingSchedule === false ? "Does not fit the existing schedule" : "Fits the existing schedule")} · {recommendation.provenance?.dataSource ?? "Route source not provided"} · {recommendation.provenance?.routeDataStatus ?? "status not provided"}{recommendation.provenance?.confidence ? ` · ${recommendation.provenance.confidence} confidence` : ""}</Text>
                   <Text style={s.improveCandidateMeta}>Summit {candidate.summitId ?? candidate.summitIdentityKey ?? "identity unavailable"} · route {candidate.routeId ?? candidate.routeIdentityKey ?? "identity unavailable"}</Text>
                </View>
                <TouchableOpacity onPress={() => void handleAddImprovement(candidate)} style={s.improvePrimary} activeOpacity={0.85}>
                  <Plus size={15} color="#fff" /><Text style={s.improvePrimaryText}>Add recommended summit</Text>
                </TouchableOpacity>
                {alternatives.length > 0 && (
                  <>
                    <TouchableOpacity onPress={() => setAlternativeOpen(v => !v)} style={s.improveSecondary} activeOpacity={0.8}>
                      <Text style={s.improveSecondaryText}>Choose another summit</Text>
                    </TouchableOpacity>
                    {alternativeOpen && alternatives.map(alternative => (
                      <TouchableOpacity key={summitIdentity(alternative)} onPress={() => void handleAddImprovement(alternative)} style={s.alternativeRow}>
                        <Text style={s.alternativeName}>{summitLabel(alternative)}</Text>
                        <Text style={s.alternativeMeta}>{routeLabel(alternative) ? `via ${routeLabel(alternative)} · ` : ""}+{hillGain(alternative).toLocaleString()}m · +{hillDistance(alternative).toFixed(1)}km</Text>
                        <Text style={s.alternativeMeta}>Summit {alternative.summitId ?? alternative.summitIdentityKey ?? "identity unavailable"} · route {alternative.routeId ?? alternative.routeIdentityKey ?? "identity unavailable"} · {alternative.dataSource ?? "provenance unavailable"} · {alternative.confidence ?? recommendation.provenance?.confidence ?? "estimated"} confidence</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
                <TouchableOpacity onPress={() => setImprovementDismissed(true)} style={s.improveSecondary} activeOpacity={0.8}>
                  <Text style={s.improveSecondaryText}>Keep current plan</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })()}

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
  if (view === "progress" && activeExpedition?.targetMountain) {
    const tp = activeExpedition.targetMountain;
    const hills = activeExpedition.virtualHills;
    const score = activeExpedition.simulationScore ?? 0;
    const progress = activeExpedition.virtualHikeProgress;
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
              <Text style={s.progressGoalName}>{activeExpedition.challengeName}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                <MapPin size={10} color={T.textDim} />
                <Text style={s.progressGoalSub}>Training in {activeExpedition.location}</Text>
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
              <Text style={s.sectionTitle}>{CUSTOM_EXPEDITION_LABELS.equivalent}</Text>
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
                    <Text style={s.sectionLabel}>{CUSTOM_EXPEDITION_LABELS.matchScore}</Text>
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
                  <Text style={[s.modalSub, { marginBottom: 16 }]}>Record elevation and distance from a real outdoor hike toward your {activeExpedition.challengeName} goal.</Text>
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

  /** Derive per-bundle progress from the active expedition. */
  function bundleProgress(bundle: VirtualBundle) {
    const isActive =
      activeExpedition?.challengeName?.toLowerCase() === bundle.goalMountain.toLowerCase();

    if (!isActive || !activeExpedition?.targetMountain) {
      return { progressPct: 0, elevationGained: 0, equivalentHills: bundle.exampleHills };
    }
    const gained = activeExpedition.virtualHikeProgress.elevationGained;
    const goal   = activeExpedition.targetMountain.totalElevationGain || bundle.totalElevationGain;
    const pct    = goal > 0 ? Math.min(100, Math.round((gained / goal) * 100)) : 0;
    const hills  = activeExpedition.virtualHills.map(h => h.name) ?? bundle.exampleHills;
    return { progressPct: pct, elevationGained: gained, equivalentHills: hills };
  }

  const filteredBundles = VIRTUAL_BUNDLES.filter(b => bundleMatchesRegion(b, selectedRegion));
  const filteredFeatured = featuredList.filter(ch => challengeMatchesRegion(ch.regions, selectedRegion));

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      {routeChooser}
      {mountainChooser}
      <ScrollView ref={browseScrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad }}>

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <Animated.View entering={FadeIn.duration(400)} style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <ExpoImage source={require("@/assets/images/logo.gif")} style={{ width: 140, height: 56, alignSelf: "center" }} contentFit="contain" />
          {/* Title row */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginTop: 4 }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={s.heroTitle}>Explore</Text>
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
        {isExpeditionActive && activeExpedition?.targetMountain && (
          <Animated.View entering={FadeInDown.duration(350)} style={{ paddingHorizontal: 16, marginBottom: 14 }}>
            <TouchableOpacity onPress={() => setView("progress")} activeOpacity={0.85} style={s.activeGoalBanner}>
              <LinearGradient colors={[T.blueDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <View style={{ flex: 1 }}>
                <Text style={s.activeGoalLabel}>ACTIVE GOAL</Text>
                <Text style={s.activeGoalName}>{activeExpedition.challengeName}</Text>
                <Text style={s.activeGoalSub}>{activeExpedition.location}</Text>
                {activeExpedition.virtualHikeProgress.hikesLogged > 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <CheckCircle size={11} color={T.green} />
                    <Text style={{ fontSize: 11, color: T.green, fontFamily: "Inter_500Medium" }}>
                      {activeExpedition.virtualHikeProgress.hikesLogged}{" "}
                      {activeExpedition.virtualHikeProgress.hikesLogged === 1 ? "hike" : "hikes"} logged
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ alignItems: "center", gap: 2 }}>
                {activeExpedition.simulationScore != null ? (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: scoreColor(activeExpedition.simulationScore) }}>
                      {activeExpedition.simulationScore}
                    </Text>
                    <Text style={{ fontSize: 9, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.45)", letterSpacing: 0.5 }}>
                      MATCH
                    </Text>
                  </View>
                ) : (
                  <ChevronRight size={18} color={T.blue} />
                )}
                {activeExpedition.simulationScore != null && <ChevronRight size={12} color={T.blue} />}
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
              <Text style={s.createRouteSub}>Choose your summits, set your goals{"\n"}and build your own expedition.</Text>
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
                  onChangeText={updateSearchMountain}
                  onFocus={() => setShowMountainSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowMountainSuggestions(false), 180)}
                  placeholder="Goal mountain (e.g. Mont Blanc)"
                  placeholderTextColor={T.textDim}
                  returnKeyType="next"
                  autoCorrect={false}
                />
              </View>
              {showMountainSuggestions && matchingMountains.length > 0 && (
                <View style={s.mountainSuggestions}>
                  {matchingMountains.map((name, index) => (
                    <TouchableOpacity
                      key={name}
                      activeOpacity={0.72}
                      onPress={() => selectSearchMountain(name)}
                      style={[
                        s.mountainSuggestionRow,
                        index < matchingMountains.length - 1 && s.mountainSuggestionBorder,
                      ]}
                    >
                      <Mountain size={13} color={T.blue} />
                      <Text style={s.mountainSuggestionText}>{name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
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
              <View style={{ marginTop: 12 }}>
                <Text style={[s.inputLabel, { marginBottom: 6 }]}>Available days</Text>
                <View style={s.chipRow}>
                  {[1, 2, 3].map(day => (
                    <TouchableOpacity key={day} onPress={() => setCustomDays(day as 1 | 2 | 3)}
                      style={[s.chip, customDays === day && s.chipActive]}>
                      <Text style={[s.chipText, customDays === day && s.chipTextActive]}>{day} {day === 1 ? "day" : "days"}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {searchMountain.trim().length >= 2 && searchRegion.trim().length >= 2 && setupResolved && (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                  <TouchableOpacity testID="find-equivalent-summits" onPress={() => chooseCreationMode("automatic")} style={[s.choiceCard, { borderColor: T.green + "55" }]}>
                    <Text style={s.choiceTitle}>Find Equivalent Summits</Text>
                    <Text style={s.choiceCopy}>Use the unchanged deterministic planner and trusted route data.</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID="choose-your-own-summits" onPress={() => chooseCreationMode("manual")} style={[s.choiceCard, { borderColor: T.blue + "55" }]}>
                    <Text style={s.choiceTitle}>Choose Your Own Summits</Text>
                    <Text style={s.choiceCopy}>Build your route list and watch DNA update as you choose.</Text>
                  </TouchableOpacity>
                </View>
              )}
              {searchMountain.trim().length >= 2 && searchRegion.trim().length >= 2 && !setupResolved && (
                <>
                <TouchableOpacity onPress={resolveTarget} disabled={customDays == null} style={[s.searchBtn, customDays == null && { opacity: 0.45 }]} activeOpacity={0.85}>
                  <Search size={15} color="#fff" /><Text style={s.searchBtnText}>Continue</Text>
                </TouchableOpacity>
                {customDays == null && <Text style={s.improveCandidateMeta}>Choose available days before continuing.</Text>}
                </>
              )}
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
              {BROWSE_REGIONS.map(r => {
                const featCh = featuredList.find(f => f.challengeId === r.challengeId && f.approved);
                const artPath = featCh?.thumbnailImage ?? featCh?.cardImage ?? null;
                const regionImgUri = artPath
                  ? artworkUrl(artPath)
                  : `${API_BASE}/mountain-image?name=${encodeURIComponent(r.slug)}&width=240&height=160`;
                return (
                <TouchableOpacity
                  key={r.name}
                  style={s.browseRegionCard}
                  activeOpacity={0.85}
                  onPress={() => setSelectedRegion(r.name)}
                >
                  <ExpoImage
                    source={{ uri: regionImgUri ?? `${API_BASE}/mountain-image?name=${encodeURIComponent(r.slug)}&width=240&height=160` }}
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
                );
              })}
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
                      source={{
                        uri: (ch.approved && artworkUrl(ch.thumbnailImage ?? ch.cardImage))
                          || `${API_BASE}/mountain-image?name=${encodeURIComponent(ch.targetMountainName)}&width=160&height=160`,
                      }}
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
            ?? activeExpedition?.location
            ?? "United Kingdom";
          const hills: NearbyHill[] = challenge.stages.map(signatureStageToNearbyHill);
          const stageTotals = signatureStageTotals(challenge.stages);
          void startExpedition({
            challengeId:        challenge.challengeId,
            challengeName:      challenge.challengeName,
            targetMountainName: challenge.targetMountainName,
            targetMountain: {
              name:               challenge.targetMountainName,
              country:            region,
              summitElevation:    0,
              totalElevationGain: challenge.totalAscentM ?? stageTotals.ascentM,
              totalDistance:      challenge.totalDistanceKm ?? stageTotals.distanceKm,
              estimatedDays:      Math.min(2, Math.max(1, challenge.recommendedDays)) as 1 | 2,
              difficulty:         (challenge.difficulty as TargetMountain["difficulty"]) ?? "Hard",
              altitudeExposure:   "None" as const,
            },
            virtualHills:    hills,
            simulationScore: challenge.dnaMatchScore ?? undefined,
            location:        region,
            maxRadius:       searchRadius,
            fitnessLevel:    activeExpedition?.fitnessLevel ?? "Average",
          }).then(() => router.replace("/(expedition)/base-camp" as any));
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
  choiceCard: { flex: 1, minHeight: 132, borderWidth: 1, borderRadius: 14, backgroundColor: "rgba(20,34,54,0.9)", padding: 13, gap: 7 },
  choiceTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.white, lineHeight: 17 },
  choiceCopy: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 16 },
  choiceActive: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.green },
  manualHeadline: { fontSize: 30, fontFamily: "Inter_700Bold", color: T.green },
  manualRouteRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  manualRouteChosen: { borderColor: T.green + "99", backgroundColor: T.greenDim },
  manualRouteName: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.white },
  manualAdd: { fontSize: 11, fontFamily: "Inter_700Bold", color: T.blue },
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
  mountainSuggestions: {
    backgroundColor: "#14263D",
    borderWidth: 1,
    borderColor: T.blue + "40",
    borderRadius: 12,
    marginTop: 6,
    overflow: "hidden",
  },
  mountainSuggestionRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
  },
  mountainSuggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  mountainSuggestionText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: T.white,
  },
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
  improveCard: {
    backgroundColor: "#10243A", borderRadius: 16, borderWidth: 1,
    borderColor: T.green + "55", padding: 15, gap: 10,
  },
  improveTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.white },
  improveIntro: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  improveMetrics: { flexDirection: "row", gap: 10 },
  improveMetricLabel: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim, textTransform: "uppercase", letterSpacing: 0.6 },
  improveMetricValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white, marginTop: 3 },
  improveRemaining: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },
  improveCandidate: { backgroundColor: "#142236", borderRadius: 11, padding: 11, gap: 3 },
  improveCandidateLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: T.green, letterSpacing: 1 },
  improveCandidateName: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.white },
  improveCandidateMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 16 },
  improvePrimary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: T.green, borderRadius: 11, paddingVertical: 11 },
  improvePrimaryText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  improveSecondary: { alignItems: "center", paddingVertical: 8 },
  improveSecondaryText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.blue },
  alternativeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#142236", borderRadius: 9, padding: 10, marginTop: -4 },
  alternativeName: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.white, flex: 1 },
  alternativeMeta: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted },

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
