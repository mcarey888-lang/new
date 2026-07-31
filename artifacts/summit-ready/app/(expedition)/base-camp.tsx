/**
 * Base Camp — Expedition home tab.
 * Matches the reference design: full-bleed hero, progress ring,
 * Next Mission card, weekly leaderboard, community highlights,
 * and a "Suggested For You" mountain card.
 */

import {
  Mountain, MapPin, RefreshCw, ChevronRight, AlertTriangle,
  Trophy, Users, Flame, Target, Play, TrendingUp,
} from "lucide-react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";
import { ProgressRing } from "@/components/ProgressRing";
import { useScreenView } from "@/lib/analytics";
import type { NearbyHill, SummitGoal, TargetMountain, Session } from "@/context/AppContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const PILL_OFFSET = 52;

// ── Helpers ────────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 80) return T.green;
  if (score >= 60) return T.blue;
  if (score >= 40) return T.orange;
  return T.red;
}

function diffColor(d: string | null) {
  if (d === "Easy")     return T.green;
  if (d === "Moderate") return T.blue;
  if (d === "Hard")     return T.orange;
  return "#FF4444";
}

function fmtElev(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}k` : `${m}`;
}

function weeklyElevation(sessions: Session[]): number {
  const now  = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return sessions
    .filter(s => new Date(s.date) >= monday)
    .reduce((sum, s) => sum + (s.elevationGain ?? 0), 0);
}

interface FeaturedChallenge {
  challengeId: string;
  challengeName: string;
  targetMountainName: string;
  difficulty: string | null;
  recommendedDays: number;
  adventureScore: number | null;
  totalAscentM: number | null;
  regions: string | null;
  summary: string | null;
}

interface VirtualExpeditionResponse {
  targetProfile:    TargetMountain & { notes?: string | null };
  recommendedHills: NearbyHill[];
  simulationScore:  number;
  adventureScore:   number;
  dnaMatchScore:    number;
  expedition: { title: string; concept: string; days: any[]; } | null;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LeaderboardRow({
  rank, name, elevation, isUser,
}: { rank: number; name: string; elevation: number; isUser?: boolean }) {
  return (
    <View style={[s.lbRow, isUser && s.lbRowYou]}>
      <Text style={[s.lbRank, isUser && { color: T.green }]}>{rank}</Text>
      <View style={s.lbAvatar}>
        <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: isUser ? T.green : T.blue }}>
          {name.slice(0, 1)}
        </Text>
      </View>
      <Text style={[s.lbName, isUser && { color: T.white, fontFamily: "Inter_700Bold" }]}>{name}</Text>
      <Text style={[s.lbElev, isUser && { color: T.green }]}>{elevation.toLocaleString()}m</Text>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function BaseCampScreen() {
  useScreenView("expedition_base_camp");
  const insets = useSafeAreaInsets();
  const { summitGoal, sessions, patchGoal } = useApp();

  const hasCachedData =
    !!summitGoal?.simulationScore &&
    !!summitGoal?.targetMountain &&
    !!summitGoal?.simulationScoreBreakdown;

  const [loading, setLoading] = useState(!hasCachedData);
  const [error, setError]     = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  // Featured signature challenges — shown in empty state
  const [featured, setFeatured] = useState<FeaturedChallenge[]>([]);
  const [featLoading, setFeatLoading] = useState(false);

  const heroUri = imgError || !summitGoal
    ? null
    : `${API_BASE}/mountain-image?name=${encodeURIComponent(summitGoal.mountainName)}&width=800&height=500`;

  async function fetchExpedition(force = false) {
    if (!summitGoal) return;
    if (!force && hasCachedData) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/virtual-expedition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetMountain: summitGoal.mountainName,
          userLocation:   summitGoal.location,
          radius:         summitGoal.maxRadius ?? 30,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server error ${res.status}`);
      }
      const data: VirtualExpeditionResponse = await res.json();
      await patchGoal({
        targetMountain:           data.targetProfile,
        simulationScore:          data.dnaMatchScore ?? data.simulationScore,
        virtualHills:             data.recommendedHills,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load expedition data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchExpedition(); }, []); // eslint-disable-line

  useEffect(() => {
    setFeatLoading(true);
    fetch(`${API_BASE}/sx/featured`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setFeatured(d.challenges ?? []); })
      .catch(() => {})
      .finally(() => setFeatLoading(false));
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const myWeeklyElev = useMemo(() => weeklyElevation(sessions), [sessions]);
  const totalTrained = useMemo(
    () => sessions.reduce((s, sess) => s + (sess.elevationGain ?? 0), 0),
    [sessions],
  );
  const totalDistKm = useMemo(
    () => sessions.reduce((s, sess) => s + (sess.distance ?? 0), 0),
    [sessions],
  );

  // Leaderboard — user's real weekly elevation + 3 static local club members
  const leaderboard = useMemo(() => {
    const entries = [
      { name: "Alex H.",  elev: 12450 },
      { name: "You",      elev: myWeeklyElev, isUser: true },
      { name: "Sarah M.", elev: 8310  },
      { name: "Tom R.",   elev: 7210  },
    ].sort((a, b) => b.elev - a.elev);
    return entries.map((e, i) => ({ ...e, rank: i + 1 }));
  }, [myWeeklyElev]);

  // ── Empty state — featured expedition library ─────────────────────────────────
  if (!summitGoal) {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: PILL_OFFSET + 20, paddingBottom: 48, paddingHorizontal: 16 }}
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(350)} style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 24, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 6 }}>
              Featured Expeditions
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 20 }}>
              Curated UK weekend adventures that train you for the world's greatest summits
            </Text>
          </Animated.View>

          {/* Loading */}
          {featLoading && (
            <View style={{ paddingVertical: 48, alignItems: "center" }}>
              <ActivityIndicator color={T.purple} />
            </View>
          )}

          {/* Challenge cards */}
          {featured.map((ch, idx) => (
            <Animated.View key={ch.challengeId} entering={FadeInDown.delay(idx * 25).duration(350)}>
              <TouchableOpacity
                style={s.featCard}
                activeOpacity={0.82}
                onPress={() => router.push("/(expedition)/mountains" as any)}
              >
                <LinearGradient
                  colors={["rgba(139,92,246,0.10)", "transparent"]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                />
                {/* Top row */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <View style={s.featBadge}>
                    <Text style={s.featBadgeText}>✦ SIGNATURE</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {ch.difficulty && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: diffColor(ch.difficulty) }} />
                        <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: T.textMuted }}>{ch.difficulty}</Text>
                      </View>
                    )}
                    <ChevronRight size={14} color={T.purple} />
                  </View>
                </View>
                {/* Mountain name */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 }}>
                  <Mountain size={10} color={T.textDim} />
                  <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim }}>{ch.targetMountainName}</Text>
                </View>
                {/* Challenge name */}
                <Text style={s.featTitle}>{ch.challengeName}</Text>
                {/* Summary */}
                {ch.summary && (
                  <Text style={s.featSummary} numberOfLines={2}>{ch.summary}</Text>
                )}
                {/* Stats */}
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {ch.recommendedDays > 0 && (
                    <View style={s.featStat}>
                      <Text style={s.featStatVal}>{ch.recommendedDays}</Text>
                      <Text style={s.featStatLbl}>days</Text>
                    </View>
                  )}
                  {!!ch.totalAscentM && (
                    <View style={s.featStat}>
                      <Text style={s.featStatVal}>
                        {ch.totalAscentM >= 1000 ? `${(ch.totalAscentM / 1000).toFixed(1)}k` : ch.totalAscentM}m
                      </Text>
                      <Text style={s.featStatLbl}>ascent</Text>
                    </View>
                  )}
                  {ch.adventureScore != null && (
                    <View style={[s.featStat, { borderColor: "rgba(139,92,246,0.3)" }]}>
                      <Text style={[s.featStatVal, { color: T.purple }]}>{ch.adventureScore}</Text>
                      <Text style={s.featStatLbl}>adventure</Text>
                    </View>
                  )}
                  {ch.regions && (
                    <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim, alignSelf: "center", flex: 1, textAlign: "right" }} numberOfLines={1}>
                      📍 {ch.regions}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}

          {/* Browse all CTA */}
          <TouchableOpacity
            onPress={() => router.push("/(expedition)/mountains" as any)}
            style={{ marginTop: 6, paddingVertical: 14, borderRadius: 14, backgroundColor: T.blue, alignItems: "center" }}
          >
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Browse All Mountains</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    );
  }

  const topInset   = Platform.OS === "web" ? 20 : insets.top;
  const score      = summitGoal.simulationScore ?? 0;
  const sc         = scoreColor(score);
  const target     = summitGoal.targetMountain;
  const hills      = summitGoal.virtualHills ?? [];
  const totalGoal  = target?.totalElevationGain ?? summitGoal.elevationGain ?? 0;
  const pct        = totalGoal > 0 ? Math.min(100, Math.round(totalTrained / totalGoal * 100)) : 0;
  const nextHill   = hills[0];

  // Estimated hike time for next mission (distance in km at ~3km/h on hills)
  const nextEst = nextHill
    ? `Est. ${Math.round(nextHill.distance / 3)}–${Math.round(nextHill.distance / 2)}h`
    : "";

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120 }}
      >
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <View style={s.heroWrap}>
          {heroUri ? (
            <ExpoImage
              source={{ uri: heroUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <LinearGradient colors={["#0E2240", "#071428", T.bg]} style={StyleSheet.absoluteFill} />
          )}
          {/* Top → transparent gradient */}
          <LinearGradient
            colors={["rgba(0,0,0,0.55)", "transparent"]}
            style={[StyleSheet.absoluteFill, { height: "45%" }]}
          />
          {/* Bottom → dark gradient */}
          <LinearGradient
            colors={["transparent", "rgba(6,10,20,0.92)", T.bg]}
            style={[StyleSheet.absoluteFill, { top: "42%" }]}
          />

          {/* Top row */}
          <View style={[s.heroTopRow, { paddingTop: topInset + PILL_OFFSET + 8 }]}>
            <View style={s.currentExpPill}>
              <View style={s.currentExpDot} />
              <Text style={s.currentExpText}>Current Expedition</Text>
            </View>
            <TouchableOpacity onPress={() => fetchExpedition(true)} style={s.refreshBtn} disabled={loading}>
              {loading
                ? <ActivityIndicator size="small" color={T.blue} />
                : <RefreshCw size={15} color={T.blue} />}
            </TouchableOpacity>
          </View>

          {/* Mountain name */}
          <View style={s.heroNameBlock}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={s.heroMountain}>{summitGoal.mountainName}</Text>
            </View>
            {target && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
                <MapPin size={11} color="rgba(255,255,255,0.5)" />
                <Text style={s.heroSub}>
                  {target.country}  ·  {target.summitElevation.toLocaleString()}m ASL
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Expedition Progress card ──────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(80).duration(420)} style={s.progressCard}>
          <LinearGradient colors={["rgba(255,255,255,0.04)", "transparent"]} style={StyleSheet.absoluteFill} />
          <View style={{ flex: 1 }}>
            <Text style={s.progressLabel}>EXPEDITION PROGRESS</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 4 }}>
              <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: T.white }}>
                {totalTrained.toLocaleString()}m
              </Text>
              <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted }}>
                / {totalGoal.toLocaleString()}m
              </Text>
            </View>
            <View style={s.progBarTrack}>
              <View style={[s.progBarFill, { width: `${pct}%` as any, backgroundColor: sc }]} />
            </View>
            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 4 }}>
              {pct}% complete · {totalDistKm.toFixed(1)}km total distance
            </Text>
          </View>
          <ProgressRing size={76} strokeWidth={7} score={score} color={sc} label={`${score}`} />
        </Animated.View>

        {/* ── Next Mission card ─────────────────────────────────────────────── */}
        {nextHill && (
          <Animated.View entering={FadeInDown.delay(140).duration(420)} style={{ marginHorizontal: 14, marginBottom: 12 }}>
            <View style={s.missionCard}>
              <LinearGradient colors={["rgba(255,255,255,0.04)", "transparent"]} style={StyleSheet.absoluteFill} />
              <Text style={s.missionLabel}>NEXT MISSION</Text>
              <Text style={s.missionName}>{nextHill.name}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6, marginBottom: 14 }}>
                <MissionStat icon={<MapPin size={12} color={T.textDim} />} value={`${nextHill.distance}km`} />
                <MissionStat icon={<TrendingUp size={12} color={T.textDim} />} value={`${nextHill.elevation}m gain`} />
                <MissionStat icon={<Target size={12} color={T.textDim} />} value={nextEst} />
              </View>
              <TouchableOpacity
                onPress={() => router.push("/hike-tracking" as any)}
                style={s.missionBtn}
                activeOpacity={0.85}
              >
                <Play size={14} color="#fff" />
                <Text style={s.missionBtnText}>Start Mission</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* ── Leaderboard ───────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(200).duration(420)} style={s.section}>
          <LinearGradient colors={["rgba(255,255,255,0.03)", "transparent"]} style={StyleSheet.absoluteFill} />
          <View style={s.sectionHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Trophy size={14} color={T.orange} />
              <Text style={s.sectionTitle}>LEADERBOARD</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={s.weekChip}>This Week</Text>
            </View>
          </View>
          {leaderboard.map(e => (
            <LeaderboardRow key={e.name} rank={e.rank} name={e.name} elevation={e.elev} isUser={e.isUser} />
          ))}
          <TouchableOpacity style={s.viewAllBtn} activeOpacity={0.7}>
            <Text style={s.viewAllText}>View Full Leaderboard</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Community Highlights ─────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(260).duration(420)} style={s.section}>
          <LinearGradient colors={["rgba(255,255,255,0.03)", "transparent"]} style={StyleSheet.absoluteFill} />
          <View style={s.sectionHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Users size={14} color={T.blue} />
              <Text style={s.sectionTitle}>COMMUNITY HIGHLIGHTS</Text>
            </View>
            <Text style={s.viewAllLink}>View All</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              { title: hills[0]?.name ?? "Tryfan North Ridge", user: "by Alex_H", likes: 124 },
              { title: hills[1]?.name ?? "Striding Edge",      user: "by jess_M",  likes: 98  },
            ].map((item, i) => (
              <View key={i} style={s.communityCard}>
                <LinearGradient
                  colors={i === 0 ? ["#1A2D40", "#0E1E30"] : ["#1A2A2A", "#0E1E1E"]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={s.communityThumb}>
                  <Mountain size={20} color={i === 0 ? T.blue : T.green} />
                </View>
                <Text style={s.communityTitle} numberOfLines={2}>{item.title}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                  <Text style={s.communityUser}>{item.user}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Flame size={10} color={T.orange} />
                    <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.orange }}>{item.likes}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ── Suggested For You ─────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(320).duration(420)} style={s.section}>
          <LinearGradient colors={["rgba(255,255,255,0.03)", "transparent"]} style={StyleSheet.absoluteFill} />
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>SUGGESTED FOR YOU</Text>
          </View>
          <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: -4, marginBottom: 8 }}>
            Based on your activity &amp; location
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(expedition)/mountains" as any)}
            style={s.suggestedCard}
            activeOpacity={0.85}
          >
            <LinearGradient colors={["#1A2A3A", "#0E1E2C"]} style={StyleSheet.absoluteFill} />
            <View style={s.suggestedThumb}>
              <Mountain size={22} color={T.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.suggestedName}>Mont Blanc</Text>
              <Text style={s.suggestedSub}>4,810m · France / Italy</Text>
            </View>
            <View style={s.matchBadge}>
              <Text style={s.matchPct}>{score > 10 ? Math.min(95, score + 5) : 85}%</Text>
              <Text style={s.matchLabel}>match</Text>
            </View>
            <ChevronRight size={16} color={T.textDim} />
          </TouchableOpacity>
        </Animated.View>

        {/* Error banner */}
        {error && (
          <View style={s.errorBanner}>
            <AlertTriangle size={14} color={T.orange} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

// ── Mini components ────────────────────────────────────────────────────────────

function MissionStat({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {icon}
      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: T.textMuted }}>{value}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Hero
  heroWrap: { height: 310, overflow: "hidden" },
  heroTopRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 0,
    justifyContent: "space-between",
  },
  currentExpPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  currentExpDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.green },
  currentExpText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#fff" },
  refreshBtn: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  heroNameBlock: { position: "absolute", bottom: 16, left: 16, right: 80 },
  heroMountain: { fontSize: 30, fontFamily: "Inter_700Bold", color: "#fff", lineHeight: 34 },
  heroSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)" },

  // Progress card (below hero, overlaps slightly)
  progressCard: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 14, marginTop: -6, marginBottom: 12,
    padding: 16, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden", gap: 12,
  },
  progressLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 1.2 },
  progBarTrack: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden", marginTop: 8 },
  progBarFill:  { height: 6, borderRadius: 3 },

  // Next Mission
  missionCard: {
    padding: 16, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  missionLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 1.2, marginBottom: 4 },
  missionName:  { fontSize: 18, fontFamily: "Inter_700Bold", color: T.white },
  missionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: T.green, borderRadius: 12, paddingVertical: 12,
  },
  missionBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },

  // Sections
  section: {
    marginHorizontal: 14, marginBottom: 12,
    padding: 14, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden", gap: 0,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 9, fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 1.2 },
  weekChip: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.blue, backgroundColor: T.blueDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  viewAllLink: { fontSize: 11, fontFamily: "Inter_500Medium", color: T.blue },
  viewAllBtn: { marginTop: 12, alignItems: "center", paddingVertical: 10 },
  viewAllText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.blue },

  // Leaderboard rows
  lbRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  lbRowYou: { backgroundColor: "rgba(62,207,117,0.04)", borderRadius: 8, paddingHorizontal: 6, marginHorizontal: -6 },
  lbRank: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.textMuted, width: 18, textAlign: "center" },
  lbAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center" },
  lbName: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: T.text },
  lbElev: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.textMuted },

  // Community
  communityCard: {
    flex: 1, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden", gap: 6,
  },
  communityThumb: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  communityTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.white, lineHeight: 16 },
  communityUser:  { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim },

  // Suggested
  suggestedCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  suggestedThumb: { width: 48, height: 48, borderRadius: 13, backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center" },
  suggestedName: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white },
  suggestedSub:  { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },
  matchBadge: { alignItems: "center" },
  matchPct:   { fontSize: 15, fontFamily: "Inter_700Bold", color: T.green },
  matchLabel: { fontSize: 9, fontFamily: "Inter_400Regular", color: T.textDim },

  // Featured expedition cards (empty state)
  featCard: {
    backgroundColor: "#0F1628",
    borderRadius: 16, borderWidth: 1, borderColor: "rgba(139,92,246,0.2)",
    padding: 14, marginBottom: 10, overflow: "hidden",
  },
  featBadge: {
    backgroundColor: "rgba(139,92,246,0.15)", borderRadius: 5,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: "rgba(139,92,246,0.3)",
  },
  featBadgeText: { fontSize: 8, fontFamily: "Inter_700Bold", color: "#9B7FD4", letterSpacing: 1 },
  featTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.white, lineHeight: 21 },
  featSummary: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 16, marginTop: 4 },
  featStat: {
    backgroundColor: "#142236", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  featStatVal: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.white },
  featStatLbl: { fontSize: 9, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 1 },

  // Error
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 14, marginBottom: 12,
    backgroundColor: T.orange + "12", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: T.orange + "30",
  },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, flex: 1 },
});
