import { ChevronRight, Info, Mountain, RefreshCw } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { T } from "@/constants/theme";
import { useElevationBank } from "@/hooks/useElevationBank";
import { formatElevationBankMetres } from "@/utils/elevationBankPresentation";

type Props = {
  onPress?: () => void;
  expanded?: boolean;
  emphasis?: boolean;
};

export function ElevationBankCard({ onPress, expanded = false, emphasis = false }: Props) {
  const { presentation, isSignedIn, refetch } = useElevationBank();
  const ready = presentation.kind === "ready" ? presentation.data : null;
  const recent = ready?.recentCredits ?? [];
  const chartCredits = recent.slice(0, 5).reverse();
  const chartMax = Math.max(1, ...chartCredits.map(credit => credit.creditedAscentM));
  const header = (
    <View style={styles.topLine}>
      <Mountain size={30} color={T.blue} strokeWidth={1.8} />
      <Text style={styles.heading}>ELEVATION BANK</Text>
      {onPress ? (
        <TouchableOpacity
          onPress={onPress}
          testID="elevation-bank-open"
          accessibilityRole="button"
          accessibilityLabel="View Elevation Bank details"
          style={styles.infoButton}
        >
          <Info size={20} color={T.basecampText} />
        </TouchableOpacity>
      ) : (
        <Info size={20} color={T.basecampTextMuted} accessibilityLabel="Elevation Bank information below" />
      )}
    </View>
  );

  return (
    <View style={styles.card} testID="elevation-bank-card">
      {ready ? (
        <ImageBackground
          source={require("@/assets/images/hero-base-camp.png")}
          resizeMode="cover"
          style={styles.hero}
          imageStyle={styles.heroImage}
          accessibilityLabel="Illustrative alpine mountain artwork"
        >
          <LinearGradient
            colors={["rgba(3,15,27,0.95)", "rgba(3,15,27,0.78)", "rgba(3,15,27,0.15)"]}
            locations={[0, 0.52, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          {header}
          <View style={styles.heroValue} testID="elevation-bank-values">
            <Text
              style={[styles.total, emphasis && styles.totalEmphasis]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              {formatElevationBankMetres(ready.lifetimeAscentM)}
            </Text>
            <Text style={styles.scope}>Qualified recorded outdoor ascent</Text>
          </View>
        </ImageBackground>
      ) : (
        <View style={styles.stateHero}>
          {header}
          <Text style={styles.stateSubtitle}>Your personal, ledger-backed ascent.</Text>
        </View>
      )}

      {ready ? (
        <View style={styles.panel}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatElevationBankMetres(ready.periodAscentM)}
              </Text>
              <Text style={styles.summaryLabel}>THIS MONTH</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {ready.everestEquivalent.toFixed(1)}
              </Text>
              <Text style={styles.summaryLabel}>EVEREST EQUIVALENTS</Text>
            </View>
          </View>
          {chartCredits.length > 0 && (
            <View style={styles.chartBlock}>
              <Text style={styles.chartTitle}>RECENT QUALIFIED CREDITS</Text>
              <View style={styles.chart}>
                {chartCredits.map(credit => (
                  <View key={`${credit.activityId}:${credit.revision}`} style={styles.chartColumn}>
                    <View
                      style={[
                        styles.chartBar,
                        { height: Math.max(4, Math.round(36 * credit.creditedAscentM / chartMax)) },
                      ]}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}
          {expanded && recent.length > 0 && (
            <View style={styles.recentList}>
              {recent.map(credit => (
                <View key={`${credit.activityId}:${credit.revision}`} style={styles.recentRow}>
                  <View style={styles.recentDot} />
                  <Text style={styles.recentLabel} numberOfLines={1}>
                    {credit.status === "corrected" ? "Corrected credit" : "Credited activity"}
                  </Text>
                  <Text style={styles.recentValue}>+{formatElevationBankMetres(credit.creditedAscentM)}</Text>
                </View>
              ))}
            </View>
          )}
          {!expanded && recent.length > 0 && onPress && (
            <TouchableOpacity onPress={onPress} style={styles.detailLink} accessibilityRole="button">
              <Text style={styles.detailLinkText}>View credited activity</Text>
              <ChevronRight size={14} color={T.blue} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.statePanel}>
          {presentation.kind === "loading" ? (
            <Text style={styles.stateText} testID="elevation-bank-loading">Loading your credited ascent…</Text>
          ) : !isSignedIn ? (
            <Text style={styles.stateText}>Sign in to see your personal, ledger-backed ascent.</Text>
          ) : presentation.kind === "unavailable" ? (
            <View testID="elevation-bank-unavailable">
              <Text style={styles.emptyTitle}>Elevation Bank is unavailable</Text>
              <Text style={styles.helperText}>
                We couldn't load your credited ascent. Your training history is unchanged.
              </Text>
              <TouchableOpacity onPress={refetch} style={styles.retry} testID="elevation-bank-retry" accessibilityRole="button">
                <RefreshCw size={14} color={T.green} />
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View testID="elevation-bank-empty">
              <Text style={styles.emptyTitle}>No credited ascent yet</Text>
              <Text style={styles.helperText}>
                Recorded GPS ascent appears here after its evidence is qualified. Manual, indoor, and unavailable or untrusted evidence stay out of this total.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.blue + "55",
    backgroundColor: T.basecampSurface,
  },
  hero: {
    minHeight: 196,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    justifyContent: "space-between",
    backgroundColor: T.basecampSurface,
  },
  heroImage: { opacity: 0.88 },
  stateHero: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  stateSubtitle: { color: T.basecampTextMuted, fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 14 },
  topLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  heading: {
    flex: 1,
    color: T.basecampText,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.4,
  },
  infoButton: { padding: 8, margin: -8 },
  heroValue: { marginTop: 24 },
  total: { color: T.basecampText, fontSize: 43, lineHeight: 52, fontFamily: "Inter_700Bold", letterSpacing: -1.5 },
  totalEmphasis: { fontSize: 48, lineHeight: 56 },
  scope: { color: T.basecampTextMuted, fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 3 },
  panel: {
    margin: 12,
    marginTop: 0,
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.blue + "2A",
    backgroundColor: "rgba(3,19,34,0.94)",
  },
  summaryRow: { flexDirection: "row", alignItems: "center" },
  summaryItem: { flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: 5 },
  summaryValue: { color: T.basecampText, fontSize: 21, fontFamily: "Inter_700Bold" },
  summaryLabel: { color: T.basecampTextMuted, fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6, marginTop: 5, textAlign: "center" },
  divider: { width: 1, height: 36, backgroundColor: T.blue + "33" },
  chartBlock: { marginTop: 15, borderTopWidth: 1, borderTopColor: T.blue + "2A", paddingTop: 12 },
  chartTitle: { color: T.basecampTextMuted, fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.7 },
  chart: { height: 44, flexDirection: "row", alignItems: "flex-end", gap: 8, borderBottomWidth: 1, borderBottomColor: T.blue + "33", paddingHorizontal: 4 },
  chartColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  chartBar: { width: "80%", maxWidth: 35, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: T.blue },
  recentList: { marginTop: 16, gap: 8, borderTopWidth: 1, borderTopColor: T.blue + "2A", paddingTop: 12 },
  recentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  recentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.blue },
  recentLabel: { flex: 1, color: T.basecampTextMuted, fontSize: 12, fontFamily: "Inter_400Regular" },
  recentValue: { color: T.basecampText, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  detailLink: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, marginTop: 15 },
  detailLinkText: { color: T.blue, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  statePanel: { paddingHorizontal: 20, paddingBottom: 20 },
  stateText: { color: T.basecampTextMuted, fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular" },
  helperText: { color: T.basecampTextDim, fontSize: 11, lineHeight: 17, fontFamily: "Inter_400Regular", marginTop: 7 },
  emptyTitle: { color: T.basecampText, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  retry: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, alignSelf: "flex-start" },
  retryText: { color: T.green, fontSize: 12, fontFamily: "Inter_600SemiBold" },
});