import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Linking } from "react-native";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";

const HILLS = [
  { name: "Indian's Head", km: 4.2, elev: 280, repeats: 3, grade: "Moderate", surface: "Grassy moorland", icon: "🏔️" },
  { name: "Beacon Hill", km: 6.8, elev: 195, repeats: 4, grade: "Easy–Mod", surface: "Mixed trail", icon: "⛰️" },
  { name: "Black Mountain Ridge", km: 9.1, elev: 420, repeats: 2, grade: "Hard", surface: "Rocky path", icon: "🗻" },
  { name: "Crow Tor", km: 12.5, elev: 350, repeats: 2, grade: "Moderate", surface: "Moorland", icon: "⛰️" },
  { name: "Stony Edge", km: 15.0, elev: 520, repeats: 1, grade: "Hard", surface: "Scree + rock", icon: "🏔️" },
  { name: "Grey Crag", km: 18.3, elev: 680, repeats: 1, grade: "Alpine", surface: "Technical scramble", icon: "🗻" },
];

const GRADE_COLOR: Record<string, string> = {
  "Easy–Mod": T.green,
  Moderate: T.blue,
  Hard: T.orange,
  Alpine: "#FF4444",
};

export default function HillsScreen() {
  const insets = useSafeAreaInsets();
  const { summitGoal, trainingPlan } = useApp();
  const targetElev = summitGoal?.elevationGain ?? 1000;

  const currentWeek = trainingPlan.find(w => {
    const now = new Date();
    return new Date(w.startDate) <= now && new Date(w.endDate) >= now;
  });
  const weekTarget = currentWeek?.targetElevation ?? Math.round(targetElev * 0.5);

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Platform.OS === "web" ? 56 : insets.top + 16,
            paddingBottom: Platform.OS === "web" ? 50 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <View>
            <Text style={styles.title}>Nearby Hills</Text>
            {summitGoal && (
              <Text style={styles.subtitle}>Near {summitGoal.location} · {summitGoal.maxRadius}km radius</Text>
            )}
          </View>
          <View style={[styles.radiusBadge, { backgroundColor: T.greenDim }]}>
            <Feather name="radio" size={12} color={T.green} />
            <Text style={[styles.radiusText, { color: T.green }]}>
              {summitGoal?.maxRadius ?? 30}km
            </Text>
          </View>
        </Animated.View>

        {/* Target Context Card */}
        <Animated.View entering={FadeInDown.delay(60).duration(400)}>
          <View style={styles.ctxCard}>
            <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
            <View style={styles.ctxRow}>
              <View style={styles.ctxItem}>
                <Text style={styles.ctxVal}>{weekTarget}m</Text>
                <Text style={styles.ctxLbl}>This week target</Text>
              </View>
              <View style={styles.ctxDivider} />
              <View style={styles.ctxItem}>
                <Text style={styles.ctxVal}>{targetElev}m</Text>
                <Text style={styles.ctxLbl}>Summit goal</Text>
              </View>
              <View style={styles.ctxDivider} />
              <View style={styles.ctxItem}>
                <Text style={styles.ctxVal}>{HILLS.length}</Text>
                <Text style={styles.ctxLbl}>Hills found</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Mock data notice */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <View style={styles.mockBanner}>
            <Feather name="zap" size={12} color={T.orange} />
            <Text style={styles.mockText}>
              Demo data — real integration with OpenStreetMap & elevation APIs coming
            </Text>
          </View>
        </Animated.View>

        {/* Hill Cards */}
        {HILLS.map((hill, i) => {
          const total = hill.elev * hill.repeats;
          const pct = Math.min(100, Math.round((total / weekTarget) * 100));
          const gc = GRADE_COLOR[hill.grade] ?? T.blue;

          return (
            <Animated.View key={i} entering={FadeInDown.delay(120 + i * 60).duration(400)}>
              <View style={styles.hillCard}>
                <LinearGradient
                  colors={[gc + "08", "transparent"]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.hillTop}>
                  <View style={[styles.hillIconBox, { backgroundColor: gc + "18" }]}>
                    <Text style={styles.hillEmoji}>{hill.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hillName}>{hill.name}</Text>
                    <Text style={styles.hillSurface}>{hill.surface}</Text>
                  </View>
                  <View style={[styles.gradeBadge, { backgroundColor: gc + "20" }]}>
                    <Text style={[styles.gradeText, { color: gc }]}>{hill.grade}</Text>
                  </View>
                </View>

                <View style={styles.hillStats}>
                  <View style={styles.hillStat}>
                    <Feather name="map-pin" size={12} color={T.green} />
                    <Text style={styles.hillStatVal}>{hill.km}km</Text>
                    <Text style={styles.hillStatLbl}>away</Text>
                  </View>
                  <View style={styles.hillStat}>
                    <Feather name="trending-up" size={12} color={T.orange} />
                    <Text style={styles.hillStatVal}>{hill.elev}m</Text>
                    <Text style={styles.hillStatLbl}>per climb</Text>
                  </View>
                  <View style={styles.hillStat}>
                    <Feather name="repeat" size={12} color={T.textMuted} />
                    <Text style={styles.hillStatVal}>{hill.repeats}×</Text>
                    <Text style={styles.hillStatLbl}>repeats</Text>
                  </View>
                </View>

                <View style={styles.repeatBox}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={styles.repeatTitle}>
                      {hill.repeats}× repeats = {total}m total elevation
                    </Text>
                    <Text style={[styles.pctText, { color: pct >= 80 ? T.green : T.orange }]}>{pct}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${pct}%` as any, backgroundColor: pct >= 80 ? T.green : T.orange },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressCaption}>of this week's elevation target</Text>
                </View>

                <TouchableOpacity
                  style={styles.mapBtn}
                  activeOpacity={0.7}
                  onPress={() => Linking.openURL(`https://www.openstreetmap.org/search?query=${encodeURIComponent(hill.name)}`)}
                >
                  <Feather name="map" size={14} color={T.green} />
                  <Text style={styles.mapBtnText}>View on map</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.white },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },
  radiusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  radiusText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  ctxCard: {
    backgroundColor: T.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.green + "30",
    overflow: "hidden",
    marginBottom: 10,
  },
  ctxRow: { flexDirection: "row", paddingVertical: 14 },
  ctxItem: { flex: 1, alignItems: "center", gap: 3 },
  ctxVal: { fontSize: 19, fontFamily: "Inter_700Bold", color: T.white },
  ctxLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" },
  ctxDivider: { width: 1, backgroundColor: T.border, marginVertical: 4 },
  mockBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: T.orangeDim,
    borderWidth: 1,
    borderColor: T.orange + "30",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  mockText: { flex: 1, fontSize: 11, fontFamily: "Inter_500Medium", color: T.orange },
  hillCard: {
    backgroundColor: T.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.cardBorder,
    padding: 16,
    marginBottom: 12,
    overflow: "hidden",
    gap: 12,
  },
  hillTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  hillIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  hillEmoji: { fontSize: 22 },
  hillName: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 2 },
  hillSurface: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  gradeBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 },
  gradeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  hillStats: { flexDirection: "row", gap: 16 },
  hillStat: { flexDirection: "row", alignItems: "center", gap: 5 },
  hillStatVal: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white },
  hillStatLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  repeatBox: {
    backgroundColor: T.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: T.border,
  },
  repeatTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.text },
  pctText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  progressTrack: { height: 6, backgroundColor: T.border, borderRadius: 3, overflow: "hidden", marginBottom: 5 },
  progressFill: { height: 6, borderRadius: 3 },
  progressCaption: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  mapBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.green + "40",
  },
  mapBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.green },
});
