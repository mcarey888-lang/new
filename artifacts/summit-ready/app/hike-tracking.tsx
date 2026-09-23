import {
  Activity,
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  MapPin,
  Mountain,
  Check,
  Pause,
  Play,
  Square,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
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
import { WebView } from "react-native-webview";
import { logHillSessionStarted, logHillSessionCompleted, logHikeTracked } from "@/lib/analytics";
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
  ACTIVITY_DETAILS_COPY, formatPace, offlineNotice, paceMinPerKm, statusLabel, trackContext,
} from "@/utils/trackPresentation";
import { STATUS_COPY, readinessStatus } from "@/utils/readinessPresentation";
import { T } from "@/constants/theme";
import { BASECAMP, HIT } from "@/constants/tokens";
import {
  SRButton, SRPanel, SRSectionHeader, SRSubPanel,
} from "@/components/ui";
import { useApp } from "@/context/AppContext";
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
import { enqueueSyncPending, retrySyncOutbox } from "@/utils/syncOutbox";
import {
  clearPendingHikeSelection,
  readPendingHikeSelection,
  savePendingHikeSelection,
} from "@/utils/pendingHikeSelection";
import { resolveTrainingSessionLocation } from "@/utils/trackingLaunchContext";
import { buildActivityCompletionPresentation } from "@/utils/activityCompletionPresentation";
import { useStage8 } from "@/context/Stage8Context";
import { findElevationBankCreditForActivity } from "@/utils/elevationBankMatching";
import { selectExpeditionPresentation } from "@/utils/expeditionProgress";
import { applyExpeditionStageContribution } from "@/utils/expeditionContribution";

// ── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

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

function fmtKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`;
}

function fmtM(m: number): string {
  return `${Math.round(m)} m`;
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

const ALTITUDE_NOISE_THRESHOLD = 1;
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
      if (loc.coords.accuracy != null && loc.coords.accuracy > GPS_MAX_ACCURACY_M) continue;
      points.push({
        lat: loc.coords.latitude,
        lon: loc.coords.longitude,
        alt: loc.coords.altitude,
        ts: loc.timestamp,
        speed: loc.coords.speed,
        acc: loc.coords.accuracy,
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
  const insets = useSafeAreaInsets();
  const { getToken, userId } = useAuth();
  const { appMode, addSession, logExploreHike, trainingPlan, togglePlanSession, completedPlanSessions,
          summitGoal, patchExpedition, activeExpeditionId, expeditions } = useApp();
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
    referenceRouteName?: string;
    restore?: string;           // "1" when app was killed mid-hike and we're restoring
    trackingMode?: string;
    expeditionId?: string;
    routeId?: string;
    routeIdentityKey?: string;
    summitIdentityKey?: string;
    objectiveType?: string;
    stageSnapshot?: string;
  }>();
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
    params.hillName?.trim() || params.referenceRouteName?.trim() || localActivityTitle(),
  );
  const [nameLocked, setNameLocked]     = useState(false);
  const [nameError, setNameError]       = useState(false);

  // ── Tracker state ────────────────────────────────────────────────────────
  const [status, setStatus]               = useState<TrackStatus>("idle");
  const [elapsedSecs, setElapsedSecs]     = useState(0);
  const [distanceKm, setDistanceKm]       = useState(0);
  const [elevGainM, setElevGainM]         = useState(0);
  const [elevLossM, setElevLossM]         = useState(0);
  const [currentAltM, setCurrentAltM]     = useState<number | null>(null);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [gpsReady, setGpsReady]           = useState(false);
  const [isOffline, setIsOffline]         = useState(false);
  const [permDenied, setPermDenied]       = useState(false);
  const [saving, setSaving]               = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [addToPlan, setAddToPlan]         = useState(() => !!(trainingPlan && trainingPlan.length > 0));
  const [drawerOpen, setDrawerOpen]       = useState(true);
  const [showExpeditionPrompt, setShowExpeditionPrompt] = useState(false);
  const [completionExpedition, setCompletionExpedition] = useState<SavedExpedition | null>(null);
  const [completionSaveStarted, setCompletionSaveStarted] = useState(false);

  // ── Nearby route picker ───────────────────────────────────────────────────
  const [nearbyRoutes, setNearbyRoutes]         = useState<NearbyRoute[]>([]);
  const [nearbyLoading, setNearbyLoading]       = useState(false);
  const [nearbyPickerOpen, setNearbyPickerOpen] = useState(false);
  const [selectedCanonical, setSelectedCanonical] = useState<{ id: string; name: string } | null>(null);

  const trackPoints    = useRef<TrackPoint[]>([]);
  const lastAltRef     = useRef<number | null>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const statusRef      = useRef<TrackStatus>("idle");
  const initialPosRef  = useRef<{ lat: number; lon: number } | null>(null);
  const webViewRef        = useRef<WebView>(null);
  const webMapContainerRef = useRef<View>(null);
  const iframeRef          = useRef<any>(null);
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
    if (!userId || params.restore === "1") return;
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
    params.stageSnapshot,
    routeName,
    hillMeta.trackingMode,
    hillMeta.expeditionId,
    hillMeta.routeIdentityKey,
    hillMeta.summitIdentityKey,
    hillMeta.objectiveType,
  ]);

  useEffect(() => {
    if (!userId || params.hillName || params.referenceRouteName || params.restore === "1") return;
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
  }, [params.hillName, params.referenceRouteName, params.restore, userId]);

  // ── Web-only: mount the hike-map iframe ──────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const container = webMapContainerRef.current as unknown as HTMLElement;
    if (!container) return;
    const iframe = document.createElement("iframe");
    iframe.src = `${API_BASE}/hike-map`;
    iframe.style.cssText = "width:100%;height:100%;border:none;display:block;";
    iframe.allow = "geolocation";
    iframe.onload = () => {
      sendReferenceRouteToMap();
      const pos = initialPosRef.current;
      if (pos) sendLocateToMap(pos.lat, pos.lon);
    };
    iframeRef.current = iframe;
    container.appendChild(iframe);
    return () => {
      try { container.removeChild(iframe); } catch { /* already gone */ }
      iframeRef.current = null;
    };
  }, []);

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
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (permStatus !== "granted") { setPermDenied(true); return; }
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
  const sendPointToMap = useCallback((lat: number, lng: number) => {
    const msg = JSON.stringify({ type: "point", lat, lng });
    if (Platform.OS === "web") {
      try { iframeRef.current?.contentWindow?.postMessage(msg, "*"); } catch { /* cross-origin */ }
    } else {
      webViewRef.current?.postMessage(msg);
    }
  }, []);

  // ── Show current position on map without starting a track ────────────────
  const sendLocateToMap = useCallback((lat: number, lng: number) => {
    const msg = JSON.stringify({ type: "locate", lat, lng });
    if (Platform.OS === "web") {
      try { iframeRef.current?.contentWindow?.postMessage(msg, "*"); } catch { /* cross-origin */ }
    } else {
      webViewRef.current?.postMessage(msg);
    }
  }, []);

  // ── Replay the full track on the map (fixes straight-line after unlock) ──
  const replayTrackOnMap = useCallback(() => {
    const points = trackPoints.current.map(p => [p.lat, p.lon] as [number, number]);
    if (points.length === 0) return;
    const msg = JSON.stringify({ type: "replay", points });
    if (Platform.OS === "web") {
      try { iframeRef.current?.contentWindow?.postMessage(msg, "*"); } catch { /* cross-origin */ }
    } else {
      webViewRef.current?.postMessage(msg);
    }
  }, []);

  // ── Send a community reference route to the map as a ghost overlay ────────
  const sendRouteOverlay = useCallback(async (routeId: string) => {
    try {
      const res = await fetch(`${API_BASE}/tracked-routes/${routeId}`);
      if (!res.ok) return;
      const data = await res.json() as { route: { trackPoints: Array<{ lat: number; lon: number }> | null } };
      const pts = data.route.trackPoints ?? [];
      if (pts.length < 2) return;
      const points = pts.map(p => [p.lat, p.lon]);
      const msg = JSON.stringify({ type: "referenceRoute", points });
      if (Platform.OS === "web") {
        try { iframeRef.current?.contentWindow?.postMessage(msg, "*"); } catch { /* cross-origin */ }
      } else {
        webViewRef.current?.postMessage(msg);
      }
    } catch { /* best-effort */ }
  }, []);

  const referenceRouteSentRef = useRef(false);
  const sendReferenceRouteToMap = useCallback(async () => {
    const rid = params.referenceRouteId;
    if (!rid || referenceRouteSentRef.current) return;
    referenceRouteSentRef.current = true;
    await sendRouteOverlay(rid);
  }, [params.referenceRouteId, sendRouteOverlay]);

  const fetchNearbyRoutes = useCallback(async () => {
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
  }, []);

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
      const fresh = newPts.filter(p => p.ts > lastTs);
      let addedAny = false;
      for (const p of fresh) {
        if (!isPlausiblePoint(p.lat, p.lon, p.ts, p.acc ?? null, pts)) continue;
        if (p.speed != null && p.speed >= 0) setCurrentSpeedKmh(p.speed * 3.6);
        if (p.alt != null) {
          currentAltRef.current = p.alt;
          setCurrentAltM(p.alt);
          if (lastAltRef.current !== null) {
            const delta = p.alt - lastAltRef.current;
            if (Math.abs(delta) >= ALTITUDE_NOISE_THRESHOLD) {
              if (delta > 0) setElevGainM(g => (elevGainRef.current = g + delta));
              else           setElevLossM(l => (elevLossRef.current = l + Math.abs(delta)));
              lastAltRef.current = p.alt;
            }
          } else {
            lastAltRef.current = p.alt;
          }
        }
        if (pts.length > 0) {
          const prev = pts[pts.length - 1];
          const d = haversineKm(prev.lat, prev.lon, p.lat, p.lon);
          if (d > 0.003) setDistanceKm(km => (distanceRef.current = km + d));
        }
        pts.push({ lat: p.lat, lon: p.lon, alt: p.alt, ts: p.ts });
        addedAny = true;
      }
      // Replay the complete route on the map so any straight-line gap caused
      // by the foreground watcher firing before this sync is corrected.
      if (addedAny) replayTrackOnMap();
      // Immutable per-callback keys make this an exact acknowledgement: a
      // producer writing concurrently creates a different key and survives.
      await AsyncStorage.multiRemove(processedKeys);
    } catch { /* ignore */ }
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
    if (statusRef.current !== "tracking" && statusRef.current !== "paused" && statusRef.current !== "finished") return;
    try {
      const session: HikeCheckpoint = {
        version: 2,
        routeName,
        status: statusRef.current as "tracking" | "paused" | "finished",
        trackPoints: trackPoints.current,
        distanceKm: distanceRef.current,
        elevGainM: elevGainRef.current,
        elevLossM: elevLossRef.current,
        lastAltM: lastAltRef.current,
        currentAltM: currentAltRef.current,
        trackStartMs: trackStartMsRef.current,
        // Completed pauses only. The active pause has its own start timestamp,
        // preventing it from being counted twice during restoration.
        totalPausedMs: totalPausedMsRef.current,
        pauseStartMs: pauseStartMsRef.current,
        trackingMode: hillMeta.trackingMode,
        expeditionId: hillMeta.expeditionId,
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
    } catch { /* ignore — non-critical */ }
  }, [routeName, hillMeta.sessionKey, hillMeta.hillName, hillMeta.targetReps,
      hillMeta.estimatedGainPerRep, hillMeta.estimatedTotalGain, hillMeta.trackingMode,
      hillMeta.expeditionId, hillMeta.routeIdentityKey, hillMeta.summitIdentityKey,
      hillMeta.objectiveType, userId, isOffline]);

  useEffect(() => {
    if (status !== "tracking" && status !== "paused") return;
    void saveActiveSession(); // snapshot immediately on status change
    const id = setInterval(saveActiveSession, 15_000);
    return () => clearInterval(id);
  }, [status, saveActiveSession]);

  // ── Restore hike session on mount ────────────────────────────────────────
  // Fires when: (a) app was killed mid-hike (params.restore="1"), or
  // (b) user navigated away while tracking and returned to this screen.
  // Reads persisted metadata + background GPS points and resumes seamlessly.
  useEffect(() => {
    if (!userId) return;
    const ownerUserId = userId;
    if (restoreAttempted.current) return;
    restoreAttempted.current = true;

    async function doRestore() {
      try {
        const session = await readActiveHike<HikeCheckpoint>(ownerUserId);
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
        distanceRef.current = session.distanceKm ?? 0;
        elevGainRef.current = session.elevGainM ?? 0;
        elevLossRef.current = session.elevLossM ?? 0;
        lastAltRef.current = session.lastAltM ?? null;
        currentAltRef.current = session.currentAltM ?? session.lastAltM ?? null;
        setDistanceKm(distanceRef.current);
        setElevGainM(elevGainRef.current);
        setElevLossM(elevLossRef.current);
        setCurrentAltM(currentAltRef.current);
        setElapsedSecs(checkpointElapsedSecs(session, Date.now()));

        // Restore route name (may differ from hillName for custom-named routes)
        if (session.routeName) setRouteName(session.routeName);
        if (session.routeId) routeIdRef.current = session.routeId;
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
                if (!isPlausiblePoint(latitude, longitude, loc.timestamp, accuracy, pts)) return;
                if (speed != null && speed >= 0) setCurrentSpeedKmh(speed * 3.6);
                if (altitude != null) {
                  currentAltRef.current = altitude;
                  setCurrentAltM(altitude);
                  if (lastAltRef.current !== null) {
                    const delta = altitude - lastAltRef.current;
                    if (Math.abs(delta) >= ALTITUDE_NOISE_THRESHOLD) {
                      if (delta > 0) setElevGainM(g => (elevGainRef.current = g + delta));
                      else           setElevLossM(l => (elevLossRef.current = l + Math.abs(delta)));
                      lastAltRef.current = altitude;
                    }
                  } else {
                    lastAltRef.current = altitude;
                  }
                }
                if (pts.length > 0) {
                  const prev = pts[pts.length - 1];
                  const d = haversineKm(prev.lat, prev.lon, latitude, longitude);
                  if (d > 0.003) setDistanceKm(km => (distanceRef.current = km + d));
                }
                pts.push({ lat: latitude, lon: longitude, alt: altitude, ts: loc.timestamp });
                sendPointToMap(latitude, longitude);
              },
            );
            locationSubRef.current = fgSub;
          } catch { /* foreground watch unavailable */ }
        }
      } catch { /* ignore — fall back to normal idle state */ }
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
    totalPausedMsRef.current = 0;
    await saveActiveSession();

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

    // Request background location permission (needed for lock-screen tracking)
    if (Platform.OS !== "web") {
      const result = await Location.requestBackgroundPermissionsAsync().catch(() => null);
      backgroundAllowedRef.current = result?.status === "granted";
      if (!backgroundAllowedRef.current) {
        Alert.alert(
          "Background tracking unavailable",
          "Your hike will still be recorded while SummitReady is open, but tracking may stop when the app is closed or the phone is locked.",
        );
      }
    }

    if (hillMeta.sessionKey) {
      void logHillSessionStarted({ hill_name: hillMeta.hillName ?? undefined });
    }

    // Timestamp-based timer — survives OS throttling of JS intervals
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - trackStartMsRef.current - totalPausedMsRef.current) / 1000
      );
      setElapsedSecs(Math.max(0, elapsed));
    }, 1000);

    // Send warmup position to map immediately so "Waiting for GPS…" clears at once
    if (initialPosRef.current) {
      sendPointToMap(initialPosRef.current.lat, initialPosRef.current.lon);
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
          if (!isPlausiblePoint(latitude, longitude, loc.timestamp, accuracy, pts)) return;
          if (speed != null && speed >= 0) setCurrentSpeedKmh(speed * 3.6);
          if (altitude != null) {
            currentAltRef.current = altitude;
            setCurrentAltM(altitude);
            if (lastAltRef.current !== null) {
              const delta = altitude - lastAltRef.current;
              if (Math.abs(delta) >= ALTITUDE_NOISE_THRESHOLD) {
                if (delta > 0) setElevGainM(g => (elevGainRef.current = g + delta));
                else           setElevLossM(l => (elevLossRef.current = l + Math.abs(delta)));
                lastAltRef.current = altitude;
              }
            } else {
              lastAltRef.current = altitude;
            }
          }
          if (pts.length > 0) {
            const prev = pts[pts.length - 1];
            const d = haversineKm(prev.lat, prev.lon, latitude, longitude);
            if (d > 0.003) setDistanceKm(km => (distanceRef.current = km + d));
          }
          pts.push({ lat: latitude, lon: longitude, alt: altitude, ts: loc.timestamp });
          sendPointToMap(latitude, longitude);
        },
      );
      locationSubRef.current = fgSub;
    } catch { /* foreground watch unavailable */ }
  }, [routeName, sendPointToMap, saveActiveSession]);
  const startTracking = useCallback(
    () => serialize(startTrackingImpl),
    [serialize, startTrackingImpl],
  );

  const pauseTrackingImpl = useCallback(async () => {
    if (pauseTogglingRef.current) return;
    pauseTogglingRef.current = true;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const pausedAt = Date.now();
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
    // pause drain. Merge it before producers resume.
    await drainBgPoints();

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
          if (!isPlausiblePoint(latitude, longitude, loc.timestamp, accuracy, pts)) return;
          if (speed != null && speed >= 0) setCurrentSpeedKmh(speed * 3.6);
          if (altitude != null) {
            currentAltRef.current = altitude;
            setCurrentAltM(altitude);
            if (lastAltRef.current !== null) {
              const delta = altitude - lastAltRef.current;
              if (Math.abs(delta) >= ALTITUDE_NOISE_THRESHOLD) {
                if (delta > 0) setElevGainM(g => (elevGainRef.current = g + delta));
                else           setElevLossM(l => (elevLossRef.current = l + Math.abs(delta)));
                lastAltRef.current = altitude;
              }
            } else {
              lastAltRef.current = altitude;
            }
          }
          if (pts.length > 0) {
            const prev = pts[pts.length - 1];
            const d = haversineKm(prev.lat, prev.lon, latitude, longitude);
            if (d > 0.003) setDistanceKm(km => (distanceRef.current = km + d));
          }
          pts.push({ lat: latitude, lon: longitude, alt: altitude, ts: loc.timestamp });
          sendPointToMap(latitude, longitude);
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

  // ── Save completed hike ──────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setSaving(true);
    const name     = routeName.trim() || "Tracked Hike";
    const distKm   = parseFloat(distanceKm.toFixed(2));
    const elevGain = Math.round(elevGainM);
    const elevLoss = Math.round(elevLossM);
    const firstPt  = trackPoints.current[0];
    const routeId  = routeIdRef.current;

    try {
      // 1 ── Always log the completed hike to the hike history
      await logExploreHike({
        name,
        date: new Date().toISOString(),
        distance: distKm,
        elevationGain: elevGain,
        timeTaken: Math.round(elapsedSecs / 60),   // store in minutes
        notes: `GPS tracked hike. Elevation loss: ${elevLoss} m. Avg speed: ${elapsedSecs > 0 && distKm > 0 ? (distKm / (elapsedSecs / 3600)).toFixed(1) : "—"} km/h.`,
        trackPoints: trackPoints.current,
        activityId: routeId,
        expeditionId: hillMeta.expeditionId ?? undefined,
        syncState: isOffline ? "queued" : "local_only",
      });
      setCompletionSaveStarted(true);
      void logHikeTracked({ distance_km: distKm, elevation_gain: elevGain, duration_min: Math.round(elapsedSecs / 60) });

      // Close the GPS gap: if this hike was launched from a plan session,
      // automatically tick it as complete so the user doesn't have to go back manually.
      if (hillMeta.sessionKey) {
        const location = resolveTrainingSessionLocation(trainingPlan, hillMeta.sessionKey);
        if (location && !completedPlanSessions[hillMeta.sessionKey]) {
          await togglePlanSession(location.weekNumber, location.sessionIndex);
        }
      }

      // 2 ── Optionally log to the plan session log
      if (addToPlan && trainingPlan && trainingPlan.length > 0) {
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

      // 3 ── Submit to backend: contribute to canonical route or create a new one
      const routeSyncId = `community-route:${routeId}:${selectedCanonical?.id ?? "new"}`;
      const routeUrl = selectedCanonical
        ? `${API_BASE}/tracked-routes/${selectedCanonical.id}/contribute`
        : `${API_BASE}/tracked-routes`;
      const routeBody = selectedCanonical
        ? {
            contributionId: routeId,
            trackPoints: trackPoints.current,
            distanceKm: distKm,
            elevationGain: elevGain,
            elevationLoss: elevLoss,
            durationSecs: elapsedSecs,
          }
        : {
            id: routeId,
            name,
            location: "GPS Tracked Route",
            distanceKm: distKm,
            elevationGain: elevGain,
            elevationLoss: elevLoss,
            durationSecs: elapsedSecs,
            difficulty: computeDifficulty(distKm, elevGain),
            startLat: firstPt?.lat ?? null,
            startLng: firstPt?.lon ?? null,
            trackPoints: trackPoints.current,
            notes: `Avg speed: ${elapsedSecs > 0 && distKm > 0 ? (distKm / (elapsedSecs / 3600)).toFixed(1) : "0"} km/h.`,
          };
      if (userId) {
        await enqueueSyncPending(userId, {
          id: routeSyncId,
          kind: "community-route",
          url: routeUrl,
          method: "POST",
          body: routeBody,
        });
      }

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
        "Activity saved. It will sync automatically when you’re online.",
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
              creditedHikeIds: [...creditedHikeIds.slice(-99), routeId],
            },
          });
        }
        await clearActiveHike(userId ?? undefined);
        router.replace("/(tabs)/hikes" as any);
      } else if (hillMeta.trackingMode === "expedition-route" && trackedExpedition) {
        // In expedition mode ask "Did you complete this route?" before leaving.
        setShowExpeditionPrompt(true);
      } else {
        // In training mode navigate straight to hike history as before.
        await clearActiveHike(userId ?? undefined);
        router.replace("/(tabs)/hikes" as any);
      }
    } catch {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }, [addToPlan, routeName, distanceKm, elevGainM, elevLossM, elapsedSecs, trainingPlan,
       addSession, logExploreHike, activeExpeditionId, trackedExpedition, hillMeta, expeditions, patchExpedition, getToken, userId, selectedCanonical, isOffline]);

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

  // ── Render: permission denied ────────────────────────────────────────────
  if (permDenied) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={T.text} />
        </TouchableOpacity>
        <View style={s.centeredMsg}>
          <WifiOff size={48} color={T.textMuted} />
          <Text style={s.msgTitle}>Location Access Needed</Text>
          <Text style={s.msgBody}>SummitReady needs location permission to track your hike.</Text>
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            style={s.openSettingsBtn}
            activeOpacity={0.8}
          >
            <Text style={s.openSettingsBtnText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Render: finished summary ─────────────────────────────────────────────
  if (status === "finished") {
    return (
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          <Animated.View entering={FadeInDown.duration(400)}>
            {/* ── The result ────────────────────────────────────────────
                The headline figure is the one the day actually earned. */}
            <View style={s.doneHead}>
              <View style={s.doneCheck}>
                <CheckCircle size={22} color={BASECAMP.accentInk} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.doneTitle} numberOfLines={2}>Activity complete</Text>
                <Text style={s.doneSub} numberOfLines={2}>{completionPresentation.title}</Text>
              </View>
            </View>

            <SRPanel radius={18} style={{ marginTop: 16 }}>
              <View style={s.rewardBlock}>
                <Text
                  style={s.rewardValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {fmtM(elevGainM)}
                </Text>
                <Text style={s.rewardLabel}>ELEVATION GAINED</Text>
              </View>

              <View style={s.recordGrid}>
                <RecordStat value={formatTime(elapsedSecs)} label="Duration" />
                <RecordStat value={fmtKm(distanceKm)} label="Distance" />
                <RecordStat value={fmtM(elevLossM)} label="Descended" />
                <RecordStat
                  value={elapsedSecs > 0 && distanceKm > 0
                    ? `${(distanceKm / (elapsedSecs / 3600)).toFixed(1)} km/h`
                    : null}
                  label="Average speed"
                />
                <RecordStat
                  value={currentAltM != null ? fmtM(currentAltM) : null}
                  label="Final altitude"
                />
              </View>
            </SRPanel>

            {/* ── What this changed ─────────────────────────────────────
                The SummitReady difference: the real consequences of the
                activity, each one stating only what the owning system has
                actually confirmed. Nothing is anticipated. */}
            <View style={s.consequenceSection}>
              <SRSectionHeader title="What this changed" />
              <SRPanel radius={16} style={{ marginTop: 10 }}>
                {completionPresentation.elevationBank.status !== "not_eligible" && (
                  <View style={s.consequenceRow} testID="completion-elevation-bank">
                    <TrendingUp size={17} color={BASECAMP.accent} />
                    <View style={s.consequenceCopy}>
                      <Text style={s.consequenceEyebrow}>ELEVATION BANK</Text>
                      {completionPresentation.elevationBank.status === "credited" ? (
                        <>
                          <Text style={s.consequenceHead}>
                            +{fmtM(completionPresentation.elevationBank.creditedAscentM)} credited
                          </Text>
                          <Text style={s.consequenceSub}>
                            Lifetime {fmtM(completionPresentation.elevationBank.lifetimeAscentM)}
                            {" · "}
                            {completionPresentation.elevationBank.everestEquivalent.toFixed(1)} Everest equivalent
                          </Text>
                        </>
                      ) : (
                        <Text style={s.consequenceHead}>
                          {completionPresentation.elevationBank.status === "unavailable"
                            ? "Unavailable — your activity is still saved."
                            : "Pending — this activity will be checked when sync is available."}
                        </Text>
                      )}
                      <Text style={s.consequenceNote}>
                        Recorded ascent only — simulated Expedition elevation is separate.
                      </Text>
                    </View>
                  </View>
                )}

                {/* Readiness. The completion presentation supplies no readiness
                    result, because Readiness 2.0 re-evaluates from the saved
                    activity rather than at the moment of finishing. So this row
                    states PENDING truthfully — it never shows an increase. */}
                <View style={[s.consequenceRow, s.consequenceDivider]} testID="completion-readiness">
                  <Activity size={17} color={BASECAMP.textMuted} />
                  <View style={s.consequenceCopy}>
                    <Text style={s.consequenceEyebrow}>READINESS</Text>
                    <Text style={s.consequenceHead}>
                      {STATUS_COPY[readinessStatus("available", 0, { processing: true })].label}
                    </Text>
                    <Text style={s.consequenceSub}>
                      Your readiness updates once this activity has been processed.
                    </Text>
                  </View>
                </View>

                {completionPresentation.training.status === "linked" && (
                  <View style={[s.consequenceRow, s.consequenceDivider]} testID="completion-training">
                    <CheckCircle size={17} color={BASECAMP.accent} />
                    <View style={s.consequenceCopy}>
                      <Text style={s.consequenceEyebrow}>TRAINING PLAN</Text>
                      <Text style={s.consequenceHead}>Training session linked</Text>
                      <Text style={s.consequenceSub}>
                        Your GPS activity is ready to save to the planned session.
                      </Text>
                    </View>
                  </View>
                )}

                {completionPresentation.expedition.status === "simulated" && (
                  <View style={[s.consequenceRow, s.consequenceDivider]} testID="completion-expedition">
                    <Mountain size={17} color={T.blue} />
                    <View style={s.consequenceCopy}>
                      <Text style={s.consequenceEyebrow}>EXPEDITION PROGRESS</Text>
                      <Text style={s.consequenceHead}>
                        {completionPresentation.expedition.stageName}
                      </Text>
                      <Text style={s.consequenceSub}>
                        Simulated stage progress only ·{" "}
                        {Math.round(completionPresentation.expedition.simulatedPercent * 100)}% ·{" "}
                        {completionPresentation.expedition.completedStageCount}/
                        {completionPresentation.expedition.totalStageCount} stages complete
                      </Text>
                      <Text style={s.consequenceSub}>
                        {completionPresentation.expedition.isComplete
                          ? "Summit reached — no next stage."
                          : completionPresentation.expedition.nextStageName
                            ? `Next stage: ${completionPresentation.expedition.nextStageName}`
                            : "Next stage will appear after this activity is confirmed."}
                      </Text>
                    </View>
                  </View>
                )}

                {completionPresentation.challengeAchievement.status !== "not_linked" && (
                  <View style={[s.consequenceRow, s.consequenceDivider]} testID="completion-challenge-achievement">
                    <Trophy size={17} color={T.orange} />
                    <View style={s.consequenceCopy}>
                      <Text style={s.consequenceEyebrow}>CHALLENGES &amp; ACHIEVEMENTS</Text>
                      {completionPresentation.challengeAchievement.status === "confirmed" ? (
                        <>
                          {completionPresentation.challengeAchievement.challengeTitles.map((title) => (
                            <Text key={`challenge-${title}`} style={s.consequenceHead}>{title}</Text>
                          ))}
                          {completionPresentation.challengeAchievement.achievementTitles.map((title) => (
                            <Text key={`achievement-${title}`} style={s.consequenceHead}>{title}</Text>
                          ))}
                          {completionPresentation.challengeAchievement.challengeTitles.length === 0 &&
                            completionPresentation.challengeAchievement.achievementTitles.length === 0 && (
                              <Text style={s.consequenceSub}>No new confirmed consequences.</Text>
                            )}
                        </>
                      ) : (
                        <Text style={s.consequenceSub}>
                          {completionPresentation.challengeAchievement.reason}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </SRPanel>
            </View>

            {completionPresentation.sync === "saved_locally" && (
              <SRSubPanel style={s.offlineRow} testID="completion-offline">
                <WifiOff size={14} color={T.orange} />
                <Text style={s.offlineText}>
                  Saved on this device — consequences will sync when you are back online.
                </Text>
              </SRSubPanel>
            )}

            {trainingPlan && trainingPlan.length > 0 && (
              <SRSubPanel
                style={s.planToggleWrap}
                onPress={() => setAddToPlan(v => !v)}
                accessibilityLabel="Add this activity to your training plan"
              >
                <View style={s.planToggleRow}>
                  <View style={[s.planToggleCheck, addToPlan && s.planToggleCheckOn]}>
                    {addToPlan && <Check size={13} color={BASECAMP.accentInk} strokeWidth={3} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.planToggleTitle}>Add to training plan</Text>
                    <Text style={s.planToggleSub}>
                      {(() => {
                        const wi = trainingPlan.findIndex(w => w.isCurrentWeek);
                        const wn = wi >= 0 ? wi : 0;
                        return `Log as a session for week ${wn + 1}`;
                      })()}
                    </Text>
                  </View>
                </View>
              </SRSubPanel>
            )}

            {/* Activity Details — approved wording. The canonical activity was
                minted at Start and already persisted; this step only adds
                photos, notes and detail to it. It never creates a second one. */}
            <View style={s.detailsIntro}>
              <Text style={s.detailsTitle}>{ACTIVITY_DETAILS_COPY.title}</Text>
              <Text style={s.detailsSubtitle}>{ACTIVITY_DETAILS_COPY.subtitle}</Text>
              <Text style={s.detailsReassurance}>{ACTIVITY_DETAILS_COPY.reassurance}</Text>
            </View>

            <SRButton
              label={saving ? "Saving…" : ACTIVITY_DETAILS_COPY.cta}
              onPress={handleSave}
              disabled={saving}
              style={{ marginTop: 14 }}
              accessibilityHint="Saves this activity's details to the activity already recorded"
            />

            <TouchableOpacity
              style={s.discardBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Discard"
            >
              <Text style={s.discardBtnText}>Discard</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>

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
  const canStart   = true;

  return (
    <View style={s.root}>

      {/* ── Full-screen map (always rendered behind everything) ── */}
      <View style={StyleSheet.absoluteFill}>
        {Platform.OS !== "web" ? (
          <WebView
            ref={webViewRef}
            source={{ uri: `${API_BASE}/hike-map` }}
            style={{ flex: 1 }}
            scrollEnabled={false}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={["*"]}
            onLoad={() => {
              sendReferenceRouteToMap();
              const pos = initialPosRef.current;
              if (pos) sendLocateToMap(pos.lat, pos.lon);
            }}
          />
        ) : (
          <View ref={webMapContainerRef} style={{ flex: 1 }} />
        )}
      </View>

      {/* ── Top gradient for header readability ── */}
      <LinearGradient
        colors={["rgba(5,13,26,0.90)", "rgba(5,13,26,0.0)"]}
        style={[s.topGradient, { pointerEvents: "none" }]}
      />

      {/* ── Header (floats over map) ── */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
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

        <View style={s.headerTitleContainer}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {nameLocked && routeName ? routeName : hillMeta.trackingMode === "freehike" ? "Start Free Hike" : "Start Hiking"}
          </Text>
          {hillMeta.trackingMode === "freehike" && nameLocked && (
            <Text style={s.headerSubtitle}>Free Hike (GPS Mode)</Text>
          )}
        </View>

        <View style={[s.gpsPill, gpsReady && s.gpsPillReady]}>
          <Animated.View style={[s.gpsDot, isTracking && pulseStyle]} />
          <Text style={[s.gpsText, gpsReady && s.gpsTextReady]}>
            {gpsReady ? "GPS" : "…"}
          </Text>
        </View>
      </View>

      {isOffline && !isIdle && (
        <View style={[s.offlineBanner, { top: insets.top + 68 }]}>
          <WifiOff size={13} color={T.orange} />
          <Text style={s.offlineBannerText}>Offline — activity saved on this device</Text>
        </View>
      )}

      {/* ── Route name card — floats over map, only visible when idle ── */}
      {isIdle && (
        <Animated.View
          entering={FadeInDown.delay(50).duration(400)}
          style={[s.nameOverlay, { top: insets.top + 70 }]}
        >
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

          {/* ── Nearby route picker ── */}
          <View style={s.orRow}>
            <View style={s.orLine} /><Text style={s.orText}>or</Text><View style={s.orLine} />
          </View>
          <TouchableOpacity
            style={[s.nearbyBtn, selectedCanonical && s.nearbyBtnSelected]}
            onPress={fetchNearbyRoutes}
            activeOpacity={0.8}
          >
            <MapPin size={14} color={selectedCanonical ? T.green : T.blue} />
            <Text style={[s.nearbyBtnText, selectedCanonical && { color: T.green }]}>
              {selectedCanonical ? `Following: ${selectedCanonical.name}` : "Pick a nearby route"}
            </Text>
            {selectedCanonical
              ? <CheckCircle size={14} color={T.green} />
              : <ChevronRight size={14} color={T.textMuted} />
            }
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Bottom sheet ── */}
      <View style={[s.sheet, { paddingBottom: insets.bottom + 12 }]}>

        {/* Drag handle — tapping toggles drawer when tracking */}
        <TouchableOpacity
          onPress={() => !isIdle && setDrawerOpen(o => !o)}
          activeOpacity={isIdle ? 1 : 0.7}
          style={s.sheetHandleArea}
        >
          <View style={s.handle} />

          {/* Status + timer — always visible in header row of sheet */}
          {!isIdle && (
            <View style={s.sheetStatusRow}>
              <View style={[s.statusPill,
                isTracking && s.statusPillTracking,
                isPaused   && s.statusPillPaused,
              ]}>
                {isTracking && <Activity size={11} color={T.green} />}
                {isPaused   && <Pause size={11} color={T.orange} />}
                <Text style={[s.statusText,
                  isTracking && { color: T.green },
                  isPaused   && { color: T.orange },
                ]}>
                  {isTracking ? "TRACKING" : "PAUSED"}
                </Text>
              </View>
              <Text style={s.timerInline}>{formatTime(elapsedSecs)}</Text>
              <Text style={s.chevron}>{drawerOpen ? "▾" : "▴"}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Track Ready: what you are about to record, then the state of
               the device, then Start. GPS and network are reported as
               information only — neither ever disables the button. ── */}
        {isIdle && (
          <View style={s.sheetBody}>
            {(() => {
              /* Context comes from the launch params the screen already
                 receives — the hill the session named, and the reference
                 route where one was chosen. No new param was introduced. */
              const ctx = trackContext({
                hillName: hillMeta.hillName,
                routeName: params.referenceRouteName ?? null,
                sessionLabel: null,
              });
              if (!ctx) return null;
              return (
                <View style={s.readyContext}>
                  <Text style={s.readyContextEyebrow}>RECORDING</Text>
                  <Text style={s.readyContextTitle} numberOfLines={2}>{ctx.title}</Text>
                  {ctx.subtitle ? (
                    <Text style={s.readyContextSub} numberOfLines={1}>{ctx.subtitle}</Text>
                  ) : null}
                </View>
              );
            })()}

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
              style={s.startBtn}
              onPress={startTracking}
              disabled={!canStart}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#3ECF75", "#2AB860"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.startBtnGrad}
              >
                <Play size={20} color="#fff" fill="#fff" />
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

            {/* Recording state, including offline, stated plainly. */}
            <View style={s.trackStatusRow}>
              <View
                style={[
                  s.trackStatusPill,
                  isPaused && { borderColor: `${T.orange}66`, backgroundColor: `${T.orange}1F` },
                ]}
              >
                <Text
                  style={[s.trackStatusText, isPaused && { color: T.orange }]}
                  numberOfLines={1}
                  accessibilityLiveRegion="polite"
                >
                  {statusLabel(status, isOffline)}
                </Text>
              </View>
            </View>
            {offlineNotice(isOffline, status) ? (
              <Text style={s.trackOfflineNote}>{offlineNotice(isOffline, status)}</Text>
            ) : null}

            {/* 4-stat row: distance · gained · altitude · descended */}
            <View style={s.statsRow}>
              <View style={s.statCell}>
                <Text style={s.statValue}>{fmtKm(distanceKm)}</Text>
                <Text style={s.statLabel}>Distance</Text>
              </View>
              <View style={[s.statCell, s.statCellBorder]}>
                <View style={s.statValueRow}>
                  <TrendingUp size={13} color={T.green} style={{ marginRight: 2 }} />
                  <Text style={[s.statValue, { color: T.green }]}>{fmtM(elevGainM)}</Text>
                </View>
                <Text style={s.statLabel}>Gained</Text>
              </View>
              <View style={[s.statCell, s.statCellBorder]}>
                <Text style={s.statValue}>{currentAltM != null ? fmtM(currentAltM) : "—"}</Text>
                <Text style={s.statLabel}>Altitude</Text>
              </View>
              <View style={[s.statCell, s.statCellBorder]}>
                <View style={s.statValueRow}>
                  <TrendingDown size={13} color={T.orange} style={{ marginRight: 2 }} />
                  <Text style={[s.statValue, { color: T.orange }]}>{fmtM(elevLossM)}</Text>
                </View>
                <Text style={s.statLabel}>Descended</Text>
              </View>
            </View>

            {/* Pace, from recorded distance and elapsed time only. Shows an
                em dash until there is enough movement to state one. */}
            <View style={s.speedRow}>
              <Activity size={12} color={T.textMuted} />
              <Text style={s.speedText}>{formatPace(paceMinPerKm(distanceKm, elapsedSecs))}</Text>
            </View>

            {/* Speed */}
            <View style={s.speedRow}>
              <Activity size={12} color={T.textMuted} />
              <Text style={s.speedText}>
                {currentSpeedKmh > 0 ? `${currentSpeedKmh.toFixed(1)} km/h` : "— km/h"}
              </Text>
              <Text style={s.speedLabel}>current speed</Text>
            </View>

            {/* Pause / finish controls */}
            <View style={s.controls}>
              <TouchableOpacity
                style={[s.controlBtn, isPaused ? s.controlBtnResume : s.controlBtnPause]}
                onPress={isPaused ? resumeTracking : pauseTracking}
                activeOpacity={0.85}
              >
                {isPaused
                  ? <Play size={18} color={T.green} />
                  : <Pause size={18} color={T.blue} />}
                <Text style={[s.controlBtnText, isPaused && { color: T.green }]}>
                  {isPaused ? "Resume" : "Pause"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={[s.controlBtn, s.controlBtnStop]} onPress={handleStopPress} activeOpacity={0.8}>
                <Square size={14} color={T.red} fill={T.red} />
                <Text style={[s.controlBtnText, { color: T.red }]}>Finish Hike</Text>
              </TouchableOpacity>
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
              <TouchableOpacity style={s.confirmDestructive} onPress={() => { setConfirmFinish(false); router.back(); }} activeOpacity={0.85}>
                <Text style={s.confirmDestructiveText}>Discard</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.confirmTitle}>Finish this hike?</Text>
              <Text style={s.confirmSub}>Stop tracking and save your route summary.</Text>
              <TouchableOpacity style={s.confirmPrimary} onPress={() => { setConfirmFinish(false); finishHike(); }} activeOpacity={0.85}>
                <Text style={s.confirmPrimaryText}>Finish & Save</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={s.confirmCancel} onPress={() => { setConfirmFinish(false); setDrawerOpen(true); }} activeOpacity={0.7}>
            <Text style={s.confirmCancelText}>Keep Going</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Nearby routes picker modal ── */}
      <Modal
        visible={nearbyPickerOpen}
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

/* One recorded figure. A value the recorder did not capture is an em dash,
   never a zero. */
function RecordStat({ value, label }: { value: string | null; label: string }) {
  return (
    <View style={s.recordCell}>
      <Text
        style={[s.recordValue, value === null && { color: BASECAMP.textDim }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value ?? "—"}
      </Text>
      <Text style={s.recordLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  offlineBanner: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 12,
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
  root: { flex: 1, backgroundColor: "#050D1A" },

  // Top gradient overlay for header legibility
  topGradient: {
    position: "absolute", top: 0, left: 0, right: 0, height: 160, zIndex: 1,
  },

  // Header — floats over the map
  header: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 2,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 16, gap: 12,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17, fontFamily: "Inter_600SemiBold",
    color: T.text, textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 11, fontFamily: "Inter_500Medium",
    color: T.green, textAlign: "center",
    marginTop: 2,
  },
  backBtn: { padding: 4 },

  // GPS pill
  gpsPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(5,13,26,0.75)", borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  gpsPillReady: { borderColor: "rgba(62,207,117,0.5)", backgroundColor: "rgba(5,13,26,0.85)" },
  gpsDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.textMuted },
  gpsText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  gpsTextReady: { color: T.green },

  // Route name card — absolute overlay, idle only
  nameOverlay: {
    position: "absolute", left: 16, right: 16, zIndex: 2,
    backgroundColor: "rgba(6,13,27,0.93)",
    borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    padding: 16, gap: 8,
  },
  nameLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  nameRequired: { color: T.green },
  nameInput: {
    backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, fontFamily: "Inter_600SemiBold", color: T.text,
  },
  nameInputError: { borderColor: T.red + "80" },
  nameErrorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.red, marginTop: 2 },
  nameHintText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 2 },
  // Track Ready composition.
  readyContext: { marginBottom: 14, gap: 3 },
  readyContextEyebrow: {
    fontSize: 10, lineHeight: 13, fontFamily: "Inter_700Bold",
    letterSpacing: 1.6, color: T.textMuted,
  },
  readyContextTitle: { fontSize: 22, lineHeight: 27, fontFamily: "Inter_700Bold", color: T.text, letterSpacing: -0.3 },
  readyContextSub: { fontSize: 13, lineHeight: 18, fontFamily: "Inter_400Regular", color: T.textMuted },
  readyStateRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.035)", borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)", borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10,
  },
  readyStateItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7, minWidth: 0 },
  readyStateDivider: { width: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.08)", marginHorizontal: 10 },
  readyStateText: { fontSize: 12.5, fontFamily: "Inter_600SemiBold", color: T.textMuted, flexShrink: 1 },
  readyAssurance: {
    fontSize: 11.5, lineHeight: 16, fontFamily: "Inter_400Regular",
    color: T.textDim, marginBottom: 14,
  },
  // Activity Complete — the reward moment's headline figure.
  // Activity Details — approved wording block above the Save Details CTA.

  // Bottom sheet
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2,
    backgroundColor: "rgba(6,13,27,0.97)",
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  sheetHandleArea: { alignItems: "center", paddingTop: 10, paddingBottom: 6, paddingHorizontal: 16 },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)", marginBottom: 8,
  },
  sheetStatusRow: {
    flexDirection: "row", alignItems: "center", gap: 10, width: "100%",
  },
  timerInline: { flex: 1, fontSize: 30, fontFamily: "Inter_700Bold", color: T.text, letterSpacing: -0.5 },
  chevron: { fontSize: 14, color: T.textMuted },

  // Status pill (inside sheet header row)
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  statusPillTracking: { backgroundColor: "rgba(62,207,117,0.1)", borderColor: "rgba(62,207,117,0.3)" },
  statusPillPaused:   { backgroundColor: "rgba(251,146,60,0.1)", borderColor: "rgba(251,146,60,0.3)" },
  statusText: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.textMuted, letterSpacing: 0.8 },

  // Sheet body (stats + controls)
  sheetBody: { paddingHorizontal: 16, paddingBottom: 4, gap: 10 },

  // Stats row — 4 cells
  statsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    paddingVertical: 12,
  },
  statCell: { flex: 1, alignItems: "center", gap: 4 },
  statCellBorder: { borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.07)" },
  statValueRow: { flexDirection: "row", alignItems: "center" },
  // Recording status + offline notice.
  trackStatusRow: { flexDirection: "row", marginBottom: 10 },
  trackStatusPill: {
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
    borderColor: `${T.green}66`, backgroundColor: `${T.green}1F`,
  },
  trackStatusText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.8, color: T.green },
  trackOfflineNote: {
    fontSize: 11, lineHeight: 15, fontFamily: "Inter_400Regular",
    color: T.textMuted, marginBottom: 10,
  },
  statValue: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.text },
  statLabel: { fontSize: 9, fontFamily: "Inter_400Regular", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },

  // Speed bar
  speedRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 2,
  },
  speedText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.text },
  speedLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },

  // Controls
  controls: { flexDirection: "row", gap: 10 },
  controlBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 1,
  },
  controlBtnPause:  { backgroundColor: "rgba(96,165,250,0.1)", borderColor: "rgba(96,165,250,0.3)" },
  controlBtnResume: { backgroundColor: "rgba(62,207,117,0.1)", borderColor: "rgba(62,207,117,0.3)" },
  controlBtnStop:   { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" },
  controlBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.blue },

  // Start button
  startBtn: { borderRadius: 18, overflow: "hidden" },
  startBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 16,
  },
  startBtnText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },

  // GPS note
  gpsNote: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12,
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
    borderRadius: 12,
    backgroundColor: T.greenDim,
    borderWidth: 1,
    borderColor: T.green + "50",
  },
  openSettingsBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.green },

  // In-app confirm sheet (replaces Alert.alert)
  confirmSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0F1E30",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 24, paddingTop: 12,
    gap: 12,
  },
  confirmHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "center", marginBottom: 8,
  },
  confirmTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: T.text, textAlign: "center" },
  confirmSub:   { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 19 },
  confirmPrimary: {
    backgroundColor: T.green, borderRadius: 14,
    paddingVertical: 15, alignItems: "center",
  },
  confirmPrimaryText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  confirmDestructive: {
    backgroundColor: "rgba(239,68,68,0.12)", borderRadius: 14, borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)", paddingVertical: 15, alignItems: "center",
  },
  confirmDestructiveText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: T.red },
  confirmCancel: { paddingVertical: 12, alignItems: "center" },
  confirmCancelText: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted },

  // ── Nearby route picker (name overlay) ────────────────────────────────────
  orRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10,
  },
  orLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  orText: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  nearbyBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(74,159,245,0.08)", borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(74,159,245,0.2)",
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 4,
  },
  nearbyBtnSelected: {
    backgroundColor: "rgba(62,207,117,0.08)",
    borderColor: "rgba(62,207,117,0.3)",
  },
  nearbyBtnText: {
    flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: T.blue,
  },

  // ── Nearby routes picker modal ─────────────────────────────────────────────
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)",
  },
  pickerSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0B1724",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
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
    borderRadius: 12, marginBottom: 6,
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
    borderRadius: 24, padding: 28,
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
  promptYes: { alignSelf: "stretch", borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  promptYesGrad: {
    paddingVertical: 16, alignItems: "center", justifyContent: "center",
    borderRadius: 14,
  },
  promptYesText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  promptNo: { paddingVertical: 12, alignSelf: "stretch", alignItems: "center" },
  promptNoText: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted },

  /* ── The approved Activity Complete composition ────────────────────── */
  doneHead: { flexDirection: "row", alignItems: "center", gap: 13, marginTop: 26 },
  doneCheck: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center", backgroundColor: BASECAMP.accent,
  },
  doneTitle: {
    fontSize: 23, lineHeight: 27, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: -0.6,
  },
  doneSub: {
    marginTop: 3, fontSize: 12.5, lineHeight: 17,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },

  rewardBlock: { alignItems: "center", paddingTop: 20, paddingHorizontal: 14 },
  rewardValue: {
    fontSize: 46, lineHeight: 52, fontFamily: "Inter_700Bold",
    color: BASECAMP.accent, letterSpacing: -1.6,
  },
  rewardLabel: {
    marginTop: 4, fontSize: 9.5, lineHeight: 12, fontFamily: "Inter_600SemiBold",
    letterSpacing: 2, color: BASECAMP.textMuted,
  },
  recordGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 14, paddingTop: 18, paddingBottom: 16, rowGap: 14,
  },
  recordCell: { flexGrow: 1, flexBasis: "33%", minWidth: 92, paddingRight: 8 },
  recordValue: {
    fontSize: 18, lineHeight: 22, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: -0.4,
  },
  recordLabel: {
    marginTop: 3, fontSize: 10, lineHeight: 13,
    fontFamily: "Inter_500Medium", color: BASECAMP.textDim,
  },

  consequenceSection: { marginTop: 22 },
  consequenceRow: { flexDirection: "row", alignItems: "flex-start", gap: 11, padding: 13 },
  consequenceDivider: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.055)" },
  consequenceCopy: { flex: 1, minWidth: 0 },
  consequenceEyebrow: {
    fontSize: 9, lineHeight: 12, fontFamily: "Inter_700Bold",
    letterSpacing: 1.6, color: BASECAMP.textDim,
  },
  consequenceHead: {
    marginTop: 4, fontSize: 14.5, lineHeight: 19,
    fontFamily: "Inter_700Bold", color: BASECAMP.text,
  },
  consequenceSub: {
    marginTop: 4, fontSize: 11.5, lineHeight: 16,
    fontFamily: "Inter_400Regular", color: BASECAMP.textMuted,
  },
  consequenceNote: {
    marginTop: 5, fontSize: 10.5, lineHeight: 14,
    fontFamily: "Inter_400Regular", color: BASECAMP.textFaint,
  },

  offlineRow: { flexDirection: "row", alignItems: "center", gap: 9, padding: 12, marginTop: 14 },
  offlineText: { flex: 1, fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular", color: T.orange },

  planToggleWrap: { marginTop: 14 },
  planToggleRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, minHeight: HIT.minTarget },
  planToggleCheck: {
    width: 22, height: 22, borderRadius: 7,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: BASECAMP.textFaint,
  },
  planToggleCheckOn: { backgroundColor: BASECAMP.accent, borderColor: BASECAMP.accent },
  planToggleTitle: { fontSize: 13.5, lineHeight: 18, fontFamily: "Inter_600SemiBold", color: BASECAMP.text },
  planToggleSub: {
    marginTop: 2, fontSize: 11, lineHeight: 15,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },

  detailsIntro: { marginTop: 24, gap: 5 },
  detailsTitle: { fontSize: 18, lineHeight: 23, fontFamily: "Inter_700Bold", color: BASECAMP.text },
  detailsSubtitle: { fontSize: 12.5, lineHeight: 18, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },
  detailsReassurance: { fontSize: 11, lineHeight: 15, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },

  discardBtn: { paddingVertical: 15, alignItems: "center", minHeight: HIT.minTarget },
  discardBtnText: { fontSize: 13.5, lineHeight: 18, fontFamily: "Inter_500Medium", color: BASECAMP.textDim },

});
