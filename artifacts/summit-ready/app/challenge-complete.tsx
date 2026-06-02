import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Audio } from "expo-av";
import {
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle, Share2, Trophy, Zap } from "lucide-react-native";
import { T } from "@/constants/theme";
import { CHALLENGES, DIFF_COLOR, getChallenge } from "@/constants/challenges";
import { useChallenges } from "@/context/ChallengesContext";
import { ConfettiCelebration } from "@/components/ConfettiCelebration";

const CELEBRATION_KEY_PREFIX = "summitready_celebration_seen_";

function PulsingTrophy({ emoji, color, isCelebrating }: { emoji: string; color: string; isCelebrating: boolean }) {
  const scale = useSharedValue(1);
  const glow = useSharedValue(1);

  useEffect(() => {
    if (isCelebrating) {
      scale.value = withSequence(
        withTiming(1.25, { duration: 180 }),
        withTiming(0.92, { duration: 120 }),
        withTiming(1.12, { duration: 100 }),
        withTiming(1.0, { duration: 80 }),
        withDelay(400,
          withRepeat(
            withSequence(
              withTiming(1.06, { duration: 700 }),
              withTiming(1.0, { duration: 700 })
            ),
            4,
            true
          )
        )
      );
      glow.value = withSequence(
        withTiming(1.5, { duration: 300 }),
        withDelay(200,
          withRepeat(
            withSequence(
              withTiming(1.3, { duration: 800 }),
              withTiming(1.0, { duration: 800 })
            ),
            4,
            true
          )
        )
      );
    }
  }, [isCelebrating]);

  const trophyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glow.value }],
    opacity: isCelebrating ? 0.35 : 0,
  }));

  return (
    <View style={s.trophyOuter}>
      <Animated.View
        style={[
          s.trophyGlow,
          { backgroundColor: color },
          glowStyle,
        ]}
      />
      <Animated.View style={[s.trophyWrap, { backgroundColor: color + "20", borderColor: color + "40" }, trophyStyle]}>
        <Text style={s.trophyEmoji}>{emoji}</Text>
      </Animated.View>
    </View>
  );
}

