/**
 * Elevation Bank — the hero card, from the approved mockup.
 *
 * PRESENTATION ONLY. Every figure arrives as a prop: this component computes
 * nothing, reads no query and estimates nothing. Credit rules, qualification
 * and the lifetime total all stay behind the Elevation Bank API, and the
 * derived figures come from `utils/elevationBankHero.ts`.
 *
 * Two things in the mockup are deliberately conditional rather than assumed:
 *
 * - **"+28% vs last year"** renders only when a real year-on-year figure is
 *   supplied. Nothing in `ElevationBankResponse` carries last year's banked
 *   ascent, so for most users there is no such number and the card simply does
 *   not show one.
 * - **The photograph** is optional and comes from the caller's existing image
 *   resolver. With none, the card keeps its designed gradient rather than
 *   reaching for a stand-in.
 *
 * The mockup is a wide landscape card. On a phone the two halves stack, and
 * the stat row stays four-across because that grouping is the point of it.
 */

import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Flag, Footprints, Info, Mountain, TrendingUp } from "lucide-react-native";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

import { BASECAMP, EXPLORE } from "@/constants/tokens";
import { barFractions, formatBankMetres, type MonthlyGain } from "@/utils/elevationBankHero";

/** Above this the card lays out as the mockup's landscape composition. */
const WIDE_BREAKPOINT = 640;

/* The plot is sized in points, not percentages. A percentage height inside a
   flex parent has no definite basis to resolve against, and every bar
   collapses to nothing — which is exactly what happened the first time. */
const PLOT_HEIGHT = 86;
const LABEL_HEIGHT = 18;

export interface ElevationBankHeroProps {
  /** Lifetime credited ascent, in metres. From `lifetimeAscentM`. */
  lifetimeAscentM: number;
  /** Credited activities. From `creditedActivities`. */
  hikes: number;
  /** Distinct summits. Null when the caller cannot establish it. */
  mountains: number | null;
  /** Saved expeditions. Null when unknown. */
  expeditions: number | null;
  /** Whole hours of moving time. Null when unknown. */
  movingHours: number | null;
  /** Consecutive months of banked ascent, oldest first. */
  monthly: readonly MonthlyGain[];
  /** Whole-percent change on the previous year, or null when not computable. */
  yearOnYearPercent?: number | null;
  /** Place photography from the existing resolver. Never a hard-coded asset. */
  photoUri?: string | null;
  onPress?: () => void;
  onInfoPress?: () => void;
  testID?: string;
}

function YearOnYear({ percent, compact }: { percent: number; compact?: boolean }) {
  const positive = percent >= 0;
  const tone = positive ? BASECAMP.accent : "#FF7A5A";
  return (
    <View style={s.yoyRow}>
      <TrendingUp
        size={compact ? 13 : 18}
        color={tone}
        style={positive ? undefined : { transform: [{ scaleY: -1 }] }}
      />
      <Text style={[compact ? s.yoyValueSmall : s.yoyValue, { color: tone }]}>
        {positive ? "+" : ""}{percent}%
      </Text>
      <Text style={compact ? s.yoyCaptionSmall : s.yoyCaption}>vs last year</Text>
    </View>
  );
}

