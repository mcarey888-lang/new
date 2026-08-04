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
  /**
   * Increment this value to replay the route animation from 0 → 1.
   * Used by the cinematic to draw the full route during the zoom-in.
   * DEV ONLY — remove when cinematic is finalised.
   */
  replayTrigger?: number;
}

// ── Coordinate system ─────────────────────────────────────────────────────────
// SVG viewBox matches master-route.svg exactly: "0 0 380 344"
// Mountain PNG (406×366) is left- and bottom-aligned with the viewBox at scale
// W/380, so no pixel analysis is needed — the files share the same coordinate
// space and the artwork was designed to match the route path.
const VB_W = 380;
const VB_H = 344;

// mountain-bg.png natural dimensions
const PNG_W = 406;
const PNG_H = 366;

// Route path — copied verbatim from master-route.svg
const ROUTE_PATH =
  "M2 342.001" +
  "C18.7464 341.787 53.8256 340.339 60.1716 336.249" +
  "C66.5176 332.158 75.1552 321.762 78.6807 317.076" +
  "L93.488 301.098L105.651 282.564L116.757 260.835" +
  "C117.638 258.492 120.776 253.422 126.276 251.888" +
  "C131.776 250.354 136.852 251.888 146.371 247.414" +
  "L155.361 241.662L165.409 238.467L179.159 226.324" +
  "L186.563 217.376L194.495 205.873" +
  "C198.549 206.299 207.716 206.256 211.947 202.677" +
  "C216.177 199.098 222.523 188.404 225.167 183.504" +
  "L232.571 174.557" +
  "C234.863 170.083 240.08 160.752 242.619 159.219" +
  "C245.792 157.301 248.965 154.106 249.494 149.632" +
  "C249.917 146.053 252.49 141.75 253.724 140.046" +
  "H262.186" +
  "C266.416 142.176 275.406 145.798 277.522 143.241" +
  "C280.166 140.046 288.098 132.376 289.685 127.903" +
  "C291.271 123.429 294.444 115.76 298.675 113.843" +
  "C302.906 111.925 314.011 100.422 316.127 98.5043" +
  "C318.242 96.587 324.588 79.3313 328.29 76.7749" +
  "C331.992 74.2186 341.511 71.6622 343.626 67.8276" +
  "C345.741 63.993 361.077 39.7073 362.664 36.5118" +
  "C363.933 33.9554 370.068 20.3213 378 2.00051";

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
  // Summit is near the top-right of the viewBox (≈ 378, 2).
  // Pole hangs downward so it stays within the viewBox.
  const px = Math.min(tip.x, VB_W - 4);
  const py = Math.max(tip.y, 3);

  const flagColor = reached ? "#FFD700" : "rgba(255,255,255,0.82)";
  const glowColor = reached ? "rgba(255,215,0,0.28)" : "rgba(255,255,255,0.08)";
  const poleBot   = py + 9;   // pole hangs downward from the summit tip

  return (
    <>
      {/* Glow aura */}
      <Circle cx={px} cy={py} r={reached ? 10 : 7} fill={glowColor} />
      {/* Flag pole — hangs down from tip so it stays in-frame */}
      <Line
        x1={px} y1={py}
        x2={px} y2={poleBot}
        stroke={flagColor} strokeWidth={1.4} strokeLinecap="round"
      />
      {/* Triangular flag pointing left, below the tip */}
      <Path
        d={`M${px} ${poleBot} L${px - 7} ${poleBot - 3} L${px} ${poleBot - 6} Z`}
        fill={flagColor}
        opacity={0.95}
      />
      {/* Tip dot */}
      <Circle cx={px} cy={py} r={2.5} fill={flagColor} opacity={0.9} />
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
  replayTrigger,
}: Props) {
  const [width, setWidth] = useState(0);

  // ── Image layout — left + bottom aligned with SVG viewBox ────────────────
  // The PNG and SVG share the same coordinate space (both authored together).
  // Scale both by W/VB_W; position the PNG at left=0, bottom=0 (bottom-aligned).
  // No pixel analysis needed — alignment is guaranteed by the artwork design.
  const scale  = width > 0 ? width / VB_W : 0;
  const imgW   = PNG_W * scale;               // 406/380 × W  — slightly wider than card
  const imgH   = PNG_H * scale;               // 366/380 × W
  const height = VB_H * scale;               // 344/380 × W  — component height
  const imgLeft = 0;
  const imgTop  = height - imgH;             // bottom-aligned (slightly negative)

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
    progressSv.value = withTiming(next, { duration: 1000, easing: Easing.out(Easing.cubic) });
    if (next >= 1 && !summitFiredRef.current) {
      summitFiredRef.current = true;
      onSummitReached?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentElevationGain, targetElevationGain]);

  // DEV ONLY — replay animation from 0 → 1 when trigger increments.
  // Used by the cinematic to draw the full route during the zoom-in.
  useEffect(() => {
    if (!replayTrigger) return;
    progressSv.value = 0;
    progressSv.value = withTiming(1, {
      duration: 2200,
      easing: Easing.inOut(Easing.cubic),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayTrigger]);

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

  // Container must have an explicit height — all children are position:absolute
  // so the View has no intrinsic height from its children.
  const containerHeight = height > 0 ? height : undefined;

  return (
    <View
      style={[styles.container, { height: containerHeight }, style]}
      onLayout={onLayout}
    >
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
