/**
 * SRReadinessGauge — the approved Readiness ring.
 *
 * APPROVED VISUAL BEHAVIOUR
 *   0 → current      solid, bright SummitReady green
 *   current → proj   the SAME arc continuing, in a softer translucent green
 *                    with a faint glow — a possibility, not earned progress
 *   projected → 100  dark inactive track
 *
 * Everything is derived from the two authoritative numbers. There is no 52, no
 * 55 and no example value anywhere in this file: 63 → 67 renders correctly for
 * the same reason 52 → 55 does. Geometry lives in `utils/readinessGauge.ts`,
 * which fixes the clock mapping (0 at 12 o'clock, clockwise).
 *
 * The projected segment is only ever drawn when the Readiness engine supplied a
 * projection AND it exceeds current. It is never synthesised, and a zero or
 * negative change draws nothing.
 *
 * The component draws. It never scores.
 */
import React, { useEffect } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, {
  Easing, useAnimatedProps, useReducedMotion, useSharedValue, withDelay, withTiming,
} from "react-native-reanimated";
import Svg, { Circle, G } from "react-native-svg";
import { T } from "@/constants/theme";
import { MOTION, TYPE } from "@/constants/tokens";
import {
  GAUGE_ROTATION_DEG, arcDash, circumference, clampScore, pointOnRing, projectedArcDash,
} from "@/utils/readinessGauge";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

/** The projected arc's treatment: the same hue, softened. */
export const PROJECTED_OPACITY = 0.38;

export interface SRReadinessGaugeProps {
  /** Authoritative current readiness. Null when the engine could not score. */
  score: number | null | undefined;
  /** Authoritative projected readiness. Null when there is no projection. */
  projected?: number | null;
  size?: number;
  strokeWidth?: number;
  /** e.g. BUILDING — supplied by the readiness presentation adapter. */
  statusLabel?: string;
  tone?: string;
  /** Shows the projected figure beside the ring, anchored to its endpoint. */
  showProjectedCallout?: boolean;
  style?: ViewStyle;
}

