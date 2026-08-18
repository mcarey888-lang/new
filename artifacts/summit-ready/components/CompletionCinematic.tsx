// ─────────────────────────────────────────────────────────────────────────────
// CompletionCinematic.tsx
//
// Fullscreen Modal — plays the completion MP4, then shows a stats overlay.
//
// Transition design:
//   • Modal is transparent so the handoff frame is briefly visible underneath
//   • The video fades IN from opacity 0 once it is ready to play
//   • This produces a seamless crossfade from frozen mountain shot → video
//   • No black flash, no jarring cut
//
// Video sizing:
//   • object-fit: cover / ResizeMode.COVER — fills edge-to-edge, no letterbox bars
//
// Video rendering split:
//   • Native → expo-av <Video>   (reliable sizing on device)
//   • Web    → plain <video>     (expo-av ignores flex dims on web and renders at
//                                 its intrinsic 1080px; HTML element honours 100%/cover)
//
// All animations use Reanimated (Animated.timing + useNativeDriver:true silently
// fails on Expo web preview).
// ─────────────────────────────────────────────────────────────────────────────

import { LinearGradient } from "expo-linear-gradient";
import { ResizeMode, Video } from "expo-av";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "@/constants/theme";

// Metro resolves require() to:
//   native → numeric asset ID
//   web    → URL string
const COMPLETION_VIDEO = require("../assets/videos/completion.mp4");

// ─────────────────────────────────────────────────────────────────────────────

interface CompletionCinematicProps {
  visible: boolean;
  /**
   * Set true while the cinematic zoom is still playing (before visible becomes
   * true). Mounts a hidden <video preload="auto"> so the browser fully buffers
   * the MP4 during the ~8 s zoom, eliminating the decode-latency pause at the
   * moment of handoff.
   */
  preload?: boolean;
  expeditionName: string;
  /** Total elevation in metres, shown in the overlay */
  totalElevationM: number;
  /** Total distance in km */
  totalDistanceKm: number;
  /** Number of routes completed */
  routesCompleted: number;
  /** Number of days taken to complete */
  daysTaken: number;
  /** Called once the user taps "Continue" — parent should dismiss */
  onContinue: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────

export function CompletionCinematic({
  visible,
  preload = false,
  expeditionName,
  totalElevationM,
  totalDistanceKm,
  routesCompleted,
  daysTaken,
  onContinue,
}: CompletionCinematicProps) {
  const insets = useSafeAreaInsets();

  // Native video ref
  const nativeVideoRef = useRef<Video>(null);
  // Web video ref (typed as any to avoid importing DOM lib types)
  const webVideoRef = useRef<any>(null);

  // ── Video fade-in — starts at 0, animates to 1 when the video is ready ───
  const videoOpacity   = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);

