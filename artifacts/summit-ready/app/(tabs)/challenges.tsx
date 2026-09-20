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
import { CheckCircle, ChevronRight, Lock, Trophy, Zap, Mountain, TrendingUp, Compass, CalendarDays, Info } from "lucide-react-native";
import { T } from "@/constants/theme";
import { useScreenView } from "@/lib/analytics";
import { CHALLENGES, DIFF_COLOR, type ChallengeTemplate } from "@/constants/challenges";
import { useChallenges } from "@/context/ChallengesContext";
import { useSubscription } from "@/lib/revenuecat";
import { useStage8 } from "@/context/Stage8Context";

function getIconForMetric(metric: string, color: string) {
  switch (metric) {
    case "elevation": return <TrendingUp size={20} color={color} />;
    case "hikes": return <Mountain size={20} color={color} />;
    case "stages": return <Compass size={20} color={color} />;
    case "weeks": return <CalendarDays size={20} color={color} />;
    default: return <Trophy size={20} color={color} />;
  }
}

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
      <LinearGradient colors={[color + "08", "transparent"]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <View style={cc.top}>
        <View style={[cc.emoji, { backgroundColor: color + "15" }]}>
          {getIconForMetric(c.metric, color)}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={cc.badges}>
            <View style={[cc.badge, { backgroundColor: diffColor + "15" }]}>
              <Text style={[cc.badgeText, { color: diffColor }]}>{c.difficulty}</Text>
            </View>
            {c.isPremium && (
              <View style={[cc.badge, { backgroundColor: T.purpleDim }]}>
                <Zap size={10} color={T.purple} />
                <Text style={[cc.badgeText, { color: T.purple }]}>Pro</Text>
              </View>
            )}
            {ac?.completed && (
              <View style={[cc.badge, { backgroundColor: T.greenDim }]}>
                <CheckCircle size={10} color={T.green} />
                <Text style={[cc.badgeText, { color: T.green }]}>Done</Text>
              </View>
            )}
          </View>
          <Text style={cc.title} numberOfLines={2}>{c.title}</Text>
        </View>
        {locked
          ? <Lock size={18} color={T.textDim} />
          : <ChevronRight size={18} color={T.textDim} />
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
    backgroundColor: "transparent", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)",
    padding: 16, gap: 12, overflow: "hidden",
  },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  emoji: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  emojiText: { fontSize: 22 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  title: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: T.text, lineHeight: 22 },
  tagline: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 19 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 13, fontFamily: "Inter_500Medium", color: T.textDim },
  metaDot: { fontSize: 13, color: T.textDim },
  progressArea: { gap: 6, marginTop: 4 },
  progressRow: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  progressPct: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});

export default function ChallengesScreen() {
  useScreenView("challenges");
  const insets = useSafeAreaInsets();
  const { activeChallenges, getProgress } = useChallenges();
  const { isSubscribed } = useSubscription();
  const { projection: stage8Projection, pendingEvidence, catalogue: stage8Catalogue } = useStage8();

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
  const featured = available[0] ?? CHALLENGES[0];
  const stage8Tracked = Object.values(stage8Projection.progress)
    .filter((item) => item.status === "active" || item.status === "completed");

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
            <Text style={s.eyebrow}>Your progress</Text>
            <Text style={s.title}>Challenges</Text>
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

        <Animated.View entering={FadeInDown.delay(70).duration(600)} style={s.infoBox}>
          <Info size={14} color={T.textDim} />
          <Text style={s.infoText}>Local progress is available offline. Newly tracked activity consequences may remain pending until the activity is saved and qualified.</Text>
          {(Object.keys(stage8Projection.progress).length > 0 || pendingEvidence.length > 0) && (
            <View>
              <Text style={s.infoText}>
                Verified progress · {stage8Tracked.length} tracked
                {pendingEvidence.length > 0 ? ` · ${pendingEvidence.length} pending` : ""}
              </Text>
              {stage8Catalogue.map((definition) => {
                const progress = Object.values(stage8Projection.progress)
                  .find((item) => item.definitionId === definition.definitionId);
                if (!progress) return null;
                return (
                  <Text key={definition.definitionId} style={s.infoText}>
                  {progress.status === "active" || progress.status === "completed"
                    ? `${definition.title} · ${progress.status} · ${progress.value}/${progress.target}`
                    : `${definition.title} · ${progress.status}: ${progress.pendingReason ?? "Awaiting authoritative producer"}`}
                  </Text>
                );
              })}
            </View>
          )}
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
        {active.length === 0 && featured && (
          <Animated.View entering={FadeInDown.delay(80).duration(600)}>
            <TouchableOpacity
              onPress={() => goTo(featured)}
              activeOpacity={0.85}
              style={s.featured}
            >
              <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <View style={s.featuredTop}>
                <Text style={s.featuredEyebrow}>Featured</Text>
                <View style={[s.featuredBadge, { backgroundColor: DIFF_COLOR[featured.difficulty] + "25" }]}>
                  <Text style={[s.featuredBadgeText, { color: DIFF_COLOR[featured.difficulty] }]}>{featured.difficulty}</Text>
                </View>
              </View>
              <Text style={s.featuredTitle}>{featured.title}</Text>
              <Text style={s.featuredDesc}>{featured.description}</Text>
              <View style={s.featuredMeta}>
                <Text style={s.featuredMetaText}>
                  {featured.metric === "elevation"
                    ? `${featured.targetValue.toLocaleString()}m gain`
                    : `${featured.targetValue} sessions`}
                </Text>
                {featured.durationDays && <Text style={s.featuredMetaDot}>·</Text>}
                {featured.durationDays && <Text style={s.featuredMetaText}>{featured.durationDays} days</Text>}
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
  scroll: { paddingHorizontal: 20, gap: 20 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { fontSize: 14, fontFamily: "Inter_500Medium", color: T.textDim },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", color: T.text },
  trophyWrap: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },

  statsStrip: {
    flexDirection: "row", backgroundColor: "transparent", borderRadius: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", padding: 16, justifyContent: "space-around",
  },
  statItem: { alignItems: "center", gap: 4 },
  statVal: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLbl: { fontSize: 12, fontFamily: "Inter_500Medium", color: T.textMuted },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.05)" },

  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 16,
    backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.04)",
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18 },

  section: { gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: T.text },
  sectionCount: { fontSize: 14, fontFamily: "Inter_500Medium", color: T.textMuted },

  grid: { gap: 12 },
  gridItem: {},

  featured: {
    backgroundColor: "transparent", borderRadius: 20, borderWidth: 1, borderColor: T.green + "40",
    padding: 24, gap: 12, overflow: "hidden",
  },
  featuredTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  featuredEyebrow: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.green },
  featuredBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  featuredBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  featuredTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.text },
  featuredDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 21 },
  featuredMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  featuredMetaText: { fontSize: 13, fontFamily: "Inter_500Medium", color: T.textDim },
  featuredMetaDot: { fontSize: 13, color: T.textDim },
  startBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start",
    backgroundColor: T.green, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, marginTop: 4,
  },
  startBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.bg },

  comingSoon: {
    backgroundColor: "transparent", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)",
    padding: 20, gap: 10, overflow: "hidden",
  },
  comingSoonTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: T.text },
  comingSoonBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 20 },
  comingSoonBadge: { alignSelf: "flex-start", backgroundColor: T.purpleDim, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  comingSoonBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.purple },
});
