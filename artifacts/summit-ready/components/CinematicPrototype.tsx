// ─────────────────────────────────────────────────────────────────────────────
// CinematicPrototype.tsx
//
// DEV ONLY — Completion cinematic transition prototype.
// Remove this file and all usages in base-camp.tsx when testing is done.
//
// Sequence:
//   1. Wraps expedition screen as children → normal render
//   2. When `active`, freezes interaction and runs:
//      a. Camera zoom (scale + translateY) toward the mountain card (1.5 s)
//      b. Hold on full-screen mountain (1 s)
//      c. Fade to black (0.6 s)  ← placeholder for Higgsfield cinematic
//      d. Snap back under black, fade black out (0.5 s)
//      e. Calls `onComplete` → parent resets `active`
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

interface CinematicPrototypeProps {
  /** Set to true to trigger the cinematic sequence. */
  active: boolean;
  /** Ref attached to the mountain progress card wrapper — used to measure its screen position. */
  mountainRef: React.RefObject<View | null>;
  /** Called after the black fade-out completes; parent should reset `active` to false. */
  onComplete: () => void;
  children: React.ReactNode;
}

export function CinematicPrototype({
  active,
  mountainRef,
  onComplete,
  children,
}: CinematicPrototypeProps) {
  const { width, height } = useWindowDimensions();

  // Content transform — drives the camera zoom
  const scaleVal     = useSharedValue(1);
  const translateVal = useSharedValue(0);

  // Full-screen black overlay — drives the cinematic cut
  const blackOpacity = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      // Instant reset (called by parent after black has faded out)
      scaleVal.value     = 1;
      translateVal.value = 0;
      blackOpacity.value = 0;
      return;
    }

    // Give the scroll animation a frame to settle before measuring
    const timer = setTimeout(() => {
      mountainRef.current?.measure((_x, _y, cardW, cardH, _pageX, pageY) => {
        // ── Transform maths ────────────────────────────────────────────────
        // With [{ translateY: T }, { scale: S }] applied to a full-screen View:
        //   new_abs_y = H/2 + (abs_y - H/2 + T) * S
        // For the mountain card centre to land on screen centre:
        //   T = H/2 - pageY - cardH/2   (independent of S)
        //   S = H / cardH * 0.94        (card fills ~94% of screen height)
        const T = height / 2 - pageY - cardH / 2;
        const S = (height / cardH) * 0.94;

        // ── Phase 1: zoom in (0 → 1500 ms) ────────────────────────────────
        translateVal.value = withTiming(T, {
          duration: 1500,
          easing: Easing.out(Easing.cubic),
        });
        scaleVal.value = withTiming(S, {
          duration: 1500,
          easing: Easing.out(Easing.cubic),
        });

        // ── Phase 2: hold, then fade to black (2500 → 3100 ms) ────────────
        blackOpacity.value = withDelay(
          2500,
          withTiming(1, { duration: 600, easing: Easing.in(Easing.quad) }, () => {
            // ── Phase 3: snap content back under black (invisible) ─────────
            scaleVal.value     = 1;
            translateVal.value = 0;

            // ── Phase 4: hold black then fade out (3600 → 4600 ms) ────────
            blackOpacity.value = withDelay(
              500,
              withTiming(0, { duration: 500 }, () => {
                runOnJS(onComplete)();
              }),
            );
          }),
        );
      });
    }, 80);

    return () => clearTimeout(timer);
  }, [active]);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateVal.value },
      { scale: scaleVal.value },
    ],
  }));

  const blackStyle = useAnimatedStyle(() => ({
    opacity: blackOpacity.value,
  }));

  return (
    <View style={styles.root}>
      {/* Expedition screen — gets the zoom transform applied */}
      <Animated.View
        style={[styles.content, contentStyle]}
        pointerEvents={active ? "none" : "box-none"}
      >
        {children}
      </Animated.View>

      {/* Black overlay — sits above the content, not affected by zoom */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.black, blackStyle]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Clips zoomed content to screen bounds so elements exit frame naturally
    overflow: "hidden",
  },
  content: {
    flex: 1,
  },
  black: {
    backgroundColor: "#000",
    zIndex: 9998,
  },
});