  const videoStyle   = useAnimatedStyle(() => ({ opacity: videoOpacity.value }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  const [overlayMounted, setOverlayMounted] = useState(false);
  const overlayShownRef                      = useRef(false);
  const videoReadyRef                        = useRef(false);

  // ── Show overlay ──────────────────────────────────────────────────────────
  const triggerOverlay = useCallback(() => {
    if (overlayShownRef.current) return;
    overlayShownRef.current = true;
    setOverlayMounted(true);
    overlayOpacity.value = withTiming(1, { duration: 600 });
  }, []);

  // ── Fade video in once it is ready to play ────────────────────────────────
  const triggerVideoFadeIn = useCallback(() => {
    if (videoReadyRef.current) return;
    videoReadyRef.current = true;
    // 200 ms fade: quick crossfade — video is preloaded so it's ready instantly
    videoOpacity.value = withTiming(1, { duration: 200 });
  }, []);

  // ── Reset on every open ───────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      videoOpacity.value   = 0;
      overlayOpacity.value = 0;
      setOverlayMounted(false);
      overlayShownRef.current = false;
      videoReadyRef.current   = false;
      return;
    }

    // Reset for new play-through
    videoOpacity.value   = 0;
    overlayOpacity.value = 0;
    setOverlayMounted(false);
    overlayShownRef.current = false;
    videoReadyRef.current   = false;

    // Seek native video to start
    nativeVideoRef.current?.setPositionAsync(0).catch(() => {});
    // Seek web video to start and play
    if (webVideoRef.current) {
      webVideoRef.current.currentTime = 0;
      webVideoRef.current.play?.().catch(() => {});
    }
  }, [visible]);

  // ── Native playback status ────────────────────────────────────────────────
  const handleNativeStatus = useCallback(
    (status: import("expo-av").AVPlaybackStatus) => {
      if (!status.isLoaded) return;

      // Fade video in on first playing frame
      if (status.isPlaying) triggerVideoFadeIn();

      // Trigger overlay near end
      const pos = status.positionMillis ?? 0;
      const dur = status.durationMillis ?? 0;
      if ((dur > 0 && pos >= dur - 1000) || status.didJustFinish) {
        triggerOverlay();
      }
    },
    [triggerVideoFadeIn, triggerOverlay],
  );

  // ── Share ─────────────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message:
          `🏔️ I just completed the ${expeditionName} expedition on SummitReady!\n` +
          `Finished in ${daysTaken} ${daysTaken === 1 ? "day" : "days"} across ${routesCompleted} ${routesCompleted === 1 ? "route" : "routes"}.\n` +
          `Total elevation: ${Math.round(totalElevationM).toLocaleString()}m | Distance: ${totalDistanceKm.toFixed(1)}km`,
        title: "Expedition Complete!",
      });
    } catch {
      // cancelled
    }
  }, [expeditionName, totalElevationM, totalDistanceKm, routesCompleted, daysTaken]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
    {/*
     * ── Preload video (web only) ────────────────────────────────────────────
     * Mounts a zero-size hidden <video preload="auto"> while the cinematic
     * zoom is still playing. The browser fetches and decodes the MP4 during
     * the ~8 s zoom so it is already in cache when the modal opens — the
     * visible video then gets `onCanPlay` almost immediately.
     */}
    {Platform.OS === "web" && preload && !visible && (
      <video
        src={COMPLETION_VIDEO as string}
        style={{ position: "absolute", width: 0, height: 0, opacity: 0 }}
        preload="auto"
        muted
        playsInline
      />
    )}

    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={onContinue}
    >
      {/*
       * Root is transparent so the handoff frame shows through during the
       * video fade-in, giving a seamless cinematic crossfade.
       */}
      <View style={styles.root}>

        {/* ── Video — fades in once ready, covers edge-to-edge ──────────── */}
        <Animated.View style={[StyleSheet.absoluteFill, videoStyle]}>
          {Platform.OS === "web" ? (
            // Native HTML <video>:
            //  • width/height 100% fill the container correctly (expo-av ignores flex)
            //  • object-fit: cover fills edge-to-edge, no letterbox bars
            <video
              ref={webVideoRef}
              src={COMPLETION_VIDEO as string}
              style={{
                width:     "100%",
                height:    "100%",
                objectFit: "cover",
                display:   "block",
              }}
              autoPlay={visible}
              playsInline
              controls={false}
              loop={false}
              muted={false}
              onCanPlay={triggerVideoFadeIn}
              onTimeUpdate={(e: any) => {
                const el  = e.currentTarget;
                const pos = el.currentTime * 1000;
                const dur = el.duration  * 1000;
                if (dur > 0 && pos >= dur - 1000) triggerOverlay();
              }}
              onEnded={triggerOverlay}
            />
          ) : (
            <Video
              ref={nativeVideoRef}
              source={COMPLETION_VIDEO}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.COVER}
              shouldPlay={visible}
              isLooping={false}
              isMuted={false}
              onPlaybackStatusUpdate={handleNativeStatus}
              useNativeControls={false}
            />
          )}
        </Animated.View>

        {/* ── Completion overlay ─────────────────────────────────────────── */}
        {overlayMounted && (
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.overlayContainer, overlayStyle]}
            pointerEvents="box-none"
          >
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.88)"]}
              style={StyleSheet.absoluteFill}
            />

            <View style={[styles.overlayContent, { paddingBottom: insets.bottom + 32 }]}>
              <Text style={styles.badge}>EXPEDITION COMPLETE</Text>

              <Text style={styles.overlayTitle}>{expeditionName}</Text>

              <View style={styles.statMain}>
                <Text style={styles.statValue}>
                  {Math.round(totalElevationM).toLocaleString()}m
                </Text>
                <Text style={styles.statLabel}>Total elevation climbed</Text>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statCol}>
                  <Text style={styles.statValueSmall}>{totalDistanceKm.toFixed(1)}</Text>
                  <Text style={styles.statLabelSmall}>km distance</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCol}>
                  <Text style={styles.statValueSmall}>{routesCompleted}</Text>
                  <Text style={styles.statLabelSmall}>{routesCompleted === 1 ? "route" : "routes"}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCol}>
                  <Text style={styles.statValueSmall}>{daysTaken}</Text>
                  <Text style={styles.statLabelSmall}>{daysTaken === 1 ? "day" : "days"}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.shareBtn}
                onPress={handleShare}
                activeOpacity={0.8}
              >
                <Text style={styles.shareBtnText}>🏆  Share Achievement</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.continueBtn}
                onPress={onContinue}
                activeOpacity={0.8}
              >
                <Text style={styles.continueBtnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Transparent — handoff frame visible underneath during video fade-in
  },

  // ── Overlay ────────────────────────────────────────────────────────────────
  overlayContainer: {
    justifyContent: "flex-end",
  },
  overlayContent: {
    alignItems:        "center",
    paddingHorizontal: 28,
    paddingTop:        32,
  },
  badge: {
    fontSize:          11,
    fontWeight:        "700",
    color:             T.green,
    letterSpacing:     2,
    borderWidth:       1,
    borderColor:       T.green,
    borderRadius:      20,
    paddingHorizontal: 12,
    paddingVertical:   4,
    marginBottom:      20,
    overflow:          "hidden",
  },
  overlayTitle: {
    fontSize:      28,
    fontWeight:    "800",
    color:         "#fff",
    textAlign:     "center",
    marginBottom:  24,
    letterSpacing: -0.5,
  },
  statMain: {
    alignItems:   "center",
    marginBottom: 24,
  },
  statValue: {
    fontSize:      52,
    fontWeight:    "800",
    color:         "#fff",
    letterSpacing: -2,
    lineHeight:    56,
  },
  statLabel: {
    fontSize:  14,
    color:     "rgba(255,255,255,0.55)",
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: "100%",
  },
  statCol: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  statValueSmall: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  statLabelSmall: {
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  divider: {
    width:           48,
    height:          1,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom:    28,
  },
  shareBtn: {
    width:           "100%",
    height:          54,
    borderRadius:    14,
    backgroundColor: T.green,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    12,
  },
  shareBtnText: {
    fontSize:   17,
    fontWeight: "700",
    color:      "#000",
  },
  continueBtn: {
    width:           "100%",
    height:          54,
    borderRadius:    14,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  continueBtnText: {
    fontSize:   17,
    fontWeight: "600",
    color:      "#fff",
  },
});
