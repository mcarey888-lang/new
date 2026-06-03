import {
  Activity,
  ArrowLeft,
  CheckCircle,
  Pause,
  Play,
  Square,
  TrendingDown,
  TrendingUp,
  Wifi,
  WifiOff,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  AppStateStatus,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
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
import { router } from "expo-router";
import { T } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import type { TrailBenefit } from "@/constants/trailData";

// ── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

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

const ALTITUDE_NOISE_THRESHOLD = 1;
const GPS_MAX_ACCURACY_M = 25;   // reject fixes noisier than 25 m horizontal accuracy
const GPS_MAX_SPEED_KMH  = 20;   // ~12 mph — not achievable on foot / mountainside
const HIKE_LOCATION_TASK = "hike-location-task";
const BG_POINTS_KEY = "hike_bg_points";

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
    const raw = await AsyncStorage.getItem(BG_POINTS_KEY);
    const existing: TrackPoint[] = raw ? JSON.parse(raw) : [];
    for (const loc of locations) {
      if (loc.coords.accuracy != null && loc.coords.accuracy > GPS_MAX_ACCURACY_M) continue;
      existing.push({
        lat: loc.coords.latitude,
        lon: loc.coords.longitude,
        alt: loc.coords.altitude,
        ts: loc.timestamp,
        speed: loc.coords.speed,
        acc: loc.coords.accuracy,
      });
    }
    await AsyncStorage.setItem(BG_POINTS_KEY, JSON.stringify(existing));
  } catch { /* ignore */ }
});

// ── Screen ───────────────────────────────────────────────────────────────────

