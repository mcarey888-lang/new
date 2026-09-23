/**
 * The paired progression tiles: Elevation Bank and this week's training.
 *
 * Composition from the prototype — two equal panels side by side, each with a
 * tracked-out label, one large figure and a small visual of its own.
 *
 * ELEVATION BANK reads the Elevation Bank service through `useElevationBank()`.
 * The prototype shows "banked of required" with a percentage bar; production
 * has no "required" figure, and this task does not invent one, so the tile
 * shows what the bank actually reports: credited lifetime ascent, the current
 * period, and the Everest equivalent the service itself supplies. Loading,
 * unavailable, empty and signed-out each render inside the same tile at the
 * same size — a state the bank cannot serve must not turn into a large
 * utility card in the middle of the composition.
 *
 * TRAINING PROGRESS reads the Training Plan's current week through
 * `weekProgress()`. Bar heights come from each session's own prescribed
 * ascent. Neither tile calculates anything.
 */
import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { BarChart3, ChevronRight, Mountain, RefreshCw } from "lucide-react-native";
import { BASECAMP, HIT, MOTION } from "@/constants/tokens";
import { SRPanel } from "@/components/ui";
import { useElevationBank } from "@/hooks/useElevationBank";
import { formatElevationBankMetres } from "@/utils/elevationBankPresentation";
import type { WeekProgress } from "@/utils/basecampPresentation";

const BAR_MAX_H = 34;
const BAR_MIN_H = 6;

/**
 * A week can prescribe anything from two sessions to a full seven. The strip
 * narrows rather than overflowing the tile, so the figure beside it keeps its
 * room at every screen width.
 */
function barGeometry(count: number) {
  if (count >= 7) return { width: 4, gap: 3 };
  if (count >= 5) return { width: 5, gap: 3 };
  return { width: 6, gap: 4 };
}

export function ProgressTiles({
  week, onOpenBank, onOpenPlan,
}: {
  week: WeekProgress | null;
  onOpenBank: () => void;
  onOpenPlan: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(MOTION.stagger * 3).duration(MOTION.enter)}
      style={styles.row}
    >
      <ElevationBankTile onPress={onOpenBank} />
      {week ? <WeekTile week={week} onPress={onOpenPlan} /> : null}
    </Animated.View>
  );
}

/* ── Elevation Bank ────────────────────────────────────────────────────── */

