import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, ChevronRight, Compass, Map, Mountain, Route } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import React from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useSubscription } from "@/lib/revenuecat";
import { logAnalyticsEvent } from "@/lib/analytics";
import { logMembershipOnce } from "@/lib/membershipAnalytics";
import { useAuth } from "@clerk/expo";
import { T } from "@/constants/theme";

type Card = {
  key: string;
  icon: LucideIcon;
  color: string;
  dim: string;
  border: string;
  tag: string;
  title: string;
  desc: string;
  pills: string[];
  onPress: () => void;
};

export default function ModeSelectScreen() {
  const insets = useSafeAreaInsets();
  const { setAppMode, setShellMode } = useApp();
  const { access } = useSubscription();
  const { userId } = useAuth();

  async function handleExplore() {
    void logAnalyticsEvent("intention_selected", { intention: "explore" });
    void logMembershipOnce(userId, "onboarding_completed", { intention: "explore" });
    await setAppMode("explore");
    router.replace("/(tabs)/explore");
  }

  async function handleExpeditions() {
    void logAnalyticsEvent("intention_selected", { intention: "expeditions" });
    void logMembershipOnce(userId, "onboarding_completed", { intention: "expeditions" });
    await setAppMode("explore");
    await setShellMode("expedition");
    // Browsing and the starter expedition (when configured) stay free; paid
    // expeditions are gated on the expeditions screen itself.
    router.replace("/(expedition)/mountains");
  }

  async function handleTrain() {
    void logAnalyticsEvent("intention_selected", { intention: "training" });
    void logMembershipOnce(userId, "onboarding_completed", { intention: "training" });
    if (access?.training) {
      await setAppMode("summit");
      router.replace("/questionnaire");
      return;
    }
    // Explain Pro before any questionnaire; no personalised plan is generated for free.
    router.push({
      pathname: "/paywall",
      params: { tier: "pro", trigger: "mode_select_training", returnTo: "questionnaire" },
    });
  }

  const cards: Card[] = [
    {
      key: "explore", icon: Map, color: T.green, dim: T.greenDim,
      border: "rgba(62,207,117,0.25)", tag: "FREE",
      title: "Explore and track hikes",
      desc: "Browse summits, find hills near you and record unlimited hikes. No payment details needed.",
      pills: ["Find hills", "Record hikes", "Activity history"],
      onPress: handleExplore,
    },
    {
      key: "expeditions", icon: Route, color: T.orange, dim: T.orangeDim,
      border: T.orange + "40", tag: access?.fullExpeditions ? "INCLUDED" : "EXPEDITIONS",
      title: "Take on simulated expeditions",
      desc: "Turn local hikes into stages of a famous mountain journey. Browse every expedition; the full collection needs Expeditions or Pro.",
      pills: ["Stage progress", "Local hill stages", "Summit celebrations"],
      onPress: handleExpeditions,
    },
    {
      key: "train", icon: Compass, color: T.blue, dim: T.blueDim,
      border: "rgba(74,159,245,0.25)", tag: access?.training ? "INCLUDED" : "PRO",
      title: "Train for a real mountain",
      desc: "A personalised plan built around your target mountain and date, with a readiness estimate as you train.",
      pills: ["Structured plan", "Readiness estimate", "Hill targets"],
      onPress: handleTrain,
    },
  ];

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top + 24,
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 28,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { top: Platform.OS === "web" ? 16 : insets.top + 8 }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={22} color={T.textMuted} />
        </TouchableOpacity>

        <Animated.View entering={FadeInDown.delay(80).duration(700)} style={styles.header}>
          <Image source={require("@/assets/images/logo.gif")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.subtitle}>What brings you to SummitReady?</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(240).duration(700)} style={styles.cards}>
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <TouchableOpacity
                key={c.key}
                testID={`mode-${c.key}`}
                style={[styles.card, { borderColor: c.border }]}
                onPress={c.onPress}
                activeOpacity={0.85}
              >
                <LinearGradient colors={[c.dim, "rgba(0,0,0,0)"]} style={styles.cardGrad}>
                  <View style={[styles.iconWrap, { backgroundColor: c.dim }]}>
                    <Icon size={24} color={c.color} />
                  </View>
                  <View style={styles.cardBody}>
                    <View style={[styles.tag, { borderColor: c.border }]}>
                      <Text style={[styles.tagText, { color: c.color }]}>{c.tag}</Text>
                    </View>
                    <Text style={styles.cardTitle}>{c.title}</Text>
                    <Text style={styles.cardDesc}>{c.desc}</Text>
                    <View style={styles.pills}>
                      {c.pills.map((p) => (
                        <View key={p} style={styles.pill}><Text style={styles.pillText}>{p}</Text></View>
                      ))}
                    </View>
                  </View>
                  <ChevronRight size={20} color={c.color} style={{ alignSelf: "center", flexShrink: 0 }} />
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(480).duration(600)} style={styles.footer}>
          <Mountain size={14} color={T.textDim} />
          <Text style={styles.footerText}>You can switch between modes any time from your account.</Text>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 20, justifyContent: "space-between", gap: 20 },
  backBtn: {
    position: "absolute", left: 16, zIndex: 10, width: 36, height: 36, borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: T.border,
    alignItems: "center", justifyContent: "center",
  },
  header: { alignItems: "center", gap: 10 },
  logo: { width: 260, height: 104 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 22 },
  cards: { gap: 12 },
  card: { borderRadius: 10, overflow: "hidden", borderWidth: 1 },
  cardGrad: { padding: 18, flexDirection: "row", alignItems: "flex-start", gap: 14 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardBody: { flex: 1, gap: 8 },
  tag: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  cardTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.text },
  cardDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 19 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: {
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4,
    borderWidth: 1, borderColor: T.border,
  },
  pillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  footerText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center" },
});
