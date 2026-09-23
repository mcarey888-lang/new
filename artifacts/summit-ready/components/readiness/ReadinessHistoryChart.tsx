/**
 * The Readiness history chart.
 *
 * Draws whatever `useReadinessHistory` produced by replaying the engine at past
 * dates — and nothing when it produced too little. A chart is a claim about a
 * trend, so with fewer than two real points this renders the designed empty
 * state instead of a line.
 *
 * The y-axis is fixed at 0–100 for every period, so switching period cannot
 * make a flat month look like a climb.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import { BarChart3 } from "lucide-react-native";
import { BASECAMP } from "@/constants/tokens";
import { SREmptyState, SRPanel, SRSectionHeader, SRSegmented } from "@/components/ui";
import {
  HISTORY_PERIODS, historyAreaPath, historyAxisTicks, historyLinePath, plotHistory,
  type HistoryPeriod, type ReadinessHistorySeries,
} from "@/utils/readinessHistory";

const GEO = { width: 360, height: 132, padLeft: 30, padRight: 18, padTop: 14, padBottom: 22 };

export function ReadinessHistoryChart({
  series, period, onPeriodChange,
}: {
  series: ReadinessHistorySeries | null;
  period: HistoryPeriod;
  onPeriodChange: (p: HistoryPeriod) => void;
}) {
  const plotted = series ? plotHistory(series, GEO) : null;
  const baselineY = GEO.height - GEO.padBottom;
  const last = plotted && plotted.points.length > 0
    ? plotted.points[plotted.points.length - 1]
    : null;

  /* Crowded axes are unreadable at 320pt, so labels thin out rather than
     overlap: every other point once there are more than five. */
  const labelEvery = plotted && plotted.points.length > 5 ? 2 : 1;

  return (
    <SRPanel radius={16} style={styles.panel}>
      <View style={styles.inner}>
        <View style={styles.head}>
          <SRSectionHeader
            title="Readiness history"
            icon={<BarChart3 size={13} color={BASECAMP.accent} />}
            style={styles.headerFlex}
          />
          <SRSegmented
            compact
            options={HISTORY_PERIODS.map(p => ({ value: p, label: p }))}
            value={period}
            onChange={onPeriodChange}
          />
        </View>

        {plotted && series && last ? (
          <>
            <View
              style={styles.chartWrap}
              accessible
              accessibilityRole="image"
              accessibilityLabel={
                `Readiness over ${period}: ${series.points
                  .map(p => `${p.label} ${p.score} percent`).join(", ")}`
              }
            >
              <Svg viewBox={`0 0 ${GEO.width} ${GEO.height}`} width="100%" height={GEO.height}>
                <Defs>
                  <LinearGradient id="srHistFill" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={BASECAMP.accent} stopOpacity="0.28" />
                    <Stop offset="100%" stopColor={BASECAMP.accent} stopOpacity="0" />
                  </LinearGradient>
                </Defs>

                {historyAxisTicks().map(v => (
                  <G key={v}>
                    <Line
                      x1={GEO.padLeft} y1={plotted.yFor(v)}
                      x2={GEO.width - GEO.padRight} y2={plotted.yFor(v)}
                      stroke="rgba(255,255,255,0.07)" strokeWidth={1}
                    />
                    <SvgText
                      x={GEO.padLeft - 6} y={plotted.yFor(v) + 3.4}
                      textAnchor="end" fontSize={8.5} fill="rgba(255,255,255,0.40)"
                    >
                      {`${v}%`}
                    </SvgText>
                  </G>
                ))}

                <Path d={historyAreaPath(plotted.points, baselineY)} fill="url(#srHistFill)" />
                <Path
                  d={historyLinePath(plotted.points)}
                  fill="none" stroke={BASECAMP.accent} strokeWidth={2}
                  strokeLinecap="round" strokeLinejoin="round"
                />

                {plotted.points.map(p => (
                  <Circle
                    key={p.at} cx={p.x} cy={p.y} r={3.2}
                    fill={BASECAMP.ink} stroke={BASECAMP.accent} strokeWidth={2}
                  />
                ))}
                <Circle
                  cx={last.x} cy={last.y} r={4.8}
                  fill={BASECAMP.accent} stroke={BASECAMP.ink} strokeWidth={2}
                />

                {plotted.points.map((p, i) =>
                  (i % labelEvery === 0 || i === plotted.points.length - 1) ? (
                    <SvgText
                      key={`l-${p.at}`} x={p.x} y={GEO.height - 6}
                      textAnchor="middle" fontSize={8.5} fill="rgba(255,255,255,0.40)"
                    >
                      {p.label}
                    </SvgText>
                  ) : null)}
              </Svg>
            </View>
            {/* Says what the chart is. It is reconstructed from the evidence
                the user has now, not a record of what the score read at the
                time — so it must not claim to be one. */}
            <Text style={styles.footnote}>
              Reconstructed from your logged evidence at each date.
            </Text>
          </>
        ) : (
          <SREmptyState
            compact
            testID="readiness-history-empty"
            title="Not enough history yet"
            body="Your readiness chart appears once the engine can score more than one point in this period. Log activities and it fills in."
          />
        )}
      </View>
    </SRPanel>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 18, marginHorizontal: BASECAMP.gutter },
  inner: { padding: 13 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  headerFlex: { flexShrink: 1, minWidth: 0 },
  chartWrap: { marginTop: 10 },
  footnote: {
    marginTop: 4, fontSize: 9.5, lineHeight: 13,
    fontFamily: "Inter_400Regular", color: BASECAMP.textFaint,
  },
});
