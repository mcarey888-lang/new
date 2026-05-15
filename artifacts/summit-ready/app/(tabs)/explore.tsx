import {
  Award,
  CheckCircle,
  ChevronRight,
  Flag,
  Map,
  Mountain,
  TrendingUp,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, type ExploreHike } from "@/context/AppContext";
import { T } from "@/constants/theme";

// ── Achievements ─────────────────────────────────────────────────────────────

interface ExploreAchievement {
  id: string;
  icon: string;
  label: string;
  desc: string;
  condition: (hikes: ExploreHike[]) => boolean;
  progressFn?: (hikes: ExploreHike[]) => { current: number; target: number };
}

const ACHIEVEMENTS: ExploreAchievement[] = [
  {
    id: "first_hike",
    icon: "🥾",
    label: "First Steps",
    desc: "Log your first hike",
    condition: h => h.length >= 1,
    progressFn: h => ({ current: Math.min(h.length, 1), target: 1 }),
  },
  {
    id: "five_hikes",
    icon: "🏅",
    label: "Getting Going",
    desc: "Complete 5 hikes",
    condition: h => h.length >= 5,
    progressFn: h => ({ current: Math.min(h.length, 5), target: 5 }),
  },
  {
    id: "thousand_m",
    icon: "⛰️",
    label: "1000m Club",
    desc: "Gain 1,000m elevation",
    condition: h => h.reduce((s, x) => s + x.elevationGain, 0) >= 1000,
    progressFn: h => ({ current: Math.min(h.reduce((s, x) => s + x.elevationGain, 0), 1000), target: 1000 }),
  },
  {
    id: "streak_3",
    icon: "🔥",
    label: "On a Roll",
    desc: "3 hikes in 7 days",
    condition: h => {
      const week = 7 * 24 * 60 * 60 * 1000;
      return h.filter(x => Date.now() - new Date(x.date).getTime() <= week).length >= 3;
    },
    progressFn: h => {
      const week = 7 * 24 * 60 * 60 * 1000;
      const recent = h.filter(x => Date.now() - new Date(x.date).getTime() <= week).length;
      return { current: Math.min(recent, 3), target: 3 };
    },
  },
  {
    id: "ten_hikes",
    icon: "🌟",
    label: "Trail Regular",
    desc: "Complete 10 hikes",
    condition: h => h.length >= 10,
    progressFn: h => ({ current: Math.min(h.length, 10), target: 10 }),
  },
  {
    id: "fifty_km",
    icon: "🗺️",
    label: "Explorer",
    desc: "Cover 50km total",
    condition: h => h.reduce((s, x) => s + x.distance, 0) >= 50,
    progressFn: h => ({ current: Math.min(h.reduce((s, x) => s + x.distance, 0), 50), target: 50 }),
  },
];

// ── Suggested Next Challenge ──────────────────────────────────────────────────

