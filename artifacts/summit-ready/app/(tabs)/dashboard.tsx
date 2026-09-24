import { Heart, Wind, Wrench, Zap, Moon, Calendar, TrendingUp, CheckCircle, Lock, Shield, AlertTriangle, Info, Compass, ChevronRight, Flag, Check, Minus, Plus, Footprints, Trophy, Mountain, Send, X, Lightbulb } from "lucide-react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";
import { useSubscription } from "@/lib/revenuecat";
import { logAiCoachUsed, logReadinessScoreViewed, useScreenView } from "@/lib/analytics";
import { AchievementToast } from "@/components/AchievementToast";
import { getDaysRemaining, getWeeklyCompletion, isRequirementMet } from "@/utils/readinessScore";
import { getCurrentWeek } from "@/utils/planGenerator";
import { assessTime } from "@/utils/timeValidator";
import { BASECAMP } from "@/constants/tokens";
import { BasecampHero } from "@/components/basecamp/BasecampHero";
import { BasecampReadiness } from "@/components/basecamp/BasecampReadiness";
import {
  MissionCard, MissionComplete, UpNextRail,
} from "@/components/basecamp/MissionSection";
import { ProgressTiles } from "@/components/basecamp/ProgressTiles";
import { EditorialBand, QuickActionsGrid } from "@/components/basecamp/QuickActions";
import { SRPanel, SRSectionHeader } from "@/components/ui";
import { missionQueue, weekProgress } from "@/utils/basecampPresentation";
import { mountainImageUri, sessionImageSubject } from "@/utils/mountainImage";
import { CoachInsight } from "@/components/CoachInsight";
import { buildCoachInsight } from "@/utils/coachInsightPresentation";
import { buildCoachFacts } from "@/utils/coachFactsAdapter";
import { useReadinessV2 } from "@/hooks/useReadinessV2";

// Animated WebP supports transparency on all platforms via expo-image.
// GIF on Android fills transparent pixels with black, so we never use it.
const MASCOT = require("@/assets/mascot.webp");

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

interface CoachAssessment {
  summary: string;
  tone: "positive" | "warning" | "neutral";
  tips: string[];
}

/* The previous MountainHero / HeroContent pair and their `heroStyles` sheet
   were REPLACED, not restyled: the approved composition is a different object.
   The artwork resolver and its fallback chain moved verbatim into
   `components/basecamp/BasecampHero.tsx`. */


// ── Alpine Guide Mascot ───────────────────────────────────────────────────────
function AlpineGuide({ tone: _tone, flush }: { tone?: "positive" | "warning" | "neutral"; flush?: boolean }) {
  return (
    <ExpoImage
      source={MASCOT}
      style={[
        { width: 72, height: 72 },
        flush && { marginLeft: -16, marginTop: -16, marginBottom: -16 },
      ]}
      contentFit="contain"
    />
  );
}



const ALPINE_CATEGORY_ICON: Record<string, any> = {
  endurance: Heart,
  altitude: Wind,
  technical: Wrench,
  strength: Zap,
  recovery: Moon,
};
const ALPINE_CATEGORY_COLOR: Record<string, string> = {
  endurance: T.green,
  altitude: T.blue,
  technical: T.orange,
  strength: T.purple,
  recovery: "#A78BFA",
};
const ALPINE_BAND_LABEL: Record<string, string> = {
  "high": "High Altitude",
  "very-high": "Very High Altitude",
  "extreme": "Extreme Altitude",
};
const ALPINE_TECH_LABEL: Record<string, string> = {
  "walking": "Walking",
  "scrambling": "Scrambling",
  "basic-crampons": "Crampons Required",
  "technical": "Technical Climbing",
  "advanced-technical": "Advanced Technical",
};

