/**
 * The expedition header: what you are climbing, how far up you are.
 *
 * Every figure comes from the selected presentation state. The big number is
 * SIMULATED elevation — the sum of what your completed stages contribute
 * towards the objective — and the screen says "climbed" beneath it rather
 * than implying you have stood on the summit.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BASECAMP, EXPLORE, SP, TYPE } from "@/constants/tokens";
import { SREyebrow } from "@/components/ui";
import { ProgressRing, metres } from "./parts";
import type { ExpeditionPresentationState } from "@/utils/expeditionProgress";

export function ExpeditionHeader({
  presentation, title, tagline,
}: {
  presentation: ExpeditionPresentationState;
  /** The expedition's own name. Never a placeholder. */
  title: string;
  tagline?: string | null;
}) {
  const p = presentation.progress;
  const percent = Math.max(0, Math.min(1, p.simulatedPercent));
  const stageNumber = Math.min(p.completedStageCount + 1, Math.max(1, p.totalStageCount));

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.titleCol}>
          <SREyebrow tone={EXPLORE.accent}>{title.toUpperCase()}</SREyebrow>
          <Text style={styles.heading} numberOfLines={2}>Your expedition</Text>
          {tagline ? <Text style={styles.tagline} numberOfLines={3}>{tagline}</Text> : null}
        </View>

        <View style={styles.ringCol}>
          {p.totalStageCount > 0 ? (
            <Text style={styles.stageOf} numberOfLines={1}>
              {`Stage ${stageNumber} of ${p.totalStageCount}`}
            </Text>
          ) : null}
          <View
            style={styles.ringRow}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Expedition progress"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(percent * 100) }}
          >
            <View>
              {/* Rounded, like every other percentage in the app. Flooring
                here made this header disagree with the progress card
                immediately below it by a point. */}
            <Text style={styles.percent}>{`${Math.round(percent * 100)}%`}</Text>
              <Text style={styles.percentLabel}>complete</Text>
            </View>
            <ProgressRing percent={percent} />
          </View>
        </View>
      </View>

      <View style={styles.figures}>
        <Text style={styles.climbed} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {metres(p.currentSimulatedElevationM) ?? "—"}
        </Text>
        <Text style={styles.target} numberOfLines={1}>
          {`/ ${metres(p.targetSimulatedElevationM) ?? "—"}`}
        </Text>
      </View>
      <Text style={styles.figureLabels}>climbed · target</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: BASECAMP.gutter },
  row: { flexDirection: "row", alignItems: "flex-start", gap: SP.md },
  titleCol: { flex: 1, minWidth: 0 },
  heading: { marginTop: 6, ...TYPE.hero, fontSize: 27, lineHeight: 30, color: BASECAMP.text },
  tagline: { marginTop: 5, ...TYPE.small, fontSize: 12.5, color: BASECAMP.textMuted },
  ringCol: { flexShrink: 0, alignItems: "flex-end" },
  stageOf: { ...TYPE.caption, fontSize: 10.5, color: BASECAMP.textMuted },
  ringRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 9 },
  percent: { fontSize: 21, lineHeight: 22, fontFamily: "Inter_700Bold", color: BASECAMP.text, textAlign: "right" },
  percentLabel: { fontSize: 9.5, lineHeight: 12, fontFamily: "Inter_400Regular", color: BASECAMP.textDim, textAlign: "right" },
  figures: { marginTop: 15, flexDirection: "row", alignItems: "flex-end", gap: SP.sm },
  climbed: { fontSize: 32, lineHeight: 34, fontFamily: "Inter_700Bold", letterSpacing: -1, color: BASECAMP.text, flexShrink: 1 },
  target: { fontSize: 18, lineHeight: 25, fontFamily: "Inter_600SemiBold", color: BASECAMP.textDim, flexShrink: 0 },
  figureLabels: { marginTop: 2, fontSize: 10.5, lineHeight: 13, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
});
