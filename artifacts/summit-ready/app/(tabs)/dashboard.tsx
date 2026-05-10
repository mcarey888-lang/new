import { Feather } from "@expo/vector-icons";
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
import { getDaysRemaining, getWeeklyCompletion } from "@/utils/readinessScore";
import { getCurrentWeek } from "@/utils/planGenerator";
import { assessTime } from "@/utils/timeValidator";

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
        // Build search candidates: full name, then each individual word (longest first)
        const words = mountainName.split(/\s+/).filter(w => w.length > 3);
        const candidates = [mountainName, ...words].slice(0, 4);

        for (const candidate of candidates) {
          // Step 1: opensearch to find the best matching article title
          const searchRes = await fetch(
            `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(candidate)}&limit=3&format=json&origin=*`
          );
          const searchData = await searchRes.json();
          const titles: string[] = searchData[1] ?? [];
          if (cancelled || titles.length === 0) continue;

          // Step 2: try each result until we get one with an image
          for (const t of titles) {
            const summaryRes = await fetch(
              `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`,
              { headers: { Accept: "application/json" } }
            );
            const data = await summaryRes.json();
            const url: string | undefined =
              data.originalimage?.source ?? data.thumbnail?.source;
            if (url) {
              if (!cancelled) { setImageUri(url); setLoading(false); }
              return;
            }
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
              <Feather name={isSubscribed ? "zap" : "lock"} size={13} color={isSubscribed ? T.green : T.purple} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onEdit} style={heroStyles.editBtn} activeOpacity={0.8}>
            <Feather name="edit-2" size={14} color={T.green} />
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
  const { summitGoal, trainingPlan, sessions, readinessScore, hasViewedPlan, markPlanViewed } = useApp();
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
                  <Feather name="zap" size={13} color={T.green} />
                </View>
                <View style={{ gap: 1 }}>
                  <Text style={styles.upgradeBannerTitle}>Upgrade to Summit Ready Pro</Text>
                  <Text style={styles.upgradeBannerSub}>Unlock adaptive plans, AI coaching & more</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color={T.green} />
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
                <Feather name="refresh-cw" size={13} color={T.textMuted} />
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
                <Feather name="wifi-off" size={15} color={T.textMuted} />
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
});
