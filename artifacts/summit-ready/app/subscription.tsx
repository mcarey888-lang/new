import { ArrowLeft, Check, Zap, ArrowRight, RefreshCw, ChevronRight, Info, CheckCircle, AlertCircle, ExternalLink, Map as MapIcon, Route } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { accessFromEntitlements, activeEntitlementIds, MEMBERSHIP } from "@workspace/membership";
import { useSubscription } from "@/lib/revenuecat";
import { T } from "@/constants/theme";
import { logAnalyticsEvent, useScreenView } from "@/lib/analytics";

type TierCard = { key: "explore" | "expeditions" | "pro"; name: string; icon: LucideIcon; color: string; features: string[] };

const STARTER_LINE = MEMBERSHIP.starterExpeditionId
  ? "One starter simulated expedition"
  : "Starter expedition not yet available";

const TIERS: TierCard[] = [
  {
    key: "explore", name: "Explore", icon: MapIcon, color: T.textMuted,
    features: [
      "Browse summits and nearby hills",
      "Unlimited GPS hike recording",
      "Full activity history and stats",
      "Preview every expedition",
      STARTER_LINE,
    ],
  },
  {
    key: "expeditions", name: "Expeditions", icon: Route, color: T.orange,
    features: [
      "Everything in Explore",
      "The full expedition collection",
      "Local-hill stage substitutions",
      "Progress, achievements and summit celebrations",
    ],
  },
  {
    key: "pro", name: "Pro", icon: Zap, color: T.green,
    features: [
      "Everything in Expeditions",
      "Personalised mountain training plans",
      "Adaptive training schedule",
      "Personalised readiness estimate",
    ],
  },
];

const TIER_LABEL = { explore: "Explore (free)", expeditions: "SummitReady Expeditions", pro: "SummitReady Pro" } as const;

function manageUrl() {
  return Platform.OS === "android"
    ? "https://play.google.com/store/account/subscriptions"
    : "https://apps.apple.com/account/subscriptions";
}