function SuggestedChallenge({ hikes }: { hikes: ExploreHike[] }) {
  const totalElev = hikes.reduce((s, h) => s + h.elevationGain, 0);
  const count = hikes.length;

  let title: string;
  let desc: string;
  let btnLabel: string;
  let btnColor: string[];
  let onPress: () => void;

  if (count === 0) {
    title = "Log your first hike";
    desc = "Head out on any local trail and log it — every adventure counts.";
    btnLabel = "Browse hikes";
    btnColor = ["#3ECF75", "#2AB860"];
    onPress = () => router.push("/(tabs)/hikes");
  } else if (count < 3) {
    title = `Complete ${3 - count} more hike${3 - count > 1 ? "s" : ""}`;
    desc = "Build your foundation with a few more local outings before taking on bigger terrain.";
    btnLabel = "View hikes";
    btnColor = ["#3ECF75", "#2AB860"];
    onPress = () => router.push("/(tabs)/hikes");
  } else if (totalElev < 1000) {
    title = `${1000 - totalElev}m to the 1000m badge`;
    desc = `You've climbed ${totalElev}m so far. Find a hillier route to keep gaining altitude.`;
    btnLabel = "Find a bigger hill";
    btnColor = ["#FF9030", "#E07820"];
    onPress = () => router.push("/(tabs)/hikes");
  } else if (count >= 5) {
    title = "Ready for a summit goal?";
    desc = `${count} hikes and ${totalElev}m climbed — you have the base to train for a real summit.`;
    btnLabel = "Set a summit goal";
    btnColor = ["#4A9FF5", "#3080D0"];
    onPress = () => router.push("/questionnaire");
  } else {
    title = "Try a bigger hill challenge";
    desc = "You've built solid base fitness. Look for a route with 400m+ elevation gain.";
    btnLabel = "Browse hikes";
    btnColor = ["#3ECF75", "#2AB860"];
    onPress = () => router.push("/(tabs)/hikes");
  }

  return (
    <View style={ch.card}>
      <View style={ch.badge}>
        <Flag size={12} color={T.orange} />
        <Text style={ch.badgeText}>SUGGESTED NEXT CHALLENGE</Text>
      </View>
      <Text style={ch.title}>{title}</Text>
      <Text style={ch.desc}>{desc}</Text>
      <TouchableOpacity style={ch.btn} onPress={onPress} activeOpacity={0.82}>
        <LinearGradient colors={btnColor as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ch.btnGrad}>
          <Text style={ch.btnText}>{btnLabel}</Text>
          <ChevronRight size={14} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const ch = StyleSheet.create({
  card: { backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,144,48,0.2)", padding: 18, gap: 10 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5 },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.orange, letterSpacing: 0.8 },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.text },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 19 },
  btn: { alignSelf: "flex-start", borderRadius: 12, overflow: "hidden" },
  btnGrad: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 16, paddingVertical: 10 },
  btnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
});

// ── Achievement Card ──────────────────────────────────────────────────────────

function AchievementCard({ a, hikes }: { a: ExploreAchievement; hikes: ExploreHike[] }) {
  const done = a.condition(hikes);
  const progress = a.progressFn?.(hikes);
  const pct = progress ? progress.current / progress.target : done ? 1 : 0;

  return (
    <View style={[ac.card, done && ac.cardDone]}>
      <Text style={ac.icon}>{done ? a.icon : "🔒"}</Text>
      <Text style={[ac.label, done && { color: T.text }]}>{a.label}</Text>
      <Text style={ac.desc}>{a.desc}</Text>
      <View style={ac.barTrack}>
        <View style={[ac.barFill, { width: `${Math.round(pct * 100)}%` as unknown as number, backgroundColor: done ? T.green : T.textDim }]} />
      </View>
      {done && (
        <View style={ac.doneRow}>
          <CheckCircle size={11} color={T.green} />
          <Text style={ac.doneText}>Unlocked</Text>
        </View>
      )}
    </View>
  );
}

const ac = StyleSheet.create({
  card: {
    width: "47%",
    backgroundColor: T.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    padding: 14,
    alignItems: "center",
    gap: 5,
  },
  cardDone: { borderColor: "rgba(62,207,117,0.3)" },
  icon: { fontSize: 24 },
  label: { fontSize: 12, fontFamily: "Inter_700Bold", color: T.textMuted, textAlign: "center" },
  desc: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center", lineHeight: 14 },
  barTrack: { width: "100%", height: 3, backgroundColor: T.surface, borderRadius: 2, overflow: "hidden", marginTop: 4 },
  barFill: { height: 3, borderRadius: 2 },
  doneRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  doneText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.green },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { exploreHikes } = useApp();

  const totalDistance = useMemo(() => parseFloat(exploreHikes.reduce((s, h) => s + h.distance, 0).toFixed(1)), [exploreHikes]);
  const totalElev = useMemo(() => exploreHikes.reduce((s, h) => s + h.elevationGain, 0), [exploreHikes]);
  const recentCount = useMemo(() => {
    const week = 7 * 24 * 60 * 60 * 1000;
    return exploreHikes.filter(h => Date.now() - new Date(h.date).getTime() <= week).length;
  }, [exploreHikes]);

  const stats = [
    { label: "Hikes Logged", value: String(exploreHikes.length), color: T.green },
    { label: "Distance", value: `${totalDistance}km`, color: T.blue },
    { label: "Elevation", value: `${totalElev}m`, color: T.orange },
    { label: "This Week", value: `${recentCount} hike${recentCount !== 1 ? "s" : ""}`, color: T.purple },
  ];

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: Platform.OS === "web" ? 60 : insets.top + 20, paddingBottom: 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(60).duration(600)} style={s.header}>
          <Text style={s.eyebrow}>EXPLORE MODE</Text>
          <Text style={s.headline}>Start local.{"\n"}Build your mountain fitness.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(600)} style={s.statsGrid}>
          {stats.map((st, i) => (
            <View key={i} style={s.statCard}>
              <Text style={[s.statValue, { color: st.color }]}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).duration(600)}>
          <SuggestedChallenge hikes={exploreHikes} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(600)}>
          <TouchableOpacity style={s.logBtn} onPress={() => router.push("/(tabs)/hikes")} activeOpacity={0.85}>
            <LinearGradient colors={["#3ECF75", "#2AB860"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.logBtnGrad}>
              <TrendingUp size={19} color="#fff" />
              <Text style={s.logBtnText}>Log a hike</Text>
              <ChevronRight size={17} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(380).duration(600)}>
          <View style={s.sectionRow}>
            <Award size={14} color={T.textDim} />
            <Text style={s.sectionHead}>ACHIEVEMENTS</Text>
          </View>
          <View style={s.achieveGrid}>
            {ACHIEVEMENTS.map(a => (
              <AchievementCard key={a.id} a={a} hikes={exploreHikes} />
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(460).duration(600)} style={s.switchCard}>
          <Mountain size={18} color={T.blue} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.switchTitle}>Ready for a summit goal?</Text>
            <Text style={s.switchDesc}>Switch to goal mode and train for a specific mountain.</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/mode-select")} style={s.switchBtn} activeOpacity={0.8}>
            <Text style={s.switchBtnText}>Switch</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 18, gap: 18 },
  header: { gap: 4 },
  eyebrow: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.green, letterSpacing: 1.2, textTransform: "uppercase" },
  headline: { fontSize: 24, fontFamily: "Inter_700Bold", color: T.text, lineHeight: 30 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    flex: 1, minWidth: "44%",
    backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border,
    paddingVertical: 16, paddingHorizontal: 14, gap: 4,
  },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  logBtn: {
    borderRadius: 18, overflow: "hidden",
    shadowColor: T.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  logBtnGrad: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  logBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  sectionHead: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 1, textTransform: "uppercase" },
  achieveGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  switchCard: {
    backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border,
    padding: 16, flexDirection: "row", alignItems: "center", gap: 12,
  },
  switchTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },
  switchDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  switchBtn: { backgroundColor: T.blueDim, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  switchBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.blue },
});
