import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TrainingWeek, useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { getCurrentWeek } from "@/utils/planGenerator";

const { width } = Dimensions.get("window");

const PHASE_COLORS: Record<string, string> = {
  Accelerated: "#E53E3E",
  Base: "#4CAF74",
  Build: "#3B9CF5",
  Peak: "#F2994A",
  Taper: "#9B7FD4",
};

function WeekCard({ week, isExpanded, onToggle }: { week: TrainingWeek; isExpanded: boolean; onToggle: () => void }) {
  const colors = useColors();
  const phaseColor = PHASE_COLORS[week.phase] ?? colors.primary;

  const getBadgeStyle = () => {
    if (week.isPeakWeek) return { bg: "#F2994A20", text: "#F2994A", label: "Peak Week" };
    if (week.isTaperWeek) return { bg: "#9B7FD420", text: "#9B7FD4", label: "Taper Week" };
    return null;
  };
  const badge = getBadgeStyle();

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.8}
      style={[
        styles.weekCard,
        {
          backgroundColor: colors.card,
          borderColor: week.isCurrentWeek ? phaseColor + "60" : colors.border,
          borderWidth: week.isCurrentWeek ? 1.5 : 1,
        },
      ]}
    >
      {week.isCurrentWeek && (
        <View style={[styles.currentBanner, { backgroundColor: phaseColor }]}>
          <Text style={styles.currentBannerText}>CURRENT WEEK</Text>
        </View>
      )}

      <View style={styles.weekHeader}>
        <View style={styles.weekLeft}>
          <View style={[styles.phaseDot, { backgroundColor: phaseColor }]} />
          <View>
            <Text style={[styles.weekNum, { color: colors.foreground }]}>Week {week.weekNumber}</Text>
            <Text style={[styles.weekDates, { color: colors.mutedForeground }]}>
              {new Date(week.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
              {new Date(week.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </Text>
          </View>
        </View>
        <View style={styles.weekRight}>
          <View style={[styles.phasePill, { backgroundColor: phaseColor + "20" }]}>
            <Text style={[styles.phaseText, { color: phaseColor }]}>{week.phase}</Text>
          </View>
          {badge && (
            <View style={[styles.badgePill, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
            </View>
          )}
          <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
        </View>
      </View>

      <View style={styles.weekSummary}>
        <View style={[styles.elevChip, { backgroundColor: colors.surfaceElevated }]}>
          <Feather name="trending-up" size={13} color={colors.accent} />
          <Text style={[styles.elevText, { color: colors.accent }]}>{week.targetElevation}m</Text>
        </View>
        <Text style={[styles.purposeText, { color: colors.mutedForeground }]} numberOfLines={isExpanded ? undefined : 1}>
          {week.purpose}
        </Text>
      </View>

      {isExpanded && (
        <View style={styles.expandedContent}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Sessions</Text>
          {week.sessions.map((session, i) => (
            <View key={i} style={[styles.sessionRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <View style={[styles.sessionIconWrap, { backgroundColor: session.type === "bigDay" ? colors.accent + "20" : colors.primary + "20" }]}>
                <Feather
                  name={session.type === "cardio" ? "heart" : session.type === "hill" ? "trending-up" : "flag"}
                  size={15}
                  color={session.type === "bigDay" ? colors.accent : colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.sessionLabelRow}>
                  <Text style={[styles.sessionLabel, { color: colors.foreground }]}>{session.label}</Text>
                  <Text style={[styles.sessionDuration, { color: colors.mutedForeground }]}>{session.duration}</Text>
                </View>
                <Text style={[styles.sessionDesc, { color: colors.mutedForeground }]}>{session.description}</Text>
                <Text style={[styles.sessionElev, { color: colors.accent }]}>~{session.targetElevation}m gain</Text>
              </View>
            </View>
          ))}

          <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: 12 }]}>Suggested Hills</Text>
          {week.hills.slice(0, 2).map((hill, i) => (
            <View key={i} style={[styles.hillRow, { backgroundColor: colors.surfaceElevated }]}>
              <Feather name="map-pin" size={14} color={colors.primary} />
              <Text style={[styles.hillText, { color: colors.secondaryForeground }]}>
                {hill.name} – {hill.elevation}m × {hill.repeats} repeats = ~{hill.totalElevation}m
              </Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function PlanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { summitGoal, trainingPlan } = useApp();
  const currentWeek = getCurrentWeek(trainingPlan);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(
    new Set(currentWeek ? [currentWeek.weekNumber] : [])
  );

  function toggleWeek(n: number) {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  if (!summitGoal || trainingPlan.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Feather name="calendar" size={40} color={colors.primary} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No plan yet</Text>
        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/setup")}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Set up my summit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalWeeks = trainingPlan.length;
  const weeksRemaining = trainingPlan.filter(w => new Date(w.endDate) >= new Date()).length;

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
        <View style={styles.planHeader}>
          <Text style={[styles.planTitle, { color: colors.foreground }]}>Training Plan</Text>
          <View style={styles.planMeta}>
            <Text style={[styles.planMetaText, { color: colors.mutedForeground }]}>
              {totalWeeks} weeks · {weeksRemaining} remaining
            </Text>
          </View>
        </View>

        <View style={styles.phaseLegend}>
          {Object.entries(PHASE_COLORS).map(([phase, color]) => (
            <View key={phase} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={[styles.legendText, { color: colors.mutedForeground }]}>{phase}</Text>
            </View>
          ))}
        </View>

        {trainingPlan.map(week => (
          <WeekCard
            key={week.weekNumber}
            week={week}
            isExpanded={expandedWeeks.has(week.weekNumber)}
            onToggle={() => toggleWeek(week.weekNumber)}
          />
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  createBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  scroll: { paddingHorizontal: 16 },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  planTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  planMeta: {},
  planMetaText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  phaseLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  weekCard: {
    borderRadius: 18,
    marginBottom: 10,
    overflow: "hidden",
    padding: 16,
  },
  currentBanner: {
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 12,
    paddingVertical: 4,
    alignItems: "center",
  },
  currentBannerText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 1.5,
  },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  weekLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  phaseDot: { width: 10, height: 10, borderRadius: 5 },
  weekNum: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  weekDates: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  weekRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  phasePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  phaseText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  badgePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  weekSummary: { flexDirection: "row", alignItems: "center", gap: 8 },
  elevChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  elevText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  purposeText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  expandedContent: { marginTop: 8 },
  divider: { height: 1, marginVertical: 10 },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 },
  sessionRow: {
    flexDirection: "row",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
    alignItems: "flex-start",
  },
  sessionIconWrap: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  sessionLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  sessionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sessionDuration: { fontSize: 11, fontFamily: "Inter_400Regular" },
  sessionDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16, marginBottom: 2 },
  sessionElev: { fontSize: 11, fontFamily: "Inter_500Medium" },
  hillRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 8,
    borderRadius: 10,
    marginBottom: 5,
  },
  hillText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
});
