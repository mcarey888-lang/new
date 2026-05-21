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
import { ArrowLeft, CheckCircle, Trophy } from "lucide-react-native";
import { T } from "@/constants/theme";
import { getChallenge } from "@/constants/challenges";
import { useChallenges } from "@/context/ChallengesContext";

export default function CompletedChallengesScreen() {
  const insets = useSafeAreaInsets();
  const { activeChallenges } = useChallenges();

  const completed = useMemo(
    () => activeChallenges.filter(ac => ac.completed),
    [activeChallenges]
  );

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: Platform.OS === "web" ? 60 : insets.top + 20, paddingBottom: 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={12} activeOpacity={0.7}>
          <ArrowLeft size={18} color={T.textMuted} />
          <Text style={s.backText}>Challenges</Text>
        </TouchableOpacity>

        {/* Header */}
        <Animated.View entering={FadeInDown.delay(40).duration(600)} style={s.header}>
          <View>
            <Text style={s.eyebrow}>CHALLENGES</Text>
            <Text style={s.title}>Completed</Text>
          </View>
          <View style={[s.iconWrap, { backgroundColor: T.blueDim ?? "rgba(96,165,250,0.15)" }]}>
            <Trophy size={20} color={T.blue} />
          </View>
        </Animated.View>

        {/* Empty state */}
        {completed.length === 0 && (
          <Animated.View entering={FadeInDown.delay(80).duration(600)} style={s.emptyCard}>
            <LinearGradient colors={[T.blueDim ?? "rgba(96,165,250,0.12)", "transparent"]} style={StyleSheet.absoluteFill} />
            <Text style={s.emptyEmoji}>🏔️</Text>
            <Text style={s.emptyTitle}>No completed challenges yet</Text>
            <Text style={s.emptyBody}>
              Start a challenge and log your activities — every metre brings you closer to the summit.
            </Text>
            <TouchableOpacity onPress={() => router.back()} style={s.emptyBtn} activeOpacity={0.8}>
              <Text style={s.emptyBtnText}>Browse Challenges</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Completed list */}
        {completed.map((ac, i) => {
          const c = getChallenge(ac.challengeId);
          if (!c) return null;

          const totalElev = ac.activities.reduce((sum, a) => sum + a.elevationGain, 0);
          const sessionCount = ac.activities.length;
          const completedDate = ac.completedAt
            ? new Date(ac.completedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : null;

          return (
            <Animated.View
              key={`${ac.challengeId}-${ac.startedAt}`}
              entering={FadeInDown.delay(80 + i * 60).duration(500)}
              style={s.card}
            >
              <LinearGradient
                colors={[c.color + "12", "transparent"]}
                style={StyleSheet.absoluteFill}
              />
              {/* Top row */}
              <View style={s.cardTop}>
                <View style={[s.emojiWrap, { backgroundColor: c.color + "22" }]}>
                  <Text style={s.emoji}>{c.emoji}</Text>
                </View>
                <View style={s.completeBadge}>
                  <CheckCircle size={11} color={T.green} />
                  <Text style={s.completeBadgeText}>Complete</Text>
                </View>
              </View>

              {/* Title & tagline */}
              <Text style={s.cardTitle}>{c.title}</Text>
              <Text style={s.cardTagline}>{c.tagline}</Text>

              {/* Stats row */}
              <View style={s.statsRow}>
                {completedDate && (
                  <View style={s.statItem}>
                    <Text style={[s.statVal, { color: T.blue }]}>{completedDate}</Text>
                    <Text style={s.statLbl}>Completed</Text>
                  </View>
                )}
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={[s.statVal, { color: c.color }]}>{totalElev.toLocaleString()}m</Text>
                  <Text style={s.statLbl}>Elevation gained</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={[s.statVal, { color: T.orange }]}>{sessionCount}</Text>
                  <Text style={s.statLbl}>Activities</Text>
                </View>
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 16 },

  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  backText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.textMuted },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.textDim, letterSpacing: 1.2 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.text },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  emptyCard: {
    backgroundColor: T.card, borderRadius: 20, borderWidth: 1, borderColor: T.border,
    padding: 28, gap: 10, alignItems: "center", overflow: "hidden",
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.text, textAlign: "center" },
  emptyBody: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted,
    textAlign: "center", lineHeight: 19,
  },
  emptyBtn: {
    marginTop: 6, backgroundColor: T.blue, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.bg },

  card: {
    backgroundColor: T.card, borderRadius: 20, borderWidth: 1, borderColor: T.border,
    padding: 18, gap: 10, overflow: "hidden",
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  emojiWrap: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 22 },
  completeBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: T.greenDim, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  completeBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: T.green },

  cardTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.text },
  cardTagline: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 17 },

  statsRow: {
    flexDirection: "row", backgroundColor: T.surface, borderRadius: 12,
    borderWidth: 1, borderColor: T.border, padding: 12,
    justifyContent: "space-around", alignItems: "center",
  },
  statItem: { alignItems: "center", gap: 2, flex: 1 },
  statVal: { fontSize: 13, fontFamily: "Inter_700Bold" },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" },
  statDivider: { width: 1, height: 28, backgroundColor: T.border },
});
