
import {
  Play, TrendingUp, Clock, Footprints,
  ChevronRight, Mountain, Activity, MapPin, WifiOff,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, } from "expo-router";
import { useAuth } from "@clerk/expo";

import React, { useEffect, useMemo, useState, } from "react";
import {
  Platform, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { discardActiveHike, readActiveHike } from "@/utils/activeHikeSession";
import { readPendingHikeSelection, type PendingHikeSelection } from "@/utils/pendingHikeSelection";
import { englishPlaceName } from "@/utils/placeNames";
import { isRouteCompleted } from "@/utils/stateReliability";
import { useApp } from "@/context/AppContext";
import { useScreenView } from "@/lib/analytics";

import { T } from "@/constants/theme";
import { BASECAMP, EXPLORE, RADIUS, SP, TYPE } from "@/constants/tokens";
import { getCurrentWeek } from "@/utils/planGenerator";
import {
  buildExpeditionStageLaunchContext,
  buildFreeHikeLaunchContext,
  buildTrainingSessionLaunchContext,
} from "@/utils/trackingLaunchContext";


function useActiveHike() {
  const { isLoaded: authLoaded, userId } = useAuth();
  const [activeHike, setActiveHike] = useState<{ routeName: string; trackStartMs: number; routeId: string } | null>(null);

  useEffect(() => {
    if (!authLoaded || !userId) {
      setActiveHike(null);
      return;
    }
    const ownerUserId = userId;
    let mounted = true;
    async function check() {
      try {
        const session = await readActiveHike<any>(ownerUserId);
        if (!mounted) return;
        if (!session) {
          setActiveHike(null);
          return;
        }
        const ageMs = Date.now() - (session.savedAt ?? 0);
        if (ageMs < 24 * 60 * 60 * 1000) {
          if (mounted) setActiveHike(session);
        } else {
          await discardActiveHike(session);
          if (mounted) setActiveHike(null);
        }
      } catch { /* ignore */ }
    }
    check();
    // Re-check each time the screen comes into focus
    const id = setInterval(check, 3000);
    return () => { mounted = false; clearInterval(id); };
  }, [authLoaded, userId]);

  return activeHike;
}

function usePendingHikeSelection() {
  const { isLoaded: authLoaded, userId } = useAuth();
  const [selection, setSelection] = useState<PendingHikeSelection | null>(null);

  useEffect(() => {
    if (!authLoaded || !userId) {
      setSelection(null);
      return;
    }
    let mounted = true;
    async function check() {
      const pending = await readPendingHikeSelection(userId!);
      if (mounted) setSelection(pending);
    }
    void check();
    const id = setInterval(check, 3000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [authLoaded, userId]);

  return selection;
}

const PILL_OFFSET = 52;

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function relativeDate(dateStr: string): string {
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function SharedTrackScreen() {
  useScreenView("expedition_track");
  const insets = useSafeAreaInsets();
  const { sessions, exploreHikes, shellMode, activeExpedition, activeExpeditionId, trainingPlan, completedPlanSessions } = useApp();
  const activeHike = useActiveHike();
  const pendingHike = usePendingHikeSelection();

  const topInset = Platform.OS === "web" ? 20 : insets.top;

  const recentSessions = useMemo(
    () => {
      const activities = [
        ...exploreHikes.map(hike => ({
            ...hike,
            hillName: hike.name,
            duration: hike.timeTaken,
            dedupeKey: hike.activityId ?? `hike:${hike.id}`,
            isExpedition: !!hike.expeditionId,
          })),
        ...sessions.map(session => ({
            ...session,
            dedupeKey: session.activityId ?? `session:${session.id}`,
            isExpedition: !!session.expeditionId,
          })),
      ];
      return activities
        .filter((item, index) => activities.findIndex(other => other.dedupeKey === item.dedupeKey) === index)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);
    },
    [sessions, exploreHikes],
  );

  const nextHill = activeExpedition?.virtualHills?.find(
    hill => !isRouteCompleted(activeExpedition.completedRoutes, hill),
  );

  const currentWeek = getCurrentWeek(trainingPlan);
  let nextSession = null;
  let nextSessionIndex = -1;
  if (currentWeek) {
    const idx = currentWeek.sessions.findIndex((s, i) => !completedPlanSessions[s.id ?? `${currentWeek.weekNumber}-${i}`]);
    if (idx !== -1) {
      nextSession = currentWeek.sessions[idx];
      nextSessionIndex = idx;
    }
  }

  const [starting, setStarting] = useState(false);
  const handleStart = (params: any) => {
    if (starting) return;
    setStarting(true);
    router.push({ pathname: "/hike-tracking", params } as any);
    setTimeout(() => setStarting(false), 1000);
  };

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }} testID="track-landing-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120 }}
      >
        <View style={[s.page, { paddingTop: topInset + PILL_OFFSET + 15 }]}>
          <View style={s.header}>
            <View style={s.eyebrowRow}>
              <View style={s.eyebrowMark} />
              <Text style={s.eyebrow}>TRACK YOUR JOURNEY</Text>
            </View>
            <Text style={s.pageTitle}>Every hike{"\n"}moves you higher.</Text>
            <Text style={s.intro}>
              Track a hike, build your elevation and add it to your training or expedition.
            </Text>
          </View>

          <View style={s.statusRail} accessibilityLabel="Tracking availability">
            <View style={s.statusItem}>
              <MapPin size={15} color={EXPLORE.accent} />
              <View style={s.statusCopy}>
                <Text style={s.statusTitle}>GPS</Text>
                <Text style={s.statusDetail}>Checked on start</Text>
              </View>
            </View>
            <View style={s.statusDivider} />
            <View style={s.statusItem}>
              <WifiOff size={15} color={BASECAMP.accent} />
              <View style={s.statusCopy}>
                <Text style={s.statusTitle}>OFFLINE READY</Text>
                <Text style={s.statusDetail}>Saves on this device</Text>
              </View>
            </View>
          </View>

          <Animated.View entering={FadeInDown.delay(45).duration(350)} style={s.journeySection}>
            <Text style={s.sectionKicker}>YOUR NEXT HIKE</Text>
            <Text style={s.sectionTitle}>Ready when you are</Text>

            {activeHike ? (
              <TouchableOpacity
                onPress={() => handleStart({ restore: "1", routeId: activeHike.routeId })}
                style={[s.stateCard, s.activeCard]}
                activeOpacity={0.88}
                disabled={starting}
                accessibilityRole="button"
                accessibilityLabel={`Resume activity: ${activeHike.routeName || "Hike in progress"}`}
                testID="track-resume-activity"
              >
                <View style={s.stateIconWrap}>
                  <View style={s.liveDot} />
                </View>
                <View style={s.stateCopy}>
                  <Text style={s.stateKicker}>ACTIVITY IN PROGRESS</Text>
                  <Text style={s.stateTitle} numberOfLines={2}>{activeHike.routeName || "Hike in progress"}</Text>
                  <Text style={s.stateAction}>Resume Activity</Text>
                </View>
                <ChevronRight size={19} color={BASECAMP.accent} />
              </TouchableOpacity>
            ) : pendingHike ? (
              <TouchableOpacity
                onPress={() => handleStart({
                  hillName: pendingHike.routeName,
                  trackingMode: pendingHike.trackingMode ?? "",
                  expeditionId: pendingHike.expeditionId ?? "",
                  routeIdentityKey: pendingHike.routeIdentityKey ?? "",
                  summitIdentityKey: pendingHike.summitIdentityKey ?? "",
                  objectiveType: pendingHike.objectiveType ?? "",
                  stageSnapshot: pendingHike.stageSnapshot ? JSON.stringify(pendingHike.stageSnapshot) : "",
              })}
                style={[s.stateCard, s.pendingCard]}
                activeOpacity={0.88}
                disabled={starting}
                accessibilityRole="button"
                accessibilityLabel={`Start pending route: ${pendingHike.routeName}`}
                testID="track-pending-route"
              >
                <View style={[s.stateIconWrap, s.pendingIconWrap]}>
                  <Footprints size={19} color={EXPLORE.accent} />
                </View>
                <View style={s.stateCopy}>
                  <Text style={[s.stateKicker, { color: EXPLORE.accent }]}>CANONICAL ROUTE READY</Text>
                  <Text style={s.stateTitle} numberOfLines={2}>{pendingHike.routeName}</Text>
                  <Text style={[s.stateAction, { color: EXPLORE.accent }]}>Continue to tracking</Text>
                </View>
                <ChevronRight size={19} color={EXPLORE.accent} />
              </TouchableOpacity>
            ) : (
              <View style={s.readyNote}>
                <View style={s.readyIcon}>
                  <Footprints size={19} color={BASECAMP.textStrong} />
                </View>
                <View style={s.stateCopy}>
                  <Text style={s.readyTitle}>Your next track starts here</Text>
                  <Text style={s.readyBody}>Choose a planned stage or head out on a free hike.</Text>
                </View>
              </View>
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(110).duration(400)} style={s.actionsSection}>
            {shellMode === "expedition" && nextHill && activeExpeditionId && (
              <View style={s.actionGroup}>
                <Text style={s.sectionKicker}>NEXT EXPEDITION STAGE</Text>
                <TouchableOpacity
                  onPress={() => handleStart(buildExpeditionStageLaunchContext(nextHill, activeExpeditionId, activeExpedition?.virtualHikeProgress))}
                  style={[s.actionButton, s.expeditionButton]}
                  activeOpacity={0.88}
                  disabled={starting}
                  accessibilityRole="button"
                  accessibilityLabel={`Start expedition stage: ${englishPlaceName(nextHill.name)}`}
                  testID="track-expedition-stage"
                >
                  <Play size={17} color={BASECAMP.text} fill={BASECAMP.text} />
                  <Text style={s.actionButtonText} numberOfLines={2}>{englishPlaceName(nextHill.name)}</Text>
                  <ChevronRight size={17} color={BASECAMP.text} />
                </TouchableOpacity>
              </View>
            )}

            {shellMode === "training" && nextSession && currentWeek && (
              <View style={s.actionGroup}>
                <Text style={s.sectionKicker}>UP NEXT · TRAINING</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (nextSession?.type === "hill" || nextSession?.type === "bigDay") {
                      handleStart(buildTrainingSessionLaunchContext(nextSession, nextSessionIndex, currentWeek.weekNumber, currentWeek.hills?.[0]?.repeats ?? 2));
                    } else if (nextSession) {
                      router.push({
                        pathname: "/session-detail",
                        params: { weekNum: String(currentWeek.weekNumber), sessionIdx: String(nextSessionIndex) }
                      } as any);
                    }
                  }}
                  style={[s.actionButton, s.trainingButton]}
                  activeOpacity={0.88}
                  disabled={starting}
                  accessibilityRole="button"
                  accessibilityLabel={`Start training session: ${nextSession?.label ?? "Start Mission"}`}
                  testID="track-training-session"
                >
                  <Play size={17} color={BASECAMP.accentInk} fill={BASECAMP.accentInk} />
                  <Text style={[s.actionButtonText, { color: BASECAMP.accentInk }]} numberOfLines={2}>
                    {nextSession?.label ?? "Start Mission"}
                  </Text>
                  <ChevronRight size={17} color={BASECAMP.accentInk} />
                </TouchableOpacity>
              </View>
            )}

            <View style={s.actionGroup}>
              <Text style={s.sectionKicker}>NO ROUTE NEEDED</Text>
              <TouchableOpacity
                onPress={() => handleStart(buildFreeHikeLaunchContext(shellMode, activeExpeditionId))}
                style={s.freeHikeButton}
                activeOpacity={0.88}
                disabled={starting}
                accessibilityRole="button"
                accessibilityLabel="Start a free hike"
                testID="track-free-hike"
              >
                <View style={s.freeHikeIcon}>
                  <Footprints size={18} color={BASECAMP.textStrong} />
                </View>
                <View style={s.freeHikeCopy}>
                  <Text style={s.freeHikeTitle}>Start a free hike</Text>
                  <Text style={s.freeHikeSub}>Record your walk without a planned route</Text>
                </View>
                <ChevronRight size={17} color={BASECAMP.textDim} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(170).duration(400)} style={s.recentSection}>
            <View style={s.recentHeading}>
              <View>
                <Text style={s.sectionKicker}>YOUR TRACKS</Text>
                <Text style={s.recentTitle}>Recent activity</Text>
              </View>
              <Clock size={17} color={BASECAMP.textDim} />
            </View>
            {recentSessions.length === 0 ? (
              <View style={s.emptyRecent}>
                <Activity size={22} color={BASECAMP.textDim} />
                <View style={{ flex: 1 }}>
                  <Text style={s.emptyTitle}>No tracks yet</Text>
                  <Text style={s.emptyBody}>Your completed hikes will appear here.</Text>
                </View>
              </View>
            ) : (
              recentSessions.map((sess, i) => (
                <View key={sess.id ?? i} style={[s.sessionRow, i === recentSessions.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[s.sessionIcon, { backgroundColor: sess.isExpedition ? EXPLORE.accentDim : BASECAMP.accentDim }]}>
                    {sess.isExpedition ? <Mountain size={15} color={EXPLORE.accent} /> : <TrendingUp size={15} color={BASECAMP.accent} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.sessionName} numberOfLines={1}>{sess.hillName ?? "Hike"}</Text>
                    <Text style={s.sessionMeta} numberOfLines={1}>
                      {relativeDate(sess.date)} · {sess.distance.toFixed(1)} km · {sess.elevationGain} m
                    </Text>
                  </View>
                  <Text style={s.sessionTime}>{fmtDuration(sess.duration)}</Text>
                </View>
              ))
            )}
          </Animated.View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: BASECAMP.gutter, paddingBottom: 26 },
  header: { marginBottom: SP.lg },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  eyebrowMark: { width: 18, height: 2, backgroundColor: EXPLORE.accent, borderRadius: 2 },
  eyebrow: { ...TYPE.eyebrow, color: BASECAMP.textMuted, fontSize: 10, letterSpacing: 1.7 },
  pageTitle: {
    ...TYPE.hero, fontSize: 33, lineHeight: 37, color: BASECAMP.text,
  },
  intro: {
    ...TYPE.body, color: BASECAMP.textMuted, maxWidth: 340, marginTop: 10,
  },
  statusRail: {
    minHeight: 63, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 25,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: BASECAMP.hairline,
    flexDirection: "row", alignItems: "center",
  },
  statusItem: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 },
  statusCopy: { flex: 1, minWidth: 0 },
  statusTitle: { ...TYPE.eyebrow, color: BASECAMP.textStrong, fontSize: 9, letterSpacing: 0.7 },
  statusDetail: { ...TYPE.caption, color: BASECAMP.textDim, marginTop: 3 },
  statusDivider: { width: 1, height: 29, backgroundColor: BASECAMP.hairline, marginHorizontal: 12 },
  journeySection: { marginBottom: 27 },
  sectionKicker: { ...TYPE.eyebrow, color: BASECAMP.textDim, marginBottom: 7 },
  sectionTitle: { ...TYPE.title, color: BASECAMP.text, fontSize: 21, marginBottom: 13 },
  stateCard: {
    flexDirection: "row", alignItems: "center", gap: 12, minHeight: 100,
    paddingHorizontal: 14, paddingVertical: 15, borderRadius: RADIUS.lg,
    backgroundColor: BASECAMP.panelSub, borderWidth: 1,
  },
  activeCard: { borderColor: BASECAMP.accentLine, backgroundColor: BASECAMP.accentDim },
  pendingCard: { borderColor: EXPLORE.accentLine, backgroundColor: EXPLORE.accentDim },
  stateIconWrap: {
    width: 39, height: 39, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: BASECAMP.accentDim,
  },
  pendingIconWrap: { backgroundColor: EXPLORE.accentDim },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BASECAMP.accent },
  stateCopy: { flex: 1, minWidth: 0 },
  stateKicker: { ...TYPE.eyebrow, fontSize: 8.5, letterSpacing: 1.1, color: BASECAMP.accent, marginBottom: 4 },
  stateTitle: { ...TYPE.bodyBold, fontSize: 15, lineHeight: 19, color: BASECAMP.text, flexShrink: 1 },
  stateAction: { ...TYPE.smallBold, color: BASECAMP.accent, marginTop: 5 },
  readyNote: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 81, paddingVertical: 11 },
  readyIcon: {
    width: 39, height: 39, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: BASECAMP.panelSub,
  },
  readyTitle: { ...TYPE.bodyBold, color: BASECAMP.textStrong },
  readyBody: { ...TYPE.small, color: BASECAMP.textDim, marginTop: 3 },
  actionsSection: { gap: 17, marginBottom: 31 },
  actionGroup: { gap: 7 },
  actionButton: {
    minHeight: 58, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: RADIUS.md, flexDirection: "row", alignItems: "center", gap: 11,
    overflow: "hidden",
  },
  expeditionButton: { backgroundColor: EXPLORE.accent },
  trainingButton: { backgroundColor: BASECAMP.accent },
  actionButtonText: { flex: 1, ...TYPE.bodyBold, color: BASECAMP.text, fontSize: 15 },
  freeHikeButton: {
    minHeight: 69, flexDirection: "row", alignItems: "center", gap: 11,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: BASECAMP.hairline,
  },
  freeHikeIcon: {
    width: 39, height: 39, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: BASECAMP.panelSub,
  },
  freeHikeCopy: { flex: 1, minWidth: 0 },
  freeHikeTitle: { ...TYPE.bodyBold, color: BASECAMP.text },
  freeHikeSub: { ...TYPE.caption, color: BASECAMP.textDim, marginTop: 3 },
  recentSection: { marginTop: 2 },
  recentHeading: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingBottom: 10, marginBottom: 1, borderBottomWidth: 1, borderColor: BASECAMP.hairline,
  },
  recentTitle: { ...TYPE.title, color: BASECAMP.text, fontSize: 20 },
  emptyRecent: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 20 },
  emptyTitle: { ...TYPE.bodyBold, color: BASECAMP.textStrong },
  emptyBody: { ...TYPE.small, color: BASECAMP.textDim, marginTop: 3 },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: BASECAMP.hairline,
  },
  sessionIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    marginRight: 11,
  },
  sessionName: { ...TYPE.bodyBold, color: BASECAMP.text, marginBottom: 3 },
  sessionMeta: { ...TYPE.caption, color: BASECAMP.textDim },
  sessionTime: { ...TYPE.smallBold, color: BASECAMP.textMuted, marginLeft: 8 },
});
