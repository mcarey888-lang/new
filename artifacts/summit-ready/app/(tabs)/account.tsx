import { User, Shield, Zap, Circle, Check, ArrowRight, Flag, TrendingUp, MapPin, Compass, ChevronRight, CheckCircle, AlertCircle, RefreshCw, CreditCard, LogOut, Trash2, Trophy, PenLine, Activity } from "lucide-react-native";
import { useAuth, useUser, useClerk } from "@clerk/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import { openMapSearch } from "@/utils/openMaps";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Purchases from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, type CompletedGoal } from "@/context/AppContext";
import { useChallenges } from "@/context/ChallengesContext";
import { getChallenge, DIFF_COLOR as CHALLENGE_DIFF_COLOR } from "@/constants/challenges";
import { useSubscription } from "@/lib/revenuecat";
import { T } from "@/constants/theme";
import { ACHIEVEMENTS, TIER_COLOR, TIER_LABEL } from "@/utils/achievements";

type Difficulty = "Easy" | "Moderate" | "Hard" | "Alpine";

const DIFF_COLORS: Record<Difficulty, string> = {
  Easy: T.green, Moderate: T.blue, Hard: T.orange, Alpine: "#FF4444",
};

const DIFF_ICONS: Record<Difficulty, string> = {
  Easy: "🌿", Moderate: "🏔️", Hard: "⛰️", Alpine: "🗻",
};

const REFERENCE_PEAKS: { name: string; emoji: string; elevation: number; difficulty: Difficulty; location: string }[] = [
  { name: "Mam Tor",       emoji: "⛰️", elevation: 130,  difficulty: "Easy",     location: "Peak District" },
  { name: "Pen y Fan",     emoji: "🏔️", elevation: 296,  difficulty: "Easy",     location: "Brecon Beacons" },
  { name: "Whernside",     emoji: "⛰️", elevation: 380,  difficulty: "Easy",     location: "Yorkshire Dales" },
  { name: "Kinder Scout",  emoji: "⛰️", elevation: 300,  difficulty: "Moderate", location: "Peak District" },
  { name: "Ingleborough",  emoji: "⛰️", elevation: 450,  difficulty: "Moderate", location: "Yorkshire Dales" },
  { name: "Skiddaw",       emoji: "⛰️", elevation: 620,  difficulty: "Moderate", location: "Lake District" },
  { name: "Cairn Gorm",    emoji: "🏔️", elevation: 610,  difficulty: "Moderate", location: "Cairngorms" },
  { name: "Snowdon",       emoji: "🏔️", elevation: 730,  difficulty: "Moderate", location: "Snowdonia" },
  { name: "Blencathra",    emoji: "⛰️", elevation: 640,  difficulty: "Hard",     location: "Lake District" },
  { name: "Helvellyn",     emoji: "🏔️", elevation: 800,  difficulty: "Hard",     location: "Lake District" },
  { name: "Ben Macdui",    emoji: "🏔️", elevation: 700,  difficulty: "Hard",     location: "Cairngorms" },
  { name: "Great Gable",   emoji: "⛰️", elevation: 810,  difficulty: "Hard",     location: "Lake District" },
  { name: "Scafell Pike",  emoji: "⛰️", elevation: 900,  difficulty: "Hard",     location: "Lake District" },
  { name: "Ben Nevis",     emoji: "🏔️", elevation: 1290, difficulty: "Hard",     location: "Scottish Highlands" },
  { name: "Kilimanjaro",   emoji: "🗻", elevation: 1200, difficulty: "Alpine",   location: "Tanzania" },
  { name: "Mont Blanc",    emoji: "🗻", elevation: 2400, difficulty: "Alpine",   location: "French Alps" },
  { name: "Denali",        emoji: "🗻", elevation: 3000, difficulty: "Alpine",   location: "Alaska, USA" },
];

function maskId(id: string) {
  if (id.length > 20) return id.slice(0, 6) + "…" + id.slice(-4);
  return id;
}

