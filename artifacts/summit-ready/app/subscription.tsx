import { ArrowLeft, Check, Zap, ArrowRight, RefreshCw, ChevronRight, Info, CheckCircle, AlertCircle } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSubscription } from "@/lib/revenuecat";
import { T } from "@/constants/theme";

const FREE_FEATURES = [
  "1 summit goal",
  "Basic training plan",
  "Hike logging",
  "Limited readiness tracking",
];

const PRO_FEATURES = [
  "Unlimited summit goals",
  "Full adaptive training plans",
  "Advanced readiness analytics",
  "AI coaching insights",
  "Unlimited hill recommendations",
  "Progress tracking & analytics",
  "Smart progression updates",
  "Export & share functionality",
  "Offline access",
];

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const { customerInfo, isSubscribed, restore, isRestoring } = useSubscription();
  const [restoreMsg, setRestoreMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const entitlement = customerInfo?.entitlements.active?.["premium"];
  const expiresDate = entitlement?.expirationDate
    ? new Date(entitlement.expirationDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const willRenew = entitlement?.willRenew ?? false;

  async function handleRestore() {
    setRestoreMsg(null);
    try {
      const info = await restore();
      const hasEntitlement = info?.entitlements?.active?.["premium"] !== undefined;
      if (hasEntitlement) {
        setRestoreMsg({ type: "success", text: "Purchases restored successfully." });
      } else {
        setRestoreMsg({ type: "error", text: "No active subscription found. Make sure you're signed in with the same Google account used to subscribe." });
      }
    } catch {
      setRestoreMsg({ type: "error", text: "Restore failed. Check your internet connection and try again." });
    }
  }

  return (
    <LinearGradient colors={["#060D1B", "#0A1628", "#060E1C"]} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Platform.OS === "web" ? 64 : insets.top + 16,
            paddingBottom: Platform.OS === "web" ? 60 : insets.bottom + 40,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color={T.white} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Subscription</Text>
            <Text style={styles.subtitle}>Manage your Summit Ready plan</Text>
          </View>
        </View>

        <Animated.View entering={FadeInDown.delay(60).duration(400)}>
          <View style={[styles.statusCard, isSubscribed && { borderColor: T.green + "50" }]}>
            <LinearGradient
              colors={isSubscribed ? [T.greenDim, "transparent"] : ["transparent", "transparent"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: isSubscribed ? T.green : T.textDim }]} />
              <Text style={[styles.statusLabel, isSubscribed && { color: T.green }]}>
                {isSubscribed ? "Active — Summit Ready Pro" : "Free Plan"}
              </Text>
            </View>

            {isSubscribed && expiresDate && (
              <Text style={styles.statusDetail}>
                {willRenew ? `Renews ${expiresDate}` : `Expires ${expiresDate} · Won't renew`}
              </Text>
            )}

            {!isSubscribed && (
              <Text style={styles.statusDetail}>Upgrade to unlock all features</Text>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>What's included</Text>

          <View style={styles.compareCard}>
            <View style={styles.compareCol}>
              <Text style={styles.comparePlanName}>Free</Text>
              {FREE_FEATURES.map((f, i) => (
                <View key={i} style={styles.compareRow}>
                  <Check size={13} color={T.textMuted} />
                  <Text style={styles.compareText}>{f}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.compareCol, styles.compareColPro]}>
              <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <View style={styles.compareProHeader}>
                <Zap size={12} color={T.green} />
                <Text style={styles.comparePlanNamePro}>Pro</Text>
              </View>
              {PRO_FEATURES.map((f, i) => (
                <View key={i} style={styles.compareRow}>
                  <Check size={13} color={T.green} />
                  <Text style={[styles.compareText, { color: T.text }]}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>

          {!isSubscribed && (
            <TouchableOpacity
              onPress={() => router.push("/paywall")}
              style={styles.upgradeBtn}
              activeOpacity={0.85}
            >
              <LinearGradient colors={["#3ECF75", "#2AB860"]} style={styles.upgradeBtnGrad}>
                <Zap size={16} color="#fff" />
                <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
                <ArrowRight size={15} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {restoreMsg && (
            <View style={[
              styles.restoreMsg,
              { borderColor: restoreMsg.type === "success" ? T.green + "30" : T.orange + "30",
                backgroundColor: restoreMsg.type === "success" ? T.greenDim : T.orangeDim },
            ]}>
              {restoreMsg.type === "success"
                ? <CheckCircle size={14} color={T.green} />
                : <AlertCircle size={14} color={T.orange} />}
              <Text style={[styles.restoreMsgText, { color: restoreMsg.type === "success" ? T.green : T.orange }]}>
                {restoreMsg.text}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleRestore}
            disabled={isRestoring}
            style={styles.actionRow}
            activeOpacity={0.7}
          >
            {isRestoring
              ? <ActivityIndicator size="small" color={T.blue} />
              : <RefreshCw size={16} color={T.blue} />}
            <Text style={styles.actionText}>Restore purchases</Text>
            <ChevronRight size={16} color={T.textDim} />
          </TouchableOpacity>

          <View style={styles.noteCard}>
            <Info size={13} color={T.textDim} />
            <Text style={styles.noteText}>
              To cancel, go to your device's App Store subscription settings. Your subscription continues until the end of the current billing period.
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
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: T.white },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },
  statusCard: {
    backgroundColor: T.card, borderRadius: 18,
    borderWidth: 1, borderColor: T.border,
    padding: 16, gap: 6, overflow: "hidden",
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.white },
  statusDetail: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginLeft: 16 },
  section: { gap: 12 },
  sectionTitle: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5,
  },
  compareCard: {
    flexDirection: "row", gap: 10,
  },
  compareCol: {
    flex: 1, backgroundColor: T.card,
    borderRadius: 16, borderWidth: 1, borderColor: T.border,
    padding: 12, gap: 8,
  },
  compareColPro: {
    borderColor: T.green + "40", overflow: "hidden",
  },
  compareProHeader: { flexDirection: "row", alignItems: "center", gap: 5 },
  comparePlanName: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.textMuted },
  comparePlanNamePro: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.green },
  compareRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  compareText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 16 },
  upgradeBtn: { borderRadius: 16, overflow: "hidden" },
  upgradeBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 15,
  },
  upgradeBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  actionRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.card, borderRadius: 14,
    borderWidth: 1, borderColor: T.border,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  actionText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: T.white },
  restoreMsg: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, padding: 12, borderWidth: 1,
  },
  restoreMsgText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  noteCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: T.surface, borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: T.border,
  },
  noteText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, lineHeight: 17 },
});
