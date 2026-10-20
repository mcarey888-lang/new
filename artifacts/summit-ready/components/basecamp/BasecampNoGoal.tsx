import { ChevronRight, Compass, Mountain } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { BASECAMP, RADIUS, SP, TYPE } from "@/constants/tokens";
import { openExpeditionExplore } from "@/utils/openExpeditionExplore";

const EXPLANATIONS = [
  { k: "Training plan", v: "Once you choose a summit, your weekly sessions are built around that mountain and your available days." },
  { k: "Readiness", v: "Readiness is calculated from your logged training against the mountain's demands. It stays empty until you have a goal and activity." },
  { k: "Coach", v: "Your coach reads your plan and logged activity. It has nothing to assess until a goal is set." },
];

/** Training Basecamp with no summit goal. Shows no invented progress. */
export function BasecampNoGoal() {
  const insets = useSafeAreaInsets();
  const { setShellMode } = useApp();
  const busy = useRef(false);
  const [switching, setSwitching] = useState(false);
  const [exploreError, setExploreError] = useState<string | null>(null);

  async function explore() {
    if (busy.current) return;
    busy.current = true;
    setSwitching(true);
    setExploreError(null);
    try {
      await openExpeditionExplore(setShellMode, () => router.replace("/(expedition)/mountains"));
    } catch {
      setExploreError("Couldn't open Explore. Please try again.");
    } finally {
      busy.current = false;
      setSwitching(false);
    }
  }

  return (
    <LinearGradient colors={[BASECAMP.ink, "#0A1114", BASECAMP.ink]} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: Platform.OS === "web" ? 72 : insets.top + 56,
          paddingBottom: Platform.OS === "web" ? 110 : insets.bottom + 130,
          paddingHorizontal: BASECAMP.gutter,
          gap: SP.stack,
        }}
      >
        <View style={{ gap: 6, marginBottom: SP.xs }}>
          <Text style={s.eyebrow}>TRAINING BASECAMP</Text>
          <Text style={s.title}>Pick a mountain to train for</Text>
          <Text style={s.body}>Your plan, readiness and coach all start from one summit goal.</Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/questionnaire")}
          activeOpacity={0.88}
          style={s.primary}
          accessibilityRole="button"
          accessibilityLabel="Set your summit goal"
        >
          <LinearGradient colors={[BASECAMP.accentDim, "transparent"]} style={StyleSheet.absoluteFill} />
          <View style={s.icon}><Mountain size={22} color={BASECAMP.accent} /></View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={s.primaryTitle}>Set your summit goal</Text>
            <Text style={s.small}>Choose a target and we will build your training plan.</Text>
          </View>
          <ChevronRight size={20} color={BASECAMP.accent} />
        </TouchableOpacity>

        <View style={s.panel}>
          {EXPLANATIONS.map((e, i) => (
            <View key={e.k} style={[s.row, i > 0 && s.rowDivider]}>
              <Text style={s.eyebrow}>{e.k.toUpperCase()}</Text>
              <Text style={s.small}>{e.v}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={() => { void explore(); }}
          disabled={switching}
          activeOpacity={0.8}
          style={s.secondary}
          accessibilityRole="button"
          accessibilityLabel="Explore mountains"
          accessibilityHint="Switches to Expedition mode and opens Explore"
          accessibilityState={{ disabled: switching, busy: switching }}
          testID="no-goal-explore"
        >
          <Compass size={16} color={BASECAMP.text} />
          <Text style={s.secondaryText}>{switching ? "Opening Explore…" : "Explore mountains"}</Text>
          <ChevronRight size={16} color={BASECAMP.textDim} />
        </TouchableOpacity>
        <Text style={s.small}>Browse mountains in Expedition mode. Come back to Training whenever you are ready to choose your goal.</Text>
        {exploreError && <Text accessibilityRole="alert" style={s.small}>{exploreError}</Text>}
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  eyebrow: { ...TYPE.eyebrow, color: BASECAMP.accent },
  title: { ...TYPE.title, color: BASECAMP.text },
  body: { ...TYPE.body, color: BASECAMP.textMuted },
  small: { ...TYPE.small, lineHeight: 18, color: BASECAMP.textMuted },
  primary: {
    flexDirection: "row", alignItems: "center", gap: SP.md, padding: SP.lg, overflow: "hidden",
    borderRadius: RADIUS.xl, borderWidth: 1, borderColor: BASECAMP.accentLine, backgroundColor: BASECAMP.panelSub,
  },
  icon: {
    width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center",
    backgroundColor: BASECAMP.accentDim,
  },
  primaryTitle: { ...TYPE.heading, color: BASECAMP.text },
  panel: {
    borderRadius: RADIUS.xl, borderWidth: 1, borderColor: BASECAMP.panelBorder,
    backgroundColor: BASECAMP.panelSub, paddingHorizontal: SP.lg,
  },
  row: { paddingVertical: SP.md, gap: 4 },
  rowDivider: { borderTopWidth: 1, borderTopColor: BASECAMP.hairline },
  secondary: {
    minHeight: 48, flexDirection: "row", alignItems: "center", gap: SP.sm, paddingHorizontal: SP.lg,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: BASECAMP.glassBorder, backgroundColor: BASECAMP.glass,
  },
  secondaryText: { ...TYPE.bodyBold, color: BASECAMP.text, flex: 1 },
});
