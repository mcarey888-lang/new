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
import { Image, LayoutChangeEvent, StyleSheet, Text, View, ViewStyle } from "react-native";
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
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";

import {
  ROUTE_XS,
  ROUTE_YS,
  TOTAL_PATH_LENGTH,
  getPointAtFraction,
} from "@/utils/mountainPath";

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

// ── Mountain image geometry (from pixel analysis of mountain-bg.png, 860×800) ──
// The transform is calculated so the image summit aligns exactly with the SVG
// path endpoint, and the ridgeline runs directly beneath the route path.
const IMG_W           = 860;
const IMG_H           = 800;
const IMG_RIDGE_COL   = 171;  // leftmost visible ridge column (pixel analysis)
const IMG_PEAK_COL    = 717;  // summit column
const IMG_PEAK_ROW    = 253;  // summit row
const RIDGE_SPAN_FRAC = (IMG_PEAK_COL - IMG_RIDGE_COL) / IMG_W; // 0.6349

// SVG coordinate space
const VB_W = 360;
const VB_H = 270;

// ROUTE_PATH endpoint — must stay in sync with mountainPath.ts SEGS
const SUMMIT_SVG_X = 262;
const SUMMIT_SVG_Y = 85;

// Route path — lead-in from x=-10, follows the ridge to the actual mountain peak.
const ROUTE_PATH =
  "M-10 268 L2 268" +
  "C17.8333 267.834 51 266.7 57 263.5C63 260.3 71.1667 252.167 74.5 248.5" +
  "L88.5 236L100 221.5L110.5 204.5C111.333 202.667 114.3 198.7 119.5 197.5" +
  "C124.7 196.3 129.5 197.5 138.5 194L147 189.5L156.5 187L169.5 177.5" +
  "L176.5 170.5L184 161.5C187.833 161.834 196.5 161.8 200.5 159" +
  "C204.5 156.2 210.5 147.834 213 144L220 137C222.167 133.5 227.1 126.2 229.5 125" +
  "C231.9 123.8 237 122.834 241.5 122.5C249 111 257 97 262 85";

// ── Stage marker — clean numbered circle with leader line ──────────────────

function StageMarker({
  fraction,
  stageIndex,
  stage,
  flipLabel,
}: {
  fraction: number;
  stageIndex: number;
  stage: ExpeditionStage;
  flipLabel: boolean;
}) {
  const pt     = getPointAtFraction(fraction);
  const done   = stage.status === "completed";
  const active = stage.status === "active";
  const opacity = done || active ? 1 : 0.45;
  const color   = done ? "#3ECF75" : active ? "#9AEFBE" : "rgba(255,255,255,0.50)";

  const LEAD = 16;
  const numX = flipLabel ? pt.x + LEAD : pt.x - LEAD;

  return (
    <>
      {/* Leader line from path point to badge */}
      <Line
        x1={pt.x} y1={pt.y} x2={numX} y2={pt.y}
        stroke={color} strokeWidth={1.0} opacity={opacity}
        strokeDasharray={done ? undefined : [2, 2]}
      />
      {/* Dot on the route */}
      <Circle
        cx={pt.x} cy={pt.y} r={3}
        fill={done ? "#3ECF75" : active ? "rgba(154,239,190,0.6)" : "rgba(255,255,255,0.45)"}
        opacity={opacity}
      />
      {/* Badge background glow for completed */}
      {done && (
        <Circle
          cx={numX} cy={pt.y} r={9}
          fill="rgba(62,207,117,0.12)"
          opacity={1}
        />
      )}
      {/* Number badge */}
      <Circle
        cx={numX} cy={pt.y} r={7}
        fill={done ? "rgba(62,207,117,0.20)" : active ? "rgba(8,18,44,0.95)" : "rgba(8,16,38,0.85)"}
        stroke={color} strokeWidth={done ? 1.2 : 1.0}
        opacity={opacity}
      />
      <SvgText
        x={numX} y={pt.y + 2.5}
        textAnchor="middle"
        fill={color}
        fontSize={6}
        fontFamily="Inter_700Bold"
        opacity={opacity}
      >
        {done ? "✓" : stageIndex + 1}
      </SvgText>
    </>
  );
}

// ── Summit flag icon — planted flag at the peak ───────────────────────────

