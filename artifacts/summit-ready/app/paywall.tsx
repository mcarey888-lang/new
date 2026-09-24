import type { LucideIcon } from "lucide-react-native";
import { MapPin, TrendingUp, Navigation, Activity, Cpu, ShoppingBag, X, Zap, Gift, AlertCircle, CheckCircle } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSubscription } from "@/lib/revenuecat";
import { T, STATUS_COLOR, STATUS_LABEL } from "@/constants/theme";
import { BASECAMP, HIT, SP, TYPE } from "@/constants/tokens";
import { useScreenView } from "@/lib/analytics";

const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: MapPin,      title: "Personalised summit training",      desc: "Plans built entirely around your mountain, date, and fitness" },
  { icon: TrendingUp,  title: "Adaptive progression plans",        desc: "Your plan updates as you train — smarter every week" },
  { icon: Navigation,  title: "Local hikes matched to fitness",    desc: "Unlimited hill recommendations near you" },
  { icon: Activity,    title: "Summit readiness tracking",         desc: "Know exactly how ready you are, week by week" },
  { icon: Cpu,         title: "AI-powered coaching insights",      desc: "Get personalised feedback from your AI summit coach" },
];

type ConfirmModalProps = {
  visible: boolean;
  packageName: string;
  priceString: string;
  onConfirm: () => void;
  onCancel: () => void;
};

