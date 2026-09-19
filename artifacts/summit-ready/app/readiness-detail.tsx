import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Info, Activity, ShieldAlert, Heart, Wind, Zap, Mountain } from "lucide-react-native";
import { T } from "@/constants/theme";
import { useReadinessV2 } from "@/hooks/useReadinessV2";

const LABELS: Record<string, string> = {
  endurance: "Endurance",
  elevationCapacity: "Elevation Capacity",
  consistency: "Consistency",
  mountainExperience: "Mountain Experience",
};
const ICONS: Record<string, any> = {
  endurance: Heart,
  elevationCapacity: Wind,
  consistency: Zap,
  mountainExperience: Mountain,
};
const COLORS: Record<string, string> = {
  endurance: T.green,
  elevationCapacity: T.blue,
  consistency: T.orange,
  mountainExperience: T.purple,
};

export default function ReadinessDetailScreen() {
  const insets = useSafeAreaInsets();
  const { result } = useReadinessV2() ?? {};

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Readiness Detail</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        {result ? (
          <>
            <View style={styles.mainScoreBox}>
              <Text style={styles.scoreValue}>{result.overallScore ?? "—"}</Text>
              <Text style={styles.scoreLabel}>Overall Score</Text>
              <View style={[styles.confBadge, result.confidence === "high" ? { backgroundColor: T.greenDim, borderColor: T.green + "40" } : { backgroundColor: T.orangeDim, borderColor: T.orange + "40" }]}>
                <Activity size={12} color={result.confidence === "high" ? T.green : T.orange} />
                <Text style={[styles.confText, { color: result.confidence === "high" ? T.green : T.orange }]}>{result.confidence.toUpperCase()} CONFIDENCE</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dimensions</Text>
              {Object.entries(result.dimensions).map(([key, dim]) => {
                const Icon = ICONS[key] || Activity;
                const col = COLORS[key] || T.blue;
                return (
                  <View key={key} style={styles.dimCard}>
                    <View style={styles.dimHeader}>
                      <View style={[styles.dimIconWrap, { backgroundColor: col + "20" }]}>
                        <Icon size={14} color={col} />
                      </View>
                      <Text style={styles.dimTitle}>{LABELS[key]}</Text>
                      <Text style={[styles.dimScore, { color: col }]}>{dim.score ?? "—"}</Text>
                    </View>
                    <Text style={styles.dimDesc}>{dim.explanation}</Text>
                  </View>
                );
              })}
            </View>

            {result.missing.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Missing Data</Text>
                {result.missing.map((m, i) => (
                  <View key={i} style={styles.missingRow}>
                    <ShieldAlert size={14} color={T.red} />
                    <Text style={styles.missingText}>{m.replace(/_/g, " ")}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Limitations</Text>
              {result.limitations.map((l, i) => (
                <View key={i} style={styles.limitationRow}>
                  <Info size={14} color={T.textMuted} />
                  <Text style={styles.limitationText}>{l}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.emptyText}>Loading...</Text>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: T.border },
  headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: T.text },
  content: { padding: 18, gap: 24 },
  mainScoreBox: { alignItems: "center", paddingVertical: 30, backgroundColor: T.surface, borderRadius: 16, borderWidth: 1, borderColor: T.border },
  scoreValue: { fontSize: 64, fontFamily: "Inter_700Bold", color: T.text, lineHeight: 74 },
  scoreLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: T.textMuted, marginTop: 4 },
  confBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, marginTop: 12 },
  confText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: T.text, marginBottom: 4 },
  dimCard: { backgroundColor: T.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: T.border, gap: 10 },
  dimHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  dimIconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  dimTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.text },
  dimScore: { fontSize: 18, fontFamily: "Inter_700Bold" },
  dimDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18 },
  missingRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: T.redDim, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: T.red + "40" },
  missingText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: T.red, textTransform: "capitalize" },
  limitationRow: { flexDirection: "row", gap: 10, backgroundColor: T.surface, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: T.border },
  limitationText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18 },
  emptyText: { color: T.textMuted, textAlign: "center", marginTop: 40 },
});
