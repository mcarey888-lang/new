/**
 * SummitReady reusable UI primitives — extracted while integrating Journey 1.
 *
 * Deliberately small. These are the pieces that were being re-typed across
 * Training Basecamp, Full Readiness and the Training Plan; they are not a
 * speculative design system. Colours come from `constants/theme.ts`, everything
 * else from `constants/tokens.ts`.
 */
import React from "react";
import { StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle } from "react-native";
import { T } from "@/constants/theme";
import { HIT, RADIUS, SP, SURFACE, TYPE } from "@/constants/tokens";

/* ── SRSurface ─────────────────────────────────────────────────────────────
   The panel / panel-sub / glass treatments from the approved kit. */
export function SRSurface({
  children, variant = "panel", style, padded = true,
}: {
  children?: React.ReactNode;
  variant?: "panel" | "panelSub" | "glass";
  style?: ViewStyle | ViewStyle[];
  padded?: boolean;
}) {
  return (
    <View style={[
      SURFACE[variant],
      { borderRadius: RADIUS.lg },
      padded && { padding: SP.md },
      style,
    ]}>
      {children}
    </View>
  );
}

/* ── SRSectionHeader ───────────────────────────────────────────────────────
   Tracked-out eyebrow with an optional trailing action. */
export function SRSectionHeader({
  title, action, onAction, style,
}: { title: string; action?: string; onAction?: () => void; style?: ViewStyle }) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={styles.eyebrow} accessibilityRole="header">{title.toUpperCase()}</Text>
      {action ? (
        <TouchableOpacity
          onPress={onAction}
          hitSlop={HIT.slop}
          accessibilityRole="button"
          accessibilityLabel={action}
          style={styles.sectionAction}
        >
          <Text style={styles.sectionActionText}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/* ── SRMetric ──────────────────────────────────────────────────────────────
   A figure with a label. `value` accepts null so "unknown" can never be
   rendered as zero — it shows an em dash instead. */
export function SRMetric({
  value, label, sub, size = "md", tone, align = "left", style,
}: {
  value: string | number | null | undefined;
  label: string;
  sub?: string | null;
  size?: "md" | "lg";
  tone?: string;
  align?: "left" | "center";
  style?: ViewStyle;
}) {
  const shown = value === null || value === undefined ? "—" : String(value);
  return (
    <View style={[{ minWidth: 0, alignItems: align === "center" ? "center" : "flex-start" }, style]}>
      <Text
        style={[size === "lg" ? TYPE.metricLg : TYPE.metric, { color: tone ?? T.basecampText }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {shown}
      </Text>
      <Text style={styles.metricLabel} numberOfLines={2}>{label}</Text>
      {sub ? <Text style={styles.metricSub} numberOfLines={2}>{sub}</Text> : null}
    </View>
  );
}

/* ── SRStatusPill ──────────────────────────────────────────────────────── */
export function SRStatusPill({
  label, tone = T.blue, icon, style,
}: { label: string; tone?: string; icon?: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.pill, { borderColor: `${tone}66`, backgroundColor: `${tone}1F` }, style]}>
      {icon}
      <Text style={[styles.pillText, { color: tone }]} numberOfLines={1}>{label.toUpperCase()}</Text>
    </View>
  );
}

/* ── SRProgress ────────────────────────────────────────────────────────────
   A track with an earned fill and, optionally, a visually distinct projected
   extension drawn beyond it — never in place of it. */
export function SRProgress({
  value, projected, tone = T.green, projectedTone = T.blue, height = 7, style, accessibilityLabel,
}: {
  value: number;
  projected?: number | null;
  tone?: string;
  projectedTone?: string;
  height?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const projPct = projected === null || projected === undefined
    ? null : Math.max(pct, Math.min(100, projected));
  return (
    <View
      style={[{ height, borderRadius: height / 2, backgroundColor: "rgba(255,255,255,0.09)", overflow: "hidden" }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
    >
      {projPct !== null && projPct > pct ? (
        <View style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${projPct}%`, backgroundColor: `${projectedTone}59`,
          borderRadius: height / 2,
        }} />
      ) : null}
      <View style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: `${pct}%`, backgroundColor: tone, borderRadius: height / 2,
      }} />
    </View>
  );
}

/* ── SRButton ──────────────────────────────────────────────────────────────
   Always at least the minimum touch target. */
export function SRButton({
  label, onPress, variant = "primary", icon, disabled, style, accessibilityHint,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "quiet";
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
}) {
  const v = {
    primary:   { backgroundColor: T.green, color: "#04140A", borderColor: "transparent" },
    secondary: { backgroundColor: "rgba(255,255,255,0.08)", color: T.basecampText, borderColor: T.basecampBorder },
    quiet:     { backgroundColor: "transparent", color: T.basecampTextMuted, borderColor: "transparent" },
  }[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        styles.button,
        { backgroundColor: v.backgroundColor, borderColor: v.borderColor },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      {icon}
      <Text style={[styles.buttonText, { color: v.color }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: SP.sm, minHeight: 20,
  },
  eyebrow: { ...TYPE.eyebrow, color: T.basecampTextMuted, flexShrink: 1 } as TextStyle,
  sectionAction: { minHeight: HIT.minTarget, justifyContent: "center", paddingLeft: SP.sm },
  sectionActionText: { ...TYPE.smallBold, color: T.blue } as TextStyle,
  metricLabel: { ...TYPE.caption, color: T.basecampTextMuted, marginTop: 3 } as TextStyle,
  metricSub: { ...TYPE.caption, color: T.basecampTextDim, marginTop: 2 } as TextStyle,
  pill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: SP.sm, paddingVertical: 3,
    borderRadius: RADIUS.sm, borderWidth: 1, alignSelf: "flex-start",
  },
  pillText: { fontSize: 10, lineHeight: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  button: {
    minHeight: HIT.minTarget, borderRadius: RADIUS.md, borderWidth: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SP.sm, paddingHorizontal: SP.lg,
  },
  buttonText: { ...TYPE.bodyBold } as TextStyle,
});
