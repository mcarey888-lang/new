import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowLeft, CheckCircle2, Lock, Mountain } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "@/constants/theme";
import { BASECAMP, SP, TYPE } from "@/constants/tokens";
import { SREyebrow, SRScreenHeader } from "@/components/ui";
import { RANKS } from "@/utils/rankDomain";
import { evaluateRank } from "@/utils/rankEvaluator";
import { readDevRankEvidence } from "@/utils/devProfiles";
import type { RankSignal, RankSignalAvailability } from "@/utils/rankDomain";

export default function RankJourneyScreen() {
  const insets = useSafeAreaInsets();
  const [profileId, setProfileId] = useState<string | null>(null);
  useEffect(() => {
    if (!__DEV__) return;
    AsyncStorage.getItem("summitready_dev_profile_id").then(setProfileId).catch(() => setProfileId(null));
  }, []);
  const evidence = __DEV__ && profileId ? readDevRankEvidence(profileId) : [];
  const availability = Object.fromEntries(
    ["eligibleActivities", "eligibleElevation", "distinctMountains", "summitCompletions", "activeWeeks", "expeditionMilestones"]
      .map((signal) => [signal, __DEV__ && profileId ? "available" : "unavailable"]),
  ) as Record<RankSignal, RankSignalAvailability>;
  const result = evaluateRank({ ownerUserId: "dev-fixture-owner", evidence, signalAvailability: availability });
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Platform.OS === "web" ? 24 : insets.top + 12, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SRScreenHeader title="" onBack={() => router.back()} style={styles.back} />
        <SREyebrow tone={BASECAMP.accent}>SUMMITREADY RANK</SREyebrow>
        <Text style={styles.title}>Your mountain journey</Text>
        <Text style={styles.intro}>
          Rank reflects sustained, verified outdoor progression. It is not a professional
          qualification or a statement of technical safety competence.
        </Text>

        <View style={styles.ladder}>
          {RANKS.map((rank, index) => {
            const achieved = result.currentRank
              ? index <= RANKS.findIndex((item) => item.rank === result.currentRank)
              : false;
            const current = rank.rank === result.currentRank;
            return (
            <View key={rank.rank} style={styles.rankRow}>
              <View style={styles.rail}>
                <View style={styles.marker}>
                  {achieved ? <Mountain size={16} color={BASECAMP.accent} /> : <Lock size={14} color={BASECAMP.textDim} />}
                </View>
                {index < RANKS.length - 1 && <View style={styles.line} />}
              </View>
              <View style={styles.rankCard}>
                <View style={styles.rankHeader}>
                  <Text style={styles.rankName}>{rank.rank}</Text>
                  {current && (
                    <View style={styles.statusPill}>
                      <CheckCircle2 size={11} color={T.green} />
                      <Text style={styles.statusText}>Current rank</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.identity}>{rank.identity}</Text>
                <Text style={styles.requirementSummary}>
                  {rank.requirements.map((item) => `${item.minimum.toLocaleString()} ${item.label}`).join(" · ")}
                </Text>
              </View>
            </View>
          )})}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BASECAMP.ink },
  content: { paddingHorizontal: BASECAMP.gutter },
  back: { marginBottom: SP.lg, marginHorizontal: -BASECAMP.gutter },
  title: { marginTop: 6, ...TYPE.hero, fontSize: 29, lineHeight: 33, color: BASECAMP.text },
  intro: { marginTop: 10, ...TYPE.small, fontSize: 13, lineHeight: 20, color: BASECAMP.textMuted },
  ladder: { marginTop: 28 },
  rankRow: { flexDirection: "row", gap: 13 },
  rail: { width: 34, alignItems: "center" },
  marker: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: BASECAMP.panelSub, borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },
  line: { width: 1, flex: 1, minHeight: 70, backgroundColor: BASECAMP.hairline },
  rankCard: {
    flex: 1, marginBottom: 18, padding: 14, borderRadius: 16,
    backgroundColor: BASECAMP.panelSub, borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },
  rankHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rankName: { ...TYPE.title, fontSize: 18, lineHeight: 22, color: BASECAMP.text },
  identity: { marginTop: 6, fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", color: T.textMuted },
  requirementSummary: { marginTop: 10, fontSize: 11, lineHeight: 17, fontFamily: "Inter_500Medium", color: T.textDim },
  statusPill: {
    flexDirection: "row", gap: 5, alignItems: "center",
    paddingHorizontal: 9, minHeight: 24, borderRadius: 999,
    backgroundColor: BASECAMP.accentDim, borderWidth: 1, borderColor: BASECAMP.accentLine,
  },
  statusText: { fontSize: 10, fontFamily: "Inter_700Bold", color: BASECAMP.accent, letterSpacing: 0.6 },
  notice: {
    marginTop: 4, padding: 15, borderRadius: 16,
    backgroundColor: BASECAMP.accentDim, borderWidth: 1, borderColor: BASECAMP.accentLine,
  },
  noticeTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },
  noticeBody: { marginTop: 5, fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", color: T.textMuted },
});