import {
  Activity,
  ArrowLeft,
  CheckCircle,
  Compass,
  MoveVertical,
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
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
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
}

const ALTITUDE_NOISE_THRESHOLD = 2;

// ── Screen ───────────────────────────────────────────────────────────────────

export default function HikeTrackingScreen() {
  const insets = useSafeAreaInsets();
  const { appMode, addSession, logExploreHike, trainingPlan, addCustomRoute } = useApp();

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

  const trackPoints    = useRef<TrackPoint[]>([]);
  const lastAltRef     = useRef<number | null>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const statusRef      = useRef<TrackStatus>("idle");
  const webViewRef        = useRef<WebView>(null);
  const webMapContainerRef = useRef<View>(null);
  const iframeRef          = useRef<any>(null);

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
      locationSubRef.current?.remove();
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

  // ── Core tracking logic ──────────────────────────────────────────────────
  const startTracking = useCallback(async () => {
    if (!routeName.trim()) { setNameError(true); return; }
    setNameLocked(true);
    setNameError(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    statusRef.current = "tracking";
    setStatus("tracking");

    timerRef.current = setInterval(() => setElapsedSecs(s => s + 1), 1000);

    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 3000 },
      (loc) => {
        if (statusRef.current !== "tracking") return;
        const { latitude, longitude, altitude, speed } = loc.coords;

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

        const pts = trackPoints.current;
        if (pts.length > 0) {
          const prev = pts[pts.length - 1];
          const d = haversineKm(prev.lat, prev.lon, latitude, longitude);
          if (d > 0.003) setDistanceKm(km => km + d);
        }

        trackPoints.current.push({ lat: latitude, lon: longitude, alt: altitude, ts: loc.timestamp });
        sendPointToMap(latitude, longitude);
      },
    );
    locationSubRef.current = sub;
  }, [routeName, sendPointToMap]);

  const pauseTracking = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    statusRef.current = "paused";
    setStatus("paused");
    timerRef.current && clearInterval(timerRef.current);
    locationSubRef.current?.remove();
    locationSubRef.current = null;
  }, []);

  const resumeTracking = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    statusRef.current = "tracking";
    setStatus("tracking");
    timerRef.current = setInterval(() => setElapsedSecs(s => s + 1), 1000);
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 3000 },
      (loc) => {
        if (statusRef.current !== "tracking") return;
        const { latitude, longitude, altitude, speed } = loc.coords;
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
        const pts = trackPoints.current;
        if (pts.length > 0) {
          const prev = pts[pts.length - 1];
          const d = haversineKm(prev.lat, prev.lon, latitude, longitude);
          if (d > 0.003) setDistanceKm(km => km + d);
        }
        trackPoints.current.push({ lat: latitude, lon: longitude, alt: altitude, ts: loc.timestamp });
        sendPointToMap(latitude, longitude);
      },
    ).then(sub => { locationSubRef.current = sub; });
  }, [sendPointToMap]);

  const finishHike = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    statusRef.current = "finished";
    setStatus("finished");
    timerRef.current && clearInterval(timerRef.current);
    locationSubRef.current?.remove();
    locationSubRef.current = null;
  }, []);

  const handleStopPress = useCallback(() => {
    if (elapsedSecs < 30) {
      Alert.alert("Stop Tracking", "Discard this hike?", [
        { text: "Cancel", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => router.back() },
      ]);
      return;
    }
    Alert.alert("Finish Hike", "Stop tracking and see your summary?", [
      { text: "Keep Going", style: "cancel" },
      { text: "Finish", onPress: finishHike },
    ]);
  }, [elapsedSecs, finishHike]);

  // ── Save completed hike ──────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    const name = routeName.trim() || "Tracked Hike";
    const distKm  = parseFloat(distanceKm.toFixed(2));
    const elevGain = Math.round(elevGainM);
    const firstPt  = trackPoints.current[0];

    try {
      // Always save as a custom route (visible in the trails list)
      await addCustomRoute({
        name,
        location: "GPS Tracked Route",
        distance: distKm,
        elevationGain: elevGain,
        estimatedTime: formatTimeHM(elapsedSecs),
        difficulty: computeDifficulty(distKm, elevGain),
        terrain: "mixed",
        routeType: "out-and-back",
        bestFor: ["training"],
        description: `GPS tracked hike: ${formatTime(elapsedSecs)} duration, ${fmtKm(distKm)} distance, ${fmtM(elevGain)} elevation gain.`,
        trainingBenefits: inferBenefits(distKm, elevGain),
        emoji: "🥾",
        lat: firstPt?.lat,
        lng: firstPt?.lon,
        notes: `Elevation loss: ${Math.round(elevLossM)} m. Avg speed: ${elapsedSecs > 0 && distKm > 0 ? (distKm / (elapsedSecs / 3600)).toFixed(1) : "—"} km/h.`,
      });

      // Also log to session / explore log as before
      if (appMode === "explore") {
        await logExploreHike({
          name,
          date: new Date().toISOString(),
          distance: distKm,
          elevationGain: elevGain,
          timeTaken: elapsedSecs,
          notes: `GPS tracked hike. Elevation loss: ${Math.round(elevLossM)} m.`,
        });
      } else {
        const currentWeek = trainingPlan?.findIndex(w => !w.sessions?.every((s: any) => s.completed)) ?? 0;
        await addSession({
          date: new Date().toISOString(),
          type: "cardio",
          distance: distKm,
          elevationGain: elevGain,
          duration: Math.round(elapsedSecs / 60),
          effort: 3,
          notes: `GPS tracked: ${name}. Elev loss: ${Math.round(elevLossM)} m.`,
          completed: true,
          weekNumber: Math.max(0, currentWeek),
          hillName: name,
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert("Save Failed", "Unable to save your hike. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [appMode, routeName, distanceKm, elevGainM, elevLossM, elapsedSecs, trainingPlan, addSession, logExploreHike, addCustomRoute]);

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
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => {
          if (isTracking || isPaused) {
            Alert.alert("Leave Tracking", "Your hike progress will be lost.", [
              { text: "Stay", style: "cancel" },
              { text: "Leave", style: "destructive", onPress: () => router.back() },
            ]);
          } else {
            router.back();
          }
        }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled
      >

        {/* ── Route name input ─────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={s.nameCard}>
          <Text style={s.nameLabel}>Route name <Text style={s.nameRequired}>*</Text></Text>
          <TextInput
            style={[s.nameInput, nameError && s.nameInputError, nameLocked && s.nameInputLocked]}
            value={routeName}
            onChangeText={(t) => { setRouteName(t); if (t.trim()) setNameError(false); }}
            placeholder="e.g. Morning Ridge Loop"
            placeholderTextColor={T.textDim}
            editable={!nameLocked}
            autoCorrect={false}
            returnKeyType="done"
            maxLength={60}
          />
          {nameError && (
            <Text style={s.nameErrorText}>Please name your route before starting</Text>
          )}
        </Animated.View>

        {/* ── Status + timer ───────────────────────────────────────────── */}
        <View style={s.statusRow}>
          <View style={[s.statusPill,
            isTracking && s.statusPillTracking,
            isPaused   && s.statusPillPaused,
          ]}>
            {isTracking && <Activity size={12} color={T.green} />}
            {isPaused   && <Pause size={12} color={T.orange} />}
            {isIdle     && <Compass size={12} color={T.textMuted} />}
            <Text style={[s.statusText,
              isTracking && { color: T.green },
              isPaused   && { color: T.orange },
            ]}>
              {isTracking ? "TRACKING" : isPaused ? "PAUSED" : "READY"}
            </Text>
          </View>
        </View>

        <View style={s.timerBlock}>
          <Text style={s.timerText}>{formatTime(elapsedSecs)}</Text>
          <Text style={s.timerLabel}>elapsed</Text>
        </View>

        {/* ── Main stats ───────────────────────────────────────────────── */}
        <Animated.View entering={FadeIn.delay(100).duration(400)} style={s.statsRow}>
          <View style={s.statCell}>
            <Text style={s.statValue}>{fmtKm(distanceKm)}</Text>
            <Text style={s.statLabel}>Distance</Text>
          </View>
          <View style={[s.statCell, s.statCellMid]}>
            <View style={s.statValueRow}>
              <TrendingUp size={14} color={T.green} style={{ marginRight: 3 }} />
              <Text style={[s.statValue, { color: T.green }]}>{fmtM(elevGainM)}</Text>
            </View>
            <Text style={s.statLabel}>Gained</Text>
          </View>
          <View style={s.statCell}>
            <Text style={s.statValue}>{currentAltM != null ? fmtM(currentAltM) : "—"}</Text>
            <Text style={s.statLabel}>Altitude</Text>
          </View>
        </Animated.View>

        {/* ── Secondary stats ──────────────────────────────────────────── */}
        <Animated.View entering={FadeIn.delay(200).duration(400)} style={s.statsRow2}>
          <View style={s.statCell2}>
            <Text style={s.statValue2}>
              {currentSpeedKmh > 0 ? `${currentSpeedKmh.toFixed(1)} km/h` : "—"}
            </Text>
            <Text style={s.statLabel}>Speed</Text>
          </View>
          <View style={[s.statCell2, { borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.07)" }]}>
            <View style={s.statValueRow}>
              <TrendingDown size={13} color={T.orange} style={{ marginRight: 3 }} />
              <Text style={[s.statValue2, { color: T.orange }]}>{fmtM(elevLossM)}</Text>
            </View>
            <Text style={s.statLabel}>Descended</Text>
          </View>
        </Animated.View>

        {/* ── Live route map ───────────────────────────────────────────── */}
        <Animated.View entering={FadeIn.delay(250).duration(400)} style={s.mapWrap}>
          {Platform.OS !== "web" ? (
            <WebView
              ref={webViewRef}
              source={{ uri: `${API_BASE}/hike-map` }}
              style={s.mapWebView}
              scrollEnabled={false}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={["*"]}
            />
          ) : (
            <View ref={webMapContainerRef} style={s.mapWebView} />
          )}
        </Animated.View>

        {/* ── Controls ─────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={s.controls}>

          {isIdle && (
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
          )}

          {(isTracking || isPaused) && (
            <TouchableOpacity
              style={isPaused ? s.resumeBtn : s.pauseBtn}
              onPress={isPaused ? resumeTracking : pauseTracking}
              activeOpacity={0.85}
            >
              {isPaused ? <Play size={20} color={T.green} /> : <Pause size={20} color={T.blue} />}
              <Text style={[s.pauseBtnText, isPaused && { color: T.green }]}>
                {isPaused ? "Resume" : "Pause"}
              </Text>
            </TouchableOpacity>
          )}

          {(isTracking || isPaused) && (
            <TouchableOpacity style={s.stopBtn} onPress={handleStopPress} activeOpacity={0.8}>
              <Square size={16} color={T.red} fill={T.red} />
              <Text style={s.stopBtnText}>Finish Hike</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* ── GPS notes ────────────────────────────────────────────────── */}
        {isIdle && !gpsReady && (
          <Animated.View entering={FadeIn.duration(600)} style={s.gpsNote}>
            <WifiOff size={14} color={T.textMuted} />
            <Text style={s.gpsNoteText}>Waiting for GPS signal. Go outdoors for best accuracy.</Text>
          </Animated.View>
        )}
        {isIdle && gpsReady && (
          <Animated.View entering={FadeIn.duration(400)} style={s.gpsNote}>
            <Wifi size={14} color={T.green} />
            <Text style={[s.gpsNoteText, { color: "rgba(62,207,117,0.75)" }]}>
              GPS ready — name your route and tap Start Tracking.
            </Text>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:               { flex: 1, backgroundColor: "#050D1A" },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", gap: 12,
  },
  headerTitle: {
    flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold",
    color: T.text, textAlign: "center",
  },
  backBtn: { padding: 4 },

  // GPS pill
  gpsPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  gpsPillReady: { borderColor: "rgba(62,207,117,0.35)", backgroundColor: "rgba(62,207,117,0.08)" },
  gpsDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.textMuted },
  gpsText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  gpsTextReady: { color: T.green },

  // Content
  content: { paddingHorizontal: 20, gap: 16, paddingTop: 16 },

  // Route name card
  nameCard: {
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    padding: 16, gap: 8,
  },
  nameLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  nameRequired: { color: T.green },
  nameInput: {
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, fontFamily: "Inter_600SemiBold", color: T.text,
  },
  nameInputError: { borderColor: T.red + "80" },
  nameInputLocked: { opacity: 0.6 },
  nameErrorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.red, marginTop: 2 },

  // Status
  statusRow:     { alignItems: "center" },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  statusPillTracking: { backgroundColor: "rgba(62,207,117,0.1)", borderColor: "rgba(62,207,117,0.3)" },
  statusPillPaused:   { backgroundColor: "rgba(251,146,60,0.1)", borderColor: "rgba(251,146,60,0.3)" },
  statusText: { fontSize: 11, fontFamily: "Inter_700Bold", color: T.textMuted, letterSpacing: 1 },

  // Timer
  timerBlock: { alignItems: "center", gap: 2 },
  timerText:  { fontSize: 52, fontFamily: "Inter_700Bold", color: T.text, letterSpacing: -1 },
  timerLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, textTransform: "uppercase", letterSpacing: 1 },

  // Stats row (main)
  statsRow: {
    flexDirection: "row", backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    paddingVertical: 18,
  },
  statCell: { flex: 1, alignItems: "center", gap: 6 },
  statCellMid: {
    borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  statValueRow: { flexDirection: "row", alignItems: "center" },
  statValue:    { fontSize: 22, fontFamily: "Inter_700Bold", color: T.text },
  statLabel:    { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },

  // Stats row 2
  statsRow2: {
    flexDirection: "row", backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)",
    paddingVertical: 14,
  },
  statCell2:  { flex: 1, alignItems: "center", gap: 4 },
  statValue2: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.text },

  // Live map
  mapWrap: {
    borderRadius: 18, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    height: 230,
  },
  mapWebView: { flex: 1, backgroundColor: "#050D1A" },

  // Controls
  controls: { gap: 12 },
  startBtn: { borderRadius: 18, overflow: "hidden" },
  startBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 18,
  },
  startBtnText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
  pauseBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 16, borderRadius: 16,
    backgroundColor: "rgba(96,165,250,0.1)", borderWidth: 1, borderColor: "rgba(96,165,250,0.3)",
  },
  resumeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 16, borderRadius: 16,
    backgroundColor: "rgba(62,207,117,0.1)", borderWidth: 1, borderColor: "rgba(62,207,117,0.3)",
  },
  pauseBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: T.blue },
  stopBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: 16,
    backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)",
  },
  stopBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.red },

  // GPS note
  gpsNote: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 16,
  },
  gpsNoteText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", flex: 1 },

  // Finished summary
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
});
