import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/expo";
import { ChevronLeft, ChevronRight, Map as MapIcon, Play, Route as RouteIcon, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TrackMap, type TrackMapHandle } from "@/components/track/TrackMap";
import { useApp } from "@/context/AppContext";
import { useGpsStatus } from "@/hooks/useGpsStatus";
import { useScreenView } from "@/lib/analytics";
import { T } from "@/constants/theme";
import { discardActiveHike, readActiveHike } from "@/utils/activeHikeSession";
import { canStart, gpsDisplay } from "@/utils/gpsStatus";
import {
  clearPendingHikeSelection, readPendingHikeSelection, savePendingHikeSelection,
} from "@/utils/pendingHikeSelection";
import { describeRoute, listRoutes, type PlannedRoute } from "@/utils/plannedRouteApi";
import { getCurrentWeek } from "@/utils/planGenerator";
import {
  contextDetail, contextLabel, FREE_HIKE, isUsableIn, launchParamsFor,
  nextExpeditionStage, nextTrainingSession, resolveTrackContext, storedFromContext,
  trainingContextFor, type TrackContext,
} from "@/utils/trackContext";

/** How long an abandoned session stays resumable before it is dropped. */
const RESUME_WINDOW_MS = 24 * 60 * 60 * 1000;

function useActiveHike() {
  const { isLoaded: authLoaded, userId } = useAuth();
  const [activeHike, setActiveHike] = useState<{ routeName: string; routeId: string } | null>(null);

  useEffect(() => {
    if (!authLoaded || !userId) { setActiveHike(null); return; }
    const ownerUserId = userId;
    let mounted = true;
    async function check() {
      try {
        const session = await readActiveHike<any>(ownerUserId);
        if (!mounted) return;
        if (!session) { setActiveHike(null); return; }
        if (Date.now() - (session.savedAt ?? 0) < RESUME_WINDOW_MS) setActiveHike(session);
        else { await discardActiveHike(session); if (mounted) setActiveHike(null); }
      } catch { /* a read failure is not a reason to hide the screen */ }
    }
    void check();
    const id = setInterval(check, 3000);
    return () => { mounted = false; clearInterval(id); };
  }, [authLoaded, userId]);

  return activeHike;
}

