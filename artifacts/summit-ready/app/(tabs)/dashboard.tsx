import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
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
import {
  calculateReadiness,
  getDaysRemaining,
  getReadinessStatus,
  getWeeklyCompletion,
} from "@/utils/readinessScore";
import { getCurrentWeek } from "@/utils/planGenerator";

const { width } = Dimensions.get("window");

function RadialProgress({ score, size = 140 }: { score: number; size?: number }) {
  const colors = useColors();
  const animVal = useRef(new Animated.Value(0)).current;
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const status = getReadinessStatus(score);

  useEffect(() => {
    Animated.timing(animVal, {
      toValue: score,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const strokeDashoffset = animVal.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          position: "absolute",
          width: size - 20,
          height: size - 20,
          borderRadius: (size - 20) / 2,
          borderWidth: 10,
          borderColor: colors.border,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: size - 20,
          height: size - 20,
          borderRadius: (size - 20) / 2,
          borderWidth: 10,
          borderColor: status.color,
          borderTopColor: "transparent",
          borderRightColor: score > 25 ? status.color : "transparent",
          borderBottomColor: score > 50 ? status.color : "transparent",
          borderLeftColor: score > 75 ? status.color : "transparent",
          transform: [{ rotate: "-90deg" }],
        }}
      />
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 32, fontFamily: "Inter_700Bold", color: status.color }}>
          {score}
        </Text>
        <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
          READINESS
        </Text>
      </View>
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  unit,
  color,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string | number;
  unit?: string;
  color: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {value}
        {unit && <Text style={[styles.statUnit, { color: colors.mutedForeground }]}> {unit}</Text>}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { summitGoal, trainingPlan, sessions, readinessScore } = useApp();

  if (!summitGoal) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Feather name="compass" size={40} color={colors.primary} />
        <Text style={[styles.emptyText, { color: colors.foreground }]}>No plan yet</Text>
        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/setup")}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Create my plan</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status = getReadinessStatus(readinessScore);
  const daysRemaining = getDaysRemaining(summitGoal.summitDate);
  const currentWeek = getCurrentWeek(trainingPlan);
  const weekCompletion = currentWeek ? getWeeklyCompletion(sessions, currentWeek.weekNumber) : 0;
  const maxElevAchieved = sessions.filter(s => s.completed).reduce((max, s) => Math.max(max, s.elevationGain), 0);
  const totalSessions = sessions.filter(s => s.completed).length;

  const trackingMessage =
    readinessScore >= 70 ? "You are on track" :
    readinessScore >= 40 ? "Getting closer" :
    "Behind — train more";

  return (
    <LinearGradient colors={["#050C18", "#0B1120", "#0B1120"]} style={{ flex: 1 }}>
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
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Training for</Text>
            <Text style={[styles.mountain, { color: colors.foreground }]} numberOfLines={1}>
              {summitGoal.mountainName}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.editBtn, { backgroundColor: colors.surface }]}
            onPress={() => router.push("/setup")}
          >
            <Feather name="edit-2" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Readiness Card */}
        <View style={[styles.readinessCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.readinessLeft}>
            <RadialProgress score={readinessScore} size={120} />
          </View>
          <View style={styles.readinessRight}>
            <View style={[styles.statusBadge, { backgroundColor: status.color + "25" }]}>
              <View style={[styles.dot, { backgroundColor: status.color }]} />
              <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
            </View>
            <Text style={[styles.trackingMsg, { color: colors.foreground }]}>{trackingMessage}</Text>
            <Text style={[styles.daysLeft, { color: colors.mutedForeground }]}>
              {daysRemaining > 0 ? `${daysRemaining} days to go` : "Summit day!"}
            </Text>
          </View>
        </View>

        {/* Warning for < 4 weeks */}
        {daysRemaining < 28 && daysRemaining > 0 && (
          <View style={[styles.warning, { backgroundColor: colors.warning + "20", borderColor: colors.warning + "50" }]}>
            <Feather name="alert-triangle" size={16} color={colors.warning} />
            <Text style={[styles.warningText, { color: colors.warning }]}>
              Limited preparation time – prioritise key sessions
            </Text>
          </View>
        )}

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard icon="calendar" label="Days Remaining" value={daysRemaining} color={colors.primary} />
          <StatCard icon="trending-up" label="Max Ascent" value={maxElevAchieved} unit="m" color={colors.accent} />
          <StatCard icon="check-circle" label="Sessions Done" value={totalSessions} color={colors.primary} />
          <StatCard icon="percent" label="This Week" value={weekCompletion} unit="%" color={colors.accent} />
        </View>

        {/* Current Week */}
        {currentWeek && (
          <View style={[styles.currentWeekCard, { backgroundColor: colors.card, borderColor: colors.primary + "40" }]}>
            <View style={styles.cwHeader}>
              <View style={[styles.cwBadge, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[styles.cwBadgeText, { color: colors.primary }]}>
                  Week {currentWeek.weekNumber} · {currentWeek.phase}
                </Text>
              </View>
              <Text style={[styles.cwTarget, { color: colors.accent }]}>
                {currentWeek.targetElevation}m target
              </Text>
            </View>
            <Text style={[styles.cwPurpose, { color: colors.foreground }]}>{currentWeek.purpose}</Text>
            <View style={styles.progressRow}>
              <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
                <View
                  style={[styles.progressFill, { width: `${weekCompletion}%` as any, backgroundColor: colors.primary }]}
                />
              </View>
              <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>{weekCompletion}%</Text>
            </View>
            <View style={styles.sessionTypes}>
              {currentWeek.sessions.map((s, i) => (
                <View key={i} style={[styles.sessionChip, { backgroundColor: colors.surfaceElevated }]}>
                  <Feather
                    name={s.type === "cardio" ? "heart" : s.type === "hill" ? "trending-up" : "flag"}
                    size={12}
                    color={s.type === "bigDay" ? colors.accent : colors.primary}
                  />
                  <Text style={[styles.sessionChipText, { color: colors.secondaryForeground }]}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(tabs)/log")}
            activeOpacity={0.85}
          >
            <Feather name="plus-circle" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Log session</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => router.push("/(tabs)/plan")}
            activeOpacity={0.85}
          >
            <Feather name="calendar" size={18} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.foreground }]}>View plan</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  emptyText: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  createBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  scroll: { paddingHorizontal: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  greeting: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 2 },
  mountain: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff", maxWidth: 260 },
  editBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  readinessCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  readinessLeft: { marginRight: 20 },
  readinessRight: { flex: 1, gap: 8 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  trackingMsg: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  daysLeft: { fontSize: 13, fontFamily: "Inter_400Regular" },
  warning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  warningText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    width: (width - 42) / 2,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statUnit: { fontSize: 14 },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  currentWeekCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    gap: 10,
  },
  cwHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cwBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  cwBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  cwTarget: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cwPurpose: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressBg: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  progressLabel: { fontSize: 12, fontFamily: "Inter_500Medium", width: 32, textAlign: "right" },
  sessionTypes: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  sessionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  sessionChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  quickActions: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
