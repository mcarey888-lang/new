import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/expo";
import {
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Map as MapIcon, PencilLine,
  Play, Route as RouteIcon, X,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogHikeModal } from "@/components/LogHikeModal";
import { TrackMap, type TrackMapHandle } from "@/components/track/TrackMap";
import { useApp } from "@/context/AppContext";
import { useGpsStatus } from "@/hooks/useGpsStatus";
import { useSummitTicks } from "@/hooks/useSummitTicks";
import { useScreenView } from "@/lib/analytics";
import { T } from "@/constants/theme";
import { readActiveHike } from "@/utils/activeHikeSession";
import { personalRouteHandoff, savePersonalRouteHandoff } from "@/utils/personalRouteHandoff";
import { savePlannerDraft } from "@/utils/plannerDraftHandoff";
import { canStart, gpsDisplay } from "@/utils/gpsStatus";
import { primaryTabBarHeight } from "@/utils/tabBarLayout";
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
        // Paused and finished-unsaved recordings belong to the walker until
        // they explicitly save or discard them, even after a multi-day gap.
        setActiveHike(session);
      } catch { /* a read failure is not a reason to hide the screen */ }
    }
    void check();
    const id = setInterval(check, 3000);
    return () => { mounted = false; clearInterval(id); };
  }, [authLoaded, userId]);

  return activeHike;
}

export function SharedTrackScreen() {
  const { userId } = useAuth();
  return <SharedTrackScreenBody key={userId ?? "signed-out"} />;
}

