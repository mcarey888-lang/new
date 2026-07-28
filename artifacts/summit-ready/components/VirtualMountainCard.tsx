/**
 * VirtualMountainCard — matches the designer mockup exactly.
 *
 * Structure (top → bottom):
 *  1. Hero section: real image (or category gradient) with overlaid name / flag / subtitle
 *  2. Body: tagline row (left) + animated progress ring (right)
 *  3. Stats row: icon-labelled badges — route type, difficulty, duration, optional 4th
 *  4. Divider
 *  5. Data row: "Your Equivalent Hills" chips + "Total Elevation" block
 *  6. Thin bottom progress bar (accent-coloured)
 *
 * Each category (Alpine / Trek / Technical / Classic) has its own accent colour used
 * consistently throughout the card.
 */

import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Image as ExpoImage } from "expo-image";

// Same pattern used by every other screen in the app
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";
import { LinearGradient } from "expo-linear-gradient";
import {
  Mountain, Footprints, Zap, Leaf, BarChart2,
  Clock, Star, Sun, Calendar, Lock,
} from "lucide-react-native";
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
}> = {
  Alpine: {
    accent: "#3ECF75",
    dim:    "rgba(62,207,117,0.14)",
    heroGrad: ["#061A0E", "#0D3020", "#071509"],
  },
  Trek: {
    accent: "#FF9030",
    dim:    "rgba(255,144,48,0.14)",
    heroGrad: ["#1E0C04", "#341808", "#1A0A04"],
  },
  Technical: {
    accent: "#9B7FD4",
    dim:    "rgba(155,127,212,0.14)",
    heroGrad: ["#0E0820", "#1C1038", "#100A28"],
  },
  Classic: {
    accent: "#20CFCF",
    dim:    "rgba(32,207,207,0.14)",
    heroGrad: ["#041616", "#0A2E2E", "#051818"],
  },
};

// ── Difficulty ─────────────────────────────────────────────────────────────────

function diffDisplay(d: VirtualBundle["difficulty"]): { label: string; color: string } {
  switch (d) {
    case "Easy":     return { label: "Easy",     color: "#3ECF75" };
    case "Moderate": return { label: "Moderate", color: "#4A9FF5" };
    case "Hard":     return { label: "Hard",     color: "#FF9030" };
    case "Alpine":   return { label: "Expert",   color: "#FF4444" };
  }
}

// ── Route-type icon per label ──────────────────────────────────────────────────

function RouteTypeIcon({ label, size, color }: { label: string; size: number; color: string }) {
  if (label === "Trek" || label === "Trail") return <Footprints size={size} color={color} />;
  if (label === "Technical")                 return <Zap         size={size} color={color} />;
  return                                            <Mountain    size={size} color={color} />;
}

// ── Context-badge icon ─────────────────────────────────────────────────────────

function ContextIcon({ badge, size, color }: { badge: string; size: number; color: string }) {
  const b = badge.toLowerCase();
  if (b.includes("altitude"))   return <Mountain  size={size} color={color} />;
  if (b.includes("technical"))  return <Zap       size={size} color={color} />;
  if (b.includes("beginner"))   return <Leaf      size={size} color={color} />;
  if (b.includes("iconic"))     return <Star      size={size} color={color} />;
  if (b.includes("desert"))     return <Sun       size={size} color={color} />;
  if (b.includes("multi"))      return <Calendar  size={size} color={color} />;
  return                               <Mountain  size={size} color={color} />;
}

// ── Animated progress ring ─────────────────────────────────────────────────────

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function MiniRing({ pct, size, strokeWidth, accent }: {
  pct: number; size: number; strokeWidth: number; accent: string;
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
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth}
        />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={accent} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          animatedProps={animProps}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ alignItems: "center", gap: 1 }}>
        <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: accent, lineHeight: 19 }}>
          {pct}%
        </Text>
        <Text style={{ fontSize: 6, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.38)", letterSpacing: 0.8, textTransform: "uppercase" }}>
          COMPLETE
        </Text>
      </View>
    </View>
  );
}

// ── Stat badge ─────────────────────────────────────────────────────────────────

