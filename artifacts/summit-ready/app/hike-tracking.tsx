import {
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  MapPin,
  Check,
  Pause,
  Play,
  Square,
  TrendingUp,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSubscription } from "@/lib/revenuecat";
import * as Location from "expo-location";
import * as Crypto from "expo-crypto";
import * as TaskManager from "expo-task-manager";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/expo";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  AppStateStatus,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { TrackMap, type TrackMapHandle } from "@/components/track/TrackMap";
import { FreeHikeLaunchControls } from "@/components/track/FreeHikeLaunchControls";
import { savePlannerDraft } from "@/utils/plannerDraftHandoff";
import {
  assess as assessOffRoute, initialMemory as initialOffRouteMemory,
  type OffRouteMemory, type OffRouteReading,
} from "@/utils/offRoute";
import { logHillSessionStarted, logHillSessionCompleted, logHikeTracked } from "@/lib/analytics";
import { ActivityAudiencePicker } from "@/components/track/ActivityAudiencePicker";
import { loadActivityAudience, saveActivityAudience, type ActivityAudience } from "@/utils/activityAudience";
import { recordedHikeElevationQuality } from "@/utils/elevationQuality";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useGetElevationBank } from "@workspace/api-client-react";
import {
  canonicalRouteMapPoints, offlineNotice, paceMinPerKm, readyBrief,
  splitDistance, splitMetres, splitPace, statusLabel,
} from "@/utils/trackPresentation";
import { T } from "@/constants/theme";
import { BASECAMP, TYPE } from "@/constants/tokens";
import { useApp } from "@/context/AppContext";
import { ActivityCompleteView } from "@/components/track/ActivityCompleteView";
import { usePersonalRouteTracking } from "@/hooks/usePersonalRouteTracking";
import { describeRoute } from "@/utils/plannedRouteApi";
import { TrackProgressPanel } from "@/components/track/TrackProgressPanel";
import { RecordingElevationSpark } from "@/components/track/RecordingElevationSpark";
import { appendRawFix, rawFixKey, type RawRecordingFix, type RecordingEvent } from "@/utils/recordingEvidence";
import { LogHikeModal } from "@/components/LogHikeModal";
import { recordingFailureNote } from "@/utils/recordingOutcome";
import type { PlanSession, SavedExpedition } from "@/context/AppContext";
import type { TrailBenefit } from "@/constants/trailData";
import {
  batchStorageKey,
  checkpointElapsedSecs,
  flattenBatches,
  selectBatchKeys,
  shouldRestoreCheckpoint,
  isPersistableHikeStatus,
  type HikeCheckpoint,
  type PointBatch,
} from "@/utils/hikeReliability";
import {
  HIKE_LOCATION_TASK,
  clearActiveHike,
  discardActiveHike,
  readActiveHike,
  readBackgroundActiveHike,
  writeActiveHike,
} from "@/utils/activeHikeSession";
import { requestBackgroundLocation } from "@/utils/backgroundLocationDisclosure";
import { breakElevationContinuity, createRecordedElevation, recordElevation } from "@/utils/recordedElevation";
import { enqueueSyncPending, retrySyncOutbox } from "@/utils/syncOutbox";
import {
  clearPendingHikeSelection,
  readPendingHikeSelection,
  savePendingHikeSelection,
} from "@/utils/pendingHikeSelection";
import { resolveTrainingSessionLocation } from "@/utils/trackingLaunchContext";
import { buildActivityCompletionPresentation } from "@/utils/activityCompletionPresentation";
import { buildRecordedHikeNotes } from "@/utils/recordedHikePresentation";
import { useStage8 } from "@/context/Stage8Context";
import { findElevationBankCreditForActivity } from "@/utils/elevationBankMatching";
import { selectExpeditionPresentation } from "@/utils/expeditionProgress";
import { applyExpeditionStageContribution } from "@/utils/expeditionContribution";
import {
  clearCanonicalRouteHandoff,
  isCanonicalRouteHandoffFresh,
  readCanonicalRouteHandoff,
  type CanonicalRouteHandoff,
} from "@/utils/canonicalRouteHandoff";

// ── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE = process.env.EXPO_PUBLIC_MAP_BASE ?? (process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api");