function SummitFlag({ reached }: { reached: boolean }) {
  const tip = getPointAtFraction(1.0);
  // Position the flag slightly inside the canvas
  const px = Math.min(tip.x - 1, VB_W - 10);
  const py = tip.y + 1; // anchor just below the path terminus

  const flagColor  = reached ? "#FFD700" : "rgba(255,255,255,0.82)";
  const glowColor  = reached ? "rgba(255,215,0,0.28)" : "rgba(255,255,255,0.08)";
  const poleTop    = py - 9; // pole extends up into the viewBox top-padding headroom

  return (
    <>
      {/* Glow aura */}
      <Circle cx={px} cy={py} r={reached ? 10 : 7} fill={glowColor} />
      {/* Flag pole */}
      <Line
        x1={px} y1={py}
        x2={px} y2={poleTop}
        stroke={flagColor} strokeWidth={1.4} strokeLinecap="round"
      />
      {/* Triangular flag pointing left */}
      <Path
        d={`M${px} ${poleTop} L${px - 7} ${poleTop + 3} L${px} ${poleTop + 6} Z`}
        fill={flagColor}
        opacity={0.95}
      />
      {/* Stake dot at base */}
      <Circle cx={px} cy={py + 1.5} r={2.5} fill={flagColor} opacity={0.9} />
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

  // ── Mathematically derived image layout ────────────────────────────────────
  // Scale so ridge-to-peak span maps to SVG x=0 → x=SUMMIT_SVG_X.
  // Component height is set so the image base reaches the component bottom.
  // All values are pure functions of `width` — no manual tuning needed.
  const imgW   = width > 0 ? (SUMMIT_SVG_X / VB_W) * width / RIDGE_SPAN_FRAC : 0;
  const imgH   = imgW * (IMG_H / IMG_W);                       // natural aspect ratio
  const height = imgH > 0
    ? imgH * (1 - IMG_PEAK_ROW / IMG_H) / (1 - SUMMIT_SVG_Y / VB_H)
    : 0;
  const imgLeft = -(IMG_RIDGE_COL / IMG_W) * imgW;             // ridge aligns with x=0
  const imgTop  = (SUMMIT_SVG_Y / VB_H) * height - (IMG_PEAK_ROW / IMG_H) * imgH;

  const progressSv = useSharedValue(0);
  const [markerPos, setMarkerPos] = useState({ x: ROUTE_XS[0], y: ROUTE_YS[0] });
  const summitFiredRef = useRef(false);

  if (targetElevationGain > 0 && currentElevationGain / targetElevationGain < 0.99) {
    summitFiredRef.current = false;
  }

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.65, { duration: 1100, easing: Easing.out(Easing.quad) }),
        withTiming(1.0,  { duration: 900,  easing: Easing.in(Easing.quad) }),
      ),
      -1, false,
    );
  }, [pulse]);

  useEffect(() => {
    if (targetElevationGain <= 0) return;
    const next = Math.min(currentElevationGain / targetElevationGain, 1);
    progressSv.value = withTiming(next, { duration: 500, easing: Easing.out(Easing.cubic) });
    if (next >= 1 && !summitFiredRef.current) {
      summitFiredRef.current = true;
      onSummitReached?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentElevationGain, targetElevationGain]);

  const updateMarker = useCallback((frac: number) => {
    const capped = Math.min(frac, 0.985);
    const idx = Math.max(0, Math.min(1000, Math.round(capped * 1000)));
    setMarkerPos({ x: ROUTE_XS[idx], y: ROUTE_YS[idx] });
  }, []);

  useAnimatedReaction(
    () => progressSv.value,
    (val) => runOnJS(updateMarker)(val),
  );

  // Completed (green) route — progressively revealed
  const dashOuterProps = useAnimatedProps(() => ({
    strokeDashoffset: TOTAL_PATH_LENGTH * (1 - progressSv.value),
  }));
  const dashInnerProps = useAnimatedProps(() => ({
    strokeDashoffset: TOTAL_PATH_LENGTH * (1 - progressSv.value),
  }));
  const dashCoreProps = useAnimatedProps(() => ({
    strokeDashoffset: TOTAL_PATH_LENGTH * (1 - progressSv.value),
  }));
  // Animated halo pulse
  const haloProps = useAnimatedProps(() => ({
    r:       9 * pulse.value,
    opacity: Math.max(0, 0.32 / pulse.value),
  }));

  // Stage fractions
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

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  // Progress bubble
  const bubbleElev = `${Math.round(currentElevationGain)}m`;
  const bubblePct  = `${Math.round(currentProgress * 100)}%`;

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      {width > 0 && height > 0 && (
        <>
          {/* Layer 1 — Mountain artwork, positioned so its summit pixel aligns
              exactly with the SVG path endpoint. Transform derived analytically
              from pixel analysis of mountain-bg.png (860×800). */}
          <Image
            source={MOUNTAIN_BG}
            style={{
              position:  "absolute",
              width:     imgW,
              height:    imgH,
              left:      imgLeft,
              top:       imgTop,
            }}
            resizeMode="stretch"
          />

          {/* Layer 2 — Gradient fade: bottom blends into card bg, sides soften */}
          <LinearGradient
            colors={["transparent", "rgba(6,10,22,0.55)", "rgba(5,10,20,0.92)"]}
            locations={[0.40, 0.72, 1.0]}
            style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
          />
          {/* Left-edge fade */}
          <LinearGradient
            colors={["rgba(5,10,20,0.70)", "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 0.12, y: 0.5 }}
            style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
          />

          {/* Layer 3 — SVG route overlay */}
          <Svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            width={width}
            height={height}
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              {/* Gradient for unfinished dashed route — fades out towards summit */}
              <SvgLinearGradient id="dashFade" x1="0" y1="1" x2="1" y2="0">
                <Stop offset="0"   stopColor="white" stopOpacity="0.22" />
                <Stop offset="0.6" stopColor="white" stopOpacity="0.18" />
                <Stop offset="1"   stopColor="white" stopOpacity="0.08" />
              </SvgLinearGradient>
            </Defs>

            {/* Background dashed route — subdued so completed route is primary focus */}
            <Path
              d={ROUTE_PATH}
              stroke="url(#dashFade)"
              strokeWidth={1.6}
              strokeDasharray={[5, 7]}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />

            {/* Completed route — outer glow */}
            <AnimatedPath
              d={ROUTE_PATH}
              stroke="#3ECF75"
              strokeWidth={14}
              strokeOpacity={0.13}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={[TOTAL_PATH_LENGTH, TOTAL_PATH_LENGTH]}
              animatedProps={dashOuterProps}
            />

            {/* Completed route — inner glow */}
            <AnimatedPath
              d={ROUTE_PATH}
              stroke="#3ECF75"
              strokeWidth={6}
              strokeOpacity={0.32}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={[TOTAL_PATH_LENGTH, TOTAL_PATH_LENGTH]}
              animatedProps={dashInnerProps}
            />

            {/* Completed route — solid core */}
            <AnimatedPath
              d={ROUTE_PATH}
              stroke="#3ECF75"
              strokeWidth={2.4}
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
                flipLabel={i % 2 === 1}
              />
            ))}

            {/* Summit flag */}
            <SummitFlag reached={currentProgress >= 0.99} />

            {/* Progress marker — focal point of the animation */}
            {currentProgress > 0.002 && (
              <>
                {/* Animated outer pulse halo */}
                <AnimatedCircle
                  cx={markerPos.x} cy={markerPos.y}
                  fill="rgba(62,207,117,0.18)" stroke="none"
                  animatedProps={haloProps}
                />
                {/* Soft inner glow */}
                <Circle
                  cx={markerPos.x} cy={markerPos.y} r={8}
                  fill="rgba(62,207,117,0.22)" stroke="none"
                />
                {/* Mid ring */}
                <Circle
                  cx={markerPos.x} cy={markerPos.y} r={5.5}
                  fill="rgba(62,207,117,0.40)" stroke="none"
                />
                {/* Solid core */}
                <Circle
                  cx={markerPos.x} cy={markerPos.y} r={4}
                  fill="#3ECF75" stroke="none"
                />
                {/* Centre white dot */}
                <Circle
                  cx={markerPos.x} cy={markerPos.y} r={1.8}
                  fill="white" stroke="none"
                />
              </>
            )}
          </Svg>

          {/* Layer 4 — Floating progress bubble */}
          {currentProgress > 0.003 && (
            <View
              pointerEvents="none"
              style={[
                styles.bubble,
                {
                  left: Math.max(4, Math.min(width - 72, markerPos.x / VB_W * width - 32)),
                  top:  Math.max(4, markerPos.y / VB_H * height - 56),
                },
              ]}
            >
              <Text style={styles.bubbleElev}>{bubbleElev}</Text>
              <Text style={styles.bubblePct}>{bubblePct}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow:        "hidden",
    borderRadius:    16,
    backgroundColor: "#050A14",
  },
  bubble: {
    position:          "absolute",
    backgroundColor:   "rgba(4,10,24,0.94)",
    borderRadius:       10,
    borderWidth:        1,
    borderColor:       "rgba(62,207,117,0.60)",
    paddingHorizontal:  11,
    paddingVertical:     6,
    alignItems:        "center",
    minWidth:           58,
  },
  bubbleElev: {
    fontSize:   14,
    fontFamily: "Inter_700Bold",
    color:      "#3ECF75",
  },
  bubblePct: {
    fontSize:   10,
    fontFamily: "Inter_400Regular",
    color:      "rgba(255,255,255,0.60)",
    marginTop:   1,
  },
});