export function SRReadinessGauge({
  score, projected = null, size = 150, strokeWidth = 12,
  statusLabel, tone, showProjectedCallout = true, style,
}: SRReadinessGaugeProps) {
  const reduced = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const circ = circumference(radius);

  const value = clampScore(score);
  const ringTone = tone ?? T.green;

  const [earnedLen] = arcDash(value, radius);
  const proj = projectedArcDash(value, projected, radius);
  const projectedValue = proj ? clampScore(projected) : null;

  /* Current sweeps first; the projection then fades in behind it, so the
     softer segment reads as "where this could reach" rather than as progress
     that has already happened. */
  const sweep = useSharedValue(reduced ? earnedLen : 0);
  const projOpacity = useSharedValue(reduced ? PROJECTED_OPACITY : 0);

  useEffect(() => {
    sweep.value = reduced
      ? earnedLen
      : withTiming(earnedLen, { duration: MOTION.gauge, easing: Easing.out(Easing.cubic) });
  }, [earnedLen, reduced, sweep]);

  useEffect(() => {
    const target = proj ? PROJECTED_OPACITY : 0;
    projOpacity.value = reduced
      ? target
      : withDelay(MOTION.gauge, withTiming(target, { duration: MOTION.enter }));
  }, [proj, reduced, projOpacity]);

  const earnedProps = useAnimatedProps(() => ({ strokeDasharray: `${sweep.value} ${circ}` }));
  const projProps = useAnimatedProps(() => ({ opacity: projOpacity.value }));

  /* The callout is anchored to the arc's real endpoint, so it follows the data
     instead of sitting at a position tuned for one example. */
  const endpoint = projectedValue !== null ? pointOnRing(projectedValue, radius, cx, cx) : null;

  const a11y = value === null
    ? "Readiness unavailable"
    : `Readiness ${Math.round(value)} out of 100`
      + (statusLabel ? `, ${statusLabel.toLowerCase()}` : "")
      + (projectedValue !== null
          ? `, projected ${Math.round(projectedValue)} after your next recommended session` : "");

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={a11y}
      accessibilityValue={value === null ? undefined : { min: 0, max: 100, now: Math.round(value) }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* -90deg puts 0 at 12 o'clock; the dash then runs clockwise */}
        <G rotation={GAUGE_ROTATION_DEG} origin={`${cx}, ${cx}`}>
          {/* projected → 100 : dark inactive track */}
          <Circle
            cx={cx} cy={cx} r={radius} fill="none"
            stroke="rgba(255,255,255,0.07)" strokeWidth={strokeWidth}
          />
          {/* current → projected : the same arc, softened.
              Drawn first so the solid arc always sits on top of it. */}
          {proj ? (
            <>
              {/* a faint wider pass reads as a glow without a blur filter,
                  which react-native-svg does not support consistently */}
              <AnimatedG animatedProps={projProps}>
                <Circle
                  cx={cx} cy={cx} r={radius} fill="none"
                  stroke={ringTone} strokeWidth={strokeWidth + 6} strokeLinecap="butt"
                  strokeDasharray={`${proj.dash[0]} ${proj.dash[1]}`}
                  strokeDashoffset={proj.offset}
                  opacity={0.16}
                />
                <Circle
                  cx={cx} cy={cx} r={radius} fill="none"
                  stroke={ringTone} strokeWidth={strokeWidth} strokeLinecap="butt"
                  strokeDasharray={`${proj.dash[0]} ${proj.dash[1]}`}
                  strokeDashoffset={proj.offset}
                />
              </AnimatedG>
            </>
          ) : null}
          {/* 0 → current : solid and bright.
              Butt caps — a round cap overruns the arc end and would eat into
              the projected continuation sitting immediately after it. */}
          <AnimatedCircle
            cx={cx} cy={cx} r={radius} fill="none"
            stroke={ringTone} strokeWidth={strokeWidth} strokeLinecap="butt"
            animatedProps={earnedProps}
          />
        </G>
      </Svg>

      {/* Centre: the figure, READY, then status. No mountain mark. */}
      <View style={[styles.centre, { paddingBottom: size * 0.06 }]} pointerEvents="none">
        <Text
          style={[
            TYPE.metricLg,
            { fontSize: size * 0.3, lineHeight: size * 0.33, color: value === null ? T.textMuted : ringTone },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {value === null ? "—" : `${Math.round(value)}%`}
        </Text>
        <Text style={styles.readyWord}>READY</Text>
        {statusLabel ? <Text style={[styles.status, { color: ringTone }]} numberOfLines={1}>{statusLabel}</Text> : null}
      </View>

      {/* Projected callout, anchored to the real endpoint of the soft arc. */}
      {showProjectedCallout && endpoint && projectedValue !== null ? (
        <View
          style={[
            styles.callout,
            /* centred on the endpoint, then nudged outward from the ring */
            {
              left: endpoint.x - 22 + (endpoint.x - cx) * 0.22,
              top: endpoint.y - 11 + (endpoint.y - cx) * 0.22,
            },
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.calloutText, { color: ringTone }]} numberOfLines={1}>
            {Math.round(projectedValue)}%
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Legend making the two arcs unambiguous wherever a projection is shown. */
export function SRGaugeLegend({ projected, tone = T.green }: { projected: boolean; tone?: string }) {
  if (!projected) return null;
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.swatch, { backgroundColor: tone }]} />
        <Text style={styles.legendText}>Earned</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.swatch, { backgroundColor: tone, opacity: PROJECTED_OPACITY }]} />
        <Text style={styles.legendText}>After your next session</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  readyWord: {
    fontSize: 11, lineHeight: 14, fontFamily: "Inter_700Bold",
    letterSpacing: 2, color: T.basecampTextMuted, marginTop: 1,
  },
  status: { fontSize: 9.5, lineHeight: 12, fontFamily: "Inter_700Bold", letterSpacing: 1.2, marginTop: 3, opacity: 0.9 },
  callout: {
    position: "absolute", minWidth: 44, alignItems: "center",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7,
    backgroundColor: "rgba(6,13,27,0.82)",
  },
  calloutText: { fontSize: 11, lineHeight: 14, fontFamily: "Inter_700Bold", opacity: 0.85 },
  legend: { flexDirection: "row", gap: 14, marginTop: 10, justifyContent: "center", flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  swatch: { width: 9, height: 9, borderRadius: 2 },
  legendText: { fontSize: 11, lineHeight: 14, fontFamily: "Inter_400Regular", color: T.basecampTextMuted },
});
