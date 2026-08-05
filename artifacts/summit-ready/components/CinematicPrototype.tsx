// ─────────────────────────────────────────────────────────────────────────────
// CinematicPrototype.tsx
//
// Expedition completion cinematic — camera push-in to the mountain summit.
//
// Phases:
//   idle       → normal expedition screen
//   pausing    → 380 ms pause after trigger
//   zooming    → 1800 ms push-in, summit becomes focal point
//   holding    → 250 ms perfect stillness — the handoff frame
//   ready      → onCinematicReady fired; frozen until dismissed
//   dismissing → 800 ms zoom-out back to normal
//
// Transform model:
//   The animated layer uses [translateX(Tx), translateY(Ty), scale(S)].
//   React Native applies these right-to-left: scale first, then translate.
//
//   After scale S around screen centre (W/2, H/2), the summit anchor moves to:
//     (W/2 + S·(anchorX − W/2),  H/2 + S·(anchorY − H/2))
//   We want it at (targetX, targetY), so:
//     Tx = targetX − W/2 − S·(anchorX − W/2)
//     Ty = targetY − H/2 − S·(anchorY − H/2)
//
// Summit anchor (DEV — tune with debug crosses):
//   SUMMIT_ANCHOR_X / SUMMIT_ANCHOR_Y  — fraction of the mountain image component
//   TARGET_NORM_X / TARGET_NORM_Y      — where anchor should land on screen (0–1)
//
// Debug overlay (DEV ONLY — remove before shipping):
//   GREEN cross → raw summit anchor in screen coords
//   RED cross   → camera target (where anchor will land)
//
// Handoff contract:
//   onCinematicReady()   fired when camera holds on summit. Higgsfield starts here.
//   onDismiss()          fired when zoom-out completes. Called after Continue press.
//
// To remove: delete this file + grep "DEV ONLY" in base-camp.tsx.
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
// Summit anchor — expressed in SVG viewbox coordinates (380 × 344).
// "376px in from the left, 340px up from the bottom" → SVG (376, 4).
// Converted to fractions so they scale correctly on any device.
// Use the GREEN debug cross to verify the anchor sits on the visual summit peak.

const SVG_VB_W = 380;
const SVG_VB_H = 344;

/** SVG x coordinate of the visual summit — converted to a width fraction. */
const SUMMIT_ANCHOR_X = 376 / SVG_VB_W;               // ≈ 0.989
/** SVG y coordinate of the visual summit (4px from top) — converted to a height fraction. */
const SUMMIT_ANCHOR_Y = (SVG_VB_H - 340) / SVG_VB_H;  // = 4/344 ≈ 0.012

/** Where the anchor should land on screen after zoom — horizontal (0 = left, 1 = right). */
const TARGET_NORM_X = 0.72;
/** Where the anchor should land on screen after zoom — vertical (0 = top, 1 = bottom). */
const TARGET_NORM_Y = 0.28;
// END DEV ONLY ──────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────

type Phase = "idle" | "pausing" | "zooming" | "holding" | "ready" | "dismissing";

interface CinematicPrototypeProps {
  /** Set true to begin the cinematic. Set false to trigger zoom-out. */
  active: boolean;
  /**
   * Ref on the mountain image component — measured for summit anchor maths.
   * Should be placed on the MountainProgress view, NOT the whole expedition card.
   */
  mountainRef: React.RefObject<View | null>;
  /**
   * Called when the camera holds on the summit (250 ms after zoom completes).
   * Future: begin Higgsfield playback here.
   */
  onCinematicReady: () => void;
  /**
   * Called when the zoom-out completes and the expedition screen is restored.
   * Future: called after Higgsfield + user presses Continue.
   */
  onDismiss: () => void;

  // DEV ONLY ────────────────────────────────────────────────────────────────
  /** Override scale (3–6). When undefined, auto-fills the card to screen height. */
  devZoomScale?: number;
  /**
   * When true, all developer overlays (debug cross, handoff bar) are hidden.
   * Used by the "Capture Handoff Frame" action to produce a clean screenshot.
   */
  hideDevOverlays?: boolean;
  /**
   * Ref forwarded to the root View — used by react-native-view-shot to capture
   * the handoff frame without browser chrome or developer controls.
   */
  captureViewRef?: React.RefObject<View | null>;
  // END DEV ONLY ─────────────────────────────────────────────────────────────