function Stat({
  icon, value, label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View style={s.stat}>
      <View style={s.statIcon}>{icon}</View>
      <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={s.statLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

/** The monthly bars. Scaled to the tallest month, so a quiet year still reads. */
function MonthlyChart({
  series, yearOnYear, wide,
}: {
  series: readonly MonthlyGain[];
  yearOnYear?: number | null;
  wide: boolean;
}) {
  const fractions = barFractions(series);
  return (
    <View style={[s.chartBlock, wide && s.chartBlockWide]}>
      <View style={s.chartHead}>
        <Text style={s.chartTitle}>MONTHLY ELEVATION GAIN</Text>
        {typeof yearOnYear === "number" ? <YearOnYear percent={yearOnYear} compact /> : null}
      </View>

      <View style={s.chartPlot}>
        {/* Gridlines sit behind the bars and carry no values of their own —
            they are a reading aid, not an axis. */}
        <View style={s.gridlines} pointerEvents="none">
          {[0, 1, 2, 3].map(line => <View key={line} style={s.gridline} />)}
        </View>

        <View style={s.bars}>
          {series.map((month, i) => (
            <View key={`${month.monthIndex}-${i}`} style={s.barColumn}>
              <View style={s.barTrack}>
                <View
                  style={[
                    s.bar,
                    /* A month with no ascent draws no bar at all. */
                    { height: Math.round(Math.max(0, fractions[i]) * PLOT_HEIGHT) },
                  ]}
                />
              </View>
              <Text style={s.barLabel} numberOfLines={1}>{month.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export function ElevationBankHero({
  lifetimeAscentM,
  hikes,
  mountains,
  expeditions,
  movingHours,
  monthly,
  yearOnYearPercent,
  photoUri,
  onPress,
  onInfoPress,
  testID = "elevation-bank-hero",
}: ElevationBankHeroProps) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;

  const label = `Elevation bank, ${formatBankMetres(lifetimeAscentM)} metres banked`;

  const body = (
    <>
      {/* The card's own surface. Drawn rather than a flat colour so the blue
          lift in the mockup survives on both platforms. */}
      <LinearGradient
        colors={["#0B1B2B", "#081522", "#060F18"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[s.head, wide && s.headWide]}>
        <View style={[s.headLeft, wide && s.headLeftWide]}>
          <View style={s.titleRow}>
            <View style={s.mark}>
              <Mountain size={wide ? 30 : 22} color={EXPLORE.accent} />
            </View>
            <Text style={s.title}>ELEVATION BANK</Text>
            <TouchableOpacity
              onPress={onInfoPress}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="What is the Elevation Bank?"
              accessibilityRole="button"
              disabled={!onInfoPress}
            >
              <Info size={wide ? 20 : 15} color={BASECAMP.textDim} />
            </TouchableOpacity>
          </View>

          <View style={s.figureRow}>
            <Text
              style={[s.figure, wide && s.figureWide]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {formatBankMetres(lifetimeAscentM)}
            </Text>
            <Text style={[s.figureUnit, wide && s.figureUnitWide]}>m</Text>
          </View>

          {typeof yearOnYearPercent === "number"
            ? <YearOnYear percent={yearOnYearPercent} />
            : null}
        </View>

        {/* Place photography, bleeding off the right edge and faded into the
            card. Mountain photography may bleed; this is never exercise art. */}
        {photoUri ? (
          <View style={[s.photoWrap, wide ? s.photoWrapWide : s.photoWrapNarrow]}>
            <ExpoImage
              source={{ uri: photoUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={220}
              accessible={false}
            />
            <LinearGradient
              colors={[
                "#081522", "rgba(8,21,34,0.92)", "rgba(8,21,34,0.55)", "rgba(8,21,34,0.12)",
              ]}
              locations={[0, 0.18, 0.46, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </View>
        ) : null}
      </View>

      <View style={s.divider} />

      <View style={[s.foot, wide && s.footWide]}>
        <View style={[s.statRow, wide && s.statRowWide]}>
          <Stat
            icon={<Footprints size={20} color={EXPLORE.accent} />}
            value={String(hikes)}
            label="Hikes"
          />
          <View style={s.statDivider} />
          <Stat
            icon={<Mountain size={20} color={EXPLORE.accent} />}
            value={mountains === null ? "—" : String(mountains)}
            label="Mountains"
          />
          <View style={s.statDivider} />
          <Stat
            icon={<Flag size={20} color={EXPLORE.accent} />}
            value={expeditions === null ? "—" : String(expeditions)}
            label="Expeditions"
          />
          <View style={s.statDivider} />
          <Stat
            icon={<TrendingUp size={20} color={EXPLORE.accent} />}
            value={movingHours === null ? "—" : `${movingHours} h`}
            label="Moving Time"
          />
        </View>

        {monthly.length > 0 ? (
          <>
            {wide ? <View style={s.statDivider} /> : null}
            <MonthlyChart series={monthly} yearOnYear={yearOnYearPercent} wide={wide} />
          </>
        ) : null}
      </View>
    </>
  );

  /* Written out rather than swapping a component type at runtime: the dynamic
     version could not be typed without erasing its props. */
  if (onPress) {
    return (
      <TouchableOpacity
        style={s.card}
        onPress={onPress}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={testID}
      >
        {body}
      </TouchableOpacity>
    );
  }

  return (
    <View style={s.card} accessibilityLabel={label} testID={testID}>
      {body}
    </View>
  );
}

const HAIRLINE = "rgba(255,255,255,0.08)";

const s = StyleSheet.create({
  card: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(22,125,247,0.22)",
    backgroundColor: "#081522",
  },

  /* ── Head ── */
  head: { paddingTop: 18, paddingBottom: 16 },
  headWide: { flexDirection: "row", alignItems: "stretch", paddingTop: 26, paddingBottom: 24 },
  headLeft: { paddingHorizontal: 18, zIndex: 2 },
  headLeftWide: { flex: 1, minWidth: 0, paddingHorizontal: 30, justifyContent: "center" },

  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: { alignItems: "center", justifyContent: "center" },
  title: {
    fontSize: 14, lineHeight: 18, fontFamily: "Inter_700Bold",
    letterSpacing: 1.6, color: "#93A8BE",
  },

  figureRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 10 },
  figure: {
    fontSize: 46, lineHeight: 52, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: -1.5,
  },
  figureWide: { fontSize: 76, lineHeight: 84, letterSpacing: -2.5 },
  figureUnit: {
    fontSize: 26, lineHeight: 34, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, marginLeft: 6, letterSpacing: -0.5,
  },
  figureUnitWide: { fontSize: 44, lineHeight: 58, marginLeft: 10 },

  yoyRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 8 },
  yoyValue: { fontSize: 19, lineHeight: 24, fontFamily: "Inter_700Bold" },
  yoyValueSmall: { fontSize: 12.5, lineHeight: 16, fontFamily: "Inter_700Bold" },
  yoyCaption: { fontSize: 15, lineHeight: 20, fontFamily: "Inter_400Regular", color: "#7C93AB" },
  yoyCaptionSmall: { fontSize: 11, lineHeight: 15, fontFamily: "Inter_400Regular", color: "#7C93AB" },

  /* The photograph is clipped to the card and fades leftwards into it. */
  photoWrap: { overflow: "hidden" },
  photoWrapWide: { flex: 1.05, minWidth: 0, marginTop: -26, marginBottom: -24 },
  photoWrapNarrow: {
    position: "absolute", right: 0, top: 0, bottom: 0, left: "38%", opacity: 0.6,
  },

  divider: { height: 1, backgroundColor: HAIRLINE },

  /* ── Foot ── */
  foot: { paddingVertical: 16 },
  footWide: { flexDirection: "row", alignItems: "stretch", paddingVertical: 20 },

  statRow: { flexDirection: "row", alignItems: "stretch", paddingHorizontal: 8 },
  statRowWide: { flex: 1, minWidth: 0, paddingHorizontal: 18, alignSelf: "center" },
  stat: { flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: 4, gap: 5 },
  statIcon: { height: 24, justifyContent: "center" },
  statValue: {
    fontSize: 23, lineHeight: 28, fontFamily: "Inter_700Bold", color: BASECAMP.text,
  },
  statLabel: {
    textAlign: "center", fontSize: 11, lineHeight: 14, fontFamily: "Inter_400Regular", color: "#7C93AB",
  },
  statDivider: { width: 1, backgroundColor: HAIRLINE, marginVertical: 2 },

  /* ── Chart ── */
  chartBlock: { paddingHorizontal: 18, paddingTop: 16, flex: 1, minWidth: 0 },
  chartBlockWide: { alignSelf: "center" },
  chartHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: 10, marginBottom: 10,
  },
  chartTitle: {
    fontSize: 10.5, lineHeight: 14, fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2, color: "#7C93AB",
  },
  chartPlot: { height: PLOT_HEIGHT + LABEL_HEIGHT },
  gridlines: {
    ...StyleSheet.absoluteFillObject, bottom: LABEL_HEIGHT, justifyContent: "space-between",
  },
  gridline: { height: 1, backgroundColor: "rgba(255,255,255,0.05)" },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 5 },
  barColumn: { flex: 1, minWidth: 0, alignItems: "center" },
  barTrack: { width: "100%", height: PLOT_HEIGHT, justifyContent: "flex-end" },
  bar: {
    width: "100%", borderRadius: 3, minHeight: 0,
    backgroundColor: EXPLORE.accent,
  },
  barLabel: {
    marginTop: 5, height: LABEL_HEIGHT - 5,
    fontSize: 9.5, lineHeight: 13, fontFamily: "Inter_400Regular", color: "#66809A",
  },
});