function StatBadge({
  icon, label, color,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <View style={[s.statBadge, { borderColor: color + "35" }]}>
      {icon}
      <Text style={[s.statBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ── Hill chip ──────────────────────────────────────────────────────────────────

function HillChip({ name, accent }: { name: string; accent: string }) {
  return (
    <View style={[s.chip, { backgroundColor: accent + "18", borderColor: accent + "40" }]}>
      <Text style={[s.chipText, { color: accent }]} numberOfLines={1}>{name}</Text>
    </View>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface VirtualMountainCardProps {
  bundle: VirtualBundle;
  locked: boolean;
  onPress: () => void;
  progressPct: number;
  elevationGained: number;
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
  const diff   = diffDisplay(bundle.difficulty);

  const MAX_CHIPS  = 3;
  const visible    = equivalentHills.slice(0, MAX_CHIPS);
  const overflow   = equivalentHills.length - MAX_CHIPS;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={locked ? 0.6 : 0.88}
      style={[s.card, { borderColor: accent + "28" }, locked && { opacity: 0.62 }]}
    >
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <View style={s.heroWrap}>

        {/* Category gradient always sits behind the photo as a fallback */}
        <LinearGradient
          colors={cat.heroGrad}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Remote mountain photo — fetched via /api/mountain-image (Wikipedia / Mapbox) */}
        <ExpoImage
          source={{ uri: `${API_BASE}/mountain-image?name=${encodeURIComponent(bundle.goalMountain)}&width=800&height=340` }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={400}
        />

        {/* Bottom scrim for name legibility */}
        <LinearGradient
          colors={["transparent", "rgba(8,18,32,0.75)", "#0A1628"]}
          style={s.heroScrim}
          locations={[0, 0.5, 1]}
        />

        {/* Category badge — top-left */}
        <View style={[s.catBadge, { backgroundColor: accent + "22", borderColor: accent + "55" }]}>
          <Text style={[s.catBadgeText, { color: accent }]}>
            {bundle.category.toUpperCase()}
          </Text>
        </View>

        {/* Lock overlay */}
        {locked && (
          <View style={s.lockOverlay}>
            <View style={s.lockCircle}>
              <Lock size={20} color="rgba(255,255,255,0.7)" />
            </View>
          </View>
        )}

        {/* Mountain name + flag + subtitle — overlaid bottom-left */}
        <View style={s.heroNameBlock}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={s.heroName}>{bundle.goalMountain}</Text>
            <Text style={{ fontSize: 20 }}>{bundle.flag}</Text>
          </View>
          <Text style={s.heroSub}>
            {bundle.summitElevation.toLocaleString()}m · {bundle.country}
          </Text>
        </View>
      </View>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <View style={s.body}>

        {/* Tagline row + progress ring */}
        <View style={s.taglineRow}>
          <Text style={s.tagline} numberOfLines={3}>
            {bundle.tagline}
          </Text>
          {/* Ring with dark circle bg */}
          <View style={[s.ringBg, { borderColor: accent + "20" }]}>
            <MiniRing pct={progressPct} size={78} strokeWidth={5} accent={accent} />
          </View>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <StatBadge
            icon={<RouteTypeIcon label={bundle.routeTypeLabel} size={11} color={T.textMuted} />}
            label={bundle.routeTypeLabel}
            color={T.textMuted}
          />
          <StatBadge
            icon={<BarChart2 size={11} color={diff.color} />}
            label={diff.label}
            color={diff.color}
          />
          <StatBadge
            icon={<Clock size={11} color={T.textMuted} />}
            label={bundle.duration}
            color={T.textMuted}
          />
          {bundle.contextBadge ? (
            <StatBadge
              icon={<ContextIcon badge={bundle.contextBadge} size={11} color={accent} />}
              label={bundle.contextBadge}
              color={accent}
            />
          ) : null}
        </View>

        {/* Divider */}
        <View style={s.divider} />

        {/* Hills + elevation */}
        <View style={s.dataRow}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={s.dataLabel}>YOUR EQUIVALENT HILLS</Text>
            <View style={s.chipsRow}>
              {visible.map(h => <HillChip key={h} name={h} accent={accent} />)}
              {overflow > 0 && (
                <HillChip name={`+${overflow} more`} accent={T.textMuted} />
              )}
            </View>
          </View>

          <View style={{ alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Mountain size={9} color={accent} />
              <Text style={s.dataLabel}>TOTAL ELEVATION</Text>
            </View>
            <Text style={[s.elevGained, { color: T.white }]}>
              {elevationGained.toLocaleString()}m
              <Text style={s.elevGoal}> / {bundle.totalElevationGain.toLocaleString()}m</Text>
            </Text>
          </View>
        </View>
      </View>

      {/* ── Bottom progress bar ────────────────────────────────────────────── */}
      <View style={s.barTrack}>
        <View style={[s.barFill, {
          width: `${Math.min(100, progressPct)}%` as `${number}%`,
          backgroundColor: accent,
        }]} />
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    backgroundColor: "#0A1525",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 14,
  },

  // Hero
  heroWrap: {
    height: 168,
    overflow: "hidden",
  },
  heroScrim: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    height: 88,
  },
  catBadge: {
    position: "absolute",
    top: 12, left: 12,
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
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  lockCircle: {
    width: 46, height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroNameBlock: {
    position: "absolute",
    bottom: 10, left: 14, right: 100,
    gap: 2,
    zIndex: 2,
  },
  heroName: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    lineHeight: 28,
  },
  heroSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
  },

  // Body
  body: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
    backgroundColor: "#0A1525",
  },

  // Tagline row + ring
  taglineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 78,
  },
  tagline: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    lineHeight: 19,
  },
  ringBg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#060E1C",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  statBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
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
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  elevGained: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    lineHeight: 20,
    marginTop: 2,
  },
  elevGoal: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: T.textDim,
  },

  // Bottom bar
  barTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
  barFill: {
    height: 3,
  },
});
