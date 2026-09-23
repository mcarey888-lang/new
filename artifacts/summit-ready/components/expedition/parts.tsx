/**
 * Expedition — the shared premium presentation pieces.
 *
 * Basecamp, Progress and the Library all describe the same journey, so they
 * draw it with the same parts rather than each inventing a card. Nothing here
 * reads app state or derives progress: every figure arrives already selected
 * by `selectExpeditionPresentation()`, which is the one place that decides
 * what simulated progress is.
 *
 * ── THE PROGRESS MOUNTAIN IS NOT HERE ─────────────────────────────────────
 * The existing production Progress Mountain and its summit cinematic are
 * protected components. Nothing in this folder draws a mountain, a summit
 * animation or a route line. Basecamp keeps rendering the real one; these
 * pieces sit around it.
 */
import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Check, Lock } from "lucide-react-native";
import { BASECAMP, EXPLORE, RADIUS, SP, TYPE } from "@/constants/tokens";
import type { ExpeditionStagePresentationStatus } from "@/utils/expeditionProgress";

/* ── ProgressRing ─────────────────────────────────────────────────────────
   A ring whose sweep is the real percentage. The arc starts at 3 o'clock in
   SVG, so it is rotated −90° to begin at the top, and the cap is butt so a
   round cap cannot make 0% look like a sliver of progress. */
export function ProgressRing({
  percent, size = 42, stroke = 4, tone = EXPLORE.accent,
}: { percent: number; size?: number; stroke?: number; tone?: string }) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(percent) ? percent : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size} accessible={false}>
      <Circle
        cx={size / 2} cy={size / 2} r={r}
        stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} fill="none"
      />
      <Circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={tone} strokeWidth={stroke} fill="none"
        strokeDasharray={`${c * clamped} ${c}`}
        strokeLinecap="butt"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

/* ── StageDot ─────────────────────────────────────────────────────────────
   Completed, current and locked read differently by SHAPE and ICON, not by
   colour alone — colour is not a signal everyone receives. */
export function StageDot({
  status, label, size = 28,
}: { status: ExpeditionStagePresentationStatus; label: string; size?: number }) {
  const done = status === "completed";
  const current = status === "current";
  const tone = done || current ? EXPLORE.accent : BASECAMP.textDim;
  return (
    <View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2, borderColor: tone },
        done && { backgroundColor: EXPLORE.accent },
        current && { backgroundColor: EXPLORE.accentDim },
      ]}
    >
      {done ? (
        <Check size={size * 0.45} color={EXPLORE.accentInk} strokeWidth={3} />
      ) : status === "locked" ? (
        <Lock size={size * 0.4} color={BASECAMP.textDim} />
      ) : (
        <Text style={[styles.dotText, { fontSize: size * 0.39, color: current ? EXPLORE.accent : BASECAMP.textMuted }]}>
          {label}
        </Text>
      )}
    </View>
  );
}

/* ── StatTrio ─────────────────────────────────────────────────────────────
   Three figures in a row. A value of null shows an em dash — it is never
   rendered as a zero, which would read as a real measurement. */
export function StatTrio({
  items, style,
}: {
  items: { key: string; value: string | null; label: string; sub?: string | null }[];
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.trio, style]}>
      {items.map(item => (
        <View key={item.key} style={styles.trioItem}>
          <Text
            style={styles.trioValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {item.value ?? "—"}
          </Text>
          <Text style={styles.trioLabel} numberOfLines={2}>{item.label}</Text>
          {item.sub ? <Text style={styles.trioSub} numberOfLines={1}>{item.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/** Metres, grouped, with the unit. Null in, null out. */
export function metres(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${Math.round(value).toLocaleString()} m`;
}

const styles = StyleSheet.create({
  dot: { borderWidth: 2, alignItems: "center", justifyContent: "center" },
  dotText: { fontFamily: "Inter_700Bold" },

  trio: { flexDirection: "row", gap: SP.sm },
  trioItem: { flex: 1, minWidth: 0 },
  trioValue: { fontSize: 15, lineHeight: 19, fontFamily: "Inter_700Bold", color: BASECAMP.text },
  trioLabel: { marginTop: 1, fontSize: 9.5, lineHeight: 12, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  trioSub: { fontSize: 9, lineHeight: 11, fontFamily: "Inter_400Regular", color: BASECAMP.textFaint },
});

export const EXPEDITION_RADIUS = RADIUS.xl;
export const EXPEDITION_TYPE = TYPE;
