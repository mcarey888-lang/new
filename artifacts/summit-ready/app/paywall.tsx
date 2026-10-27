import type { LucideIcon } from "lucide-react-native";
import { MapPin, TrendingUp, Navigation, Activity, Route, Flag, Map as MapIcon, ShoppingBag, X, Zap, AlertCircle, CheckCircle, ExternalLink } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/expo";
import React, { useEffect, useState } from "react";
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
import { accessFromEntitlements, cachedEntitlementIds } from "@workspace/membership";
import { useSubscription } from "@/lib/revenuecat";
import { MEMBERSHIP } from "@workspace/membership";
import { T } from "@/constants/theme";
import { BASECAMP, HIT, SP, TYPE } from "@/constants/tokens";
import { logAnalyticsEvent, useScreenView } from "@/lib/analytics";
import { sanitisePaywallParams } from "@/utils/paywallAuthReturn";

type PaidTier = "expeditions" | "pro";
type Feature = { icon: LucideIcon; title: string; desc: string };

const EXPEDITION_FEATURES: Feature[] = [
  { icon: Route,    title: "The full expedition collection", desc: "Start and progress through every simulated expedition" },
  { icon: MapIcon,  title: "Local hills become stages",      desc: "Use supported local-hill substitutions for each stage" },
  { icon: Flag,     title: "Progress and summit moments",    desc: "Full progress visualisation, achievements and celebrations" },
];

const PRO_FEATURES: Feature[] = [
  { icon: MapPin,     title: "Personalised summit training",   desc: "A plan built around your mountain, date and fitness" },
  { icon: TrendingUp, title: "Adaptive progression",           desc: "Your schedule adjusts as you log sessions" },
  { icon: Navigation, title: "Training on your local hills",   desc: "Sessions matched to hills near you" },
  { icon: Activity,   title: "Readiness estimate",             desc: "A guide to how prepared you are, week by week" },
  { icon: Route,      title: "Everything in Expeditions",      desc: "The full simulated expedition collection is included" },
];

const TIER_NAME: Record<PaidTier, string> = { expeditions: "SummitReady Expeditions", pro: "SummitReady Pro" };

export function manageSubscriptionsUrl() {
  return Platform.OS === "android"
    ? "https://play.google.com/store/account/subscriptions"
    : "https://apps.apple.com/account/subscriptions";
}

/** ISO 8601 period (P1M, P1Y, P12W) to a readable billing period. */
function periodLabel(period: string | null | undefined, fallback: "monthly" | "annual") {
  const m = period ? /^P(\d+)([DWMY])$/.exec(period) : null;
  if (!m) return fallback === "annual" ? "per year" : "per month";
  const n = Number(m[1]);
  const unit = { D: "day", W: "week", M: "month", Y: "year" }[m[2] as "D" | "W" | "M" | "Y"];
  return n === 1 ? `per ${unit}` : `every ${n} ${unit}s`;
}

type ConfirmModalProps = {
  visible: boolean;
  packageName: string;
  priceString: string;
  period: string;
  trialDays: number | null;
  onConfirm: () => void;
  onCancel: () => void;
};