function localActivityTitle(date = new Date()): string {
  return `Hike – ${date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}, ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatTimeHM(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/* Both are the split figures joined back up, so prose on this screen and the
   large figures in the recording sheet can never round differently. */
function fmtKm(km: number): string {
  const f = splitDistance(km);
  return `${f.value} ${f.unit}`;
}

function fmtM(m: number): string {
  /* Grouped, like every other metre figure in the app. Rendering exposed
     "Lifetime 1284500 m" on Activity Complete, which is unreadable at a
     glance. Display only — nothing measured, stored or credited changes. */
  const f = splitMetres(m);
  return `${f.value} ${f.unit}`;
}

function computeDifficulty(distKm: number, elevM: number): "Easy" | "Moderate" | "Hard" {
  const score = distKm + elevM / 80;
  if (score < 12) return "Easy";
  if (score < 24) return "Moderate";
  return "Hard";
}

function inferBenefits(distKm: number, elevM: number): TrailBenefit[] {
  const b: TrailBenefit[] = ["cardio"];
  if (elevM > 200) b.push("elevation");
  if (distKm > 15) b.push("endurance");
  return b;
}

type TrackStatus = "idle" | "tracking" | "paused" | "finished";

interface TrackPoint {
  lat: number;
  lon: number;
  alt: number | null;
  ts: number;
  speed?: number | null;
  acc?: number | null;
  altAcc?: number | null;
}

interface NearbyRoute {
  id: string;
  name: string;
  distanceKm: number;
  elevationGain: number;
  durationSecs: number;
  difficulty: string;
  distFromUserKm: number;
  contributionCount: number;
}

const GPS_MAX_ACCURACY_M = 25;   // reject fixes noisier than 25 m horizontal accuracy
const GPS_MAX_SPEED_KMH  = 20;   // ~12 mph — not achievable on foot / mountainside
const LOCATION_UPDATES_CONFIG: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  distanceInterval: 5,
  timeInterval: 3000,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: "SummitReady — Recording Hike",
    notificationBody: "Your hike is being tracked. Tap to return to the app.",
    notificationColor: "#3ECF75",
  },
  pausesUpdatesAutomatically: false,
};

function safeRemoveSub(sub: Location.LocationSubscription | null) {
  if (!sub) return;
  try { sub.remove(); } catch { /* expo-location web: LocationEventEmitter.removeSubscription missing */ }
}

function isPlausiblePoint(
  lat: number, lon: number, ts: number, accuracy: number | null,
  prevPts: TrackPoint[],
): boolean {
  if (accuracy != null && accuracy > GPS_MAX_ACCURACY_M) return false;
  if (prevPts.length === 0) return true;
  const prev = prevPts[prevPts.length - 1];
  if (ts <= prev.ts) return false;
  const distKm = haversineKm(prev.lat, prev.lon, lat, lon);
  const dtSecs = Math.max(0, (ts - prev.ts) / 1000);
  if (dtSecs > 0 && distKm > 0) {
    const speedKmh = (distKm / dtSecs) * 3600;
    if (speedKmh > GPS_MAX_SPEED_KMH) return false;
  }
  return true;
}

// ── Background location task (runs even when phone is locked) ────────────────
// Must be defined at module scope, before any component renders.
TaskManager.defineTask(HIKE_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations?.length) return;
  try {
    const active = await readBackgroundActiveHike<{ routeId?: string; status?: string }>();
    if (!active) return;
    if (!active.routeId || active.status !== "tracking") return;
    const points: TrackPoint[] = [];
    for (const loc of locations) {
      points.push({
        lat: loc.coords.latitude,
        lon: loc.coords.longitude,
        alt: loc.coords.altitude,
        ts: loc.timestamp,
        speed: loc.coords.speed,
        acc: loc.coords.accuracy,
        altAcc: loc.coords.altitudeAccuracy,
      });
    }
    if (points.length === 0) return;
    const id = `${locations[0].timestamp}_${Math.random().toString(36).slice(2, 9)}`;
    const batch: PointBatch = { id, routeId: active.routeId, points };
    await AsyncStorage.setItem(
      batchStorageKey(active.routeId, Date.now(), id),
      JSON.stringify(batch),
    );
  } catch { /* ignore */ }
});

// ── Screen ───────────────────────────────────────────────────────────────────

export default function HikeTrackingScreen() {
  const { userId } = useAuth();
  return <HikeTrackingScreenBody key={userId ?? "signed-out"} />;
}

function HikeTrackingScreenBody() {
  const insets = useSafeAreaInsets();
  const { getToken, userId } = useAuth();
  const [activityAudience, setActivityAudience] = useState<ActivityAudience | null>(null);
  const [audienceDefault, setAudienceDefault] = useState<ActivityAudience | null>(null);
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const audienceTouchedRef=useRef(false);
  useEffect(() => {
    let active = true;
    audienceTouchedRef.current=false;
    setActivityAudience(null); setAudienceDefault(null);
    if (userId) void Promise.all([loadActivityAudience(userId, () => getToken({ skipCache: true })),readActiveHike<HikeCheckpoint>(userId)]).then(([audience,checkpoint]) => {
      if (active && !audienceTouchedRef.current) { setActivityAudience(checkpoint?checkpoint.activityAudience??null:audience); setAudienceDefault(audience); }
    }).catch(() => { if (active) setAudienceError("Your sharing default could not be loaded. Choose an audience before saving."); });
    return () => { active = false; };
  }, [userId]);
  const chooseAudience = async (audience: ActivityAudience) => {
    audienceTouchedRef.current=true;
    setActivityAudience(audience); setAudienceError(null);
    if (!audienceDefault && userId) {
      try { await saveActivityAudience(userId, audience, () => getToken({ skipCache: true })); setAudienceDefault(audience); }
      catch { setAudienceError("Your default could not be stored. This activity still uses your selected audience."); }
    }
  };
  const { appMode, shellMode, addSession, logExploreHike, trainingPlan, togglePlanSession, completedPlanSessions,
          summitGoal, patchExpedition, activeExpeditionId, expeditions, exploreHikes } = useApp();
  const { access } = useSubscription();
  const { lastConsequence: stage8LastConsequence } = useStage8();
  const elevationBankQuery = useGetElevationBank({
    query: {
      enabled: Boolean(userId),
      staleTime: 15_000,
      retry: false,
      queryKey: ["/api/elevation-bank"],
    },
  });

  // ── Hill session metadata (optional — passed when launched from a plan hill session) ──
  const params = useLocalSearchParams<{
    hillSessionKey?: string;
    hillName?: string;
    targetReps?: string;
    estimatedGainPerRep?: string;
    estimatedTotalGain?: string;
    referenceRouteId?: string;
    communityOwner?: string;
    referenceRouteName?: string;
    plannedRouteId?: string;
    autoStart?: string;
    plannedRouteName?: string;
    restore?: string;           // "1" when app was killed mid-hike and we're restoring
    trackingMode?: string;
    expeditionId?: string;
    routeId?: string;
    routeIdentityKey?: string;
    summitIdentityKey?: string;
    objectiveType?: string;
    stageSnapshot?: string;
    routeHandoffId?: string;
    canonicalRouteId?: string;
    canonicalRouteIdentityKey?: string;
    canonicalRouteVersion?: string;
    canonicalMountainId?: string;
    canonicalRouteName?: string;
    recordingMountainId?: string;
  }>();
  const personalRoute = usePersonalRouteTracking(params.plannedRouteId);
  // Association only: unlike canonical route params, this never gates free recording.
  const recordingMountainIdRef = useRef(
    params.recordingMountainId && /^[A-Za-z0-9:_-]{1,160}$/.test(params.recordingMountainId)
      ? (params.recordingMountainId.startsWith("sde:mountain:")
        ? params.recordingMountainId : `sde:mountain:${params.recordingMountainId}`)
      : undefined,
  );
  const canonicalRouteParamsIntent = Boolean(
    params.routeHandoffId || params.canonicalRouteId || params.canonicalRouteIdentityKey ||
    params.canonicalRouteVersion || params.canonicalMountainId || params.canonicalRouteName,
  );
  const [restoredCanonicalRouteIntent, setRestoredCanonicalRouteIntent] = useState(false);
  const [restoreCheckpointPending, setRestoreCheckpointPending] = useState(params.restore === "1");
  const [canonicalRouteContext, setCanonicalRouteContext] =
    useState<CanonicalRouteHandoff | null>(null);
  const canonicalRouteIntent = canonicalRouteParamsIntent ||
    restoredCanonicalRouteIntent || !!canonicalRouteContext;
  const [canonicalRouteContextInvalid, setCanonicalRouteContextInvalid] = useState(false);
  const [canonicalRouteContextPending, setCanonicalRouteContextPending] =
    useState(canonicalRouteIntent);
  const [expeditionTracking, setExpeditionTracking] = useState({
    trackingMode: params.trackingMode ?? null,
    expeditionId: params.expeditionId ?? null,
    routeIdentityKey: params.routeIdentityKey?.trim() || undefined,
    summitIdentityKey: params.summitIdentityKey?.trim() || undefined,
    objectiveType: params.objectiveType === "manual_summit" ? "manual_summit" : undefined,
  });
  const [restoredHillMeta, setRestoredHillMeta] = useState<{
    sessionKey?: string | null;
    hillName?: string | null;
    targetReps?: number | null;
    estimatedGainPerRep?: number | null;
    estimatedTotalGain?: number | null;
  }>({});
  const hillMeta = {
    sessionKey:          params.hillSessionKey    ?? restoredHillMeta.sessionKey ?? null,
    hillName:            params.hillName          ?? restoredHillMeta.hillName ?? null,
    targetReps:          params.targetReps ? parseInt(params.targetReps, 10) : restoredHillMeta.targetReps ?? null,
    estimatedGainPerRep: params.estimatedGainPerRep ? parseInt(params.estimatedGainPerRep, 10) : restoredHillMeta.estimatedGainPerRep ?? null,
    estimatedTotalGain:  params.estimatedTotalGain ? parseInt(params.estimatedTotalGain, 10) : restoredHillMeta.estimatedTotalGain ?? null,
    trackingMode:        expeditionTracking.trackingMode,
    expeditionId:        expeditionTracking.expeditionId,
    routeIdentityKey:     expeditionTracking.routeIdentityKey,
    summitIdentityKey:    expeditionTracking.summitIdentityKey,
    objectiveType:        expeditionTracking.objectiveType,
  };
  const trackedExpedition = hillMeta.expeditionId
    ? expeditions.find(expedition => expedition.id === hillMeta.expeditionId) ?? null
    : null;

  /* Route name — OPTIONAL, and locked once tracking starts.
     It has never gated Start: handleStart falls back to localActivityTitle()
     when it is blank (see `effectiveName`), which is what keeps recording
     offline-first. `nameError` was left over from an earlier design and was
     never set, so its message could not appear; the field below now states
     plainly that the name is optional instead. */
  const [routeName, setRouteName]       = useState(
    params.canonicalRouteName?.trim() || params.hillName?.trim()
      || params.plannedRouteName?.trim() || params.referenceRouteName?.trim() || localActivityTitle(),
  );
  const [nameLocked, setNameLocked]     = useState(false);
  const [nameError, setNameError]       = useState(false);
  /* The placeholder title the screen minted for itself. It is a real, usable
     name, but it is not something the user chose, so the ready brief does not
     repeat it back as though it were. */
  const defaultTitleRef                 = useRef(routeName);

  // ── Tracker state ────────────────────────────────────────────────────────
  const [status, setStatus]               = useState<TrackStatus>("idle");
  const [elapsedSecs, setElapsedSecs]     = useState(0);
  const [distanceKm, setDistanceKm]       = useState(0);
  const [elevGainM, setElevGainM]         = useState(0);
  const [elevLossM, setElevLossM]         = useState(0);
  const [currentAltM, setCurrentAltM]     = useState<number | null>(null);
  /* Still recorded, no longer printed. Current speed on foot swings by half
     its value between fixes, and a figure that jumps while you stand still
     reads as a fault; average pace beside it says the same thing steadily.
     Kept in state so showing it again is one line, not a GPS change. */
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [gpsReady, setGpsReady]           = useState(false);
  const [isOffline, setIsOffline]         = useState(false);
  const [permDenied, setPermDenied]       = useState(false);
  const [saving, setSaving]               = useState(false);
  const [discarding, setDiscarding]       = useState(false);
  const [discardError, setDiscardError]   = useState<string | null>(null);
  const [checkpointError, setCheckpointError] = useState<string | null>(null);
  const discardInFlightRef               = useRef(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [addToPlan, setAddToPlan]         = useState(false);
  const [drawerOpen, setDrawerOpen]       = useState(true);
  const [freeHikeOptionsOpen, setFreeHikeOptionsOpen] = useState(false);
  const [freeHikeDrawing, setFreeHikeDrawing] = useState(false);
  const [freeHikeDraft, setFreeHikeDraft] = useState(false);
  const [freeHikeSummitOpen, setFreeHikeSummitOpen] = useState(false);
  const freeHikeReady = status === "idle" && hillMeta.trackingMode === "freehike"
    && !canonicalRouteIntent && !hillMeta.sessionKey && !hillMeta.expeditionId;
  const freeHikeMapBusy = freeHikeReady && (freeHikeDrawing || freeHikeDraft || freeHikeSummitOpen);
  /* Expedition recordings get a second face: the mountain this ascent is
     climbing. Map by default — the hike is the thing happening. */
  const [panel, setPanel] = useState<"map" | "progress">("map");
  const [logByHandOpen, setLogByHandOpen] = useState(false);
  const [showExpeditionPrompt, setShowExpeditionPrompt] = useState(false);
  const [completionExpedition, setCompletionExpedition] = useState<SavedExpedition | null>(null);
  const [completionSaveStarted, setCompletionSaveStarted] = useState(false);

  useEffect(() => {
    if (status !== "idle" || !canonicalRouteContext) return;
    const expiresIn = canonicalRouteContext.savedAt + 24 * 60 * 60 * 1000 - Date.now();
    if (expiresIn <= 0) {
      setCanonicalRouteContext(null);
      setCanonicalRouteContextInvalid(true);
      return;
    }
    const timer = setTimeout(() => {
      setCanonicalRouteContext(null);
      setCanonicalRouteContextInvalid(true);
    }, expiresIn);
    return () => clearTimeout(timer);
  }, [status, canonicalRouteContext]);

  // ── Nearby route picker ───────────────────────────────────────────────────
  const [nearbyRoutes, setNearbyRoutes]         = useState<NearbyRoute[]>([]);
  const [nearbyLoading, setNearbyLoading]       = useState(false);
  const [nearbyPickerOpen, setNearbyPickerOpen] = useState(false);
  const [selectedCanonical, setSelectedCanonical] = useState<{ id: string; name: string } | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Canonical route geometry is read from owner-scoped local storage. The URL
  // contains only a short handoff reference and exact identity fields.
  useEffect(() => {
    if (!canonicalRouteParamsIntent) {
      if (!restoredCanonicalRouteIntent) {
        setCanonicalRouteContext(null);
        setCanonicalRouteContextInvalid(false);
        setCanonicalRouteContextPending(false);
      }
      return;
    }
    if (!userId || !params.routeHandoffId || !params.canonicalRouteId || !params.canonicalRouteIdentityKey ||
        !params.canonicalRouteVersion || !params.canonicalMountainId) {
      setCanonicalRouteContext(null);
      setCanonicalRouteContextInvalid(true);
      setCanonicalRouteContextPending(false);
      return;
    }
    let cancelled = false;
    setCanonicalRouteContextPending(true);
    setCanonicalRouteContextInvalid(false);
    void readCanonicalRouteHandoff({
      ownerUserId: userId,
      handoffId: params.routeHandoffId,
      routeId: params.canonicalRouteId as `sde:route:${string}@${string}`,
      routeIdentityKey: params.canonicalRouteIdentityKey,
      routeVersion: params.canonicalRouteVersion,
      mountainId: params.canonicalMountainId as `sde:mountain:${string}`,
    }).then(context => {
      if (!cancelled) {
        setCanonicalRouteContext(context);
        setCanonicalRouteContextInvalid(!context);
        setCanonicalRouteContextPending(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setCanonicalRouteContext(null);
        setCanonicalRouteContextInvalid(true);
        setCanonicalRouteContextPending(false);
      }
    });
    return () => { cancelled = true; };
  }, [
    canonicalRouteParamsIntent,
    restoredCanonicalRouteIntent,
    userId,
    params.routeHandoffId,
    params.canonicalRouteId,
    params.canonicalRouteIdentityKey,
    params.canonicalRouteVersion,
    params.canonicalMountainId,
  ]);

  const trackPoints    = useRef<TrackPoint[]>([]);
  const rawGPSFixes = useRef<RawRecordingFix[]>([]);
  const rawFixKeys = useRef(new Set<string>());
  const recordingEvents = useRef<RecordingEvent[]>([]);
  const checkpointWriter = useRef<() => Promise<boolean>>(async () => false);
  const retainRawFix = (point: TrackPoint, source: RawRecordingFix["source"], acceptedForTrace: boolean) =>
    appendRawFix(rawGPSFixes.current, rawFixKeys.current, { ...point, source, acceptedForTrace });
  const lastAltRef     = useRef<number | null>(null);
  const elevationFilterRef = useRef(createRecordedElevation());
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const statusRef      = useRef<TrackStatus>("idle");
  const initialPosRef  = useRef<{ lat: number; lon: number } | null>(null);
  const recordingMapRef = useRef<TrackMapHandle | null>(null);
  const [mapRevision, setMapRevision] = useState(0);
  const [recordingSheetHeight, setRecordingSheetHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const mapTopInset = Math.max(insets.top + 54, headerHeight);
  const saveInFlightRef    = useRef(false);
  const routeIdRef         = useRef(
    Crypto.randomUUID(),
  );
  const stageSnapshotRef = useRef<Record<string, unknown> | undefined>(undefined);

  // A completed activity can reach the canonical ledger through the outbox
  // after the local save returns. Refresh only while this screen is visible,
  // with a short finite budget; saving/navigation never waits for this.
  useEffect(() => {
    if (status !== "finished" || !completionSaveStarted || isOffline || !userId) return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (cancelled || attempts >= 4) return;
      attempts += 1;
      const result = await elevationBankQuery.refetch();
      if (cancelled) return;
      const activityId = routeIdRef.current;
      const credited = result.data?.recentCredits.some((credit) =>
        (credit.activityId === activityId || credit.sourceId === activityId)
        && (credit.status === "credited" || credit.status === "corrected"),
      );
      if (!credited && attempts < 4) timer = setTimeout(poll, 2_000);
    };
    timer = setTimeout(poll, 1_000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [completionSaveStarted, elevationBankQuery.refetch, isOffline, status, userId]);

  if (!stageSnapshotRef.current && params.stageSnapshot) {
    try {
      stageSnapshotRef.current = JSON.parse(params.stageSnapshot) as Record<string, unknown>;
    } catch {}
  }

  // ── Timestamp refs for background-safe timer ─────────────────────────────
  // Timer computed as Date.now() - trackStartMsRef - totalPausedMsRef
  // so it continues correctly even if the JS interval was paused by the OS.
  const trackStartMsRef  = useRef<number>(0);
  const totalPausedMsRef = useRef<number>(0);
  const pauseStartMsRef  = useRef<number>(0);
  const pauseTogglingRef  = useRef(false);        // guard against rapid double-tap
  const restoreAttempted  = useRef(false);        // prevent double-fire of restore effect
  const backgroundedRef   = useRef(false);        // true when user navigated away while tracking
  const backgroundAllowedRef = useRef(false);
  const lifecycleRef = useRef<Promise<void>>(Promise.resolve());
  const checkpointWriteRef = useRef<Promise<void>>(Promise.resolve());
  const distanceRef = useRef(0);
  const elevGainRef = useRef(0);
  const elevLossRef = useRef(0);
  const currentAltRef = useRef<number | null>(null);
  const consumeAltitude = useCallback((alt: number | null, ts: number, altAcc?: number | null) => {
    const next = recordElevation(elevationFilterRef.current, { alt, ts, altAcc });
    elevationFilterRef.current = next;
    elevGainRef.current = next.gain;
    elevLossRef.current = next.loss;
    lastAltRef.current = next.last?.alt ?? null;
    setElevGainM(next.gain);
    setElevLossM(next.loss);
    if (next.last?.ts === ts && alt != null && Number.isFinite(alt)) {
      currentAltRef.current = alt;
      setCurrentAltM(alt);
    }
  }, []);
  useEffect(() => { distanceRef.current = distanceKm; }, [distanceKm]);
  useEffect(() => { elevGainRef.current = elevGainM; }, [elevGainM]);
  useEffect(() => { elevLossRef.current = elevLossM; }, [elevLossM]);
  useEffect(() => { currentAltRef.current = currentAltM; }, [currentAltM]);
  const serialize = useCallback((operation: () => Promise<void>) => {
    const next = lifecycleRef.current.then(operation, operation);
    lifecycleRef.current = next.catch(() => {});
    return next;
  }, []);

  useEffect(() => {
    if (userId) void retrySyncOutbox(userId, getToken);
  }, [getToken, userId]);

  // Connectivity is advisory only. Tracking never waits for this probe.
  useEffect(() => {
    let cancelled = false;
    let wasOffline = false;
    async function checkConnectivity() {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4_000);
        const response = await fetch(`${API_BASE}/healthz`, {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (cancelled) return;
        setIsOffline(!response.ok);
        if (wasOffline && response.ok && userId) {
          void retrySyncOutbox(userId, getToken);
        }
        wasOffline = !response.ok;
      } catch {
        if (!cancelled) {
          wasOffline = true;
          setIsOffline(true);
        }
      }
    }
    void checkConnectivity();
    const interval = setInterval(checkConnectivity, 15_000);
    const appState = AppState.addEventListener("change", state => {
      if (state === "active") void checkConnectivity();
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      appState.remove();
    };
  }, [getToken, userId]);

  // Cache the selected expedition stage independently of network and navigation state.
  useEffect(() => {
    if (!userId || params.restore === "1" || params.plannedRouteId) return;
    const hasExplicitSelection = !!(
      params.hillName ||
      params.referenceRouteName ||
      params.trackingMode ||
      params.expeditionId ||
      params.stageSnapshot
    );
    if (!hasExplicitSelection) return;
    let stageSnapshot: Record<string, unknown> | undefined;
    if (params.stageSnapshot) {
      try { stageSnapshot = JSON.parse(params.stageSnapshot) as Record<string, unknown>; } catch {}
    }
    void savePendingHikeSelection({
      userId,
      routeName,
      trackingMode: hillMeta.trackingMode,
      expeditionId: hillMeta.expeditionId,
      routeIdentityKey: hillMeta.routeIdentityKey,
      summitIdentityKey: hillMeta.summitIdentityKey,
      objectiveType: hillMeta.objectiveType,
      stageSnapshot,
      savedAt: Date.now(),
    });
  }, [
    userId,
    params.restore,
    params.plannedRouteId,
    params.stageSnapshot,
    routeName,
    hillMeta.trackingMode,
    hillMeta.expeditionId,
    hillMeta.routeIdentityKey,
    hillMeta.summitIdentityKey,
    hillMeta.objectiveType,
  ]);

  useEffect(() => {
    if (!userId || params.hillName || params.referenceRouteName || params.plannedRouteId || params.restore === "1") return;
    void readPendingHikeSelection(userId).then(selection => {
      if (!selection) return;
      stageSnapshotRef.current = selection.stageSnapshot;
      setRouteName(selection.routeName || localActivityTitle());
      setExpeditionTracking(current => ({
        trackingMode: selection.trackingMode ?? current.trackingMode,
        expeditionId: selection.expeditionId ?? current.expeditionId,
        routeIdentityKey: selection.routeIdentityKey ?? current.routeIdentityKey,
        summitIdentityKey: selection.summitIdentityKey ?? current.summitIdentityKey,
        objectiveType: selection.objectiveType === "manual_summit"
          ? "manual_summit"
          : current.objectiveType,
      }));
    });
  }, [params.hillName, params.referenceRouteName, params.plannedRouteId, params.restore, userId]);

  // ── Pulsing dot while tracking ───────────────────────────────────────────
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (status === "tracking") {
      pulse.value = withRepeat(withTiming(0.3, { duration: 900 }), -1, true);
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [status, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  // ── Permission + GPS warmup ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function warmup() {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync()
        .catch(() => ({ status: "denied" }));
      if (cancelled) return;
      if (permStatus !== "granted") { setPermDenied(true); return; }
      setPermDenied(false);
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          initialPosRef.current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          setCurrentAltM(pos.coords.altitude);
          setGpsReady(true);
          sendLocateToMap(pos.coords.latitude, pos.coords.longitude);
        }
      } catch { /* GPS unavailable on simulator */ }
    }
    warmup();
    return () => { cancelled = true; };
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  // If the user navigated away while tracking (backgroundedRef = true) we
  // intentionally leave the background location task and timer running so
  // tracking continues in the background and can be resumed on return.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      safeRemoveSub(locationSubRef.current);
      locationSubRef.current = null;
      if (backgroundedRef.current) return; // background task continues independently
      if (Platform.OS !== "web") {
        Location.hasStartedLocationUpdatesAsync(HIKE_LOCATION_TASK)
          .then(started => { if (started) Location.stopLocationUpdatesAsync(HIKE_LOCATION_TASK).catch(() => {}); })
          .catch(() => {});
      }
    };
  }, []);

  // ── Send a GPS point to the live map ─────────────────────────────────────
  /**
   * Judge one GPS fix against the route being followed.
   *
   * Called from every tracking watcher rather than from sendPointToMap,
   * because this needs the fix's accuracy and that function is only given a
   * position. The detector itself decides what to do with a poor fix; this
   * only has to hand over what the device reported, including nothing.
   *
   * Everything here is local arithmetic on a route already on the phone, so it
   * keeps working in a valley with no signal — which is exactly where it
   * matters.
   */
  const checkOffRoute = useCallback((lat: number, lng: number, accuracyM: number | null) => {
    const route = followedRouteRef.current;
    if (route.length < 2) return;
    const { memory, reading } = assessOffRoute(
      offRouteMemoryRef.current,
      route,
      { latitude: lat, longitude: lng, accuracyM, at: Date.now() },
    );
    offRouteMemoryRef.current = memory;
    setOffRoute(reading.status === "off_route" ? reading : null);
    /* A buzz, because the phone is usually in a pocket when this matters and a
       banner nobody is looking at is not an alert. Only on announce, so a
       steady state does not vibrate every fix. */
    if (reading.announce) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  }, []);

  const sendPointToMap = useCallback((lat: number, lng: number) => {
    recordingMapRef.current?.send({ type: "recPoint", lat, lng });
  }, []);

  // ── Show current position on map without starting a track ────────────────
  const sendLocateToMap = useCallback((lat: number, lng: number) => {
    recordingMapRef.current?.send({ type: "recLocate", lat, lng });
  }, []);

  // ── Replay the full track on the map (fixes straight-line after unlock) ──
  const replayTrackOnMap = useCallback(() => {
    const points = trackPoints.current.map(p => [p.lat, p.lon] as [number, number]);
    if (points.length === 0) return;
    recordingMapRef.current?.send({ type: "recReplay", points });
  }, []);

  // ── Send a community reference route to the map as a ghost overlay ────────
  const sendRouteOverlay = useCallback(async (routeId: string) => {
    if (canonicalRouteIntent) return;
    try {
      const token = await getToken({ skipCache: true });
      const path = params.communityOwner ? `/activity-community/${encodeURIComponent(params.communityOwner)}/${encodeURIComponent(routeId)}` : `/tracked-routes/${encodeURIComponent(routeId)}`;
      const res = await fetch(`${API_BASE}${path}`,{headers:token?{Authorization:`Bearer ${token}`}:{},redirect:"error"});
      if (!res.ok) { setCheckpointError("The reference route is unavailable to you. This recording still saves your own GPS evidence; do not assume the planned line has loaded."); return; }
      const data = await res.json() as { route: { trackPoints?: Array<{ lat: number; lon: number }> | null; snapshot?: {trackPoints?:Array<{lat:number;lon:number}>} } };
      const pts = data.route.snapshot?.trackPoints ?? data.route.trackPoints ?? [];
      if (pts.length < 2) return;
      const points = pts.map(p => [p.lat, p.lon]);
      /* The same route the map is drawing is the one to be judged against.
         Taking it from here rather than re-fetching means the line on screen
         and the line in the alert can never disagree. */
      followedRouteRef.current = pts.map(q => ({ latitude: q.lat, longitude: q.lon }));
      recordingMapRef.current?.send({ type: "recPlanned", points });
    } catch { /* best-effort */ }
  }, [canonicalRouteIntent]);

  const followedRouteRef = useRef<Array<{ latitude: number; longitude: number }>>([]);
  const offRouteMemoryRef = useRef<OffRouteMemory>(initialOffRouteMemory());
  const [offRoute, setOffRoute] = useState<OffRouteReading | null>(null);
  const referenceRouteSentRef = useRef(false);
  const sendReferenceRouteToMap = useCallback(async () => {
    if (canonicalRouteIntent) return;
    const rid = params.referenceRouteId;
    if (!rid || referenceRouteSentRef.current) return;
    referenceRouteSentRef.current = true;
    await sendRouteOverlay(rid);
  }, [canonicalRouteIntent, params.referenceRouteId, sendRouteOverlay]);

  const canonicalRouteOverlaySentRef = useRef<string | null>(null);
  useEffect(() => {
    if (!mapReady || canonicalRouteIntent || !personalRoute.context) return;
    const msg = {
      type: "recPlanned",
      points: personalRoute.context.route.geometry.map(point => [point.lat, point.lng]),
      endLabel: "Finish",
    };
    recordingMapRef.current?.send(msg);
    if (statusRef.current === "idle") setRouteName(personalRoute.context.route.name);
    return () => {
      recordingMapRef.current?.send({ type: "recPlanned", points: [] });
    };
  }, [mapReady, mapRevision, canonicalRouteIntent, personalRoute.context]);
  useEffect(() => {
    if (!mapReady || !canonicalRouteIntent || !canonicalRouteContext) return;
    const handoffId = canonicalRouteContext.handoffId;
    if (canonicalRouteOverlaySentRef.current === handoffId) return;
    const points = canonicalRouteMapPoints(canonicalRouteContext.geometry.coordinates);
    if (points.length < 2) return;
    /* Judged against the same line the map is drawing, for the same reason as
       the community overlay: the alert and the picture must agree. */
    followedRouteRef.current = points.map(([latitude, longitude]) => ({ latitude, longitude }));
    try {
      if (!recordingMapRef.current) return;
      recordingMapRef.current.send({ type: "recPlanned", points });
      canonicalRouteOverlaySentRef.current = handoffId;
    } catch { /* map may not accept messages until its ready event */ }
  }, [mapReady, mapRevision, canonicalRouteIntent, canonicalRouteContext]);

  const handleRecordingMapReady = useCallback(() => {
    setMapReady(true);
    setMapRevision(revision => revision + 1);
    referenceRouteSentRef.current = false;
    canonicalRouteOverlaySentRef.current = null;
    void sendReferenceRouteToMap();
    const pos = initialPosRef.current;
    if (pos) sendLocateToMap(pos.lat, pos.lon);
    replayTrackOnMap();
  }, [sendReferenceRouteToMap, sendLocateToMap, replayTrackOnMap]);

  const sendRecordingInsets = useCallback(() => {
    const bottom = freeHikeReady && (!freeHikeOptionsOpen || freeHikeMapBusy)
      ? insets.bottom + 8 : recordingSheetHeight;
    recordingMapRef.current?.send({ type: "bottomInset", px: Math.ceil(bottom) });
    // The map viewport itself starts below the measured recording header.
    recordingMapRef.current?.send({ type: "topInset", px: 0 });
  }, [recordingSheetHeight, freeHikeReady, freeHikeOptionsOpen, freeHikeMapBusy, insets.bottom]);
  useEffect(() => {
    if (mapReady) sendRecordingInsets();
  }, [mapReady, mapRevision, sendRecordingInsets]);
  const handleRecordingMapMessage = useCallback((message: Record<string, unknown>) => {
    if (message.type === "needInsets" || message.type === "ready") sendRecordingInsets();
    if (!freeHikeReady) return;
    if (message.type === "drawingChanged") {
      setFreeHikeDrawing(message.on === true);
      if (message.on === true) setFreeHikeOptionsOpen(false);
    }
    if (message.type === "routeChanged") {
      setFreeHikeDraft(Array.isArray(message.anchors) && message.anchors.length > 0);
    }
    if (message.type === "summitCardOpened") {
      setFreeHikeSummitOpen(true);
      setFreeHikeOptionsOpen(false);
    }
    if (message.type === "summitCardClosed") setFreeHikeSummitOpen(false);
    if (message.type === "saveRequested") {
      recordingMapRef.current?.send({ type: "saveResult", ok: false });
      if (!userId) { Alert.alert("Sign in required", "Sign in before saving this route."); return; }
      void savePlannerDraft(userId, message.route).then(() =>
        router.push({ pathname: "/route-planner", params: { draftHandoff: "1" } } as never),
      ).catch(error => Alert.alert("Route not saved", error.message));
    }
    if (message.type === "openMountain" && typeof message.name === "string") {
      router.push({ pathname: "/mountain", params: {
        name: message.name, catalogueId: String(message.catalogueId ?? ""),
        region: String(message.region ?? ""), country: String(message.country ?? ""),
      }} as never);
    }
  }, [sendRecordingInsets, freeHikeReady, userId]);

  const fetchNearbyRoutes = useCallback(async () => {
    if (canonicalRouteIntent) return;
    const pos = initialPosRef.current;
    if (!pos) return;
    setNearbyLoading(true);
    setNearbyPickerOpen(true);
    try {
      const res = await fetch(`${API_BASE}/tracked-routes/nearby?lat=${pos.lat}&lng=${pos.lon}&radiusKm=5`);
      if (res.ok) {
        const data = await res.json() as { routes: NearbyRoute[] };
        setNearbyRoutes(data.routes ?? []);
      }
    } catch { /* ignore */ }
    setNearbyLoading(false);
  }, [canonicalRouteIntent]);

  // ── Sync background-collected GPS points into foreground state ────────────
  const syncBgPoints = useCallback(async (force = false) => {
    if (!force && statusRef.current !== "tracking") return;
    try {
      const keys = selectBatchKeys(await AsyncStorage.getAllKeys(), routeIdRef.current);
      if (keys.length === 0) return;
      const pairs = await AsyncStorage.multiGet(keys);
      const processedKeys: string[] = [];
      const batches = pairs.flatMap(([key, raw]) => {
        if (!raw) return [];
        try {
          const parsed = JSON.parse(raw) as PointBatch;
          processedKeys.push(key);
          return [parsed];
        } catch { return []; }
      });
      const newPts = flattenBatches(batches, routeIdRef.current);
      if (newPts.length === 0) {
        if (processedKeys.length > 0) await AsyncStorage.multiRemove(processedKeys);
        return;
      }
      const pts = trackPoints.current;
      const lastTs = pts.length > 0 ? pts[pts.length - 1].ts : 0;
      for (const point of newPts) {
        retainRawFix(point, "background", point.ts > lastTs &&
          isPlausiblePoint(point.lat, point.lon, point.ts, point.acc ?? null, pts));
      }
      const fresh = newPts.filter(p => p.ts > lastTs);
      let addedAny = false;
      for (const p of fresh) {
        if (!isPlausiblePoint(p.lat, p.lon, p.ts, p.acc ?? null, pts)) continue;
        if (p.speed != null && p.speed >= 0) setCurrentSpeedKmh(p.speed * 3.6);
        consumeAltitude(p.alt, p.ts, p.altAcc);
        if (pts.length > 0) {
          const prev = pts[pts.length - 1];
          const d = haversineKm(prev.lat, prev.lon, p.lat, p.lon);
          if (d > 0.003) setDistanceKm(km => (distanceRef.current = km + d));
        }
        pts.push({ ...p });
        addedAny = true;
      }
      // Replay the complete route on the map so any straight-line gap caused
      // by the foreground watcher firing before this sync is corrected.
      if (addedAny) replayTrackOnMap();
      // Immutable per-callback keys make this an exact acknowledgement: a
      // producer writing concurrently creates a different key and survives.
      // Never acknowledge the OS queue before its evidence is durable.
      if (await checkpointWriter.current()) await AsyncStorage.multiRemove(processedKeys);
    } catch {
      setCheckpointError("Background GPS evidence could not be saved. Keep the app open and retry the recovery checkpoint.");
    }
  }, [replayTrackOnMap]);
  const drainBgPoints = useCallback(async () => {
    // stopLocationUpdatesAsync prevents new callbacks, but a callback already
    // writing AsyncStorage may finish during the first snapshot. Re-snapshot
    // until the immutable queue has had multiple turns to become quiescent.
    for (let pass = 0; pass < 3; pass += 1) {
      await syncBgPoints(true);
      await new Promise<void>(resolve => setTimeout(resolve, 25));
    }
    await syncBgPoints(true);
  }, [syncBgPoints]);

  // ── Sync when app returns to foreground (e.g. from lock screen) ──────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") syncBgPoints();
    });
    return () => sub.remove();
  }, [syncBgPoints]);

  // ── Periodic sync while actively tracking (fills in real-time UI) ─────────
  useEffect(() => {
    if (status !== "tracking") return;
    const id = setInterval(syncBgPoints, 1000);
    return () => clearInterval(id);
  }, [status, syncBgPoints]);

  // ── Persist active hike session to disk (survives app kills) ─────────────
  // Saved every 15 s while tracking/paused so the session can be restored
  // if the OS terminates the process (screen off, memory pressure, etc.).
  const saveActiveSession = useCallback(async () => {
    if (statusRef.current !== "tracking" && statusRef.current !== "paused" && statusRef.current !== "finished") return true;
    try {
      const session: HikeCheckpoint = {
        version: 2,
        activityAudience: activityAudience ?? undefined,
        routeName,
        status: statusRef.current as "tracking" | "paused" | "finished",
        trackPoints: trackPoints.current,
        rawGPSFixes: rawGPSFixes.current,
        recordingEvents: recordingEvents.current,
        distanceKm: distanceRef.current,
        elevGainM: elevGainRef.current,
        elevLossM: elevLossRef.current,
        elevationFilter: elevationFilterRef.current,
        lastAltM: lastAltRef.current,
        currentAltM: currentAltRef.current,
        trackStartMs: trackStartMsRef.current,
        // Completed pauses only. The active pause has its own start timestamp,
        // preventing it from being counted twice during restoration.
        totalPausedMs: totalPausedMsRef.current,
        pauseStartMs: pauseStartMsRef.current,
        trackingMode: hillMeta.trackingMode,
        expeditionId: hillMeta.expeditionId,
        canonicalRouteHandoffId: canonicalRouteContext?.handoffId ?? params.routeHandoffId,
        canonicalRouteId: canonicalRouteContext?.routeId ?? params.canonicalRouteId,
        canonicalRouteIdentityKey: canonicalRouteContext?.routeIdentityKey ?? params.canonicalRouteIdentityKey,
        canonicalRouteVersion: canonicalRouteContext?.routeVersion ?? params.canonicalRouteVersion,
        canonicalMountainId: canonicalRouteContext?.mountainId ?? params.canonicalMountainId,
        personalRoute: personalRoute.context ?? undefined,
        recordingMountainId: recordingMountainIdRef.current,
        syncState: isOffline ? "queued" : "local_only",
        userId: userId ?? undefined,
        hillMeta: {
          sessionKey:          hillMeta.sessionKey,
          hillName:            hillMeta.hillName,
          targetReps:          hillMeta.targetReps,
          estimatedGainPerRep: hillMeta.estimatedGainPerRep,
          estimatedTotalGain:  hillMeta.estimatedTotalGain,
          trackingMode:        hillMeta.trackingMode,
          expeditionId:        hillMeta.expeditionId,
          routeIdentityKey:     hillMeta.routeIdentityKey,
          summitIdentityKey:    hillMeta.summitIdentityKey,
          objectiveType:        hillMeta.objectiveType,
          stageSnapshot:        stageSnapshotRef.current,
        },
        routeId: routeIdRef.current,
        savedAt: Date.now(),
      };
      const write = checkpointWriteRef.current.then(async () => {
        if (!isPersistableHikeStatus(statusRef.current)) return;
        await writeActiveHike(session);
      });
      checkpointWriteRef.current = write.catch(() => {});
      await write;
      setCheckpointError(null);
      return true;
    } catch {
      setCheckpointError("Recovery checkpoint could not be stored. Keep this screen open and retry; do not assume this hike can be recovered after closing the app.");
      return false;
    }
  }, [routeName, hillMeta.sessionKey, hillMeta.hillName, hillMeta.targetReps,
      hillMeta.estimatedGainPerRep, hillMeta.estimatedTotalGain, hillMeta.trackingMode,
      hillMeta.expeditionId, hillMeta.routeIdentityKey, hillMeta.summitIdentityKey,
      hillMeta.objectiveType, userId, isOffline, canonicalRouteContext,
      params.routeHandoffId, params.canonicalRouteId, params.canonicalRouteIdentityKey,
      params.canonicalRouteVersion, params.canonicalMountainId, personalRoute.context,activityAudience]);
  checkpointWriter.current = saveActiveSession;

  useEffect(() => {
    if (status !== "tracking" && status !== "paused" && status!=="finished") return;
    void saveActiveSession(); // snapshot immediately on status change
    const id = setInterval(saveActiveSession, 15_000);
    return () => clearInterval(id);
  }, [status, saveActiveSession]);

  // ── Restore hike session on mount ────────────────────────────────────────
  // Fires when: (a) app was killed mid-hike (params.restore="1"), or
  // (b) user navigated away while tracking and returned to this screen.
  // Reads persisted metadata + background GPS points and resumes seamlessly.
  useEffect(() => {
    if (!userId) {
      if (params.restore !== "1") setRestoreCheckpointPending(false);
      return;
    }
    const ownerUserId = userId;
    if (restoreAttempted.current) return;
    restoreAttempted.current = true;

    async function doRestore() {
      try {
        const session = await readActiveHike<HikeCheckpoint>(ownerUserId);
        if(session?.activityAudience && !audienceTouchedRef.current) setActivityAudience(session.activityAudience);
        if (!session) return;
        const ageMs = Date.now() - (session.savedAt ?? 0);
        if (ageMs > 24 * 60 * 60 * 1000) {
          // Stale — discard and let the user start fresh
          await discardActiveHike(session);
          return;
        }
        if (!shouldRestoreCheckpoint(session, {
          now: Date.now(),
          restoreRequested: params.restore === "1",
          requestedRouteId: params.routeId,
        })) {
          // A valid but different active hike must never overwrite a deliberate
          // new launch. Leave it intact for an explicit restore.
          return;
        }

        // Restore timer refs so elapsed time and syncBgPoints are accurate
        trackStartMsRef.current  = session.trackStartMs;
        totalPausedMsRef.current = session.totalPausedMs ?? 0;
        pauseStartMsRef.current  = session.status === "paused"
          ? (session.pauseStartMs || Date.now())
          : 0;
        trackPoints.current = session.trackPoints ?? [];
        rawGPSFixes.current = session.rawGPSFixes ?? [];
        rawFixKeys.current = new Set(rawGPSFixes.current.map(rawFixKey));
        recordingEvents.current = session.recordingEvents ?? [];
        distanceRef.current = session.distanceKm ?? 0;
        elevGainRef.current = session.elevGainM ?? 0;
        elevLossRef.current = session.elevLossM ?? 0;
        elevationFilterRef.current = session.elevationFilter ??
          createRecordedElevation(elevGainRef.current, elevLossRef.current);
        lastAltRef.current = session.lastAltM ?? null;
        currentAltRef.current = session.currentAltM ?? session.lastAltM ?? null;
        setDistanceKm(distanceRef.current);
        setElevGainM(elevGainRef.current);
        setElevLossM(elevLossRef.current);
        setCurrentAltM(currentAltRef.current);
        setElapsedSecs(checkpointElapsedSecs(session, Date.now()));

        // Restore route name (may differ from hillName for custom-named routes)
        if (session.routeName) setRouteName(session.routeName);
        recordingMountainIdRef.current = session.recordingMountainId;
        personalRoute.restore(session.personalRoute, ownerUserId);
        if (session.routeId) routeIdRef.current = session.routeId;
        if (session.canonicalRouteHandoffId && session.canonicalRouteId &&
            session.canonicalRouteIdentityKey && session.canonicalRouteVersion &&
            session.canonicalMountainId) {
          setRestoredCanonicalRouteIntent(true);
          setCanonicalRouteContextPending(true);
          setCanonicalRouteContextInvalid(false);
          const context = await readCanonicalRouteHandoff({
            ownerUserId,
            handoffId: session.canonicalRouteHandoffId,
            routeId: session.canonicalRouteId as `sde:route:${string}@${string}`,
            routeIdentityKey: session.canonicalRouteIdentityKey,
            routeVersion: session.canonicalRouteVersion,
            mountainId: session.canonicalMountainId as `sde:mountain:${string}`,
          });
          if (context) {
            setCanonicalRouteContext(context);
            setCanonicalRouteContextInvalid(false);
          } else {
            setCanonicalRouteContext(null);
            setCanonicalRouteContextInvalid(true);
          }
          setCanonicalRouteContextPending(false);
        }
        const savedHillMeta = session.hillMeta ?? {};
        const numberOrNull = (value: unknown): number | null =>
          typeof value === "number" && Number.isFinite(value) ? value : null;
        setRestoredHillMeta({
          sessionKey: typeof savedHillMeta.sessionKey === "string" ? savedHillMeta.sessionKey : null,
          hillName: typeof savedHillMeta.hillName === "string" ? savedHillMeta.hillName : null,
          targetReps: numberOrNull(savedHillMeta.targetReps),
          estimatedGainPerRep: numberOrNull(savedHillMeta.estimatedGainPerRep),
          estimatedTotalGain: numberOrNull(savedHillMeta.estimatedTotalGain),
        });
        if (savedHillMeta.stageSnapshot && typeof savedHillMeta.stageSnapshot === "object") {
          stageSnapshotRef.current = savedHillMeta.stageSnapshot as Record<string, unknown>;
        }
        if (session.trackingMode || session.expeditionId) {
          const restoredIdentity = typeof session.hillMeta?.routeIdentityKey === "string"
            ? session.hillMeta.routeIdentityKey.trim() || undefined
            : undefined;
          setExpeditionTracking(current => ({
            trackingMode: session.trackingMode ?? current.trackingMode,
            expeditionId: session.expeditionId ?? current.expeditionId,
            routeIdentityKey: restoredIdentity ?? current.routeIdentityKey,
            summitIdentityKey: typeof session.hillMeta?.summitIdentityKey === "string"
              ? session.hillMeta.summitIdentityKey : current.summitIdentityKey,
            objectiveType: session.hillMeta?.objectiveType === "manual_summit"
              ? "manual_summit" : current.objectiveType,
          }));
        }
        setNameLocked(true);

        // Set tracking status (required before syncBgPoints will run)
        const restoredStatus = session.status === "finished"
          ? "finished"
          : session.status === "paused" ? "paused" : "tracking";
        statusRef.current = restoredStatus;
        setStatus(restoredStatus);

        // Re-start the timestamp-based timer
        if (restoredStatus === "tracking") {
          timerRef.current = setInterval(() => {
            const elapsed = Math.floor(
              (Date.now() - trackStartMsRef.current - totalPausedMsRef.current) / 1000
            );
            setElapsedSecs(Math.max(0, elapsed));
          }, 1000);
        }

        if (restoredStatus === "finished") {
          setCompletionSaveStarted(true);
          return;
        }

        // Replay all GPS points the background task buffered while the app was
        // killed — this recovers distance, elevation gain/loss, and track shape
        await syncBgPoints(true);
        replayTrackOnMap();

        // Re-start GPS watchers so tracking continues going forward
        if (Platform.OS !== "web" && restoredStatus === "tracking") {
          const backgroundPermission = await Location.requestBackgroundPermissionsAsync().catch(() => null);
          backgroundAllowedRef.current = backgroundPermission?.status === "granted";
          try {
            const isRunning = await Location.hasStartedLocationUpdatesAsync(HIKE_LOCATION_TASK).catch(() => false);
            if (isRunning) await Location.stopLocationUpdatesAsync(HIKE_LOCATION_TASK).catch(() => {});
            if (backgroundAllowedRef.current) {
              await Location.startLocationUpdatesAsync(HIKE_LOCATION_TASK, LOCATION_UPDATES_CONFIG);
            }
          } catch { /* background task unavailable — fg watcher handles it */ }

          try {
            const fgSub = await Location.watchPositionAsync(
              { accuracy: Location.Accuracy.High, distanceInterval: 3, timeInterval: 2000 },
              (loc) => {
                if (statusRef.current !== "tracking") return;
                const { latitude, longitude, altitude, speed, accuracy } = loc.coords;
                const pts = trackPoints.current;
                retainRawFix({ lat: latitude, lon: longitude, alt: altitude, ts: loc.timestamp, acc: accuracy,
                  altAcc: loc.coords.altitudeAccuracy, speed }, "foreground",
                  isPlausiblePoint(latitude, longitude, loc.timestamp, accuracy, pts));
                if (!isPlausiblePoint(latitude, longitude, loc.timestamp, accuracy, pts)) return;
                if (speed != null && speed >= 0) setCurrentSpeedKmh(speed * 3.6);
                consumeAltitude(altitude, loc.timestamp, loc.coords.altitudeAccuracy);
                if (pts.length > 0) {
                  const prev = pts[pts.length - 1];
                  const d = haversineKm(prev.lat, prev.lon, latitude, longitude);
                  if (d > 0.003) setDistanceKm(km => (distanceRef.current = km + d));
                }
                pts.push({ lat: latitude, lon: longitude, alt: altitude, ts: loc.timestamp, acc: accuracy, altAcc: loc.coords.altitudeAccuracy });
                sendPointToMap(latitude, longitude);
                checkOffRoute(latitude, longitude, loc.coords.accuracy ?? null);
              },
            );
            locationSubRef.current = fgSub;
          } catch { /* foreground watch unavailable */ }
        }
      } catch { /* ignore — fall back to normal idle state */ }
      finally { setRestoreCheckpointPending(false); }
    }

    doRestore();
  }, [syncBgPoints, sendPointToMap, replayTrackOnMap, params.restore, params.routeId, userId]);

  useEffect(() => {
    restoreAttempted.current = false;
  }, [userId]);

  // ── Auto-expand drawer when tracking starts ───────────────────────────────
  useEffect(() => {
    if (status === "tracking") setDrawerOpen(true);
  }, [status]);

  // ── Core tracking logic ──────────────────────────────────────────────────

  const startTrackingImpl = useCallback(async () => {
    if (statusRef.current !== "idle") return;
    if (!personalRoute.ready) return;
    if (canonicalRouteIntent &&
        (canonicalRouteContextPending || canonicalRouteContextInvalid || !canonicalRouteContext ||
         !isCanonicalRouteHandoffFresh(canonicalRouteContext.savedAt))) {
      if (canonicalRouteContext && !isCanonicalRouteHandoffFresh(canonicalRouteContext.savedAt)) {
        setCanonicalRouteContext(null);
        setCanonicalRouteContextInvalid(true);
      }
      return;
    }
    const effectiveName = routeName.trim() || localActivityTitle();
    if (effectiveName !== routeName) setRouteName(effectiveName);
    setNameLocked(true);
    setNameError(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Commit the permanent client activity ID and initial checkpoint before
    // permissions, GPS fixes, map tiles, geocoding, or any server work.
    statusRef.current = "tracking";
    setStatus("tracking");
    trackStartMsRef.current = Date.now();
    recordingEvents.current.push({ type: "start", ts: trackStartMsRef.current });
    totalPausedMsRef.current = 0;
    if (!await saveActiveSession()) {
      Alert.alert("Cannot start safely", "This phone could not store the recording recovery checkpoint. Free up storage and try Start again.");
      statusRef.current = "idle";
      setStatus("idle");
      setNameLocked(false);
      return;
    }

    // Start the durable elapsed-time recording before any optional location
    // request. Denied/unavailable GPS must never stop a time-only hike.
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - trackStartMsRef.current - totalPausedMsRef.current) / 1000
      );
      setElapsedSecs(Math.max(0, elapsed));
    }, 1000);

    const snapshot = stageSnapshotRef.current;
    const start = snapshot && typeof snapshot === "object"
      ? {
          lat: Number(snapshot.startLat ?? snapshot.startLatitude ??
            (snapshot.startPoint as Record<string, unknown> | undefined)?.latitude),
          lon: Number(snapshot.startLng ?? snapshot.startLongitude ??
            (snapshot.startPoint as Record<string, unknown> | undefined)?.longitude),
        }
      : null;
    if (
      start && Number.isFinite(start.lat) && Number.isFinite(start.lon) &&
      initialPosRef.current &&
      haversineKm(initialPosRef.current.lat, initialPosRef.current.lon, start.lat, start.lon) > 1
    ) {
      Alert.alert(
        "You’re away from the expected start",
        "Tracking will continue. Check your route before setting off.",
      );
    }

    /* Background location, disclosure first. Google Play does not accept the
       system dialog on its own: the app has to say what it collects, that it
       keeps collecting while closed, and why, and wait to be told to go
       ahead. Going straight to the system prompt is what gets an app pulled. */
    if (Platform.OS !== "web") {
      const foregroundAllowed = await Location.getForegroundPermissionsAsync()
        .then(permission => permission.status === "granted")
        .catch(() => false);
      if (!foregroundAllowed) {
        setPermDenied(true);
        return;
      }
      const outcome = await requestBackgroundLocation({
        confirm: ({ title, message, agreeLabel, declineLabel }) =>
          new Promise<boolean>(resolve => {
            Alert.alert(title, message, [
              { text: declineLabel, style: "cancel", onPress: () => resolve(false) },
              { text: agreeLabel, onPress: () => resolve(true) },
            /* Dismissing without choosing is not agreement. */
            ], { cancelable: true, onDismiss: () => resolve(false) });
          }),
        request: () => Location.requestBackgroundPermissionsAsync(),
      });
      backgroundAllowedRef.current = outcome.granted;
      if (!outcome.granted) {
        Alert.alert(
          "Background tracking unavailable",
          outcome.declinedDisclosure
            ? "Your hike will be recorded while SummitReady is open. You can turn on background tracking later in your phone's settings."
            : "Your hike will still be recorded while SummitReady is open, but tracking may stop when the app is closed or the phone is locked.",
        );
      }
    }

    if (hillMeta.sessionKey) {
      void logHillSessionStarted({ hill_name: hillMeta.hillName ?? undefined });
    }

    /* Show where we are straight away, without making it the track's first
       point. This fix came from the warm-up, taken at Balanced accuracy to
       be quick rather than exact, and it is the one position that never goes
       through isPlausiblePoint. Drawn as a track point it put a 50–100 m
       error at the start of the line and then jumped to the first real fix —
       and because it is never pushed into trackPoints, the line on screen
       disagreed with the track that gets saved. */
    if (initialPosRef.current) {
      sendLocateToMap(initialPosRef.current.lat, initialPosRef.current.lon);
    }

    if (Platform.OS === "web") {
      return;
    }

    // Start background-capable location task (keeps running when screen is locked)
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(HIKE_LOCATION_TASK).catch(() => false);
      if (isRunning) await Location.stopLocationUpdatesAsync(HIKE_LOCATION_TASK).catch(() => {});
      if (backgroundAllowedRef.current) {
        await Location.startLocationUpdatesAsync(HIKE_LOCATION_TASK, LOCATION_UPDATES_CONFIG);
      }
    } catch { /* background task not available — foreground watch handles it */ }

    // Always run a foreground watch for real-time UI updates while app is active.
    // Background task handles lock-screen recording; this keeps map and stats live.
    try {
      const fgSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 3, timeInterval: 2000 },
        (loc) => {
          if (statusRef.current !== "tracking") return;
          const { latitude, longitude, altitude, speed, accuracy } = loc.coords;
          const pts = trackPoints.current;
          retainRawFix({ lat: latitude, lon: longitude, alt: altitude, ts: loc.timestamp, acc: accuracy,
            altAcc: loc.coords.altitudeAccuracy, speed }, "foreground",
            isPlausiblePoint(latitude, longitude, loc.timestamp, accuracy, pts));
          if (!isPlausiblePoint(latitude, longitude, loc.timestamp, accuracy, pts)) return;
          if (speed != null && speed >= 0) setCurrentSpeedKmh(speed * 3.6);
          consumeAltitude(altitude, loc.timestamp, loc.coords.altitudeAccuracy);
          if (pts.length > 0) {
            const prev = pts[pts.length - 1];
            const d = haversineKm(prev.lat, prev.lon, latitude, longitude);
            if (d > 0.003) setDistanceKm(km => (distanceRef.current = km + d));
          }
          pts.push({ lat: latitude, lon: longitude, alt: altitude, ts: loc.timestamp, acc: accuracy, altAcc: loc.coords.altitudeAccuracy });
          sendPointToMap(latitude, longitude);
          checkOffRoute(latitude, longitude, loc.coords.accuracy ?? null);
        },
      );
      locationSubRef.current = fgSub;
    } catch { /* foreground watch unavailable */ }
  }, [
    routeName,
    sendPointToMap,
    saveActiveSession,
    canonicalRouteIntent,
    canonicalRouteContextPending,
    canonicalRouteContextInvalid,
    canonicalRouteContext,
    canonicalRouteContext?.savedAt,
    personalRoute.ready,
  ]);
  const startTracking = useCallback(
    () => serialize(startTrackingImpl),
    [serialize, startTrackingImpl],
  );
  const autoStartAttempted = useRef(false);
  useEffect(() => {
    if (params.autoStart !== "1" || autoStartAttempted.current || !personalRoute.ready ||
        canonicalRouteContextPending || params.restore === "1") return;
    autoStartAttempted.current = true;
    void startTracking();
  }, [params.autoStart, params.restore, personalRoute.ready, canonicalRouteContextPending, startTracking]);

  const pauseTrackingImpl = useCallback(async () => {
    if (pauseTogglingRef.current) return;
    pauseTogglingRef.current = true;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const pausedAt = Date.now();
    recordingEvents.current.push({ type: "pause", ts: pausedAt });
    // Stop every producer first, then drain and acknowledge its exact batches.
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    safeRemoveSub(locationSubRef.current);
    locationSubRef.current = null;
    if (Platform.OS !== "web") {
      const started = await Location.hasStartedLocationUpdatesAsync(HIKE_LOCATION_TASK).catch(() => false);
      if (started) await Location.stopLocationUpdatesAsync(HIKE_LOCATION_TASK);
    }
    await drainBgPoints();
    pauseStartMsRef.current = pausedAt;
    statusRef.current = "paused";
    setStatus("paused");
    await saveActiveSession();
    pauseTogglingRef.current = false;
  }, [saveActiveSession, drainBgPoints]);
  const pauseTracking = useCallback(
    () => serialize(pauseTrackingImpl),
    [serialize, pauseTrackingImpl],
  );

  const resumeTrackingImpl = useCallback(async () => {
    if (pauseTogglingRef.current) return;
    pauseTogglingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Accumulate pause duration so elapsed stays accurate
    if (pauseStartMsRef.current > 0) {
      totalPausedMsRef.current += Date.now() - pauseStartMsRef.current;
      pauseStartMsRef.current = 0;
    }
    statusRef.current = "tracking";
    setStatus("tracking");
    // Never clear queue storage here: an OS callback may have landed after the
    recordingEvents.current.push({ type: "resume", ts: Date.now() });
    // pause drain. Merge it before producers resume.
    await drainBgPoints();

    elevationFilterRef.current = breakElevationContinuity(elevationFilterRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - trackStartMsRef.current - totalPausedMsRef.current) / 1000
      );
      setElapsedSecs(Math.max(0, elapsed));
    }, 1000);

    if (Platform.OS === "web") {
      await saveActiveSession();
      pauseTogglingRef.current = false;
      return;
    }

    try {
      if (backgroundAllowedRef.current) {
        await Location.startLocationUpdatesAsync(HIKE_LOCATION_TASK, LOCATION_UPDATES_CONFIG);
      }
    } catch { /* background task not available — foreground watch handles it */ }

    // Always run foreground watch for real-time updates
    try {
      const fgSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 3, timeInterval: 2000 },
        (loc) => {
          if (statusRef.current !== "tracking") return;
          const { latitude, longitude, altitude, speed, accuracy } = loc.coords;
          const pts = trackPoints.current;
          retainRawFix({ lat: latitude, lon: longitude, alt: altitude, ts: loc.timestamp, acc: accuracy,
            altAcc: loc.coords.altitudeAccuracy, speed }, "foreground",
            isPlausiblePoint(latitude, longitude, loc.timestamp, accuracy, pts));
          if (!isPlausiblePoint(latitude, longitude, loc.timestamp, accuracy, pts)) return;
          if (speed != null && speed >= 0) setCurrentSpeedKmh(speed * 3.6);
          consumeAltitude(altitude, loc.timestamp, loc.coords.altitudeAccuracy);
          if (pts.length > 0) {
            const prev = pts[pts.length - 1];
            const d = haversineKm(prev.lat, prev.lon, latitude, longitude);
            if (d > 0.003) setDistanceKm(km => (distanceRef.current = km + d));
          }
          pts.push({ lat: latitude, lon: longitude, alt: altitude, ts: loc.timestamp, acc: accuracy, altAcc: loc.coords.altitudeAccuracy });
          sendPointToMap(latitude, longitude);
          checkOffRoute(latitude, longitude, loc.coords.accuracy ?? null);
        },
      );
      locationSubRef.current = fgSub;
    } catch { /* foreground watch unavailable */ }
    pauseTogglingRef.current = false;
    await saveActiveSession();
  }, [sendPointToMap, saveActiveSession, drainBgPoints]);
  const resumeTracking = useCallback(
    () => serialize(resumeTrackingImpl),
    [serialize, resumeTrackingImpl],
  );

  const finishHikeImpl = useCallback(async () => {
    // Stop producers before the final drain so no callback can be lost.
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    safeRemoveSub(locationSubRef.current);
    locationSubRef.current = null;
    if (Platform.OS !== "web") {
      const started = await Location.hasStartedLocationUpdatesAsync(HIKE_LOCATION_TASK).catch(() => false);
      if (started) await Location.stopLocationUpdatesAsync(HIKE_LOCATION_TASK);
    }
    await drainBgPoints();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    statusRef.current = "finished";
    recordingEvents.current.push({ type: "finish", ts: Date.now() });
    setStatus("finished");
    // Keep a finished checkpoint until Save acknowledges the local activity and
    // any selected-stage consequence. This makes Finish crash-safe offline.
    await checkpointWriteRef.current;
    await saveActiveSession();
  }, [drainBgPoints, userId]);
  const finishHike = useCallback(
    () => serialize(finishHikeImpl),
    [serialize, finishHikeImpl],
  );

  const handleStopPress = useCallback(() => {
    setDrawerOpen(false);
    setConfirmFinish(true);
  }, []);

  const handleDiscard = useCallback(async () => {
    if (discardInFlightRef.current || saveInFlightRef.current) return;
    discardInFlightRef.current = true;
    setDiscarding(true);
    setDiscardError(null);
    await serialize(async () => {
      const previousStatus = statusRef.current;
      try {
        // Fence queued checkpoint writes before deleting the recovery record.
        // A late write must never recreate a hike the user just discarded.
        statusRef.current = "idle";
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        safeRemoveSub(locationSubRef.current);
        locationSubRef.current = null;
        backgroundedRef.current = false;
        await checkpointWriteRef.current;
        await discardActiveHike({ userId: userId ?? undefined, routeId: routeIdRef.current });
        if (userId) await clearPendingHikeSelection(userId);
        if (canonicalRouteContext) await clearCanonicalRouteHandoff(canonicalRouteContext);
        trackPoints.current = [];
        setConfirmFinish(false);
        // Restored hikes are often opened with replace(), with no back stack.
        // An explicit destination also prevents returning to a stale summary.
        router.replace(shellMode === "expedition" ? "/(expedition)/track" : "/(tabs)/explore");
      } catch (failure) {
        statusRef.current = previousStatus === "tracking" ? "paused" : previousStatus;
        setStatus(statusRef.current);
        setDiscardError(failure instanceof Error ? failure.message : "Could not discard this hike. Please try again.");
      } finally {
        discardInFlightRef.current = false;
        setDiscarding(false);
      }
    });
  }, [serialize, userId, shellMode, canonicalRouteContext]);

  // ── Save completed hike ──────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!activityAudience) {
      setAudienceError("Choose Public, Followers only, or Only me before saving.");
      Alert.alert("Choose an audience", "Your recording is still here. Select who may see it, then save.");
      return;
    }
    if (saveInFlightRef.current || discardInFlightRef.current) return;
    saveInFlightRef.current = true;
    setSaving(true);
    /* Cleared with the hike. A banner left standing would greet the next walk
       with a warning about a route nobody is on any more. */
    setOffRoute(null);
    offRouteMemoryRef.current = initialOffRouteMemory();
    const name     = routeName.trim() || "Tracked Hike";
    const distKm   = parseFloat(distanceKm.toFixed(2));
    const elevGain = Math.round(elevGainM);
    const elevLoss = Math.round(elevLossM);
    const firstPt  = trackPoints.current[0];
    const routeId  = routeIdRef.current;

    try {
      // 1 ── Always log the completed hike to the hike history
      await logExploreHike({
        audience: activityAudience,
        sharingIntentConfirmed: true,
        recordingDurationSeconds: elapsedSecs,
        elevationQuality: recordedHikeElevationQuality({trackPoints:trackPoints.current,rawGPSFixes:rawGPSFixes.current,recordingEvents:recordingEvents.current,recordingDurationSeconds:elapsedSecs}),
        name,
        date: new Date().toISOString(),
        distance: distKm,
        elevationGain: elevGain,
        elevationLoss: elevLoss,
        timeTaken: Math.round(elapsedSecs / 60),   // store in minutes
        notes: buildRecordedHikeNotes({
          trackPoints: trackPoints.current, distance: distKm, elevationGain: elevGain,
          elevationLoss: elevLoss, elapsedSecs,
        }),
        trackPoints: trackPoints.current,
        rawGPSFixes: rawGPSFixes.current,
        recordingEvents: recordingEvents.current,
        activityId: routeId,
        countsTowardTraining: false,
        expeditionId: hillMeta.expeditionId ?? undefined,
        canonicalRouteId: canonicalRouteContext?.routeId,
        canonicalRouteVersion: canonicalRouteContext?.routeVersion,
        canonicalRouteIdentityKey: canonicalRouteContext?.routeIdentityKey,
        canonicalMountainId: canonicalRouteContext?.mountainId ?? recordingMountainIdRef.current,
        syncState: isOffline ? "queued" : "local_only",
      });
      setCompletionSaveStarted(true);
      void logHikeTracked({ distance_km: distKm, elevation_gain: elevGain, duration_min: Math.round(elapsedSecs / 60) });

      // Close the GPS gap: if this hike was launched from a plan session,
      // automatically tick it as complete so the user doesn't have to go back manually.
      if (access.training && hillMeta.sessionKey) {
        const location = resolveTrainingSessionLocation(trainingPlan, hillMeta.sessionKey);
        if (location && !completedPlanSessions[hillMeta.sessionKey]) {
          await togglePlanSession(location.weekNumber, location.sessionIndex);
        }
      }

      // 2 ── Optionally log to the plan session log
      if (access.training && addToPlan && trainingPlan && trainingPlan.length > 0) {
        const currentWeek = trainingPlan.findIndex(w => !w.sessions?.every((ps: PlanSession) => ps.label === "")) ?? 0;
        await addSession({
          date: new Date().toISOString(),
          type: "cardio",
          distance: distKm,
          elevationGain: elevGain,
          duration: Math.round(elapsedSecs / 60),
          effort: 3,
          notes: `GPS tracked: ${name}. Elev loss: ${elevLoss} m.`,
          completed: true,
          weekNumber: Math.max(0, currentWeek),
          hillName: name,
          activityId: routeId,
          expeditionId: hillMeta.expeditionId ?? undefined,
        });
      }

      // 3 ── logExploreHike queued an owner-private snapshot of the actual
      // recording. Saving a hike is not consent to publish a community route.

      // 4 ── If this was launched from a hill training session, save hill session data
      if (hillMeta.hillName) {
        const hillSyncId = `hill-session:${routeId}`;
        const hillBody = {
          activityId: routeId,
          plannedHillName: hillMeta.hillName,
          plannedRouteName: name,
          trainingSessionId: hillMeta.sessionKey ?? undefined,
          targetReps: hillMeta.targetReps ?? undefined,
          estimatedGainPerRepM: hillMeta.estimatedGainPerRep ?? undefined,
          estimatedTotalGainM: hillMeta.estimatedTotalGain ?? undefined,
          recordedDistanceKm: distKm,
          recordedElevationGainM: elevGain,
          recordedDurationSeconds: elapsedSecs,
          rawGpsTrack: trackPoints.current,
        };
        if (userId) {
          await enqueueSyncPending(userId, {
            id: hillSyncId,
            kind: "hill-session",
            url: `${API_BASE}/hill-session/save-tracked`,
            method: "POST",
            body: hillBody,
          });
        }
        void logHillSessionCompleted({
          hill_name: hillMeta.hillName ?? undefined,
          elevation_gain: elevGain,
          source: "gps_tracked",
        });
      }

      if (userId && !isOffline) void retrySyncOutbox(userId, getToken);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Activity saved",
        "Your activity is saved on this phone. Open its details in You → Saved hikes to check or retry the private backup.",
      );
      // Free Hike: direct expedition credit without checking off stages
      if (hillMeta.trackingMode === "freehike" && hillMeta.expeditionId) {
        const exp = expeditions.find(e => e.id === hillMeta.expeditionId);
        const prevProg = exp?.virtualHikeProgress ?? { elevationGained: 0, distanceCovered: 0, hikesLogged: 0 };
        const creditedHikeIds = prevProg.creditedHikeIds ?? [];
        if (!creditedHikeIds.includes(routeId)) {
          await patchExpedition(hillMeta.expeditionId, {
            virtualHikeProgress: {
              elevationGained: prevProg.elevationGained + elevGain,
              distanceCovered: prevProg.distanceCovered + distKm,
              hikesLogged: prevProg.hikesLogged + 1,
              creditedHikeIds: [...creditedHikeIds, routeId],
            },
          });
        }
        if (canonicalRouteContext) await clearCanonicalRouteHandoff(canonicalRouteContext);
        await clearActiveHike(userId ?? undefined);
        router.replace("/(tabs)/hikes" as any);
      } else if (hillMeta.trackingMode === "expedition-route" && trackedExpedition) {
        // In expedition mode ask "Did you complete this route?" before leaving.
        setShowExpeditionPrompt(true);
      } else {
        // In training mode navigate straight to hike history as before.
        if (canonicalRouteContext) await clearCanonicalRouteHandoff(canonicalRouteContext);
        await clearActiveHike(userId ?? undefined);
        router.replace("/(tabs)/hikes" as any);
      }
    } catch {
      saveInFlightRef.current = false;
      setSaving(false);
      Alert.alert("Hike save needs attention", "Your recording has been kept. Something prevented saving or syncing from finishing. Please try Save again; it will not duplicate your hike.");
    }
  }, [access.training, addToPlan, routeName, distanceKm, elevGainM, elevLossM, elapsedSecs, trainingPlan,
       addSession, logExploreHike, activeExpeditionId, trackedExpedition, hillMeta, expeditions, patchExpedition, getToken, userId, selectedCanonical, isOffline, canonicalRouteContext, activityAudience]);

  const stage8Credit = elevationBankQuery.data?.status === "available"
    ? findElevationBankCreditForActivity(elevationBankQuery.data.recentCredits, routeIdRef.current)
    : undefined;
  const stage8EvidenceId = stage8Credit
    ? `elevation-bank:${stage8Credit.activityId}`
    : null;
  const stage8CurrentConsequence = stage8EvidenceId &&
    stage8LastConsequence?.evidenceId === stage8EvidenceId &&
    stage8LastConsequence.status === "confirmed"
    ? stage8LastConsequence
    : null;
  const completionPresentation = buildActivityCompletionPresentation({
    activityId: routeIdRef.current,
    title: routeName,
    distanceKm,
    ascentM: Math.round(elevGainM),
    durationSecs: elapsedSecs,
    trackingMode: hillMeta.trackingMode,
    trainingSessionKey: hillMeta.sessionKey,
    expeditionId: hillMeta.expeditionId,
    expeditionStageName: hillMeta.hillName,
    isOffline,
    elevationBank: elevationBankQuery.data,
    expeditionProgress: selectExpeditionPresentation(
      completionExpedition ?? trackedExpedition,
      isOffline ? "offline" : "ready",
    ),
    challengeAchievement: stage8CurrentConsequence
      ? {
          status: "confirmed",
          challengeTitles: stage8CurrentConsequence.challengeTitles,
          achievementTitles: stage8CurrentConsequence.achievementTitles,
        }
      : isOffline
      ? { status: "pending", reason: "Saved locally; challenge and achievement qualification will wait for sync." }
      : { status: "unavailable", reason: "Challenge and achievement qualification is not confirmed yet." },
  });

  // ── Render: finished summary ─────────────────────────────────────────────
  if (status === "finished") {
    return (
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          {checkpointError ? <Text accessibilityRole="alert" style={s.msgBody}>{checkpointError}</Text> : null}
          <Text style={s.msgBody}>{recordedHikeElevationQuality({trackPoints:trackPoints.current,rawGPSFixes:rawGPSFixes.current,recordingEvents:recordingEvents.current,recordingDurationSeconds:elapsedSecs}).label}</Text>
          <ActivityAudiencePicker audience={activityAudience} onChange={chooseAudience} error={audienceError} />
          <ActivityCompleteView
            completionPresentation={completionPresentation}
            recordedPoints={trackPoints.current}
            elevGainM={elevGainM}
            elevLossM={elevLossM}
            distanceKm={distanceKm}
            elapsedSecs={elapsedSecs}
            currentAltM={currentAltM ?? null}
            fmtM={fmtM}
            fmtKm={fmtKm}
            formatTime={formatTime}
            trainingPlan={access.training ? trainingPlan : []}
            addToPlan={addToPlan}
            setAddToPlan={setAddToPlan}
            saving={saving}
            savedLocally={exploreHikes.some(hike => hike.activityId === routeIdRef.current)}
            discarding={discarding}
            discardError={discardError}
            onSave={handleSave}
            onDiscard={handleDiscard}
          />

          {/* GPS fails quietly: the clock keeps running and the track does
              not. Saving looks identical either way, so a hike that was not
              captured has to say so here, where the person is looking, and
              offer the way out with what it does know already filled in —
              the elapsed time is reliable even when nothing else is. */}
          {(() => {
            const note = recordingFailureNote({
              pointCount: trackPoints.current.length,
              distanceKm,
              elapsedSecs,
            });
            if (!note) return null;
            return (
              <View style={s.failedRecording} testID="recording-failed-note">
                <Text style={s.failedRecordingText}>{note}</Text>
                <TouchableOpacity
                  onPress={() => setLogByHandOpen(true)}
                  style={s.failedRecordingBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Enter this hike by hand"
                  testID="recording-log-by-hand"
                >
                  <Text style={s.failedRecordingBtnText}>Enter it by hand</Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </ScrollView>

        <LogHikeModal
          visible={logByHandOpen}
          onClose={() => setLogByHandOpen(false)}
          prefillName={routeName || hillMeta.hillName || ""}
          /* Only offered as a starting point where it is worth anything.
             Zero distance prefilled as zero is a worse default than the
             form's own. */
          prefillDistance={distanceKm > 0 ? Number(distanceKm.toFixed(1)) : undefined}
          prefillElevation={elevGainM > 0 ? Math.round(elevGainM) : undefined}
          /* The clock does not depend on GPS, so this one is trustworthy. */
          prefillTimeTaken={elapsedSecs > 0 ? Math.max(1, Math.round(elapsedSecs / 60)) : undefined}
          reason="The recorded track looks incomplete. Check these against what you actually walked."
        />

        {/* ── Expedition route completion prompt ─────────────────────────── */}
        {showExpeditionPrompt && !!trackedExpedition && (
          <Modal transparent animationType="fade" visible>
            <View style={s.promptOverlay}>
              <Animated.View entering={FadeInUp.duration(350)} style={s.promptCard}>
                <LinearGradient
                  colors={["rgba(62,207,117,0.10)", "transparent"]}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={s.promptEmo}>⛰️</Text>
                <Text style={s.promptTitle}>Route completed?</Text>
                <Text style={s.promptRoute} numberOfLines={2}>
                  {/* Show the next incomplete expedition hill (what they should have been doing) */}
                  {hillMeta.hillName ?? routeName}
                </Text>

                <TouchableOpacity
                  style={s.promptYes}
                  activeOpacity={0.85}
                  onPress={async () => {
                    const expId = hillMeta.expeditionId;
                    if (!expId || !trackedExpedition) return;
                    const contribution = applyExpeditionStageContribution(trackedExpedition, {
                      activityId: routeIdRef.current,
                      routeIdentityKey: hillMeta.routeIdentityKey,
                      summitIdentityKey: hillMeta.summitIdentityKey,
                      stageName: hillMeta.hillName ?? routeName,
                    });
                    await patchExpedition(expId, {
                      completedRoutes: contribution.completedRoutes,
                      virtualHikeProgress: contribution.virtualHikeProgress,
                    });
                    setCompletionExpedition({
                      ...trackedExpedition,
                      completedRoutes: contribution.completedRoutes,
                      virtualHikeProgress: contribution.virtualHikeProgress,
                    });
                    if (userId) await clearPendingHikeSelection(userId);
                    if (canonicalRouteContext) await clearCanonicalRouteHandoff(canonicalRouteContext);
                    await clearActiveHike(userId ?? undefined);
                    const isFinished = contribution.completedRoutes.length > 0 &&
                      (selectExpeditionPresentation({
                        ...trackedExpedition,
                        completedRoutes: contribution.completedRoutes,
                        virtualHikeProgress: contribution.virtualHikeProgress,
                      }).progress.isComplete);
                    // Basecamp owns the protected 100% summit → cinematic →
                    // completion sequence. Never bypass it from tracking.
                    router.replace("/(expedition)/base-camp" as any);
                  }}
                >
                  <LinearGradient
                    colors={[T.green, "#2AB860"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={s.promptYesGrad}
                  >
                    <Text style={s.promptYesText}>Yes — mark it complete ✓</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.promptNo}
                  activeOpacity={0.7}
                  onPress={() => router.replace("/(expedition)/base-camp" as any)}
                >
                  <Text style={s.promptNoText}>Not quite — back to expedition</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Modal>
        )}
      </View>
    );
  }

  // ── Render: tracking / idle ──────────────────────────────────────────────
  const isTracking = status === "tracking";
  const isPaused   = status === "paused";
  const isIdle     = status === "idle";
  /* Shown only for an expedition stage that actually has a mountain behind
     it, and only once recording has begun. */
  /* A session set in metres of ascent. Null when there is no target to
     measure against, in which case nothing is shown rather than a bar
     filling towards zero. */
  const trainingTargetM = hillMeta.sessionKey
    && typeof hillMeta.estimatedTotalGain === "number"
    && Number.isFinite(hillMeta.estimatedTotalGain)
    && hillMeta.estimatedTotalGain > 0
      ? hillMeta.estimatedTotalGain
      : null;
  const showProgressSwitch = !isIdle
    && hillMeta.trackingMode === "expedition-route"
    && !!trackedExpedition;
  const canonicalContextFresh = !!canonicalRouteContext &&
    isCanonicalRouteHandoffFresh(canonicalRouteContext.savedAt);
  const canStart = !canonicalRouteIntent ||
    (!canonicalRouteContextPending && !canonicalRouteContextInvalid && canonicalContextFresh);

  return (
    <View style={s.root}>
      {permDenied && (
        <View style={{ position: "absolute", top: insets.top + 52, left: 12, right: 12, zIndex: 8, padding: 12, borderRadius: 10, backgroundColor: T.card }} testID="recording-without-gps">
          <Text style={{ color: T.text, fontSize: 13 }}>Location off — recording time only. No GPS track or measured distance/ascent. You can add your stats by hand when you finish.</Text>
          {Platform.OS !== "web" && <TouchableOpacity onPress={() => Linking.openSettings()} accessibilityRole="button" accessibilityLabel="Open location settings">
            <Text style={{ color: T.green, paddingTop: 8 }}>Location settings (optional)</Text>
          </TouchableOpacity>}
        </View>
      )}

      {/* Keep the map controls below the host header and device safe area.
          This changes layout, not the map URL or recording lifecycle. */}
      <View
        style={[StyleSheet.absoluteFill, { top: mapTopInset }]}
        testID="recording-map-viewport"
      >
        {restoreCheckpointPending ? (
            <View style={{ flex: 1, backgroundColor: "#08111f" }} />
          ) : (
            <TrackMap
              recording={!freeHikeReady || freeHikeOptionsOpen}
              mapRef={recordingMapRef}
              onReady={handleRecordingMapReady}
              onMessage={handleRecordingMapMessage}
            />
        )}
      </View>

      {/* ── Top gradient for header readability ── */}
      <LinearGradient
        colors={["rgba(5,13,26,0.90)", "rgba(5,13,26,0.0)"]}
        pointerEvents="none"
        style={[s.topGradient, { height: mapTopInset }]}
      />

      {/* Only the back button takes touches; the title and GPS are labels. */}
      <View
        style={[s.header, { paddingTop: insets.top + 12 }]}
        pointerEvents="box-none"
        onLayout={event => setHeaderHeight(Math.ceil(event.nativeEvent.layout.height))}
        testID="recording-header"
      >
        <TouchableOpacity
          onPress={() => {
            if (isTracking || isPaused) {
              backgroundedRef.current = true; // keep bg task alive
            }
            router.back();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={22} color={T.text} />
        </TouchableOpacity>

        <View style={s.headerTitleContainer} pointerEvents="none">
          <Text style={s.headerTitle} numberOfLines={1}>
            {nameLocked && routeName ? routeName : hillMeta.trackingMode === "freehike" ? "Start Free Hike" : "Start Hiking"}
          </Text>
          {hillMeta.trackingMode === "freehike" && nameLocked && (
            <Text style={s.headerSubtitle}>Free hike</Text>
          )}
        </View>

        <View style={[s.gpsPill, gpsReady && s.gpsPillReady]} pointerEvents="none">
          <Animated.View style={[s.gpsDot, isTracking && pulseStyle]} />
          <Text style={[s.gpsText, gpsReady && s.gpsTextReady]}>
            {gpsReady ? "GPS" : "…"}
          </Text>
        </View>
      </View>

      {isOffline && !isIdle && (
        <View style={[s.offlineBanner, { top: insets.top + 68 }]} pointerEvents="none">
          <WifiOff size={13} color={T.orange} />
          <Text style={s.offlineBannerText}>Offline — activity saved on this device</Text>
        </View>
      )}

      {/* Where they are relative to the route, and nothing about which way to
          walk. The straight line back to a path can cross a crag, and this
          cannot see one. Sits below the offline banner so two warnings stack
          rather than cover each other. */}
      {offRoute?.message && !isIdle && (
        <View style={[s.offRouteBanner, { top: insets.top + (isOffline ? 108 : 68) }]}>
          <MapPin size={13} color={T.red} />
          <Text style={s.offRouteBannerText}>{offRoute.message}</Text>
        </View>
      )}

      {/* ── Route name card — floats over map, only visible when idle ── */}
      {isIdle && (!freeHikeReady || freeHikeOptionsOpen) && !freeHikeMapBusy && (
        <Animated.View
          entering={FadeInDown.delay(50).duration(400)}
          style={[s.nameOverlay, { top: insets.top + 70 }]}
        >
          {freeHikeReady ? (
            <TouchableOpacity onPress={() => setFreeHikeOptionsOpen(false)}
              accessibilityRole="button" accessibilityLabel="Close hike options">
              <Text style={[s.nameLabel, { color: T.green, paddingBottom: 10 }]}>Back to map</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={s.nameLabel}>Activity title</Text>
          <TextInput
            style={[s.nameInput, nameError && s.nameInputError]}
            value={routeName}
            onChangeText={(t) => { setRouteName(t); if (t.trim()) setNameError(false); }}
            placeholder="e.g. Morning Ridge Loop"
            placeholderTextColor={T.textDim}
            autoCorrect={false}
            returnKeyType="done"
            maxLength={60}
          />
          {nameError ? (
            <Text style={s.nameErrorText}>Please name your route before starting</Text>
          ) : (
            <Text style={s.nameHintText}>Optional — you can start without it and rename later.</Text>
          )}

          {!canonicalRouteIntent ? (
            <>
              {/* ── Nearby community route picker ── */}
              <View style={s.orRow}>
                <View style={s.orLine} /><Text style={s.orText}>or</Text><View style={s.orLine} />
              </View>
              <TouchableOpacity
                style={[s.nearbyBtn, selectedCanonical && s.nearbyBtnSelected]}
                onPress={fetchNearbyRoutes}
                activeOpacity={0.8}
              >
                <MapPin size={14} color={selectedCanonical ? BASECAMP.accent : BASECAMP.textMuted} />
                <Text style={[s.nearbyBtnText, selectedCanonical && { color: BASECAMP.accent }]}>
                  {selectedCanonical ? `Following: ${selectedCanonical.name}` : "Pick a nearby route"}
                </Text>
                {selectedCanonical
                  ? <CheckCircle size={14} color={BASECAMP.accent} />
                  : <ChevronRight size={14} color={BASECAMP.textDim} />
                }
              </TouchableOpacity>
            </>
          ) : null}
        </Animated.View>
      )}

      {/* ── Map / Progress, for an expedition stage ──
             Only where there is a mountain to show. A switch with one
             meaningful side is a switch that teaches people to ignore it. */}
      {showProgressSwitch && (
        <View style={[s.panelSwitch, { top: insets.top + 62 }]} pointerEvents="box-none">
          <View style={s.panelSwitchInner}>
            {(["map", "progress"] as const).map(option => (
              <TouchableOpacity
                key={option}
                onPress={() => setPanel(option)}
                style={[s.panelTab, panel === option && s.panelTabOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: panel === option }}
                accessibilityLabel={option === "map" ? "Show the map" : "Show expedition progress"}
                testID={`track-panel-${option}`}
              >
                <Text style={[s.panelTabText, panel === option && s.panelTabTextOn]}>
                  {option === "map" ? "Map" : "Progress"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* A training session's target, where the expedition mountain would be.
             Ascent, because that is what a session is set in and what the
             recorder measures against it. */}
      {!isIdle && trainingTargetM ? (
        <View style={[s.trainingTarget, { top: insets.top + 62 }]} pointerEvents="none">
          <Text style={s.trainingTargetLabel} numberOfLines={1}>
            {hillMeta.hillName ?? "Training session"}
          </Text>
          <View style={s.trainingBar}>
            <View
              style={[s.trainingFill, {
                width: `${Math.min(100, Math.round((elevGainM / trainingTargetM) * 100))}%`,
              }]}
            />
          </View>
          <Text style={s.trainingTargetMeta}>
            {elevGainM >= trainingTargetM
              ? `${fmtM(elevGainM)} of ${fmtM(trainingTargetM)} target · reached`
              : `${fmtM(elevGainM)} of ${fmtM(trainingTargetM)} target`}
          </Text>
        </View>
      ) : null}

      {showProgressSwitch && panel === "progress" && (
        <View style={[s.progressSheet, { top: insets.top + 110 }]}>
          <TrackProgressPanel expedition={trackedExpedition} recordedGainM={elevGainM} />
        </View>
      )}

      {/* ── Bottom sheet ── */}
      {freeHikeReady && !freeHikeOptionsOpen && !freeHikeMapBusy ? (
        <FreeHikeLaunchControls bottomInset={insets.bottom} gpsReady={gpsReady}
          offline={isOffline} disabled={!canStart || !personalRoute.ready}
          onOptions={() => setFreeHikeOptionsOpen(true)} onStart={startTracking} />
      ) : null}

      <View style={[s.sheet, { paddingBottom: insets.bottom + 12 },
        freeHikeReady && (!freeHikeOptionsOpen || freeHikeMapBusy) && { display: "none" }]}
        onLayout={event => setRecordingSheetHeight(Math.ceil(event.nativeEvent.layout.height))}>

        {/* Drag handle — tapping toggles drawer when tracking */}
        <TouchableOpacity
          onPress={() => !isIdle && setDrawerOpen(o => !o)}
          activeOpacity={isIdle ? 1 : 0.7}
          style={s.sheetHandleArea}
        >
          <View style={s.handle} />

          {/* One line, always visible. The elapsed time lives here and only
              here: it was also the third figure in the row below, and a clock
              printed twice on one card is what made the sheet shout.

              Closed, the line carries distance and ascent as well, so a shut
              sheet still answers the two questions worth asking mid-walk
              without opening anything. Open, they are dropped, because the
              row beneath states them properly. */}
          {!isIdle && (
            <View style={s.sheetStatusRow}>
              <View style={[s.recDot, isPaused && s.recDotPaused]} />
              <Text
                style={[s.recState, isPaused && { color: T.orange }]}
                accessibilityLiveRegion="polite"
              >
                {isTracking ? "REC" : "PAUSED"}
              </Text>
              <Text
                style={s.timerHero}
                accessibilityLabel={`Time ${formatTime(elapsedSecs)}`}
              >
                {formatTime(elapsedSecs)}
              </Text>
              {drawerOpen ? (
                <View style={s.statusSpacer} />
              ) : (
                <Text style={s.collapsedSummary} numberOfLines={1}>
                  {`${fmtKm(distanceKm)} · ${fmtM(elevGainM)}`}
                </Text>
              )}
              <Text style={s.chevron}>{drawerOpen ? "⌄" : "⌃"}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Track Ready: what you are about to record, then the state of
               the device, then Start. GPS and network are reported as
               information only — neither ever disables the button. ── */}
        {isIdle && (
          <View style={s.sheetBody}>
            {(() => {
              /* The selected canonical route remains authoritative over an
                 optional nearby/community route in the ready summary. */
              const brief = readyBrief({
                hillName: canonicalRouteContext?.mountainName ?? hillMeta.hillName,
                routeName: canonicalRouteContext?.routeName
                  ?? personalRoute.context?.route.name
                  ?? params.canonicalRouteName
                  ?? selectedCanonical?.name
                  ?? params.referenceRouteName ?? null,
                activityTitle: routeName === defaultTitleRef.current ? null : routeName,
                sessionLabel: null,
              });
              return (
                <View style={s.readyContext}>
                  <Text style={s.readyContextEyebrow}>RECORDING</Text>
                  <Text style={s.readyContextTitle} numberOfLines={2}>{brief.what}</Text>
                  <View style={s.readyWhereRow}>
                    <MapPin size={12} color={brief.isOpenGround ? T.textDim : BASECAMP.accent} />
                    <Text
                      style={[s.readyContextSub, brief.isOpenGround && { color: T.textDim }]}
                      numberOfLines={1}
                    >
                      {brief.where}
                    </Text>
                  </View>
                  {canonicalRouteContext?.startLabel ? (
                    <Text style={s.readyContextSub} numberOfLines={1}>
                      {`Route start · ${canonicalRouteContext.startLabel}`}
                    </Text>
                  ) : null}
                  {typeof canonicalRouteContext?.startElevationM === "number" &&
                    Number.isFinite(canonicalRouteContext.startElevationM) ? (
                    <Text style={s.readyContextSub} numberOfLines={1}>
                      {`Route start elevation · ${fmtM(canonicalRouteContext.startElevationM)}`}
                    </Text>
                  ) : null}
                </View>
              );
            })()}
            {canonicalRouteIntent && (
              canonicalRouteContextPending || canonicalRouteContextInvalid || !canonicalContextFresh
            ) ? (
              <Text style={[s.readyAssurance, { color: T.orange }]}>
                {canonicalRouteContextPending
                  ? "Getting the route ready on this device. Start will be available in a moment."
                  : "The route details could not be loaded, or have expired. Go back and choose the route again so this hike is recorded against it."}
              </Text>
            ) : null}
            {canonicalRouteIntent && !canonicalRouteContextPending &&
              (canonicalRouteContextInvalid || !canonicalContextFresh) ? (
              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
                <Text style={[s.readyAssurance, { color: T.green }]}>Choose the route again</Text>
              </TouchableOpacity>
            ) : null}

            {personalRoute.id ? (
              <View testID="personal-route-tracking-context">
                <Text style={s.readyAssurance}>
                  {personalRoute.context
                    ? `Following your saved route · ${describeRoute(personalRoute.context.route)}. The orange line is your plan; recording uses actual GPS.`
                    : personalRoute.error
                      ? `Could not load your saved route: ${personalRoute.error}`
                      : "Preparing your saved route on this device…"}
                </Text>
                {personalRoute.error ? (
                  <TouchableOpacity onPress={personalRoute.retry} accessibilityRole="button"
                    accessibilityLabel="Retry saved route for tracking">
                    <Text style={[s.readyAssurance, { color: T.green }]}>Try again</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {/* Device state, reported side by side. */}
            <View style={s.readyStateRow}>
              <View style={s.readyStateItem}>
                {gpsReady ? <Wifi size={13} color={T.green} /> : <WifiOff size={13} color={T.textMuted} />}
                <Text style={[s.readyStateText, gpsReady && { color: "rgba(62,207,117,0.85)" }]} numberOfLines={1}>
                  {gpsReady ? "GPS ready" : "Finding GPS"}
                </Text>
              </View>
              <View style={s.readyStateDivider} />
              <View style={s.readyStateItem}>
                {isOffline ? <WifiOff size={13} color={T.orange} /> : <Wifi size={13} color={T.green} />}
                <Text style={[s.readyStateText, isOffline && { color: "rgba(255,144,48,0.9)" }]} numberOfLines={1}>
                  {isOffline ? "Offline" : "Online"}
                </Text>
              </View>
            </View>

            {/* The reassurance that matters most on this screen. */}
            <Text style={s.readyAssurance}>
              {offlineNotice(isOffline, "idle")
                ?? "Recording starts immediately and saves to this device — no signal needed."}
            </Text>
            <TouchableOpacity
              style={[s.startBtn, (!canStart || !personalRoute.ready) && { opacity: 0.45 }]}
              onPress={startTracking}
              disabled={!canStart || !personalRoute.ready}
              accessibilityRole="button"
              accessibilityLabel="Start tracking"
              testID="start-hike-tracking"
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[BASECAMP.accent, "#15C486"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.startBtnGrad}
              >
                <Play size={20} color={BASECAMP.accentInk} fill={BASECAMP.accentInk} />
                <Text style={s.startBtnText}>
                  Start Tracking
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Tracking / paused: full stats + controls (collapsible) ── */}
        {!isIdle && drawerOpen && (
          <Animated.View entering={FadeIn.duration(200)} style={s.sheetBody}>

            {/* The dot and REC/PAUSED in the header above already say what
                state the recording is in, and stay visible when the drawer is
                closed. This row only appears when it has something they
                cannot say. */}
            {isOffline && (
              <View style={s.trackStatusRow}>
                <View
                  style={[
                    s.trackStatusPill,
                    { borderColor: `${T.orange}66`, backgroundColor: `${T.orange}1F` },
                  ]}
                >
                  <WifiOff size={11} color={T.orange} />
                  <Text style={[s.trackStatusText, { color: T.orange }]} numberOfLines={1}>
                    {statusLabel(status, isOffline)}
                  </Text>
                </View>
              </View>
            )}
            {offlineNotice(isOffline, status) ? (
              <Text style={s.trackOfflineNote}>{offlineNotice(isOffline, status)}</Text>
            ) : null}

            {checkpointError ? <Text accessibilityRole="alert" style={s.trackOfflineNote}>{checkpointError}</Text> : null}
            {checkpointError ? <TouchableOpacity accessibilityRole="button" style={{minHeight:44,padding:8}}
              onPress={()=>void saveActiveSession()}><Text style={s.trackOfflineNote}>Retry recovery checkpoint</Text></TouchableOpacity> : null}
            <Text style={s.trackOfflineNote}>{recordedHikeElevationQuality({trackPoints:trackPoints.current,rawGPSFixes:rawGPSFixes.current,recordingEvents:recordingEvents.current,recordingDurationSeconds:elapsedSecs}).label}</Text>
            {/* The three read at arm's length, in gloves, in rain. Figure
                large, unit small beneath it — the arrangement every walking
                recorder uses, because the number is what is being read and
                the unit only confirms it.

                No colour on any of them. Green ascent and orange descent made
                two ordinary measurements look like warnings; colour on this
                screen now means state (recording, paused, finish) and nothing
                else.

                Pace replaces the clock here, which has moved up to the header
                row. "Time", not "Moving time", applied there too: the clock
                runs whenever the recording is not paused, pausing is done by
                hand, and nothing detects a stop. */}
            <View style={s.metricRow}>
              {([
                { ...splitDistance(distanceKm), label: "Distance" },
                { ...splitMetres(elevGainM),    label: "Ascent" },
                { ...splitPace(paceMinPerKm(distanceKm, elapsedSecs)), label: "Avg pace" },
              ] as const).map(metric => (
                <View key={metric.label} style={s.metricCell}>
                  <Text
                    style={s.metricValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    accessibilityLabel={`${metric.label} ${metric.value} ${metric.unit}`}
                  >
                    {metric.value}
                  </Text>
                  <Text style={s.metricUnit}>{`${metric.label} · ${metric.unit}`}</Text>
                </View>
              ))}
            </View>

            {/* The ground so far. Altitude against time, drawn only once there
                are enough readings to show a shape — before that this is
                absent rather than an empty box, which is what keeps the sheet
                short at the moment you press Start.

                Altitude and descent are printed beside it because neither can
                be read off the curve: a walk that drops into a col and
                re-climbs accumulates descent the line cannot show. */}
            {trackPoints.current.length > 0 ? (
              <View style={s.profileBlock}>
                {/* Read straight from the recorder's own points, which the
                    one-second clock above re-renders. No second copy of the
                    track is kept for drawing. */}
                <RecordingElevationSpark
                  samples={trackPoints.current}
                  paused={isPaused}
                  testID="track-elevation-spark"
                />
                <View style={s.profileFootRow}>
                  <Text style={s.profileFoot}>
                    {currentAltM != null ? `${fmtM(currentAltM)} altitude` : "Altitude —"}
                  </Text>
                  <Text style={s.profileFoot}>{`${fmtM(elevLossM)} descended`}</Text>
                </View>
              </View>
            ) : null}

            {/* Finishing takes two deliberate steps: pause, then finish, then
                confirm. A single Finish beside Pause on a wet screen in a
                pocket ends the recording of a six-hour day. */}
            <View style={s.controls}>
              <TouchableOpacity
                style={[s.controlBtn, isPaused ? s.controlBtnResume : s.controlBtnPause,
                        !isPaused && s.controlBtnWide]}
                onPress={isPaused ? resumeTracking : pauseTracking}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={isPaused ? "Resume recording" : "Pause recording"}
                testID={isPaused ? "track-resume" : "track-pause"}
              >
                {isPaused
                  ? <Play size={20} color={T.green} />
                  : <Pause size={20} color={T.blue} />}
                <Text style={[s.controlBtnText, isPaused && { color: T.green }]}>
                  {isPaused ? "Resume" : "Pause"}
                </Text>
              </TouchableOpacity>

              {isPaused ? (
                <TouchableOpacity
                  style={[s.controlBtn, s.controlBtnStop]}
                  onPress={handleStopPress}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Finish hike"
                  testID="track-finish"
                >
                  <Square size={14} color={T.red} fill={T.red} />
                  <Text style={[s.controlBtnText, { color: T.red }]}>Finish hike</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Animated.View>
        )}
      </View>

      {/* ── Finish hike confirm sheet ── */}
      {confirmFinish && (
        <Animated.View entering={FadeInUp.duration(250)} style={[s.confirmSheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={s.confirmHandle} />
          {elapsedSecs < 30 ? (
            <>
              <Text style={s.confirmTitle}>Discard this hike?</Text>
              <Text style={s.confirmSub}>You haven't been tracking long — your route won't be saved.</Text>
              {discardError ? <Text style={s.confirmSub} accessibilityRole="alert">{discardError}</Text> : null}
              <TouchableOpacity style={s.confirmDestructive} onPress={handleDiscard} disabled={discarding || saving} activeOpacity={0.85}>
                <Text style={s.confirmDestructiveText}>{discarding ? "Discarding…" : "Discard"}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.confirmTitle}>Finish this hike?</Text>
              <Text style={s.confirmSub}>Stop tracking, then review the recording and choose whether to save it.</Text>
              <TouchableOpacity style={s.confirmPrimary} onPress={() => { setConfirmFinish(false); finishHike(); }} activeOpacity={0.85}>
                <Text style={s.confirmPrimaryText}>Finish & Review</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={s.confirmCancel} disabled={discarding || saving} onPress={() => { setConfirmFinish(false); setDrawerOpen(true); }} activeOpacity={0.7}>
            <Text style={s.confirmCancelText}>Keep Going</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Nearby routes picker modal ── */}
      <Modal
        visible={nearbyPickerOpen && !canonicalRouteIntent}
        animationType="slide"
        transparent
        onRequestClose={() => setNearbyPickerOpen(false)}
      >
        <TouchableOpacity style={s.pickerBackdrop} activeOpacity={1} onPress={() => setNearbyPickerOpen(false)} />
        <View style={[s.pickerSheet, { paddingBottom: insets.bottom + 24 }]}>
          <View style={s.pickerHandle} />
          <Text style={s.pickerTitle}>Nearby Routes</Text>
          <Text style={s.pickerSub}>Pick a route to follow and contribute to</Text>

          {nearbyLoading ? (
            <View style={s.pickerEmpty}>
              <Text style={s.pickerEmptyText}>Searching nearby routes…</Text>
            </View>
          ) : nearbyRoutes.length === 0 ? (
            <View style={s.pickerEmpty}>
              <MapPin size={28} color={T.textMuted} />
              <Text style={s.pickerEmptyText}>No routes found within 5 km</Text>
              <Text style={s.pickerEmptySub}>Track a new route to add one to the community</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {nearbyRoutes.map(route => (
                <TouchableOpacity
                  key={route.id}
                  style={[s.pickerRow, selectedCanonical?.id === route.id && s.pickerRowSelected]}
                  onPress={() => {
                    setSelectedCanonical({ id: route.id, name: route.name });
                    setRouteName(route.name);
                    setNearbyPickerOpen(false);
                    sendRouteOverlay(route.id);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={s.pickerRowLeft}>
                    <Text style={s.pickerRowName} numberOfLines={1}>{route.name}</Text>
                    <View style={s.pickerRowMeta}>
                      <Text style={s.pickerRowMetaText}>
                        {route.distanceKm.toFixed(1)} km · +{route.elevationGain} m · {route.difficulty}
                      </Text>
                      {route.contributionCount > 0 && (
                        <View style={s.contribBadge}>
                          <Users size={10} color={T.blue} />
                          <Text style={s.contribBadgeText}>{route.contributionCount}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={s.pickerRowRight}>
                    <Text style={s.pickerRowDist}>{route.distFromUserKm.toFixed(1)} km</Text>
                    <Text style={s.pickerRowDistLabel}>away</Text>
                  </View>
                  {selectedCanonical?.id === route.id && <CheckCircle size={16} color={T.green} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={s.pickerDismiss} onPress={() => {
            setSelectedCanonical(null);
            setNearbyPickerOpen(false);
          }} activeOpacity={0.7}>
            <Text style={s.pickerDismissText}>Track as a new route instead</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  failedRecording: {
    marginTop: 14, padding: 16, borderRadius: 12, gap: 10,
    borderWidth: 1, borderColor: `${T.orange}44`, backgroundColor: `${T.orange}14`,
  },
  failedRecordingText: {
    color: T.text, fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular",
  },
  failedRecordingBtn: {
    alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 11, minHeight: 44,
    justifyContent: "center", borderRadius: 10,
    borderWidth: 1, borderColor: `${T.orange}66`,
  },
  failedRecordingBtnText: { color: T.orange, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  trainingTarget: {
    position: "absolute", left: 12, right: 12, zIndex: 5,
    backgroundColor: "rgba(11,20,24,0.92)", borderRadius: 12, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)", paddingHorizontal: 14, paddingVertical: 10, gap: 6,
  },
  trainingTargetLabel: { color: T.text, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  trainingBar: {
    height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden",
  },
  trainingFill: { height: 5, borderRadius: 3, backgroundColor: T.green },
  trainingTargetMeta: { color: T.textMuted, fontSize: 11, fontFamily: "Inter_400Regular" },
  panelSwitch: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 6 },
  panelSwitchInner: {
    flexDirection: "row", backgroundColor: "rgba(11,20,24,0.92)",
    borderRadius: 11, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", padding: 3,
  },
  panelTab: {
    paddingHorizontal: 20, paddingVertical: 9, borderRadius: 8, minHeight: 40,
    alignItems: "center", justifyContent: "center",
  },
  panelTabOn: { backgroundColor: "rgba(255,255,255,0.11)" },
  panelTabText: { color: T.textMuted, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  panelTabTextOn: { color: T.text },
  progressSheet: {
    position: "absolute", left: 12, right: 12, zIndex: 5,
    backgroundColor: T.card, borderRadius: 16, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)", padding: 14,
  },
  /* No dividers between the cells and no panel behind them. Space separates
     three figures perfectly well, and every rule drawn on this sheet was one
     more line competing with the map above it. */
  metricRow: {
    flexDirection: "row", alignItems: "flex-start",
    paddingTop: 2, paddingBottom: 2,
  },
  metricCell: { flex: 1, alignItems: "flex-start", paddingRight: 10 },
  /* Read at arm's length, so large and tabular: proportional digits make a
     figure jitter sideways as it counts. */
  metricValue: {
    fontSize: 26, lineHeight: 31, color: T.text, fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums"], letterSpacing: -0.4,
  },
  metricUnit: {
    fontSize: 10, lineHeight: 13, letterSpacing: 0.5, color: BASECAMP.textDim,
    fontFamily: "Inter_500Medium", marginTop: 1,
  },

  // The altitude line and the two figures that cannot be read off it.
  profileBlock: { gap: 4 },
  profileFootRow: { flexDirection: "row", justifyContent: "space-between" },
  profileFoot: {
    fontSize: 10.5, lineHeight: 14, color: BASECAMP.textDim,
    fontFamily: "Inter_500Medium",
  },
  controlBtnWide: { flex: 1 },
  offlineBanner: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.orange,
  },
  offlineBannerText: {
    color: T.text,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  offRouteBanner: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.red,
  },
  offRouteBannerText: {
    color: T.text,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  root: { flex: 1, backgroundColor: BASECAMP.ink },

  // Top gradient overlay for header legibility
  topGradient: {
    position: "absolute", top: 0, left: 0, right: 0, height: 170, zIndex: 1,
  },

  // Header — floats over the map
  header: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 2,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: BASECAMP.gutter, paddingBottom: 16, gap: 12,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    ...TYPE.bodyBold, fontSize: 15, color: BASECAMP.textStrong, textAlign: "center",
  },
  /* Was accent green and read "Free Hike (GPS Mode)". It is a label, not a
     status: nothing acts on it, so it has no business being the brightest
     thing over the map. Dimmed, and the jargon dropped. */
  headerSubtitle: {
    marginTop: 1, fontSize: 10.5, lineHeight: 13,
    fontFamily: "Inter_500Medium", color: BASECAMP.textDim, textAlign: "center",
  },
  backBtn: { padding: 4 },

  // GPS pill
  gpsPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: BASECAMP.navGlass, borderRadius: 13,
    paddingHorizontal: 10, minHeight: 26,
    borderWidth: 1, borderColor: BASECAMP.glassBorder,
  },
  gpsPillReady: { borderColor: BASECAMP.accentLine },
  gpsDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: BASECAMP.textDim },
  gpsText: { fontSize: 11, fontFamily: "Inter_700Bold", color: BASECAMP.textDim },
  gpsTextReady: { color: BASECAMP.accent },

  // Route name card — absolute overlay, idle only
  nameOverlay: {
    position: "absolute", left: BASECAMP.gutter, right: BASECAMP.gutter, zIndex: 2,
    backgroundColor: BASECAMP.navGlass,
    borderRadius: 9, borderWidth: 1, borderColor: BASECAMP.glassBorder,
    padding: 16, gap: 8,
  },
  nameLabel: { ...TYPE.eyebrow, fontSize: 10, color: BASECAMP.textDim },
  nameRequired: { color: T.green },
  nameInput: {
    backgroundColor: BASECAMP.panelSub, borderRadius: 12,
    borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
    paddingHorizontal: 14, minHeight: 46,
    fontSize: 16, fontFamily: "Inter_600SemiBold", color: BASECAMP.text,
  },
  nameInputError: { borderColor: T.red + "80" },
  nameErrorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.red, marginTop: 2 },
  nameHintText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 2 },
  // Track Ready composition.
  readyContext: { marginBottom: 14, gap: 3 },
  readyContextEyebrow: { ...TYPE.eyebrow, color: BASECAMP.textDim },
  readyContextTitle: { ...TYPE.title, fontSize: 22, lineHeight: 27, color: BASECAMP.text },
  readyContextSub: { ...TYPE.small, fontSize: 13, color: BASECAMP.textMuted, flex: 1, minWidth: 0 },
  readyWhereRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  readyStateRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: BASECAMP.panelSub, borderWidth: 1,
    borderColor: BASECAMP.panelSubBorder, borderRadius: 6,
    paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10,
  },
  readyStateItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7, minWidth: 0 },
  readyStateDivider: { width: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.08)", marginHorizontal: 10 },
  readyStateText: { fontSize: 12.5, fontFamily: "Inter_600SemiBold", color: BASECAMP.textMuted, flexShrink: 1 },
  readyAssurance: {
    fontSize: 11.5, lineHeight: 16, fontFamily: "Inter_400Regular",
    color: BASECAMP.textDim, marginBottom: 14,
  },
  // Activity Complete — the reward moment's headline figure.
  // Activity Details — approved wording block above the Save Details CTA.

  // Bottom sheet
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2,
    backgroundColor: BASECAMP.navGlass,
    borderTopLeftRadius: 13, borderTopRightRadius: 13,
    borderTopWidth: 1, borderColor: BASECAMP.navBorder,
  },
  sheetHandleArea: { alignItems: "center", paddingTop: 10, paddingBottom: 6, paddingHorizontal: 16 },
  handle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)", marginBottom: 8,
  },
  sheetStatusRow: {
    flexDirection: "row", alignItems: "center", gap: 8, width: "100%",
  },
  timerHero: { ...TYPE.metric, fontSize: 28, lineHeight: 32, color: BASECAMP.text },
  statusSpacer: { flex: 1 },
  collapsedSummary: {
    flex: 1, textAlign: "right", fontSize: 12.5, lineHeight: 16,
    fontFamily: "Inter_500Medium", color: BASECAMP.textMuted,
    fontVariant: ["tabular-nums"],
  },
  chevron: { fontSize: 13, color: BASECAMP.textDim, marginLeft: 2 },

  /* A dot and three letters, where a bordered pill with an icon used to be.
     The state has to be legible at a glance and nothing more: the running
     clock beside it already says a recording is in progress. */
  recDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: BASECAMP.accent },
  recDotPaused: { backgroundColor: T.orange },
  recState: {
    fontSize: 10, lineHeight: 13, letterSpacing: 1.1,
    fontFamily: "Inter_700Bold", color: BASECAMP.accent,
  },

  // Sheet body (stats + controls)
  sheetBody: { paddingHorizontal: BASECAMP.gutter, paddingBottom: 4, gap: 10 },

  // Recording status + offline notice.
  trackStatusRow: { flexDirection: "row", marginBottom: 10 },
  trackStatusPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
    borderColor: `${T.green}66`, backgroundColor: `${T.green}1F`,
  },
  trackStatusText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.8, color: T.green },
  trackOfflineNote: {
    fontSize: 11, lineHeight: 15, fontFamily: "Inter_400Regular",
    color: T.textMuted, marginBottom: 10,
  },
  // Controls
  controls: { flexDirection: "row", gap: 10 },
  controlBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 8, borderWidth: 1,
  },
  controlBtnPause:  { backgroundColor: BASECAMP.panelSub, borderColor: BASECAMP.panelSubBorder },
  controlBtnResume: { backgroundColor: BASECAMP.accentDim, borderColor: BASECAMP.accentLine },
  controlBtnStop:   { backgroundColor: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.32)" },
  controlBtnText: { ...TYPE.bodyBold, fontSize: 14, color: BASECAMP.textStrong },

  // Start button
  startBtn: { borderRadius: 8, overflow: "hidden" },
  startBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 16,
  },
  startBtnText: { fontSize: 17, lineHeight: 21, fontFamily: "Inter_700Bold", color: BASECAMP.accentInk },

  // GPS note
  gpsNote: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 6,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  gpsNoteText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, flex: 1 },

  // Finished summary (used by the finished early-return render)
  summaryTrail: {
    fontSize: 16, fontFamily: "Inter_400Regular", color: T.textMuted,
    textAlign: "center", paddingHorizontal: 20,
  },



  // Permission denied
  centeredMsg: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 40 },
  msgTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: T.text, textAlign: "center" },
  msgBody:  { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 22 },
  openSettingsBtn: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 6,
    backgroundColor: T.greenDim,
    borderWidth: 1,
    borderColor: T.green + "50",
  },
  openSettingsBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.green },

  // In-app confirm sheet (replaces Alert.alert)
  confirmSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0F1E30",
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 24, paddingTop: 12,
    gap: 12,
  },
  confirmHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "center", marginBottom: 8,
  },
  confirmTitle: { ...TYPE.title, fontSize: 18, lineHeight: 23, color: BASECAMP.text, textAlign: "center" },
  confirmSub:   { ...TYPE.small, fontSize: 13, color: BASECAMP.textMuted, textAlign: "center" },
  confirmPrimary: {
    backgroundColor: BASECAMP.accent, borderRadius: 7,
    minHeight: 50, alignItems: "center", justifyContent: "center",
  },
  confirmPrimaryText: { fontSize: 16, fontFamily: "Inter_700Bold", color: BASECAMP.accentInk },
  confirmDestructive: {
    backgroundColor: "rgba(239,68,68,0.12)", borderRadius: 7, borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)", minHeight: 50,
    alignItems: "center", justifyContent: "center",
  },
  confirmDestructiveText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: T.red },
  confirmCancel: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  confirmCancelText: { ...TYPE.bodyBold, fontSize: 14, color: BASECAMP.textMuted },

  // ── Nearby route picker (name overlay) ────────────────────────────────────
  orRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10,
  },
  orLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  orText: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  nearbyBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: BASECAMP.panelSub, borderRadius: 6,
    borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
    paddingHorizontal: 12, minHeight: 44, marginTop: 4,
  },
  nearbyBtnSelected: {
    backgroundColor: BASECAMP.accentDim,
    borderColor: BASECAMP.accentLine,
  },
  nearbyBtnText: {
    flex: 1, ...TYPE.smallBold, fontSize: 13, color: BASECAMP.textStrong,
  },

  // ── Nearby routes picker modal ─────────────────────────────────────────────
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)",
  },
  pickerSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0B1724",
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.09)",
    paddingHorizontal: 20, paddingTop: 12,
  },
  pickerHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "center", marginBottom: 16,
  },
  pickerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: T.text, marginBottom: 2 },
  pickerSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, marginBottom: 16 },
  pickerEmpty: {
    alignItems: "center", justifyContent: "center", paddingVertical: 32, gap: 8,
  },
  pickerEmptyText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  pickerEmptySub: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center" },
  pickerRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 6, marginBottom: 6,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  pickerRowSelected: {
    backgroundColor: "rgba(62,207,117,0.07)",
    borderColor: "rgba(62,207,117,0.25)",
  },
  pickerRowLeft: { flex: 1 },
  pickerRowName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.text, marginBottom: 4 },
  pickerRowMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  pickerRowMetaText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  contribBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(74,159,245,0.12)", borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  contribBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.blue },
  pickerRowRight: { alignItems: "flex-end", gap: 1 },
  pickerRowDist: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },
  pickerRowDistLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted },
  pickerDismiss: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
  pickerDismissText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },

  // ── Expedition route completion prompt ─────────────────────────────────────
  promptOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center", justifyContent: "flex-end",
    paddingBottom: 40,
  },
  promptCard: {
    width: "90%", maxWidth: 400,
    backgroundColor: "#0B1724",
    borderRadius: 12, padding: 28,
    borderWidth: 1, borderColor: "rgba(62,207,117,0.20)",
    overflow: "hidden", alignItems: "center",
  },
  promptEmo: { fontSize: 40, marginBottom: 12 },
  promptTitle: {
    fontSize: 22, fontFamily: "Inter_700Bold", color: T.white,
    marginBottom: 6, textAlign: "center",
  },
  promptRoute: {
    fontSize: 15, fontFamily: "Inter_500Medium", color: T.textMuted,
    textAlign: "center", marginBottom: 24, lineHeight: 21,
  },
  promptYes: { alignSelf: "stretch", borderRadius: 7, overflow: "hidden", marginBottom: 12 },
  promptYesGrad: {
    paddingVertical: 16, alignItems: "center", justifyContent: "center",
    borderRadius: 7,
  },
  promptYesText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  promptNo: { paddingVertical: 12, alignSelf: "stretch", alignItems: "center" },
  promptNoText: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted },

  /* ── The approved Activity Complete composition ────────────────────── */







});