function SharedTrackScreenBody() {
  useScreenView("track");
  const insets = useSafeAreaInsets();
  const navigationHeight = primaryTabBarHeight(Platform.OS, insets.bottom);
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
  const [routeError, setRouteError] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const startedRef = useRef(false);
  const mapRef = useRef<TrackMapHandle | null>(null);

  /* Held so they can be sent again. The first send happens as this screen
     lays out, which is before the map page has loaded — and a message sent
     to a page that does not exist yet is lost, taking the summit card's
     only instruction to sit above this sheet with it. */
  const insetsRef = useRef({ bottom: 0, top: 0 });

  const sendInsets = useCallback(() => {
    mapRef.current?.send({ type: "bottomInset", px: Math.round(insetsRef.current.bottom) });
    mapRef.current?.send({ type: "topInset", px: Math.round(insetsRef.current.top) });
  }, []);

  const [mapRevision, setMapRevision] = useState(0);
  /* Hills this person says they have been up. The map draws them green; it
     never asks who is looking, because that page is public. */
  const summitTicks = useSummitTicks();
  const ticksRef = useRef<string[]>([]);
  ticksRef.current = summitTicks.ids;

  const sendTicks = useCallback(() => {
    mapRef.current?.send({ type: "summitTicks", ids: ticksRef.current });
  }, []);

  /* Sent once the stored list has actually been read. Sending before that
     hands the map an empty list and unticks every hill on screen until the
     read finishes. */
  useEffect(() => {
    if (summitTicks.ready) sendTicks();
  }, [summitTicks.ready, summitTicks.ids, sendTicks]);

  const [sheetHeight, setSheetHeight] = useState(0);
  /* The normal state is a GPS pill and floating Start button, not a card.
     The existing hike options remain a deliberate tap away. */
  const [expanded, setExpanded] = useState(false);
  /* A tapped hill opens a card inside the map, at the bottom, which is
     exactly where this sheet sits. Getting out of its way beats drawing
     over it. */
  const [summitOpen, setSummitOpen] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [hasPlannerDraft, setHasPlannerDraft] = useState(false);
  const hideLaunchControls = drawing || hasPlannerDraft || summitOpen;

  /* Attribution sits below the floating controls, above navigation. Only
     the expanded options need to lift it above a full-width panel. */
  useEffect(() => {
    insetsRef.current.bottom = Math.round(
      navigationHeight + (expanded && !hideLaunchControls ? sheetHeight + 8 : 8),
    );
    if (!mapRevision) return;
    sendInsets();
    /* The card is not the preview: send the selected geometry after the map
       has its sources, and resend after a reload. An empty line removes the
       previous selection without touching recorded GPS or the planner. */
    mapRef.current?.send({
      type: "recPlanned",
      points: (route?.geometry ?? []).map(point => [point.lat, point.lng]),
    });
  }, [mapRevision, sheetHeight, navigationHeight, route, sendInsets, expanded, hideLaunchControls]);

  /* The header sits across the top of the map, over the search box. */
  useEffect(() => {
    insetsRef.current.top = insets.top + 46;
    if (!mapRevision) return;
    sendInsets();
  }, [insets.top, mapRevision, sendInsets]);

  const handleMapMessage = useCallback((message: Record<string, unknown>) => {
    if (message.type === "routeChanged") {
      setRoute(null);
      setHasPlannerDraft(Array.isArray(message.anchors) && message.anchors.length > 0);
      return;
    }
    if (message.type === "drawingChanged") {
      setDrawing(message.on === true);
      if (message.on === true) setExpanded(false);
      return;
    }
    if (message.type === "ready") setMapRevision(value => value + 1);
    /* The page says it is ready and asks for them, which is the only moment
       both sides are known to exist. */
    if (message["type"] === "needInsets" || message["type"] === "ready") {
      sendInsets();
      /* The page asking for its insets is the first moment it is known to
         exist, so it is also the moment to tell it what is ticked. */
      if (summitTicks.ready) sendTicks();
    }
    /* The map reports the tap; this decides. Keeping the list on one side
       means the card and the pin can only ever show what was really saved. */
    if (message["type"] === "summitTickToggled") {
      const id = message["id"];
      const name = message["name"];
      summitTicks.toggle({
        id: typeof id === "string" ? id : null,
        name: typeof name === "string" ? name : "",
      });
    }
    if (message["type"] === "summitCardOpened") {
      setSummitOpen(true);
      setExpanded(false);
    }
    if (message["type"] === "summitCardClosed") setSummitOpen(false);
    if (message.type === "saveRequested") {
      mapRef.current?.send({ type: "saveResult", ok: false });
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
  }, [sendInsets, sendTicks, summitTicks, userId]);

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
    setRouteError(null);
    const result = await listRoutes(getToken);
    if (result.ok) setRoutes(result.value);
    else { setRoutes([]); setRouteError("Saved routes could not be loaded. Check your connection and sign-in, then retry."); }
  }, [getToken]);

  const start = useCallback(async () => {
    /* Synchronous, before any await. Two taps a frame apart must not make two
       activities, and the recorder's own guard cannot help until it mounts. */
    if (startedRef.current) return;
    startedRef.current = true;
    setStarting(true);
    try {
    if (route) {
      if (!userId) throw new Error("Sign in to follow your saved route.");
      await savePersonalRouteHandoff(personalRouteHandoff(userId, route));
    }
    const launch = launchParamsFor(context, shellMode, activeExpeditionId);
    router.push({
      pathname: "/hike-tracking",
      params: {
        ...launch,
        autoStart: "1",
        ...(route ? { plannedRouteId: route.id, plannedRouteName: route.name } : {}),
      },
    } as never);
    setTimeout(() => { startedRef.current = false; setStarting(false); }, 1200);
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : "Could not start this route.");
      startedRef.current = false;
      setStarting(false);
      setRoutesOpen(true);
    }
  }, [context, shellMode, activeExpeditionId, route, userId]);

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
      <TrackMap recording={false} mapRef={mapRef} onMessage={handleMapMessage} />
      {routeError && !routesOpen ? (
        <Text accessibilityRole="alert" style={{ color: T.text, padding: 12 }}>{routeError}</Text>
      ) : null}

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

      {!hideLaunchControls ? <View
        pointerEvents="box-none"
        style={[
          st.sheet,
          expanded ? st.expandedSheet : st.floatingControls,
          { bottom: navigationHeight + (expanded ? 8 : 48) },
        ]}
        accessibilityLabel="Start a hike"
        onLayout={e => setSheetHeight(e.nativeEvent.layout.height)}
        testID="track-launch-controls"
      >
        {expanded ? <View style={st.grabber} /> : null}

        {activeHike ? (
          <TouchableOpacity
            onPress={resume}
            style={[st.resumeRow, st.resumePill]}
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
            <TouchableOpacity
              onPress={() => setExpanded(v => !v)}
              style={[st.summaryRow, !expanded && st.gpsPill]}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`${contextLabel(context)}. ${gpsText.label}. ${expanded ? "Hide" : "Show"} options`}
              accessibilityHint="Change the hike target, choose a saved route, or add a hike by hand"
              testID="track-sheet-toggle"
            >
              <View style={expanded ? { flex: 1 } : st.compactSummary}>
                {expanded || context.kind !== "free" ? (
                  <Text style={expanded ? st.rowValue : st.contextText} numberOfLines={1}>{contextLabel(context)}</Text>
                ) : null}
                <View style={st.gpsRow}>
                  <View style={[st.gpsDot, {
                    backgroundColor: gpsText.tone === "good" ? T.green
                      : gpsText.tone === "bad" ? T.red : T.orange,
                  }]} />
                  <Text style={st.gpsText} numberOfLines={1}>{gpsText.label}</Text>
                  {route && !expanded ? (
                    <Text style={st.gpsText} numberOfLines={1}> · {route.name}</Text>
                  ) : null}
                </View>
              </View>
              {expanded
                ? <ChevronDown size={20} color={T.textMuted} />
                : <ChevronUp size={14} color={T.textMuted} />}
            </TouchableOpacity>

            {expanded ? (
              <>
                {contextDetail(context) ? (
                  <Text style={st.rowDetail} numberOfLines={2}>{contextDetail(context)}</Text>
                ) : null}

                {choices.length > 1 ? (
                  <TouchableOpacity
                    onPress={() => setPickerOpen(true)}
                    style={st.changeRow}
                    accessibilityRole="button"
                    accessibilityLabel="Change what this hike counts towards"
                    testID="track-change-context"
                  >
                    <Text style={st.changeText}>Change what this counts towards</Text>
                    <ChevronRight size={16} color={T.textMuted} />
                  </TouchableOpacity>
                ) : null}

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

                <TouchableOpacity
                  onPress={() => setLogOpen(true)}
                  style={st.manualBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Add a hike by hand"
                  testID="track-log-manually"
                >
                  <PencilLine size={14} color={T.textMuted} />
                  <Text style={st.manualText}>Add a hike by hand</Text>
                </TouchableOpacity>
              </>
            ) : null}

            <TouchableOpacity
              onPress={start}
              disabled={starting || !canStart(gps)}
              style={[st.start, !expanded && st.floatingStart, starting && st.startBusy]}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Start hike"
              testID="track-start-hike"
            >
              <Play size={18} color="#04140A" fill="#04140A" />
              <Text style={st.startText}>Start hike</Text>
            </TouchableOpacity>

            {expanded ? (
              <Text style={st.footnote}>Saved on your phone. Syncs when connected.</Text>
            ) : null}
          </>
        )}
      </View> : null}

      <LogHikeModal
        visible={logOpen}
        onClose={() => setLogOpen(false)}
        reason="For a walk the GPS missed, or one you did not record at the time."
      />

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
            ) : routeError ? (
              <View>
                <Text style={st.modalTitle} accessibilityRole="alert">{routeError}</Text>
                <TouchableOpacity onPress={openRoutes}><Text style={st.planText}>Retry saved routes</Text></TouchableOpacity>
              </View>
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
  screen: { flex: 1, minHeight: 0, overflow: "hidden" },
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
    gap: 12,
  },
  expandedSheet: {
    backgroundColor: T.card, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderColor: T.border,
    paddingHorizontal: 18, paddingTop: 8, paddingBottom: 20,
  },
  floatingControls: {
    paddingHorizontal: 24, gap: 8,
  },
  gpsPill: {
    alignSelf: "flex-start", maxWidth: "100%", minHeight: 44,
    backgroundColor: T.tabBg, borderRadius: 24,
    paddingHorizontal: 12, paddingVertical: 8, gap: 8,
  },
  compactSummary: { flexShrink: 1 },
  contextText: {
    color: T.text, fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 2,
  },
  floatingStart: {
    alignSelf: "center", width: "90%", maxWidth: 420, borderRadius: 999,
    shadowColor: T.green, shadowOpacity: 0.25, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  resumePill: {
    backgroundColor: T.tabBg, borderRadius: 24, padding: 14,
  },
  grabber: {
    width: 36, height: 4, borderRadius: 2, alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.18)", marginBottom: 4,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  summaryRow: {
    flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingVertical: 2,
  },
  changeRow: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, minHeight: 48,
    borderTopWidth: 1, borderTopColor: T.border,
  },
  rowLabel: { fontSize: 10, letterSpacing: 1.1, color: T.textDim, fontFamily: "Inter_700Bold" },
  rowValue: { fontSize: 19, color: T.text, fontFamily: "Inter_700Bold", marginTop: 2 },
  rowDetail: { fontSize: 12, color: T.textMuted, marginTop: 2, fontFamily: "Inter_400Regular" },
  changeBtn: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: T.border, backgroundColor: "rgba(255,255,255,0.04)",
  },
  changeText: { flex: 1, color: T.text, fontSize: 14, fontFamily: "Inter_500Medium" },
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
  manualBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    paddingVertical: 12, minHeight: 44,
  },
  manualText: { color: T.textMuted, fontSize: 13, fontFamily: "Inter_500Medium" },
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
