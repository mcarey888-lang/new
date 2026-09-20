import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Mountain, ChevronRight, Lock, CheckCircle2, AlertCircle } from "lucide-react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { T } from "@/constants/theme";

import type { RankName, RankRequirementResult } from "@/utils/rankDomain";

export interface RankExperienceProps {
  currentRank: RankName | null;
  nextRank: RankName | null;
  overallProgress: number; // 0.0 to 1.0
  requirements: readonly RankRequirementResult[];
  promotionBlocked?: boolean;
  blockedReasons?: readonly string[];
  onPressJourney?: () => void;
  primaryColor?: string;
}

export function RankExperience({
  currentRank,
  nextRank,
  overallProgress,
  requirements,
  promotionBlocked = false,
  blockedReasons = [],
  onPressJourney,
  primaryColor = T.blue,
}: RankExperienceProps) {
  return (
    <Animated.View entering={FadeIn.delay(50).duration(400)} style={styles.container}>
      <LinearGradient
        colors={[primaryColor + "15", "transparent"]}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Header / Identity */}
      <View style={styles.header}>
        <View style={styles.identity}>
          <Text style={styles.rankEyebrow}>CURRENT RANK</Text>
          <Text style={styles.rankTitle}>{currentRank ?? "Evidence building"}</Text>
          {!currentRank && (
            <Text style={styles.rankContext}>Rank begins when verified outdoor evidence is available.</Text>
          )}
        </View>
        <View style={[styles.badgeWrap, { borderColor: primaryColor + "50" }]}>
          <View style={[styles.badgeInner, { backgroundColor: primaryColor + "20" }]}>
            <Mountain size={20} color={primaryColor} />
          </View>
        </View>
      </View>

      {/* Progress Visualization */}
      {nextRank && (
        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Progress to {nextRank}</Text>
            <Text style={styles.progressValue}>{Math.round(overallProgress * 100)}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${overallProgress * 100}%`, backgroundColor: primaryColor },
              ]}
            />
          </View>
        </View>
      )}

      {promotionBlocked && (
        <View style={styles.blockedNotice}>
          <AlertCircle size={16} color={T.orange} />
          <Text style={styles.blockedText}>
            {blockedReasons[0] ?? "Verified evidence is not available for every requirement yet."}
          </Text>
        </View>
      )}

      {/* Requirements */}
      {requirements.length > 0 && (
        <View style={styles.requirementsBox}>
          {requirements.map((req, i) => (
            <View
              key={req.signal}
              style={[
                styles.reqRow,
                i === requirements.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              {req.status === "met" ? (
                <CheckCircle2 size={16} color={T.green} />
              ) : req.status === "unavailable" || req.status === "degraded" ? (
                <AlertCircle size={16} color={T.orange} />
              ) : (
                <Lock size={16} color={T.textMuted} />
              )}
              <View style={styles.reqTextWrap}>
                <Text style={styles.reqLabel}>{req.label}</Text>
                <Text style={styles.reqMeta}>
                  {req.value === null
                    ? req.status === "degraded" ? "Evidence degraded" : "Evidence unavailable"
                    : `${req.value.toLocaleString()} / ${req.minimum.toLocaleString()}`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Journey CTA */}
      {onPressJourney && (
        <TouchableOpacity
          style={styles.journeyBtn}
          onPress={onPressJourney}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="View SummitReady rank journey"
        >
          <Text style={styles.journeyBtnText}>View Rank Journey</Text>
          <ChevronRight size={16} color={T.textDim} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  identity: {
    flex: 1,
  },
  rankEyebrow: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: T.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  rankTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: T.white,
  },
  rankContext: {
    marginTop: 4,
    maxWidth: 250,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
  },
  badgeWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  badgeInner: {
    flex: 1,
    width: "100%",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  progressSection: {
    marginBottom: 16,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: T.text,
  },
  progressValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: T.text,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  requirementsBox: {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  blockedNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 14,
    padding: 10,
    borderRadius: 10,
    backgroundColor: T.orange + "12",
    borderWidth: 1,
    borderColor: T.orange + "30",
  },
  blockedText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
  },
  reqRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    gap: 12,
  },
  reqTextWrap: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reqLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: T.text,
  },
  reqMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
  },
  journeyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  journeyBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: T.textMuted,
  },
});
