// ─────────────────────────────────────────────────────────────────────────────
// CinematicPrototype.tsx
//
// Expedition completion cinematic — camera zoom into the mountain.
//
// Phases:
//   idle       → normal expedition screen, transforms at 1/0
//   pausing    → 300 ms pause after trigger (let summit marker animate)
//   zooming    → 1800 ms smooth camera move, mountain becomes focal point
//   holding    → 250 ms perfect stillness — the handoff frame
//   ready      → onCinematicReady fired; stays frozen here until dismissed
//   dismissing → 800 ms smooth zoom-out back to normal
//
// Handoff contract:
//   onCinematicReady()   fired when the mountain fills the screen.
//                        Later: Higgsfield playback begins here.
//   onDismiss()          fired when the zoom-out is complete and the
//                        expedition screen is fully restored.
//                        Later: called after Higgsfield + user presses Continue.
//
// Dismiss can be triggered two ways:
//   1. Parent sets active=false (from ready or holding phase)
//   2. DEV ONLY: "Restore expedition" button inside the component
//
// To remove: delete this file + grep [DEV ONLY] in base-camp.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

// ─────────────────────────────────────────────────────────────────────────────

type Phase = "idle" | "pausing" | "zooming" | "holding" | "ready" | "dismissing";

interface CinematicPrototypeProps {
  /** Set true to begin the cinematic sequence. Set false to trigger zoom-out. */
  active: boolean;
  /** Ref on the mountain progress card — measured for zoom targeting. */
  mountainRef: React.RefObject<View | null>;
  /**
   * Called when the mountain fills the screen and the 250 ms hold is done.
   * This is the handoff point — Higgsfield begins here.
   * The app remains frozen at this zoom level until dismissed.
   */
  onCinematicReady: () => void;
  /**
   * Called when the zoom-out is complete and the expedition screen is restored.
   * Later: triggered after Higgsfield + completion overlay + user presses Continue.
   */
  onDismiss: () => void;

  // DEV ONLY ─────────────────────────────────────────────────────────────────
  // Remove this prop when the correct zoom level has been decided.
  /** Override scale (3–6). When undefined, uses auto-fill based on card height. */
  devZoomScale?: number;
  // END DEV ONLY ──────────────────────────────────────────────────────────────

