/**
 * ModeTogglePill — persistent Training / Expeditions shell switcher.
 *
 * One compact Basecamp-style switch is rendered by each tab shell's layout.
 * It has the same top offset and switching behavior on every main screen.
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

export function ModeTogglePill() {
  const insets  = useSafeAreaInsets();
  const { shellMode, setShellMode, activeExpeditionId } = useApp();
  const switchingRef = useRef(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const top = Platform.OS === "web" ? 20 : insets.top + 12;

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
    <View style={s.pill}>
      {/* Training segment */}
      <TouchableOpacity
        onPress={() => { void switchTo("training"); }}
        disabled={isSwitching}
        activeOpacity={0.75}
        style={[
          s.segment,
          shellMode === "training" && { backgroundColor: TRAINING_COLOR },
        ]}
        accessibilityRole="tab"
        accessibilityState={{ selected: shellMode === "training", disabled: isSwitching }}
        accessibilityLabel="Training mode"
      >
        <Text style={[
          s.label,
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
          shellMode === "expedition" && { backgroundColor: EXPEDITION_COLOR },
        ]}
        accessibilityRole="tab"
        accessibilityState={{ selected: shellMode === "expedition", disabled: isSwitching }}
        accessibilityLabel="Expeditions mode"
      >
        <Text style={[
          s.label,
          shellMode === "expedition"
            ? s.labelActive
            : { color: "rgba(255,255,255,0.45)" },
        ]}>
          Expeditions
        </Text>
      </TouchableOpacity>
    </View>
  );

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
    borderRadius: 11,
    overflow: "hidden",
    backgroundColor: "rgba(12,20,36,0.76)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 3,
    paddingVertical: 3,
    gap: 0,
  },
  segment: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  labelActive: {
    color: "#fff",
  },
});
