import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { Lock, Heart, Wind, Zap, Mountain } from "lucide-react-native";
import { T } from "@/constants/theme";
import { useReadinessV2 } from "@/hooks/useReadinessV2";
import { useSubscription } from "@/lib/revenuecat";
import { SRReadinessGauge } from "@/components/SRReadinessGauge";
import { STATUS_COPY, projection, readinessStatus } from "@/utils/readinessPresentation";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const STATUS_TONE: Record<string, string> = {
  ready: T.green, nearly: T.blue, building: T.orange, pending: T.textMuted, unavailable: T.textMuted,
};
const DIM_COLORS: Record<string, string> = {
  endurance: T.green,
  elevationCapacity: T.blue,
  consistency: T.orange,
  mountainExperience: T.purple,
};
const DIM_ICONS: Record<string, any> = {
  endurance: Heart,
  elevationCapacity: Wind,
  consistency: Zap,
  mountainExperience: Mountain,
};
const DIM_LABELS: Record<string, string> = {
  endurance: "Endurance",
  elevationCapacity: "Elevation",
  consistency: "Consistency",
  mountainExperience: "Experience",
};

function FourSegmentRing({ size = 110, strokeWidth = 10, hideScore = false, score = 0, ringColor = T.green }) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const segmentLength = circumference / 4;
  const gap = 8;
  const dashLength = segmentLength - gap;

  // Colors based on mock: Top-Right (Green), Bottom-Right (Blue), Bottom-Left (Purple), Top-Left (Orange)
  const segments = [
    { color: T.green, rotate: 0 },
    { color: T.blue, rotate: 90 },
    { color: T.purple, rotate: 180 },
    { color: T.orange, rotate: 270 },
  ];

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        {segments.map((seg, i) => (
          <Circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={0}
            transform={`rotate(${seg.rotate} ${size / 2} ${size / 2})`}
          />
        ))}
      </Svg>
      {hideScore ? (
        <View style={{ alignItems: "center", gap: 4 }}>
          <Lock size={20} color="rgba(255,255,255,0.7)" />
          <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.5 }}>
            PRO
          </Text>
          <Text style={{ fontSize: 9, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.5)", textAlign: "center", maxWidth: 60, lineHeight: 12 }}>
            Unlock your readiness score
          </Text>
        </View>
      ) : (
        <View style={{ alignItems: "center", gap: 2 }}>
          <Text style={{ fontSize: 38, fontFamily: "Inter_700Bold", color: ringColor, lineHeight: 42 }}>
            {score}
          </Text>
        </View>
      )}
    </View>
  );
}

export function ReadinessV2Hero() {
  const { isSubscribed } = useSubscription();
  const v2 = useReadinessV2();
  const reducedMotion = useReducedMotion();

  if (!v2 || !v2.result) return null;
  const { result } = v2;
  const { overallScore, dimensions } = result;

  /* A missing score is NOT zero. It stays null so the gauge shows an em dash
     and the status reads UNAVAILABLE, rather than a confident-looking 0. */
  const score = overallScore ?? null;
  const status = readinessStatus(result.state, overallScore);
  const statusColor = STATUS_TONE[status];
  /* Projected readiness only when the Readiness engine actually produced one. */
  const proj = projection(overallScore, v2.nextAction?.projectedImpact?.delta ?? null);

  return (
    <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(80).duration(500)}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(isSubscribed ? "/readiness-detail" as any : "/paywall")}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={isSubscribed ? "View detailed readiness analysis" : "Unlock readiness analysis with Pro"}
      >
        <View style={styles.topRow}>
          <View>
            {/* Training Basecamp and Full Readiness now share one gauge.
                The previous FourSegmentRing drew four fixed equal segments and
                encoded no value at all — it looked like a score and was not one.
                The Pro lock is unchanged: unsubscribed users still see the
                locked treatment rather than the figure. */}
            {isSubscribed ? (
              <SRReadinessGauge
                score={score}
                projected={proj ? proj.projected : null}
                size={110}
                strokeWidth={10}
                statusLabel={STATUS_COPY[status].label}
                tone={statusColor}
              />
            ) : (
              <FourSegmentRing size={110} hideScore score={0} ringColor={statusColor} />
            )}
          </View>
          <View style={styles.metaCol}>
            <View style={styles.titleRow}>
              <Text style={styles.areYouReadyLabel}>Readiness</Text>
              {!isSubscribed && (
                <View style={styles.proBadge}>
                  <Lock size={10} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.proBadgeText}>PRO FEATURE</Text>
                </View>
              )}
            </View>

            <Text style={styles.trackingMsg}>
              Endurance, elevation, consistency and mountain experience.
            </Text>

            {/* 4 tiny icons in a row */}
            <View style={styles.miniIconsRow}>
              {["endurance", "elevationCapacity", "consistency", "mountainExperience"].map(key => {
                const Icon = DIM_ICONS[key];
                const color = DIM_COLORS[key];
                return (
                  <View key={key} style={styles.miniIconItem}>
                    <Icon size={18} color={color} />
                    {isSubscribed && (
                      <Text style={[styles.miniIconScore, { color }]}>
                        {dimensions[key as keyof typeof dimensions]?.score ?? "—"}
                      </Text>
                    )}
                    <Text style={[styles.miniIconLabel, { color }]}>{DIM_LABELS[key]}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 0,
    marginBottom: 0,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 12,
  },
  topRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  metaCol: { flex: 1, gap: 6, justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  areYouReadyLabel: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12
  },
  proBadgeText: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.6)", letterSpacing: 0.5 },
  trackingMsg: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)", lineHeight: 18 },
  miniIconsRow: { flexDirection: "row", marginTop: 4 },
  miniIconItem: { flex: 1, minWidth: 0, alignItems: "center", gap: 2 },
  miniIconScore: { fontSize: 11, fontFamily: "Inter_700Bold", lineHeight: 13 },
  miniIconLabel: { fontSize: 8, fontFamily: "Inter_500Medium", textAlign: "center" },
});
