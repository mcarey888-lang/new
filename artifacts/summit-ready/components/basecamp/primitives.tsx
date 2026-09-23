/**
 * Training Basecamp primitives.
 *
 * The surfaces and section furniture from the approved prototype, in the three
 * treatments it actually uses: `.panel` (a dark green-tinted gradient, the
 * screen's primary surface), `.panel-sub` (a quieter nested surface) and the
 * tracked-out section eyebrow with a trailing action.
 *
 * Presentation only. Nothing here reads app state.
 */
import React from "react";
import {
  StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight } from "lucide-react-native";
import { BASECAMP } from "@/constants/tokens";
import { HIT } from "@/constants/tokens";

/* ── BasecampPanel ─────────────────────────────────────────────────────────
   The prototype's `.panel`: a 158° gradient with a hairline border. Rendered
   as a gradient rather than a flat fill because the tint is what stops the
   screen reading as a stack of generic grey cards. */
export function BasecampPanel({
  children, style, radius = 18, padded = 0, onPress, accessibilityLabel, accessibilityHint, testID,
}: {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  radius?: number;
  padded?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}) {
  /* The caller's style has to land on the OUTERMOST element. Putting it on an
     inner view left a pressable panel sizing itself to its content, which
     silently dropped `flex: 1` and made the paired tiles overflow their row. */
  const composed = [
    styles.panel,
    { borderRadius: radius },
    padded ? { padding: padded } : null,
    style,
  ];
  const surface = (
    <LinearGradient
      colors={BASECAMP.panelGradient}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      pointerEvents="none"
    />
  );

  if (!onPress) {
    return <View style={composed} testID={testID}>{surface}{children}</View>;
  }
  return (
    <TouchableOpacity
      style={composed}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
    >
      {surface}
      {children}
    </TouchableOpacity>
  );
}

/* ── BasecampSubPanel ─────────────────────────────────────────────────── */
export function BasecampSubPanel({
  children, style, radius = 14,
}: { children?: React.ReactNode; style?: ViewStyle | ViewStyle[]; radius?: number }) {
  return <View style={[styles.subPanel, { borderRadius: radius }, style]}>{children}</View>;
}

/* ── SectionHeader ─────────────────────────────────────────────────────────
   `UP NEXT` + `View full plan →`. The action keeps a 44pt target even though
   the label itself is small. */
export function BasecampSectionHeader({
  title, action, onAction, style,
}: { title: string; action?: string; onAction?: () => void; style?: ViewStyle }) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{title.toUpperCase()}</Text>
      {action && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          hitSlop={HIT.slop}
          style={styles.sectionAction}
          accessibilityRole="button"
          accessibilityLabel={action}
        >
          <Text style={styles.sectionActionText}>{action}</Text>
          <ChevronRight size={14} color={BASECAMP.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** The small tracked-out label that sits above a figure or a title. */
export function Eyebrow({ children, tone, style }: { children: React.ReactNode; tone?: string; style?: TextStyle }) {
  return <Text style={[styles.eyebrow, tone ? { color: tone } : null, style]} numberOfLines={1}>{children}</Text>;
}

/** A thin vertical rule between inline facts, as the prototype uses. */
export function FactDivider() {
  return <View style={styles.factDivider} />;
}

const styles = StyleSheet.create({
  panel: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BASECAMP.panelBorder,
  },
  subPanel: {
    backgroundColor: BASECAMP.panelSub,
    borderWidth: 1,
    borderColor: BASECAMP.panelSubBorder,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 24,
  },
  sectionTitle: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 2,
    color: BASECAMP.textMuted,
    flexShrink: 1,
  },
  sectionAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: HIT.minTarget,
    paddingLeft: 10,
  },
  sectionActionText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Inter_500Medium",
    color: BASECAMP.textMuted,
  },
  eyebrow: {
    fontSize: 9.5,
    lineHeight: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.8,
    color: BASECAMP.textMuted,
  },
  factDivider: {
    width: 1,
    height: 11,
    backgroundColor: BASECAMP.textFaint,
  },
});
