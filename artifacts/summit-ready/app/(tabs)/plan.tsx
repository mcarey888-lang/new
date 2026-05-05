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
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TrainingWeek, useApp } from "@/context/AppContext";
import { T, PHASE_COLOR } from "@/constants/theme";
import { getCurrentWeek } from "@/utils/planGenerator";

const { width } = Dimensions.get("window");

function WeekCard({ week, isExpanded, onToggle, index }: {
  week: TrainingWeek;
  isExpanded: boolean;
  onToggle: () => void;
  index: number;
}) {
  const pc = PHASE_COLOR[week.phase] ?? T.green;

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(400)}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.8}
        style={[
          styles.weekCard,
          week.isCurrentWeek && { borderColor: pc + "60", borderWidth: 1.5 },
        ]}
      >
        {week.isCurrentWeek && (
          <View style={[styles.currentBanner, { backgroundColor: pc }]}>
            <Text style={styles.currentBannerText}>● CURRENT WEEK</Text>
          </View>
        )}

        <LinearGradient
          colors={[pc + "08", "transparent"]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <View style={[styles.weekNumBadge, { backgroundColor: pc + "20" }]}>
              <Text style={[styles.weekNumText, { color: pc }]}>{week.weekNumber}</Text>
            </View>
            <View>
              <Text style={styles.phaseName}>{week.phase} Phase</Text>
              <Text style={styles.weekDates}>
                {new Date(week.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
                {new Date(week.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </Text>
            </View>
          </View>
          <View style={styles.cardRight}>
            {week.isPeakWeek && (
              <View style={[styles.weekBadge, { backgroundColor: T.orangeDim }]}>
                <Text style={[styles.weekBadgeText, { color: T.orange }]}>PEAK</Text>
              </View>
            )}
            {week.isTaperWeek && (
              <View style={[styles.weekBadge, { backgroundColor: T.purpleDim }]}>
                <Text style={[styles.weekBadgeText, { color: T.purple }]}>TAPER</Text>
              </View>
            )}
            <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={T.textMuted} />
          </View>
        </View>

        <View style={styles.cardMeta}>
          <View style={[styles.elevChip, { backgroundColor: T.orangeDim }]}>
            <Feather name="trending-up" size={12} color={T.orange} />
            <Text style={[styles.elevText, { color: T.orange }]}>{week.targetElevation}m</Text>
          </View>
          <Text style={styles.purposeSnippet} numberOfLines={isExpanded ? undefined : 1}>
            {week.purpose}
          </Text>
        </View>

        {isExpanded && (
          <View style={styles.expanded}>
            <View style={[styles.divider, { backgroundColor: pc + "30" }]} />

            <Text style={styles.sectionHead}>SESSIONS</Text>
            {week.sessions.map((s, i) => (
              <View key={i} style={styles.sessionRow}>
                <View style={[
                  styles.sessionIcon,
                  { backgroundColor: s.type === "bigDay" ? T.orangeDim : T.greenDim },
                ]}>
                  <Feather
                    name={s.type === "cardio" ? "heart" : s.type === "hill" ? "trending-up" : "flag"}
                    size={14}
                    color={s.type === "bigDay" ? T.orange : T.green}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={styles.sessionLabel}>{s.label}</Text>
                    <Text style={styles.sessionDur}>{s.duration}</Text>
                  </View>
                  <Text style={styles.sessionDesc}>{s.description}</Text>
                  <Text style={[styles.sessionElev, { color: T.orange }]}>~{s.targetElevation}m gain</Text>
                </View>
              </View>
            ))}

            {week.hills.slice(0, 2).length > 0 && (
              <>
                <Text style={[styles.sectionHead, { marginTop: 14 }]}>SUGGESTED HILLS</Text>
                {week.hills.slice(0, 2).map((h, i) => (
                  <View key={i} style={styles.hillRow}>
                    <Feather name="map-pin" size={13} color={T.green} />
                    <Text style={styles.hillRowText}>
                      {h.name} – {h.elevation}m × {h.repeats} = ~{h.totalElevation}m total
                    </Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const { summitGoal, trainingPlan } = useApp();
  const currentWeek = getCurrentWeek(trainingPlan);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(
    new Set(currentWeek ? [currentWeek.weekNumber] : [])
  );

  function toggle(n: number) {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  if (!summitGoal || trainingPlan.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center" }}>
          <Feather name="calendar" size={28} color={T.blue} />
        </View>
        <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: T.white }}>No plan yet</Text>
        <TouchableOpacity
          onPress={() => router.push("/setup")}
          style={{ paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14, backgroundColor: T.green }}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Set up my summit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalWeeks = trainingPlan.length;
  const weeksLeft = trainingPlan.filter(w => new Date(w.endDate) >= new Date()).length;
  const phases = [...new Set(trainingPlan.map(w => w.phase))];

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
        <Animated.View entering={FadeInDown.delay(0).duration(500)} style={styles.header}>
          <View>
            <Text style={styles.title}>Training Plan</Text>
            <Text style={styles.subtitle}>{totalWeeks} weeks · {weeksLeft} remaining</Text>
          </View>
        </Animated.View>

        {/* Phase Legend */}
        <Animated.View entering={FadeInDown.delay(60).duration(400)}>
          <View style={styles.phaseBar}>
            {phases.map(phase => (
              <View key={phase} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: PHASE_COLOR[phase] }]} />
                <Text style={styles.legendText}>{phase}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {trainingPlan.map((week, i) => (
          <WeekCard
            key={week.weekNumber}
            week={week}
            isExpanded={expandedWeeks.has(week.weekNumber)}
            onToggle={() => toggle(week.weekNumber)}
            index={i}
          />
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 14,
  },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.white },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },
  phaseBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
    backgroundColor: T.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.cardBorder,
    padding: 12,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontFamily: "Inter_500Medium", color: T.textMuted },
  weekCard: {
    backgroundColor: T.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.cardBorder,
    marginBottom: 10,
    overflow: "hidden",
    padding: 16,
  },
  currentBanner: {
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 14,
    paddingVertical: 5,
    alignItems: "center",
  },
  currentBannerText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1.5 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  weekNumBadge: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  weekNumText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  phaseName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.white },
  weekDates: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  cardRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  weekBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  weekBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  elevChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  elevText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  purposeSnippet: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18 },
  expanded: {},
  divider: { height: 1, marginVertical: 12 },
  sectionHead: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 1.5, marginBottom: 10, textTransform: "uppercase" },
  sessionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
    backgroundColor: T.surface,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "flex-start",
  },
  sessionIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  sessionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.white },
  sessionDur: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  sessionDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 15, marginTop: 2 },
  sessionElev: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 3 },
  hillRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 9,
    borderRadius: 10,
    backgroundColor: T.surface,
    marginBottom: 5,
  },
  hillRowText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: T.text, lineHeight: 17 },
});
