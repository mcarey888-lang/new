import { ChevronRight, Mountain, RefreshCw, ShieldCheck } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { T } from "@/constants/theme";
import { useElevationBank } from "@/hooks/useElevationBank";
import { formatElevationBankMetres } from "@/utils/elevationBankPresentation";

type Props = {
  onPress?: () => void;
  expanded?: boolean;
  /**
   * Elevation Bank is a first-class SummitReady concept, not an ordinary stat.
   * `emphasis` gives the lifetime figure the hierarchy the approved design
   * calls for. It is PRESENTATION ONLY — the value, the credit rules and the
   * qualification logic are unchanged and still come from the API.
   */
  emphasis?: boolean;
};

export function ElevationBankCard({ onPress, expanded = false, emphasis = false }: Props) {
  /* One query, shared with the Basecamp tile, so the two cannot disagree
     about the same user's banked ascent. */
  const { presentation, isSignedIn, refetch } = useElevationBank();
  const hasCollapsedRecentCredits =
    !expanded
    && presentation.kind === "ready"
    && presentation.data.recentCredits.length > 0;

  const content = (() => {
    if (presentation.kind === "loading") {
      return (
        <View style={styles.stateRow} testID="elevation-bank-loading">
          <ActivityIndicator size="small" color={T.green} />
          <Text style={styles.stateText}>Loading your credited ascent…</Text>
        </View>
      );
    }

    if (!isSignedIn) {
      return (
        <Text style={styles.stateText}>
          Sign in to see your personal, ledger-backed ascent.
        </Text>
      );
    }

    if (presentation.kind === "unavailable") {
      return (
        <View style={styles.unavailable} testID="elevation-bank-unavailable">
          <Text style={styles.stateText}>
            Elevation Bank is being prepared for this environment.
          </Text>
          <Text style={styles.helperText}>
            Your existing training history is unchanged. Manual, indoor, and
            unavailable or untrusted evidence do not count here.
          </Text>
          <TouchableOpacity
            onPress={refetch}
            style={styles.retry}
            testID="elevation-bank-retry"
          >
            <RefreshCw size={13} color={T.green} />
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (presentation.kind === "empty") {
      return (
        <View testID="elevation-bank-empty">
          <Text style={styles.emptyTitle}>No credited ascent yet</Text>
          <Text style={styles.helperText}>
            Recorded GPS ascent appears here after its evidence is qualified.
            Manual, indoor, and unavailable or untrusted evidence stay out of
            this total.
          </Text>
        </View>
      );
    }

    const data = presentation.data;
    return (
      <View testID="elevation-bank-values">
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text
              style={[styles.metricValue, emphasis && styles.metricValueEmphasis]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatElevationBankMetres(data.lifetimeAscentM)}
            </Text>
            <Text style={styles.metricLabel}>Credited ascent</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{formatElevationBankMetres(data.periodAscentM)}</Text>
            <Text style={styles.metricLabel}>This month</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{data.everestEquivalent.toFixed(1)}</Text>
            <Text style={styles.metricLabel}>Everests</Text>
          </View>
        </View>

        {expanded && data.recentCredits.length > 0 && (
          <View style={styles.recentList}>
            {data.recentCredits.map((credit) => (
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
      </View>
    );
  })();

  return (
    <View style={[styles.card, expanded && styles.expandedCard]} testID="elevation-bank-card">
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <View style={styles.icon}>
            <Mountain size={16} color={T.green} />
          </View>
          <Text style={styles.title}>Elevation Bank</Text>
        </View>
        {onPress && (
          <TouchableOpacity onPress={onPress} testID="elevation-bank-open" style={styles.viewDetailsBtn}>
            <Text style={styles.viewDetailsText}>View details</Text>
            <ChevronRight size={14} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.helperTextBase}>Your personal, ledger-backed ascent.</Text>
      <View style={styles.contentWrap}>
        {content}
      </View>
      {hasCollapsedRecentCredits && (
        <TouchableOpacity onPress={onPress} style={styles.detailLink}>
          <Text style={styles.detailLinkText}>View credited activity</Text>
          <ChevronRight size={14} color={T.green} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 0,
    marginBottom: 0,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  expandedCard: { marginHorizontal: 0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  titleWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(52, 211, 153, 0.15)" },
  title: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  viewDetailsBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewDetailsText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.6)" },
  helperTextBase: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 20 },
  contentWrap: {},
  metricsGrid: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  metricItem: { flex: 1, alignItems: "center" },
  metricValue: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 4 },
  /* Presentation only — the figure itself is unchanged. */
  metricValueEmphasis: { fontSize: 30, lineHeight: 34, letterSpacing: -0.6 },
  metricLabel: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
  metricDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.1)" },

  eyebrow: { color: T.green, fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1.1 },
  metricRow: { flexDirection: "row", alignItems: "flex-end", gap: 18 },
  primaryMetric: { flex: 1 },
  primaryValue: { color: T.basecampText, fontSize: 32, lineHeight: 36, fontFamily: "Inter_700Bold" },
  primaryLabel: { color: T.basecampTextMuted, fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 3 },
  secondaryMetric: { width: 100, paddingBottom: 2 },
  secondaryValue: { color: T.green, fontSize: 18, fontFamily: "Inter_700Bold" },
  secondaryLabel: { color: T.basecampTextMuted, fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  everestRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
  everestText: { color: T.orange, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  displayOnly: { color: T.basecampTextDim, fontSize: 10, fontFamily: "Inter_400Regular" },
  stateRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  stateText: { color: T.basecampTextMuted, fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular" },
  unavailable: { gap: 7 },
  helperText: { color: T.basecampTextDim, fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular" },
  emptyTitle: { color: T.basecampText, fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  retry: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, alignSelf: "flex-start" },
  retryText: { color: T.green, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  detailLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 14, alignSelf: "flex-start" },
  detailLinkText: { color: T.green, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  recentList: { marginTop: 15, gap: 8, borderTopWidth: 1, borderTopColor: T.basecampBorder, paddingTop: 12 },
  recentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  recentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.green },
  recentLabel: { flex: 1, color: T.basecampTextMuted, fontSize: 12, fontFamily: "Inter_400Regular" },
  recentValue: { color: T.basecampText, fontSize: 12, fontFamily: "Inter_600SemiBold" },
});