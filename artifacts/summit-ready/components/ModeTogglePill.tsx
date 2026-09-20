/**
 * ModeTogglePill — persistent Training / Expeditions shell switcher.
 *
 * Rendered as an absolutely-positioned overlay inside each shell's _layout.tsx
 * so it appears in both the Training and Expedition tabs at all times.
 *
 * The pill sits within the OS status-bar / safe-area zone that screens already
 * leave empty, so it does not overlap any content on either iOS or web.
 */

import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "@/constants/theme";
import { useApp } from "@/context/AppContext";

const TRAINING_COLOR    = T.green;
const EXPEDITION_COLOR  = T.blue;

export function ModeTogglePill({ embedded = false }: { embedded?: boolean }) {
  const insets  = useSafeAreaInsets();
  const { shellMode, setShellMode, activeExpeditionId } = useApp();
  const switchingRef = useRef(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const top = insets.top + (Platform.OS === "web" ? 8 : 4);

  async function switchTo(mode: "training" | "expedition") {
    if (mode === shellMode || switchingRef.current) return;

    switchingRef.current = true;
    setIsSwitching(true);
    try {
      await setShellMode(mode);
      if (mode === "expedition") {
        router.replace(
          activeExpeditionId
            ? "/(expedition)/base-camp"
            : "/(expedition)/mountains" as any,
        );
      } else {
        router.replace("/(tabs)/dashboard" as any);
      }
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      console.error(
        `[mode-switch] Could not switch to ${mode}`,
        normalized.message,
        normalized.stack ?? "Stack trace unavailable",
      );
      Alert.alert(
        "Couldn't switch modes",
        "SummitReady couldn't open that mode. Please try again.",
      );
    } finally {
      switchingRef.current = false;
      setIsSwitching(false);
    }
  }

  const pill = (
    <View style={[s.pill, embedded && s.pillEmbedded]}>
      {/* Training segment */}
      <TouchableOpacity
        onPress={() => { void switchTo("training"); }}
        disabled={isSwitching}
        activeOpacity={0.75}
        style={[
          s.segment,
          embedded && s.segmentEmbedded,
          shellMode === "training" && { backgroundColor: TRAINING_COLOR },
        ]}
        accessibilityRole="tab"
        accessibilityState={{ selected: shellMode === "training", disabled: isSwitching }}
        accessibilityLabel="Training mode"
      >
        <Text style={[
          s.label,
          embedded && s.labelEmbedded,
          shellMode === "training"
            ? s.labelActive
            : { color: "rgba(255,255,255,0.45)" },
        ]}>
          Training
        </Text>
      </TouchableOpacity>

      {/* Divider */}
      <View style={s.divider} />

      {/* Expeditions segment */}
      <TouchableOpacity
        onPress={() => { void switchTo("expedition"); }}
        disabled={isSwitching}
        activeOpacity={0.75}
        style={[
          s.segment,
          embedded && s.segmentEmbedded,
          shellMode === "expedition" && { backgroundColor: EXPEDITION_COLOR },
        ]}
        accessibilityRole="tab"
        accessibilityState={{ selected: shellMode === "expedition", disabled: isSwitching }}
        accessibilityLabel="Expeditions mode"
      >
        <Text style={[
          s.label,
          embedded && s.labelEmbedded,
          shellMode === "expedition"
            ? s.labelActive
            : { color: "rgba(255,255,255,0.45)" },
        ]}>
          Expeditions
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (embedded) {
    return (
      <View style={[s.plainBg, s.plainBgEmbedded]}>
        {pill}
      </View>
    );
  }

  return (
    <View
      style={[s.wrapper, { top }]}
      pointerEvents="box-none"
    >
      <View style={s.plainBg}>
        {pill}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 200,
    pointerEvents: "box-none",
  } as any,
  plainBg: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "rgba(12,20,36,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  plainBgEmbedded: {
    backgroundColor: "rgba(12,20,36,0.76)",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 0,
  },
  pillEmbedded: {
    paddingHorizontal: 3,
    paddingVertical: 3,
  },
  segment: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentEmbedded: {
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  labelEmbedded: {
    fontSize: 10,
  },
  labelActive: {
    color: "#fff",
  },
});
