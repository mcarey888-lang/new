import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Dimensions,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const { width } = Dimensions.get("window");

const MOCK_HILLS = [
  { name: "Indian's Head", distance: 4.2, elevation: 280, repeats: 3, totalElevation: 840, grade: "Moderate", surface: "Grassy moorland" },
  { name: "Beacon Hill", distance: 6.8, elevation: 195, repeats: 4, totalElevation: 780, grade: "Easy–Moderate", surface: "Mixed trail" },
  { name: "Black Mountain Ridge", distance: 9.1, elevation: 420, repeats: 2, totalElevation: 840, grade: "Hard", surface: "Rocky path" },
  { name: "Crow Tor", distance: 12.5, elevation: 350, repeats: 2, totalElevation: 700, grade: "Moderate", surface: "Moorland" },
  { name: "Stony Edge", distance: 15.0, elevation: 520, repeats: 1, totalElevation: 520, grade: "Hard", surface: "Scree + rocky" },
  { name: "Grey Crag", distance: 18.3, elevation: 680, repeats: 1, totalElevation: 680, grade: "Alpine", surface: "Technical scramble" },
];

const GRADE_COLORS: Record<string, string> = {
  "Easy–Moderate": "#4CAF74",
  Moderate: "#3B9CF5",
  Hard: "#F2994A",
  Alpine: "#E53E3E",
};

function HillCard({ hill, targetElevation }: {
  hill: typeof MOCK_HILLS[0];
  targetElevation: number;
}) {
  const colors = useColors();
  const gradeColor = GRADE_COLORS[hill.grade] ?? colors.primary;
  const coversPct = Math.min(100, Math.round((hill.totalElevation / targetElevation) * 100));

  return (
    <View style={[styles.hillCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.hillTop}>
        <View>
          <Text style={[styles.hillName, { color: colors.foreground }]}>{hill.name}</Text>
          <Text style={[styles.hillSurface, { color: colors.mutedForeground }]}>{hill.surface}</Text>
        </View>
        <View style={[styles.gradeBadge, { backgroundColor: gradeColor + "20" }]}>
          <Text style={[styles.gradeText, { color: gradeColor }]}>{hill.grade}</Text>
        </View>
      </View>

      <View style={styles.hillStats}>
        <View style={styles.hillStat}>
          <Feather name="map-pin" size={13} color={colors.primary} />
          <Text style={[styles.hillStatText, { color: colors.secondaryForeground }]}>{hill.distance}km away</Text>
        </View>
        <View style={styles.hillStat}>
          <Feather name="trending-up" size={13} color={colors.accent} />
          <Text style={[styles.hillStatText, { color: colors.secondaryForeground }]}>{hill.elevation}m per climb</Text>
        </View>
        <View style={styles.hillStat}>
          <Feather name="repeat" size={13} color={colors.mutedForeground} />
          <Text style={[styles.hillStatText, { color: colors.secondaryForeground }]}>{hill.repeats}x repeats</Text>
        </View>
      </View>

      <View style={[styles.sessionBox, { backgroundColor: colors.surfaceElevated }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sessionBoxTitle, { color: colors.foreground }]}>
            {hill.repeats}× repeats = {hill.totalElevation}m total
          </Text>
          <View style={styles.coverRow}>
            <View style={[styles.coverBg, { backgroundColor: colors.border }]}>
              <View style={[styles.coverFill, { width: `${coversPct}%` as any, backgroundColor: coversPct >= 80 ? colors.primary : colors.accent }]} />
            </View>
            <Text style={[styles.coverPct, { color: coversPct >= 80 ? colors.primary : colors.accent }]}>
              {coversPct}% of target
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.useInPlanBtn, { borderColor: colors.primary + "60" }]}
        activeOpacity={0.7}
        onPress={() => {
          const query = encodeURIComponent(hill.name + " hill");
          const url = `https://www.openstreetmap.org/search?query=${query}`;
          Linking.openURL(url);
        }}
      >
        <Feather name="map" size={14} color={colors.primary} />
        <Text style={[styles.useInPlanText, { color: colors.primary }]}>View on map</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function HillsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { summitGoal, trainingPlan } = useApp();

  const targetElevation = summitGoal?.elevationGain ?? 1000;
  const currentWeek = trainingPlan.find(w => {
    const today = new Date();
    return new Date(w.startDate) <= today && new Date(w.endDate) >= today;
  });
  const weekTarget = currentWeek?.targetElevation ?? Math.round(targetElevation * 0.5);

  const hills = summitGoal ? MOCK_HILLS.map((h, i) => ({
    ...h,
    distance: Math.round((h.distance + (summitGoal.location.length % 5)) * 10) / 10,
  })) : MOCK_HILLS;

  return (
    <LinearGradient colors={["#050C18", "#0B1120"]} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Platform.OS === "web" ? 80 : insets.top + 12,
            paddingBottom: Platform.OS === "web" ? 50 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Nearby Hills</Text>
          {summitGoal && (
            <View style={[styles.radiusBadge, { backgroundColor: colors.surface }]}>
              <Feather name="radio" size={12} color={colors.primary} />
              <Text style={[styles.radiusText, { color: colors.mutedForeground }]}>
                {summitGoal.maxRadius}km radius
              </Text>
            </View>
          )}
        </View>

        {summitGoal && (
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="info" size={16} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoTitle, { color: colors.foreground }]}>
                Near {summitGoal.location}
              </Text>
              <Text style={[styles.infoSubtitle, { color: colors.mutedForeground }]}>
                This week's elevation target: {weekTarget}m · Summit goal: {targetElevation}m
              </Text>
            </View>
          </View>
        )}

        <View style={[styles.mockNote, { backgroundColor: colors.warning + "15", borderColor: colors.warning + "40" }]}>
          <Feather name="zap" size={13} color={colors.warning} />
          <Text style={[styles.mockNoteText, { color: colors.warning }]}>
            Demo data · Future versions will use OpenStreetMap & real elevation APIs
          </Text>
        </View>

        {hills.map((hill, i) => (
          <HillCard key={i} hill={hill} targetElevation={targetElevation} />
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  radiusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  radiusText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  infoTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  infoSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  mockNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  mockNoteText: { flex: 1, fontSize: 11, fontFamily: "Inter_500Medium" },
  hillCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  hillTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hillName: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 2 },
  hillSurface: { fontSize: 12, fontFamily: "Inter_400Regular" },
  gradeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  gradeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  hillStats: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  hillStat: { flexDirection: "row", alignItems: "center", gap: 5 },
  hillStatText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  sessionBox: { borderRadius: 12, padding: 12 },
  sessionBoxTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  coverRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  coverBg: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  coverFill: { height: 6, borderRadius: 3 },
  coverPct: { fontSize: 12, fontFamily: "Inter_600SemiBold", width: 80, textAlign: "right" },
  useInPlanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  useInPlanText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
