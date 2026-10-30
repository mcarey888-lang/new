import React, { useEffect, useState, useRef } from "react";
import { logAnalyticsEvent } from "@/lib/analytics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/expo";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useSubscription } from "@/lib/revenuecat";
import { useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";

/** Mounts paid screen children only after access is known. No hidden generation. */
export function MembershipGate({ children, allowExpedition = false }: { children: React.ReactNode; allowExpedition?: boolean }) {
  const { access, isLoading, isError, refetchCustomerInfo, canAccessExpedition } = useSubscription();
  const { shellMode, trainingPlan, activeExpedition } = useApp();
  const { userId } = useAuth();
  const [snapshot, setSnapshot] = useState<{ score: number; at: string } | null>(null);
  useEffect(() => {
    let active = true;
    setSnapshot(null);
    if (userId) void AsyncStorage.getItem(`membership_readiness_history_${userId}`).then(raw => {
      if (active && raw) { try { setSnapshot(JSON.parse(raw)); } catch { /* no valid snapshot */ } }
    });
    return () => { active = false; };
  }, [userId]);
  const expeditionView = allowExpedition && shellMode === "expedition";
  const previewLogged = useRef(false);
  useEffect(() => {
    if (!isLoading && !access.training && !expeditionView && !previewLogged.current) {
      previewLogged.current = true;
      void logAnalyticsEvent("training_preview_viewed", { offered_tier: "pro" });
    }
  }, [isLoading, access.training, expeditionView]);
  if (expeditionView ? canAccessExpedition(activeExpedition?.challengeId) : access.training) return <>{children}</>;
  if (isLoading) return <View style={{ flex: 1, backgroundColor: T.bg, justifyContent: "center" }}><ActivityIndicator color={T.green} /></View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={{ padding: 28, paddingTop: 80, gap: 20 }}>
      <Text style={{ color: T.white, fontSize: 28, fontWeight: "700" }}>{expeditionView ? "Your expedition is saved" : "Train for your mountain"}</Text>
      <Text style={{ color: T.textMuted, lineHeight: 23 }}>
        {expeditionView
          ? "Expeditions membership includes the full expedition collection, local-hill stages and expedition progress. Personalised training and readiness require Pro. Your existing progress is retained."
          : "SummitReady Pro includes personalised training, adaptive plans and mountain-specific preparedness estimates, plus the full expedition collection. Readiness is not certification of safety, technical competence or acclimatisation."}
      </Text>
      {isError && <TouchableOpacity onPress={() => { void refetchCustomerInfo(); }}><Text style={{ color: T.textMuted }}>We couldn’t refresh membership. Retry</Text></TouchableOpacity>}
      <TouchableOpacity onPress={() => router.push({ pathname: "/paywall", params: expeditionView
        ? { tier: "expeditions", trigger: "resume_expedition" }
        : { tier: "pro", trigger: "training", returnTo: "training_basecamp" } })} style={{ backgroundColor: T.green, padding: 18, borderRadius: 12 }}>
        <Text style={{ fontWeight: "700" }}>{expeditionView ? "See Expeditions membership" : "See SummitReady Pro"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.replace("/(tabs)/explore" as any)}><Text style={{ color: T.green }}>Continue exploring for free</Text></TouchableOpacity>
      {snapshot && <Text style={{ color: T.textMuted }}>Historical readiness: {snapshot.score}/100 · recorded {new Date(snapshot.at).toLocaleDateString("en-GB")}. Not a current assessment.</Text>}
      {trainingPlan.length > 0 && <View style={{ gap: 12 }}>
        <Text style={{ color: T.white, fontWeight: "700" }}>Historical training plan · read only</Text>
        <Text style={{ color: T.textMuted }}>Your saved plan and completed sessions are retained. This is not an updated training recommendation.</Text>
        {trainingPlan.map(week => <Text key={week.weekNumber} style={{ color: T.textMuted }}>Week {week.weekNumber} · {week.phase}</Text>)}
      </View>}
    </ScrollView>
  );
}
