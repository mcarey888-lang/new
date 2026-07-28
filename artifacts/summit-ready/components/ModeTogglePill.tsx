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
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { T } from "@/constants/theme";
import { useApp } from "@/context/AppContext";

const TRAINING_COLOR    = T.green;
const EXPEDITION_COLOR  = T.blue;

export function ModeTogglePill() {
  const insets  = useSafeAreaInsets();
  const isIOS   = Platform.OS === "ios";
  const { shellMode, setShellMode } = useApp();

  const top = insets.top + (Platform.OS === "web" ? 8 : 4);

  async function switchTo(mode: "training" | "expedition") {
    if (mode === shellMode) return;
    await setShellMode(mode);
    if (mode === "expedition") {
      router.replace("/(expedition)/base-camp" as any);
    } else {
      router.replace("/(tabs)/dashboard" as any);
    }
  }

  const pill = (
    <View style={s.pill}>
      {/* Training segment */}
      <TouchableOpacity
        onPress={() => switchTo("training")}
        activeOpacity={0.75}
        style={[
          s.segment,
          shellMode === "training" && { backgroundColor: TRAINING_COLOR },
        ]}
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
        onPress={() => switchTo("expedition")}
        activeOpacity={0.75}
        style={[
          s.segment,
          shellMode === "expedition" && { backgroundColor: EXPEDITION_COLOR },
        ]}
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
      {isIOS ? (
        <BlurView intensity={55} tint="dark" style={s.blurWrap}>
          {pill}
        </BlurView>
      ) : (
        <View style={s.plainBg}>
          {pill}
        </View>
      )}
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
  blurWrap: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  plainBg: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "rgba(12,20,36,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 0,
  },
  segment: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
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
  labelActive: {
    color: "#fff",
  },
});