  children: React.ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────

export function CinematicPrototype({
  active,
  mountainRef,
  onCinematicReady,
  onDismiss,
  devZoomScale,     // DEV ONLY
  children,
}: CinematicPrototypeProps) {
  const { height } = useWindowDimensions();

  // GPU-accelerated transform shared values — the only things that animate
  const scaleVal     = useSharedValue(1);
  const translateVal = useSharedValue(0);

  // Phase tracking via ref (no re-renders on transition)
  const phaseRef = useRef<Phase>("idle");

  // Stable callback refs — prevents stale-closure issues with runOnJS
  const onCinematicReadyRef = useRef(onCinematicReady);
  const onDismissRef        = useRef(onDismiss);
  useEffect(() => { onCinematicReadyRef.current = onCinematicReady; }, [onCinematicReady]);
  useEffect(() => { onDismissRef.current        = onDismiss; },        [onDismiss]);

  // DEV ONLY: controls visibility of the "Restore expedition" button
  const [devRestoreVisible, setDevRestoreVisible] = useState(false);
  // END DEV ONLY

  // ── Internal dismiss sequence ─────────────────────────────────────────────

  function handleDismissComplete() {
    phaseRef.current = "idle";
    // Shared values are already at 1/0 from the animation — these are safety resets
    scaleVal.value     = 1;
    translateVal.value = 0;
    onDismissRef.current();
  }

  function dismiss() {
    if (
      phaseRef.current !== "ready" &&
      phaseRef.current !== "holding"
    ) return;

    phaseRef.current = "dismissing";

    // DEV ONLY
    setDevRestoreVisible(false);
    // END DEV ONLY

    translateVal.value = withTiming(0, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
    scaleVal.value = withTiming(1, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    }, () => {
      runOnJS(handleDismissComplete)();
    });
  }

  // ── Zoom-in sequence ──────────────────────────────────────────────────────

  function handleZoomComplete() {
    phaseRef.current = "holding";
    // Phase 4: 250 ms of perfect stillness — the handoff frame
    setTimeout(() => {
      if (phaseRef.current !== "holding") return; // guard: may have been dismissed
      phaseRef.current = "ready";
      // DEV ONLY
      setDevRestoreVisible(true);
      // END DEV ONLY
      onCinematicReadyRef.current();
    }, 250);
  }

  // ── Respond to active changes ─────────────────────────────────────────────

  useEffect(() => {
    // ── active → true: begin cinematic ──────────────────────────────────────
    if (active) {
      if (phaseRef.current !== "idle") return; // already running
      phaseRef.current = "pausing";

      // 300 ms pause (summit marker animates) + 80 ms render settle
      const timer = setTimeout(() => {
        mountainRef.current?.measure(
          (_x, _y, _w, cardH, _pageX, pageY) => {
            // ── Transform maths ───────────────────────────────────────────
            // Transform order: [translateY(T), scale(S)]
            // React Native applies this right-to-left: scale first, then translate.
            //
            // After scale S (around element centre = screen centre H/2):
            //   mountain centre Y → H/2 + S×(mY − H/2)
            //
            // We want the mountain centred on screen, so:
            //   H/2 + S×(mY − H/2) + T = H/2
            //   T = −S×(mY − H/2) = S×(H/2 − mY)
            //
            // The S multiplier is the critical fix — without it, scale appears
            // tiny while translateY does almost all the apparent work.
            const mY = pageY + cardH / 2; // mountain card centre in screen coords

            // DEV ONLY: honour override scale if provided
            const autoS = (height / cardH) * 0.94;
            const S     = devZoomScale ?? autoS;
            // END DEV ONLY

            // T must include S — see derivation above
            const T = S * (height / 2 - mY);

            phaseRef.current = "zooming";

            // ── Phase 3: single continuous camera move ────────────────────
            translateVal.value = withTiming(T, {
              duration: 1800,
              easing: Easing.out(Easing.cubic),
            });
            scaleVal.value = withTiming(S, {
              duration: 1800,
              easing: Easing.out(Easing.cubic),
            }, () => {
              runOnJS(handleZoomComplete)();
            });
          },
        );
      }, 380);

      return () => clearTimeout(timer);
    }

    // ── active → false: trigger dismiss if we're at the handoff frame ────
    if (
      phaseRef.current === "ready" ||
      phaseRef.current === "holding"
    ) {
      dismiss();
    }
    // If "zooming" or "dismissing", the active animation completes naturally.
    // If "idle", nothing to do.
  }, [active, devZoomScale]); // devZoomScale intentional: re-measure if scale changes while idle

  // ── Animated styles ───────────────────────────────────────────────────────

  const contentStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateVal.value },
      { scale: scaleVal.value },
    ],
  }));

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Expedition screen — the single layer that the camera zooms into */}
      <Animated.View
        style={[styles.content, contentStyle]}
        pointerEvents={active ? "none" : "box-none"}
      >
        {children}
      </Animated.View>

      {/* ── DEV ONLY: restore button shown at the handoff frame ─────────────
          This placeholder stands in for the Higgsfield cinematic + completion
          overlay. When those are implemented, remove this block.          */}
      {__DEV__ && devRestoreVisible && (
        <View
          style={styles.devRestoreBar}
          // DEV ONLY — remove pointerEvents override with the block above
          pointerEvents="box-none"
        >
          <View style={styles.devRestoreContent}>
            <Text style={styles.devRestoreLabel}>
              HANDOFF FRAME — Higgsfield starts here
            </Text>
            <TouchableOpacity
              style={styles.devRestoreBtn}
              onPress={dismiss}
              activeOpacity={0.8}
            >
              <Text style={styles.devRestoreBtnText}>↩ Restore expedition</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {/* END DEV ONLY */}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Clips zoomed content to screen bounds — elements exit frame naturally
    overflow: "hidden",
  },
  content: {
    flex: 1,
  },

  // DEV ONLY ──────────────────────────────────────────────────────────────────
  devRestoreBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: 48,
    zIndex: 9999,
  },
  devRestoreContent: {
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  devRestoreLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  devRestoreBtn: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  devRestoreBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  // END DEV ONLY ──────────────────────────────────────────────────────────────
});
