import type { LucideIcon } from "lucide-react-native";
import { Heart, Wind, Wrench, Zap, Moon, Calendar, TrendingUp, CheckCircle, BarChart2, Lock, Pencil, Shield, AlertTriangle, Info, Compass, ChevronRight, Clock, Flag, Check, Minus, RefreshCw, WifiOff, Plus, Footprints, Trophy, Mountain, MessageCircle, Send, X, Target, Award } from "lucide-react-native";
import { BlurView } from "expo-blur";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageBackground,
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
import { T, PHASE_COLOR } from "@/constants/theme";
import { useSubscription } from "@/lib/revenuecat";
import { logAiCoachUsed, logReadinessScoreViewed, useScreenView } from "@/lib/analytics";
import { AchievementToast } from "@/components/AchievementToast";
import { getDaysRemaining, getWeeklyCompletion, isRequirementMet } from "@/utils/readinessScore";
import { getCurrentWeek } from "@/utils/planGenerator";
import { assessTime } from "@/utils/timeValidator";
import { ACHIEVEMENTS, TIER_COLOR } from "@/utils/achievements";
import { ProgressRing } from "@/components/ProgressRing";
import { ReadinessV2Hero } from "@/components/ReadinessV2Hero";
import { ElevationBankCard } from "@/components/ElevationBankCard";
import { resolveTrainingBasecampArtwork } from "@/utils/artworkResolver";

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

const { width } = Dimensions.get("window");
const CARD_W = (width - 48) / 2;

function getIconForCategory(category: string, color: string, size = 20) {
  switch (category) {
    case "mountain": return <Mountain size={size} color={color} />;
    case "elevation": return <TrendingUp size={size} color={color} />;
    case "expedition": return <Compass size={size} color={color} />;
    case "training": return <Target size={size} color={color} />;
    default: return <Award size={size} color={color} />;
  }
}

// ── Mountain Hero ─────────────────────────────────────────────────────────────
function MountainHero({
  mountainName,
  summitDate,
  topInset,
  onEdit,
  isSubscribed,
  hasViewedPlan,
  elevationGain,
  distance,
  highestAltitude,
}: {
  mountainName: string;
  summitDate: string;
  topInset: number;
  onEdit: () => void;
  isSubscribed: boolean;
  hasViewedPlan: boolean;
  elevationGain: number;
  distance: number;
  highestAltitude: number;
}) {
  const [imageError, setImageError] = useState(false);
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);

  useEffect(() => { setImageError(false); }, [mountainName]);

  useEffect(() => {
    let active = true;
    setResolvedUri(null);

    async function loadArtwork() {
      const devProfileId = await AsyncStorage.getItem("summitready_dev_profile_id");
      const uri = await resolveTrainingBasecampArtwork({ devProfileId, mountainName });
      if (active) setResolvedUri(uri);
    }
    void loadArtwork();
    return () => { active = false; };
  }, [mountainName]);

  const mountainFallbackUri = `${API_BASE}/mountain-image?name=${encodeURIComponent(mountainName)}`;
  const heroImageUri = imageError
    ? null
    : (resolvedUri || mountainFallbackUri);

  const dateStr = summitDate
    ? new Date(summitDate + "T12:00:00").toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
      })
    : "";

  return (
    <View style={[heroStyles.container, { height: 380 }]}>
      {heroImageUri ? (
        <ImageBackground
          source={{ uri: heroImageUri }}
          style={heroStyles.image}
          resizeMode="cover"
          onError={() => {
            if (resolvedUri) {
              setResolvedUri(null);
              setImageError(false);
              return;
            }
            setImageError(true);
          }}
        >
          {/* Top subtle vignette */}
          <LinearGradient
            colors={["rgba(0,0,0,0.5)", "transparent"]}
            style={[StyleSheet.absoluteFill, { height: "40%" }]}
          />
          {/* Bottom fade into basecamp bg */}
          <LinearGradient
            colors={["transparent", "rgba(11,13,17,0.7)", T.basecampBg]}
            style={[StyleSheet.absoluteFill, { top: "30%" }]}
          />
          <HeroContent
            mountainName={mountainName}
            dateStr={dateStr}
            topInset={topInset}
            onEdit={onEdit}
            isSubscribed={isSubscribed}
            hasViewedPlan={hasViewedPlan}
            elevationGain={elevationGain}
            distance={distance}
            highestAltitude={highestAltitude}
          />
        </ImageBackground>
      ) : (
        /* Gradient fallback */
        <LinearGradient
          colors={["#1E293B", "#0F172A", T.basecampBg]}
          style={heroStyles.image}
        >
          <HeroContent
            mountainName={mountainName}
            dateStr={dateStr}
            topInset={topInset}
            onEdit={onEdit}
            isSubscribed={isSubscribed}
            hasViewedPlan={hasViewedPlan}
            elevationGain={elevationGain}
            distance={distance}
            highestAltitude={highestAltitude}
          />
        </LinearGradient>
      )}
    </View>
  );
}

