import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ACHIEVEMENTS, TIER_COLOR, TIER_LABEL, Achievement } from "@/utils/achievements";
import { T } from "@/constants/theme";

function Sparkle({ color, delay, angle, distance }: { color: string; delay: number; angle: number; distance: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(progress, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
  }, []);

  const tx = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * distance] });
  const ty = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * distance] });
  const op = progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] });
  const sc = progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1.4, 0.3] });

  return (
    <Animated.View
      style={[
        styles.sparkle,
        { backgroundColor: color, opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }] },
      ]}
    />
  );
}

function AchievementCard({ achievement, total, current, onAdvance }: {
  achievement: Achievement;
  total: number;
  current: number;
  onAdvance: () => void;
}) {
  const scale    = useRef(new Animated.Value(0.55)).current;
  const opacity  = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(1)).current;

  const tierColor = TIER_COLOR[achievement.tier];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(ringPulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [achievement.id]);

  const sparkles = Array.from({ length: 10 }, (_, i) => ({
    angle: (i / 10) * Math.PI * 2,
    distance: 55 + (i % 3) * 20,
    delay: i * 60,
  }));

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onAdvance} style={styles.cardWrap}>
      <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
        <LinearGradient
          colors={[tierColor + "22", tierColor + "06", "transparent"]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["transparent", "transparent"]}
          style={[StyleSheet.absoluteFill, styles.cardBorderGlow, { borderColor: tierColor + "55" }]}
        />

        {/* Label */}
        <Text style={styles.unlockedLabel}>Achievement Unlocked</Text>

        {/* Emoji ring with sparkles */}
        <View style={styles.emojiContainer}>
          {sparkles.map((s, i) => (
            <Sparkle key={i} color={tierColor} delay={s.delay} angle={s.angle} distance={s.distance} />
          ))}
          <Animated.View style={[styles.emojiRing, { borderColor: tierColor + "60", backgroundColor: tierColor + "18", transform: [{ scale: ringPulse }] }]}>
            <Text style={styles.emoji}>{achievement.emoji}</Text>
          </Animated.View>
        </View>

        {/* Tier badge */}
        <View style={[styles.tierBadge, { backgroundColor: tierColor + "22", borderColor: tierColor + "50" }]}>
          <Text style={[styles.tierText, { color: tierColor }]}>{TIER_LABEL[achievement.tier]}</Text>
        </View>

        <Text style={styles.title}>{achievement.title}</Text>
        <Text style={styles.description}>{achievement.description}</Text>

        {total > 1 && (
          <View style={styles.counter}>
            {Array.from({ length: total }, (_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i === current ? tierColor : T.border }]} />
            ))}
          </View>
        )}

        <Text style={styles.hint}>{current + 1 < total ? "Tap for next" : "Tap to continue"}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export function AchievementToast({
  newlyUnlocked,
  onDismiss,
}: {
  newlyUnlocked: string[];
  onDismiss: () => void;
}) {
  const [index, setIndex] = useState(0);
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(bgOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => advance(), 4500);
    return () => clearTimeout(timer);
  }, [index]);

  function advance() {
    if (index + 1 < newlyUnlocked.length) {
      setIndex(i => i + 1);
    } else {
      Animated.timing(bgOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(onDismiss);
    }
  }

  const achievement = ACHIEVEMENTS.find(a => a.id === newlyUnlocked[index]);
  if (!achievement || newlyUnlocked.length === 0) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={advance}>
      <Animated.View style={[styles.overlay, { opacity: bgOpacity }]}>
        <AchievementCard
          key={achievement.id}
          achievement={achievement}
          total={newlyUnlocked.length}
          current={index}
          onAdvance={advance}
        />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.80)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  cardWrap: { width: "100%", alignItems: "center" },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: T.card,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: T.border,
    padding: 28,
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
  },
  cardBorderGlow: {
    borderRadius: 28,
    borderWidth: 1.5,
  },
  unlockedLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: T.textMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  emojiContainer: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  emojiRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 40 },
  sparkle: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  tierBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
  },
  tierText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: T.white,
    textAlign: "center",
    marginTop: 4,
  },
  description: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  counter: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: T.textDim,
    marginTop: 4,
  },
});
