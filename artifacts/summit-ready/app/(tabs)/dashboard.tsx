import type { LucideIcon } from "lucide-react-native";
import { Heart, Wind, Wrench, Zap, Moon, Calendar, TrendingUp, CheckCircle, BarChart2, Lock, Pencil, Shield, AlertTriangle, Info, Compass, ChevronRight, Clock, Flag, Check, Minus, RefreshCw, WifiOff, Plus } from "lucide-react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageBackground,
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
import { useSubscription } from "@/lib/revenuecat";
import { ProgressRing } from "@/components/ProgressRing";
import { AchievementToast } from "@/components/AchievementToast";
import { getDaysRemaining, getWeeklyCompletion, isRequirementMet } from "@/utils/readinessScore";
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
}: {
  mountainName: string;
  summitDate: string;
  topInset: number;
  onEdit: () => void;
  isSubscribed: boolean;
  hasViewedPlan: boolean;
}) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setImageUri(null);
    setLoading(true);

    async function fetchWikiImage() {
      try {
        const res = await fetch(`${API_BASE}/mountain-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: mountainName }),
        });
        if (res.ok) {
          const data = await res.json() as { imageUrl: string | null };
          if (data.imageUrl && !cancelled) {
            setImageUri(data.imageUrl);
            setLoading(false);
            return;
          }
        }
      } catch {
        /* fall through to gradient fallback */
      }
      if (!cancelled) setLoading(false);
    }
    fetchWikiImage();
    return () => { cancelled = true; };
  }, [mountainName]);

  const dateStr = summitDate
    ? new Date(summitDate + "T12:00:00").toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "";

  return (
    <View style={heroStyles.container}>
      {loading ? (
        /* Shimmer while fetching */
        <LinearGradient
          colors={["#0F2218", "#0A0C10"]}
          style={heroStyles.image}
        >
          <HeroContent
            mountainName={mountainName}
            dateStr={dateStr}
            topInset={topInset}
            onEdit={onEdit}
            isSubscribed={isSubscribed}
            hasViewedPlan={hasViewedPlan}
          />
        </LinearGradient>
      ) : imageUri ? (
        <ImageBackground
          source={{ uri: imageUri }}
          style={heroStyles.image}
          resizeMode="cover"
          onError={() => { setImageUri(null); }}
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
          />
        </LinearGradient>
      )}
    </View>
  );
}

function HeroContent({
  mountainName, dateStr, topInset, onEdit, isSubscribed, hasViewedPlan,
}: { mountainName: string; dateStr: string; topInset: number; onEdit: () => void; isSubscribed: boolean; hasViewedPlan: boolean }) {
  return (
    <View style={[heroStyles.overlay, { paddingTop: topInset + 12 }]}>
      {/* logo centred, buttons pinned right */}
      <View style={heroStyles.topRow}>
        <Image source={require("@/assets/images/logo.gif")} style={heroStyles.logoSmall} resizeMode="contain" />
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
        <Text style={heroStyles.mountainName} numberOfLines={2}>{mountainName}</Text>
        {dateStr ? <Text style={heroStyles.summitDate}>🗓 {dateStr}</Text> : null}
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
function AlpineGuide({ tone }: { tone?: "positive" | "warning" | "neutral" }) {
  const badge =
    tone === "positive" ? "👍" :
    tone === "warning"  ? "⚠️" : "🧭";

  return (
    <View style={{ width: 72, height: 72 }}>
      <Image
        source={MASCOT}
        style={{ width: 72, height: 72 }}
        resizeMode="contain"
      />
      {/* Small tone indicator badge */}
      <View style={{
        position: "absolute", bottom: 0, right: 0,
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: T.card,
        borderWidth: 1.5,
        borderColor:
          tone === "positive" ? T.green :
          tone === "warning"  ? T.orange : T.blue,
        alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{ fontSize: 11 }}>{badge}</Text>
      </View>
    </View>
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
  const { summitGoal, trainingPlan, sessions, readinessScore, hasViewedPlan, markPlanViewed, alpineProfileLoading, unlockedAchievements, newlyUnlocked, clearNewlyUnlocked } = useApp();
  const { isSubscribed } = useSubscription();
  const [coach, setCoach] = useState<CoachAssessment | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState(false);
  const hasFetched = useRef(false);

  const abortRef = useRef<AbortController | null>(null);

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

  if (!summitGoal) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center", gap: 18 }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: T.greenDim, alignItems: "center", justifyContent: "center" }}>
          <Compass size={28} color={T.green} />
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
        />

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
                <View style={{ gap: 1 }}>
                  <Text style={styles.upgradeBannerTitle}>Upgrade to Summit Ready Pro</Text>
                  <Text style={styles.upgradeBannerSub}>Unlock adaptive plans, AI coaching & more</Text>
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

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard icon={Calendar} label="Days Remaining" value={days} accent={T.blue} delay={120} />
          <StatCard icon={TrendingUp} label="Max Ascent" value={maxElev} unit="m" accent={T.orange} delay={160} />
          <StatCard icon={CheckCircle} label="Sessions Done" value={totalDone} accent={T.green} delay={200} />
          <StatCard icon={BarChart2} label="This Week" value={weekCompletion} unit="%" accent={T.purple} delay={240} />
        </View>

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
                <View>
                  <Text style={styles.achieveStripTitle}>Achievements</Text>
                  <Text style={styles.achieveStripSub}>{unlockedAchievements.length} unlocked</Text>
                </View>
              </View>
              <View style={styles.achieveStripEmojis}>
                {[...unlockedAchievements].reverse().slice(0, 5).map(id => {
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
          <View style={styles.coachCard}>
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
                <AlpineGuide tone={coach?.tone} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.coachTitle}>Your Guide</Text>
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
              </>
            ) : null}
          </View>
        </Animated.View>

      </ScrollView>

      {newlyUnlocked.length > 0 && (
        <AchievementToast newlyUnlocked={newlyUnlocked} onDismiss={clearNewlyUnlocked} />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18 },
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
  trackingMsg: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.white, lineHeight: 22 },
  daysText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },
  difficultyRow: { flexDirection: "row", gap: 6, marginTop: 2 },
  diffPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  diffText: { fontSize: 11, fontFamily: "Inter_500Medium", color: T.textMuted },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
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
  achieveStripEmojis: { flexDirection: "row", gap: 2, alignItems: "center" },
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
