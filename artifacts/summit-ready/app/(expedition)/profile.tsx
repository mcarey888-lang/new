/**
 * Profile — Expedition profile tab.
 * Matches reference design: avatar, name, Pro badge, stats row
 * (Expeditions / Summits / Elevation), Achievements, Recent Activity,
 * and a My Routes section.
 */

import {
  Settings, Trophy, TrendingUp, Star, ChevronRight, Mountain,
  Heart, MapPin, Clock, CheckCircle, Award, Target, Compass
} from "lucide-react-native";

function getIconForCategory(category: string, color: string, size = 20) {
  switch(category) {
    case "mountain": return <Mountain size={size} color={color} />;
    case "elevation": return <TrendingUp size={size} color={color} />;
    case "expedition": return <Compass size={size} color={color} />;
    case "training": return <Target size={size} color={color} />;
    default: return <Award size={size} color={color} />;
  }
}
import { useUser } from "@clerk/expo";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  Platform, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useStage8 } from "@/context/Stage8Context";
import { T } from "@/constants/theme";
import { useSubscription } from "@/lib/revenuecat";
import { useScreenView } from "@/lib/analytics";
import { ACHIEVEMENTS, TIER_COLOR, TIER_LABEL } from "@/utils/achievements";
import { DevToolsModal } from "@/components/DevToolsModal";
import { englishPlaceName } from "@/utils/placeNames";
import { RankExperience } from "@/components/RankExperience";
import { evaluateRank } from "@/utils/rankEvaluator";
import type { RankSignal } from "@/utils/rankDomain";