function ConfirmModal({ visible, packageName, priceString, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={confirmStyles.backdrop}>
        <View style={confirmStyles.sheet}>
          <View style={confirmStyles.iconWrap}>
            <ShoppingBag size={24} color={T.green} />
          </View>
          <Text style={confirmStyles.title}>Confirm Purchase</Text>
          <Text style={confirmStyles.body}>
            You're about to subscribe to <Text style={{ color: T.white, fontFamily: "Inter_700Bold" }}>{packageName}</Text>{" "}
            for <Text style={{ color: T.green, fontFamily: "Inter_700Bold" }}>{priceString}</Text> through {Platform.select({ ios: "the App Store", android: "Google Play", default: "the store" })}.
          </Text>
          <View style={confirmStyles.btnRow}>
            <TouchableOpacity onPress={onCancel} style={confirmStyles.cancelBtn} activeOpacity={0.7}>
              <Text style={confirmStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} style={confirmStyles.confirmBtn} activeOpacity={0.85}>
              <LinearGradient colors={[BASECAMP.accent, "#15C486"]} style={confirmStyles.confirmGrad}>
                <Text style={confirmStyles.confirmText}>Confirm</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function PaywallScreen() {
  useScreenView("paywall");
  const insets = useSafeAreaInsets();
  const { offerings, purchase, restore, isPurchasing, isRestoring, offeringsLoading, offeringsError, refetchOfferings } = useSubscription();
  const params = useLocalSearchParams<{ score?: string; mountain?: string; fromQuestionnaire?: string; mode?: string }>();

  const fromQuestionnaire = params.fromQuestionnaire === "true";
  const quizScore = params.score ? parseInt(params.score, 10) : null;
  const quizMountain = params.mountain ?? null;
  const quizMode = params.mode ?? null;

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  const currentOffering = offerings?.current;
  const monthlyPkg = currentOffering?.monthly ?? currentOffering?.availablePackages?.[0] ?? null;
  const annualPkg = currentOffering?.annual ?? currentOffering?.availablePackages?.[1] ?? null;
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual">("monthly");

  const activePkg = selectedPlan === "annual" && annualPkg ? annualPkg : monthlyPkg;

  function handleSubscribe() {
    if (!activePkg) return;
    setSelectedPkg(activePkg);
    setConfirmVisible(true);
    setError(null);
  }

  async function confirmPurchase() {
    setConfirmVisible(false);
    try {
      await purchase(selectedPkg);
      if (fromQuestionnaire) {
        router.replace("/setup");
      } else {
        router.back();
      }
    } catch (e: any) {
      if (!e?.userCancelled) {
        setError("Purchase failed. Please try again.");
      }
    }
  }

  async function handleRestore() {
    setError(null);
    try {
      const info = await restore();
      const hasEntitlement = info?.entitlements?.active?.["premium"] !== undefined;
      if (hasEntitlement) {
        setRestoreSuccess(true);
        setTimeout(() => {
          setRestoreSuccess(false);
          if (fromQuestionnaire) {
            router.replace("/setup");
          } else {
            router.back();
          }
        }, 1500);
      } else {
        setError(
          "Your Google Play subscription was found but couldn't be linked to this account. " +
          "Please ensure you're signed in with the same Google account you subscribed with, then try again."
        );
      }
    } catch {
      setError("Restore failed. Please check your internet connection and try again.");
    }
  }

  return (
    <LinearGradient colors={["#0A0C10", "#0D1A12", "#0A0C10"]} style={{ flex: 1 }}>
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
        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
          <TouchableOpacity
            onPress={() => fromQuestionnaire
              ? router.replace("/setup")
              : router.back()}
            style={styles.closeBtn}
            activeOpacity={0.7}
          >
            <X size={20} color={T.textMuted} />
          </TouchableOpacity>
          <Image
            source={require("@/assets/images/logo.gif")}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.heroSection}>
          <View style={styles.proBadge}>
            <Zap size={12} color={T.green} />
            <Text style={styles.proBadgeText}>SUMMIT READY PRO</Text>
          </View>
          {fromQuestionnaire && quizScore !== null ? (
            <>
              <Text style={styles.headline}>
                {quizMountain ? `Your ${quizMountain} readiness` : "Your summit readiness"}
              </Text>
              <Text style={styles.subheadline}>
                Based on your fitness profile — start your free trial to unlock a personalised training schedule built around your summit.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.headline}>Give Yourself The Best Chance Of Reaching The Summit</Text>
              <Text style={styles.subheadline}>
                Train smarter with personalised mountain preparation designed around your summit goal.
              </Text>
            </>
          )}
        </Animated.View>

        {fromQuestionnaire && quizScore !== null && (
          <Animated.View entering={FadeInDown.delay(160).duration(600)}>
            <LinearGradient
              colors={[STATUS_COLOR(quizScore) + "22", STATUS_COLOR(quizScore) + "08"]}
              style={[styles.scoreCard, { borderColor: STATUS_COLOR(quizScore) + "50" }]}
            >
              <View style={styles.scoreLeft}>
                <Text style={styles.scoreLabel}>Current fitness baseline</Text>
                <View style={styles.scoreRow}>
                  <Text style={[styles.scoreNum, { color: STATUS_COLOR(quizScore) }]}>{quizScore}</Text>
                  <Text style={styles.scoreOutOf}>/100</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR(quizScore) + "25" }]}>
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR(quizScore) }]} />
                  <Text style={[styles.statusText, { color: STATUS_COLOR(quizScore) }]}>
                    {STATUS_LABEL(quizScore)}
                  </Text>
                </View>
              </View>
              <View style={styles.scoreRight}>
                <Text style={styles.scoreMsgHead}>Ready to improve?</Text>
                <Text style={styles.scoreMsgBody}>
                  A personalised training plan will build your score week by week until summit day.
                </Text>
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(220).duration(600)} style={styles.planSection}>
          <View style={styles.trialBanner}>
            <Gift size={14} color={T.green} />
            <Text style={styles.trialBannerText}>7-day free trial included — cancel anytime</Text>
          </View>
          <Text style={styles.planHeading}>Then choose your plan</Text>
          <View style={styles.planRow}>
            {monthlyPkg && (
              <TouchableOpacity
                onPress={() => setSelectedPlan("monthly")}
                activeOpacity={0.8}
                style={[styles.planCard, selectedPlan === "monthly" && styles.planCardActive]}
              >
                {selectedPlan === "monthly" && (
                  <LinearGradient colors={[BASECAMP.accentDim, "transparent"]} style={StyleSheet.absoluteFill} />
                )}
                <Text style={styles.planLabel}>Monthly</Text>
                <Text style={[styles.planPrice, selectedPlan === "monthly" && { color: T.green }]}>
                  {monthlyPkg.product.priceString}
                </Text>
                <Text style={styles.planPer}>per month</Text>
              </TouchableOpacity>
            )}
            {annualPkg && (
              <TouchableOpacity
                onPress={() => setSelectedPlan("annual")}
                activeOpacity={0.8}
                style={[styles.planCard, selectedPlan === "annual" && styles.planCardActive]}
              >
                {selectedPlan === "annual" && (
                  <LinearGradient colors={[BASECAMP.accentDim, "transparent"]} style={StyleSheet.absoluteFill} />
                )}
                <View style={styles.bestValueBadge}>
                  <Text style={styles.bestValueText}>BEST VALUE</Text>
                </View>
                <Text style={styles.planLabel}>Annual</Text>
                <Text style={[styles.planPrice, selectedPlan === "annual" && { color: T.green }]}>
                  {annualPkg.product.priceString}
                </Text>
                <Text style={styles.planPer}>per year</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {error && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.errorBanner}>
            <AlertCircle size={14} color={T.orange} />
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        )}

        {restoreSuccess && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.successBanner}>
            <CheckCircle size={14} color={T.green} />
            <Text style={styles.successText}>Purchases restored successfully!</Text>
          </Animated.View>
        )}

        <Animated.View entering={FadeInUp.delay(300).duration(600)} style={styles.ctaSection}>
          <TouchableOpacity
            onPress={handleSubscribe}
            disabled={isPurchasing || offeringsLoading || !activePkg}
            activeOpacity={0.85}
            style={[styles.ctaBtn, (isPurchasing || offeringsLoading || !activePkg) && { opacity: offeringsLoading ? 0.8 : 0.6 }]}
          >
            <LinearGradient colors={[BASECAMP.accent, "#15C486"]} style={styles.ctaGrad}>
              {isPurchasing || offeringsLoading
                ? <ActivityIndicator size="small" color={BASECAMP.accentInk} />
                : <Zap size={18} color={BASECAMP.accentInk} />}
              <Text style={styles.ctaText}>
                {isPurchasing
                  ? "Processing…"
                  : offeringsLoading
                    ? "Loading plans…"
                    : fromQuestionnaire
                      ? "Start My Training Plan"
                      : "Start 7-Day Free Trial"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {offeringsError && !offeringsLoading && (
            <View style={styles.offeringsErrorBox}>
              <AlertCircle size={14} color={T.orange} />
              <Text style={styles.offeringsErrorNote}>
                Couldn't load subscription plans. This can happen if the store isn't reachable right now.
              </Text>
              <TouchableOpacity onPress={() => refetchOfferings()} style={styles.retryBtn} activeOpacity={0.7}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.cancelNote}>Cancel anytime · No commitment</Text>

          <TouchableOpacity
            onPress={handleRestore}
            disabled={isRestoring}
            activeOpacity={0.7}
            style={styles.restoreBtn}
          >
            {isRestoring
              ? <ActivityIndicator size="small" color={T.textMuted} />
              : <Text style={styles.restoreText}>Restore purchases</Text>}
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.featuresSection}>
          {FEATURES.map((f, i) => {
            const FIcon = f.icon;
            return (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <FIcon size={16} color={T.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          );
          })}
        </Animated.View>

        <View style={styles.legalSection}>
          <Text style={styles.legalNote}>
            {Platform.OS === "android"
              ? "Payment will be charged to your Google Play account at confirmation of purchase. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. Manage or cancel in your Google Play account settings."
              : "Payment will be charged to your Apple ID account at confirmation of purchase. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. Manage or cancel in your App Store account settings."}
          </Text>
          <View style={styles.legalLinks}>
            <TouchableOpacity onPress={() => Linking.openURL("https://summitready.uk/privacy")} activeOpacity={0.7}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.legalSep}>·</Text>
            <TouchableOpacity onPress={() => Linking.openURL("https://summitready.uk/terms")} activeOpacity={0.7}>
              <Text style={styles.legalLink}>Terms of Use</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={confirmVisible}
        packageName={selectedPkg?.product?.title ?? "Summit Ready Pro"}
        priceString={selectedPkg?.product?.priceString ?? ""}
        onConfirm={confirmPurchase}
        onCancel={() => setConfirmVisible(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: BASECAMP.gutter, gap: SP.xxl },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  closeBtn: {
    width: HIT.minTarget, height: HIT.minTarget, borderRadius: 14,
    backgroundColor: BASECAMP.panelSub,
    borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
    alignItems: "center", justifyContent: "center",
  },
  logo: { width: 160, height: 64 },
  heroSection: { gap: 12, alignItems: "center" },
  proBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: BASECAMP.accentDim, borderRadius: 999,
    paddingHorizontal: 12, minHeight: 28,
    borderWidth: 1, borderColor: BASECAMP.accentLine,
  },
  proBadgeText: {
    ...TYPE.eyebrow, fontSize: 11, color: BASECAMP.accent,
  },
  headline: {
    ...TYPE.hero, fontSize: 28, lineHeight: 33, color: BASECAMP.text,
    textAlign: "center",
  },
  subheadline: {
    ...TYPE.body, fontSize: 14, lineHeight: 21, color: BASECAMP.textMuted,
    textAlign: "center",
  },
  featuresSection: {
    backgroundColor: BASECAMP.panelSub, borderRadius: 20,
    borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
    padding: 16, gap: 14,
  },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  featureIconWrap: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: BASECAMP.accentDim,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  featureTitle: { ...TYPE.bodyBold, fontSize: 14, color: BASECAMP.text },
  featureDesc: { marginTop: 2, fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },
  planSection: { gap: 12 },
  trialBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    backgroundColor: BASECAMP.accentDim, borderRadius: 12,
    minHeight: 42, paddingHorizontal: 14,
    borderWidth: 1, borderColor: BASECAMP.accentLine,
  },
  trialBannerText: { ...TYPE.smallBold, fontSize: 13, color: BASECAMP.accent },
  planHeading: { ...TYPE.heading, fontSize: 15, color: BASECAMP.text },
  planRow: { flexDirection: "row", gap: 10 },
  planCard: {
    flex: 1, backgroundColor: BASECAMP.panelSub,
    borderRadius: 16, borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
    padding: 14, gap: 4, alignItems: "center", minHeight: HIT.minTarget + 40,
    overflow: "hidden", position: "relative",
  },
  planCardActive: { borderColor: BASECAMP.accent, borderWidth: 1.5, backgroundColor: BASECAMP.accentDim },
  bestValueBadge: {
    backgroundColor: BASECAMP.accentDim, borderRadius: 7,
    borderWidth: 1, borderColor: BASECAMP.accentLine,
    paddingHorizontal: 7, paddingVertical: 2,
    marginBottom: 4,
  },
  bestValueText: { fontSize: 9, fontFamily: "Inter_700Bold", color: BASECAMP.accent, letterSpacing: 0.6 },
  planLabel: { ...TYPE.smallBold, fontSize: 13, color: BASECAMP.textMuted },
  planPrice: { ...TYPE.metric, fontSize: 22, lineHeight: 26, color: BASECAMP.text },
  planPer: { fontSize: 11, lineHeight: 14, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: T.orangeDim, borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: T.orange + "30",
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: T.orange },
  successBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: BASECAMP.accentDim, borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: BASECAMP.accentLine,
  },
  successText: { flex: 1, ...TYPE.small, fontSize: 13, color: BASECAMP.accent },
  ctaSection: { alignItems: "center", gap: 10 },
  ctaBtn: { width: "100%", borderRadius: 16, overflow: "hidden" },
  ctaGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, minHeight: 54,
  },
  ctaText: { fontSize: 17, lineHeight: 21, fontFamily: "Inter_700Bold", color: BASECAMP.accentInk },
  cancelNote: { fontSize: 12, lineHeight: 16, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  offeringsErrorBox: {
    flexDirection: "column", alignItems: "center", gap: 6,
    backgroundColor: T.orangeDim, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: T.orange + "30",
    width: "100%",
  },
  offeringsErrorNote: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.orange, textAlign: "center", lineHeight: 18 },
  retryBtn: {
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: T.orange + "50",
    backgroundColor: T.orange + "15",
  },
  retryText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.orange },
  restoreBtn: { paddingVertical: 6 },
  restoreText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textDecorationLine: "underline" },
  legalSection: { gap: 10, alignItems: "center" },
  legalNote: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center", lineHeight: 15 },
  legalLinks: { flexDirection: "row", alignItems: "center", gap: 8 },
  legalLink: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textMuted, textDecorationLine: "underline" },
  legalSep: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim },

  scoreCard: {
    flexDirection: "row", alignItems: "center", gap: 16,
    borderRadius: 20, borderWidth: 1.5,
    padding: 18, overflow: "hidden",
  },
  scoreLeft: { alignItems: "flex-start", gap: 6 },
  scoreLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  scoreRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  scoreNum: { fontSize: 48, fontFamily: "Inter_700Bold", lineHeight: 52 },
  scoreOutOf: { fontSize: 16, fontFamily: "Inter_400Regular", color: T.textMuted },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  scoreRight: { flex: 1, gap: 4 },
  scoreMsgHead: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white },
  scoreMsgBody: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18 },
});

const confirmStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 32,
  },
  sheet: {
    backgroundColor: T.card, borderRadius: 20,
    borderWidth: 1, borderColor: T.border,
    padding: 24, gap: 12, width: "100%",
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: T.greenDim, alignSelf: "center",
    alignItems: "center", justifyContent: "center",
  },
  title: {
    fontSize: 18, fontFamily: "Inter_700Bold", color: T.white, textAlign: "center",
  },
  body: {
    fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted,
    textAlign: "center", lineHeight: 20,
  },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 14,
    borderWidth: 1, borderColor: T.border,
    alignItems: "center", justifyContent: "center",
  },
  cancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  confirmBtn: { flex: 2, borderRadius: 14, overflow: "hidden" },
  confirmGrad: {
    paddingVertical: 13, alignItems: "center", justifyContent: "center",
  },
  confirmText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
});
