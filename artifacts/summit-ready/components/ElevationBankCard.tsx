import { useAuth } from "@clerk/expo";
import {
  getGetElevationBankQueryKey,
  useGetElevationBank,
} from "@workspace/api-client-react";
import { ChevronRight, Mountain, RefreshCw, ShieldCheck } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { T } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import {
  formatElevationBankMetres,
  getElevationBankPresentation,
} from "@/utils/elevationBankPresentation";

type Props = {
  onPress?: () => void;
  expanded?: boolean;
};

export function ElevationBankCard({ onPress, expanded = false }: Props) {
  const { isLoaded, isSignedIn } = useAuth();
  const { sessions, exploreHikes } = useApp();
  const query = useGetElevationBank({
    query: {
      enabled: isLoaded && Boolean(isSignedIn),
      staleTime: 30_000,
      queryKey: getGetElevationBankQueryKey(),
    },
  });
  const previousActivityCount = useRef<number | null>(null);
  const completedActivityCount =
    sessions.filter((session) => session.completed).length + exploreHikes.length;

  useEffect(() => {
    if (
      previousActivityCount.current !== null
      && completedActivityCount > previousActivityCount.current
    ) {
      void query.refetch();
    }
    previousActivityCount.current = completedActivityCount;
  }, [completedActivityCount, query.refetch]);
  const presentation = getElevationBankPresentation({
    isLoading: !isLoaded || query.isLoading,
    isError: query.isError,
    data: query.data,
  });

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
            onPress={() => { void query.refetch(); }}
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
        <View style={styles.metricRow}>
          <View style={styles.primaryMetric}>
            <Text style={styles.primaryValue}>{formatElevationBankMetres(data.lifetimeAscentM)}</Text>
            <Text style={styles.primaryLabel}>lifetime credited ascent</Text>
          </View>
          <View style={styles.secondaryMetric}>
            <Text style={styles.secondaryValue}>{formatElevationBankMetres(data.periodAscentM)}</Text>
            <Text style={styles.secondaryLabel}>this month</Text>
          </View>
        </View>
        <View style={styles.everestRow}>
          <Mountain size={15} color={T.orange} />
          <Text style={styles.everestText}>
            {data.everestEquivalent.toFixed(1)} Everest equivalent
          </Text>
          <Text style={styles.displayOnly}>display only</Text>
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
      <LinearGradient
        colors={[T.greenDim, "rgba(15,29,48,0.08)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <View style={styles.icon}>
            <ShieldCheck size={17} color={T.green} />
          </View>
          <View>
            <Text style={styles.eyebrow}>PERSONAL PROGRESS</Text>
            <Text style={styles.title}>Elevation Bank</Text>
          </View>
        </View>
        {onPress && (
          <TouchableOpacity onPress={onPress} testID="elevation-bank-open">
            <ChevronRight size={20} color={T.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {content}
      {query.data && query.data.recentCredits.length > 0 && !expanded && (
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
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.green + "38",
  },
  expandedCard: { marginHorizontal: 0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  titleWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: T.greenDim },
  eyebrow: { color: T.green, fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1.1 },
  title: { color: T.text, fontSize: 17, fontFamily: "Inter_700Bold", marginTop: 2 },
  metricRow: { flexDirection: "row", alignItems: "flex-end", gap: 18 },
  primaryMetric: { flex: 1 },
  primaryValue: { color: T.text, fontSize: 32, lineHeight: 36, fontFamily: "Inter_700Bold" },
  primaryLabel: { color: T.textMuted, fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 3 },
  secondaryMetric: { width: 100, paddingBottom: 2 },
  secondaryValue: { color: T.green, fontSize: 18, fontFamily: "Inter_700Bold" },
  secondaryLabel: { color: T.textMuted, fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  everestRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
  everestText: { color: T.orange, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  displayOnly: { color: T.textDim, fontSize: 10, fontFamily: "Inter_400Regular" },
  stateRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  stateText: { color: T.textMuted, fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular" },
  unavailable: { gap: 7 },
  helperText: { color: T.textDim, fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular" },
  emptyTitle: { color: T.text, fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  retry: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, alignSelf: "flex-start" },
  retryText: { color: T.green, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  detailLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 14, alignSelf: "flex-start" },
  detailLinkText: { color: T.green, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  recentList: { marginTop: 15, gap: 8, borderTopWidth: 1, borderTopColor: T.border, paddingTop: 12 },
  recentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  recentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.green },
  recentLabel: { flex: 1, color: T.textMuted, fontSize: 12, fontFamily: "Inter_400Regular" },
  recentValue: { color: T.text, fontSize: 12, fontFamily: "Inter_600SemiBold" },
});