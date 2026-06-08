import type { LucideIcon } from "lucide-react-native";
import { Heart, Wind, Wrench, Zap, Moon, Calendar, TrendingUp, CheckCircle, BarChart2, Lock, Pencil, Shield, AlertTriangle, Info, Compass, ChevronRight, Clock, Flag, Check, Minus, RefreshCw, WifiOff, Plus, Footprints, Trophy, Mountain, MessageCircle, Send, X } from "lucide-react-native";
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
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { T, STATUS_COLOR, STATUS_LABEL, PHASE_COLOR } from "@/constants/theme";
import { useSubscription } from "@/lib/revenuecat";
import { ProgressRing } from "@/components/ProgressRing";
import { AchievementToast } from "@/components/AchievementToast";
import { getDaysRemaining, getWeeklyCompletion, isRequirementMet, getPeakExperienceState } from "@/utils/readinessScore";
import { getCurrentWeek } from "@/utils/planGenerator";
import { assessTime } from "@/utils/timeValidator";
import { ACHIEVEMENTS, TIER_COLOR } from "@/utils/achievements";

const MASCOT = require("@/assets/mascot.gif");

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

  useEffect(() => { setImageError(false); }, [mountainName]);

  const heroImageUri = imageError
    ? null
    : `${API_BASE}/mountain-image?name=${encodeURIComponent(mountainName)}`;

  const dateStr = summitDate
    ? new Date(summitDate + "T12:00:00").toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "";

  return (
    <View style={heroStyles.container}>
      {heroImageUri ? (
        <ImageBackground
          source={{ uri: heroImageUri }}
          style={heroStyles.image}
          resizeMode="cover"
          onError={() => { setImageError(true); }}
        >
          {/* top vignette */}
          <LinearGradient
            colors={["rgba(0,0,0,0.6)", "transparent"]}
            style={[StyleSheet.absoluteFill, { height: "55%" }]}
          />
          {/* bottom fade into app bg */}
          <LinearGradient
            colors={["transparent", "rgba(8,10,14,0.88)", T.bg]}
            style={[StyleSheet.absoluteFill, { top: "35%" }]}
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
        /* Gradient fallback — no image found */
        <LinearGradient
          colors={["#1C3A2A", "#0F1E14", T.bg]}
          style={heroStyles.image}
        >
          <View style={heroStyles.fallbackEmoji}>
            <Text style={{ fontSize: 58 }}>🏔️</Text>
          </View>
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
    <View style={[heroStyles.overlay, { paddingTop: topInset + 12 }]}>
      {/* logo centred, buttons pinned right */}
      <View style={heroStyles.topRow}>
        <ExpoImage source={require("@/assets/images/logo.gif")} style={heroStyles.logoSmall} contentFit="contain" />
        <View style={heroStyles.headerButtons}>
          {hasViewedPlan && (
            <TouchableOpacity onPress={() => router.push(isSubscribed ? "/subscription" : "/paywall")} style={[heroStyles.editBtn, { borderColor: isSubscribed ? T.green + "50" : T.purple + "50" }]} activeOpacity={0.8}>
              {isSubscribed ? <Zap size={13} color={T.green} /> : <Lock size={13} color={T.purple} />}
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onEdit} style={heroStyles.editBtn} activeOpacity={0.8}>
            <Pencil size={14} color={T.green} />
          </TouchableOpacity>
        </View>
      </View>
      {/* name + date — bottom of hero */}
      <View style={heroStyles.bottomText}>
        <Text style={heroStyles.trainingFor}>Training for</Text>
        <View style={heroStyles.mountainNameRow}>
          <Text style={heroStyles.mountainName} numberOfLines={2}>{mountainName}</Text>
          <TouchableOpacity onPress={() => router.push("/setup?mode=change")} style={heroStyles.namePencil} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Pencil size={13} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
        {dateStr ? <Text style={heroStyles.summitDate}>🗓 {dateStr}</Text> : null}
        <View style={heroStyles.statChips}>
          <View style={heroStyles.statChip}><Text style={heroStyles.statChipText}>▲ {elevationGain}m</Text></View>
          <View style={heroStyles.statChipDot} />
          <View style={heroStyles.statChip}><Text style={heroStyles.statChipText}>⟶ {distance}km</Text></View>
          <View style={heroStyles.statChipDot} />
          <View style={heroStyles.statChip}><Text style={heroStyles.statChipText}>⛰ {highestAltitude}m</Text></View>
        </View>
      </View>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  container: { marginHorizontal: -18 },
  image: { width: "100%", height: 270 },
  fallbackEmoji: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
  },
  overlay: {
    flex: 1,
    paddingHorizontal: 18,
    justifyContent: "space-between",
    paddingBottom: 20,
  },
  topRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 16,
  },
  logoSmall: { width: 186, height: 74 },
  headerButtons: {
    position: "absolute",
    right: 0,
    top: 0,
    flexDirection: "row",
    gap: 8,
  },
  editBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1, borderColor: T.green + "50",
    alignItems: "center", justifyContent: "center",
  },
  bottomText: { gap: 4 },
  mountainNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  namePencil: { marginTop: 2, opacity: 0.85 },
  statChips: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  statChip: { backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  statChipText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.85)", textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  statChipDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "rgba(255,255,255,0.3)" },
  trainingFor: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)", letterSpacing: 0.5,
    textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  mountainName: {
    fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff",
    textShadowColor: "rgba(0,0,0,0.9)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
    lineHeight: 34,
  },
  summitDate: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
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
      contentFit="cover"
    />
  );
}


