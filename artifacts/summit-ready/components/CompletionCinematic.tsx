// ─────────────────────────────────────────────────────────────────────────────
// CompletionCinematic.tsx
//
// Fullscreen Modal that plays the completion MP4 over the frozen handoff frame,
// then surfaces a completion overlay in the final second of playback.
//
// Sequence:
//   1. Modal mounts (opacity 0, video ready at frame 0)
//   2. 200 ms pause → fade-in over 400 ms   ← seamless cut from zoom
//   3. Video plays, no controls, full-screen cover
//   4. At durationMs − 1000 ms → overlay fades in (600 ms)
//   5. Video finishes → overlay pinned until user acts
//   6. "Continue" → onContinue()  /  "Share" → native share sheet
// ─────────────────────────────────────────────────────────────────────────────

import { LinearGradient } from "expo-linear-gradient";
import { ResizeMode, Video } from "expo-av";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "@/constants/theme";

// Bundled local asset — Metro packs it for both native and web.
const COMPLETION_VIDEO = require("../assets/videos/completion.mp4");

// ─────────────────────────────────────────────────────────────────────────────

interface CompletionCinematicProps {
  visible: boolean;
  expeditionName: string;
  /** Total elevation in metres, shown in the overlay */
  totalElevationM: number;
  /** Called once the user taps "Continue" — parent should dismiss cinematic */
  onContinue: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────

export function CompletionCinematic({
  visible,
  expeditionName,
  totalElevationM,
  onContinue,
}: CompletionCinematicProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const videoRef = useRef<Video>(null);

  // Opacity of the whole modal (entry cross-fade)
  const modalOpacity = useRef(new Animated.Value(0)).current;
  // Opacity of the completion overlay (appears in final second)
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const [overlayMounted, setOverlayMounted] = useState(false);
  const overlayShownRef = useRef(false);
  const fadeInStartedRef = useRef(false);

  // ── Reset on every open ──────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    // Reset state
    modalOpacity.setValue(0);
    overlayOpacity.setValue(0);
    setOverlayMounted(false);
    overlayShownRef.current = false;
    fadeInStartedRef.current = false;

    // Seek video back to start (handles re-triggers)
    videoRef.current?.setPositionAsync(0).catch(() => {});

    // 200 ms pause (matches the handoff hold) → fade modal in over 400 ms
    const t = setTimeout(() => {
      if (!fadeInStartedRef.current) {
        fadeInStartedRef.current = true;
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }
    }, 200);

    return () => clearTimeout(t);
  }, [visible]);

  // ── Playback status ──────────────────────────────────────────────────────
  const handleStatus = useCallback(
    (status: import("expo-av").AVPlaybackStatus) => {
      if (!status.isLoaded) return;

      const pos = status.positionMillis ?? 0;
      const dur = status.durationMillis ?? 0;

      const nearEnd = dur > 0 && pos >= dur - 1000;
      const finished = !!status.didJustFinish;

      if ((nearEnd || finished) && !overlayShownRef.current) {
        overlayShownRef.current = true;
        setOverlayMounted(true);
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start();
      }
    },
    [],
  );

  // ── Share ────────────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message:
          `🏔️ I just completed the ${expeditionName} expedition on SummitReady!\n` +
          `Total elevation climbed: ${Math.round(totalElevationM).toLocaleString()}m`,
        title: "Expedition Complete!",
      });
    } catch {
      // Share cancelled — no-op
    }
  }, [expeditionName, totalElevationM]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={onContinue}
    >
      {/* Pointer-events none on the outer wrapper so taps fall through to buttons */}
      <Animated.View
        style={[styles.root, { width, height, opacity: modalOpacity }]}
        pointerEvents="box-none"
      >
        {/* ── Video layer ───────────────────────────────────────────────── */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Video
            ref={videoRef}
            source={COMPLETION_VIDEO}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            shouldPlay={visible}
            isLooping={false}
            isMuted={false}
            onPlaybackStatusUpdate={handleStatus}
            useNativeControls={false}
          />
        </View>

        {/* ── Completion overlay — mounts at final second ───────────────── */}
        {overlayMounted && (
          <Animated.View
            style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}
            pointerEvents="box-none"
          >
            {/* Gradient darkens the bottom so text is legible over video */}
            <LinearGradient
              colors={["transparent", "rgba(0,4,16,0.70)", "rgba(0,4,16,0.96)"]}
              locations={[0.2, 0.6, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            <View
              style={[
                styles.overlayContent,
                { paddingBottom: Math.max(insets.bottom + 32, 48) },
              ]}
            >
              {/* ── Badge ────────────────────────────────────────────────── */}
              <View style={styles.badge}>
                <Text style={styles.badgeText}>EXPEDITION COMPLETE</Text>
              </View>

              {/* ── Expedition name ───────────────────────────────────────── */}
              <Text style={styles.expName} numberOfLines={2} adjustsFontSizeToFit>
                {expeditionName}
              </Text>

              {/* ── Elevation stat ────────────────────────────────────────── */}
              <Text style={styles.elevNum}>
                {Math.round(totalElevationM).toLocaleString()}
                <Text style={styles.elevUnit}>m</Text>
              </Text>
              <Text style={styles.elevLabel}>Total elevation climbed</Text>

              {/* ── Divider ───────────────────────────────────────────────── */}
              <View style={styles.divider} />

              {/* ── Actions ───────────────────────────────────────────────── */}
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={handleShare}
                activeOpacity={0.85}
              >
                <Text style={styles.shareBtnText}>🏆  Share Achievement</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.continueBtn}
                onPress={onContinue}
                activeOpacity={0.75}
              >
                <Text style={styles.continueBtnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    position:        "absolute",
    top:             0,
    left:            0,
    backgroundColor: "#000008",
    overflow:        "hidden",
  },

  // ── Completion overlay ──────────────────────────────────────────────────
  overlayContent: {
    position:          "absolute",
    bottom:             0,
    left:               0,
    right:              0,
    paddingHorizontal:  28,
    alignItems:        "center",
  },

  badge: {
    marginBottom:      16,
    paddingHorizontal: 14,
    paddingVertical:    5,
    borderRadius:      20,
    borderWidth:        1,
    borderColor:       "rgba(62,207,117,0.5)",
    backgroundColor:   "rgba(62,207,117,0.10)",
  },
  badgeText: {
    fontSize:      10,
    fontFamily:    "Inter_700Bold",
    color:         T.green,
    letterSpacing: 1.8,
  },

  expName: {
    fontSize:   36,
    fontFamily: "Inter_700Bold",
    color:      "#fff",
    textAlign:  "center",
    lineHeight: 42,
    marginBottom: 20,
  },

  elevNum: {
    fontSize:   56,
    fontFamily: "Inter_700Bold",
    color:      "#fff",
    lineHeight: 60,
  },
  elevUnit: {
    fontSize:   32,
    fontFamily: "Inter_400Regular",
    color:      "rgba(255,255,255,0.6)",
  },
  elevLabel: {
    fontSize:     13,
    fontFamily:   "Inter_400Regular",
    color:        "rgba(255,255,255,0.45)",
    marginTop:     6,
    marginBottom: 28,
    letterSpacing: 0.3,
  },

  divider: {
    width:           80,
    height:           1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginBottom:    28,
  },

  shareBtn: {
    width:             "100%",
    paddingVertical:    16,
    borderRadius:       16,
    backgroundColor:    T.green,
    alignItems:        "center",
    marginBottom:       12,
  },
  shareBtnText: {
    fontSize:   15,
    fontFamily: "Inter_700Bold",
    color:      "#001408",
    letterSpacing: 0.2,
  },

  continueBtn: {
    width:             "100%",
    paddingVertical:    15,
    borderRadius:       16,
    borderWidth:         1,
    borderColor:        "rgba(255,255,255,0.18)",
    backgroundColor:    "rgba(255,255,255,0.06)",
    alignItems:        "center",
  },
  continueBtnText: {
    fontSize:   15,
    fontFamily: "Inter_600SemiBold",
    color:      "rgba(255,255,255,0.80)",
  },
});
