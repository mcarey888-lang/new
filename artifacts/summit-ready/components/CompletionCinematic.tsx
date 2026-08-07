// ─────────────────────────────────────────────────────────────────────────────
// CompletionCinematic.tsx
//
// Fullscreen Modal — plays the completion MP4 then shows a stats overlay.
//
// Video rendering is split by platform:
//   • Native  → expo-av <Video>   (reliable sizing on device)
//   • Web     → plain <video>     (expo-av ignores flex dims on web and renders
//                                  at intrinsic 1080px; the HTML element honours
//                                  width:100% / height:100% / object-fit:contain)
//
// All opacity animations use Reanimated (works on web; Animated.timing +
// useNativeDriver:true silently fails on Expo web preview).
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
  expeditionName: string;
  /** Total elevation in metres, shown in the overlay */
  totalElevationM: number;
  /** Called once the user taps "Continue" — parent should dismiss */
  onContinue: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────

export function CompletionCinematic({
  visible,
  expeditionName,
  totalElevationM,
  onContinue,
}: CompletionCinematicProps) {
  const insets = useSafeAreaInsets();

  // Native video ref
  const nativeVideoRef = useRef<Video>(null);
  // Web video ref — typed as any to avoid importing DOM lib types into RN project
  const webVideoRef = useRef<any>(null);

  // ── Reanimated shared values — correct on both web and native ─────────────
  const modalOpacity   = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);
  const modalStyle     = useAnimatedStyle(() => ({ opacity: modalOpacity.value }));
  const overlayStyle   = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  const [overlayMounted, setOverlayMounted]   = useState(false);
  const overlayShownRef                        = useRef(false);

  // ── Trigger overlay (shared by both native status cb and web event) ───────
  const triggerOverlay = useCallback(() => {
    if (overlayShownRef.current) return;
    overlayShownRef.current = true;
    setOverlayMounted(true);
    overlayOpacity.value = withTiming(1, { duration: 600 });
  }, []);

  // ── Reset + fade-in on every open ─────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      modalOpacity.value   = 0;
      overlayOpacity.value = 0;
      setOverlayMounted(false);
      overlayShownRef.current = false;
      return;
    }

    modalOpacity.value   = 0;
    overlayOpacity.value = 0;
    setOverlayMounted(false);
    overlayShownRef.current = false;

    // Seek native video to start
    nativeVideoRef.current?.setPositionAsync(0).catch(() => {});
    // Seek web video to start
    if (webVideoRef.current) {
      webVideoRef.current.currentTime = 0;
      webVideoRef.current.play?.().catch(() => {});
    }

    // Snap black background instantly, then briefly fade up so the cut feels
    // cinematic rather than jarring.
    modalOpacity.value = withTiming(1, { duration: 250 });
  }, [visible]);

  // ── Native playback status ─────────────────────────────────────────────────
  const handleNativeStatus = useCallback(
    (status: import("expo-av").AVPlaybackStatus) => {
      if (!status.isLoaded) return;
      const pos = status.positionMillis ?? 0;
      const dur = status.durationMillis ?? 0;
      if ((dur > 0 && pos >= dur - 1000) || status.didJustFinish) {
        triggerOverlay();
      }
    },
    [triggerOverlay],
  );

  // ── Share ──────────────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message:
          `🏔️ I just completed the ${expeditionName} expedition on SummitReady!\n` +
          `Total elevation climbed: ${Math.round(totalElevationM).toLocaleString()}m`,
        title: "Expedition Complete!",
      });
    } catch {
      // cancelled
    }
  }, [expeditionName, totalElevationM]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="none"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={onContinue}
    >
      <Animated.View style={[styles.root, modalStyle]}>

        {/* ── Video layer ─────────────────────────────────────────────────── */}
        <View style={[StyleSheet.absoluteFill, styles.videoContainer]}>
          {Platform.OS === "web" ? (
            // Native HTML <video> — correctly sizes to 100%/100% and respects
            // object-fit:contain regardless of the video's intrinsic resolution.
            <video
              ref={webVideoRef}
              // Metro resolves require() to a URL string on web
              src={COMPLETION_VIDEO as string}
              style={{
                width:      "100%",
                height:     "100%",
                objectFit:  "contain",
                background: "#000",
                display:    "block",
              }}
              autoPlay={visible}
              playsInline
              controls={false}
              loop={false}
              muted={false}
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
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={visible}
              isLooping={false}
              isMuted={false}
              onPlaybackStatusUpdate={handleNativeStatus}
              useNativeControls={false}
            />
          )}
        </View>

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

              <View style={styles.statRow}>
                <Text style={styles.statValue}>
                  {Math.round(totalElevationM).toLocaleString()}m
                </Text>
                <Text style={styles.statLabel}>Total elevation climbed</Text>
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
      </Animated.View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: "#000",
  },
  videoContainer: {
    backgroundColor: "#000",
  },
  video: {
    flex: 1,
  },

  // ── Overlay ────────────────────────────────────────────────────────────────
  overlayContainer: {
    justifyContent: "flex-end",
  },
  overlayContent: {
    alignItems:       "center",
    paddingHorizontal: 28,
    paddingTop:        32,
  },
  badge: {
    fontSize:      11,
    fontWeight:    "700",
    color:         T.green,
    letterSpacing: 2,
    borderWidth:   1,
    borderColor:   T.green,
    borderRadius:  20,
    paddingHorizontal: 12,
    paddingVertical:    4,
    marginBottom:  20,
    overflow:      "hidden",
  },
  overlayTitle: {
    fontSize:      28,
    fontWeight:    "800",
    color:         "#fff",
    textAlign:     "center",
    marginBottom:  24,
    letterSpacing: -0.5,
  },
  statRow: {
    alignItems:   "center",
    marginBottom: 28,
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
    width:          "100%",
    height:         54,
    borderRadius:   14,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems:     "center",
    justifyContent: "center",
  },
  continueBtnText: {
    fontSize:   17,
    fontWeight: "600",
    color:      "#fff",
  },
});