export default function SubscriptionScreen() {
  useScreenView("subscription");
  const insets = useSafeAreaInsets();
  const { customerInfo, access, restore, isRestoring } = useSubscription();
  const [restoreMsg, setRestoreMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const tier = access?.tier ?? "explore";
  const isPaid = tier !== "explore";
  const active = customerInfo?.entitlements?.active ?? {};
  const entitlement = active[MEMBERSHIP.entitlements.pro] ?? active[MEMBERSHIP.entitlements.legacy] ?? active[MEMBERSHIP.entitlements.expeditions];
  const expiresDate = entitlement?.expirationDate
    ? new Date(entitlement.expirationDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const willRenew = entitlement?.willRenew ?? false;

  async function handleRestore() {
    setRestoreMsg(null);
    try {
      const info = await restore();
      const a = accessFromEntitlements(activeEntitlementIds(info as Parameters<typeof activeEntitlementIds>[0]));
      void logAnalyticsEvent("subscription_restore", { tier: a.tier });
      if (a.tier !== "explore") {
        setRestoreMsg({ type: "success", text: `Restored: ${TIER_LABEL[a.tier]}.` });
      } else {
        setRestoreMsg({ type: "error", text: "No active subscription found. Make sure you're signed in with the same account and store account used to subscribe." });
      }
    } catch {
      setRestoreMsg({ type: "error", text: "Restore failed. Check your internet connection and try again." });
    }
  }

  function openManage() {
    void logAnalyticsEvent("subscription_manage_opened", { tier });
    void Linking.openURL(manageUrl());
  }

  function upgrade(target: "expeditions" | "pro") {
    if (isPaid) return openManage(); // never buy overlapping products
    router.push({ pathname: "/paywall", params: { tier: target, trigger: "subscription_screen" } });
  }

  return (
    <LinearGradient colors={["#060D1B", "#0A1628", "#060E1C"]} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
            paddingBottom: Platform.OS === "web" ? 60 : insets.bottom + 40,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7} accessibilityLabel="Go back">
            <ArrowLeft size={20} color={T.white} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Subscription</Text>
            <Text style={styles.subtitle}>Manage your SummitReady plan</Text>
          </View>
        </View>

        <Animated.View entering={FadeInDown.delay(60).duration(400)}>
          <View style={[styles.statusCard, isPaid && { borderColor: T.green + "50" }]}>
            <LinearGradient colors={isPaid ? [T.greenDim, "transparent"] : ["transparent", "transparent"]} style={StyleSheet.absoluteFill} />
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: isPaid ? T.green : T.textDim }]} />
              <Text style={[styles.statusLabel, isPaid && { color: T.green }]}>
                {isPaid ? `Active - ${TIER_LABEL[tier]}` : TIER_LABEL.explore}
              </Text>
            </View>
            {access?.legacy && <Text style={styles.statusDetail}>Your Premium membership includes full Pro access.</Text>}
            {isPaid && expiresDate && (
              <Text style={styles.statusDetail}>{willRenew ? `Renews ${expiresDate}` : `Expires ${expiresDate} - won't renew`}</Text>
            )}
            {!isPaid && <Text style={styles.statusDetail}>Explore is free indefinitely. No payment details needed.</Text>}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Compare plans</Text>
          {TIERS.map((t) => {
            const Icon = t.icon;
            const current = t.key === tier;
            return (
              <View key={t.key} style={[styles.tierCard, current && { borderColor: t.color + "70" }]}>
                <View style={styles.tierHead}>
                  <Icon size={14} color={t.color} />
                  <Text style={[styles.tierName, { color: t.color === T.textMuted ? T.white : t.color }]}>{t.name}</Text>
                  {current && <View style={styles.currentPill}><Text style={styles.currentText}>CURRENT</Text></View>}
                </View>
                {t.features.map((f) => (
                  <View key={f} style={styles.compareRow}>
                    <Check size={13} color={t.color} />
                    <Text style={styles.compareText}>{f}</Text>
                  </View>
                ))}
              </View>
            );
          })}
          <View style={styles.noteCard}>
            <Info size={13} color={T.textDim} />
            <Text style={styles.noteText}>
              Personalised training and readiness are part of Pro only. The readiness score is a preparedness estimate, not a safety certification.
              {!MEMBERSHIP.starterExpeditionId && " The free starter expedition is not live yet while its stage content is verified."}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>

          {tier === "explore" && (
            <>
              <TouchableOpacity onPress={() => upgrade("pro")} style={styles.upgradeBtn} activeOpacity={0.85} testID="subscription-upgrade-pro">
                <LinearGradient colors={["#3ECF75", "#2AB860"]} style={styles.upgradeBtnGrad}>
                  <Zap size={16} color="#fff" />
                  <Text style={styles.upgradeBtnText}>See Pro</Text>
                  <ArrowRight size={15} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => upgrade("expeditions")} style={styles.actionRow} activeOpacity={0.7} testID="subscription-upgrade-expeditions">
                <Route size={16} color={T.orange} />
                <Text style={styles.actionText}>See Expeditions</Text>
                <ChevronRight size={16} color={T.textDim} />
              </TouchableOpacity>
            </>
          )}
          {tier === "expeditions" && (
            <TouchableOpacity onPress={openManage} style={styles.actionRow} activeOpacity={0.7}>
              <Zap size={16} color={T.green} />
              <Text style={styles.actionText}>Change to Pro in store settings</Text>
              <ExternalLink size={16} color={T.textDim} />
            </TouchableOpacity>
          )}

          {restoreMsg && (
            <View style={[
              styles.restoreMsg,
              { borderColor: restoreMsg.type === "success" ? T.green + "30" : T.orange + "30",
                backgroundColor: restoreMsg.type === "success" ? T.greenDim : T.orangeDim },
            ]}>
              {restoreMsg.type === "success" ? <CheckCircle size={14} color={T.green} /> : <AlertCircle size={14} color={T.orange} />}
              <Text style={[styles.restoreMsgText, { color: restoreMsg.type === "success" ? T.green : T.orange }]}>{restoreMsg.text}</Text>
            </View>
          )}

          <TouchableOpacity onPress={handleRestore} disabled={isRestoring} style={styles.actionRow} activeOpacity={0.7} testID="subscription-restore">
            {isRestoring ? <ActivityIndicator size="small" color={T.blue} /> : <RefreshCw size={16} color={T.blue} />}
            <Text style={styles.actionText}>Restore purchases</Text>
            <ChevronRight size={16} color={T.textDim} />
          </TouchableOpacity>

          <TouchableOpacity onPress={openManage} style={styles.actionRow} activeOpacity={0.7} testID="subscription-manage">
            <ExternalLink size={16} color={T.blue} />
            <Text style={styles.actionText}>Manage in {Platform.OS === "android" ? "Google Play" : "App Store"}</Text>
            <ChevronRight size={16} color={T.textDim} />
          </TouchableOpacity>

          <View style={styles.noteCard}>
            <Info size={13} color={T.textDim} />
            <Text style={styles.noteText}>
              Cancel or change plan in your {Platform.OS === "android" ? "Google Play" : "App Store"} subscription settings. Access continues until the end of the current billing period. Your hikes, expedition progress and training history are kept if you move to a different plan.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  backBtn: { width: 38, height: 38, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: T.white },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },
  statusCard: { backgroundColor: T.card, borderRadius: 9, borderWidth: 1, borderColor: T.border, padding: 16, gap: 6, overflow: "hidden" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.white },
  statusDetail: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginLeft: 16 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  tierCard: { backgroundColor: T.card, borderRadius: 8, borderWidth: 1, borderColor: T.border, padding: 14, gap: 8 },
  tierHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  tierName: { fontSize: 15, fontFamily: "Inter_700Bold", flex: 1 },
  currentPill: { backgroundColor: T.greenDim, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  currentText: { fontSize: 9, fontFamily: "Inter_700Bold", color: T.green, letterSpacing: 0.6 },
  compareRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  compareText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: T.text, lineHeight: 17 },
  upgradeBtn: { borderRadius: 8, overflow: "hidden" },
  upgradeBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15 },
  upgradeBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  actionRow: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.card, borderRadius: 7,
    borderWidth: 1, borderColor: T.border, paddingVertical: 14, paddingHorizontal: 16,
  },
  actionText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: T.white },
  restoreMsg: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 6, padding: 12, borderWidth: 1 },
  restoreMsgText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  noteCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: T.surface, borderRadius: 6,
    padding: 12, borderWidth: 1, borderColor: T.border,
  },
  noteText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, lineHeight: 17 },
});