function ConfirmModal({ visible, packageName, priceString, period, trialDays, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={confirmStyles.backdrop}>
        <View style={confirmStyles.sheet}>
          <View style={confirmStyles.iconWrap}>
            <ShoppingBag size={24} color={T.green} />
          </View>
          <Text style={confirmStyles.title}>Confirm Purchase</Text>
          <Text style={confirmStyles.body}>
            {trialDays === 14 ? "Your selected offer starts with a 14-day free trial, then renews to " : "You're about to subscribe to "}<Text style={{ color: T.white, fontFamily: "Inter_700Bold" }}>{packageName}</Text>{" "}
            for <Text style={{ color: T.green, fontFamily: "Inter_700Bold" }}>{priceString}</Text> {period} through {Platform.select({ ios: "the App Store", android: "Google Play", default: "the store" })}.
          </Text>
          <View style={confirmStyles.btnRow}>
            <TouchableOpacity onPress={onCancel} style={confirmStyles.cancelBtn} activeOpacity={0.7}>
              <Text style={confirmStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} style={confirmStyles.confirmBtn} activeOpacity={0.85} testID="paywall-confirm">
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
  const { isLoaded: authLoaded, userId } = useAuth();
  const {
    access, packagesForTier, trialDaysForPackage, purchase, restore, isPurchasing, isRestoring,
    offeringsLoading, offeringsError, refetchOfferings,
  } = useSubscription();
  const raw = useLocalSearchParams<{
    tier?: string; trigger?: string; returnTo?: string; mountain?: string; goal?: string;
    score?: string; fromQuestionnaire?: string; plan?: string;
  }>();
  const params = sanitisePaywallParams(raw);

  const tier: PaidTier = params.tier === "expeditions" ? "expeditions" : "pro";
  const trigger = params.trigger ?? "direct";
  const returnTo = params.returnTo ?? null; // only "questionnaire" survives sanitising
  const fromQuestionnaire = params.fromQuestionnaire === "true";
  const mountain = params.mountain ?? null;

  const { monthly: monthlyPkg, annual: annualPkg } = packagesForTier(tier);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual">(
    params.plan === "monthly" ? "monthly" : "annual",
  );
  const activePkg = selectedPlan === "annual" ? (annualPkg ?? monthlyPkg) : (monthlyPkg ?? annualPkg);
  const activePlan: "monthly" | "annual" = activePkg && activePkg === annualPkg ? "annual" : "monthly";

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const alreadyHasTier = tier === "pro" ? !!access?.training : !!access?.fullExpeditions;
  const isPaidSubscriber = access?.tier === "expeditions" || access?.tier === "pro";
  // Never sell an overlapping product: existing paid subscribers upgrade via the store.
  const canReplace = access?.tier === "expeditions" && tier === "pro" &&
    MEMBERSHIP.nativeUpgradesVerified && Platform.OS !== "web";
  const mustManageInStore = isPaidSubscriber && !alreadyHasTier && !canReplace;
  const tierUnavailable = !offeringsLoading && !offeringsError && !monthlyPkg && !annualPkg;

  useEffect(() => {
    void logAnalyticsEvent("paywall_viewed", { tier, trigger });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goOnward() {
    if (returnTo === "questionnaire") {
      router.replace({ pathname: "/questionnaire", params: { ...(mountain && { mountain }), ...(params.goal && { goal: params.goal }) } });
    } else if (fromQuestionnaire) router.replace("/setup");
    else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/dashboard");
  }

  function continueFree() {
    void logAnalyticsEvent("paywall_dismissed", { tier, trigger });
    if (returnTo === "questionnaire" || fromQuestionnaire) {
      // No personalised plan is generated on the free tier.
      router.replace("/(tabs)/explore");
    } else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/explore");
  }

  function openManage() {
    void logAnalyticsEvent("paywall_manage_opened", { tier, trigger });
    void Linking.openURL(manageSubscriptionsUrl());
  }

  function handleSubscribe() {
    setError(null);
    if (mustManageInStore) return openManage();
    if (!activePkg) return;
    if (!userId) {
      void logAnalyticsEvent("paywall_sign_in_required", { tier, trigger });
      router.push({
        pathname: "/(auth)/sign-in",
        params: {
          ...params,
          plan: activePlan,
          returnTo: "paywall",
          ...(returnTo && { next: returnTo }),
        },
      });
      return;
    }
    void logAnalyticsEvent("paywall_purchase_started", { tier, trigger, plan: activePlan });
    setConfirmVisible(true);
  }

  function verifies(info: unknown) {
    const a = accessFromEntitlements(cachedEntitlementIds(info as Parameters<typeof cachedEntitlementIds>[0]));
    return tier === "pro" ? a.training : a.fullExpeditions;
  }

  async function confirmPurchase() {
    setConfirmVisible(false);
    if (!userId || !activePkg) return;
    try {
      const info = await purchase(activePkg);
      const customerInfo = (info as { customerInfo?: unknown })?.customerInfo ?? info;
      if (!verifies(customerInfo)) {
        void logAnalyticsEvent("paywall_purchase_unverified", { tier, trigger });
        setError("The store completed the transaction, but access hasn't been confirmed yet. Try Restore purchases in a moment.");
        return;
      }
      void logAnalyticsEvent("paywall_purchase_verified", { tier, trigger, plan: activePlan });
      setSuccess(`${TIER_NAME[tier]} is active.`);
      setTimeout(goOnward, 1200);
    } catch (e: any) {
      if (!e?.userCancelled) setError("Purchase failed. Please try again.");
      void logAnalyticsEvent(e?.userCancelled ? "paywall_purchase_cancelled" : "paywall_purchase_failed", { tier, trigger });
    }
  }

  async function handleRestore() {
    setError(null);
    if (!userId) {
      setError("Sign in to the account used for your purchase, then restore it here.");
      return;
    }
    try {
      const info = await restore();
      void logAnalyticsEvent("paywall_restore", { tier, trigger });
      if (verifies(info)) {
        setSuccess("Purchases restored successfully.");
        setTimeout(goOnward, 1500);
      } else {
        setError("No active subscription for this plan was found. Make sure you're signed in with the account and store account you subscribed with.");
      }
    } catch {
      setError("Restore failed. Please check your internet connection and try again.");
    }
  }

  const features = tier === "pro" ? PRO_FEATURES : EXPEDITION_FEATURES;
  const busy = isPurchasing || offeringsLoading;
  const ctaDisabled = !alreadyHasTier && (busy || !authLoaded || (!mustManageInStore && !activePkg));

  return (
    <LinearGradient colors={["#0A0C10", "#0D1A12", "#0A0C10"]} style={{ flex: 1 }}>
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
        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
          <TouchableOpacity
            onPress={continueFree}
            accessibilityRole="button"
            accessibilityLabel="Close upgrade screen"
            testID="paywall-close"
            style={styles.closeBtn}
            activeOpacity={0.7}
          >
            <X size={20} color={T.textMuted} />
          </TouchableOpacity>
          <Image source={require("@/assets/images/logo.gif")} style={styles.logo} resizeMode="contain" />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.heroSection}>
          <View style={styles.proBadge}>
            {tier === "pro" ? <Zap size={12} color={T.green} /> : <Route size={12} color={T.green} />}
            <Text style={styles.proBadgeText}>{TIER_NAME[tier].toUpperCase()}</Text>
          </View>
          <Text style={styles.headline}>
            {tier === "pro"
              ? mountain ? `Train for ${mountain}` : "Train for a real mountain"
              : "Unlock every expedition"}
          </Text>
          <Text style={styles.subheadline}>
            {tier === "pro"
              ? "Pro builds a personalised plan around your summit goal, then tracks a readiness estimate as you train. It includes the full expedition collection too."
              : "Turn your local hikes into the full collection of simulated mountain expeditions. Want a personalised plan for a real summit? Pro includes expeditions plus training."}
          </Text>
          {returnTo === "questionnaire" && (
            <Text style={styles.heroNote}>Your training questions come next, once Pro is active.</Text>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(600)} style={styles.featuresSection}>
          {features.map((f) => {
            const FIcon = f.icon;
            return (
              <View key={f.title} style={styles.featureRow}>
                <View style={styles.featureIconWrap}><FIcon size={16} color={T.green} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            );
          })}
        </Animated.View>

        {alreadyHasTier ? (
          <View style={styles.successBanner}>
            <CheckCircle size={14} color={T.green} />
            <Text style={styles.successText}>
              {access?.legacy && tier === "pro" ? "Your existing Premium membership includes Pro." : `You already have ${TIER_NAME[tier]}.`}
            </Text>
          </View>
        ) : mustManageInStore ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              You already have a paid SummitReady subscription. To change plan, use your {Platform.OS === "android" ? "Google Play" : "App Store"} subscription settings so you are never charged for two plans at once.
            </Text>
          </View>
        ) : (
          <Animated.View entering={FadeInDown.delay(220).duration(600)} style={styles.planSection}>
            <Text style={styles.planHeading}>Choose your billing</Text>
            {offeringsLoading ? (
              <View style={styles.planRow}>
                <View style={[styles.planCard, styles.skeleton]} />
                <View style={[styles.planCard, styles.skeleton]} />
              </View>
            ) : (
              <View style={styles.planColumn}>
                {annualPkg && (
                  <TouchableOpacity
                    testID="paywall-plan-annual"
                    onPress={() => setSelectedPlan("annual")}
                    activeOpacity={0.8}
                    style={[styles.planCardWide, activePlan === "annual" && styles.planCardActive]}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.planLabel}>Annual</Text>
                      <Text style={styles.planPer}>Billed {periodLabel(annualPkg.product?.subscriptionPeriod, "annual").replace("per ", "once per ")}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.planPrice, activePlan === "annual" && { color: T.green }]}>{annualPkg.product?.priceString}</Text>
                      <Text style={styles.planPer}>{periodLabel(annualPkg.product?.subscriptionPeriod, "annual")}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                {monthlyPkg && (
                  <TouchableOpacity
                    testID="paywall-plan-monthly"
                    onPress={() => setSelectedPlan("monthly")}
                    activeOpacity={0.8}
                    style={[styles.planCardWide, activePlan === "monthly" && styles.planCardActive]}
                  >
                    <View style={{ flex: 1 }}><Text style={styles.planLabel}>Monthly</Text></View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.planPrice, activePlan === "monthly" && { color: T.green }]}>{monthlyPkg.product?.priceString}</Text>
                      <Text style={styles.planPer}>{periodLabel(monthlyPkg.product?.subscriptionPeriod, "monthly")}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {tierUnavailable && (
              <View style={styles.offeringsErrorBox}>
                <Text style={styles.offeringsErrorNote}>
                  {tier === "expeditions"
                    ? "Expeditions membership isn't available to buy yet. You can keep exploring free, or choose Pro, which includes every expedition."
                    : "Subscription plans aren't available right now. Please try again."}
                </Text>
                {tier === "expeditions" ? (
                  <TouchableOpacity
                    onPress={() => router.setParams({ tier: "pro" })}
                    style={styles.retryBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.retryText}>See Pro instead</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => refetchOfferings()} style={styles.retryBtn} activeOpacity={0.7}>
                    <Text style={styles.retryText}>Try again</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Animated.View>
        )}

        {error && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.errorBanner}>
            <AlertCircle size={14} color={T.orange} />
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        )}
        {success && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.successBanner}>
            <CheckCircle size={14} color={T.green} />
            <Text style={styles.successText}>{success}</Text>
          </Animated.View>
        )}

        <Animated.View entering={FadeInUp.delay(300).duration(600)} style={styles.ctaSection}>
          <TouchableOpacity
            testID="paywall-cta"
            onPress={alreadyHasTier ? goOnward : handleSubscribe}
            disabled={ctaDisabled}
            activeOpacity={0.85}
            style={[styles.ctaBtn, ctaDisabled && { opacity: 0.6 }]}
          >
            <LinearGradient colors={[BASECAMP.accent, "#15C486"]} style={styles.ctaGrad}>
              {busy && !alreadyHasTier
                ? <ActivityIndicator size="small" color={BASECAMP.accentInk} />
                : mustManageInStore ? <ExternalLink size={18} color={BASECAMP.accentInk} /> : <Zap size={18} color={BASECAMP.accentInk} />}
              <Text style={styles.ctaText}>
                {alreadyHasTier
                  ? "Continue"
                  : isPurchasing
                    ? "Processing..."
                    : offeringsLoading
                      ? "Loading plans..."
                      : mustManageInStore
                        ? "Manage subscription"
                        : !userId
                          ? "Sign in to subscribe"
                          : `Subscribe to ${tier === "pro" ? "Pro" : "Expeditions"}`}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {tier === "pro" && trialDaysForPackage(activePkg) === 14 && (
            <Text style={styles.offeringsErrorNote}>
              Your selected store offer includes a 14-day free trial. Unless cancelled, it renews at the price and billing period shown above.
            </Text>
          )}
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

          <TouchableOpacity
            onPress={continueFree}
            accessibilityRole="button"
            testID="paywall-continue-free"
            style={[styles.linkBtn, { minHeight: HIT.minTarget }]}
          >
            <Text style={styles.freeText}>Continue with Explore (free)</Text>
          </TouchableOpacity>

          <View style={styles.linkRow}>
            <TouchableOpacity onPress={handleRestore} disabled={isRestoring} activeOpacity={0.7} style={styles.linkBtn} testID="paywall-restore">
              {isRestoring
                ? <ActivityIndicator size="small" color={T.textMuted} />
                : <Text style={styles.restoreText}>Restore purchases</Text>}
            </TouchableOpacity>
            <Text style={styles.legalSep}>·</Text>
            <TouchableOpacity onPress={openManage} activeOpacity={0.7} style={styles.linkBtn} testID="paywall-manage">
              <Text style={styles.restoreText}>Manage subscription</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {tier === "pro" && (
          <Text style={styles.disclaimer}>
            The readiness score is a preparedness estimate based on your training, not a safety certification. Always check conditions and use your own judgement on the hill.
          </Text>
        )}

        <View style={styles.legalSection}>
          <Text style={styles.legalNote}>
            {Platform.OS === "android"
              ? "Payment will be charged to your Google Play account at confirmation of purchase. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. Manage or cancel in your Google Play account settings."
              : Platform.OS === "ios"
                ? "Payment will be charged to your Apple ID account at confirmation of purchase. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. Manage or cancel in your App Store account settings."
                : "Native-store subscriptions are purchased and managed through the App Store on iOS or Google Play on Android. You can continue using the free features here without purchasing."}
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
        packageName={activePkg?.product?.title ?? TIER_NAME[tier]}
        priceString={activePkg?.product?.priceString ?? ""}
        period={periodLabel(activePkg?.product?.subscriptionPeriod, activePlan)}
        trialDays={trialDaysForPackage(activePkg)}
        onConfirm={confirmPurchase}
        onCancel={() => setConfirmVisible(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: BASECAMP.gutter, gap: SP.xxl },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  closeBtn: {
    width: HIT.minTarget, height: HIT.minTarget, borderRadius: 7,
    backgroundColor: BASECAMP.panelSub, borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
    alignItems: "center", justifyContent: "center",
  },
  logo: { width: 160, height: 64 },
  heroSection: { gap: 12, alignItems: "center" },
  proBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: BASECAMP.accentDim, borderRadius: 999,
    paddingHorizontal: 12, minHeight: 28, borderWidth: 1, borderColor: BASECAMP.accentLine,
  },
  proBadgeText: { ...TYPE.eyebrow, fontSize: 11, color: BASECAMP.accent },
  headline: { ...TYPE.hero, fontSize: 28, lineHeight: 33, color: BASECAMP.text, textAlign: "center" },
  subheadline: { ...TYPE.body, fontSize: 14, lineHeight: 21, color: BASECAMP.textMuted, textAlign: "center" },
  heroNote: { ...TYPE.smallBold, fontSize: 12, color: BASECAMP.accent, textAlign: "center" },
  featuresSection: {
    backgroundColor: BASECAMP.panelSub, borderRadius: 10,
    borderWidth: 1, borderColor: BASECAMP.panelSubBorder, padding: 16, gap: 14,
  },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  featureIconWrap: {
    width: 34, height: 34, borderRadius: 11, backgroundColor: BASECAMP.accentDim,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  featureTitle: { ...TYPE.bodyBold, fontSize: 14, color: BASECAMP.text },
  featureDesc: { marginTop: 2, fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },
  planSection: { gap: 12 },
  planHeading: { ...TYPE.heading, fontSize: 15, color: BASECAMP.text },
  planRow: { flexDirection: "row", gap: 10 },
  planColumn: { gap: 10 },
  planCard: {
    flex: 1, backgroundColor: BASECAMP.panelSub, borderRadius: 8, borderWidth: 1,
    borderColor: BASECAMP.panelSubBorder, minHeight: HIT.minTarget + 32,
  },
  skeleton: { opacity: 0.5 },
  planCardWide: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: BASECAMP.panelSub, borderRadius: 8, borderWidth: 1,
    borderColor: BASECAMP.panelSubBorder, padding: 16, minHeight: HIT.minTarget + 20,
  },
  planCardActive: { borderColor: BASECAMP.accent, borderWidth: 1.5, backgroundColor: BASECAMP.accentDim },
  planLabel: { ...TYPE.smallBold, fontSize: 14, color: BASECAMP.text },
  planPrice: { ...TYPE.metric, fontSize: 22, lineHeight: 26, color: BASECAMP.text },
  planPer: { fontSize: 11, lineHeight: 14, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  infoBox: {
    backgroundColor: BASECAMP.panelSub, borderRadius: 8, borderWidth: 1,
    borderColor: BASECAMP.panelSubBorder, padding: 14,
  },
  infoText: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: T.orangeDim, borderRadius: 6,
    padding: 12, borderWidth: 1, borderColor: T.orange + "30",
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: T.orange },
  successBanner: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: BASECAMP.accentDim, borderRadius: 6,
    padding: 12, borderWidth: 1, borderColor: BASECAMP.accentLine,
  },
  successText: { flex: 1, ...TYPE.small, fontSize: 13, color: BASECAMP.accent },
  ctaSection: { alignItems: "center", gap: 8 },
  ctaBtn: { width: "100%", borderRadius: 8, overflow: "hidden" },
  ctaGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 54 },
  ctaText: { fontSize: 17, lineHeight: 21, fontFamily: "Inter_700Bold", color: BASECAMP.accentInk },
  offeringsErrorBox: {
    flexDirection: "column", alignItems: "center", gap: 6, backgroundColor: T.orangeDim, borderRadius: 7,
    padding: 14, borderWidth: 1, borderColor: T.orange + "30", width: "100%",
  },
  offeringsErrorNote: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.orange, textAlign: "center", lineHeight: 18 },
  retryBtn: {
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 5, borderWidth: 1,
    borderColor: T.orange + "50", backgroundColor: T.orange + "15",
  },
  retryText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.orange },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  linkBtn: { paddingVertical: 6, justifyContent: "center" },
  freeText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.text, textDecorationLine: "underline" },
  restoreText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textDecorationLine: "underline" },
  disclaimer: { fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center" },
  legalSection: { gap: 10, alignItems: "center" },
  legalNote: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center", lineHeight: 15 },
  legalLinks: { flexDirection: "row", alignItems: "center", gap: 8 },
  legalLink: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textMuted, textDecorationLine: "underline" },
  legalSep: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim },
});

const confirmStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  sheet: { backgroundColor: T.card, borderRadius: 10, borderWidth: 1, borderColor: T.border, padding: 24, gap: 12, width: "100%" },
  iconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: T.greenDim, alignSelf: "center", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: T.white, textAlign: "center" },
  body: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 20 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 7, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  confirmBtn: { flex: 2, borderRadius: 7, overflow: "hidden" },
  confirmGrad: { paddingVertical: 13, alignItems: "center", justifyContent: "center" },
  confirmText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
});
