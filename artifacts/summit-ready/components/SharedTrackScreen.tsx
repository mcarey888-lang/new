
import {
  Play, TrendingUp, Clock, Footprints,
  ChevronRight, Mountain, Activity, Zap,
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
import { getCurrentWeek } from "@/utils/planGenerator";
import { buildExpeditionStageLaunchContext, buildTrainingSessionLaunchContext } from "@/utils/trackingLaunchContext";


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

  // Unified stats
  const totalElev = exploreHikes.reduce((sum, h) => sum + h.elevationGain, 0) + sessions.reduce((sum, s) => sum + s.elevationGain, 0);
  const totalDist = exploreHikes.reduce((sum, h) => sum + h.distance, 0) + sessions.reduce((sum, s) => sum + s.distance, 0);
  const totalHikes = exploreHikes.length + sessions.length;

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
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120 }}
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <View style={{ paddingTop: topInset + PILL_OFFSET + 12, paddingHorizontal: 16, paddingBottom: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <View style={s.gpsPill}>
              <View style={s.gpsDot} />
              <Text style={s.gpsText}>GPS READY</Text>
            </View>
            <Text style={s.pageTitle}>Track Activity</Text>
          </View>
          <View style={s.settingsBtn}>
            <Activity size={18} color={T.textMuted} />
          </View>
        </View>

        {/* ── Resume active tracking banner ────────────────────────────────── */}
        {activeHike && (
          <Animated.View entering={FadeInDown.delay(30).duration(350)} style={{ marginHorizontal: 14, marginBottom: 12 }}>
            <TouchableOpacity
              onPress={() => handleStart({ restore: "1", routeId: activeHike.routeId })}
              style={s.resumeBanner}
              activeOpacity={0.88}
              disabled={starting}
            >
              <LinearGradient
                colors={["rgba(62,207,117,0.18)", "rgba(62,207,117,0.08)"]}
                style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
              />
              <View style={s.resumeDot} />
              <View style={{ flex: 1 }}>
                <Text style={s.resumeTitle}>Tracking active</Text>
                <Text style={s.resumeSub} numberOfLines={1}>{activeHike.routeName || "Hike in progress"}</Text>
              </View>
              <ChevronRight size={18} color={T.green} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {!activeHike && pendingHike && (
          <Animated.View entering={FadeInDown.delay(30).duration(350)} style={{ marginHorizontal: 14, marginBottom: 12 }}>
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
              style={s.resumeBanner}
              activeOpacity={0.88}
              disabled={starting}
            >
              <View style={s.resumeDot} />
              <View style={{ flex: 1 }}>
                <Text style={s.resumeTitle}>Ready to track offline</Text>
                <Text style={s.resumeSub} numberOfLines={1}>{pendingHike.routeName}</Text>
              </View>
              <ChevronRight size={18} color={T.green} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Lifetime stats big card ───────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(60).duration(420)} style={s.statsCard}>
          <LinearGradient colors={["rgba(255,255,255,0.05)", "transparent"]} style={StyleSheet.absoluteFill} />
          <View style={s.bigStatRow}>
            <View style={s.bigStat}>
              <Text style={[s.bigStatValue, { color: T.green }]}>{totalDist.toFixed(1)}</Text>
              <Text style={s.bigStatUnit}>km</Text>
            </View>
            <View style={s.bigStatDiv} />
            <View style={s.bigStat}>
              <Text style={[s.bigStatValue, { color: T.blue }]}>{(totalElev / 1000).toFixed(1)}</Text>
              <Text style={s.bigStatUnit}>km↑</Text>
            </View>
            <View style={s.bigStatDiv} />
            <View style={s.bigStat}>
              <Text style={[s.bigStatValue, { color: T.orange }]}>{totalHikes}</Text>
              <Text style={s.bigStatUnit}>hikes</Text>
            </View>
          </View>
          <View style={s.subStatRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Footprints size={12} color={T.textDim} />
              <Text style={s.subStatText}>All-time progress</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Contextual Tracking CTAs ──────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={{ marginHorizontal: 14, marginBottom: 14 }}>
          {shellMode === "expedition" && nextHill && activeExpeditionId && (
            <>
              <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: T.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Next Expedition Stage
              </Text>
              <TouchableOpacity
                onPress={() => handleStart(buildExpeditionStageLaunchContext(nextHill, activeExpeditionId, activeExpedition?.virtualHikeProgress))}
                style={[s.startBtn, { marginBottom: 10 }]}
                activeOpacity={0.88}
                disabled={starting}
              >
                <LinearGradient colors={[T.blue, "#2F88E5"]} style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} />
                <Play size={20} color="#fff" fill="#fff" />
                <Text style={s.startBtnText}>{englishPlaceName(nextHill.name)}</Text>
              </TouchableOpacity>
            </>
          )}

          {shellMode === "training" && nextSession && currentWeek && (
            <>
              <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: T.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Next Training Session
              </Text>
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
                style={[s.startBtn, { marginBottom: 10 }]}
                activeOpacity={0.88}
                disabled={starting}
              >
                <LinearGradient colors={[T.green, "#2AB85A"]} style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} />
                <Play size={20} color="#fff" fill="#fff" />
                <Text style={s.startBtnText}>{nextSession?.label ?? "Start Mission"}</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: T.textDim, marginBottom: 8, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Free Hike
          </Text>
          <TouchableOpacity
            onPress={() => handleStart({ trackingMode: "freehike", expeditionId: activeExpeditionId ?? "" })}
            style={s.startBtn}
            activeOpacity={0.88}
            disabled={starting}
          >
            <LinearGradient colors={["rgba(255,255,255,0.1)", "rgba(255,255,255,0.05)"]} style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} />
            <Footprints size={20} color="#fff" />
            <Text style={s.startBtnText}>Start Free Hike</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Recent sessions ───────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(180).duration(400)} style={s.recentCard}>
          <LinearGradient colors={["rgba(255,255,255,0.03)", "transparent"]} style={StyleSheet.absoluteFill} />
          <View style={s.cardHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Clock size={13} color={T.orange} />
              <Text style={s.cardTitle}>RECENT ACTIVITY</Text>
            </View>
          </View>
          {recentSessions.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: "center", gap: 8 }}>
              <Activity size={28} color={T.textDim} />
              <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.textMuted, textAlign: "center" }}>
                No activities yet
              </Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center" }}>
                Start tracking to see your history here
              </Text>
            </View>
          ) : (
            recentSessions.map((sess, i) => (
              <View key={sess.id ?? i} style={[s.sessionRow, i === recentSessions.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[s.sessionIcon, { backgroundColor: sess.isExpedition ? T.blueDim : T.greenDim }]}>
                  {sess.isExpedition ? <Mountain size={14} color={T.blue} /> : <TrendingUp size={14} color={T.green} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sessionName} numberOfLines={1}>{sess.hillName ?? "Hike"}</Text>
                  <Text style={s.sessionMeta}>
                    {relativeDate(sess.date)} · {sess.distance.toFixed(1)}km · {sess.elevationGain}m
                  </Text>
                </View>
                <Text style={s.sessionTime}>{fmtDuration(sess.duration)}</Text>
              </View>
            ))
          )}
        </Animated.View>

      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  pageTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.5,
  },
  gpsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(62,207,117,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  gpsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.green,
  },
  gpsText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: T.green,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },

  resumeBanner: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(62,207,117,0.25)",
    backgroundColor: "rgba(12,20,36,0.9)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
  },
  resumeDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: T.green,
  },
  resumeTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.green, marginBottom: 2 },
  resumeSub: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },

  statsCard: {
    marginHorizontal: 14,
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  bigStatRow: {
    flexDirection: "row",
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  bigStat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  bigStatValue: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  bigStatUnit: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: T.textMuted,
  },
  bigStatDiv: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  subStatRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.03)",
  },
  subStatText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: T.textDim,
  },

  startBtn: {
    height: 60,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  startBtnText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },

  recentCard: {
    marginHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  cardTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: T.textMuted,
    letterSpacing: 0.5,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  sessionIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    marginRight: 12,
  },
  sessionName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff", marginBottom: 3 },
  sessionMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  sessionTime: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.textDim },
});