export default function ChallengeCompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { getActiveChallenge } = useChallenges();
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const c = getChallenge(id ?? "");
  const ac = getActiveChallenge(id ?? "");

  useEffect(() => {
    if (!id) return;
    const key = CELEBRATION_KEY_PREFIX + id;
    let sound: Audio.Sound | null = null;
    AsyncStorage.getItem(key).then(async (val) => {
      if (!val) {
        setIsCelebrating(true);
        setShowConfetti(true);
        AsyncStorage.setItem(key, "1");
        try {
          await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
          const { sound: s } = await Audio.Sound.createAsync(
            require("../assets/sounds/challenge_complete.mp3"),
            { shouldPlay: true, volume: 1.0 }
          );
          sound = s;
          s.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) s.unloadAsync();
          });
        } catch {
          // Audio playback is non-critical — ignore errors silently
        }
      }
    });
    return () => { sound?.unloadAsync(); };
  }, [id]);

  if (!c || !ac) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: T.textMuted }}>Challenge not found</Text>
      </View>
    );
  }

  const totalElev = useMemo(
    () => ac.activities.reduce((s, a) => s + a.elevationGain, 0),
    [ac.activities]
  );
  const totalDist = useMemo(
    () => ac.activities.reduce((s, a) => s + a.distance, 0),
    [ac.activities]
  );
  const totalDur = useMemo(
    () => ac.activities.reduce((s, a) => s + a.duration, 0),
    [ac.activities]
  );
  const completedDate = ac.completedAt
    ? new Date(ac.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "Today";

  const color = c.color;

  const badges = useMemo(() => {
    const b: { emoji: string; label: string }[] = [];
    if (ac.activities.length >= 1) b.push({ emoji: "🌱", label: "First activity logged" });
    b.push({ emoji: "✅", label: "Challenge completed" });
    if (ac.activities.length >= 3) b.push({ emoji: "🔥", label: "3 activities logged" });
    const maxElev = Math.max(...ac.activities.map(a => a.elevationGain));
    if (maxElev >= 500) b.push({ emoji: "🏔️", label: "500m+ in one session" });
    return b;
  }, [ac]);

  function handleShare() {
    const hours = Math.floor(totalDur / 60);
    const mins = totalDur % 60;
    const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    const text = [
      `🏔️ Summit achieved!`,
      ``,
      `I completed the ${c!.title} with Summit Ready.`,
      ``,
      `📈 ${totalElev.toLocaleString()}m elevation gained`,
      `🗺️ ${totalDist.toFixed(1)}km total distance`,
      `⏱️ ${durationStr} total time`,
      `📅 Completed: ${completedDate}`,
      ``,
      `Train for big mountains using your local hills.`,
      `summitready.uk`,
    ].join("\n");

    if (Platform.OS === "web") {
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      return;
    }
    Share.share({ message: text });
  }

  function handleNextChallenge() {
    router.replace("/(tabs)/challenges");
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
        {/* Trophy */}
        <Animated.View entering={FadeInUp.delay(0).duration(700)} style={s.trophySection}>
          <PulsingTrophy emoji={c.emoji} color={color} isCelebrating={isCelebrating} />
          <View style={[s.completedBadge, { backgroundColor: T.greenDim, borderColor: T.green + "40" }]}>
            <CheckCircle size={13} color={T.green} />
            <Text style={s.completedBadgeText}>Summit achieved</Text>
          </View>
          <Text style={s.bigTitle}>{c.title}</Text>
          <Text style={s.dateText}>{completedDate}</Text>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={s.statsCard}>
          <LinearGradient colors={[color + "12", "transparent"]} style={StyleSheet.absoluteFill} />
          <View style={s.statsGrid}>
            <View style={s.statItem}>
              <Text style={[s.statVal, { color }]}>{totalElev.toLocaleString()}m</Text>
              <Text style={s.statLbl}>Elevation gained</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={[s.statVal, { color }]}>{ac.activities.length}</Text>
              <Text style={s.statLbl}>Activities</Text>
            </View>
          </View>
          <View style={s.statsGrid}>
            <View style={s.statItem}>
              <Text style={[s.statVal, { color }]}>{totalDist.toFixed(1)}km</Text>
              <Text style={s.statLbl}>Total distance</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={[s.statVal, { color }]}>
                {totalDur >= 60 ? `${Math.floor(totalDur / 60)}h ${totalDur % 60}m` : `${totalDur}m`}
              </Text>
              <Text style={s.statLbl}>Total time</Text>
            </View>
          </View>
        </Animated.View>

        {/* Badges */}
        {badges.length > 0 && (
          <Animated.View entering={FadeInDown.delay(140).duration(600)} style={s.card}>
            <View style={s.cardHeader}>
              <Trophy size={14} color={T.orange} />
              <Text style={s.cardTitle}>Badges earned</Text>
            </View>
            <View style={s.badgeGrid}>
              {badges.map(b => (
                <View key={b.label} style={s.badgeItem}>
                  <Text style={s.badgeEmoji}>{b.emoji}</Text>
                  <Text style={s.badgeLabel}>{b.label}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* All milestones reached */}
        <Animated.View entering={FadeInDown.delay(160).duration(600)} style={s.card}>
          <Text style={s.cardTitle}>Journey completed</Text>
          {c.milestones.map(m => (
            <View key={m.pct} style={s.milestoneRow}>
              <CheckCircle size={14} color={T.green} />
              <Text style={s.milestoneLabel}>{m.label}</Text>
              <Text style={s.milestoneEmoji}>{m.emoji}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Share card */}
        <Animated.View entering={FadeInDown.delay(180).duration(600)} style={[s.shareCard, { borderColor: color + "30" }]}>
          <LinearGradient colors={[color + "10", "transparent"]} style={StyleSheet.absoluteFill} />
          <Text style={s.shareTitle}>Share your achievement</Text>
          <View style={s.shareContent}>
            <Text style={[s.shareHeadline, { color }]}>🏔️ Summit achieved!</Text>
            <Text style={s.shareCopy}>I completed the {c.title} with Summit Ready.</Text>
            <Text style={s.shareStats}>
              {totalElev.toLocaleString()}m gained · {ac.activities.length} activities · {totalDist.toFixed(1)}km
            </Text>
            <Text style={s.shareBrand}>summitready.uk</Text>
          </View>
          <TouchableOpacity onPress={handleShare} style={s.shareBtn} activeOpacity={0.85}>
            <Share2 size={15} color={T.bg} />
            <Text style={s.shareBtnText}>{Platform.OS === "web" ? "Copy to clipboard" : "Share result"}</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* CTAs */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={s.ctaArea}>
          <TouchableOpacity
            onPress={handleNextChallenge}
            style={s.primaryBtn}
            activeOpacity={0.85}
          >
            <LinearGradient colors={[color, color + "CC"]} style={s.primaryBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Zap size={16} color={T.bg} />
              <Text style={s.primaryBtnText}>Start Another Challenge</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.replace("/(tabs)/challenges")}
            style={s.secondaryBtn}
            activeOpacity={0.7}
          >
            <Text style={s.secondaryBtnText}>Back to Challenges</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {showConfetti && (
        <ConfettiCelebration onComplete={() => setShowConfetti(false)} />
      )}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 18 },

  trophySection: { alignItems: "center", gap: 12, paddingVertical: 8 },
  trophyOuter: { alignItems: "center", justifyContent: "center" },
  trophyGlow: { position: "absolute", width: 110, height: 110, borderRadius: 55 },
  trophyWrap: { width: 90, height: 90, borderRadius: 28, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  trophyEmoji: { fontSize: 44 },
  completedBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  completedBadgeText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.green },
  bigTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: T.text, textAlign: "center", lineHeight: 30 },
  dateText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },

  statsCard: { backgroundColor: T.card, borderRadius: 20, borderWidth: 1, borderColor: T.border, padding: 18, gap: 14, overflow: "hidden" },
  statsGrid: { flexDirection: "row", alignItems: "center" },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statVal: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  statDivider: { width: 1, height: 40, backgroundColor: T.border },

  card: { backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 16, gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },

  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badgeItem: { alignItems: "center", gap: 4, width: 72 },
  badgeEmoji: { fontSize: 28 },
  badgeLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" },

  milestoneRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  milestoneLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: T.text },
  milestoneEmoji: { fontSize: 18 },

  shareCard: { backgroundColor: T.card, borderRadius: 20, borderWidth: 1, padding: 18, gap: 14, overflow: "hidden" },
  shareTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },
  shareContent: { gap: 5 },
  shareHeadline: { fontSize: 18, fontFamily: "Inter_700Bold" },
  shareCopy: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.text },
  shareStats: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  shareBrand: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim },
  shareBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: T.text, borderRadius: 12, paddingVertical: 12,
  },
  shareBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.bg },

  ctaArea: { gap: 10 },
  primaryBtn: { borderRadius: 14, overflow: "hidden" },
  primaryBtnInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 },
  primaryBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.bg },
  secondaryBtn: { alignItems: "center", paddingVertical: 10 },
  secondaryBtnText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textDim },
});