function computeChallengeBadges(ac: { activities: { elevationGain: number }[]; }) {
  const b: { emoji: string; label: string }[] = [];
  if (ac.activities.length >= 1) b.push({ emoji: "🌱", label: "First activity logged" });
  b.push({ emoji: "✅", label: "Challenge completed" });
  if (ac.activities.length >= 3) b.push({ emoji: "🔥", label: "3 activities logged" });
  const maxElev = ac.activities.length > 0 ? Math.max(...ac.activities.map(a => a.elevationGain)) : 0;
  if (maxElev >= 500) b.push({ emoji: "🏔️", label: "500m+ in one session" });
  return b;
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { summitGoal, sessions, exploreHikes, trainingPlan, completedPlanSessions, clearPlan, unlockedAchievements, completedGoals } = useApp();
  const { activeChallenges, getProgress, clearChallenges } = useChallenges();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();

  const completedChallenges = activeChallenges.filter(ac => ac.completed);
  const inProgressChallenges = activeChallenges.filter(ac => !ac.completed);
  const totalChallengeElevation = completedChallenges.reduce(
    (s, ac) => s + ac.activities.reduce((as, a) => as + a.elevationGain, 0),
    0,
  );
  const totalChallengeActivities = completedChallenges.reduce(
    (s, ac) => s + ac.activities.length,
    0,
  );

  // Lifetime stats
  const lifetimeSessions = sessions.length + completedGoals.reduce((s, g) => s + g.sessionsLogged, 0);
  const lifetimeElevation = sessions.reduce((s, sess) => s + sess.elevationGain, 0)
    + completedGoals.reduce((s, g) => s + g.totalElevationTrained, 0);

  // Max elevation any goal was trained for — used to compute "ready for" peaks
  const maxTrainedElevation = Math.max(
    summitGoal?.elevationGain ?? 0,
    ...completedGoals.map(g => g.elevationGain),
  );

  // Already trained / currently training peak names (case-insensitive) to exclude from ready-for list
  const trainedNames = new Set([
    summitGoal?.mountainName.toLowerCase(),
    ...completedGoals.map(g => g.mountainName.toLowerCase()),
  ]);

  const readyForPeaks = REFERENCE_PEAKS
    .filter(p => p.elevation <= maxTrainedElevation && !trainedNames.has(p.name.toLowerCase()))
    .slice(0, 8);
  const { customerInfo, isSubscribed, restore, isRestoring, refetchCustomerInfo } = useSubscription();

  const [restoreMsg, setRestoreMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Clerk user info
  const displayEmail = user?.primaryEmailAddress?.emailAddress ?? null;
  const displayName = user?.fullName ?? user?.firstName ?? displayEmail ?? "Account";
  const avatarInitial = (user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? "?")[0].toUpperCase();
  const userId = user?.id ?? null;

  const entitlement = customerInfo?.entitlements.active?.["premium"];
  const expiresDate = entitlement?.expirationDate
    ? new Date(entitlement.expirationDate).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      })
    : null;
  const willRenew = entitlement?.willRenew ?? false;

  const completedCount = Object.values(completedPlanSessions ?? {}).filter(Boolean).length;
  const totalPlanSessions = trainingPlan.reduce((a, w) => a + w.sessions.length, 0);
  const currentWeek = trainingPlan.find(w => w.isCurrentWeek);

  async function handleSignOut() {
    if (Platform.OS === "web") {
      doSignOut();
    } else {
      Alert.alert(
        "Sign out",
        "Your training data stays on this device.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign out", style: "destructive", onPress: doSignOut },
        ]
      );
    }
  }

  async function doSignOut() {
    try { await Purchases.logOut(); } catch {}
    await signOut();
    router.replace("/");
  }

  async function handleResetData() {
    if (Platform.OS === "web") {
      doResetData();
    } else {
      Alert.alert(
        "Reset all data",
        "This will permanently delete your summit goal, training plan, session history, and all saved hills. This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Reset", style: "destructive", onPress: doResetData },
        ]
      );
    }
  }

  async function doResetData() {
    await clearChallenges();
    await clearPlan();
    router.replace("/");
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Delete account",
      "This will permanently delete your Clerk account and all local data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete account", style: "destructive", onPress: doDeleteAccount },
      ]
    );
  }

  async function doDeleteAccount() {
    setDeletingAccount(true);
    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "summitready.uk";
      await Promise.allSettled(
        exploreHikes.map(h =>
          fetch(`https://${domain}/api/tracked-routes/${h.id}`, { method: "DELETE" })
        )
      );
    } catch {}
    try { await Purchases.logOut(); } catch {}
    try {
      await user?.delete();
    } catch {}
    await AsyncStorage.clear();
    setDeletingAccount(false);
    router.replace("/");
  }

  async function handleRestore() {
    setRestoreMsg(null);
    try {
      await restore();
      setRestoreMsg({ type: "success", text: "Purchases restored successfully." });
    } catch {
      setRestoreMsg({ type: "error", text: "No purchases found to restore." });
    }
  }

  const topPad = Platform.OS === "web" ? 56 : insets.top + 16;
  const botPad = Platform.OS === "web" ? 100 : insets.bottom + 100;

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad, paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.header}>
          <Text style={styles.title}>Account</Text>
        </Animated.View>

        {/* Profile card */}
        <Animated.View entering={FadeInDown.delay(40).duration(400)}>
          <View style={[styles.profileCard, { borderColor: T.green + "40" }]}>
            <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
            <View style={styles.avatarRow}>
              <View style={[styles.avatar, { backgroundColor: T.greenDim }]}>
                {isSignedIn
                  ? <Text style={styles.avatarInitial}>{avatarInitial}</Text>
                  : <User size={24} color={T.textMuted} />
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.displayName}>{displayName}</Text>
                {displayEmail && displayEmail !== displayName && (
                  <Text style={styles.userId}>{displayEmail}</Text>
                )}
                {userId && (
                  <Text style={[styles.userId, { marginTop: 1 }]}>ID: {maskId(userId)}</Text>
                )}
              </View>
              <View style={[styles.guestBadge, { backgroundColor: T.greenDim, borderColor: T.green + "40" }]}>
                <View style={[styles.guestDot, { backgroundColor: T.green }]} />
                <Text style={[styles.guestBadgeText, { color: T.green }]}>Signed in</Text>
              </View>
            </View>
            <View style={styles.signedInNote}>
              <Shield size={12} color={T.green} />
              <Text style={styles.signedInNoteText}>
                Your account is secured. Sign in on any device to restore your purchases.
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Log Session button */}
        <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.section}>
          <TouchableOpacity
            style={styles.logBtn}
            onPress={() => router.push("/(tabs)/log")}
            activeOpacity={0.82}
          >
            <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
            <PenLine size={18} color={T.green} />
            <Text style={styles.logBtnText}>Log a Session</Text>
            <ChevronRight size={16} color={T.textMuted} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>
        </Animated.View>

        {/* Subscription card */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.section}>
          <Text style={styles.sectionLabel}>SUBSCRIPTION</Text>
          <View style={[styles.subCard, isSubscribed && { borderColor: T.green + "50" }]}>
            <LinearGradient
              colors={isSubscribed ? [T.greenDim, "transparent"] : ["transparent", "transparent"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.subRow}>
              <View style={[styles.subIconBox, { backgroundColor: isSubscribed ? T.greenDim : T.surface }]}>
                {isSubscribed ? <Zap size={18} color={T.green} /> : <Circle size={18} color={T.textMuted} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.subPlanName, isSubscribed && { color: T.green }]}>
                  {isSubscribed ? "SummitReady Pro" : "Free Plan"}
                </Text>
                {isSubscribed && expiresDate ? (
                  <Text style={styles.subDetail}>
                    {willRenew ? `Renews ${expiresDate}` : `Expires ${expiresDate} · Won't renew`}
                  </Text>
                ) : (
                  <Text style={styles.subDetail}>Limited features</Text>
                )}
              </View>
              <View style={[styles.subStatusBadge, { backgroundColor: isSubscribed ? T.green + "20" : T.surface }]}>
                <Text style={[styles.subStatusText, { color: isSubscribed ? T.green : T.textMuted }]}>
                  {isSubscribed ? "Active" : "Free"}
                </Text>
              </View>
            </View>

            {isSubscribed && (
              <View style={styles.subFeatures}>
                {["Adaptive AI training", "Unlimited hill sessions", "Advanced analytics", "AI coach feedback"].map(f => (
                  <View key={f} style={styles.subFeatureRow}>
                    <Check size={12} color={T.green} />
                    <Text style={styles.subFeatureText}>{f}</Text>
                  </View>
                ))}
              </View>
            )}

            {!isSubscribed && (
              <TouchableOpacity
                style={styles.upgradeBtn}
                onPress={() => router.push("/paywall")}
                activeOpacity={0.85}
              >
                <LinearGradient colors={["#3ECF75", "#2AB860"]} style={styles.upgradeBtnGrad}>
                  <Zap size={14} color="#fff" />
                  <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
                  <ArrowRight size={13} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Progress summary */}
        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.section}>
          <Text style={styles.sectionLabel}>YOUR PROGRESS</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <LinearGradient colors={[T.blueDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <Text style={styles.statVal}>{sessions.length + exploreHikes.length}</Text>
              <Text style={styles.statLbl}>Sessions logged</Text>
            </View>
            <View style={styles.statBox}>
              <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <Text style={styles.statVal}>{completedCount}</Text>
              <Text style={styles.statLbl}>Plan sessions done</Text>
            </View>
            <View style={styles.statBox}>
              <LinearGradient colors={[T.orangeDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <Text style={styles.statVal}>{currentWeek ? `Wk ${currentWeek.weekNumber}` : "—"}</Text>
              <Text style={styles.statLbl}>Current week</Text>
            </View>
            <View style={styles.statBox}>
              <LinearGradient colors={[T.purpleDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <Text style={styles.statVal}>{totalPlanSessions}</Text>
              <Text style={styles.statLbl}>Plan sessions total</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.viewSessionsBtn}
            onPress={() => router.push("/sessions")}
            activeOpacity={0.75}
          >
            <View style={styles.viewSessionsIconWrap}>
              <Activity size={15} color={T.green} />
            </View>
            <Text style={styles.viewSessionsBtnText}>View all sessions</Text>
            <ChevronRight size={15} color={T.green} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          {summitGoal && (
            <View style={styles.goalPill}>
              <Flag size={13} color={T.green} />
              <Text style={styles.goalPillText} numberOfLines={1}>
                {summitGoal.mountainName}
              </Text>
              <Text style={styles.goalPillSub}>
                {summitGoal.elevationGain}m · {new Date(summitGoal.summitDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Training History */}
        {completedGoals.length > 0 && (
          <Animated.View entering={FadeInDown.delay(125).duration(400)} style={styles.section}>
            <Text style={styles.sectionLabel}>
              TRAINING HISTORY · {completedGoals.length} previous {completedGoals.length === 1 ? "goal" : "goals"}
            </Text>
            {[...completedGoals].reverse().map((g: CompletedGoal, i) => {
              const dc = DIFF_COLORS[g.difficulty];
              const totalKm = (g.totalElevationTrained / 1000).toFixed(1);
              const dateStr = new Date(g.completedAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
              return (
                <View key={i} style={styles.historyCard}>
                  <LinearGradient colors={[dc + "0D", "transparent"]} style={StyleSheet.absoluteFill} />
                  <View style={styles.historyTop}>
                    <Text style={styles.historyEmoji}>{DIFF_ICONS[g.difficulty]}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyMtn} numberOfLines={1}>{g.mountainName}</Text>
                      <Text style={styles.historyElev}>{g.elevationGain}m elevation gain</Text>
                    </View>
                    <View style={[styles.historyDiffBadge, { backgroundColor: dc + "22", borderColor: dc + "40" }]}>
                      <Text style={[styles.historyDiffText, { color: dc }]}>{g.difficulty}</Text>
                    </View>
                  </View>
                  <View style={styles.historyStatsRow}>
                    <View style={styles.historyStatItem}>
                      <Text style={styles.historyStatVal}>{g.sessionsLogged}</Text>
                      <Text style={styles.historyStatLbl}>sessions</Text>
                    </View>
                    <View style={styles.historyStatDivider} />
                    <View style={styles.historyStatItem}>
                      <Text style={styles.historyStatVal}>{totalKm}k m</Text>
                      <Text style={styles.historyStatLbl}>elevation trained</Text>
                    </View>
                    <View style={styles.historyStatDivider} />
                    <View style={styles.historyStatItem}>
                      <Text style={styles.historyStatVal}>{g.trainingWeeks}wk</Text>
                      <Text style={styles.historyStatLbl}>plan</Text>
                    </View>
                    <View style={styles.historyStatDivider} />
                    <View style={styles.historyStatItem}>
                      <Text style={styles.historyStatVal}>{dateStr}</Text>
                      <Text style={styles.historyStatLbl}>completed</Text>
                    </View>
                  </View>
                </View>
              );
            })}
            {/* Lifetime totals banner */}
            <View style={styles.lifetimeBanner}>
              <TrendingUp size={13} color={T.green} />
              <Text style={styles.lifetimeText}>
                Lifetime: <Text style={{ color: T.text }}>{lifetimeSessions} sessions</Text>
                {"  ·  "}
                <Text style={{ color: T.text }}>{(lifetimeElevation / 1000).toFixed(1)}k m</Text> total elevation
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Hills you're ready for */}
        {readyForPeaks.length > 0 && (
          <Animated.View entering={FadeInDown.delay(128).duration(400)} style={styles.section}>
            <Text style={styles.sectionLabel}>HILLS YOU'RE READY FOR</Text>
            <Text style={styles.readySubtext}>
              Based on your training{completedGoals.length > 0 ? " history" : " goal"} — these peaks are within your range
            </Text>
            <View style={styles.readyGrid}>
              {readyForPeaks.map((peak, i) => {
                const dc = DIFF_COLORS[peak.difficulty];
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.readyChip, { borderColor: dc + "30" }]}
                    onPress={() => openMapSearch(peak.name)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.readyChipEmoji}>{peak.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.readyChipName}>{peak.name}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
                        <MapPin size={10} color={T.textMuted} />
                        <Text style={styles.readyChipSub}>{peak.location} · {peak.elevation}m</Text>
                      </View>
                    </View>
                    <View style={[styles.readyDiffBadge, { backgroundColor: dc + "22" }]}>
                      <Text style={[styles.readyDiffText, { color: dc }]}>{peak.difficulty}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Active Challenges */}
        {inProgressChallenges.length > 0 && (
          <Animated.View entering={FadeInDown.delay(128).duration(400)} style={styles.section}>
            <Text style={styles.sectionLabel}>
              ACTIVE CHALLENGES · {inProgressChallenges.length}
            </Text>
            {inProgressChallenges.map((ac, i) => {
              const template = getChallenge(ac.challengeId);
              if (!template) return null;
              const dc = CHALLENGE_DIFF_COLOR[template.difficulty];
              const progress = getProgress(ac.challengeId);
              const pct = Math.min(progress / template.targetValue, 1);
              const progressLabel = template.metric === "hikes"
                ? `${progress} / ${template.targetValue} hikes`
                : `${progress.toLocaleString()}m / ${template.targetValue.toLocaleString()}m`;
              return (
                <TouchableOpacity
                  key={ac.challengeId + i}
                  style={[styles.activeChallengeCard, { borderColor: dc + "40" }]}
                  onPress={() => router.push({ pathname: "/challenge-detail", params: { id: ac.challengeId } })}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={[dc + "12", "transparent"]} style={StyleSheet.absoluteFill} />
                  <View style={styles.activeChallengeTop}>
                    <Text style={styles.activeChallengeEmoji}>{template.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activeChallengeTitle} numberOfLines={1}>{template.title}</Text>
                      <Text style={styles.activeChallengeProgress}>{progressLabel}</Text>
                    </View>
                    <View style={[styles.challengeDiffBadge, { backgroundColor: dc + "22", borderColor: dc + "40" }]}>
                      <Text style={[styles.challengeDiffText, { color: dc }]}>{template.difficulty}</Text>
                    </View>
                    <ChevronRight size={15} color={T.textDim} />
                  </View>
                  <View style={styles.activeProgressBarTrack}>
                    <View style={[styles.activeProgressBarFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: dc }]} />
                  </View>
                  <Text style={[styles.activeProgressPct, { color: dc }]}>{Math.round(pct * 100)}% complete</Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        )}

        {/* Completed Challenges */}
        {completedChallenges.length > 0 && (
          <Animated.View entering={FadeInDown.delay(129).duration(400)} style={styles.section}>
            <Text style={styles.sectionLabel}>
              COMPLETED CHALLENGES · {completedChallenges.length}
            </Text>

            {/* Summary totals */}
            <View style={styles.challengeSummaryRow}>
              <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <View style={styles.challengeSummaryItem}>
                <Text style={styles.challengeSummaryVal}>{totalChallengeElevation.toLocaleString()}m</Text>
                <Text style={styles.challengeSummaryLbl}>elevation gained</Text>
              </View>
              <View style={styles.challengeSummaryDivider} />
              <View style={styles.challengeSummaryItem}>
                <Text style={styles.challengeSummaryVal}>{totalChallengeActivities}</Text>
                <Text style={styles.challengeSummaryLbl}>activities logged</Text>
              </View>
              <View style={styles.challengeSummaryDivider} />
              <View style={styles.challengeSummaryItem}>
                <Text style={styles.challengeSummaryVal}>{completedChallenges.length}</Text>
                <Text style={styles.challengeSummaryLbl}>challenges done</Text>
              </View>
            </View>

            {/* Individual challenge cards */}
            {[...completedChallenges].reverse().map((ac, i) => {
              const template = getChallenge(ac.challengeId);
              if (!template) return null;
              const elev = ac.activities.reduce((s, a) => s + a.elevationGain, 0);
              const dc = CHALLENGE_DIFF_COLOR[template.difficulty];
              const dateStr = ac.completedAt
                ? new Date(ac.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                : "—";
              const badges = computeChallengeBadges(ac);
              return (
                <View key={ac.challengeId + i} style={[styles.challengeCard, { borderColor: dc + "30" }]}>
                  <LinearGradient colors={[dc + "0D", "transparent"]} style={StyleSheet.absoluteFill} />
                  <View style={styles.challengeCardTop}>
                    <Text style={styles.challengeEmoji}>{template.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.challengeTitle} numberOfLines={1}>{template.title}</Text>
                      <Text style={styles.challengeDate}>Completed {dateStr}</Text>
                    </View>
                    <View style={[styles.challengeDiffBadge, { backgroundColor: dc + "22", borderColor: dc + "40" }]}>
                      <Text style={[styles.challengeDiffText, { color: dc }]}>{template.difficulty}</Text>
                    </View>
                  </View>
                  <View style={styles.challengeStatsRow}>
                    <View style={styles.challengeStatItem}>
                      <Text style={styles.challengeStatVal}>{elev.toLocaleString()}m</Text>
                      <Text style={styles.challengeStatLbl}>elevation</Text>
                    </View>
                    <View style={styles.challengeStatDivider} />
                    <View style={styles.challengeStatItem}>
                      <Text style={styles.challengeStatVal}>{ac.activities.length}</Text>
                      <Text style={styles.challengeStatLbl}>activities</Text>
                    </View>
                    <View style={styles.challengeStatDivider} />
                    <View style={styles.challengeStatItem}>
                      <Text style={styles.challengeStatVal}>{template.targetValue.toLocaleString()}{template.metric === "hikes" ? "" : "m"}</Text>
                      <Text style={styles.challengeStatLbl}>target</Text>
                    </View>
                  </View>
                  {badges.length > 0 && (
                    <View style={styles.challengeBadgeRow}>
                      <Trophy size={11} color={T.orange} />
                      <View style={styles.challengeBadgeList}>
                        {badges.map(b => (
                          <View key={b.label} style={styles.challengeBadgeChip}>
                            <Text style={styles.challengeBadgeEmoji}>{b.emoji}</Text>
                            <Text style={styles.challengeBadgeLabel}>{b.label}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </Animated.View>
        )}

        {/* Achievements */}
        <Animated.View entering={FadeInDown.delay(130).duration(400)} style={styles.section}>
          <Text style={styles.sectionLabel}>
            ACHIEVEMENTS · {unlockedAchievements.length}/{ACHIEVEMENTS.length}
          </Text>
          <View style={styles.achieveGrid}>
            {Array.from({ length: Math.ceil(ACHIEVEMENTS.length / 2) }, (_, rowIdx) => {
              const pair = ACHIEVEMENTS.slice(rowIdx * 2, rowIdx * 2 + 2);
              return (
                <View key={rowIdx} style={styles.achieveRow}>
                  {pair.map(a => {
                    const isUnlocked = unlockedAchievements.includes(a.id);
                    const tierColor = TIER_COLOR[a.tier];
                    return (
                      <View
                        key={a.id}
                        style={[
                          styles.achieveCard,
                          isUnlocked ? { borderColor: tierColor + "55" } : { opacity: 0.35 },
                        ]}
                      >
                        {isUnlocked && (
                          <LinearGradient
                            colors={[tierColor + "18", "transparent"]}
                            style={StyleSheet.absoluteFill}
                          />
                        )}
                        <View style={styles.achieveCardTop}>
                          <Text style={styles.achieveEmoji}>{isUnlocked ? a.emoji : "🔒"}</Text>
                          {isUnlocked && (
                            <View style={[styles.achieveTierBadge, { backgroundColor: tierColor + "22" }]}>
                              <Text style={[styles.achieveTierText, { color: tierColor }]}>
                                {TIER_LABEL[a.tier]}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.achieveTitle} numberOfLines={2}>{a.title}</Text>
                        <Text style={styles.achieveDesc} numberOfLines={2}>{a.description}</Text>
                      </View>
                    );
                  })}
                  {pair.length === 1 && <View style={styles.achieveCardPlaceholder} />}
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* Setup / Goal actions */}
        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.section}>
          <Text style={styles.sectionLabel}>TRAINING SETUP</Text>
          <View style={styles.actionList}>
            <TouchableOpacity style={styles.actionRow} onPress={() => router.push("/setup")} activeOpacity={0.7}>
              <Compass size={16} color={T.blue} />
              <View style={{ flex: 1 }}>
                <Text style={styles.actionText}>Review or change setup</Text>
                <Text style={styles.actionSub}>Update your goal, fitness level or mountain</Text>
              </View>
              <ChevronRight size={16} color={T.textDim} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Billing actions */}
        <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.section}>
          <Text style={styles.sectionLabel}>BILLING</Text>
          <View style={styles.actionList}>
            {restoreMsg && (
              <View style={[styles.restoreMsg, { borderColor: restoreMsg.type === "success" ? T.green + "30" : T.orange + "30", backgroundColor: restoreMsg.type === "success" ? T.greenDim : T.orangeDim }]}>
                {restoreMsg.type === "success" ? <CheckCircle size={14} color={T.green} /> : <AlertCircle size={14} color={T.orange} />}
                <Text style={[styles.restoreMsgText, { color: restoreMsg.type === "success" ? T.green : T.orange }]}>{restoreMsg.text}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.actionRow} onPress={handleRestore} disabled={isRestoring} activeOpacity={0.7}>
              {isRestoring
                ? <ActivityIndicator size="small" color={T.blue} />
                : <RefreshCw size={16} color={T.blue} />}
              <Text style={styles.actionText}>Restore purchases</Text>
              <ChevronRight size={16} color={T.textDim} />
            </TouchableOpacity>
            {isSubscribed && (
              <TouchableOpacity style={styles.actionRow} onPress={() => router.push("/subscription")} activeOpacity={0.7}>
                <CreditCard size={16} color={T.green} />
                <Text style={styles.actionText}>Manage subscription</Text>
                <ChevronRight size={16} color={T.textDim} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Account actions */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <View style={styles.actionList}>
            <TouchableOpacity style={styles.actionRow} onPress={handleSignOut} activeOpacity={0.7}>
              <LogOut size={16} color={T.orange} />
              <Text style={[styles.actionText, { color: T.orange }]}>Sign out</Text>
              <ChevronRight size={16} color={T.textDim} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionRow, { borderColor: "#FF444420" }]} onPress={handleResetData} activeOpacity={0.7}>
              <Trash2 size={16} color="#FF4444" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionText, { color: "#FF4444" }]}>Reset all data</Text>
                <Text style={styles.actionSub}>Deletes your local goal, plan and session history</Text>
              </View>
              <ChevronRight size={16} color={T.textDim} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionRow, { borderColor: "#FF444420" }]} onPress={handleDeleteAccount} disabled={deletingAccount} activeOpacity={0.7}>
              {deletingAccount
                ? <ActivityIndicator size="small" color="#FF4444" />
                : <Trash2 size={16} color="#FF4444" />}
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionText, { color: "#FF4444" }]}>Delete account</Text>
                <Text style={styles.actionSub}>Permanently removes your Clerk account and all data</Text>
              </View>
              <ChevronRight size={16} color={T.textDim} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* App info */}
        <Animated.View entering={FadeInDown.delay(240).duration(400)} style={styles.appInfo}>
          <Text style={styles.appInfoText}>SummitReady · v1.0</Text>
          <View style={styles.legalLinks}>
            <TouchableOpacity onPress={() => Linking.openURL("https://summitready.uk/privacy")} activeOpacity={0.7}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>·</Text>
            <TouchableOpacity onPress={() => Linking.openURL("https://summitready.uk/terms")} activeOpacity={0.7}>
              <Text style={styles.legalLink}>Terms of Service</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18, gap: 20 },
  header: { marginBottom: 0 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.text },

  section: { gap: 8 },

  logBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.green + "30",
    paddingHorizontal: 16, paddingVertical: 15, overflow: "hidden",
  },
  logBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.text, flex: 1 },

  sectionLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: T.textMuted, letterSpacing: 0.8, textTransform: "uppercase",
  },

  profileCard: {
    backgroundColor: T.card, borderRadius: 20,
    borderWidth: 1, borderColor: T.cardBorder,
    padding: 16, gap: 12, overflow: "hidden",
  },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: T.border,
  },
  avatarInitial: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.green },
  displayName: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.text },
  userId: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },
  guestBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, borderWidth: 1,
  },
  guestDot: { width: 6, height: 6, borderRadius: 3 },
  guestBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  signInBtn: { borderRadius: 14, overflow: "hidden" },
  signInBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 13,
  },
  signInBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  signedInNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: T.greenDim, borderRadius: 12, padding: 10,
  },
  signedInNoteText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: T.green, lineHeight: 17 },

  subCard: {
    backgroundColor: T.card, borderRadius: 20,
    borderWidth: 1, borderColor: T.cardBorder,
    padding: 16, gap: 12, overflow: "hidden",
  },
  subRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  subIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  subPlanName: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.text },
  subDetail: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },
  subStatusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  subStatusText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  subFeatures: { gap: 6, paddingTop: 4 },
  subFeatureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  subFeatureText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },
  upgradeBtn: { borderRadius: 14, overflow: "hidden" },
  upgradeBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 13,
  },
  upgradeBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statBox: {
    flex: 1, minWidth: "45%",
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.cardBorder,
    padding: 14, gap: 4, overflow: "hidden",
  },
  statVal: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.text },
  statLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  viewSessionsBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: T.green + "14", borderRadius: 14,
    borderWidth: 1, borderColor: T.green + "45",
    paddingHorizontal: 14, paddingVertical: 13,
    marginTop: 10,
  },
  viewSessionsIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: T.green + "20",
    alignItems: "center", justifyContent: "center",
  },
  viewSessionsBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.text },

  goalPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: T.card, borderRadius: 14,
    borderWidth: 1, borderColor: T.green + "30",
    paddingVertical: 10, paddingHorizontal: 14, marginTop: 2,
  },
  goalPillText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.text },
  goalPillSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },

  actionList: { gap: 8 },
  actionRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.card, borderRadius: 14,
    borderWidth: 1, borderColor: T.cardBorder,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  actionText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: T.text },
  actionSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  restoreMsg: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, padding: 12, borderWidth: 1,
  },
  restoreMsgText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },

  achieveGrid: { gap: 10 },
  achieveRow: { flexDirection: "row", gap: 10 },
  achieveCard: {
    flex: 1,
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.cardBorder,
    padding: 12, gap: 6, overflow: "hidden",
  },
  achieveCardPlaceholder: { flex: 1 },
  achieveCardTop: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 2,
  },
  achieveEmoji: { fontSize: 28 },
  achieveTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text },
  achieveDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 15 },
  achieveTierBadge: {
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 8,
  },
  achieveTierText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5, textTransform: "uppercase" },

  historyCard: {
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.cardBorder,
    padding: 14, gap: 12, overflow: "hidden",
  },
  historyTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  historyEmoji: { fontSize: 22 },
  historyMtn: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.text },
  historyElev: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  historyDiffBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  historyDiffText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  historyStatsRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface, borderRadius: 10, padding: 10,
  },
  historyStatItem: { flex: 1, alignItems: "center", gap: 2 },
  historyStatVal: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text },
  historyStatLbl: { fontSize: 9, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" },
  historyStatDivider: { width: 1, height: 28, backgroundColor: T.border },
  lifetimeBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: T.greenDim, borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: T.green + "25",
  },
  lifetimeText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 17 },

  readySubtext: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: -2, marginBottom: 2 },
  readyGrid: { gap: 8 },
  readyChip: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: T.card, borderRadius: 14,
    borderWidth: 1, borderColor: T.cardBorder,
    paddingVertical: 11, paddingHorizontal: 14,
  },
  readyChipEmoji: { fontSize: 20 },
  readyChipName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.text },
  readyChipSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  readyDiffBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  readyDiffText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },

  challengeSummaryRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.green + "30",
    padding: 14, overflow: "hidden",
  },
  challengeSummaryItem: { flex: 1, alignItems: "center", gap: 3 },
  challengeSummaryVal: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.text },
  challengeSummaryLbl: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" },
  challengeSummaryDivider: { width: 1, height: 32, backgroundColor: T.border },

  activeChallengeCard: {
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.cardBorder,
    padding: 14, gap: 8, overflow: "hidden",
  },
  activeChallengeTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  activeChallengeEmoji: { fontSize: 24 },
  activeChallengeTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },
  activeChallengeProgress: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },
  activeProgressBarTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: T.surface,
    overflow: "hidden",
  },
  activeProgressBarFill: {
    height: 6, borderRadius: 3,
  },
  activeProgressPct: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  challengeCard: {
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.cardBorder,
    padding: 14, gap: 10, overflow: "hidden",
  },
  challengeCardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  challengeEmoji: { fontSize: 24 },
  challengeTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },
  challengeDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  challengeDiffBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  challengeDiffText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  challengeStatsRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface, borderRadius: 10, padding: 10,
  },
  challengeStatItem: { flex: 1, alignItems: "center", gap: 2 },
  challengeStatVal: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text },
  challengeStatLbl: { fontSize: 9, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" },
  challengeStatDivider: { width: 1, height: 28, backgroundColor: T.border },
  challengeBadgeRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 7,
    paddingTop: 2,
  },
  challengeBadgeList: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  challengeBadgeChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: T.surface, borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 4,
    borderWidth: 1, borderColor: T.border,
  },
  challengeBadgeEmoji: { fontSize: 13 },
  challengeBadgeLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted },

  appInfo: { alignItems: "center", gap: 6, paddingTop: 8, paddingBottom: 4 },
  appInfoText: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  legalLinks: { flexDirection: "row", alignItems: "center", gap: 8 },
  legalLink: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, textDecorationLine: "underline" },
  legalDot: { fontSize: 11, color: T.textMuted },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  modalSheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: T.border,
    padding: 20, gap: 12,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: T.border, alignSelf: "center", marginBottom: 4,
  },
  modalTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  modalIconBox: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: T.blueDim,
    alignItems: "center", justifyContent: "center",
  },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.text },
  modalSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  modalLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: T.textMuted, letterSpacing: 0.4, textTransform: "uppercase",
  },
  modalInput: {
    backgroundColor: T.surface, borderRadius: 12,
    borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: "Inter_400Regular", color: T.text,
  },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.orange },
  modalNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: T.surface, borderRadius: 10, padding: 10,
  },
  modalNoteText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 17 },
  modalBtnRow: { flexDirection: "row", gap: 10 },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 14,
    borderWidth: 1, borderColor: T.border,
    alignItems: "center", justifyContent: "center",
  },
  cancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  confirmBtn: { flex: 2, borderRadius: 14, overflow: "hidden" },
  confirmBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 13,
  },
  confirmText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
});