function HeroContent({
  mountainName, dateStr, topInset, onEdit, isSubscribed, hasViewedPlan,
  elevationGain, distance, highestAltitude,
}: { mountainName: string; dateStr: string; topInset: number; onEdit: () => void; isSubscribed: boolean; hasViewedPlan: boolean; elevationGain: number; distance: number; highestAltitude: number }) {
  return (
    <View style={[heroStyles.overlay, { paddingTop: topInset }]}>
      <View style={heroStyles.topRow}>
        <View style={heroStyles.headerButtons}>
          {hasViewedPlan && (
            <TouchableOpacity onPress={() => router.push(isSubscribed ? "/subscription" : "/paywall")} style={heroStyles.editBtn} activeOpacity={0.8}>
              {isSubscribed ? <Zap size={14} color={T.basecampTextMuted} /> : <Lock size={14} color={T.basecampTextMuted} />}
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onEdit} style={heroStyles.editBtn} activeOpacity={0.8}>
            <Pencil size={14} color={T.basecampTextMuted} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={heroStyles.bottomText}>
        <View style={{ gap: 6 }}>
          <Text style={heroStyles.trainingFor}>Training objective</Text>
          <View style={heroStyles.mountainNameRow}>
            <Text style={heroStyles.mountainName} numberOfLines={2}>{mountainName}</Text>
            <TouchableOpacity
              onPress={() => router.push("/setup?mode=change")}
              style={heroStyles.namePencil}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Change mountain objective"
            >
              <Pencil size={14} color={T.basecampTextMuted} />
            </TouchableOpacity>
          </View>
          <Text style={heroStyles.editorialStats}>
            {dateStr ? `${dateStr} · ` : ""}{elevationGain}m gain · {distance}km · {highestAltitude}m max alt
          </Text>
        </View>
      </View>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  container: { width: "100%" },
  image: { width: "100%", height: "100%" },
  overlay: {
    flex: 1,
    paddingHorizontal: 18,
    justifyContent: "space-between",
    paddingBottom: 24,
  },
  topRow: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoSmall: { width: 140, height: 60, opacity: 0.9 },
  headerButtons: {
    position: "absolute",
    right: 0,
    top: 10,
    flexDirection: "row",
    gap: 8,
  },
  editBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  bottomText: { gap: 4 },
  mountainNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  namePencil: { marginTop: 4, opacity: 0.9 },
  editorialStats: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: T.basecampTextMuted,
    marginTop: 4,
  },
  trainingFor: {
    fontSize: 10, fontFamily: "Inter_700Bold",
    color: T.basecampTextMuted, letterSpacing: 1.5,
  },
  mountainName: {
    fontSize: 34, fontFamily: "Inter_700Bold", color: T.basecampText,
    letterSpacing: -0.5, lineHeight: 40,
  },
});

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

        <View style={styles.alpineDivider} />

        {/* Requirements checklist */}
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

        {/* Key risks */}
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

        {/* Acclimatization note */}
        <View style={styles.alpineAcclimRow}>
          <Info size={12} color={T.blue} />
          <Text style={styles.alpineAcclimText}>{profile.acclimatizationNote}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const reducedMotion = useReducedMotion();
  useScreenView("dashboard");
  const insets = useSafeAreaInsets();
  const { summitGoal, trainingPlan, sessions, readinessScore, hasViewedPlan, markPlanViewed, alpineProfileLoading, unlockedAchievements, newlyUnlocked, clearNewlyUnlocked, completedGoals, exploreHikes, completedPlanSessions } = useApp();
  const { isSubscribed } = useSubscription();
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
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
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
  const maxElev = sessions.filter(s => s.completed).reduce((m, s) => Math.max(m, s.elevationGain), 0);
  const totalDone = sessions.filter(s => s.completed).length;
  const hillsDone = sessions.filter(s => s.completed && s.type === "hill").length;


  let nextSession = null;
  let nextSessionIndex = -1;
  if (currentWeek) {
    const idx = currentWeek.sessions.findIndex((s, i) => !completedPlanSessions[s.id ?? `${currentWeek.weekNumber}-${i}`]);
    if (idx !== -1) {
      nextSession = currentWeek.sessions[idx];
      nextSessionIndex = idx;
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.basecampBg }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: Platform.OS === "web" ? 110 : insets.bottom + 110,
        }}
        showsVerticalScrollIndicator={false}
      >
        <MountainHero
          mountainName={summitGoal.mountainName}
          summitDate={summitGoal.summitDate}
          topInset={Platform.OS === "web" ? 20 : insets.top + 44}
          onEdit={() => router.push("/setup")}
          isSubscribed={isSubscribed}
          hasViewedPlan={hasViewedPlan}
          elevationGain={summitGoal.elevationGain}
          distance={summitGoal.distance}
          highestAltitude={summitGoal.highestAltitude}
        />

        <View style={styles.editorialContent}>
          {/* Mission */}
          {currentWeek && (
            <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(90).duration(500)} style={styles.editorialSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>This week's mission</Text>
                <View style={[styles.missionPhasePill, { backgroundColor: PHASE_COLOR[currentWeek.phase] + "1A" }]}>
                  <View style={[styles.phaseDot, { backgroundColor: PHASE_COLOR[currentWeek.phase] }]} />
                  <Text style={[styles.missionPhaseText, { color: PHASE_COLOR[currentWeek.phase] }]}>
                    Week {currentWeek.weekNumber} · {currentWeek.phase}
                  </Text>
                </View>
              </View>

              <View
                style={styles.missionWeekProgress}
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={`Week ${currentWeek.weekNumber} completion`}
                accessibilityValue={{ min: 0, max: 100, now: weekCompletion }}
              >
                <View style={styles.missionProgressTrack}>
                  <View
                    style={[
                      styles.missionProgressFill,
                      {
                        width: `${weekCompletion}%` as any,
                        backgroundColor: PHASE_COLOR[currentWeek.phase],
                      },
                    ]}
                  />
                </View>
                <Text style={styles.missionProgressLabel}>{weekCompletion}% complete</Text>
              </View>

              {nextSession ? (
                <TouchableOpacity
                  style={styles.dominantAction}
                  activeOpacity={0.8}
                  onPress={() => router.push({
                    pathname: "/session-detail",
                    params: {
                      weekNum: String(currentWeek.weekNumber),
                      sessionIdx: String(nextSessionIndex),
                    },
                  })}
                >
                  <View style={styles.dominantActionIcon}>
                    <Target size={20} color={T.green} />
                  </View>
                  <View style={styles.dominantActionBody}>
                    <Text style={styles.dominantActionLabel}>Up next</Text>
                    <Text style={styles.dominantActionTitle}>{nextSession.label}</Text>
                    <Text style={styles.dominantActionDesc} numberOfLines={2}>{nextSession.description}</Text>
                  </View>
                  <ChevronRight size={20} color={T.basecampTextMuted} />
                </TouchableOpacity>
              ) : (
                <View style={styles.dominantActionComplete}>
                  <CheckCircle size={20} color={T.green} />
                  <Text style={styles.dominantActionCompleteText}>Week {currentWeek.weekNumber} complete. Great work.</Text>
                </View>
              )}
            </Animated.View>
          )}

          <View style={styles.separator} />

          {/* Readiness */}
          <View style={styles.editorialSection}>
            <ReadinessV2Hero />
          </View>

          <View style={styles.separator} />

          {/* Progress */}
          <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(110).duration(500)} style={styles.editorialSection}>
            <ElevationBankCard onPress={() => router.push("/elevation-history")} />

            <View style={styles.flatStatsGrid}>
              <View style={styles.flatStat}>
                <Text style={styles.flatStatValue}>{summitGoal.elevationGain.toLocaleString()}<Text style={styles.flatStatUnit}>m</Text></Text>
                <Text style={styles.flatStatLabel}>Elev. Goal</Text>
              </View>
              <View style={styles.flatStat}>
                <Text style={styles.flatStatValue}>{totalDone}</Text>
                <Text style={styles.flatStatLabel}>Sessions</Text>
              </View>
              <View style={styles.flatStat}>
                <Text style={styles.flatStatValue}>{hillsDone}</Text>
                <Text style={styles.flatStatLabel}>Hills done</Text>
              </View>
              <View style={styles.flatStat}>
                <Text style={styles.flatStatValue}>{unlockedAchievements.length}</Text>
                <Text style={styles.flatStatLabel}>Badges</Text>
              </View>
            </View>
          </Animated.View>

          <View style={styles.separator} />

          {/* Secondary content */}
          <View style={styles.editorialSection}>
            <Text style={styles.sectionTitle}>Supporting</Text>

            {/* Time Warning */}
            {timeAssessment && (timeAssessment.status === "insufficient" || timeAssessment.status === "impossible" || timeAssessment.status === "tight") && (
              <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(60).duration(500)}>
                <View style={[
                  styles.flatRow,
                  timeAssessment.status === "tight"
                    ? { backgroundColor: T.orangeDim, borderColor: T.orange + "40" }
                    : { backgroundColor: "rgba(255,68,68,0.10)", borderColor: T.red + "40" },
                ]}>
                  {timeAssessment.status === "tight" ? <Clock size={16} color={T.orange} /> : <AlertTriangle size={16} color={T.red} />}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.flatRowTitle, { color: timeAssessment.status === "tight" ? T.orange : T.red }]}>
                      {timeAssessment.message}
                    </Text>
                    <Text style={styles.flatRowDesc}>{timeAssessment.detail}</Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Alpine Requirements */}
            {summitGoal.difficulty === "Alpine" && (
              <AlpineCard
                goal={summitGoal}
                sessions={sessions}
                trainingPlan={trainingPlan}
                loading={alpineProfileLoading}
              />
            )}

            {/* Achievements */}
            <TouchableOpacity style={styles.flatRow} onPress={() => router.push("/(tabs)/account")} activeOpacity={0.7}>
              <View style={styles.flatRowIconWrap}>
                <Trophy size={16} color="#FFD700" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.flatRowTitle}>Achievements</Text>
                <Text style={styles.flatRowDesc}>{unlockedAchievements.length} unlocked</Text>
              </View>
              <ChevronRight size={16} color={T.basecampTextMuted} />
            </TouchableOpacity>

            {/* AI Coach */}
            <TouchableOpacity style={styles.flatRow} onPress={isSubscribed ? scrollToCoach : () => router.push("/paywall")} activeOpacity={0.7}>
              <View style={styles.flatRowIconWrap}>
                <MessageCircle size={16} color={T.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.flatRowTitle}>AI Coach</Text>
                <Text style={styles.flatRowDesc}>{isSubscribed ? "Ask for personalised training advice" : "Pro feature"}</Text>
              </View>
              {isSubscribed ? <ChevronRight size={16} color={T.basecampTextMuted} /> : (
                <View style={styles.proBadge}>
                  <Lock size={10} color={T.green} />
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Upgrade Prompt */}
            {!isSubscribed && (
              <TouchableOpacity style={styles.quietUpsell} onPress={() => router.push("/paywall")} activeOpacity={0.7}>
                <Zap size={14} color={T.green} />
                <Text style={styles.quietUpsellText}>Upgrade to Summit Ready Pro</Text>
                <ChevronRight size={14} color={T.basecampTextMuted} />
              </TouchableOpacity>
            )}

            {/* Coach Query area */}
            {isSubscribed && (
              <View style={styles.coachContainer} onLayout={(e) => { coachY.current = e.nativeEvent.layout.y; }}>
                <View style={styles.coachHeader}>
                  <View style={styles.coachChatArea}>
                    <AlpineGuide flush />
                    <View>
                      <Text style={styles.coachHeaderTitle}>Your coach assessment</Text>
                      <Text style={styles.coachHeaderSub}>Based on your current training data</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={fetchCoach}
                    disabled={coachLoading}
                    style={styles.coachRefresh}
                    activeOpacity={0.7}
                    accessibilityLabel="Refresh coach assessment"
                  >
                    <RefreshCw size={14} color={T.basecampTextMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.coachBubble}>
                  {coachError ? (
                    <TouchableOpacity onPress={fetchCoach} style={styles.coachRetry} activeOpacity={0.7}>
                      <WifiOff size={15} color={T.basecampTextMuted} />
                      <Text style={styles.coachBubbleText}>Couldn't reach coach — tap to retry</Text>
                    </TouchableOpacity>
                  ) : coachLoading || !coach ? (
                    <View style={styles.coachRetry}>
                      <ActivityIndicator size="small" color={T.green} />
                      <Text style={styles.coachBubbleText}>Analysing your training...</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.coachBubbleText}>{coach.summary}</Text>
                      <View style={styles.coachTips}>
                        {coach.tips.map((tip, index) => (
                          <View key={index} style={styles.coachTip}>
                            <View style={[
                              styles.coachTipDot,
                              {
                                backgroundColor:
                                  coach.tone === "positive" ? T.green
                                  : coach.tone === "warning" ? T.orange
                                  : T.blue,
                              },
                            ]} />
                            <Text style={styles.coachTipText}>{tip}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={styles.coachDisclaimer}>
                        AI guidance only — not medical advice. Mountain conditions change; always check forecasts and local guidance before heading out.
                      </Text>
                    </>
                  )}
                </View>
                <View style={styles.askBox}>
                  <TextInput
                    ref={askInputRef}
                    style={styles.askInput}
                    placeholder="Ask your coach..."
                    placeholderTextColor={T.basecampTextDim}
                    value={askText}
                    onChangeText={setAskText}
                    onSubmitEditing={handleAsk}
                    returnKeyType="send"
                  />
                  <TouchableOpacity style={styles.askBtn} onPress={handleAsk} disabled={!askText.trim() || askLoading}>
                    {askLoading ? <ActivityIndicator size="small" color="#000" /> : <Send size={16} color="#000" />}
                  </TouchableOpacity>
                </View>
                {askAnswer && (
                  <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(400)} style={styles.answerBubble}>
                    <Text style={styles.answerText}>{askAnswer}</Text>
                    <TouchableOpacity onPress={() => setAskAnswer(null)} hitSlop={8}>
                      <X size={13} color={T.basecampTextMuted} />
                    </TouchableOpacity>
                  </Animated.View>
                )}
              </View>
            )}
          </View>
        </View>
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
  alpineLoadingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.basecampTextMuted,
  },

  scroll: {},
  editorialContent: {
    paddingBottom: 20,
  },
  editorialSection: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: T.basecampText,
  },
  missionPhasePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  phaseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  missionPhaseText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  missionWeekProgress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  missionProgressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 2,
    overflow: "hidden",
  },
  missionProgressFill: {
    height: "100%",
    borderRadius: 2,
  },
  missionProgressLabel: {
    minWidth: 76,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: T.basecampTextMuted,
    textAlign: "right",
  },
  dominantAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  dominantActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: T.greenDim,
    alignItems: "center",
    justifyContent: "center",
  },
  dominantActionBody: {
    flex: 1,
    gap: 2,
  },
  dominantActionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: T.green,
    letterSpacing: 0.2,
  },
  dominantActionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: T.basecampText,
  },
  dominantActionDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.basecampTextMuted,
    lineHeight: 18,
  },
  dominantActionComplete: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  dominantActionCompleteText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: T.basecampText,
  },
  separator: {
    height: 1,
    backgroundColor: T.basecampBorder,
    marginHorizontal: 18,
  },
  flatStatsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  flatStat: {
    flex: 1,
  },
  flatStatValue: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: T.basecampText,
  },
  flatStatUnit: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: T.basecampTextMuted,
  },
  flatStatLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: T.basecampTextMuted,
    marginTop: 2,
  },
  flatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.basecampBorder,
  },
  flatRowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    justifyContent: "center",
  },
  flatRowTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: T.basecampText,
  },
  flatRowDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.basecampTextMuted,
    marginTop: 2,
  },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: T.greenDim,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  proBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: T.green,
  },
  quietUpsell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  quietUpsellText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: T.basecampTextMuted,
    flex: 1,
  },
  coachContainer: {
    marginTop: 16,
    gap: 12,
  },
  coachHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  coachChatArea: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  coachHeaderTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: T.basecampText,
  },
  coachHeaderSub: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: T.basecampTextMuted,
  },
  coachRefresh: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  coachBubble: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  coachBubbleText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.basecampText,
    lineHeight: 18,
  },
  coachRetry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  coachTips: {
    gap: 8,
  },
  coachTip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  coachTipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    flexShrink: 0,
  },
  coachTipText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: T.basecampText,
    lineHeight: 18,
  },
  coachDisclaimer: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: T.basecampTextDim,
    lineHeight: 14,
  },
  askBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  askInput: {
    flex: 1,
    height: 44,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 22,
    paddingHorizontal: 16,
    color: T.basecampText,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  askBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.green,
    alignItems: "center",
    justifyContent: "center",
  },
  answerBubble: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: T.blueDim,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.blue + "30",
  },
  answerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: T.basecampText,
    lineHeight: 20,
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
