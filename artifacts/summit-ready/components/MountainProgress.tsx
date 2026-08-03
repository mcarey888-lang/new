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
  "C231.9 123.8 237 122.834 241.5 122.5L246.5 116L255.5 107.5" +
  "C258.167 105.667 264 101.6 267 100L279 91C280.5 89.334 283.9 85.8 285.5 84" +
  "C287.1 82.2 289.667 79.834 290.5 79L296 72.5L307 56.5L316.5 45" +
  "C320.833 38.5 329.8 25.2 331 23L342 12.5L347 7.5C350.667 5.167 357.5 2 357.5 2";

// ── Stage marker ─────────────────────────────────────────────────────────────

function StageMarker({
  fraction,
  stageIndex,
  stage,
  currentProgress,
  flipLabel,
}: {
  fraction: number;
  stageIndex: number;
  stage: ExpeditionStage;
  currentProgress: number;
  flipLabel: boolean;
}) {
  const pt      = getPointAtFraction(fraction);
  const done    = stage.status === "completed";
  const active  = stage.status === "active";
  const opacity = done || active ? 1 : 0.4;
  const color   = done ? "#3ECF75" : active ? "#8FE8B4" : "rgba(255,255,255,0.6)";

  const LABEL_OFFSET = 18;
  const labelX = flipLabel ? pt.x + LABEL_OFFSET : pt.x - LABEL_OFFSET;
  const anchor = flipLabel ? "start" : "end";

  return (
    <>
      <Line
        x1={pt.x} y1={pt.y}
        x2={labelX} y2={pt.y}
        stroke={color}
        strokeWidth={0.6}
        opacity={opacity}
      />
      <Circle
        cx={pt.x} cy={pt.y} r={2.2}
        fill={done ? "#3ECF75" : "rgba(255,255,255,0.4)"}
        opacity={opacity}
      />
      <SvgText
        x={labelX + (flipLabel ? 2 : -2)}
        y={pt.y - 2}
        textAnchor={anchor}
        fill={color}
        fontSize={6.5}
        fontFamily="Inter_700Bold"
        opacity={opacity}
      >
        {`S${stageIndex + 1} · ${stage.name}`}
      </SvgText>
      <SvgText
        x={labelX + (flipLabel ? 2 : -2)}
        y={pt.y + 6}
        textAnchor={anchor}
        fill={color}
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