function AlpineCard({
  goal,
  sessions,
  trainingPlan,
  loading,
}: {
  goal: import("@/context/AppContext").SummitGoal;
  sessions: import("@/context/AppContext").Session[];
  trainingPlan: import("@/context/AppContext").TrainingWeek[];
  loading: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weeksElapsed = trainingPlan.filter(w => new Date(w.endDate) < today).length;
  const profile = goal.alpineProfile;

  if (loading) {
    return (
      <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(270).duration(500)}>
        <View style={styles.alpineCard}>
          <LinearGradient colors={[T.blue + "15", "transparent"]} style={StyleSheet.absoluteFill} />
          <View style={styles.alpineCardHeader}>
            <View style={styles.alpineIconWrap}>
              <Shield size={13} color={T.blue} />
            </View>
            <Text style={styles.alpineCardTitle}>Alpine Requirements</Text>
            <ActivityIndicator size="small" color={T.blue} style={{ marginLeft: "auto" as any }} />
          </View>
          <Text style={styles.alpineLoadingText}>Analysing {goal.mountainName}...</Text>
        </View>
      </Animated.View>
    );
  }

  if (!profile) return null;

  const requirements = Array.isArray(profile.requirements) ? profile.requirements : [];
  const keyRisks     = Array.isArray(profile.keyRisks) ? profile.keyRisks : [];
  const metCount = requirements.filter(req =>
    isRequirementMet(req, sessions, weeksElapsed)
  ).length;

  return (
    <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(270).duration(500)}>
      <View style={styles.alpineCard}>
        <LinearGradient colors={[T.blue + "12", "transparent"]} style={StyleSheet.absoluteFill} />

        {/* Header */}
        <View style={styles.alpineCardHeader}>
          <View style={styles.alpineIconWrap}>
            <Shield size={13} color={T.blue} />
          </View>
          <Text style={styles.alpineCardTitle}>Alpine Requirements</Text>
          <View style={styles.alpineAiBadge}>
            <Text style={styles.alpineAiBadgeText}>AI</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={styles.alpineMetCount}>
            {metCount}/{profile.requirements.length} met
          </Text>
        </View>

        <View style={styles.alpineTechRow}>
          <View style={styles.alpinePill}>
            <Text style={styles.alpinePillText}>{ALPINE_BAND_LABEL[profile.altitudeBand] ?? profile.altitudeBand}</Text>
          </View>
          <View style={styles.alpinePill}>
            <Text style={styles.alpinePillText}>{ALPINE_TECH_LABEL[profile.technicalLevel] ?? profile.technicalLevel}</Text>
          </View>
          <View style={styles.alpinePill}>
            <Text style={styles.alpinePillText}>Min {profile.minimumWeeks}wk</Text>
          </View>
        </View>

        {/* Essential context remains visible while detailed requirements stay one tap away. */}
        <View style={styles.alpineRisksRow}>
          <Text style={styles.alpineRisksLabel}>Key risks</Text>
          <View style={styles.alpineRisksChips}>
            {keyRisks.map((risk, i) => (
              <View key={i} style={styles.alpineRiskChip}>
                <AlertTriangle size={10} color={T.orange} />
                <Text style={styles.alpineRiskText}>{risk}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.alpineExpandButton}
          onPress={() => setExpanded(value => !value)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? "Hide alpine requirement details" : "View alpine requirement details"}
        >
          <Text style={styles.alpineExpandText}>
            {expanded ? "Hide requirements" : `View ${requirements.length} requirements`}
          </Text>
          <ChevronRight
            size={14}
            color={T.blue}
            style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}
          />
        </TouchableOpacity>

        {expanded && (
          <View style={styles.alpineExpandedContent}>
            <View style={styles.alpineDivider} />
            {requirements.map((req) => {
              const met = isRequirementMet(req, sessions, weeksElapsed);
              const color = ALPINE_CATEGORY_COLOR[req.category] ?? T.green;
              const AlpineIcon = ALPINE_CATEGORY_ICON[req.category] ?? CheckCircle;
              return (
                <View key={req.id} style={styles.alpineReqRow}>
                  <View style={[styles.alpineReqIconWrap, { backgroundColor: color + "18" }]}>
                    <AlpineIcon size={12} color={color} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.alpineReqLabel}>{req.label}</Text>
                    <Text style={styles.alpineReqDetail}>{req.detail}</Text>
                  </View>
                  <View style={[styles.alpineReqStatus, { backgroundColor: met ? T.green + "18" : "rgba(255,255,255,0.05)" }]}>
                    {met ? <Check size={12} color={T.green} /> : <Minus size={12} color={T.textMuted} />}
                  </View>
                </View>
              );
            })}
            <View style={styles.alpineDivider} />
            <View style={styles.alpineAcclimRow}>
              <Info size={12} color={T.blue} />
              <Text style={styles.alpineAcclimText}>{profile.acclimatizationNote}</Text>
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const reducedMotion = useReducedMotion();
  useScreenView("dashboard");
  const insets = useSafeAreaInsets();
  const { summitGoal, trainingPlan, sessions, readinessScore, hasViewedPlan, markPlanViewed, alpineProfileLoading, unlockedAchievements, newlyUnlocked, clearNewlyUnlocked, completedGoals, exploreHikes, completedPlanSessions, assignedHills } = useApp();
  const { isSubscribed } = useSubscription();
  /* Readiness 2.0 is read here only so the Coach card can DISPLAY authoritative
     figures. The Coach still produces none of them. */
  const readinessV2 = useReadinessV2();
  const [coach, setCoach] = useState<CoachAssessment | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState(false);
  const hasFetched = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // Tracks completed activity count so we can re-fetch the coach whenever
  // a new session or explore hike is added (count strictly increases).
  const prevActivityCount = useRef(
    sessions.filter(s => s.completed).length + exploreHikes.length
  );

  // Ask Coach
  const [askText, setAskText] = useState("");
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const askInputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const coachY = useRef(0);

  const [showBaselineModal, setShowBaselineModal] = useState(false);

  useEffect(() => {
    if (!summitGoal || readinessScore >= 40) return;
    AsyncStorage.getItem("baseline_popup_seen").then(val => {
      if (!val) setShowBaselineModal(true);
    });
  }, [summitGoal, readinessScore]);

  const dismissBaselineModal = async () => {
    await AsyncStorage.setItem("baseline_popup_seen", "1");
    setShowBaselineModal(false);
  };


  // Mark the plan as viewed after the user has had 5 seconds to see their
  // readiness score and plan — upgrade prompts only appear after this.
  useEffect(() => {
    if (!summitGoal || hasViewedPlan) return;
    const timer = setTimeout(() => { markPlanViewed(); }, 5000);
    return () => clearTimeout(timer);
  }, [summitGoal, hasViewedPlan, markPlanViewed]);

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

  // Auto-refresh coach whenever a new activity is logged (plan session or
  // explore hike). Only fires after the initial fetch is done and only for
  // Pro users. Uses the existing abort controller so any in-flight request
  // is cancelled cleanly before the new one starts.
  useEffect(() => {
    const count = sessions.filter(s => s.completed).length + exploreHikes.length;
    if (hasFetched.current && isSubscribed && summitGoal && count > prevActivityCount.current) {
      fetchCoach();
    }
    prevActivityCount.current = count;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, exploreHikes]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Fire once per dashboard mount (not on every readiness score recalculation)
  const readinessViewLoggedRef = useRef(false);
  useEffect(() => {
    if (!readinessViewLoggedRef.current) {
      readinessViewLoggedRef.current = true;
      void logReadinessScoreViewed({ readiness_score: readinessScore });
    }
  }, [readinessScore]);

  const handleAsk = useCallback(async () => {
    const q = askText.trim();
    if (!q || askLoading) return;
    Keyboard.dismiss();
    setAskLoading(true);
    setAskAnswer(null);
    try {
      const completed = sessions.filter(s => s.completed);
      const currentWeek = getCurrentWeek(trainingPlan);
      const totalElevation = completed.reduce((s, x) => s + x.elevationGain, 0);
      const days = summitGoal ? getDaysRemaining(summitGoal.summitDate) : undefined;
      const res = await fetch(`${API_BASE}/coach-ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          summitGoal,
          readinessScore,
          totalSessionsDone: completed.length,
          totalElevationLogged: totalElevation,
          daysRemaining: days,
          currentPhase: currentWeek?.phase,
        }),
      });
      const data = await res.json() as { answer?: string; error?: string };
      setAskAnswer(data.answer ?? data.error ?? "Couldn't get an answer.");
      void logAiCoachUsed({ interaction_type: "ask" });
    } catch {
      setAskAnswer("Couldn't reach your coach. Check your connection.");
    } finally {
      setAskLoading(false);
      setAskText("");
    }
  }, [askText, askLoading, sessions, trainingPlan, summitGoal, readinessScore]);

  function scrollToCoach() {
    scrollRef.current?.scrollTo({ y: coachY.current, animated: true });
    setTimeout(() => askInputRef.current?.focus(), 400);
  }

  if (!summitGoal) {
    return (
      /* The no-goal state keeps its existing content and actions — it is not
         part of the approved Training Basecamp composition, which assumes an
         objective. Only its ground colour moves, so it does not clash with the
         restyled shell above and below it. */
      <LinearGradient colors={[BASECAMP.ink, "#0A1114", BASECAMP.ink]} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            paddingTop: Platform.OS === "web" ? 56 : insets.top + 20,
            paddingBottom: Platform.OS === "web" ? 110 : insets.bottom + 130,
            paddingHorizontal: 18,
            gap: 14,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 24, fontFamily: "Inter_700Bold", color: T.text }}>
              SummitReady
            </Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 4 }}>
              Train for any mountain using hills near you
            </Text>
          </View>

          {/* Summit Goal Hero CTA */}
          <TouchableOpacity
            onPress={() => router.push("/questionnaire")}
            activeOpacity={0.88}
            style={homeStyles.goalHero}
          >
            <LinearGradient
              colors={["rgba(74,159,245,0.18)", "rgba(74,159,245,0.04)"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={homeStyles.goalHeroLeft}>
              <View style={homeStyles.goalHeroIcon}>
                <Mountain size={26} color={T.blue} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={homeStyles.goalHeroTitle}>Set your summit goal</Text>
                <Text style={homeStyles.goalHeroSub}>
                  Tell us your target mountain and we'll build a personalised training plan
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={T.blue} style={{ flexShrink: 0 }} />
          </TouchableOpacity>

          {/* Quick actions */}
          <View style={homeStyles.quickRow}>
            <TouchableOpacity
              style={homeStyles.quickCard}
              onPress={() => router.push("/hike-tracking")}
              activeOpacity={0.8}
            >
              <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <Footprints size={22} color={T.green} />
              <Text style={homeStyles.quickLabel}>Start Hiking</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={homeStyles.quickCard}
              onPress={() => router.push("/(tabs)/hills")}
              activeOpacity={0.8}
            >
              <Mountain size={22} color={T.orange} />
              <Text style={homeStyles.quickLabel}>Find Hills</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={homeStyles.quickCard}
              onPress={() => router.push("/(tabs)/challenges")}
              activeOpacity={0.8}
            >
              <Trophy size={22} color={T.blue} />
              <Text style={homeStyles.quickLabel}>Challenges</Text>
            </TouchableOpacity>
          </View>

          {/* Locked Training Plan teaser */}
          <View style={homeStyles.lockedCard}>
            <LinearGradient colors={[T.blueDim, "transparent"]} style={StyleSheet.absoluteFill} />
            <View style={homeStyles.lockedHeader}>
              <Calendar size={14} color={T.blue} />
              <Text style={homeStyles.lockedTitle}>Training Plan</Text>
              <View style={homeStyles.lockBadge}>
                <Lock size={10} color={T.textMuted} />
                <Text style={homeStyles.lockText}>Requires goal</Text>
              </View>
            </View>
            <View style={{ gap: 10, opacity: 0.35, marginTop: 4 }}>
              {["Week 1 · Base fitness", "Week 2 · Hill endurance", "Week 3 · Summit prep"].map((w, i) => (
                <View key={i} style={homeStyles.fakeWeekRow}>
                  <View style={homeStyles.fakeWeekDot} />
                  <Text style={homeStyles.fakeWeekText}>{w}</Text>
                  <View style={homeStyles.fakeWeekBar}>
                    <View style={[homeStyles.fakeWeekFill, { width: `${70 - i * 20}%` as unknown as number }]} />
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => router.push("/questionnaire")}
              style={homeStyles.unlockBtn}
              activeOpacity={0.8}
            >
              <Compass size={13} color={T.blue} />
              <Text style={[homeStyles.unlockBtnText, { color: T.blue }]}>Set a summit goal to unlock</Text>
              <ChevronRight size={13} color={T.blue} />
            </TouchableOpacity>
          </View>

          {/* Locked Readiness Score teaser */}
          <View style={homeStyles.lockedCard}>
            <LinearGradient colors={[T.orangeDim, "transparent"]} style={StyleSheet.absoluteFill} />
            <View style={homeStyles.lockedHeader}>
              <TrendingUp size={14} color={T.orange} />
              <Text style={homeStyles.lockedTitle}>Readiness Score</Text>
              <View style={homeStyles.lockBadge}>
                <Lock size={10} color={T.textMuted} />
                <Text style={homeStyles.lockText}>Requires goal</Text>
              </View>
            </View>
            <View style={{ alignItems: "center", paddingVertical: 16, opacity: 0.3 }}>
              <Text style={{ fontSize: 52, fontFamily: "Inter_700Bold", color: T.orange, lineHeight: 60 }}>—</Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 4 }}>
                How ready are you for your mountain?
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/questionnaire")}
              style={[homeStyles.unlockBtn, { borderColor: T.orange + "30" }]}
              activeOpacity={0.8}
            >
              <TrendingUp size={13} color={T.orange} />
              <Text style={[homeStyles.unlockBtnText, { color: T.orange }]}>Check your readiness</Text>
              <ChevronRight size={13} color={T.orange} />
            </TouchableOpacity>
          </View>

          {/* AI Coach teaser */}
          <View style={[homeStyles.lockedCard, { borderColor: "rgba(74,159,245,0.18)" }]}>
            <LinearGradient colors={[T.blueDim, "transparent"]} style={StyleSheet.absoluteFill} />
            <View style={homeStyles.lockedHeader}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14 }}>🗻</Text>
              </View>
              <Text style={homeStyles.lockedTitle}>AI Coach</Text>
              <View style={homeStyles.lockBadge}>
                <Lock size={10} color={T.textMuted} />
                <Text style={homeStyles.lockText}>Requires goal</Text>
              </View>
            </View>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 19 }}>
              Once you set a summit goal, your AI Coach analyses your training and gives you personalised tips, weekly assessments, and readiness feedback.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/questionnaire")}
              style={homeStyles.unlockBtn}
              activeOpacity={0.8}
            >
              <Compass size={13} color={T.blue} />
              <Text style={[homeStyles.unlockBtnText, { color: T.blue }]}>Set goal to meet your coach</Text>
              <ChevronRight size={13} color={T.blue} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    );
  }

  const currentWeek = getCurrentWeek(trainingPlan);
  const timeAssessment = assessTime(
    summitGoal.summitDate,
    summitGoal.difficulty,
    summitGoal.fitnessLevel,
    summitGoal.trainingDaysPerWeek
  );
  const sessionsPerWeek = summitGoal?.trainingDaysPerWeek ?? 4;
  const weekCompletion = currentWeek ? getWeeklyCompletion(sessions, currentWeek.weekNumber, sessionsPerWeek) : 0;

  /* The mission and the Up Next rail both come from the plan's own order and
     the completion map the plan screen writes, through one adapter — so
     Basecamp cannot disagree with the Training Plan about what is next. */
  const { mission, upNext } = missionQueue(trainingPlan, completedPlanSessions, {
    fromWeekNumber: currentWeek?.weekNumber ?? null,
  });
  const week = weekProgress(currentWeek, completedPlanSessions);

  /* The Coach reads the same session — it is told what is next, it does not
     decide it. */
  /* A session's photograph is the hill the plan assigned to it; failing that,
     the objective the whole plan is for. Both come from the existing
     mountain-image service — nothing stock, and never another mountain. */
  const sessionImage = useCallback((session: { key: string } | null) => {
    if (!session) return null;
    const subject = sessionImageSubject({
      assignedHillName: assignedHills?.[session.key]?.name ?? null,
      mountainName: summitGoal?.mountainName ?? null,
    });
    return mountainImageUri(subject, { width: 320, height: 300 });
  }, [assignedHills, summitGoal?.mountainName]);

  const nextSession = mission
    ? currentWeek?.sessions?.[mission.sessionIndex] ?? null
    : null;

  const openSession = (s: { weekNumber: number; sessionIndex: number }) => router.push({
    pathname: "/session-detail",
    params: { weekNum: String(s.weekNumber), sessionIdx: String(s.sessionIndex) },
  });

  const quickActions = [
    { id: "hills", label: "Find Hills", Icon: Mountain, onPress: () => router.push("/(tabs)/hills") },
    { id: "plan", label: "Training Plan", Icon: Calendar, onPress: () => router.push("/(tabs)/plan") },
    { id: "log", label: "Log Activity", Icon: Plus, onPress: () => router.push("/(tabs)/log") },
    { id: "change", label: "Change Mountain", Icon: Flag, onPress: () => router.push("/setup?mode=change") },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: BASECAMP.ink }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Objective ─────────────────────────────────────────────────
            The mountain, its real figures and the target date. */}
        <BasecampHero
          mountainName={summitGoal.mountainName}
          summitDate={summitGoal.summitDate}
          goal={summitGoal}
          topInset={Platform.OS === "web" ? 20 : insets.top + 12}
          isSubscribed={isSubscribed}
          onEditObjective={() => router.push("/setup")}
          onChangeMountain={() => router.push("/setup?mode=change")}
          onPressSubscription={() => router.push(isSubscribed ? "/subscription" : "/paywall")}
        />

        {/* ── Readiness ─────────────────────────────────────────────────
            Readiness 2.0's score, its next action and its own projection.
            Locked keeps the ring and withholds the figure. */}
        <BasecampReadiness
          result={readinessV2?.result ?? null}
          nextAction={readinessV2?.nextAction ?? null}
          isSubscribed={isSubscribed}
          onOpen={() => router.push(isSubscribed ? "/readiness-detail" as any : "/paywall")}
        />

        {/* ── This week's mission ───────────────────────────────────── */}
        {trainingPlan.length > 0 && (
          <View style={styles.section}>
            <SRSectionHeader
              title="This week's mission"
              action="View plan"
              onAction={() => router.push("/(tabs)/plan")}
            />
            <View style={{ marginTop: 10 }}>
              {mission ? (
                <MissionCard
                  session={mission}
                  imageUri={sessionImage(mission)}
                  phase={currentWeek?.phase ?? null}
                  onStart={() => openSession(mission)}
                  onOpen={() => openSession(mission)}
                />
              ) : (
                <MissionComplete onOpenPlan={() => router.push("/(tabs)/plan")} />
              )}
            </View>
          </View>
        )}

        {/* ── Up next ───────────────────────────────────────────────── */}
        <UpNextRail
          sessions={upNext}
          imageUriFor={sessionImage}
          onOpenSession={openSession}
          onOpenPlan={() => router.push("/(tabs)/plan")}
        />

        {/* ── AI Coach ──────────────────────────────────────────────────
            SummitReady's existing Coach, inside the composition rather than
            on a card of its own. The fetch, the retry, the ask box and the
            SUBSCRIPTION GATE are exactly as they were: `buildCoachInsight`
            returns the locked state for an unentitled user, so no assessment
            text reaches them. The Coach still authors no figure — the
            mountain, readiness, projection and next session are all passed in
            as engine-supplied facts. */}
        <View
          style={styles.coachBand}
          onLayout={(e) => { coachY.current = e.nativeEvent.layout.y; }}
        >
          {/* An integrated band, not another rounded card: a hairline rule
              above, the page's own background behind. CoachInsight carries its
              own tracked-out AI COACH header and the mascot, so the section
              does not repeat them. */}
          <View style={styles.coachInner}>
            <CoachInsight
              state={buildCoachInsight({
                hasGoal: Boolean(summitGoal),
                entitled: isSubscribed,
                loading: coachLoading,
                error: coachError,
                assessment: coach,
                facts: buildCoachFacts({
                  mountainName: summitGoal?.mountainName ?? null,
                  overallScore: readinessV2?.result?.overallScore ?? null,
                  projectedDelta: readinessV2?.nextAction?.projectedImpact?.delta ?? null,
                  nextSession,
                }),
              })}
              mascot={<AlpineGuide />}
              variant="compact"
              onRetry={fetchCoach}
              onRefresh={isSubscribed ? fetchCoach : undefined}
              onOpen={isSubscribed ? () => askInputRef.current?.focus() : undefined}
              onUnlock={() => router.push("/paywall")}
            />

            {isSubscribed && (
              <View style={styles.askBox}>
                <TextInput
                  ref={askInputRef}
                  style={styles.askInput}
                  placeholder="Ask your coach..."
                  placeholderTextColor={BASECAMP.textDim}
                  value={askText}
                  onChangeText={setAskText}
                  onSubmitEditing={handleAsk}
                  returnKeyType="send"
                  accessibilityLabel="Ask your coach a question"
                />
                <TouchableOpacity
                  style={styles.askBtn}
                  onPress={handleAsk}
                  disabled={!askText.trim() || askLoading}
                  accessibilityRole="button"
                  accessibilityLabel="Send question to your coach"
                >
                  {askLoading
                    ? <ActivityIndicator size="small" color={BASECAMP.accentInk} />
                    : <Send size={16} color={BASECAMP.accentInk} />}
                </TouchableOpacity>
              </View>
            )}

            {isSubscribed && askAnswer && (
              <Animated.View
                entering={reducedMotion ? undefined : FadeInDown.duration(400)}
                style={styles.answerBubble}
              >
                <Text style={styles.answerText}>{askAnswer}</Text>
                <TouchableOpacity
                  onPress={() => setAskAnswer(null)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss answer"
                >
                  <X size={13} color={BASECAMP.textDim} />
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        </View>

        {/* ── Progression ───────────────────────────────────────────── */}
        <ProgressTiles
          week={week}
          onOpenBank={() => router.push("/elevation-history")}
          onOpenPlan={() => router.push("/(tabs)/plan")}
        />

        {/* ── Training insight ──────────────────────────────────────────
            The existing time assessment, in the composition's own voice.
            Its wording and thresholds are the engine's, unchanged. */}
        {timeAssessment
          && (timeAssessment.status === "insufficient"
            || timeAssessment.status === "impossible"
            || timeAssessment.status === "tight") && (
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(60).duration(500)}
            style={styles.section}
          >
            <SRPanel style={styles.insightPanel}>
              <View style={styles.insightRow}>
                <View style={styles.insightIcon}>
                  <Lightbulb size={15} color={T.orange} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.insightEyebrow}>TRAINING INSIGHT</Text>
                  <Text style={styles.insightTitle}>{timeAssessment.message}</Text>
                  <Text style={styles.insightDesc}>{timeAssessment.detail}</Text>
                </View>
              </View>
            </SRPanel>
          </Animated.View>
        )}

        {/* ── Alpine requirements ───────────────────────────────────────
            Alpine objectives only. Existing content and logic. */}
        {summitGoal.difficulty === "Alpine" && (
          <View style={styles.section}>
            <AlpineCard
              goal={summitGoal}
              sessions={sessions}
              trainingPlan={trainingPlan}
              loading={alpineProfileLoading}
            />
          </View>
        )}

        {/* ── Close ─────────────────────────────────────────────────── */}
        <EditorialBand onPress={() => router.push("/(tabs)/explore")} />
        <QuickActionsGrid actions={quickActions} />
      </ScrollView>

      {newlyUnlocked.length > 0 && (
        <AchievementToast newlyUnlocked={newlyUnlocked} onDismiss={clearNewlyUnlocked} />
      )}

      <Modal
        visible={showBaselineModal}
        transparent
        animationType="fade"
        onRequestClose={dismissBaselineModal}
      >
        <View style={styles.baselineOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={dismissBaselineModal} activeOpacity={1} />
          <View style={styles.baselineSheet}>
            <View style={styles.baselineIconWrap}>
              <TrendingUp size={28} color={T.green} />
            </View>
            <Text style={styles.baselineTitle}>This is your baseline</Text>
            <Text style={styles.baselineBody}>
              Your starting score is built from your questionnaire — it reflects where you are right now, not where you'll be.{"\n\n"}The more training sessions you log, the more accurately it reflects your real fitness. Keep training and watch it grow.
            </Text>
            <TouchableOpacity onPress={dismissBaselineModal} style={styles.baselineBtn} activeOpacity={0.8}>
              <Text style={styles.baselineBtnText}>Got it, let's go</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  /* The Coach reads as part of the page rather than a widget sitting on it:
     a hairline above, no border, no rounded shell. */
  coachBand: {
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: BASECAMP.hairline,
  },
  coachInner: { paddingHorizontal: BASECAMP.gutter },

  alpineCard: {
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.basecampBorder,
  },
  alpineCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  alpineIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    justifyContent: "center",
  },
  alpineCardTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: T.basecampText,
  },
  alpineAiBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: T.blue + "22",
  },
  alpineAiBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: T.blue,
    letterSpacing: 0.5,
  },
  alpineMetCount: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: T.basecampTextMuted,
  },
  alpineTechRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  alpinePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  alpinePillText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: T.basecampTextMuted,
  },
  alpineDivider: {
    height: 1,
    backgroundColor: T.basecampBorder,
    opacity: 0.5,
  },
  alpineReqRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  alpineReqIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  alpineReqLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: T.basecampText,
    lineHeight: 18,
  },
  alpineReqDetail: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: T.basecampTextMuted,
    lineHeight: 16,
  },
  alpineReqStatus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  alpineRisksRow: {
    gap: 6,
  },
  alpineRisksLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: T.basecampTextMuted,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  alpineRisksChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  alpineRiskChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: T.orangeDim,
    borderWidth: 1,
    borderColor: T.orange + "30",
  },
  alpineRiskText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: T.orange,
  },
  alpineAcclimRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: T.blue + "0C",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: T.blue + "20",
  },
  alpineAcclimText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: T.basecampTextMuted,
    lineHeight: 18,
    flex: 1,
  },
  alpineExpandButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 10,
  },
  alpineExpandText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: T.blue,
  },
  alpineExpandedContent: {
    gap: 12,
  },
  alpineLoadingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.basecampTextMuted,
  },


  /* ── The approved Training Basecamp composition ──────────────────────
     A single rhythm: everything below the hero sits on the same 17pt
     gutter with generous vertical air between sections, rather than a
     stack of equally-weighted cards. */
  section: {
    paddingHorizontal: BASECAMP.gutter,
    marginTop: 22,
  },
  insightPanel: { borderColor: "rgba(227,166,74,0.28)" },
  insightRow: { flexDirection: "row", alignItems: "flex-start", gap: 11, padding: 14 },
  insightIcon: {
    width: 28, height: 28, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(227,166,74,0.14)",
  },

  insightEyebrow: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  insightTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  insightDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    lineHeight: 16,
    marginTop: 2,
  },
  askBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  askInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    backgroundColor: BASECAMP.panelSub,
    borderWidth: 1,
    borderColor: BASECAMP.panelSubBorder,
    borderRadius: 22,
    paddingHorizontal: 16,
    color: BASECAMP.text,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  askBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BASECAMP.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  answerBubble: {
    marginHorizontal: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: BASECAMP.accentDim,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(36,239,164,0.28)",
  },
  answerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: BASECAMP.text,
    lineHeight: 20,
    flex: 1,
  },
  baselineOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  baselineSheet: {
    backgroundColor: T.basecampBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: T.basecampBorder,
    padding: 28,
    paddingBottom: 48,
    gap: 14,
  },
  baselineIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: T.greenDim,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 4,
  },
  baselineTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: T.basecampText,
    textAlign: "center",
  },
  baselineBody: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: T.basecampTextMuted,
    textAlign: "center",
    lineHeight: 23,
  },
  baselineBtn: {
    backgroundColor: T.green,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 6,
  },
  baselineBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
});

const homeStyles = StyleSheet.create({
  goalHero: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(74,159,245,0.25)",
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    overflow: "hidden",
  },
  goalHeroLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  goalHeroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: T.blueDim,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  goalHeroTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: T.text,
  },
  goalHeroSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    lineHeight: 18,
  },
  quickRow: {
    flexDirection: "row",
    gap: 10,
  },
  quickCard: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
    overflow: "hidden",
  },
  quickLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: T.text,
    textAlign: "center",
  },
  lockedCard: {
    backgroundColor: T.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    padding: 18,
    gap: 14,
    overflow: "hidden",
  },
  lockedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lockedTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: T.text,
    flex: 1,
  },
  lockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  lockText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: T.textMuted,
  },
  fakeWeekRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fakeWeekDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.textDim,
    flexShrink: 0,
  },
  fakeWeekText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    width: 130,
  },
  fakeWeekBar: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 2,
    overflow: "hidden",
  },
  fakeWeekFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: T.textDim,
  },
  unlockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: T.blue + "30",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  unlockBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: T.blue,
  },
});

const modeToggleStyles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    backgroundColor: "rgba(6,13,27,0.78)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
    padding: 3,
  },
  seg: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 19,
  },
  segActive: {
    backgroundColor: T.green,
  },
  segText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.65)",
  },
  segTextActive: {
    color: T.bg,
    fontFamily: "Inter_700Bold",
  },
});
