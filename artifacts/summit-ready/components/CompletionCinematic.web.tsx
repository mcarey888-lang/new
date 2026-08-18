import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
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

const COMPLETION_VIDEO = require("../assets/videos/completion.mp4");

interface CompletionCinematicProps {
  visible: boolean;
  preload?: boolean;
  expeditionName: string;
  totalElevationM: number;
  onContinue: () => void;
}

/**
 * Web-specific summit cinematic.
 *
 * Metro's web runtime can return the app HTML document for React.lazy chunks,
 * which makes the previous dynamic import fail with `Unexpected token '<'`.
 * Keeping this component free of expo-av lets Base Camp import it normally,
 * while native continues to lazy-load the protected expo-av implementation.
 */
export function CompletionCinematic({
  visible,
  expeditionName,
  totalElevationM,
  onContinue,
}: CompletionCinematicProps) {
  const insets = useSafeAreaInsets();
  const videoRef = useRef<any>(null);
  const videoOpacity = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);
  const [overlayMounted, setOverlayMounted] = useState(false);
  const overlayShownRef = useRef(false);

  const videoStyle = useAnimatedStyle(() => ({ opacity: videoOpacity.value }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  const triggerOverlay = useCallback(() => {
    if (overlayShownRef.current) return;
    overlayShownRef.current = true;
    setOverlayMounted(true);
    overlayOpacity.value = withTiming(1, { duration: 600 });
  }, [overlayOpacity]);

  useEffect(() => {
    if (!visible) {
      videoOpacity.value = 0;
      overlayOpacity.value = 0;
      setOverlayMounted(false);
      overlayShownRef.current = false;
      return;
    }

    videoOpacity.value = 0;
    overlayOpacity.value = 0;
    setOverlayMounted(false);
    overlayShownRef.current = false;

    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play?.().catch(() => {});
    }
  }, [visible, overlayOpacity, videoOpacity]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message:
          `🏔️ I just completed the ${expeditionName} expedition on SummitReady!\n`
          + `Total elevation climbed: ${Math.round(totalElevationM).toLocaleString()}m`,
        title: "Expedition Complete!",
      });
    } catch {
      // User cancelled the share sheet.
    }
  }, [expeditionName, totalElevationM]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onContinue}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, videoStyle]}>
          <video
            ref={videoRef}
            src={COMPLETION_VIDEO as string}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
            autoPlay={visible}
            playsInline
            controls={false}
            onCanPlay={() => {
              videoOpacity.value = withTiming(1, { duration: 200 });
            }}
            onTimeUpdate={(event: any) => {
              const element = event.currentTarget;
              if (
                Number.isFinite(element.duration)
                && element.duration > 0
                && element.currentTime >= element.duration - 1
              ) {
                triggerOverlay();
              }
            }}
            onEnded={triggerOverlay}
            onError={triggerOverlay}
          />
        </Animated.View>

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
              <Text style={styles.title}>{expeditionName}</Text>

              <View style={styles.statRow}>
                <Text style={styles.statValue}>
                  {Math.round(totalElevationM).toLocaleString()}m
                </Text>
                <Text style={styles.statLabel}>Total elevation climbed</Text>
              </View>

              <View style={styles.divider} />

              <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.8}>
                <Text style={styles.shareButtonText}>🏆  Share Achievement</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.continueButton} onPress={onContinue} activeOpacity={0.8}>
                <Text style={styles.continueButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  overlayContainer: { justifyContent: "flex-end" },
  overlayContent: {
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 32,
  },
  badge: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: T.green,
    letterSpacing: 2,
    borderWidth: 1,
    borderColor: T.green,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 20,
    overflow: "hidden",
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 24,
  },
  statRow: { alignItems: "center", marginBottom: 28 },
  statValue: {
    fontSize: 52,
    lineHeight: 58,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -1.5,
  },
  statLabel: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.62)",
  },
  divider: {
    width: 48,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.24)",
    marginBottom: 28,
  },
  shareButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.green,
    marginBottom: 10,
  },
  shareButtonText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#07110B",
  },
  continueButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  continueButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});