function StatCard({
  icon: IconComp,
  label,
  value,
  unit,
  accent,
  delay = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit?: string;
  accent: string;
  delay?: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(500)} style={[styles.statCard, { width: CARD_W }]}>
      <View style={[styles.statIconRow, { backgroundColor: accent + "18" }]}>
        <IconComp size={15} color={accent} />
      </View>
      <Text style={styles.statValue}>
        {value}
        {unit && <Text style={[styles.statUnit, { color: T.textMuted }]}> {unit}</Text>}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

// ── Alpine Requirements Card ───────────────────────────────────────────────
const ALPINE_CATEGORY_ICON: Record<string, LucideIcon> = {
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weeksElapsed = trainingPlan.filter(w => new Date(w.endDate) < today).length;
  const profile = goal.alpineProfile;

  if (loading) {
    return (
      <Animated.View entering={FadeInDown.delay(270).duration(500)}>
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

  const metCount = profile.requirements.filter(req =>
    isRequirementMet(req, sessions, weeksElapsed)
  ).length;

  return (
    <Animated.View entering={FadeInDown.delay(270).duration(500)}>
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
        {profile.requirements.map((req) => {
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
            {profile.keyRisks.map((risk, i) => (
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
  const insets = useSafeAreaInsets();
  const { summitGoal, trainingPlan, sessions, readinessScore, hasViewedPlan, markPlanViewed, alpineProfileLoading, unlockedAchievements, newlyUnlocked, clearNewlyUnlocked, completedGoals } = useApp();
  const { isSubscribed } = useSubscription();
  const [coach, setCoach] = useState<CoachAssessment | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState(false);
  const hasFetched = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Ask Coach
  const [askText, setAskText] = useState("");
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const askInputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const coachY = useRef(0);


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

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

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
  const hillsDone = sessions.filter(s => s.completed && s.type === "hill").length;

  const peakState = getPeakExperienceState(summitGoal, completedGoals);

  const trackingMsg = peakState.superseded
    ? `Proven on ${peakState.mountain}`
    : readinessScore >= 70 ? "You are on track"
    : readinessScore >= 40 ? "Keep building fitness"
    : "Behind — prioritise training";

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: 0,
            paddingBottom: Platform.OS === "web" ? 110 : insets.bottom + 110,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Mountain Hero */}
        <MountainHero
          mountainName={summitGoal.mountainName}
          summitDate={summitGoal.summitDate}
          topInset={Platform.OS === "web" ? 20 : insets.top}
          onEdit={() => router.push("/setup")}
          isSubscribed={isSubscribed}
          hasViewedPlan={hasViewedPlan}
          elevationGain={summitGoal.elevationGain}
          distance={summitGoal.distance}
          highestAltitude={summitGoal.highestAltitude}
        />

        {/* Ask Coach pill — scrolls to coach for Pro, upsells for free */}
        <Animated.View entering={FadeInDown.delay(20).duration(400)}>
          <TouchableOpacity
            onPress={isSubscribed ? scrollToCoach : () => router.push("/paywall")}
            activeOpacity={0.82}
            style={styles.askPill}
          >
            <View style={styles.askPillIcon}>
              <MessageCircle size={13} color={isSubscribed ? T.blue : T.textMuted} />
            </View>
            <Text style={[styles.askPillText, !isSubscribed && { color: T.textMuted }]}>
              {isSubscribed ? "Ask your coach a question" : "AI Coach — Pro feature"}
            </Text>
            {isSubscribed
              ? <ChevronRight size={13} color={T.blue} />
              : <View style={styles.askPillProBadge}><Text style={styles.askPillProText}>PRO</Text></View>
            }
          </TouchableOpacity>
        </Animated.View>

        {/* Upgrade banner — shown only after user has seen their plan */}
        {hasViewedPlan && !isSubscribed && (
          <Animated.View entering={FadeInDown.delay(40).duration(500)}>
            <TouchableOpacity
              onPress={() => router.push("/paywall")}
              activeOpacity={0.85}
              style={styles.upgradeBanner}
            >
              <LinearGradient
                colors={["rgba(62,207,117,0.14)", "rgba(62,207,117,0.06)"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.upgradeBannerLeft}>
                <View style={styles.upgradeIconWrap}>
                  <Zap size={13} color={T.green} />
                </View>
                <View style={{ gap: 1, flex: 1 }}>
                  <Text style={styles.upgradeBannerTitle} numberOfLines={1}>Upgrade to Summit Ready Pro</Text>
                  <Text style={styles.upgradeBannerSub} numberOfLines={1}>Unlock adaptive plans, AI coaching & more</Text>
                </View>
              </View>
              <ChevronRight size={16} color={T.green} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Time readiness warning */}
        {timeAssessment && (timeAssessment.status === "insufficient" || timeAssessment.status === "impossible" || timeAssessment.status === "tight") && (
          <Animated.View entering={FadeInDown.delay(60).duration(500)}>
            <View style={[
              styles.warningBanner,
              timeAssessment.status === "tight"
                ? { backgroundColor: T.orangeDim, borderColor: T.orange + "40" }
                : { backgroundColor: "rgba(255,68,68,0.10)", borderColor: T.red + "40" },
            ]}>
              {timeAssessment.status === "tight" ? <Clock size={14} color={T.orange} /> : <AlertTriangle size={14} color={T.red} />}
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
              {/* Score ring — ring fills to real score; number is blurred above 40 for free users */}
              <View>
                <ProgressRing score={readinessScore} size={148} strokeWidth={11} />
                {!isSubscribed && readinessScore > 40 && (
                  <TouchableOpacity
                    onPress={() => router.push("/paywall")}
                    activeOpacity={0.85}
                    style={styles.ringLockOverlay}
                  >
                    <BlurView intensity={28} style={StyleSheet.absoluteFill} />
                    <Lock size={20} color={T.green} />
                    <Text style={styles.ringLockText}>Unlock score</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.readinessMeta}>
                <Text style={styles.areYouReadyLabel}>Are you ready?</Text>
                {!isSubscribed && readinessScore > 40 ? (
                  <>
                    <TouchableOpacity
                      onPress={() => router.push("/paywall")}
                      style={[styles.statusPill, { backgroundColor: T.greenDim }]}
                      activeOpacity={0.8}
                    >
                      <Lock size={11} color={T.green} />
                      <Text style={[styles.statusText, { color: T.green }]}>Pro feature</Text>
                    </TouchableOpacity>
                    <Text style={styles.trackingMsg}>Score above 40 — upgrade to track progress</Text>
                    <TouchableOpacity onPress={() => router.push("/paywall")} activeOpacity={0.8} style={styles.ringUpgradeBtn}>
                      <Text style={styles.ringUpgradeBtnText}>See your full score →</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={[styles.statusPill, { backgroundColor: statusColor + "20" }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                    <Text style={styles.trackingMsg}>{trackingMsg}</Text>
                    {peakState.superseded && (
                      <View style={styles.provenBadge}>
                        <Trophy size={11} color={T.green} />
                        <Text style={styles.provenBadgeText}>Been there, done harder</Text>
                      </View>
                    )}
                    <Text style={styles.daysText}>
                      {days > 0 ? `${days} days until summit` : "Summit day!"}
                    </Text>
                  </>
                )}
                <View style={styles.difficultyRow}>
                  <View style={[styles.diffPill, { backgroundColor: T.surface }]}>
                    <Flag size={11} color={T.textMuted} />
                    <Text style={styles.diffText}>{summitGoal.difficulty}</Text>
                  </View>
                  <View style={[styles.diffPill, { backgroundColor: T.surface }]}>
                    <Zap size={11} color={T.textMuted} />
                    <Text style={styles.diffText}>{summitGoal.fitnessLevel}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Stats Strip */}
        <Animated.View entering={FadeInDown.delay(110).duration(500)}>
          <View style={styles.statsSectionHeader}>
            <Text style={styles.statsSectionTitle}>Your Stats</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/account")} activeOpacity={0.7} style={styles.statsSectionLink}>
              <Text style={styles.statsSectionLinkText}>Account</Text>
              <ChevronRight size={12} color={T.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.statsStrip}>
            <TouchableOpacity style={styles.statsTile} onPress={() => router.push("/setup")} activeOpacity={0.7}>
              <View style={[styles.statsTileIcon, { backgroundColor: T.orange + "20" }]}>
                <TrendingUp size={13} color={T.orange} />
              </View>
              <Text style={[styles.statsTileValue, { color: T.orange }]}>
                {summitGoal.elevationGain.toLocaleString()}
                <Text style={styles.statsTileUnit}>m</Text>
              </Text>
              <Text style={styles.statsTileLabel}>Elev. Goal</Text>
            </TouchableOpacity>
            <View style={styles.statsTileDivider} />
            <TouchableOpacity style={styles.statsTile} onPress={() => router.push("/(tabs)/hills")} activeOpacity={0.7}>
              <View style={[styles.statsTileIcon, { backgroundColor: T.green + "20" }]}>
                <Mountain size={13} color={T.green} />
              </View>
              <Text style={[styles.statsTileValue, { color: T.green }]}>{hillsDone}</Text>
              <Text style={styles.statsTileLabel}>Hills Done</Text>
            </TouchableOpacity>
            <View style={styles.statsTileDivider} />
            <TouchableOpacity style={styles.statsTile} onPress={() => router.push("/sessions")} activeOpacity={0.7}>
              <View style={[styles.statsTileIcon, { backgroundColor: T.blue + "20" }]}>
                <CheckCircle size={13} color={T.blue} />
              </View>
              <Text style={[styles.statsTileValue, { color: T.blue }]}>{totalDone}</Text>
              <Text style={styles.statsTileLabel}>Sessions</Text>
            </TouchableOpacity>
            <View style={styles.statsTileDivider} />
            <TouchableOpacity style={styles.statsTile} onPress={() => router.push("/(tabs)/account")} activeOpacity={0.7}>
              <View style={[styles.statsTileIcon, { backgroundColor: "#FFD70022" }]}>
                <Trophy size={13} color="#FFD700" />
              </View>
              <Text style={[styles.statsTileValue, { color: "#FFD700" }]}>{unlockedAchievements.length}</Text>
              <Text style={styles.statsTileLabel}>Badges</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Achievements Strip */}
        {unlockedAchievements.length > 0 && (
          <Animated.View entering={FadeInDown.delay(115).duration(500)}>
            <TouchableOpacity
              style={styles.achieveStrip}
              onPress={() => router.push("/(tabs)/account")}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#FFD70012", "transparent"]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.achieveStripLeft}>
                <View style={styles.achieveStripIcon}>
                  <Text style={styles.achieveStripTrophy}>🏆</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.achieveStripTitle} numberOfLines={1}>Achievements</Text>
                  <Text style={styles.achieveStripSub} numberOfLines={1}>{unlockedAchievements.length} unlocked</Text>
                </View>
              </View>
              <View style={styles.achieveStripEmojis}>
                {[...unlockedAchievements].reverse().slice(0, 4).map(id => {
                  const a = ACHIEVEMENTS.find(x => x.id === id);
                  return a ? <Text key={id} style={styles.achieveStripEmoji}>{a.emoji}</Text> : null;
                })}
              </View>
              <ChevronRight size={14} color={T.textDim} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Alpine Requirements — only shown for Alpine difficulty */}
        {summitGoal.difficulty === "Alpine" && (
          <AlpineCard
            goal={summitGoal}
            sessions={sessions}
            trainingPlan={trainingPlan}
            loading={alpineProfileLoading}
          />
        )}

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
                    {s.type === "cardio" ? <Heart size={11} color={T.green} /> : s.type === "hill" ? <TrendingUp size={11} color={T.green} /> : <Flag size={11} color={T.orange} />}
                    <Text style={styles.sChipText}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        )}

        {/* AI Coach */}
        <Animated.View entering={FadeInDown.delay(320).duration(500)}>
          {isSubscribed ? (
            /* ── Pro: full interactive coach card ── */
            <View
              style={styles.coachCard}
              onLayout={e => { coachY.current = e.nativeEvent.layout.y; }}
            >
              <LinearGradient
                colors={
                  coach?.tone === "positive" ? [T.greenDim, "transparent"] :
                  coach?.tone === "warning"  ? [T.orangeDim, "transparent"] :
                                               [T.blueDim, "transparent"]
                }
                style={StyleSheet.absoluteFill}
              />

              {/* Header row: mascot + title + refresh */}
              <View style={styles.coachHeader}>
                <View style={styles.coachTitleRow}>
                  <AlpineGuide tone={coach?.tone} flush />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={styles.coachTitle}>AI Coach</Text>
                      <View style={[
                        styles.coachBadge,
                        {
                          backgroundColor:
                            coach?.tone === "positive" ? T.green + "22" :
                            coach?.tone === "warning"  ? T.orange + "22" : T.blue + "22",
                        },
                      ]}>
                        <Text style={[
                          styles.coachBadgeText,
                          {
                            color:
                              coach?.tone === "positive" ? T.green :
                              coach?.tone === "warning"  ? T.orange : T.blue,
                          },
                        ]}>
                          {coach?.tone === "positive" ? "On track" : coach?.tone === "warning" ? "Needs work" : "AI Coach"}
                        </Text>
                      </View>
                      {coach?.tone ? (
                        <Text style={{ fontSize: 14 }}>
                          {coach.tone === "positive" ? "👍" : coach.tone === "warning" ? "⚠️" : "🧭"}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.coachSubtitle}>
                      {coach?.tone === "positive" ? "Looking good — keep the momentum going" :
                       coach?.tone === "warning"  ? "A few things need your attention" :
                       coachLoading                ? "Checking your training data..." :
                                                    "Your personalised assessment"}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={fetchCoach}
                  disabled={coachLoading}
                  style={styles.coachRefresh}
                  activeOpacity={0.7}
                >
                  <RefreshCw size={13} color={T.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View style={styles.coachDivider} />

              {/* Body */}
              {coachLoading ? (
                <View style={styles.coachLoading}>
                  <ActivityIndicator size="small" color={T.green} />
                  <Text style={styles.coachLoadingText}>Analysing your training...</Text>
                </View>
              ) : coachError ? (
                <TouchableOpacity onPress={fetchCoach} style={styles.coachLoading} activeOpacity={0.7}>
                  <WifiOff size={15} color={T.textMuted} />
                  <Text style={styles.coachLoadingText}>Couldn't reach coach — tap to retry</Text>
                </TouchableOpacity>
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
                  <Text style={{ color: T.textDim, fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 10, lineHeight: 14 }}>
                    AI guidance only — not medical advice. Mountain conditions change; always check forecasts and local guidance before heading out.
                  </Text>
                </>
              ) : null}

              {/* Ask Coach input */}
              <View style={styles.askDivider} />
              {askAnswer && (
                <View style={styles.askAnswerBubble}>
                  <AlpineGuide tone={coach?.tone} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.askAnswerText}>{askAnswer}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setAskAnswer(null)} hitSlop={8}>
                    <X size={13} color={T.textMuted} />
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.askBar}>
                <TextInput
                  ref={askInputRef}
                  style={styles.askInput}
                  placeholder="Ask your coach anything…"
                  placeholderTextColor={T.textDim}
                  value={askText}
                  onChangeText={setAskText}
                  onSubmitEditing={handleAsk}
                  returnKeyType="send"
                  editable={!askLoading}
                  multiline={false}
                />
                <TouchableOpacity
                  onPress={handleAsk}
                  disabled={!askText.trim() || askLoading}
                  style={[styles.askSendBtn, { opacity: (!askText.trim() || askLoading) ? 0.4 : 1 }]}
                  activeOpacity={0.75}
                >
                  {askLoading
                    ? <ActivityIndicator size="small" color={T.blue} />
                    : <Send size={15} color={T.blue} />
                  }
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* ── Free: locked coach teaser ── */
            <TouchableOpacity
              onPress={() => router.push("/paywall")}
              activeOpacity={0.88}
              style={styles.coachCard}
              onLayout={e => { coachY.current = e.nativeEvent.layout.y; }}
            >
              <LinearGradient colors={[T.blueDim, "transparent"]} style={StyleSheet.absoluteFill} />

              {/* Header */}
              <View style={styles.coachHeader}>
                <View style={styles.coachTitleRow}>
                  <AlpineGuide tone="neutral" flush />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={styles.coachTitle}>AI Coach</Text>
                      <View style={[styles.coachBadge, { backgroundColor: T.green + "22" }]}>
                        <Zap size={9} color={T.green} />
                        <Text style={[styles.coachBadgeText, { color: T.green }]}>Pro</Text>
                      </View>
                    </View>
                    <Text style={styles.coachSubtitle}>Personalised training insights & Q&A</Text>
                  </View>
                </View>
                <View style={[styles.coachRefresh, { backgroundColor: T.green + "18" }]}>
                  <Lock size={12} color={T.green} />
                </View>
              </View>

              <View style={styles.coachDivider} />

              {/* Blurred fake content */}
              <View style={{ gap: 8, marginBottom: 14 }}>
                {["Loading your readiness data…", "Here are your top 3 tips for this week.", "Focus on elevation — you're 200m behind benchmark."].map((line, i) => (
                  <View key={i} style={{ overflow: "hidden", borderRadius: 6 }}>
                    <Text style={[styles.coachTipText, { opacity: 0 }]}>{line}</Text>
                    <BlurView intensity={18} style={[StyleSheet.absoluteFill, { borderRadius: 6 }]} />
                    <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 6 }} />
                  </View>
                ))}
              </View>

              {/* CTA */}
              <View style={styles.coachLockedCta}>
                <Zap size={14} color={T.bg} />
                <Text style={styles.coachLockedCtaText}>Unlock AI Coach — Upgrade to Pro</Text>
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>

      </ScrollView>

      {newlyUnlocked.length > 0 && (
        <AchievementToast newlyUnlocked={newlyUnlocked} onDismiss={clearNewlyUnlocked} />
      )}

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18, gap: 12 },

  // ── Ask Coach pill ────────────────────────────────────────────────────────
  askPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: T.blue + "12",
    borderWidth: 1, borderColor: T.blue + "28",
    borderRadius: 20, paddingVertical: 9, paddingHorizontal: 14,
  },
  askPillIcon: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: T.blue + "20", alignItems: "center", justifyContent: "center",
  },
  askPillText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: T.blue },

  // ── Ask Coach bar (inside coach card) ────────────────────────────────────
  askDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginTop: 14, marginBottom: 12 },
  askAnswerBubble: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    backgroundColor: T.blue + "10", borderRadius: 10, padding: 10, marginBottom: 10,
  },
  askAnswerText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.text, lineHeight: 19 },
  askBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
  },
  askInput: {
    flex: 1, fontSize: 13, fontFamily: "Inter_400Regular",
    color: T.text, paddingVertical: 6,
  },
  askSendBtn: { padding: 4 },
  askPillProBadge: { backgroundColor: T.green + "22", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  askPillProText: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.green, letterSpacing: 0.5 },

  // ── Locked coach CTA ──────────────────────────────────────────────────────
  coachLockedCta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    backgroundColor: T.green, borderRadius: 12, paddingVertical: 13,
  },
  coachLockedCtaText: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.bg },

  upgradeBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, borderWidth: 1, borderColor: T.green + "30",
    paddingVertical: 11, paddingHorizontal: 14, marginTop: 12,
    overflow: "hidden",
  },
  upgradeBannerLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  upgradeIconWrap: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: T.greenDim, alignItems: "center", justifyContent: "center",
  },
  upgradeBannerTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.green },
  upgradeBannerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  createPlanBtn: { borderRadius: 16, overflow: "hidden" },
  createPlanGrad: { paddingHorizontal: 28, paddingVertical: 14 },
  startHikingSecondary: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: 14, borderWidth: 1, borderColor: T.green + "35",
    backgroundColor: T.greenDim, width: "100%", justifyContent: "center",
  },
  startHikingSecondaryText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.green },
  startHikingBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 16, overflow: "hidden",
    backgroundColor: T.green,
    paddingVertical: 16, paddingHorizontal: 16,
    marginBottom: 12,
  },
  startHikingIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  startHikingBannerTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white },
  startHikingBannerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" },
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
  ringLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 74,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  ringLockText: { fontSize: 11, fontFamily: "Inter_700Bold", color: T.green },
  ringUpgradeBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, backgroundColor: T.greenDim,
    borderWidth: 1, borderColor: T.green + "40",
    alignSelf: "flex-start",
  },
  ringUpgradeBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.green },
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
  areYouReadyLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: T.textMuted, letterSpacing: 0.6, textTransform: "uppercase",
  },
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
  trackingMsg: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.white, lineHeight: 18 },
  provenBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(62,207,117,0.13)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4 },
  provenBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.green, letterSpacing: 0.2 },
  daysText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },
  difficultyRow: { flexDirection: "row", gap: 6, marginTop: 2 },
  diffPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  diffText: { fontSize: 11, fontFamily: "Inter_500Medium", color: T.textMuted },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  statsSectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 8,
  },
  statsSectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text },
  statsSectionLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  statsSectionLinkText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  statsStrip: {
    flexDirection: "row",
    backgroundColor: T.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.cardBorder,
    paddingVertical: 14,
    marginBottom: 12,
  },
  statsTile: { flex: 1, alignItems: "center", gap: 5 },
  statsTileIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  statsTileValue: { fontSize: 17, fontFamily: "Inter_700Bold" },
  statsTileUnit: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statsTileLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted },
  statsTileDivider: { width: 1, backgroundColor: T.border, marginVertical: 4 },
  achieveStrip: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: "#FFD70030",
    paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 12, overflow: "hidden",
  },
  achieveStripLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  achieveStripIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#FFD70015",
    alignItems: "center", justifyContent: "center",
  },
  achieveStripTrophy: { fontSize: 18 },
  achieveStripTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text },
  achieveStripSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  achieveStripEmojis: { flexDirection: "row", gap: 2, alignItems: "center", flexShrink: 0 },
  achieveStripEmoji: { fontSize: 17 },
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
  coachHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  coachTitleRow: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  coachTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.white },
  coachSubtitle: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 16 },
  coachBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  coachBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  coachRefresh: { padding: 6, marginTop: 2 },
  coachDivider: { height: 1, backgroundColor: T.border, marginHorizontal: -16, opacity: 0.6 },
  coachLoading: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  coachLoadingText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, flex: 1 },
  coachSummary: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.text, lineHeight: 20 },
  coachTips: { gap: 10 },
  coachTip: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  coachTipDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6, flexShrink: 0 },
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
  alpineCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.blue + "30",
    backgroundColor: T.card,
    padding: 16,
    marginBottom: 12,
    overflow: "hidden",
    gap: 10,
  },
  alpineCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  alpineIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: T.blue + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  alpineCardTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: T.white,
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
    color: T.textMuted,
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
    backgroundColor: T.surface,
  },
  alpinePillText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: T.textMuted,
  },
  alpineDivider: {
    height: 1,
    backgroundColor: T.border,
    opacity: 0.5,
    marginHorizontal: -16,
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
    color: T.white,
    lineHeight: 18,
  },
  alpineReqDetail: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
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
    color: T.textMuted,
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
    color: T.textMuted,
    lineHeight: 18,
    flex: 1,
  },
  alpineLoadingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
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
