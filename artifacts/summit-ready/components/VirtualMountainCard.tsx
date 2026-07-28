/**
 * VirtualMountainCard
 *
 * Full 9-element mountain card for the Virtual Mountains browse list.
 * Each category (Alpine / Trek / Technical / Classic) has its own accent
 * colour used consistently throughout: hero gradient, progress ring,
 * chips, bottom bar.
 */

import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Mountain, Lock } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { T } from "@/constants/theme";
import type { VirtualBundle, BundleCategory } from "@/data/virtualBundles";

// ── Category config ────────────────────────────────────────────────────────────

const CATEGORY: Record<BundleCategory, {
  accent: string;
  dim: string;
  heroGrad: readonly [string, string, string];
  label: string;
}> = {
  Alpine: {
    accent: "#3ECF75",
    dim:    "rgba(62,207,117,0.14)",
    heroGrad: ["#061A0E", "#0D3020", "#071509"],
    label: "Alpine",
  },
  Trek: {
    accent: "#FF9030",
    dim:    "rgba(255,144,48,0.14)",
    heroGrad: ["#1E0C04", "#341808", "#1A0A04"],
    label: "Trek",
  },
  Technical: {
    accent: "#9B7FD4",
    dim:    "rgba(155,127,212,0.14)",
    heroGrad: ["#0E0820", "#1C1038", "#100A28"],
    label: "Technical",
  },
  Classic: {
    accent: "#20CFCF",
    dim:    "rgba(32,207,207,0.14)",
    heroGrad: ["#041616", "#0A2E2E", "#051818"],
    label: "Classic",
  },
};

// ── Difficulty tier ────────────────────────────────────────────────────────────

function diffTier(d: VirtualBundle["difficulty"]): { label: string; color: string } {
  switch (d) {
    case "Easy":     return { label: "Easy",     color: "#3ECF75" };
    case "Moderate": return { label: "Moderate", color: "#4A9FF5" };
    case "Hard":     return { label: "Hard",     color: "#FF9030" };
    case "Alpine":   return { label: "Expert",   color: "#FF4444" };
  }
}

// ── Animated SVG ring ──────────────────────────────────────────────────────────

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function MiniRing({
  pct,
  size,
  strokeWidth,
  accent,
}: {
  pct: number;
  size: number;
  strokeWidth: number;
  accent: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(pct / 100, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct]);

  const animProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={strokeWidth}
        />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={accent}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          animatedProps={animProps}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ alignItems: "center", gap: 1 }}>
        <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: accent, lineHeight: 18 }}>
          {pct}%
        </Text>
        <Text style={{ fontSize: 6, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.35)", letterSpacing: 0.8, textTransform: "uppercase" }}>
          COMPLETE
        </Text>
      </View>
    </View>
  );
}

// ── Small stat badge ───────────────────────────────────────────────────────────

function StatBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[s.statBadge, { backgroundColor: bg, borderColor: color + "40" }]}>
      <Text style={[s.statBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ── Hill chip ──────────────────────────────────────────────────────────────────

function HillChip({ name, accent }: { name: string; accent: string }) {
  return (
    <View style={[s.hillChip, { backgroundColor: accent + "18", borderColor: accent + "35" }]}>
      <Text style={[s.hillChipText, { color: accent }]} numberOfLines={1}>{name}</Text>
    </View>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface VirtualMountainCardProps {
  bundle: VirtualBundle;
  locked: boolean;
  onPress: () => void;
  /** 0-100 percentage of elevation goal achieved (from active virtual goal) */
  progressPct: number;
  /** Metres of elevation gained so far */
  elevationGained: number;
  /** Real matched hill names (use exampleHills if no API result yet) */
  equivalentHills: string[];
}

// ── Card ───────────────────────────────────────────────────────────────────────

export function VirtualMountainCard({
  bundle,
  locked,
  onPress,
  progressPct,
  elevationGained,
  equivalentHills,
}: VirtualMountainCardProps) {
  const cat    = CATEGORY[bundle.category];
  const accent = cat.accent;
  const diff   = diffTier(bundle.difficulty);

  // Chip overflow: show up to 3 hills + "+N more" chip
  const MAX_CHIPS = 3;
  const visibleHills = equivalentHills.slice(0, MAX_CHIPS);
  const overflow     = equivalentHills.length - MAX_CHIPS;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={locked ? 0.6 : 0.88}
      style={[s.card, locked && { opacity: 0.65 }]}
    >
      {/* ── Hero section ──────────────────────────────────────────────────── */}
      <View style={s.heroWrap}>
        <LinearGradient
          colors={cat.heroGrad}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        {/* Category badge — top-left */}
        <View style={[s.catBadge, { backgroundColor: accent + "22", borderColor: accent + "55" }]}>
          <Text style={[s.catBadgeText, { color: accent }]}>{cat.label.toUpperCase()}</Text>
        </View>

        {/* Lock overlay */}
        {locked && (
          <View style={s.lockOverlay}>
            <View style={s.lockCircle}>
              <Lock size={18} color="rgba(255,255,255,0.7)" />
            </View>
          </View>
        )}

        {/* Large mountain emoji — centred */}
        <View style={s.heroEmoji}>
          <Text style={{ fontSize: 52, lineHeight: 60 }}>{bundle.emoji}</Text>
        </View>

        {/* Gradient scrim at bottom of hero for text legibility */}
        <LinearGradient
          colors={["transparent", "#0A1628"]}
          style={s.heroScrim}
        />
      </View>

      {/* ── Card body ─────────────────────────────────────────────────────── */}
      <View style={s.body}>
        {/* Name row + progress ring */}
        <View style={s.nameRow}>
          {/* Left: name / subtitle / tagline / stats */}
          <View style={{ flex: 1, gap: 4 }}>
            {/* Flag + mountain name */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Text style={{ fontSize: 16 }}>{bundle.flag}</Text>
              <Text style={s.mountainName} numberOfLines={2}>{bundle.goalMountain}</Text>
            </View>
            {/* Subtitle */}
            <Text style={s.mountainSub}>
              {bundle.summitElevation.toLocaleString()}m · {bundle.country}
            </Text>
            {/* Tagline */}
            <Text style={s.tagline} numberOfLines={3}>{bundle.tagline}</Text>
            {/* Quick stats */}
            <View style={s.statsRow}>
              <StatBadge label={diff.label}       color={diff.color}           bg={diff.color + "18"} />
              <StatBadge label={bundle.duration}  color={T.textMuted}          bg="rgba(255,255,255,0.05)" />
              <StatBadge label={bundle.contextBadge} color={accent}            bg={accent + "14"} />
            </View>
          </View>

          {/* Right: progress ring */}
          <View style={s.ringWrap}>
            <MiniRing pct={progressPct} size={72} strokeWidth={5} accent={accent} />
          </View>
        </View>

        {/* Divider */}
        <View style={s.divider} />

        {/* Hills + elevation row */}
        <View style={s.dataRow}>
          {/* Equivalent hills */}
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={s.dataLabel}>YOUR EQUIVALENT HILLS</Text>
            <View style={s.chipsRow}>
              {visibleHills.map(h => (
                <HillChip key={h} name={h} accent={accent} />
              ))}
              {overflow > 0 && (
                <HillChip name={`+${overflow} more`} accent={T.textMuted} />
              )}
            </View>
          </View>

          {/* Total elevation */}
          <View style={s.elevBlock}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 3 }}>
              <Mountain size={9} color={accent} />
              <Text style={s.dataLabel}>ELEVATION</Text>
            </View>
            <Text style={[s.elevGained, { color: accent }]}>
              {elevationGained.toLocaleString()}m
            </Text>
            <Text style={s.elevGoal}>
              / {bundle.totalElevationGain.toLocaleString()}m
            </Text>
          </View>
        </View>
      </View>

      {/* ── Bottom progress bar ────────────────────────────────────────────── */}
      <View style={s.barTrack}>
        <View
          style={[
            s.barFill,
            {
              width: `${Math.min(100, progressPct)}%` as `${number}%`,
              backgroundColor: accent,
            },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    backgroundColor: "#0D1E30",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginBottom: 14,
  },

  // Hero
  heroWrap: {
    height: 128,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  heroEmoji: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  heroScrim: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    height: 50,
  },
  catBadge: {
    position: "absolute",
    top: 10,
    left: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    zIndex: 2,
  },
  catBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  lockCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Body
  body: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  mountainName: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: T.white,
    flex: 1,
  },
  mountainSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    marginTop: -2,
  },
  tagline: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: T.textDim,
    lineHeight: 17,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 2,
  },
  statBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },

  // Ring
  ringWrap: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 2,
    flexShrink: 0,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  // Data row
  dataRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  dataLabel: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: T.textDim,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  hillChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  hillChipText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  elevBlock: {
    alignItems: "flex-end",
    flexShrink: 0,
    minWidth: 80,
  },
  elevGained: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    lineHeight: 18,
  },
  elevGoal: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: T.textDim,
    marginTop: 1,
  },

  // Progress bar
  barTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
  barFill: {
    height: 3,
  },
});
