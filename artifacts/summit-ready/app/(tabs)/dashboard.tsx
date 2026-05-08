import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { T, STATUS_COLOR, STATUS_LABEL, PHASE_COLOR } from "@/constants/theme";
import { ProgressRing } from "@/components/ProgressRing";
import { getDaysRemaining, getWeeklyCompletion } from "@/utils/readinessScore";
import { getCurrentWeek } from "@/utils/planGenerator";
import { assessTime } from "@/utils/timeValidator";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

interface CoachAssessment {
  summary: string;
  tone: "positive" | "warning" | "neutral";
  tips: string[];
}

const { width } = Dimensions.get("window");
const CARD_W = (width - 48) / 2;

function StatCard({
  icon,
  label,
  value,
  unit,
  accent,
  delay = 0,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string | number;
  unit?: string;
  accent: string;
  delay?: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(500)} style={[styles.statCard, { width: CARD_W }]}>
      <View style={[styles.statIconRow, { backgroundColor: accent + "18" }]}>
        <Feather name={icon} size={15} color={accent} />
      </View>
      <Text style={styles.statValue}>
        {value}
        {unit && <Text style={[styles.statUnit, { color: T.textMuted }]}> {unit}</Text>}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { summitGoal, trainingPlan, sessions, readinessScore } = useApp();
  const [coach, setCoach] = useState<CoachAssessment | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState(false);
  const hasFetched = useRef(false);

  const abortRef = useRef<AbortController | null>(null);

  const fetchCoach = useCallback(async () => {
    if (!summitGoal) return;
    // Cancel any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCoachLoading(true);
    setCoachError(false);
    try {
      const completed = sessions.filter(s => s.completed);
      const currentWeek = getCurrentWeek(trainingPlan);
      const days = getDaysRemaining(summitGoal.summitDate);
      const sessionsPerWeek = summitGoal.trainingDaysPerWeek ?? 4;
      const weekCompletion = currentWeek
        ? getWeeklyCompletion(sessions, currentWeek.weekNumber, sessionsPerWeek)
        : 0;
      const totalElevation = completed.reduce((s, x) => s + x.elevationGain, 0);
      const maxElev = completed.reduce((m, x) => Math.max(m, x.elevationGain), 0);
      const recentTypes = completed.slice(0, 5).map(s => s.type);

      const res = await fetch(`${API_BASE}/coach-assessment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          summitGoal,
          readinessScore,
          totalSessionsDone: completed.length,
          totalElevationLogged: totalElevation,
          maxSingleElevation: maxElev,
          weekCompletion,
          daysRemaining: days,
          weeksInPlan: trainingPlan.length,
          currentWeekNumber: currentWeek?.weekNumber ?? 1,
          currentPhase: currentWeek?.phase ?? "Base",
          recentSessionTypes: recentTypes,
        }),
      });
      if (!res.ok) throw new Error("Coach failed");
      const data: CoachAssessment = await res.json();
      if (!controller.signal.aborted) setCoach(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setCoachError(true);
    } finally {
      if (!controller.signal.aborted) setCoachLoading(false);
    }
  }, [summitGoal, sessions, trainingPlan, readinessScore]);

  useEffect(() => {
    if (summitGoal && !hasFetched.current) {
      hasFetched.current = true;
      fetchCoach();
    }
  }, [summitGoal, fetchCoach]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  if (!summitGoal) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center", gap: 18 }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: T.greenDim, alignItems: "center", justifyContent: "center" }}>
          <Feather name="compass" size={28} color={T.green} />
        </View>
        <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: T.white }}>No plan yet</Text>
        <TouchableOpacity onPress={() => router.push("/setup")} style={styles.createPlanBtn}>
          <LinearGradient colors={["#3ECF75", "#2AB860"]} style={styles.createPlanGrad}>
            <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" }}>Create my plan</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = STATUS_COLOR(readinessScore);
  const statusLabel = STATUS_LABEL(readinessScore);
  const days = getDaysRemaining(summitGoal.summitDate);
  const currentWeek = getCurrentWeek(trainingPlan);
  const timeAssessment = assessTime(
    summitGoal.summitDate,
    summitGoal.difficulty,
    summitGoal.fitnessLevel,
    summitGoal.trainingDaysPerWeek
  );
  const sessionsPerWeek = summitGoal?.trainingDaysPerWeek ?? 4;
  const weekCompletion = currentWeek ? getWeeklyCompletion(sessions, currentWeek.weekNumber, sessionsPerWeek) : 0;
  const maxElev = sessions.filter(s => s.completed).reduce((m, s) => Math.max(m, s.elevationGain), 0);
  const totalDone = sessions.filter(s => s.completed).length;

  const trackingMsg =
    readinessScore >= 70 ? "You are on track" :
    readinessScore >= 40 ? "Keep building fitness" :
    "Behind — prioritise training";

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Platform.OS === "web" ? 56 : insets.top + 16,
            paddingBottom: Platform.OS === "web" ? 110 : insets.bottom + 110,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(0).duration(500)} style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerLabel}>Training for</Text>
            <Text style={styles.headerMountain} numberOfLines={1}>{summitGoal.mountainName}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/setup")} style={styles.editBtn}>
            <Feather name="edit-2" size={15} color={T.green} />
          </TouchableOpacity>
        </Animated.View>

        {/* Time readiness warning */}
        {timeAssessment && (timeAssessment.status === "insufficient" || timeAssessment.status === "impossible" || timeAssessment.status === "tight") && (
          <Animated.View entering={FadeInDown.delay(60).duration(500)}>
            <View style={[
              styles.warningBanner,
              timeAssessment.status === "tight"
                ? { backgroundColor: T.orangeDim, borderColor: T.orange + "40" }
                : { backgroundColor: "rgba(255,68,68,0.10)", borderColor: T.red + "40" },
            ]}>
              <Feather
                name={timeAssessment.status === "tight" ? "clock" : "alert-triangle"}
                size={14}
                color={timeAssessment.status === "tight" ? T.orange : T.red}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.warningText, { color: timeAssessment.status === "tight" ? T.orange : T.red }]}>
                  {timeAssessment.message}
                </Text>
                <Text style={styles.warningDetail}>{timeAssessment.detail}</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Readiness Hero Card */}
        <Animated.View entering={FadeInDown.delay(80).duration(500)}>
          <View style={styles.readinessCard}>
            <LinearGradient
              colors={[statusColor + "10", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.readinessInner}>
              <ProgressRing score={readinessScore} size={148} strokeWidth={11} />
              <View style={styles.readinessMeta}>
                <View style={[styles.statusPill, { backgroundColor: statusColor + "20" }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
                <Text style={styles.trackingMsg}>{trackingMsg}</Text>
                <Text style={styles.daysText}>
                  {days > 0 ? `${days} days until summit` : "Summit day!"}
                </Text>
                <View style={styles.difficultyRow}>
                  <View style={[styles.diffPill, { backgroundColor: T.surface }]}>
                    <Feather name="flag" size={11} color={T.textMuted} />
                    <Text style={styles.diffText}>{summitGoal.difficulty}</Text>
                  </View>
                  <View style={[styles.diffPill, { backgroundColor: T.surface }]}>
                    <Feather name="zap" size={11} color={T.textMuted} />
                    <Text style={styles.diffText}>{summitGoal.fitnessLevel}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard icon="calendar" label="Days Remaining" value={days} accent={T.blue} delay={120} />
          <StatCard icon="trending-up" label="Max Ascent" value={maxElev} unit="m" accent={T.orange} delay={160} />
          <StatCard icon="check-circle" label="Sessions Done" value={totalDone} accent={T.green} delay={200} />
          <StatCard icon="bar-chart-2" label="This Week" value={weekCompletion} unit="%" accent={T.purple} delay={240} />
        </View>

        {/* Summit Goal Strip */}
        <Animated.View entering={FadeInDown.delay(260).duration(500)}>
          <View style={styles.goalStrip}>
            <View style={styles.goalItem}>
              <Text style={styles.goalVal}>{summitGoal.elevationGain}m</Text>
              <Text style={styles.goalLbl}>Elev. Gain</Text>
            </View>
            <View style={styles.goalDivider} />
            <View style={styles.goalItem}>
              <Text style={styles.goalVal}>{summitGoal.distance}km</Text>
              <Text style={styles.goalLbl}>Distance</Text>
            </View>
            <View style={styles.goalDivider} />
            <View style={styles.goalItem}>
              <Text style={styles.goalVal}>{summitGoal.highestAltitude}m</Text>
              <Text style={styles.goalLbl}>Max Altitude</Text>
            </View>
          </View>
        </Animated.View>

        {/* Current Week */}
        {currentWeek && (
          <Animated.View entering={FadeInDown.delay(300).duration(500)}>
            <View style={[styles.weekCard, { borderColor: PHASE_COLOR[currentWeek.phase] + "40" }]}>
              <LinearGradient
                colors={[PHASE_COLOR[currentWeek.phase] + "0A", "transparent"]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.weekCardTop}>
                <View style={[styles.phasePill, { backgroundColor: PHASE_COLOR[currentWeek.phase] + "20" }]}>
                  <View style={[styles.phaseDot, { backgroundColor: PHASE_COLOR[currentWeek.phase] }]} />
                  <Text style={[styles.phaseText, { color: PHASE_COLOR[currentWeek.phase] }]}>
                    Week {currentWeek.weekNumber} · {currentWeek.phase}
                  </Text>
                </View>
                {currentWeek.isPeakWeek && (
                  <View style={styles.peakBadge}>
                    <Text style={styles.peakBadgeText}>⚡ PEAK</Text>
                  </View>
                )}
                {currentWeek.isTaperWeek && (
                  <View style={styles.taperBadge}>
                    <Text style={styles.taperBadgeText}>↓ TAPER</Text>
                  </View>
                )}
                <Text style={[styles.weekTarget, { color: T.orange }]}>
                  {currentWeek.targetElevation}m
                </Text>
              </View>
              <Text style={styles.weekPurpose}>{currentWeek.purpose}</Text>
              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width: `${weekCompletion}%` as any,
                        backgroundColor: PHASE_COLOR[currentWeek.phase],
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressLabel, { color: PHASE_COLOR[currentWeek.phase] }]}>
                  {weekCompletion}%
                </Text>
              </View>
              <View style={styles.sessionChips}>
                {currentWeek.sessions.map((s, i) => (
                  <View key={i} style={[styles.sChip, { backgroundColor: T.surface }]}>
                    <Feather
                      name={s.type === "cardio" ? "heart" : s.type === "hill" ? "trending-up" : "flag"}
                      size={11}
                      color={s.type === "bigDay" ? T.orange : T.green}
                    />
                    <Text style={styles.sChipText}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        )}

        {/* AI Coach */}
        <Animated.View entering={FadeInDown.delay(320).duration(500)}>
          <View style={styles.coachCard}>
            <LinearGradient
              colors={
                coach?.tone === "positive" ? [T.greenDim, "transparent"] :
                coach?.tone === "warning"  ? [T.orangeDim, "transparent"] :
                                             [T.blueDim, "transparent"]
              }
              style={StyleSheet.absoluteFill}
            />
            {/* Header */}
            <View style={styles.coachHeader}>
              <View style={styles.coachTitleRow}>
                <View style={[
                  styles.coachIconWrap,
                  {
                    backgroundColor:
                      coach?.tone === "positive" ? T.green + "20" :
                      coach?.tone === "warning"  ? T.orange + "20" : T.blue + "20",
                  },
                ]}>
                  <Feather
                    name="cpu"
                    size={14}
                    color={
                      coach?.tone === "positive" ? T.green :
                      coach?.tone === "warning"  ? T.orange : T.blue
                    }
                  />
                </View>
                <Text style={styles.coachTitle}>AI Coach</Text>
              </View>
              <TouchableOpacity
                onPress={fetchCoach}
                disabled={coachLoading}
                style={styles.coachRefresh}
                activeOpacity={0.7}
              >
                <Feather name="refresh-cw" size={13} color={T.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Body */}
            {coachLoading ? (
              <View style={styles.coachLoading}>
                <ActivityIndicator size="small" color={T.green} />
                <Text style={styles.coachLoadingText}>Analysing your training...</Text>
              </View>
            ) : coachError ? (
              <View style={styles.coachLoading}>
                <Feather name="wifi-off" size={15} color={T.textMuted} />
                <Text style={styles.coachLoadingText}>Couldn't reach coach — tap refresh to retry</Text>
              </View>
            ) : coach ? (
              <>
                <Text style={styles.coachSummary}>{coach.summary}</Text>
                <View style={styles.coachTips}>
                  {coach.tips.map((tip, i) => (
                    <View key={i} style={styles.coachTip}>
                      <View style={[
                        styles.coachTipDot,
                        {
                          backgroundColor:
                            coach.tone === "positive" ? T.green :
                            coach.tone === "warning"  ? T.orange : T.blue,
                        },
                      ]} />
                      <Text style={styles.coachTipText}>{tip}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </View>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View entering={FadeInDown.delay(340).duration(500)} style={styles.actions}>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/log")}
            style={styles.primaryAction}
            activeOpacity={0.85}
          >
            <LinearGradient colors={["#3ECF75", "#2AB860"]} style={styles.primaryActionGrad}>
              <Feather name="plus" size={18} color="#fff" />
              <Text style={styles.primaryActionText}>Log Session</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/plan")}
            style={styles.secondaryAction}
            activeOpacity={0.85}
          >
            <Feather name="calendar" size={17} color={T.green} />
            <Text style={styles.secondaryActionText}>View Plan</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18 },
  createPlanBtn: { borderRadius: 16, overflow: "hidden" },
  createPlanGrad: { paddingHorizontal: 28, paddingVertical: 14 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  headerLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginBottom: 2 },
  headerMountain: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.white, maxWidth: 280 },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: T.greenDim,
    borderWidth: 1,
    borderColor: T.green + "30",
    alignItems: "center",
    justifyContent: "center",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: T.orangeDim,
    borderWidth: 1,
    borderColor: T.orange + "40",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  warningText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  warningDetail: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 16 },
  readinessCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: T.cardBorder,
    backgroundColor: T.card,
    padding: 20,
    marginBottom: 14,
    overflow: "hidden",
  },
  readinessInner: { flexDirection: "row", alignItems: "center", gap: 18 },
  readinessMeta: { flex: 1, gap: 8 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  trackingMsg: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.white, lineHeight: 22 },
  daysText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },
  difficultyRow: { flexDirection: "row", gap: 6, marginTop: 2 },
  diffPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  diffText: { fontSize: 11, fontFamily: "Inter_500Medium", color: T.textMuted },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  statCard: {
    backgroundColor: T.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.cardBorder,
    padding: 14,
    gap: 5,
  },
  statIconRow: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  statValue: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.white },
  statUnit: { fontSize: 15, fontFamily: "Inter_400Regular" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  goalStrip: {
    backgroundColor: T.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.cardBorder,
    flexDirection: "row",
    paddingVertical: 14,
    marginBottom: 12,
  },
  goalItem: { flex: 1, alignItems: "center" },
  goalVal: { fontSize: 18, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 2 },
  goalLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  goalDivider: { width: 1, backgroundColor: T.border, marginVertical: 4 },
  weekCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: T.card,
    padding: 16,
    marginBottom: 14,
    overflow: "hidden",
    gap: 10,
  },
  weekCardTop: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  phasePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  phaseDot: { width: 7, height: 7, borderRadius: 4 },
  phaseText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  peakBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: T.orangeDim },
  peakBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.orange, letterSpacing: 0.5 },
  taperBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: T.purpleDim },
  taperBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.purple, letterSpacing: 0.5 },
  weekTarget: { fontSize: 14, fontFamily: "Inter_700Bold", marginLeft: "auto" as any },
  weekPurpose: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 19 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressTrack: {
    flex: 1,
    height: 5,
    backgroundColor: T.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: 5, borderRadius: 3 },
  progressLabel: { fontSize: 12, fontFamily: "Inter_700Bold", width: 34, textAlign: "right" },
  sessionChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  sChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.border,
  },
  sChipText: { fontSize: 11, fontFamily: "Inter_500Medium", color: T.text },
  coachCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.cardBorder,
    backgroundColor: T.card,
    padding: 16,
    marginBottom: 14,
    overflow: "hidden",
    gap: 12,
  },
  coachHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  coachTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  coachIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  coachTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white },
  coachRefresh: { padding: 6 },
  coachLoading: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  coachLoadingText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, flex: 1 },
  coachSummary: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.text, lineHeight: 21 },
  coachTips: { gap: 10 },
  coachTip: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  coachTipDot: { width: 7, height: 7, borderRadius: 4, marginTop: 7, flexShrink: 0 },
  coachTipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: T.text, flex: 1, lineHeight: 19 },
  actions: { flexDirection: "row", gap: 10 },
  primaryAction: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: T.green,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryActionGrad: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryActionText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  secondaryAction: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: T.greenDim,
    borderWidth: 1,
    borderColor: T.green + "30",
  },
  secondaryActionText: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.green },
});
