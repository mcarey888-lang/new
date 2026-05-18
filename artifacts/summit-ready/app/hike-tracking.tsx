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
  TouchableOpacity,
  View,
} from "react-native";
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
import { T } from "@/constants/theme";
import { useApp } from "@/context/AppContext";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function fmtKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`;
}

function fmtM(m: number): string {
  return `${Math.round(m)} m`;
}

type TrackStatus = "idle" | "tracking" | "paused" | "finished";

interface TrackPoint {
  lat: number;
  lon: number;
  alt: number | null;
  ts: number;
}

const ALTITUDE_NOISE_THRESHOLD = 2; // metres — ignore changes smaller than this

// ── Screen ───────────────────────────────────────────────────────────────────

export default function HikeTrackingScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ name: string; location: string }>();
  const { appMode, addSession, logExploreHike, trainingPlan } = useApp();

  const trailName = params.name ?? "Hike";

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

  // Pulsing dot animation while tracking
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (status === "tracking") {
      pulse.value = withRepeat(withTiming(0.3, { duration: 900 }), -1, true);
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [status]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  // ── Permission + GPS warmup ──────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function warmup() {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (permStatus !== "granted") { setPermDenied(true); return; }
      // Pre-warm GPS so first fix is faster
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          setCurrentAltM(pos.coords.altitude);
          setGpsReady(true);
        }
      } catch { /* GPS unavailable on simulator etc */ }
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

  // ── Core tracking logic ──────────────────────────────────────────────────

  const startTracking = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    statusRef.current = "tracking";
    setStatus("tracking");

    // Start timer
    timerRef.current = setInterval(() => {
      setElapsedSecs(s => s + 1);
    }, 1000);

    // Start location subscription
    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 5,      // update every 5 m moved
        timeInterval: 3000,        // or every 3 s
      },
      (loc) => {
        if (statusRef.current !== "tracking") return;

        const { latitude, longitude, altitude, speed } = loc.coords;
        const ts = loc.timestamp;

        // Speed (m/s → km/h)
        if (speed != null && speed >= 0) {
          setCurrentSpeedKmh(speed * 3.6);
        }

        // Altitude
        if (altitude != null) {
          setCurrentAltM(altitude);

          // Elevation gain/loss with noise filter
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

        // Distance
        const pts = trackPoints.current;
        if (pts.length > 0) {
          const prev = pts[pts.length - 1];
          const d = haversineKm(prev.lat, prev.lon, latitude, longitude);
          if (d > 0.003) { // ignore jitter < 3 m
            setDistanceKm(km => km + d);
          }
        }

        trackPoints.current.push({ lat: latitude, lon: longitude, alt: altitude, ts });
      },
    );

    locationSubRef.current = sub;
  }, []);

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
    // Re-subscribe to location
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
      },
    ).then(sub => { locationSubRef.current = sub; });
  }, []);

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
      // Very short hike — just confirm discard
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
    try {
      if (appMode === "explore") {
        await logExploreHike({
          name: trailName,
          date: new Date().toISOString(),
          distance: parseFloat(distanceKm.toFixed(2)),
          elevationGain: Math.round(elevGainM),
          timeTaken: elapsedSecs,
          notes: `GPS tracked hike. Elevation loss: ${Math.round(elevLossM)} m.`,
        });
      } else {
        // Summit mode — save as a training session
        const currentWeek = trainingPlan?.findIndex(w => !w.sessions?.every((s: any) => s.completed)) ?? 0;
        await addSession({
          date: new Date().toISOString(),
          type: "cardio",
          distance: parseFloat(distanceKm.toFixed(2)),
          elevationGain: Math.round(elevGainM),
          duration: Math.round(elapsedSecs / 60),
          effort: 3,
          notes: `GPS tracked: ${trailName}. Elev loss: ${Math.round(elevLossM)} m.`,
          completed: true,
          weekNumber: Math.max(0, currentWeek),
          hillName: trailName,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert("Save Failed", "Unable to save your hike. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [appMode, distanceKm, elevGainM, elevLossM, elapsedSecs, trailName, trainingPlan, addSession, logExploreHike]);

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
          <Text style={s.msgBody}>
            Enable location permissions in your device settings to track your hike.
          </Text>
        </View>
      </View>
    );
  }

  // ── Render: finished summary ─────────────────────────────────────────────

  if (status === "finished") {
    return (
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
        <Animated.View entering={FadeInDown.duration(400)} style={s.summaryContainer}>
          <View style={s.summaryIconRow}>
            <LinearGradient
              colors={["#3ECF75", "#2AB860"]}
              style={s.summaryIcon}
            >
              <CheckCircle size={32} color="#fff" />
            </LinearGradient>
          </View>
          <Text style={s.summaryTitle}>Hike Complete</Text>
          <Text style={s.summaryTrail} numberOfLines={2}>{trailName}</Text>

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
                  ? `${(distanceKm / (elapsedSecs / 3600)).toFixed(1)}`
                  : "—"} km/h
              </Text>
              <Text style={s.summaryCellLabel}>Avg Speed</Text>
            </View>
            <View style={s.summaryCell}>
              <Text style={s.summaryCellValue}>
                {currentAltM != null ? fmtM(currentAltM) : "—"}
              </Text>
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
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.saveBtnGrad}
            >
              <Text style={s.saveBtnText}>{saving ? "Saving…" : "Save to Log"}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={s.discardBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={s.discardBtnText}>Discard</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  // ── Render: tracking / idle ──────────────────────────────────────────────

  const isTracking = status === "tracking";
  const isPaused   = status === "paused";
  const isIdle     = status === "idle";

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

        <Text style={s.headerTitle} numberOfLines={1}>{trailName}</Text>

        {/* GPS status */}
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
        scrollEnabled={false}
      >
        {/* Status label */}
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

        {/* Big timer */}
        <View style={s.timerBlock}>
          <Text style={s.timerText}>{formatTime(elapsedSecs)}</Text>
          <Text style={s.timerLabel}>elapsed</Text>
        </View>

        {/* Main stats */}
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
            <Text style={s.statValue}>
              {currentAltM != null ? fmtM(currentAltM) : "—"}
            </Text>
            <Text style={s.statLabel}>Altitude</Text>
          </View>
        </Animated.View>

        {/* Secondary stats */}
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

        {/* Controls */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={s.controls}>

          {/* Start (idle) */}
          {isIdle && (
            <TouchableOpacity
              style={[s.startBtn, !gpsReady && { opacity: 0.55 }]}
              onPress={startTracking}
              disabled={!gpsReady}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#3ECF75", "#2AB860"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.startBtnGrad}
              >
                <Play size={20} color="#fff" fill="#fff" />
                <Text style={s.startBtnText}>
                  {gpsReady ? "Start Tracking" : "Acquiring GPS…"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Pause / Resume */}
          {(isTracking || isPaused) && (
            <TouchableOpacity
              style={isPaused ? s.resumeBtn : s.pauseBtn}
              onPress={isPaused ? resumeTracking : pauseTracking}
              activeOpacity={0.85}
            >
              {isPaused
                ? <Play size={20} color={T.green} />
                : <Pause size={20} color={T.blue} />
              }
              <Text style={[s.pauseBtnText, isPaused && { color: T.green }]}>
                {isPaused ? "Resume" : "Pause"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Stop / Finish */}
          {(isTracking || isPaused) && (
            <TouchableOpacity style={s.stopBtn} onPress={handleStopPress} activeOpacity={0.8}>
              <Square size={16} color={T.red} fill={T.red} />
              <Text style={s.stopBtnText}>Finish Hike</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* GPS note */}
        {isIdle && !gpsReady && (
          <Animated.View entering={FadeIn.duration(600)} style={s.gpsNote}>
            <WifiOff size={14} color={T.textMuted} />
            <Text style={s.gpsNoteText}>
              Waiting for GPS signal. Go outdoors for best accuracy.
            </Text>
          </Animated.View>
        )}
        {isIdle && gpsReady && (
          <Animated.View entering={FadeIn.duration(400)} style={s.gpsNote}>
            <Wifi size={14} color={T.green} />
            <Text style={[s.gpsNoteText, { color: "rgba(62,207,117,0.75)" }]}>
              GPS ready. Distance &amp; elevation tracked via phone sensors.
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
  header:             { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  headerTitle:        { flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold", color: T.text },
  gpsPill:            { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.06)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  gpsPillReady:       { borderColor: "rgba(62,207,117,0.3)", backgroundColor: "rgba(62,207,117,0.07)" },
  gpsDot:             { width: 7, height: 7, borderRadius: 4, backgroundColor: T.textMuted },
  gpsText:            { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  gpsTextReady:       { color: T.green },
  backBtn:            { padding: 4 },

  // Content
  content:            { paddingHorizontal: 24, alignItems: "center" },

  // Status
  statusRow:          { marginTop: 8, marginBottom: 4 },
  statusPill:         { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.06)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  statusPillTracking: { backgroundColor: "rgba(62,207,117,0.08)", borderColor: "rgba(62,207,117,0.25)" },
  statusPillPaused:   { backgroundColor: "rgba(255,152,0,0.08)",  borderColor: "rgba(255,152,0,0.25)" },
  statusText:         { fontSize: 11, fontFamily: "Inter_700Bold", color: T.textMuted, letterSpacing: 1.5 },

  // Timer
  timerBlock:         { alignItems: "center", marginTop: 20, marginBottom: 28 },
  timerText:          { fontSize: 64, fontFamily: "Inter_700Bold", color: T.text, letterSpacing: -2, lineHeight: 72 },
  timerLabel:         { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 4, letterSpacing: 1 },

  // Stats row 1
  statsRow:           { flexDirection: "row", width: "100%", backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.cardBorder, marginBottom: 10, overflow: "hidden" },
  statCell:           { flex: 1, alignItems: "center", paddingVertical: 18 },
  statCellMid:        { borderLeftWidth: 1, borderRightWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  statValueRow:       { flexDirection: "row", alignItems: "center" },
  statValue:          { fontSize: 20, fontFamily: "Inter_700Bold", color: T.text },
  statLabel:          { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 3 },

  // Stats row 2
  statsRow2:          { flexDirection: "row", width: "100%", backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.cardBorder, marginBottom: 32, overflow: "hidden" },
  statCell2:          { flex: 1, alignItems: "center", paddingVertical: 14 },
  statValue2:         { fontSize: 17, fontFamily: "Inter_600SemiBold", color: T.text },

  // Controls
  controls:           { width: "100%", gap: 12 },
  startBtn:           { width: "100%", borderRadius: 16, overflow: "hidden" },
  startBtnGrad:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 18 },
  startBtnText:       { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },

  pauseBtn:           { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, borderColor: T.blue, backgroundColor: "rgba(74,159,245,0.08)" },
  resumeBtn:          { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, borderColor: T.green, backgroundColor: "rgba(62,207,117,0.08)" },
  pauseBtnText:       { fontSize: 16, fontFamily: "Inter_600SemiBold", color: T.blue },

  stopBtn:            { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,68,68,0.35)", backgroundColor: "rgba(255,68,68,0.07)" },
  stopBtnText:        { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.red },

  // GPS note
  gpsNote:            { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 16, paddingHorizontal: 4 },
  gpsNoteText:        { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, flex: 1, lineHeight: 17 },

  // Permission denied
  centeredMsg:        { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 16 },
  msgTitle:           { fontSize: 20, fontFamily: "Inter_700Bold", color: T.text, textAlign: "center" },
  msgBody:            { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 22 },

  // Summary
  summaryContainer:   { flex: 1, paddingHorizontal: 24, paddingTop: 40, alignItems: "center" },
  summaryIconRow:     { marginBottom: 16 },
  summaryIcon:        { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  summaryTitle:       { fontSize: 28, fontFamily: "Inter_700Bold", color: T.text, marginBottom: 6 },
  summaryTrail:       { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, marginBottom: 28, textAlign: "center" },
  summaryGrid:        { flexDirection: "row", width: "100%", backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.cardBorder, marginBottom: 10, overflow: "hidden" },
  summaryCell:        { flex: 1, alignItems: "center", paddingVertical: 18 },
  summaryCellMid:     { borderLeftWidth: 1, borderRightWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  summaryCellValue:   { fontSize: 18, fontFamily: "Inter_700Bold", color: T.text },
  summaryCellLabel:   { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 3 },
  saveBtn:            { width: "100%", borderRadius: 16, overflow: "hidden", marginTop: 20 },
  saveBtnGrad:        { alignItems: "center", justifyContent: "center", paddingVertical: 18 },
  saveBtnText:        { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  discardBtn:         { marginTop: 12, paddingVertical: 14, alignItems: "center", width: "100%" },
  discardBtnText:     { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted },
});
