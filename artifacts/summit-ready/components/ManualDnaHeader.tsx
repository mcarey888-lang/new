import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { T } from "@/constants/theme";
import type { ManualDna } from "@/utils/manualExpedition";

type Props = {
  dna: ManualDna;
  target: { gainM: number; distanceKm: number; averageGradientPercent?: number | null };
  mountainName: string;
  selectedCount: number;
  hasGradientEvidence?: boolean;
};

function MatchBar({ label, value, detail, unavailable = false }: {
  label: string; value: number; detail: string; unavailable?: boolean;
}) {
  const percentage = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <View style={styles.metric}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.percent}>{unavailable ? "—" : `${Math.round(percentage)}%`}</Text>
      </View>
      <View
        style={styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${label} match`}
        accessibilityValue={unavailable
          ? { text: "Unavailable" }
          : { min: 0, max: 100, now: percentage, text: `${Math.round(percentage)}% match. ${detail}` }}
      >
        <View style={[styles.fill, { width: `${unavailable ? 0 : percentage}%` }]} />
      </View>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );
}

export function ManualDnaHeader({ dna, target, mountainName, selectedCount, hasGradientEvidence = true }: Props) {
  const status = selectedCount === 0 ? "Add hills to build your match"
    : dna.range === "within" ? "Within preferred range"
    : dna.range === "within_widened" ? "Within widened range"
    : dna.range === "below" ? "Below preferred range" : "Above preferred range";
  return (
    <View style={styles.header} testID="manual-dna-sticky-header">
      <View style={styles.row}>
        <Text style={styles.title} accessibilityRole="header">LIVE DNA · {mountainName}</Text>
        <Text style={styles.headline} accessibilityLiveRegion="polite">{dna.overall}% match</Text>
      </View>
      <View
        style={[styles.track, styles.overallTrack]}
        accessible accessibilityRole="progressbar" accessibilityLabel="Overall expedition DNA match"
        accessibilityValue={{ min: 0, max: 100, now: dna.overall }}
      >
        <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, dna.overall))}%` }]} />
      </View>
      <View style={styles.grid}>
        <MatchBar label="Elevation gain" value={dna.gainMatch}
          detail={`${Math.round(dna.gainM).toLocaleString()} / ${target.gainM.toLocaleString()} m${dna.gainM > target.gainM ? " · above target" : ""}`} />
        <MatchBar label="Distance" value={dna.distanceMatch}
          detail={`${dna.distanceKm.toFixed(1)} / ${target.distanceKm} km${dna.distanceKm > target.distanceKm ? " · above target" : ""}`} />
        <MatchBar label="Gradient similarity" value={dna.gradientSimilarity}
          unavailable={selectedCount > 0 && (!hasGradientEvidence || !target.averageGradientPercent || dna.averageGradientPercent == null)}
          detail={selectedCount === 0 ? "No gradient yet"
            : !hasGradientEvidence || dna.averageGradientPercent == null ? "Gradient data unavailable"
            : `${dna.averageGradientPercent}% / ${target.averageGradientPercent ?? "—"}% · estimated`} />
        <MatchBar label="Technical suitability" value={dna.technicalSuitability}
          detail={selectedCount === 0 ? "No routes selected" : "Suitability of selected routes"} />
      </View>
      <Text style={styles.status}>{selectedCount > 0 ? `${selectedCount} route${selectedCount === 1 ? "" : "s"} selected · ` : ""}{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 12, gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { flex: 1, color: T.textMuted, fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.7 },
  headline: { color: T.blue, fontSize: 22, fontFamily: "Inter_800ExtraBold" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  metric: { width: "48%", gap: 4 },
  label: { flex: 1, color: T.white, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  percent: { color: T.blue, fontSize: 11, fontFamily: "Inter_700Bold" },
  track: { height: 5, backgroundColor: T.border, borderRadius: 4, overflow: "hidden" },
  overallTrack: { height: 7 },
  fill: { height: "100%", backgroundColor: T.blue, borderRadius: 4 },
  detail: { color: T.textMuted, fontSize: 11, fontFamily: "Inter_400Regular" },
  status: { color: T.textMuted, fontSize: 11, fontFamily: "Inter_500Medium" },
});
