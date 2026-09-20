import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { Activity, ChevronRight, Lock, Heart, Wind, Zap, Mountain, AlertCircle } from "lucide-react-native";
import { T } from "@/constants/theme";
import { useReadinessV2 } from "@/hooks/useReadinessV2";
import { useSubscription } from "@/lib/revenuecat";
import { ProgressRing } from "@/components/ProgressRing";

const DIM_COLORS: Record<string, string> = {
  endurance: T.green,
  elevationCapacity: T.blue,
  consistency: T.orange,
  mountainExperience: T.purple,
};
const DIM_ICONS: Record<string, any> = {
  endurance: Heart,
  elevationCapacity: Wind,
  consistency: Zap,
  mountainExperience: Mountain,
};
const DIM_LABELS: Record<string, string> = {
  endurance: "Endurance",
  elevationCapacity: "Elevation",
  consistency: "Consistency",
  mountainExperience: "Experience",
};

export function ReadinessV2Hero() {
  const { isSubscribed } = useSubscription();
  const v2 = useReadinessV2();
  const reducedMotion = useReducedMotion();
  
  if (!v2 || !v2.result) return null;
  const { result, nextAction } = v2;
  const { overallScore, dimensions, gaps, explanations, confidence } = result;

  const score = overallScore ?? 0;
  const statusColor = score >= 70 ? T.green : score >= 40 ? T.orange : T.red;
  const statusLabel = score >= 70 ? "Ready" : score >= 40 ? "Close" : "Not Ready";
  
  const dominantGap = gaps[0];
  const gapDim = dominantGap ? dimensions[dominantGap] : null;

  return (
    <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(80).duration(500)}>
      <View style={styles.card}>
        {/* Main Score Row */}
        <View style={styles.topRow}>
          <TouchableOpacity
            onPress={!isSubscribed && score > 40 ? () => router.push("/paywall") : undefined}
            activeOpacity={!isSubscribed && score > 40 ? 0.85 : 1}
          >
            <ProgressRing
              score={score}
              size={120}
              strokeWidth={9}
              hideScore={!isSubscribed && score > 40}
            />
          </TouchableOpacity>
          <View style={styles.metaCol}>
            <Text style={styles.areYouReadyLabel}>Readiness</Text>
            
            {!isSubscribed && score > 40 ? (
              <>
                <Text style={styles.trackingMsg}>
                  Endurance, elevation, consistency and mountain experience in one clear view.
                </Text>
                <TouchableOpacity onPress={() => router.push("/paywall")} style={styles.lockedStatus} activeOpacity={0.8}>
                  <Lock size={11} color={T.basecampTextMuted} />
                  <Text style={styles.lockedStatusText}>Unlock your analysis with Pro</Text>
                  <ChevronRight size={12} color={T.basecampTextDim} />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={[styles.statusPill, { backgroundColor: statusColor + "1A" }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
                <Text style={styles.trackingMsg} numberOfLines={2}>
                  {gapDim ? gapDim.explanation : explanations[0]}
                </Text>
                
                {confidence && confidence !== "none" && (
                  <View style={[styles.confBadge, confidence === "high" ? { backgroundColor: T.greenDim } : { backgroundColor: T.basecampSurface }]}>
                    <Activity size={10} color={confidence === "high" ? T.green : T.basecampTextMuted} />
                    <Text style={[styles.confText, { color: confidence === "high" ? T.green : T.basecampTextMuted }]}>
                      {confidence === "high" ? "High confidence" : confidence === "medium" ? "Medium confidence" : "Low confidence"}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
        
        {(!isSubscribed && score > 40) ? null : (
          <>
            <View style={styles.divider} />
            
            {/* Dimensions Strip */}
            <View style={styles.dimsRow}>
              {["endurance", "elevationCapacity", "consistency", "mountainExperience"].map(key => {
                const dim = dimensions[key as keyof typeof dimensions];
                const Icon = DIM_ICONS[key];
                const color = DIM_COLORS[key];
                return (
                  <View key={key} style={styles.dimItem}>
                    <View style={[styles.dimIcon, { backgroundColor: color + "15" }]}>
                      <Icon size={12} color={color} />
                    </View>
                    <Text style={[styles.dimScore, { color }]}>{dim?.score ?? "—"}</Text>
                    <Text style={styles.dimLabel}>{DIM_LABELS[key]}</Text>
                  </View>
                );
              })}
            </View>

            {/* Next Action */}
            {nextAction && (
              <View style={styles.actionRow}>
                <AlertCircle size={14} color={DIM_COLORS[nextAction.focusDimension]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Focus: {DIM_LABELS[nextAction.focusDimension]}</Text>
                  <Text style={styles.actionDesc}>{nextAction.label}</Text>
                </View>
                {nextAction.projectedImpact && (
                  <View style={styles.impactBadge}>
                    <Text style={styles.impactText}>+{nextAction.projectedImpact.delta}</Text>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.detailBtn} onPress={() => router.push("/readiness-detail" as any)} activeOpacity={0.7}>
              <Text style={styles.detailBtnText}>View detailed analysis</Text>
              <ChevronRight size={14} color={T.basecampTextMuted} />
            </TouchableOpacity>
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 0, marginBottom: 16 },
  topRow: { flexDirection: "row", paddingVertical: 18, gap: 20, alignItems: "center" },
  metaCol: { flex: 1, gap: 6, justifyContent: "center" },
  areYouReadyLabel: { fontSize: 20, lineHeight: 24, fontFamily: "Inter_700Bold", color: T.basecampText },
  statusPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  trackingMsg: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.basecampTextMuted, lineHeight: 20 },
  lockedStatus: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  lockedStatusText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.basecampTextMuted },
  confBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  confText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: T.basecampBorder },
  dimsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 18 },
  dimItem: { alignItems: "center", gap: 4, width: "22%" },
  dimIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  dimScore: { fontSize: 15, fontFamily: "Inter_700Bold" },
  dimLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: T.basecampTextMuted, textAlign: "center" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18, padding: 12, backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.03)" },
  actionTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.basecampTextMuted },
  actionDesc: { fontSize: 14, fontFamily: "Inter_500Medium", color: T.basecampText, marginTop: 2 },
  impactBadge: { backgroundColor: T.greenDim, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: T.green + "40" },
  impactText: { fontSize: 11, fontFamily: "Inter_700Bold", color: T.green },
  detailBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 14, borderTopWidth: 1, borderTopColor: T.basecampBorder },
  detailBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: T.basecampTextMuted },
});
