import React, { useEffect } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
}

export function ProgressRing({
  score,
  size = 160,
  strokeWidth = 12,
  color = "#3ECF75",
  trackColor = "rgba(255,255,255,0.06)",
  label,
  sublabel,
}: ProgressRingProps) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(score / 100);

  useEffect(() => {
    progress.value = withTiming(score / 100, {
      duration: 1400,
      easing: Easing.out(Easing.cubic),
    });
  }, [score]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const getColor = () => {
    if (score >= 70) return "#3ECF75";
    if (score >= 40) return "#FF9500";
    return "#FF4444";
  };
  const ringColor = color !== "#3ECF75" ? color : getColor();

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={ringColor} stopOpacity="1" />
            <Stop offset="100%" stopColor={ringColor} stopOpacity="0.7" />
          </SvgGradient>
        </Defs>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#ringGrad)`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ alignItems: "center", gap: 2 }}>
        <Text style={{ fontSize: 38, fontFamily: "Inter_700Bold", color: ringColor, lineHeight: 42 }}>
          {score}
        </Text>
        {label && (
          <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.45)", letterSpacing: 1.4, textTransform: "uppercase" }}>
            {label}
          </Text>
        )}
        {sublabel && (
          <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: "#fff", marginTop: 2 }}>
            {sublabel}
          </Text>
        )}
      </View>
    </View>
  );
}
