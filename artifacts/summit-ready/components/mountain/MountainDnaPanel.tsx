/**
 * Mountain DNA.
 *
 * In production this is a COMPARISON, not a character reading: the engine
 * scores how like your target route this one is, dimension by dimension. Each
 * bar therefore means "how close to your goal", and the panel says so — a bar
 * that looked like an absolute measure of steepness or exposure would be a
 * fabricated claim about real terrain.
 *
 * A dimension the engine could not score is listed as "Not comparable" rather
 * than drawn as an empty bar, because an empty bar reads as a score of zero:
 * "nothing like your goal", which is the opposite of "we do not know".
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Dna } from "lucide-react-native";
import { BASECAMP, EXPLORE, SP, TYPE } from "@/constants/tokens";
import { SREmptyState, SRProgress, SRSectionHeader } from "@/components/ui";
import type { PresentedDna } from "@/utils/mountainDetailPresentation";

export function MountainDnaPanel({ dna }: { dna: PresentedDna }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <SRSectionHeader
          title="Mountain DNA"
          icon={<Dna size={13} color={EXPLORE.accent} />}
          style={styles.headFlex}
        />
        <Text style={styles.subtitle} numberOfLines={1}>Compared with your goal</Text>
      </View>

      {dna.state === "unavailable" || dna.dimensions.length === 0 ? (
        <SREmptyState
          compact
          testID="mountain-dna-unavailable"
          title="Nothing to compare yet"
          body={dna.unavailableReason ?? ""}
          style={styles.empty}
        />
      ) : (
        <>
          {dna.overallScore !== null ? (
            <Text style={styles.overall}>
              <Text style={styles.overallValue}>{Math.round(dna.overallScore)}</Text>
              <Text style={styles.overallLabel}>{`  overall · ${dna.confidence} confidence`}</Text>
            </Text>
          ) : null}
          <View style={styles.rows}>
            {dna.dimensions.map(d => (
              <View key={d.name} style={styles.row}>
                <Text style={styles.label} numberOfLines={1}>{d.label}</Text>
                {d.score === null ? (
                  <Text style={styles.notComparable} numberOfLines={1}>{d.valueLabel}</Text>
                ) : (
                  <>
                    <SRProgress
                      value={d.score}
                      tone={d.score >= 75 ? EXPLORE.verified : EXPLORE.accent}
                      height={5}
                      style={styles.bar}
                      accessibilityLabel={`${d.label}: ${d.valueLabel} out of 100`}
                    />
                    <Text style={styles.value}>{d.valueLabel}</Text>
                  </>
                )}
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 13, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SP.sm },
  headFlex: { flexShrink: 1, minWidth: 0 },
  subtitle: { ...TYPE.caption, fontSize: 9.5, color: BASECAMP.textDim },
  empty: { marginTop: SP.sm },
  overall: { marginTop: SP.sm },
  overallValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: BASECAMP.text },
  overallLabel: { ...TYPE.caption, fontSize: 10, color: BASECAMP.textDim },
  rows: { marginTop: 9, gap: 7 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  label: { width: 104, flexShrink: 0, ...TYPE.caption, fontSize: 10.5, color: BASECAMP.textMuted },
  bar: { flex: 1 },
  value: { width: 26, textAlign: "right", ...TYPE.caption, fontSize: 10, color: BASECAMP.textDim },
  notComparable: {
    flex: 1, textAlign: "right", ...TYPE.caption, fontSize: 10,
    fontStyle: "italic", color: BASECAMP.textFaint,
  },
});
