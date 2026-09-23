/**
 * SRReadinessGauge — the approved Readiness ring.
 *
 * Geometry comes from `utils/readinessGauge.ts`, which fixes the mapping
 * (0 = 12 o'clock, clockwise) so it cannot be re-derived per screen. This
 * component draws; it never scores. The number it renders was produced by
 * Readiness 2.0.
 *
 * Projected readiness is drawn as a SEPARATE arc beyond the earned one, in its
 * own colour, and is labelled. It can never be mistaken for earned readiness
 * because it is never drawn from zero.
 */
import React, { useEffect } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedProps, useReducedMotion, useSharedValue, withTiming, Easing,
} from "react-native-reanimated";
import Svg, { Circle, G } from "react-native-svg";
import { T } from "@/constants/theme";
import { MOTION, TYPE } from "@/constants/tokens";
import {
  GAUGE_ROTATION_DEG, arcDash, circumference, clampScore, projectedArcDash,
} from "@/utils/readinessGauge";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function SRReadinessGauge({
  score, projected = null, size = 150, strokeWidth = 12,
  statusLabel, tone, style,
}: {
  score: number | null | undefined;
  projected?: number | null;
  size?: number;
  strokeWidth?: number;
  statusLabel?: string;
  tone?: string;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const circ = circumference(radius);
  const value = clampScore(score);
  const ringTone = tone ?? T.green;

  const [earnedLen] = arcDash(value, radius);
  const proj = projectedArcDash(value, projected, radius);

  const sweep = useSharedValue(reduced ? earnedLen : 0);
  useEffect(() => {
    sweep.value = reduced
      ? earnedLen
      : withTiming(earnedLen, { duration: MOTION.gauge, easing: Easing.out(Easing.cubic) });
  }, [earnedLen, reduced, sweep]);

  const earnedProps = useAnimatedProps(() => ({
    strokeDasharray: `${sweep.value} ${circ}`,
  }));

  const a11y = value === null
    ? "Readiness unavailable"
    : `Readiness ${Math.round(value)} out of 100${
        proj ? `, projected ${Math.round(clampScore(projected)!)}` : ""}`;

  return (
    <View
      style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={a11y}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* -90deg puts 0 at 12 o'clock; the dash then runs clockwise */}
        <G rotation={GAUGE_ROTATION_DEG} origin={`${cx}, ${cx}`}>
          <Circle
            cx={cx} cy={cx} r={radius} fill="none"
            stroke="rgba(255,255,255,0.09)" strokeWidth={strokeWidth}
          />
          {/* projected sits UNDER the earned arc and starts where it ends */}
          {proj ? (
            <Circle
              cx={cx} cy={cx} r={radius} fill="none"
              stroke={T.blue} strokeWidth={strokeWidth} strokeLinecap="butt"
              strokeDasharray={`${proj.dash[0]} ${proj.dash[1]}`}
              strokeDashoffset={proj.offset}
              opacity={0.55}
            />
          ) : null}
          <AnimatedCircle
            cx={cx} cy={cx} r={radius} fill="none"
            stroke={ringTone} strokeWidth={strokeWidth}
            /* butt caps: a round cap overruns the arc end and would swallow a
               small projected segment sitting immediately after it */
            strokeLinecap="butt"
            animatedProps={earnedProps}
          />
        </G>
      </Svg>
      <View style={{ alignItems: "center" }}>
        <Text style={[TYPE.metricLg, { color: value === null ? T.basecampTextMuted : ringTone }]}>
          {value === null ? "—" : Math.round(value)}
        </Text>
        {statusLabel ? (
          <Text style={styles.status} numberOfLines={1}>{statusLabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

/** Legend making the two arcs unambiguous wherever a projection is shown. */
export function SRGaugeLegend({ projected }: { projected: boolean }) {
  if (!projected) return null;
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.swatch, { backgroundColor: T.green }]} />
        <Text style={styles.legendText}>Earned</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.swatch, { backgroundColor: T.blue, opacity: 0.55 }]} />
        <Text style={styles.legendText}>Projected</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  status: { ...TYPE.eyebrow, color: T.basecampTextMuted, marginTop: 2 },
  legend: { flexDirection: "row", gap: 14, marginTop: 8, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  swatch: { width: 9, height: 9, borderRadius: 2 },
  legendText: { ...TYPE.caption, color: T.basecampTextMuted },
});