export default function HikeTrackingScreen() {
  const insets = useSafeAreaInsets();
  const { appMode, addSession, logExploreHike, trainingPlan } = useApp();

  // ── Route name (mandatory, locked once tracking starts) ──────────────────
  const [routeName, setRouteName]       = useState("");
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
  const [permDenied, setPermDenied]       = useState(false);
  const [saving, setSaving]               = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmLeave, setConfirmLeave]   = useState(false);
  const [drawerOpen, setDrawerOpen]       = useState(true);

  const trackPoints    = useRef<TrackPoint[]>([]);
  const lastAltRef     = useRef<number | null>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const statusRef      = useRef<TrackStatus>("idle");
  const initialPosRef  = useRef<{ lat: number; lon: number } | null>(null);
  const webViewRef        = useRef<WebView>(null);
  const webMapContainerRef = useRef<View>(null);
  const iframeRef          = useRef<any>(null);

  // ── Timestamp refs for background-safe timer ─────────────────────────────
  // Timer computed as Date.now() - trackStartMsRef - totalPausedMsRef
  // so it continues correctly even if the JS interval was paused by the OS.
  const trackStartMsRef  = useRef<number>(0);
  const totalPausedMsRef = useRef<number>(0);
  const pauseStartMsRef  = useRef<number>(0);

  // ── Web-only: mount the hike-map iframe ──────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const container = webMapContainerRef.current as unknown as HTMLElement;
    if (!container) return;
    const iframe = document.createElement("iframe");
    iframe.src = `${API_BASE}/hike-map`;
    iframe.style.cssText = "width:100%;height:100%;border:none;display:block;";
    iframe.allow = "geolocation";
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
        }
      } catch { /* GPS unavailable on simulator */ }
    }
    warmup();
    return () => { cancelled = true; };
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      safeRemoveSub(locationSubRef.current);
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

  // ── Sync background-collected GPS points into foreground state ────────────
  const syncBgPoints = useCallback(async () => {
    if (statusRef.current !== "tracking") return;
    try {
      const raw = await AsyncStorage.getItem(BG_POINTS_KEY);
      if (!raw) return;
      await AsyncStorage.removeItem(BG_POINTS_KEY);
      const newPts: TrackPoint[] = JSON.parse(raw);
      if (newPts.length === 0) return;
      const pts = trackPoints.current;
      const lastTs = pts.length > 0 ? pts[pts.length - 1].ts : 0;
      const fresh = newPts.filter(p => p.ts > lastTs);
      for (const p of fresh) {
        if (!isPlausiblePoint(p.lat, p.lon, p.ts, p.acc ?? null, pts)) continue;
        if (p.speed != null && p.speed >= 0) setCurrentSpeedKmh(p.speed * 3.6);
        if (p.alt != null) {
          setCurrentAltM(p.alt);
          if (lastAltRef.current !== null) {
            const delta = p.alt - lastAltRef.current;
            if (Math.abs(delta) >= ALTITUDE_NOISE_THRESHOLD) {
              if (delta > 0) setElevGainM(g => g + delta);
              else           setElevLossM(l => l + Math.abs(delta));
              lastAltRef.current = p.alt;
            }
          } else {
            lastAltRef.current = p.alt;
          }
        }
        if (pts.length > 0) {
          const prev = pts[pts.length - 1];
          const d = haversineKm(prev.lat, prev.lon, p.lat, p.lon);
          if (d > 0.003) setDistanceKm(km => km + d);
        }
        pts.push({ lat: p.lat, lon: p.lon, alt: p.alt, ts: p.ts });
        sendPointToMap(p.lat, p.lon);
      }
    } catch { /* ignore */ }
  }, [sendPointToMap]);

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

  // ── Auto-expand drawer when tracking starts ───────────────────────────────
  useEffect(() => {
    if (status === "tracking") setDrawerOpen(true);
  }, [status]);

  // ── Core tracking logic ──────────────────────────────────────────────────

  const startTracking = useCallback(async () => {
    if (!routeName.trim()) { setNameError(true); return; }
    setNameLocked(true);
    setNameError(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Request background location permission (needed for lock-screen tracking)
    if (Platform.OS !== "web") {
      await Location.requestBackgroundPermissionsAsync().catch(() => {});
    }

    statusRef.current = "tracking";
    setStatus("tracking");

    // Timestamp-based timer — survives OS throttling of JS intervals
    trackStartMsRef.current  = Date.now();
    totalPausedMsRef.current = 0;
    await AsyncStorage.removeItem(BG_POINTS_KEY).catch(() => {});

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

    if (Platform.OS === "web") return;

    // Start background-capable location task (keeps running when screen is locked)
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(HIKE_LOCATION_TASK).catch(() => false);
      if (isRunning) await Location.stopLocationUpdatesAsync(HIKE_LOCATION_TASK).catch(() => {});
      await Location.startLocationUpdatesAsync(HIKE_LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 3000,
        distanceInterval: 5,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "SummitReady — Recording Hike",
          notificationBody: "Your hike is being tracked. Tap to return to the app.",
          notificationColor: "#3ECF75",
        },
        pausesUpdatesAutomatically: false,
      });
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
            setCurrentAltM(altitude);
            if (lastAltRef.current !== null) {
              const delta = altitude - lastAltRef.current;
              if (Math.abs(delta) >= ALTITUDE_NOISE_THRESHOLD) {
                if (delta > 0) setElevGainM(g => g + delta);
                else           setElevLossM(l => l + Math.abs(delta));
                lastAltRef.current = altitude;
              }
            } else {
              lastAltRef.current = altitude;
            }
          }
          if (pts.length > 0) {
            const prev = pts[pts.length - 1];
            const d = haversineKm(prev.lat, prev.lon, latitude, longitude);
            if (d > 0.003) setDistanceKm(km => km + d);
          }
          pts.push({ lat: latitude, lon: longitude, alt: altitude, ts: loc.timestamp });
          sendPointToMap(latitude, longitude);
        },
      );
      locationSubRef.current = fgSub;
    } catch { /* foreground watch unavailable */ }
  }, [routeName, sendPointToMap]);

  const pauseTracking = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    statusRef.current = "paused";
    setStatus("paused");
    pauseStartMsRef.current = Date.now();
    timerRef.current && clearInterval(timerRef.current);
    if (Platform.OS !== "web") {
      Location.hasStartedLocationUpdatesAsync(HIKE_LOCATION_TASK)
        .then(started => { if (started) Location.stopLocationUpdatesAsync(HIKE_LOCATION_TASK).catch(() => {}); })
        .catch(() => {});
    }
    safeRemoveSub(locationSubRef.current);
    locationSubRef.current = null;
  }, []);

  const resumeTracking = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Accumulate pause duration so elapsed stays accurate
    if (pauseStartMsRef.current > 0) {
      totalPausedMsRef.current += Date.now() - pauseStartMsRef.current;
      pauseStartMsRef.current = 0;
    }
    statusRef.current = "tracking";
    setStatus("tracking");
    await AsyncStorage.removeItem(BG_POINTS_KEY).catch(() => {});

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - trackStartMsRef.current - totalPausedMsRef.current) / 1000
      );
      setElapsedSecs(Math.max(0, elapsed));
    }, 1000);

    if (Platform.OS === "web") return;

    try {
      await Location.startLocationUpdatesAsync(HIKE_LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 3000,
        distanceInterval: 5,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "SummitReady — Recording Hike",
          notificationBody: "Your hike is being tracked. Tap to return to the app.",
          notificationColor: "#3ECF75",
        },
        pausesUpdatesAutomatically: false,
      });
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
            setCurrentAltM(altitude);
            if (lastAltRef.current !== null) {
              const delta = altitude - lastAltRef.current;
              if (Math.abs(delta) >= ALTITUDE_NOISE_THRESHOLD) {
                if (delta > 0) setElevGainM(g => g + delta);
                else           setElevLossM(l => l + Math.abs(delta));
                lastAltRef.current = altitude;
              }
            } else {
              lastAltRef.current = altitude;
            }
          }
          if (pts.length > 0) {
            const prev = pts[pts.length - 1];
            const d = haversineKm(prev.lat, prev.lon, latitude, longitude);
            if (d > 0.003) setDistanceKm(km => km + d);
          }
          pts.push({ lat: latitude, lon: longitude, alt: altitude, ts: loc.timestamp });
          sendPointToMap(latitude, longitude);
        },
      );
      locationSubRef.current = fgSub;
    } catch { /* foreground watch unavailable */ }
  }, [sendPointToMap]);

  const finishHike = useCallback(async () => {
    // Flush any remaining background points BEFORE changing status.
    // Without this, points buffered while the screen was off are deleted unread.
    await syncBgPoints();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    statusRef.current = "finished";
    setStatus("finished");
    timerRef.current && clearInterval(timerRef.current);
    safeRemoveSub(locationSubRef.current);
    locationSubRef.current = null;
    if (Platform.OS !== "web") {
      Location.hasStartedLocationUpdatesAsync(HIKE_LOCATION_TASK)
        .then(started => { if (started) Location.stopLocationUpdatesAsync(HIKE_LOCATION_TASK).catch(() => {}); })
        .catch(() => {});
    }
    AsyncStorage.removeItem(BG_POINTS_KEY).catch(() => {});
  }, [syncBgPoints]);

  const handleStopPress = useCallback(() => {
    setDrawerOpen(false);
    setConfirmFinish(true);
  }, []);

  // ── Save completed hike ──────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    const name     = routeName.trim() || "Tracked Hike";
    const distKm   = parseFloat(distanceKm.toFixed(2));
    const elevGain = Math.round(elevGainM);
    const elevLoss = Math.round(elevLossM);
    const firstPt  = trackPoints.current[0];
    const routeId  = "tracked_" + Date.now().toString() + Math.random().toString(36).slice(2, 6);

    try {
      // 1 ── Always log the completed hike to the hike history
      await logExploreHike({
        name,
        date: new Date().toISOString(),
        distance: distKm,
        elevationGain: elevGain,
        timeTaken: Math.round(elapsedSecs / 60),   // store in minutes
        notes: `GPS tracked hike. Elevation loss: ${elevLoss} m. Avg speed: ${elapsedSecs > 0 && distKm > 0 ? (distKm / (elapsedSecs / 3600)).toFixed(1) : "—"} km/h.`,
      });

      // 2 ── In training mode, also log to the plan session log
      if (appMode !== "explore") {
        const currentWeek = trainingPlan?.findIndex(w => !w.sessions?.every((s: any) => s.completed)) ?? 0;
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
        });
      }

      // 3 ── Submit to backend so other users can discover this route
      try {
        await fetch(`${API_BASE}/tracked-routes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id:            routeId,
            name,
            location:      "GPS Tracked Route",
            distanceKm:    distKm,
            elevationGain: elevGain,
            elevationLoss: elevLoss,
            durationSecs:  elapsedSecs,
            difficulty:    computeDifficulty(distKm, elevGain),
            startLat:      firstPt?.lat ?? null,
            startLng:      firstPt?.lon ?? null,
            trackPoints:   trackPoints.current,
            notes:         `Avg speed: ${elapsedSecs > 0 && distKm > 0 ? (distKm / (elapsedSecs / 3600)).toFixed(1) : "0"} km/h.`,
          }),
        });
      } catch { /* backend submit is best-effort — local save already succeeded */ }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setSaving(false);
    }
  }, [appMode, routeName, distanceKm, elevGainM, elevLossM, elapsedSecs, trainingPlan, addSession, logExploreHike]);

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
          <Text style={s.msgBody}>Enable location permissions in your device settings to track your hike.</Text>
        </View>
      </View>
    );
  }

  // ── Render: finished summary ─────────────────────────────────────────────
  if (status === "finished") {
    return (
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          <Animated.View entering={FadeInDown.duration(400)} style={s.summaryContainer}>
            <View style={s.summaryIconRow}>
              <LinearGradient colors={["#3ECF75", "#2AB860"]} style={s.summaryIcon}>
                <CheckCircle size={32} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={s.summaryTitle}>Hike Complete</Text>
            <Text style={s.summaryTrail} numberOfLines={2}>{routeName || "Tracked Hike"}</Text>

            <View style={s.summaryGrid}>
              <View style={s.summaryCell}>
                <Text style={s.summaryCellValue}>{formatTime(elapsedSecs)}</Text>
                <Text style={s.summaryCellLabel}>Duration</Text>
              </View>
              <View style={[s.summaryCell, s.summaryCellMid]}>
                <Text style={s.summaryCellValue}>{fmtKm(distanceKm)}</Text>
                <Text style={s.summaryCellLabel}>Distance</Text>
              </View>
              <View style={s.summaryCell}>
                <Text style={[s.summaryCellValue, { color: T.green }]}>{fmtM(elevGainM)}</Text>
                <Text style={s.summaryCellLabel}>Gained</Text>
              </View>
            </View>

            <View style={s.summaryGrid}>
              <View style={s.summaryCell}>
                <Text style={[s.summaryCellValue, { color: T.orange }]}>{fmtM(elevLossM)}</Text>
                <Text style={s.summaryCellLabel}>Descended</Text>
              </View>
              <View style={[s.summaryCell, s.summaryCellMid]}>
                <Text style={s.summaryCellValue}>
                  {elapsedSecs > 0 && distanceKm > 0
                    ? `${(distanceKm / (elapsedSecs / 3600)).toFixed(1)} km/h`
                    : "—"}
                </Text>
                <Text style={s.summaryCellLabel}>Avg Speed</Text>
              </View>
              <View style={s.summaryCell}>
                <Text style={s.summaryCellValue}>{currentAltM != null ? fmtM(currentAltM) : "—"}</Text>
                <Text style={s.summaryCellLabel}>Final Alt</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#3ECF75", "#2AB860"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.saveBtnGrad}
              >
                <Text style={s.saveBtnText}>{saving ? "Saving…" : "Save Route"}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={s.discardBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={s.discardBtnText}>Discard</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // ── Render: tracking / idle ──────────────────────────────────────────────
  const isTracking = status === "tracking";
  const isPaused   = status === "paused";
  const isIdle     = status === "idle";
  const canStart   = gpsReady && routeName.trim().length > 0;

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
            if (isTracking || isPaused) setConfirmLeave(true);
            else router.back();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={22} color={T.text} />
        </TouchableOpacity>

        <Text style={s.headerTitle} numberOfLines={1}>
          {nameLocked && routeName ? routeName : "Start Hiking"}
        </Text>

        <View style={[s.gpsPill, gpsReady && s.gpsPillReady]}>
          <Animated.View style={[s.gpsDot, isTracking && pulseStyle]} />
          <Text style={[s.gpsText, gpsReady && s.gpsTextReady]}>
            {gpsReady ? "GPS" : "…"}
          </Text>
        </View>
      </View>

      {/* ── Route name card — floats over map, only visible when idle ── */}
      {isIdle && (
        <Animated.View
          entering={FadeInDown.delay(50).duration(400)}
          style={[s.nameOverlay, { top: insets.top + 70 }]}
        >
          <Text style={s.nameLabel}>Route name <Text style={s.nameRequired}>*</Text></Text>
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
          {nameError && (
            <Text style={s.nameErrorText}>Please name your route before starting</Text>
          )}
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

        {/* ── Idle state: GPS hint + start button ── */}
        {isIdle && (
          <View style={s.sheetBody}>
            {!gpsReady ? (
              <View style={s.gpsNote}>
                <WifiOff size={13} color={T.textMuted} />
                <Text style={s.gpsNoteText}>Waiting for GPS — go outdoors for best accuracy</Text>
              </View>
            ) : (
              <View style={s.gpsNote}>
                <Wifi size={13} color={T.green} />
                <Text style={[s.gpsNoteText, { color: "rgba(62,207,117,0.8)" }]}>
                  GPS ready — name your route above
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[s.startBtn, !canStart && { opacity: 0.45 }]}
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
                  {!gpsReady
                    ? "Acquiring GPS…"
                    : !routeName.trim()
                      ? "Name your route first"
                      : "Start Tracking"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Tracking / paused: full stats + controls (collapsible) ── */}
        {!isIdle && drawerOpen && (
          <Animated.View entering={FadeIn.duration(200)} style={s.sheetBody}>

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

      {/* ── Leave-while-tracking confirm sheet ── */}
      {confirmLeave && (
        <Animated.View entering={FadeInUp.duration(250)} style={[s.confirmSheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={s.confirmHandle} />
          <Text style={s.confirmTitle}>Leave tracking?</Text>
          <Text style={s.confirmSub}>Your hike progress will be lost and nothing will be saved.</Text>
          <TouchableOpacity style={s.confirmDestructive} onPress={() => { setConfirmLeave(false); router.back(); }} activeOpacity={0.85}>
            <Text style={s.confirmDestructiveText}>Leave & Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.confirmCancel} onPress={() => setConfirmLeave(false)} activeOpacity={0.7}>
            <Text style={s.confirmCancelText}>Stay</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
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
  headerTitle: {
    flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold",
    color: T.text, textAlign: "center",
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
  summaryContainer: { alignItems: "center", gap: 20, paddingTop: 32 },
  summaryIconRow:   { marginBottom: 4 },
  summaryIcon: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center",
  },
  summaryTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: T.text },
  summaryTrail: {
    fontSize: 16, fontFamily: "Inter_400Regular", color: T.textMuted,
    textAlign: "center", paddingHorizontal: 20,
  },
  summaryGrid: {
    flexDirection: "row", width: "100%",
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    paddingVertical: 20,
  },
  summaryCell: { flex: 1, alignItems: "center", gap: 6 },
  summaryCellMid: {
    borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  summaryCellValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: T.text },
  summaryCellLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },

  saveBtn: { width: "100%", borderRadius: 18, overflow: "hidden", marginTop: 8 },
  saveBtnGrad: {
    paddingVertical: 18, alignItems: "center", justifyContent: "center",
  },
  saveBtnText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
  discardBtn:  { paddingVertical: 14, alignItems: "center" },
  discardBtnText: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted },

  // Permission denied
  centeredMsg: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 40 },
  msgTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: T.text, textAlign: "center" },
  msgBody:  { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 22 },

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
});