function ElevationBankTile({ onPress }: { onPress: () => void }) {
  const { presentation, isSignedIn, refetch } = useElevationBank();

  const body = (() => {
    if (presentation.kind === "loading") {
      return (
        <View style={styles.quietState} testID="basecamp-bank-loading">
          <ActivityIndicator size="small" color={BASECAMP.accent} />
          <Text style={styles.quietText}>Reading your ledger…</Text>
        </View>
      );
    }
    if (!isSignedIn) {
      return (
        <View style={styles.quietState} testID="basecamp-bank-signed-out">
          <Text style={styles.quietText}>Sign in to see your credited ascent.</Text>
        </View>
      );
    }
    if (presentation.kind === "unavailable") {
      return (
        <View style={styles.quietState} testID="basecamp-bank-unavailable">
          <Text style={styles.dashValue}>—</Text>
          <Text style={styles.quietText}>Being prepared. Your history is unchanged.</Text>
          <TouchableOpacity
            onPress={refetch}
            hitSlop={HIT.slop}
            style={styles.retry}
            accessibilityRole="button"
            accessibilityLabel="Retry loading your Elevation Bank"
            testID="basecamp-bank-retry"
          >
            <RefreshCw size={11} color={BASECAMP.accent} />
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (presentation.kind === "empty") {
      return (
        <View style={styles.quietState} testID="basecamp-bank-empty">
          <Text style={styles.dashValue}>0 m</Text>
          <Text style={styles.quietText}>
            Recorded GPS ascent is credited here once its evidence qualifies.
          </Text>
        </View>
      );
    }

    const data = presentation.data;
    return (
      <View testID="basecamp-bank-values">
        <Text
          style={styles.tileValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {formatElevationBankMetres(data.lifetimeAscentM)}
        </Text>
        <Text style={styles.tileCaption} numberOfLines={1}>credited ascent</Text>
        <View style={styles.bankFooter}>
          <Text style={styles.bankFact} numberOfLines={1}>
            +{formatElevationBankMetres(data.periodAscentM)} this month
          </Text>
          <Text style={styles.bankFact} numberOfLines={1}>
            {data.everestEquivalent.toFixed(1)} Everests
          </Text>
        </View>
      </View>
    );
  })();

  return (
    <SRPanel
      radius={16}
      style={styles.tile}
      onPress={onPress}
      accessibilityLabel="Elevation Bank"
      accessibilityHint="Opens your elevation history"
      testID="basecamp-bank-tile"
    >
      <View style={styles.tileInner}>
        <View style={styles.tileHead}>
          <Mountain size={15} color={BASECAMP.accent} />
          <Text style={styles.tileLabel} numberOfLines={1}>ELEVATION BANK</Text>
          <ChevronRight size={13} color={BASECAMP.textDim} />
        </View>
        <View style={styles.tileBody}>{body}</View>
      </View>
    </SRPanel>
  );
}

/* ── This week ─────────────────────────────────────────────────────────── */

function WeekTile({ week, onPress }: { week: WeekProgress; onPress: () => void }) {
  const bar = barGeometry(week.bars.length);
  return (
    <SRPanel
      radius={16}
      style={styles.tile}
      onPress={onPress}
      accessibilityLabel={`This week: ${week.completed} of ${week.total} sessions complete`}
      accessibilityHint="Opens your training plan"
      testID="basecamp-week-tile"
    >
      <View style={styles.tileInner}>
        <View style={styles.tileHead}>
          <BarChart3 size={15} color={BASECAMP.accent} />
          <Text style={styles.tileLabel} numberOfLines={1}>THIS WEEK</Text>
          <ChevronRight size={13} color={BASECAMP.textDim} />
        </View>

        <View style={styles.tileBody}>
          <View style={styles.weekRow}>
            <View style={styles.weekCount}>
              <Text
                style={styles.tileValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {week.completed}
                <Text style={styles.weekTotal}> / {week.total}</Text>
              </Text>
              <Text style={styles.tileCaption} numberOfLines={2}>sessions done</Text>
            </View>

            <View
              style={[styles.bars, { gap: bar.gap }]}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`Week ${week.weekNumber} progress`}
              accessibilityValue={{ min: 0, max: 100, now: week.percent }}
            >
              {week.bars.map(b => (
                <View key={b.key} style={styles.barColumn}>
                  <View
                    style={[
                      styles.bar,
                      {
                        width: bar.width,
                        height: Math.max(BAR_MIN_H, Math.round(b.load * BAR_MAX_H)),
                        backgroundColor: b.done ? BASECAMP.accent : "rgba(255,255,255,0.16)",
                      },
                    ]}
                  />
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </SRPanel>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 9,
    paddingHorizontal: BASECAMP.gutter,
    marginTop: 13,
  },
  tile: { flex: 1, minWidth: 0 },
  tileInner: { padding: 13, flex: 1 },
  tileHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  tileLabel: {
    flex: 1, minWidth: 0,
    fontSize: 8.5, lineHeight: 11, fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.3, color: BASECAMP.textMuted,
  },
  tileBody: { marginTop: 11, flex: 1, justifyContent: "flex-end" },
  tileValue: {
    fontSize: 22, lineHeight: 26, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: -0.8,
  },
  tileCaption: {
    fontSize: 10, lineHeight: 13, fontFamily: "Inter_400Regular",
    color: BASECAMP.textDim, marginTop: 3,
  },

  bankFooter: { marginTop: 9, gap: 2 },
  bankFact: { fontSize: 10, lineHeight: 13, fontFamily: "Inter_500Medium", color: BASECAMP.textMuted },

  quietState: { gap: 5 },
  quietText: { fontSize: 10.5, lineHeight: 14, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  dashValue: { fontSize: 22, lineHeight: 26, fontFamily: "Inter_700Bold", color: BASECAMP.textDim },
  retry: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2, alignSelf: "flex-start" },
  retryText: { fontSize: 10.5, lineHeight: 14, fontFamily: "Inter_600SemiBold", color: BASECAMP.accent },

  weekRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 },
  weekCount: { flexShrink: 1, minWidth: 0 },
  weekTotal: { color: BASECAMP.textFaint },
  bars: { flexDirection: "row", alignItems: "flex-end", flexShrink: 0 },
  barColumn: { alignItems: "center" },
  bar: { borderRadius: 3 },
});
