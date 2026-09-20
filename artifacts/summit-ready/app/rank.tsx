import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowLeft, CheckCircle2, Lock, Mountain } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "@/constants/theme";
import { RANKS } from "@/utils/rankEvaluator";

export default function RankJourneyScreen() {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={T.bgGrad} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Platform.OS === "web" ? 24 : insets.top + 12, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={19} color={T.text} />
        </TouchableOpacity>
        <Text style={styles.eyebrow}>SUMMITREADY RANK</Text>
        <Text style={styles.title}>Your mountain journey</Text>
        <Text style={styles.intro}>
          Rank reflects sustained, verified outdoor progression. It is not a professional
          qualification or a statement of technical safety competence.
        </Text>

        <View style={styles.ladder}>
          {RANKS.map((rank, index) => (
            <View key={rank.rank} style={styles.rankRow}>
              <View style={styles.rail}>
                <View style={styles.marker}>
                  {index === 0 ? <Mountain size={16} color={T.green} /> : <Lock size={14} color={T.textDim} />}
                </View>
                {index < RANKS.length - 1 && <View style={styles.line} />}
              </View>
              <View style={styles.rankCard}>
                <View style={styles.rankHeader}>
                  <Text style={styles.rankName}>{rank.rank}</Text>
                  {index === 0 && (
                    <View style={styles.statusPill}>
                      <CheckCircle2 size={11} color={T.green} />
                      <Text style={styles.statusText}>First milestone</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.identity}>{rank.identity}</Text>
                <Text style={styles.requirementSummary}>
                  {rank.requirements.map((item) => `${item.minimum.toLocaleString()} ${item.label}`).join(" · ")}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Evidence building</Text>
          <Text style={styles.noticeBody}>
            Rank remains unavailable until every required producer can provide
            authority-checked evidence. Manual, indoor and simulated activity cannot
            be used as a shortcut.
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18 },
  back: {
    width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center",
    marginBottom: 22, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
  },
  eyebrow: { fontSize: 10, letterSpacing: 1.5, fontFamily: "Inter_700Bold", color: T.green, marginBottom: 8 },
  title: { fontSize: 30, lineHeight: 35, fontFamily: "Inter_700Bold", color: T.white },
  intro: { marginTop: 10, fontSize: 13, lineHeight: 20, fontFamily: "Inter_400Regular", color: T.textMuted },
  ladder: { marginTop: 28 },
  rankRow: { flexDirection: "row", gap: 13 },
  rail: { width: 34, alignItems: "center" },
  marker: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
  },
  line: { width: 1, flex: 1, minHeight: 70, backgroundColor: T.border },
  rankCard: {
    flex: 1, marginBottom: 18, padding: 14, borderRadius: 16,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
  },
  rankHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rankName: { fontSize: 18, fontFamily: "Inter_700Bold", color: T.text },
  identity: { marginTop: 6, fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", color: T.textMuted },
  requirementSummary: { marginTop: 10, fontSize: 11, lineHeight: 17, fontFamily: "Inter_500Medium", color: T.textDim },
  statusPill: { flexDirection: "row", gap: 5, alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: T.greenDim },
  statusText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.green },
  notice: { marginTop: 4, padding: 15, borderRadius: 16, backgroundColor: T.greenDim, borderWidth: 1, borderColor: T.green + "35" },
  noticeTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },
  noticeBody: { marginTop: 5, fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", color: T.textMuted },
});