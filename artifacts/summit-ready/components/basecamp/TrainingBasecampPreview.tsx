import React from "react";
import { ActivityIndicator, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { LockKeyhole } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SummitGoal } from "@/context/AppContext";
import { BASECAMP } from "@/constants/tokens";
import { T } from "@/constants/theme";
import { useCanonicalBasecampFacts } from "@/hooks/useCanonicalBasecampFacts";
import { BasecampHero } from "./BasecampHero";
import { BasecampReadiness } from "./BasecampReadiness";
import { BasecampNoGoal } from "./BasecampNoGoal";

export function TrainingBasecampPreview({ goal, error, preparing, pro, onRetry }: {
  goal: SummitGoal | null; error?: string | null; preparing?: boolean; pro?: boolean; onRetry: () => void;
}) {
  const insets = useSafeAreaInsets();
  const facts = useCanonicalBasecampFacts(goal?.mountainName ?? "");
  const unlock = () => router.push({ pathname: "/paywall", params: { tier: "pro", trigger: "training_basecamp", returnTo: "training_basecamp" } });
  if (!goal && preparing) return <View style={{ flex: 1, backgroundColor: BASECAMP.ink, alignItems: "center", justifyContent: "center", gap: 14 }}>
    <ActivityIndicator color={T.green} /><Text style={{ color: T.textMuted }}>Loading your fitness profile…</Text>
  </View>;
  if (!goal) return <View style={{ flex: 1, backgroundColor: BASECAMP.ink }}>
    {error && <Text style={{ color: T.red, padding: 20, paddingTop: insets.top + 65 }}>{error}</Text>}
    <BasecampNoGoal />
  </View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: BASECAMP.ink }} contentContainerStyle={{ paddingBottom: insets.bottom + 130 }}>
      <BasecampHero mountainName={goal.mountainName} summitDate={goal.summitDate} canonicalFacts={facts}
        topInset={Platform.OS === "web" ? 20 : insets.top + 12} isSubscribed={!!pro}
        onEditObjective={() => router.push("/setup")} onChangeMountain={() => router.push("/setup?mode=change")}
        onPressSubscription={pro ? () => router.push("/subscription") : unlock} />
      <BasecampReadiness result={null} nextAction={null} isSubscribed={false} onOpen={pro ? onRetry : unlock} />
      <View style={{ margin: BASECAMP.gutter, padding: 22, borderRadius: 16, backgroundColor: T.surface, gap: 14 }}>
        <LockKeyhole size={22} color={T.green} />
        <Text style={{ color: T.white, fontSize: 21, fontWeight: "700" }}>Your training programme</Text>
        <Text style={{ color: T.textMuted, lineHeight: 23 }}>
          {pro ? "Your Pro membership is active. We’re preparing your saved fitness profile and mountain goal."
            : "Your fitness profile and mountain goal are saved. Subscribe to Pro to unlock your readiness assessment, personalised programme and coaching."}
        </Text>
        {error && <Text style={{ color: T.red, lineHeight: 22 }}>{error}</Text>}
        {preparing ? <ActivityIndicator color={T.green} /> : <TouchableOpacity
          accessibilityRole="button" onPress={pro ? onRetry : unlock}
          style={{ backgroundColor: T.green, padding: 16, borderRadius: 12, alignItems: "center" }}>
          <Text style={{ color: T.bg, fontWeight: "700" }}>{pro ? "Retry preparing my programme" : "Unlock readiness & training with Pro"}</Text>
        </TouchableOpacity>}
        <TouchableOpacity accessibilityRole="button" onPress={() => router.push("/questionnaire")}>
          <Text style={{ color: T.green, paddingVertical: 8 }}>Edit fitness profile</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.push("/(tabs)/explore")}>
          <Text style={{ color: T.textMuted, paddingVertical: 8 }}>Continue exploring for free</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