const PILL_OFFSET = 52;

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtElev(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`;
}

// ── Screen ─────────────────────────────────────────────────────────────────────

const DEV_TAPS = 5;
const DEV_WINDOW = 2000;

export default function ExpeditionProfileScreen() {
  useScreenView("expedition_profile");
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { isSubscribed } = useSubscription();
  const {
    sessions, completedGoals, summitGoal, unlockedAchievements,
  } = useApp();
  const { projection: stage8Projection, pendingEvidence: stage8Pending } = useStage8();
  const stage8Tracked = Object.values(stage8Projection.progress)
    .filter((item) => item.status === "active" || item.status === "completed").length;
  const stage8ConfirmedAwards = Object.values(stage8Projection.awards)
    .filter((award) => award.status === "confirmed").length;

  const [devModalVisible, setDevModalVisible] = useState(false);
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleTitlePress() {
    if (!__DEV__) return;
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (tapCount.current >= DEV_TAPS) {
      tapCount.current = 0;
      setDevModalVisible(true);
      return;
    }
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, DEV_WINDOW);
  }

  const topInset = Platform.OS === "web" ? 20 : insets.top;

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalElevation = useMemo(
    () => sessions.reduce((s, sess) => s + (sess.elevationGain ?? 0), 0),
    [sessions],
  );
  const totalDistKm = useMemo(
    () => sessions.reduce((s, sess) => s + (sess.distance ?? 0), 0),
    [sessions],
  );

  // Summits = number of different hills where repeats were completed
  const summitsCount = useMemo(() => {
    const names = new Set(sessions.map(s => s.hillName).filter(Boolean));
    return names.size;
  }, [sessions]);

  const expeditionsCount = completedGoals.length + (summitGoal ? 1 : 0);

  // ── Achievements to display ────────────────────────────────────────────────
  const unlockedList = useMemo(
    () => ACHIEVEMENTS.filter(a => unlockedAchievements.includes(a.id)),
    [unlockedAchievements],
  );

  // ── Recent activity (last 5 sessions) ─────────────────────────────────────
  const recentSessions = useMemo(
    () => [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
    [sessions],
  );

  // ── Virtual hills as "My Routes" ──────────────────────────────────────────
  const myRoutes = summitGoal?.virtualHills?.slice(0, 3) ?? [];

  const displayName = user?.fullName ?? user?.username ?? "Adventurer";
  const initials    = displayName.slice(0, 1).toUpperCase();
  const rankResult = evaluateRank({
    ownerUserId: user?.id ?? "signed-out",
    evidence: [],
    signalAvailability: {
      eligibleActivities: "unavailable",
      eligibleElevation: "unavailable",
      distinctMountains: "unavailable",
      summitCompletions: "unavailable",
      activeWeeks: "unavailable",
      expeditionMilestones: "unavailable",
    } satisfies Record<RankSignal, "unavailable">,
  });

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120 }}
      >
        {/* ── Header row ────────────────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: topInset + PILL_OFFSET + 8, marginBottom: 20 }}>
          <TouchableOpacity onPress={handleTitlePress} activeOpacity={1}>
            <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: T.white }}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/(expedition)/account" as any)}
            style={s.settingsBtn}
            activeOpacity={0.8}
          >
            <Settings size={18} color={T.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── Profile hero ──────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(60).duration(420)} style={s.heroCard}>
          <LinearGradient colors={["rgba(255,255,255,0.05)", "transparent"]} style={StyleSheet.absoluteFill} />
          {/* Avatar */}
          <View style={s.avatarWrap}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
            {isSubscribed && (
              <View style={s.proBadge}>
                <Star size={8} color="#FFD700" fill="#FFD700" />
                <Text style={s.proBadgeText}>Pro</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.displayName}>{displayName}</Text>
            <Text style={s.displayTitle}>Adventure Seeker</Text>
            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 4 }}>
              Verified progress: {stage8Tracked} tracked · {stage8ConfirmedAwards} confirmed
              {stage8Pending.length > 0 ? ` · ${stage8Pending.length} pending` : ""}
            </Text>
            {isSubscribed && (
              <View style={s.proMemberRow}>
                <Star size={10} color="#FFD700" fill="#FFD700" />
                <Text style={s.proMemberText}>Pro Member</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── Stats row ─────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={s.statsRow}>
          <StatCell value={String(expeditionsCount)} label="Expeditions" color={T.blue} />
          <View style={s.statDiv} />
          <StatCell value={String(summitsCount)} label="Summits" color={T.green} />
          <View style={s.statDiv} />
          <StatCell value={fmtElev(totalElevation)} label="Elevation" color={T.orange} />
        </Animated.View>

        {/* ── Rank Experience ────────────────────────────────────────────────── */}
        <RankExperience
          currentRank={rankResult.currentRank}
          nextRank={rankResult.nextRank}
          overallProgress={rankResult.progress}
          requirements={rankResult.nextRequirements}
          promotionBlocked={rankResult.promotionBlocked}
          blockedReasons={rankResult.blockedReasons}
          onPressJourney={() => router.push("/rank")}
          primaryColor={T.blue}
        />

        {/* ── Achievements ──────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(160).duration(400)} style={s.card}>
          <LinearGradient colors={["rgba(255,255,255,0.03)", "transparent"]} style={StyleSheet.absoluteFill} />
          <View style={s.cardHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Trophy size={16} color={T.orange} />
              <Text style={s.cardTitle}>Achievements</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(expedition)/account" as any)}>
              <Text style={s.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {unlockedList.length === 0 ? (
            <View style={{ paddingVertical: 16, alignItems: "center", gap: 6 }}>
              <Trophy size={24} color={T.textDim} />
              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: T.textMuted, textAlign: "center" }}>
                Log sessions to unlock achievements
              </Text>
            </View>
          ) : (
            <View style={s.achievementGrid}>
              {unlockedList.slice(0, 4).map(a => (
                <View key={a.id} style={s.achievementBadge}>
                  <View style={[s.badgeIcon, { borderColor: TIER_COLOR[a.tier] + "40", backgroundColor: TIER_COLOR[a.tier] + "14" }]}>
                    {getIconForCategory(a.category, TIER_COLOR[a.tier], 22)}
                  </View>
                  <Text style={s.badgeLabel} numberOfLines={2}>{a.title}</Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        {/* ── Recent Activity ───────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(220).duration(400)} style={s.card}>
          <LinearGradient colors={["rgba(255,255,255,0.03)", "transparent"]} style={StyleSheet.absoluteFill} />
          <View style={s.cardHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <TrendingUp size={16} color={T.blue} />
              <Text style={s.cardTitle}>Recent Activity</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(tabs)/hikes" as any)}>
              <Text style={s.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {recentSessions.length === 0 ? (
            <View style={{ paddingVertical: 16, alignItems: "center", gap: 6 }}>
              <CheckCircle size={24} color={T.textDim} />
              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: T.textMuted, textAlign: "center" }}>
                No activity yet — log a session to get started
              </Text>
            </View>
          ) : (
            recentSessions.map((sess, i) => (
              <View key={sess.id ?? i} style={[s.activityRow, i === recentSessions.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={s.activityIcon}>
                  <Mountain size={14} color={T.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.activityTitle} numberOfLines={1}>
                    {sess.hillName ? `Completed ${sess.hillName}` : "Training Session"}
                  </Text>
                  <Text style={s.activitySub}>
                    {sess.elevationGain}m gain · {sess.distance?.toFixed(1)}km
                  </Text>
                </View>
                <Text style={s.activityDate}>{relativeDate(sess.date)}</Text>
              </View>
            ))
          )}
        </Animated.View>

        {/* ── My Routes ─────────────────────────────────────────────────────── */}
        {myRoutes.length > 0 && (
          <Animated.View entering={FadeInDown.delay(280).duration(400)} style={s.card}>
            <LinearGradient colors={["rgba(255,255,255,0.03)", "transparent"]} style={StyleSheet.absoluteFill} />
            <View style={s.cardHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <MapPin size={16} color={T.green} />
                <Text style={s.cardTitle}>My Routes</Text>
              </View>
              <TouchableOpacity onPress={() => router.push("/(expedition)/route" as any)}>
                <Text style={s.viewAll}>View All</Text>
              </TouchableOpacity>
            </View>
            {myRoutes.map((hill, i) => (
              <TouchableOpacity
                key={hill.name + i}
                style={[s.routeRow, i === myRoutes.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => router.push("/(expedition)/route" as any)}
                activeOpacity={0.8}
              >
                <View style={s.routeIcon}>
                  <Mountain size={14} color={T.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.routeName}>{englishPlaceName(hill.name)}</Text>
                  <Text style={s.routeSub}>{hill.elevation}m gain · {hill.distance}km</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Heart size={11} color={T.textDim} />
                  <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: T.textDim }}>
                    {Math.floor(Math.random() * 50) + 10}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}

        {/* ── Challenges Link ───────────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/challenges" as any)}
          style={s.settingsLink}
          activeOpacity={0.8}
        >
          <Trophy size={15} color={T.orange} />
          <Text style={[s.settingsLinkText, { color: T.text }]}>View Challenges</Text>
          <ChevronRight size={15} color={T.textDim} />
        </TouchableOpacity>

        {/* ── Settings link ─────────────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => router.push("/(expedition)/account" as any)}
          style={s.settingsLink}
          activeOpacity={0.8}
        >
          <Settings size={15} color={T.textMuted} />
          <Text style={s.settingsLinkText}>Account Settings</Text>
          <ChevronRight size={15} color={T.textDim} />
        </TouchableOpacity>
      </ScrollView>

      {__DEV__ && (
        <DevToolsModal
          visible={devModalVisible}
          onClose={() => setDevModalVisible(false)}
        />
      )}
    </LinearGradient>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCell({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color }}>{value}</Text>
      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  settingsBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },

  heroCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    marginHorizontal: 14, marginBottom: 14, padding: 16,
    borderRadius: 20, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: T.blueDim, borderWidth: 2, borderColor: T.blue + "40",
    alignItems: "center", justifyContent: "center",
  },
  avatarText:   { fontSize: 26, fontFamily: "Inter_700Bold", color: T.blue },
  proBadge: {
    position: "absolute", bottom: -4, right: -4,
    flexDirection: "row", alignItems: "center", gap: 2,
    backgroundColor: "#1A1A00", borderRadius: 10, paddingHorizontal: 5, paddingVertical: 2,
    borderWidth: 1, borderColor: "#FFD70040",
  },
  proBadgeText: { fontSize: 8, fontFamily: "Inter_700Bold", color: "#FFD700" },
  displayName:  { fontSize: 18, fontFamily: "Inter_700Bold", color: T.white },
  displayTitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },
  proMemberRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  proMemberText:{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#FFD700" },

  statsRow: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 14, marginBottom: 14, padding: 16,
    borderRadius: 16, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  statDiv: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.08)" },

  card: {
    marginHorizontal: 14, marginBottom: 12, padding: 14,
    borderRadius: 18, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.text },
  viewAll: { fontSize: 13, fontFamily: "Inter_500Medium", color: T.textDim },

  achievementGrid: { flexDirection: "row", gap: 10 },
  achievementBadge: { flex: 1, alignItems: "center", gap: 6 },
  badgeIcon: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5,
  },
  badgeLabel: {
    fontSize: 9, fontFamily: "Inter_600SemiBold",
    color: T.textMuted, textAlign: "center", lineHeight: 12,
  },

  activityRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  activityIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: T.greenDim, alignItems: "center", justifyContent: "center",
  },
  activityTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.white },
  activitySub:   { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  activityDate:  { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim },

  routeRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  routeIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center",
  },
  routeName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.white },
  routeSub:  { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },

  settingsLink: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 14, marginBottom: 8, padding: 14,
    borderRadius: 14, backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  settingsLinkText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: T.textMuted },
});
