import React, { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Info, Activity, ShieldAlert, Heart, Wind, Zap, Mountain, AlertCircle, Trophy, CalendarDays, TrendingUp, TrendingDown, Minus } from "lucide-react-native";
import { T } from "@/constants/theme";
import { useReadinessV2 } from "@/hooks/useReadinessV2";
import { useApp } from "@/context/AppContext";

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
  const v2 = useReadinessV2();
  const { summitGoal } = useApp();

  const { result, nextAction, trend, input } = v2 ?? {};

  const evidenceMap = useMemo(() => {
    if (!input) return new Map();
    const map = new Map();
    input.evidence.forEach(e => map.set(e.evidenceId, e));
    return map;
  }, [input]);

  const targetDateStr = summitGoal?.summitDate
    ? new Date(summitGoal.summitDate + "T12:00:00").toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
      })
    : "";

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.backBtn}>
          <ChevronLeft size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Am I Ready?</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        {result && summitGoal ? (
          <>
            {/* Target Card */}
            <View style={styles.targetCard}>
              <View style={styles.targetIconWrap}>
                <Trophy size={16} color={T.orange} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.targetLabel}>Target</Text>
                <Text style={styles.targetName} numberOfLines={1}>{summitGoal.mountainName}</Text>
              </View>
              <View style={styles.targetDateBox}>
                <CalendarDays size={14} color={T.textMuted} />
                <Text style={styles.targetDate}>{targetDateStr}</Text>
              </View>
            </View>

            {/* Overall Score Box */}
            <View style={styles.mainScoreBox}>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreValue}>{result.overallScore ?? "—"}</Text>
                <Text style={styles.scoreMax}>/100</Text>
              </View>
              <Text style={styles.scoreLabel}>Overall Readiness Score</Text>
              
              <View style={styles.badgesRow}>
                {trend !== null && trend !== undefined && (
                  <View style={[styles.badge, trend > 0 ? styles.badgeGreen : trend < 0 ? styles.badgeRed : styles.badgeNeutral]}>
                    {trend > 0 ? <TrendingUp size={12} color={T.green} /> : trend < 0 ? <TrendingDown size={12} color={T.red} /> : <Minus size={12} color={T.textMuted} />}
                    <Text style={[styles.badgeText, trend > 0 ? { color: T.green } : trend < 0 ? { color: T.red } : { color: T.textMuted }]}>
                      {trend > 0 ? `+${trend} THIS WEEK` : trend < 0 ? `${trend} THIS WEEK` : "NO CHANGE"}
                    </Text>
                  </View>
                )}
                <View style={[styles.badge, result.confidence === "high" ? styles.badgeGreen : result.confidence === "medium" ? styles.badgeOrange : styles.badgeRed]}>
                  <Activity size={12} color={result.confidence === "high" ? T.green : result.confidence === "medium" ? T.orange : T.red} />
                  <Text style={[styles.badgeText, { color: result.confidence === "high" ? T.green : result.confidence === "medium" ? T.orange : T.red }]}>
                    {result.confidence.toUpperCase()} CONFIDENCE
                  </Text>
                </View>
              </View>
              <Text style={styles.scoreDesc}>{result.explanations[0]}</Text>
            </View>

            {/* Next Action */}
            {nextAction && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Next Best Action</Text>
                <View style={styles.actionCard}>
                  <AlertCircle size={18} color={COLORS[nextAction.focusDimension] || T.blue} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.actionTitle}>Focus: {LABELS[nextAction.focusDimension]}</Text>
                    <Text style={styles.actionDesc}>{nextAction.label}</Text>
                  </View>
                  {nextAction.projectedImpact && (
                    <View style={styles.impactBadge}>
                      <Text style={styles.impactText}>+{nextAction.projectedImpact.delta}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Dimensions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dimensions</Text>
              {Object.entries(result.dimensions).map(([key, dim]) => {
                const Icon = ICONS[key] || Activity;
                const col = COLORS[key] || T.blue;
                
                let dist = 0;
                let asc = 0;
                let dur = 0;
                dim.evidenceIds.forEach(id => {
                  const e = evidenceMap.get(id);
                  if (e) {
                    if (e.distanceKm) dist += e.distanceKm;
                    if (e.ascentM) asc += e.ascentM;
                    if (e.durationMinutes) dur += e.durationMinutes;
                  }
                });

                return (
                  <View key={key} style={styles.dimCard}>
                    <View style={styles.dimHeader}>
                      <View style={[styles.dimIconWrap, { backgroundColor: col + "20" }]}>
                        <Icon size={14} color={col} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dimTitle}>{LABELS[key]}</Text>
                        <Text style={[styles.dimScore, { color: col }]}>{dim.score ?? "—"}<Text style={styles.dimScoreMax}>/100</Text></Text>
                      </View>
                    </View>
                    <Text style={styles.dimDesc}>{dim.explanation}</Text>
                    
                    {dim.evidenceIds.length > 0 && (
                      <View style={styles.evidenceRow}>
                        <Text style={styles.evidenceLabel}>Evidence base: {dim.evidenceIds.length} activities</Text>
                        <View style={styles.evidenceStats}>
                          {dist > 0 && <Text style={styles.evidenceStatText}>{dist.toFixed(1)}km</Text>}
                          {asc > 0 && <Text style={styles.evidenceStatText}>{Math.round(asc)}m</Text>}
                          {dur > 0 && <Text style={styles.evidenceStatText}>{Math.round(dur/60)}h {Math.round(dur%60)}m</Text>}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Missing Data */}
            {result.missing.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Missing Data</Text>
                {result.missing.map((m, i) => (
                  <View key={i} style={styles.missingRow}>
                    <ShieldAlert size={14} color={T.red} />
                    <Text style={styles.missingText}>Missing: {m.replace(/_/g, " ")}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Limitations */}
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
  backBtn: { width: 40, alignItems: "flex-start" },
  headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: T.text },
  content: { padding: 18, gap: 24 },
  
  targetCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: T.border },
  targetIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: T.orangeDim, alignItems: "center", justifyContent: "center" },
  targetLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  targetName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: T.text, marginTop: 2 },
  targetDateBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.04)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  targetDate: { fontSize: 12, fontFamily: "Inter_500Medium", color: T.textMuted },
  
  mainScoreBox: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 20, backgroundColor: T.surface, borderRadius: 16, borderWidth: 1, borderColor: T.border },
  scoreRow: { flexDirection: "row", alignItems: "baseline" },
  scoreValue: { fontSize: 56, fontFamily: "Inter_700Bold", color: T.text, lineHeight: 60 },
  scoreMax: { fontSize: 24, fontFamily: "Inter_600SemiBold", color: T.textMuted, marginLeft: 2 },
  scoreLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: T.textMuted, marginTop: 4 },
  
  badgesRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 16 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeGreen: { backgroundColor: T.greenDim, borderColor: T.green + "40" },
  badgeOrange: { backgroundColor: T.orangeDim, borderColor: T.orange + "40" },
  badgeRed: { backgroundColor: T.redDim, borderColor: T.red + "40" },
  badgeNeutral: { backgroundColor: "rgba(255,255,255,0.05)", borderColor: T.border },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  
  scoreDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", marginTop: 16, lineHeight: 18 },
  
  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: T.text, marginBottom: 4 },
  
  actionCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(0,0,0,0.15)", padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  actionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textMuted, textTransform: "uppercase" },
  actionDesc: { fontSize: 15, fontFamily: "Inter_500Medium", color: T.text },
  impactBadge: { backgroundColor: T.greenDim, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: T.green + "40" },
  impactText: { fontSize: 12, fontFamily: "Inter_700Bold", color: T.green },
  
  dimCard: { backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border, overflow: "hidden" },
  dimHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingBottom: 12 },
  dimIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  dimTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.text },
  dimScore: { fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 2 },
  dimScoreMax: { fontSize: 12, fontFamily: "Inter_500Medium", color: T.textMuted },
  dimDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18, paddingHorizontal: 16, paddingBottom: 16 },
  
  evidenceRow: { backgroundColor: "rgba(0,0,0,0.2)", padding: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.03)", gap: 6 },
  evidenceLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textDim, textTransform: "uppercase", letterSpacing: 0.5 },
  evidenceStats: { flexDirection: "row", gap: 12 },
  evidenceStatText: { fontSize: 12, fontFamily: "Inter_500Medium", color: T.textMuted },
  
  missingRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.redDim, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: T.red + "40" },
  missingText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: T.red, textTransform: "capitalize" },
  
  limitationRow: { flexDirection: "row", gap: 12, backgroundColor: "rgba(0,0,0,0.15)", padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.03)" },
  limitationText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18 },
  
  emptyText: { color: T.textMuted, textAlign: "center", marginTop: 40 },
});
