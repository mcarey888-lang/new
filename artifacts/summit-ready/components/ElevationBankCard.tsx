import { ArrowUpRight, ChevronRight, Flag, Info, Mountain, RefreshCw, TrendingUp } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import { T } from "@/constants/theme";
import { useElevationBank } from "@/hooks/useElevationBank";
import { formatElevationBankMetres } from "@/utils/elevationBankPresentation";

type Props = {
  onPress?: () => void;
  expanded?: boolean;
  emphasis?: boolean;
};

const displayMetres = (value: number) => formatElevationBankMetres(value).replace(/m$/, " m");

function BankMark() {
  return (
    <Svg width={55} height={54} viewBox="0 0 64 64" accessibilityLabel="Mountain icon">
      <Defs>
        <SvgGradient id="bankPeak" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#82C4FF" />
          <Stop offset="1" stopColor={T.blue} />
        </SvgGradient>
      </Defs>
      <Path d="M3 54 21 22l8 11L39 8l22 46" stroke="url(#bankPeak)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M13 57 28 36l7 9 7-9 15 21" stroke={T.blue} strokeOpacity={0.55} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export function ElevationBankCard({ onPress, expanded = false, emphasis = false }: Props) {
  const { presentation, isSignedIn, refetch } = useElevationBank();
  const ready = presentation.kind === "ready" ? presentation.data : null;
  const empty = presentation.kind === "empty";
  const recent = ready?.recentCredits ?? [];
  const bars = recent.slice(0, 7).reverse();
  const largest = Math.max(1, ...bars.map(credit => credit.creditedAscentM));

  const metrics = [
    { label: "THIS MONTH", value: ready ? displayMetres(ready.periodAscentM) : empty ? "0 m" : "—", Icon: TrendingUp },
    { label: "EVEREST EQUIVALENTS", value: ready ? ready.everestEquivalent.toFixed(1) : empty ? "0.0" : "—", Icon: Mountain },
    { label: "RECENT CREDITS", value: ready ? String(recent.length) : empty ? "0" : "—", Icon: Flag },
    { label: "LATEST CREDIT", value: recent[0] ? displayMetres(recent[0].creditedAscentM) : "—", Icon: ArrowUpRight },
  ];

  return (
    <View style={styles.card} testID="elevation-bank-card">
      <ImageBackground
        source={require("@/assets/images/elevation-bank-mountain.png")}
        resizeMode="cover"
        style={styles.hero}
        accessibilityLabel="Illustrative mountain panorama at sunset"
      >
        <LinearGradient
          colors={["rgba(1,16,31,0.99)", "rgba(1,18,33,0.92)", "rgba(1,18,33,0.55)", "rgba(1,18,33,0.08)"]}
          locations={[0, 0.35, 0.68, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["transparent", "rgba(1,16,31,0.3)", "rgba(1,16,31,0.87)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroContent}>
          <View style={styles.titleRow}>
            <BankMark />
            <View style={styles.titleGroup}>
              <Text style={styles.heading}>ELEVATION BANK</Text>
              {onPress ? (
                <TouchableOpacity
                  onPress={onPress}
                  testID="elevation-bank-open"
                  accessibilityRole="button"
                  accessibilityLabel="View Elevation Bank details"
                  style={styles.infoButton}
                >
                  <Info size={19} color={T.basecampTextMuted} />
                </TouchableOpacity>
              ) : (
                <Info size={19} color={T.basecampTextMuted} accessibilityLabel="Elevation Bank information below" />
              )}
            </View>
          </View>
          <View style={styles.heroValue} testID={ready ? "elevation-bank-values" : undefined}>
            <Text
              style={[styles.total, emphasis && styles.totalEmphasis]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {ready ? displayMetres(ready.lifetimeAscentM) : empty ? "0 m" : "— m"}
            </Text>
            <Text style={styles.scope}>Qualified recorded outdoor ascent</Text>
          </View>
          {presentation.kind === "loading" && (
            <Text style={styles.heroStatus} testID="elevation-bank-loading">Loading your credited ascent…</Text>
          )}
          {!isSignedIn && presentation.kind !== "loading" && (
            <Text style={styles.heroStatus}>Sign in to see your personal, ledger-backed ascent.</Text>
          )}
          {isSignedIn && presentation.kind === "unavailable" && (
            <View style={styles.unavailable} testID="elevation-bank-unavailable">
              <Text style={styles.heroStatus}>Elevation Bank is unavailable right now.</Text>
              <TouchableOpacity
                onPress={refetch}
                style={styles.retry}
                testID="elevation-bank-retry"
                accessibilityRole="button"
              >
                <RefreshCw size={13} color={T.green} />
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}
          {empty && (
            <Text style={styles.heroStatus} testID="elevation-bank-empty">
              No qualified recorded ascent yet.
            </Text>
          )}
        </View>
      </ImageBackground>

      <View style={styles.panel}>
        <View style={styles.metricsGrid}>
          {metrics.map(({ label, value, Icon }) => (
            <View key={label} style={styles.metric}>
              <Icon size={19} color={T.blue} strokeWidth={1.9} />
              <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
              <Text style={styles.metricLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.chartBlock}>
          <Text style={styles.chartTitle}>RECENT CREDIT ASCENT</Text>
          {bars.length ? (
            <View style={styles.chart}>
              {bars.map((credit, index) => (
                <View
                  key={`${credit.activityId}:${credit.revision}`}
                  style={styles.chartColumn}
                  accessible
                  accessibilityLabel={`Recent credit ${index + 1}: ${displayMetres(credit.creditedAscentM)}`}
                >
                  <View
                    style={[
                      styles.chartBar,
                      { height: Math.max(3, Math.round(44 * Math.max(0, credit.creditedAscentM) / largest)) },
                    ]}
                  />
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.chartEmpty}>{presentation.kind === "unavailable" ? "Credit history unavailable" : "No recent credits"}</Text>
          )}
        </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: T.blue + "65",
    backgroundColor: "#031425",
  },
  hero: {
    minHeight: 220,
    backgroundColor: "#031425",
    justifyContent: "flex-start",
  },
  heroContent: { flex: 1, paddingHorizontal: 18, paddingTop: 19, paddingBottom: 24 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  titleGroup: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  heading: { color: T.basecampText, fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: 1.3 },
  infoButton: { padding: 7, margin: -7 },
  heroValue: { marginTop: 8, marginLeft: 64 },
  total: { color: T.basecampText, fontSize: 40, lineHeight: 48, fontFamily: "Inter_700Bold", letterSpacing: -1.6 },
  totalEmphasis: { fontSize: 44, lineHeight: 52 },
  scope: { color: T.green, fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 3 },
  heroStatus: { color: T.basecampText, fontSize: 12, lineHeight: 18, fontFamily: "Inter_500Medium", marginTop: 16, marginLeft: 64 },
  unavailable: { marginTop: 0 },
  retry: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, marginLeft: 64, alignSelf: "flex-start" },
  retryText: { color: T.green, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  panel: {
    marginHorizontal: 10,
    marginBottom: 10,
    marginTop: -12,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 15,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: T.blue + "35",
    backgroundColor: "rgba(1,20,36,0.97)",
  },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap" },
  metric: {
    width: "50%",
    minHeight: 83,
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: T.blue + "22",
  },
  metricValue: { color: T.basecampText, fontSize: 19, fontFamily: "Inter_700Bold", marginTop: 4 },
  metricLabel: { color: T.basecampTextMuted, fontSize: 9, fontFamily: "Inter_500Medium", letterSpacing: 0.4, marginTop: 3, textAlign: "center" },
  chartBlock: { paddingTop: 13, paddingHorizontal: 6 },
  chartTitle: { color: T.basecampTextMuted, fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.7 },
  chart: { height: 52, flexDirection: "row", alignItems: "flex-end", gap: 8, borderBottomWidth: 1, borderBottomColor: T.blue + "33", paddingHorizontal: 4 },
  chartColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  chartBar: { width: "80%", maxWidth: 35, borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: T.blue },
  chartEmpty: { color: T.basecampTextMuted, fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 12 },
  recentList: { marginTop: 15, gap: 8, borderTopWidth: 1, borderTopColor: T.blue + "2A", paddingTop: 12 },
  recentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  recentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.blue },
  recentLabel: { flex: 1, color: T.basecampTextMuted, fontSize: 12, fontFamily: "Inter_400Regular" },
  recentValue: { color: T.basecampText, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  detailLink: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, marginTop: 15 },
  detailLinkText: { color: T.blue, fontSize: 12, fontFamily: "Inter_600SemiBold" },
});