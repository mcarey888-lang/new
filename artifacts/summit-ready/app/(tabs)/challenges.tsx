import React, { useMemo } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle, ChevronRight, Lock, Trophy, Zap } from "lucide-react-native";
import { T } from "@/constants/theme";
import { CHALLENGES, DIFF_COLOR, type ChallengeTemplate } from "@/constants/challenges";
import { useChallenges } from "@/context/ChallengesContext";
import { useSubscription } from "@/lib/revenuecat";

const FREE_IDS = ["1000m-7days", "5-hikes-30days", "2500m-14days"];

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${Math.min(100, pct)}%` as any, backgroundColor: color }]} />
    </View>
  );
}
const pb = StyleSheet.create({
  track: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  fill:  { height: 4, borderRadius: 2 },
});

function ChallengeCard({ c, onPress }: { c: ChallengeTemplate; onPress: () => void }) {
  const { getProgress, getActiveChallenge } = useChallenges();
  const { isSubscribed } = useSubscription();
  const locked = c.isPremium && !isSubscribed;
  const ac = getActiveChallenge(c.id);
  const progress = getProgress(c.id);
  const pct = ac ? Math.round((progress / c.targetValue) * 100) : 0;
  const color = c.color;
  const diffColor = DIFF_COLOR[c.difficulty];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.82} style={cc.card}>
      <LinearGradient colors={[color + "12", "transparent"]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <View style={cc.top}>
        <View style={[cc.emoji, { backgroundColor: color + "20" }]}>
          <Text style={cc.emojiText}>{c.emoji}</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={cc.badges}>
            <View style={[cc.badge, { backgroundColor: diffColor + "20" }]}>
              <Text style={[cc.badgeText, { color: diffColor }]}>{c.difficulty}</Text>
            </View>
            {c.isPremium && (
              <View style={[cc.badge, { backgroundColor: T.purpleDim }]}>
                <Zap size={9} color={T.purple} />
                <Text style={[cc.badgeText, { color: T.purple }]}>Pro</Text>
              </View>
            )}
            {ac?.completed && (
              <View style={[cc.badge, { backgroundColor: T.greenDim }]}>
                <CheckCircle size={9} color={T.green} />
                <Text style={[cc.badgeText, { color: T.green }]}>Done</Text>
              </View>
            )}
          </View>
          <Text style={cc.title} numberOfLines={2}>{c.title}</Text>
        </View>
        {locked
          ? <Lock size={16} color={T.textDim} />
          : <ChevronRight size={16} color={T.textDim} />
        }
      </View>

      <Text style={cc.tagline} numberOfLines={1}>{c.tagline}</Text>

      <View style={cc.meta}>
        <Text style={cc.metaText}>
          {c.metric === "elevation"
            ? `${c.targetValue.toLocaleString()}m gain`
            : `${c.targetValue} sessions`}
        </Text>
        {c.durationDays && <Text style={cc.metaDot}>·</Text>}
        {c.durationDays && <Text style={cc.metaText}>{c.durationDays} days</Text>}
      </View>

      {ac && !ac.completed && (
        <View style={cc.progressArea}>
          <View style={cc.progressRow}>
            <Text style={cc.progressLabel}>
              {c.metric === "elevation"
                ? `${progress.toLocaleString()}m / ${c.targetValue.toLocaleString()}m`
                : `${ac.activities.length} / ${c.targetValue} sessions`}
            </Text>
            <Text style={[cc.progressPct, { color }]}>{pct}%</Text>
          </View>
          <ProgressBar pct={pct} color={color} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const cc = StyleSheet.create({
  card: {
    backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border,
    padding: 16, gap: 10, overflow: "hidden",
  },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  emoji: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  emojiText: { fontSize: 22 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  title: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text, lineHeight: 19 },
  tagline: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 17 },
  meta: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textDim },
  metaDot: { fontSize: 12, color: T.textDim },
  progressArea: { gap: 5 },
  progressRow: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  progressPct: { fontSize: 11, fontFamily: "Inter_700Bold" },
});

export default function ChallengesScreen() {
  const insets = useSafeAreaInsets();
  const { activeChallenges, getProgress } = useChallenges();
  const { isSubscribed } = useSubscription();

  const active = useMemo(
    () => activeChallenges.filter(ac => !ac.completed),
    [activeChallenges]
  );
  const completed = useMemo(
    () => activeChallenges.filter(ac => ac.completed),
    [activeChallenges]
  );
  const available = useMemo(
    () => CHALLENGES.filter(c => !activeChallenges.some(ac => ac.challengeId === c.id && !ac.completed)),
    [activeChallenges]
  );

  const totalElev = useMemo(
    () => activeChallenges.flatMap(ac => ac.activities).reduce((s, a) => s + a.elevationGain, 0),
    [activeChallenges]
  );

  function goTo(c: ChallengeTemplate) {
    router.push({ pathname: "/challenge-detail", params: { id: c.id } });
  }

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: Platform.OS === "web" ? 60 : insets.top + 20, paddingBottom: 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(40).duration(600)} style={s.header}>
          <View>
            <Text style={s.eyebrow}>CHALLENGES</Text>
            <Text style={s.title}>Ascents</Text>
          </View>
          <View style={[s.trophyWrap, { backgroundColor: T.greenDim }]}>
            <Trophy size={20} color={T.green} />
          </View>
        </Animated.View>

        {/* Stats strip */}
        <Animated.View entering={FadeInDown.delay(60).duration(600)} style={s.statsStrip}>
          <View style={s.statItem}>
            <Text style={[s.statVal, { color: T.green }]}>{active.length}</Text>
            <Text style={s.statLbl}>Active</Text>
          </View>
          <View style={s.statDivider} />
          <TouchableOpacity
            style={s.statItem}
            activeOpacity={0.7}
            onPress={() => router.push("/completed-challenges")}
          >
            <Text style={[s.statVal, { color: T.blue }]}>{completed.length}</Text>
            <Text style={s.statLbl}>Completed</Text>
          </TouchableOpacity>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statVal, { color: T.orange }]}>{totalElev.toLocaleString()}</Text>
            <Text style={s.statLbl}>Total metres</Text>
          </View>
        </Animated.View>

        {/* Active challenges */}
        {active.length > 0 && (
          <Animated.View entering={FadeInDown.delay(80).duration(600)} style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>In progress</Text>
              <Text style={s.sectionCount}>{active.length}</Text>
            </View>
            {active.map((ac, i) => {
              const c = CHALLENGES.find(ch => ch.id === ac.challengeId);
              if (!c) return null;
              return (
                <Animated.View key={ac.challengeId} entering={FadeInDown.delay(100 + i * 60).duration(400)}>
                  <ChallengeCard c={c} onPress={() => goTo(c)} />
                </Animated.View>
              );
            })}
          </Animated.View>
        )}

        {/* Featured if nothing active */}
        {active.length === 0 && (
          <Animated.View entering={FadeInDown.delay(80).duration(600)}>
            <TouchableOpacity
              onPress={() => goTo(CHALLENGES[0])}
              activeOpacity={0.85}
              style={s.featured}
            >
              <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <View style={s.featuredTop}>
                <Text style={s.featuredEyebrow}>FREE CHALLENGE</Text>
                <View style={[s.featuredBadge, { backgroundColor: DIFF_COLOR["Beginner"] + "25" }]}>
                  <Text style={[s.featuredBadgeText, { color: DIFF_COLOR["Beginner"] }]}>Beginner</Text>
                </View>
              </View>
              <Text style={s.featuredTitle}>1,000m in 7 Days</Text>
              <Text style={s.featuredDesc}>
                One week. One thousand metres. Build the habit of getting out consistently — no subscription needed.
              </Text>
              <View style={s.featuredMeta}>
                <Text style={s.featuredMetaText}>1,000m elevation gain</Text>
                <Text style={s.featuredMetaDot}>·</Text>
                <Text style={s.featuredMetaText}>7 days</Text>
              </View>
              <View style={s.startBtn}>
                <Zap size={13} color={T.bg} />
                <Text style={s.startBtnText}>Start Challenge</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Available challenges */}
        <Animated.View entering={FadeInDown.delay(120).duration(600)} style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Available</Text>
            <Text style={s.sectionCount}>{available.length}</Text>
          </View>
          <View style={s.grid}>
            {available.map((c, i) => (
              <Animated.View key={c.id} entering={FadeInDown.delay(140 + i * 50).duration(400)} style={s.gridItem}>
                <ChallengeCard c={c} onPress={() => goTo(c)} />
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* Completed */}
        {completed.length > 0 && (
          <Animated.View entering={FadeInDown.delay(160).duration(600)} style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Completed</Text>
              <Text style={[s.sectionCount, { color: T.green }]}>{completed.length}</Text>
            </View>
            {completed.map((ac, i) => {
              const c = CHALLENGES.find(ch => ch.id === ac.challengeId);
              if (!c) return null;
              return (
                <Animated.View key={`${ac.challengeId}-done`} entering={FadeInDown.delay(180 + i * 60).duration(400)}>
                  <ChallengeCard c={c} onPress={() => goTo(c)} />
                </Animated.View>
              );
            })}
          </Animated.View>
        )}

        {/* Coming soon */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={s.comingSoon}>
          <LinearGradient colors={[T.purpleDim, "transparent"]} style={StyleSheet.absoluteFill} />
          <Text style={s.comingSoonTitle}>Custom Challenge Builder</Text>
          <Text style={s.comingSoonBody}>
            Set your own elevation target, deadline, and challenge name. Coming soon.
          </Text>
          <View style={s.comingSoonBadge}>
            <Text style={s.comingSoonBadgeText}>Coming soon</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 16 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.textDim, letterSpacing: 1.2 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.text },
  trophyWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  statsStrip: {
    flexDirection: "row", backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.border, padding: 14, justifyContent: "space-around",
  },
  statItem: { alignItems: "center", gap: 3 },
  statVal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted },
  statDivider: { width: 1, backgroundColor: T.border },

  section: { gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text },
  sectionCount: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted },

  grid: { gap: 10 },
  gridItem: {},

  featured: {
    backgroundColor: T.card, borderRadius: 20, borderWidth: 1, borderColor: T.green + "35",
    padding: 20, gap: 10, overflow: "hidden",
  },
  featuredTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  featuredEyebrow: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.green, letterSpacing: 1 },
  featuredBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  featuredBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  featuredTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: T.text },
  featuredDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 19 },
  featuredMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  featuredMetaText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textDim },
  featuredMetaDot: { fontSize: 12, color: T.textDim },
  startBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: T.green, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, marginTop: 2,
  },
  startBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.bg },

  comingSoon: {
    backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border,
    padding: 18, gap: 8, overflow: "hidden",
  },
  comingSoonTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.text },
  comingSoonBody: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18 },
  comingSoonBadge: { alignSelf: "flex-start", backgroundColor: T.purpleDim, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  comingSoonBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: T.purple },
});