export function SharedTrackScreen() {
  useScreenView("track");
  const insets = useSafeAreaInsets();
  const { userId, getToken } = useAuth();
  const {
    shellMode, activeExpedition, activeExpeditionId, trainingPlan, completedPlanSessions,
  } = useApp();
  const params = useLocalSearchParams<{ sessionKey?: string; stageName?: string; from?: string }>();

  const activeHike = useActiveHike();
  const { state: gps, accuracyM } = useGpsStatus(!activeHike);
  const gpsText = gpsDisplay(gps, accuracyM);

  const [context, setContext] = useState<TrackContext>(FREE_HIKE);
  const [hydrated, setHydrated] = useState(false);
  const [route, setRoute] = useState<PlannedRoute | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [routesOpen, setRoutesOpen] = useState(false);
  const [routes, setRoutes] = useState<PlannedRoute[] | null>(null);
  const [starting, setStarting] = useState(false);
  const startedRef = useRef(false);
  const mapRef = useRef<TrackMapHandle | null>(null);
  const [sheetHeight, setSheetHeight] = useState(0);

  /* The sheet covers the bottom of the map, where the attribution sits.
     "Contains OS data (c) Crown copyright" is a licence condition, so the map
     is told how much room is taken and lifts it clear. */
  useEffect(() => {
    if (!sheetHeight) return;
    mapRef.current?.send({ type: "bottomInset", px: Math.round(sheetHeight) });
  }, [sheetHeight]);

  /* What this shell can offer besides a free hike. */
  const currentWeek = getCurrentWeek(trainingPlan);
  const nextSession = useMemo(
    () => nextTrainingSession(currentWeek, completedPlanSessions),
    [currentWeek, completedPlanSessions],
  );
  const nextStage = useMemo(
    () => nextExpeditionStage(activeExpedition?.virtualHills, activeExpedition?.completedRoutes),
    [activeExpedition],
  );

  /* The context asked for by whoever opened this screen. */
  const requested = useMemo<TrackContext | null>(() => {
    if (params.sessionKey && currentWeek) {
      const index = currentWeek.sessions.findIndex(s => (s.id ?? "") === params.sessionKey);
      if (index >= 0) return trainingContextFor(currentWeek.sessions[index]!, currentWeek.weekNumber, index);
    }
    if (params.stageName && activeExpeditionId && activeExpedition?.virtualHills) {
      const stage = activeExpedition.virtualHills.find(h => h.name === params.stageName);
      if (stage) return { kind: "expedition", expeditionId: activeExpeditionId, stage };
    }
    return null;
  }, [params.sessionKey, params.stageName, currentWeek, activeExpedition, activeExpeditionId]);

  /* Hydrate once from what was asked for, then from what survived a detour. */
  useEffect(() => {
    if (!userId || hydrated) return;
    let cancelled = false;
    (async () => {
      const stored = await readPendingHikeSelection(userId).catch(() => null);
      if (cancelled) return;
      setContext(resolveTrackContext({ shellMode, stored, requested }));
      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [userId, hydrated, shellMode, requested]);

  /* A context belonging to the other shell cannot stay selected. Training and
     expedition progress are separate, and a recording credited to the wrong
     one cannot be moved afterwards. */
  useEffect(() => {
    if (!hydrated) return;
    if (!isUsableIn(context, shellMode)) {
      setContext(FREE_HIKE);
      if (userId) void clearPendingHikeSelection(userId);
    }
  }, [shellMode, context, hydrated, userId]);

  /* Persisted on every change, so search or the route planner can be visited
     and come back to the same selection. */
  useEffect(() => {
    if (!hydrated || !userId) return;
    void savePendingHikeSelection(storedFromContext(context, userId));
  }, [context, hydrated, userId]);

  const openRoutes = useCallback(async () => {
    setRoutesOpen(true);
    setRoutes(null);
    const result = await listRoutes(getToken);
    setRoutes(result.ok ? result.value : []);
  }, [getToken]);

  const start = useCallback(() => {
    /* Synchronous, before any await. Two taps a frame apart must not make two
       activities, and the recorder's own guard cannot help until it mounts. */
    if (startedRef.current) return;
    startedRef.current = true;
    setStarting(true);
    const launch = launchParamsFor(context, shellMode, activeExpeditionId);
    router.push({
      pathname: "/hike-tracking",
      params: {
        ...launch,
        ...(route ? { referenceRouteId: route.id, referenceRouteName: route.name } : {}),
      },
    } as never);
    setTimeout(() => { startedRef.current = false; setStarting(false); }, 1200);
  }, [context, shellMode, activeExpeditionId, route]);

  const resume = useCallback(() => {
    if (startedRef.current || !activeHike) return;
    startedRef.current = true;
    router.push({ pathname: "/hike-tracking", params: { restore: "1", routeId: activeHike.routeId } } as never);
    setTimeout(() => { startedRef.current = false; }, 1200);
  }, [activeHike]);

  const choices = useMemo(() => {
    const list: Array<{ key: string; context: TrackContext }> = [{ key: "free", context: FREE_HIKE }];
    if (shellMode === "training" && nextSession && currentWeek) {
      list.push({
        key: "training",
        context: trainingContextFor(nextSession.session, currentWeek.weekNumber, nextSession.index),
      });
    }
    if (shellMode === "expedition" && nextStage && activeExpeditionId) {
      list.push({
        key: "expedition",
        context: { kind: "expedition", expeditionId: activeExpeditionId, stage: nextStage },
      });
    }
    return list;
  }, [shellMode, nextSession, currentWeek, nextStage, activeExpeditionId]);

  const cameFromElsewhere = params.from === "push";

  return (
    <View style={[st.screen, { backgroundColor: T.bg }]} testID="track-landing-screen">
      <TrackMap recording={false} mapRef={mapRef} />

      <View style={[st.header, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        {cameFromElsewhere ? (
          <TouchableOpacity
            onPress={() => router.back()}
            style={st.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
          >
            <ChevronLeft size={20} color={T.text} />
          </TouchableOpacity>
        ) : null}
        <Text style={st.headerTitle}>Track</Text>
      </View>

      <View
        style={[st.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}
        accessibilityLabel="Start a hike"
        onLayout={e => setSheetHeight(e.nativeEvent.layout.height)}
      >
        <View style={st.grabber} />

        {activeHike ? (
          <TouchableOpacity
            onPress={resume}
            style={st.resumeRow}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Resume ${activeHike.routeName || "hike in progress"}`}
            testID="track-resume-activity"
          >
            <View style={st.liveDot} />
            <View style={{ flex: 1 }}>
              <Text style={st.resumeKicker}>RECORDING IN PROGRESS</Text>
              <Text style={st.resumeName} numberOfLines={1}>
                {activeHike.routeName || "Hike in progress"}
              </Text>
            </View>
            <Text style={st.resumeAction}>Resume</Text>
            <ChevronRight size={18} color={T.green} />
          </TouchableOpacity>
        ) : (
          <>
            <View style={st.row}>
              <View style={{ flex: 1 }}>
                <Text style={st.rowLabel}>RECORDING</Text>
                <Text style={st.rowValue} numberOfLines={1}>{contextLabel(context)}</Text>
                {contextDetail(context) ? (
                  <Text style={st.rowDetail} numberOfLines={1}>{contextDetail(context)}</Text>
                ) : null}
              </View>
              {choices.length > 1 ? (
                <TouchableOpacity
                  onPress={() => setPickerOpen(true)}
                  style={st.changeBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Change what this hike counts towards"
                  testID="track-change-context"
                >
                  <Text style={st.changeText}>Change</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={route ? () => setRoute(null) : openRoutes}
              style={st.routeRow}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={route ? `Remove route ${route.name}` : "Add a route"}
              testID="track-route-row"
            >
              <RouteIcon size={16} color={route ? T.green : T.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={st.routeName} numberOfLines={1}>{route ? route.name : "Add a route"}</Text>
                {route ? <Text style={st.routeMeta}>{describeRoute(route)}</Text> : null}
              </View>
              {route ? <X size={16} color={T.textMuted} /> : <ChevronRight size={16} color={T.textMuted} />}
            </TouchableOpacity>

            <View style={st.gpsRow} accessibilityLabel={gpsText.label}>
              <View style={[st.gpsDot, {
                backgroundColor: gpsText.tone === "good" ? T.green
                  : gpsText.tone === "bad" ? "#FF6B6B" : "#E9B949",
              }]} />
              <Text style={st.gpsText}>{gpsText.label}</Text>
            </View>

            <TouchableOpacity
              onPress={start}
              disabled={starting || !canStart(gps)}
              style={[st.start, starting && st.startBusy]}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Start hike"
              testID="track-start-hike"
            >
              <Play size={18} color="#04140A" fill="#04140A" />
              <Text style={st.startText}>Start hike</Text>
            </TouchableOpacity>

            <Text style={st.footnote}>Saved on your phone. Syncs when connected.</Text>
          </>
        )}
      </View>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={st.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={[st.modal, { paddingBottom: Math.max(insets.bottom, 16) }]} onPress={e => e.stopPropagation()}>
            <Text style={st.modalTitle}>What does this count towards?</Text>
            {choices.map(choice => (
              <TouchableOpacity
                key={choice.key}
                style={st.choice}
                onPress={() => { setContext(choice.context); setPickerOpen(false); }}
                accessibilityRole="button"
                accessibilityLabel={contextLabel(choice.context)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={st.choiceName}>{contextLabel(choice.context)}</Text>
                  {contextDetail(choice.context) ? (
                    <Text style={st.choiceDetail}>{contextDetail(choice.context)}</Text>
                  ) : null}
                </View>
                {contextLabel(choice.context) === contextLabel(context) ? (
                  <View style={st.tick} />
                ) : null}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={routesOpen} transparent animationType="slide" onRequestClose={() => setRoutesOpen(false)}>
        <Pressable style={st.backdrop} onPress={() => setRoutesOpen(false)}>
          <Pressable style={[st.modal, { paddingBottom: Math.max(insets.bottom, 16) }]} onPress={e => e.stopPropagation()}>
            <Text style={st.modalTitle}>Your saved routes</Text>
            {routes === null ? (
              <ActivityIndicator color={T.green} style={{ marginVertical: 24 }} />
            ) : routes.length === 0 ? (
              <>
                <Text style={st.empty}>No saved routes yet.</Text>
                <TouchableOpacity
                  style={st.planBtn}
                  onPress={() => { setRoutesOpen(false); router.push("/route-planner" as never); }}
                  accessibilityRole="button"
                  accessibilityLabel="Plan a route on the map"
                >
                  <MapIcon size={16} color={T.green} />
                  <Text style={st.planText}>Plan a route</Text>
                </TouchableOpacity>
              </>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                {routes.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={st.choice}
                    onPress={() => { setRoute(item); setRoutesOpen(false); }}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}, ${describeRoute(item)}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={st.choiceName} numberOfLines={1}>{item.name}</Text>
                      <Text style={st.choiceDetail}>{describeRoute(item)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 4,
    flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(11,20,24,0.88)", borderWidth: 1, borderColor: T.border,
  },
  headerTitle: {
    fontSize: 17, fontFamily: "Inter_700Bold", color: T.text,
    backgroundColor: "rgba(11,20,24,0.88)", paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, overflow: "hidden",
  },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 5,
    backgroundColor: T.card, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderColor: T.border, paddingHorizontal: 18, paddingTop: 8, gap: 12,
  },
  grabber: {
    width: 36, height: 4, borderRadius: 2, alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.18)", marginBottom: 4,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowLabel: { fontSize: 10, letterSpacing: 1.1, color: T.textDim, fontFamily: "Inter_700Bold" },
  rowValue: { fontSize: 19, color: T.text, fontFamily: "Inter_700Bold", marginTop: 2 },
  rowDetail: { fontSize: 12, color: T.textMuted, marginTop: 2, fontFamily: "Inter_400Regular" },
  changeBtn: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: T.border, backgroundColor: "rgba(255,255,255,0.04)",
  },
  changeText: { color: T.text, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  routeRow: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1, borderColor: T.border, backgroundColor: "rgba(255,255,255,0.03)",
  },
  routeName: { color: T.text, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  routeMeta: { color: T.textMuted, fontSize: 12, marginTop: 1, fontFamily: "Inter_400Regular" },
  gpsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  gpsText: { color: T.textMuted, fontSize: 13, fontFamily: "Inter_400Regular" },
  start: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9,
    backgroundColor: T.green, borderRadius: 14, paddingVertical: 17, minHeight: 56,
  },
  startBusy: { opacity: 0.7 },
  startText: { color: "#04140A", fontSize: 17, fontFamily: "Inter_700Bold" },
  footnote: { color: T.textDim, fontSize: 12, textAlign: "center", fontFamily: "Inter_400Regular" },
  resumeRow: {
    flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 15, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1, borderColor: T.borderActive, backgroundColor: T.greenDim,
    minHeight: 64,
  },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.green },
  resumeKicker: { fontSize: 10, letterSpacing: 1, color: T.green, fontFamily: "Inter_700Bold" },
  resumeName: { fontSize: 16, color: T.text, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  resumeAction: { color: T.green, fontSize: 14, fontFamily: "Inter_700Bold" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modal: {
    backgroundColor: T.card, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 18, gap: 6,
    borderTopWidth: 1, borderColor: T.border,
  },
  modalTitle: { color: T.text, fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 6 },
  choice: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: T.border, minHeight: 56,
  },
  choiceName: { color: T.text, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  choiceDetail: { color: T.textMuted, fontSize: 12, marginTop: 2, fontFamily: "Inter_400Regular" },
  tick: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.green },
  empty: { color: T.textMuted, fontSize: 14, paddingVertical: 14, fontFamily: "Inter_400Regular" },
  planBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 12, borderWidth: 1, borderColor: T.borderActive, paddingVertical: 14, marginBottom: 8,
  },
  planText: { color: T.green, fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