  children: React.ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────

export function CinematicPrototype({
  active,
  mountainRef,
  onCinematicReady,
  onDismiss,
  devZoomScale,
  hideDevOverlays = false,
  captureViewRef,
  children,
}: CinematicPrototypeProps) {
  const { width, height } = useWindowDimensions();

  // Three GPU-accelerated values — the only things that animate
  const scaleVal      = useSharedValue(1);
  const translateXVal = useSharedValue(0);
  const translateYVal = useSharedValue(0);

  const phaseRef = useRef<Phase>("idle");

  // Stable callback refs — avoids stale closures via runOnJS
  const onCinematicReadyRef = useRef(onCinematicReady);
  const onDismissRef        = useRef(onDismiss);
  useEffect(() => { onCinematicReadyRef.current = onCinematicReady; }, [onCinematicReady]);
  useEffect(() => { onDismissRef.current        = onDismiss; },        [onDismiss]);

  // DEV ONLY
  const [devRestoreVisible, setDevRestoreVisible] = useState(false);
  const [devDebugInfo, setDevDebugInfo] = useState<{
    anchorX: number; anchorY: number;
  } | null>(null);
  // END DEV ONLY

  // ── Internal helpers ──────────────────────────────────────────────────────

  function handleDismissComplete() {
    phaseRef.current    = "idle";
    scaleVal.value      = 1;
    translateXVal.value = 0;
    translateYVal.value = 0;
    onDismissRef.current();
  }

  function dismiss() {
    if (phaseRef.current !== "ready" && phaseRef.current !== "holding") return;
    phaseRef.current = "dismissing";

    // DEV ONLY
    setDevRestoreVisible(false);
    setDevDebugInfo(null);
    // END DEV ONLY

    const opts = { duration: 800, easing: Easing.out(Easing.cubic) } as const;
    translateXVal.value = withTiming(0, opts);
    translateYVal.value = withTiming(0, opts);
    scaleVal.value = withTiming(1, opts, () => runOnJS(handleDismissComplete)());
  }

  function handleZoomComplete() {
    phaseRef.current = "holding";
    setTimeout(() => {
      if (phaseRef.current !== "holding") return;
      phaseRef.current = "ready";
      setDevRestoreVisible(true); // DEV ONLY
      onCinematicReadyRef.current();
    }, 250);
  }

  // ── Main effect — responds to active ─────────────────────────────────────

  useEffect(() => {
    if (active) {
      if (phaseRef.current !== "idle") return;
      phaseRef.current = "pausing";

      const timer = setTimeout(() => {
        mountainRef.current?.measure(
          (_x, _y, cardW, cardH, pageX, pageY) => {
            // ── Summit anchor in screen coords ──────────────────────────────
            // Expressed as fractions of the mountain image component.
            // Tune SUMMIT_ANCHOR_X / SUMMIT_ANCHOR_Y at the top of this file.
            // Use the GREEN debug cross to verify anchor placement.
            const anchorScreenX = pageX + cardW * SUMMIT_ANCHOR_X;
            const anchorScreenY = pageY + cardH * SUMMIT_ANCHOR_Y;

            // DEV ONLY — render debug cross on the anchor
            setDevDebugInfo({ anchorX: anchorScreenX, anchorY: anchorScreenY });

            // ── Scale ───────────────────────────────────────────────────────
            // Auto fills the card height to the screen. Dev picker overrides.
            // Capped at 0.95 of full zoom — the handoff frame where the
            // progress line stops and Higgsfield takes over.
            const autoS = (height / cardH) * 0.94;
            const S     = (devZoomScale ?? autoS) * 0.95;

            // ── Translations ────────────────────────────────────────────────
            // X — right-edge-fixed: the right side of the content stays pinned
            // at screen x = W throughout the zoom. No content can ever slide
            // off-screen right or reveal a gap.
            //
            //   After scale S around screen centre (W/2), the right edge lands at:
            //     W/2 + S×(W − W/2) = W/2×(1+S)
            //   To keep it at W: Tx = W − W/2×(1+S) = W/2×(1−S)
            const Tx = (width / 2) * (1 - S);

            // Y — target-based: pulls the summit toward TARGET_NORM_Y on screen.
            const targetY = height * TARGET_NORM_Y;
            const Ty = targetY - height / 2 - S * (anchorScreenY - height / 2);

            phaseRef.current = "zooming";

            const easeOpts = { duration: 8000, easing: Easing.inOut(Easing.quad) } as const;
            translateXVal.value = withTiming(Tx, easeOpts);
            translateYVal.value = withTiming(Ty, easeOpts);
            scaleVal.value = withTiming(S, easeOpts, () => runOnJS(handleZoomComplete)());
          },
        );
      }, 800);

      return () => clearTimeout(timer);
    }

    // active → false: trigger dismiss from handoff frame
    if (phaseRef.current === "ready" || phaseRef.current === "holding") {
      dismiss();
    }
  }, [active, devZoomScale]);

  // ── Animated style ────────────────────────────────────────────────────────

  const contentStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateXVal.value },
      { translateY: translateYVal.value },
      { scale: scaleVal.value },
    ],
  }));

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root} ref={captureViewRef}>
      <Animated.View
        style={[styles.content, contentStyle]}
        pointerEvents={active ? "none" : "box-none"}
      >
        {children}
      </Animated.View>

      {/* ── DEV ONLY: handoff frame restore button ───────────────────────────
          Placeholder for Higgsfield cinematic + completion overlay.
          Remove this block when those are implemented.               */}
      {__DEV__ && devRestoreVisible && !hideDevOverlays && (
        <View style={styles.devRestoreBar} pointerEvents="box-none">
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

// ── DEV ONLY: debug cross component ──────────────────────────────────────────
// Positioned in absolute screen coords (outside the animated layer).
// Remove when anchor values are finalised.

function DebugCross({
  x, y, color, label,
}: {
  x: number; y: number; color: string; label: string;
}) {
  const SIZE  = 18;
  const THICK = 2;
  return (
    <View
      style={{
        position:        "absolute",
        left:            x - SIZE,
        top:             y - SIZE,
        width:           SIZE * 2,
        height:          SIZE * 2,
        alignItems:      "center",
        justifyContent:  "center",
        pointerEvents:   "none",
      } as any}
      pointerEvents="none"
    >
      <View style={{ position: "absolute", width: SIZE * 2, height: THICK, backgroundColor: color }} />
      <View style={{ position: "absolute", width: THICK, height: SIZE * 2, backgroundColor: color }} />
      <Text style={{
        position:   "absolute",
        top:        SIZE + 3,
        fontSize:   8,
        fontFamily: "Inter_700Bold",
        color,
        letterSpacing: 0.5,
      }}>
        {label}
      </Text>
    </View>
  );
}
// END DEV ONLY ────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex:            1,
    overflow:        "hidden", // clips zoomed content to screen bounds
    backgroundColor: "#000",  // prevents white flash when content shifts during zoom
  },
  content: {
    flex: 1,
  },

  // DEV ONLY ──────────────────────────────────────────────────────────────────
  devRestoreBar: {
    position:     "absolute",
    bottom:        0,
    left:          0,
    right:         0,
    alignItems:   "center",
    paddingBottom: 48,
    zIndex:        9999,
  },
  devRestoreContent: {
    alignItems:        "center",
    gap:               10,
    backgroundColor:   "rgba(0,0,0,0.72)",
    borderRadius:      16,
    paddingHorizontal: 20,
    paddingVertical:   14,
    borderWidth:        1,
    borderColor:       "rgba(255,255,255,0.12)",
  },
  devRestoreLabel: {
    fontSize:      10,
    fontFamily:    "Inter_700Bold",
    color:         "rgba(255,255,255,0.5)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  devRestoreBtn: {
    backgroundColor:   "rgba(255,255,255,0.12)",
    borderRadius:       10,
    paddingHorizontal:  16,
    paddingVertical:     9,
    borderWidth:         1,
    borderColor:        "rgba(255,255,255,0.2)",
  },
  devRestoreBtnText: {
    fontSize:   13,
    fontFamily: "Inter_700Bold",
    color:      "#fff",
  },
  // END DEV ONLY ──────────────────────────────────────────────────────────────
});
