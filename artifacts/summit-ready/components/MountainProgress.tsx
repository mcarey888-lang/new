/**
 * MountainProgress
 *
 * Signature progress component for Expedition Mode.
 * Renders the master-route path over the mountain artwork with an animated
 * green route that reveals proportionally to cumulative elevation gain.
 *
 * Props
 *   targetElevationGain   – total metres to climb (denominator)
 *   currentElevationGain  – metres climbed so far (numerator)
 *   stages                – ordered array of route stages
 *   onSummitReached       – fired once when progress first hits 100 %
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image, LayoutChangeEvent, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Line,
  Path,
  Text as SvgText,
} from "react-native-svg";

import {
  ROUTE_XS,
  ROUTE_YS,
  TOTAL_PATH_LENGTH,
  getPointAtFraction,
} from "@/utils/mountainPath";

// Hoist asset require to module level so Metro can bundle it statically
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MOUNTAIN_BG = require("@/assets/images/mountain-bg.png");

// ── Animated SVG primitives ──────────────────────────────────────────────────

const AnimatedPath   = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExpeditionStage {
  name: string;
  elevationGain: number;
  status: "completed" | "active" | "upcoming";
}

interface Props {
  targetElevationGain: number;
  currentElevationGain: number;
  stages: ExpeditionStage[];
  onSummitReached?: () => void;
  style?: ViewStyle;
}

// SVG coordinate space (matches master-route.svg viewBox)
const VB_W = 360;
const VB_H = 270;

const ROUTE_PATH =
  "M2 268C17.8333 267.834 51 266.7 57 263.5C63 260.3 71.1667 252.167 74.5 248.5" +
  "L88.5 236L100 221.5L110.5 204.5C111.333 202.667 114.3 198.7 119.5 197.5" +
  "C124.7 196.3 129.5 197.5 138.5 194L147 189.5L156.5 187L169.5 177.5" +
  "L176.5 170.5L184 161.5C187.833 161.834 196.5 161.8 200.5 159" +
  "C204.5 156.2 210.5 147.834 213 144L220 137C222.167 133.5 227.1 126.2 229.5 125" +
  "C232.5 123.5 235.5 121 236 117.5C236.4 114.7 238.833 111.334 240 110" +
  "H248C252 111.667 260.5 114.5 262.5 112.5C265 110 272.5 104 274 100.5" +
  "C275.5 97.0004 278.5 91.0004 282.5 89.5004C286.5 88.0004 297 79.0004 299 77.5004" +
  "C301 76.0004 307 62.5004 310.5 60.5004C314 58.5004 323 56.5004 325 53.5004" +
  "C327 50.5004 341.5 31.5004 343 29.0004C344.2 27.0004 350 16.3337 357.5 2.0004";

// ── Stage marker ─────────────────────────────────────────────────────────────

interface StageMarkerProps {
  fraction: number;
  stageIndex: number;
  stage: ExpeditionStage;
  currentProgress: number;
  flipLabel: boolean;
}

function StageMarker({ fraction, stageIndex, stage, currentProgress, flipLabel }: StageMarkerProps) {
  const pt       = getPointAtFraction(fraction);
  const done     = currentProgress >= fraction;
  const active   = !done && currentProgress >= fraction - 0.06;
  const dotColor = done ? "#3ECF75" : active ? "#60A5FA" : "rgba(255,255,255,0.6)";
  const opacity  = done ? 1 : active ? 0.85 : 0.5;

  // Label sits 22 SVG units above the path point (clamped so it stays in frame)
  const labelY   = Math.max(pt.y - 22, 6);
  const textX    = flipLabel ? pt.x + 8 : pt.x - 8;
  const anchor   = flipLabel ? "start" : "end";

  return (
    <>
      {/* Connector line */}
      <Line
        x1={pt.x} y1={pt.y - 1}
        x2={pt.x} y2={labelY + 5}
        stroke={dotColor}
        strokeWidth={0.7}
        strokeOpacity={opacity}
      />

      {/* Stage dot */}
      <Circle
        cx={pt.x} cy={labelY}
        r={done || active ? 4.5 : 3.5}
        fill={done ? "#3ECF75" : active ? "rgba(96,165,250,0.25)" : "transparent"}
        stroke={dotColor}
        strokeWidth={1.2}
        opacity={opacity}
      />

      {/* Labels */}
      <SvgText
        x={textX} y={labelY - 14}
        textAnchor={anchor}
        fill={done ? "#3ECF75" : "rgba(255,255,255,0.9)"}
        fontSize={6.5}
        fontFamily="Inter_700Bold"
        opacity={opacity}
      >
        {`S${stageIndex + 1}`}
      </SvgText>
      <SvgText
        x={textX} y={labelY - 6}
        textAnchor={anchor}
        fill="white"
        fontSize={7}
        fontFamily="Inter_600SemiBold"
        opacity={opacity}
      >
        {stage.name}
      </SvgText>
      <SvgText
        x={textX} y={labelY + 2}
        textAnchor={anchor}
        fill={done ? "#3ECF75" : "rgba(255,255,255,0.55)"}
        fontSize={6}
        fontFamily="Inter_400Regular"
        opacity={opacity}
      >
        {`▲ ${stage.elevationGain.toLocaleString()}m`}
      </SvgText>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MountainProgress({
  targetElevationGain,
  currentElevationGain,
  stages,
  onSummitReached,
  style,
}: Props) {
  const [width, setWidth] = useState(0);
  const height = width > 0 ? Math.round(width * (VB_H / VB_W)) : 0;

  // Shared progress value [0, 1]
  const progressSv = useSharedValue(0);

  // Marker position updated on the JS thread
  const [markerPos, setMarkerPos] = useState({ x: ROUTE_XS[0], y: ROUTE_YS[0] });

  // Summit reached guard
  const summitFiredRef = useRef(false);
  if (targetElevationGain > 0 && currentElevationGain / targetElevationGain < 0.99) {
    summitFiredRef.current = false; // reset if user steps back (demo slider)
  }

  // Pulsing halo
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.7, { duration: 1000, easing: Easing.out(Easing.quad) }),
        withTiming(1.0, { duration: 800,  easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  // Summit glow flash
  const summitGlow = useSharedValue(0);

  // Animate to new progress whenever elevation input changes
  useEffect(() => {
    if (targetElevationGain <= 0) return;
    const next = Math.min(currentElevationGain / targetElevationGain, 1);
    progressSv.value = withTiming(next, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
    if (next >= 1 && !summitFiredRef.current) {
      summitFiredRef.current = true;
      summitGlow.value = withSequence(
        withTiming(1, { duration: 250 }),
        withTiming(0, { duration: 700 }),
      );
      onSummitReached?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentElevationGain, targetElevationGain]);

  // Sync marker position to JS state
  const updateMarker = useCallback((frac: number) => {
    const capped = Math.min(frac, 0.97);
    const idx = Math.max(0, Math.min(1000, Math.round(capped * 1000)));
    setMarkerPos({ x: ROUTE_XS[idx], y: ROUTE_YS[idx] });
  }, []);

  useAnimatedReaction(
    () => progressSv.value,
    (val) => runOnJS(updateMarker)(val),
  );

  // Animated props for the three progress path layers
  const dashOuterProps = useAnimatedProps(() => ({
    strokeDashoffset: TOTAL_PATH_LENGTH * (1 - progressSv.value),
  }));
  const dashInnerProps = useAnimatedProps(() => ({
    strokeDashoffset: TOTAL_PATH_LENGTH * (1 - progressSv.value),
  }));
  const dashCoreProps = useAnimatedProps(() => ({
    strokeDashoffset: TOTAL_PATH_LENGTH * (1 - progressSv.value),
  }));

  // Marker pulse halo
  const haloProps = useAnimatedProps(() => ({
    r:       7 * pulse.value,
    opacity: Math.max(0, 0.3 / pulse.value),
  }));

  // ── Stage fractions ───────────────────────────────────────────────────────
  const totalElev = stages.length > 0
    ? stages.reduce((s, st) => s + st.elevationGain, 0)
    : targetElevationGain;

  let cum = 0;
  const stageFractions = stages.map((st) => {
    cum += st.elevationGain;
    return totalElev > 0 ? cum / totalElev : 0;
  });

  const currentProgress = targetElevationGain > 0
    ? Math.min(currentElevationGain / targetElevationGain, 1)
    : 0;

  const summitPt = getPointAtFraction(0.994);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      {width > 0 && height > 0 && (
        <>
          {/* Layer 1 — Static mountain artwork */}
          <Image
            source={MOUNTAIN_BG}
            style={{ width, height }}
            resizeMode="stretch"
          />

          {/* Layer 2 — SVG route overlay */}
          <Svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            width={width}
            height={height}
            style={StyleSheet.absoluteFill}
          >
            {/* Background dashed route – full expedition always visible */}
            <Path
              d={ROUTE_PATH}
              stroke="white"
              strokeWidth={1.8}
              strokeOpacity={0.38}
              strokeDasharray={[7, 5]}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />

            {/* Progress – outer glow */}
            <AnimatedPath
              d={ROUTE_PATH}
              stroke="#3ECF75"
              strokeWidth={10}
              strokeOpacity={0.10}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={[TOTAL_PATH_LENGTH, TOTAL_PATH_LENGTH]}
              animatedProps={dashOuterProps}
            />

            {/* Progress – soft inner glow */}
            <AnimatedPath
              d={ROUTE_PATH}
              stroke="#3ECF75"
              strokeWidth={5}
              strokeOpacity={0.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={[TOTAL_PATH_LENGTH, TOTAL_PATH_LENGTH]}
              animatedProps={dashInnerProps}
            />

            {/* Progress – solid core */}
            <AnimatedPath
              d={ROUTE_PATH}
              stroke="#3ECF75"
              strokeWidth={2.2}
              strokeOpacity={1}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={[TOTAL_PATH_LENGTH, TOTAL_PATH_LENGTH]}
              animatedProps={dashCoreProps}
            />

            {/* Stage markers */}
            {stages.map((stage, i) => (
              <StageMarker
                key={i}
                fraction={stageFractions[i]}
                stageIndex={i}
                stage={stage}
                currentProgress={currentProgress}
                flipLabel={i % 2 === 1}
              />
            ))}

            {/* Summit marker */}
            <Circle
              cx={summitPt.x}
              cy={summitPt.y}
              r={currentProgress >= 0.99 ? 5 : 3.5}
              fill={currentProgress >= 0.99 ? "#FFD700" : "rgba(255,255,255,0.15)"}
              stroke={currentProgress >= 0.99 ? "#FFD700" : "rgba(255,255,255,0.45)"}
              strokeWidth={1.2}
            />
            <SvgText
              x={summitPt.x - 6}
              y={summitPt.y - 8}
              textAnchor="end"
              fill={currentProgress >= 0.99 ? "#FFD700" : "rgba(255,255,255,0.35)"}
              fontSize={6.5}
              fontFamily="Inter_700Bold"
            >
              SUMMIT
            </SvgText>

            {/* Progress marker — only render once tracking has begun */}
            {currentProgress > 0.002 && (
              <>
                {/* Outer pulse halo */}
                <AnimatedCircle
                  cx={markerPos.x}
                  cy={markerPos.y}
                  fill="rgba(62,207,117,0.20)"
                  stroke="none"
                  animatedProps={haloProps}
                />
                {/* Mid glow ring */}
                <Circle
                  cx={markerPos.x}
                  cy={markerPos.y}
                  r={5.5}
                  fill="rgba(62,207,117,0.30)"
                  stroke="none"
                />
                {/* Core */}
                <Circle
                  cx={markerPos.x}
                  cy={markerPos.y}
                  r={4}
                  fill="#3ECF75"
                  stroke="none"
                />
                {/* White centre */}
                <Circle
                  cx={markerPos.x}
                  cy={markerPos.y}
                  r={1.8}
                  fill="white"
                  stroke="none"
                />
              </>
            )}
          </Svg>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow:        "hidden",
    borderRadius:    16,
    backgroundColor: "#050D1A",
  },
});
