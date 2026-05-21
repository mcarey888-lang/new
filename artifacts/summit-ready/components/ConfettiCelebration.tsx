import React, { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const { width: W, height: H } = Dimensions.get("window");

const COLORS = [
  "#F5A623", "#E74C3C", "#2ECC71", "#3498DB", "#9B59B6",
  "#F39C12", "#1ABC9C", "#E91E63", "#00BCD4", "#CDDC39",
];

const SHAPES = ["●", "■", "▲", "★", "◆"];

interface Particle {
  id: number;
  x: number;
  color: string;
  shape: string;
  size: number;
  delay: number;
  duration: number;
  rotationDir: number;
}

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * W,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    size: 10 + Math.random() * 10,
    delay: Math.random() * 800,
    duration: 1400 + Math.random() * 1000,
    rotationDir: Math.random() > 0.5 ? 1 : -1,
  }));
}

const PARTICLES = makeParticles(50);

function Particle({ p, onDone }: { p: Particle; onDone?: () => void }) {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const drift = (Math.random() - 0.5) * 60;

    opacity.value = withDelay(p.delay, withTiming(1, { duration: 200 }));
    translateY.value = withDelay(
      p.delay,
      withTiming(H + 40, { duration: p.duration, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished && onDone) runOnJS(onDone)();
      })
    );
    translateX.value = withDelay(
      p.delay,
      withSequence(
        withTiming(drift, { duration: p.duration * 0.5, easing: Easing.inOut(Easing.sin) }),
        withTiming(-drift * 0.5, { duration: p.duration * 0.5, easing: Easing.inOut(Easing.sin) })
      )
    );
    rotate.value = withDelay(
      p.delay,
      withTiming(p.rotationDir * 720, { duration: p.duration, easing: Easing.linear })
    );
    scale.value = withDelay(
      p.delay,
      withSequence(
        withTiming(1.2, { duration: 200 }),
        withTiming(0.8, { duration: p.duration - 200, easing: Easing.in(Easing.quad) })
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text
      style={[
        styles.particle,
        { left: p.x, fontSize: p.size, color: p.color },
        style,
      ]}
    >
      {p.shape}
    </Animated.Text>
  );
}

interface ConfettiCelebrationProps {
  onComplete?: () => void;
}

export function ConfettiCelebration({ onComplete }: ConfettiCelebrationProps) {
  const doneCount = React.useRef(0);

  function handleParticleDone() {
    doneCount.current += 1;
    if (doneCount.current >= PARTICLES.length && onComplete) {
      onComplete();
    }
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {PARTICLES.map((p) => (
        <Particle key={p.id} p={p} onDone={handleParticleDone} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: "absolute",
    top: 0,
    fontWeight: "bold",
  },
});
