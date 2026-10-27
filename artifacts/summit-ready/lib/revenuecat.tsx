import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { logPurchase, logTrialStarted, logSubscriptionStarted } from "@/lib/analytics";
import { onceMembershipAnalytics } from "@/lib/membershipAnalytics";
import { logAnalyticsEvent } from "@/lib/analytics";
import { loadPurchases } from "@/lib/revenuecatSdk";
import { MEMBERSHIP, accessFromEntitlements, cachedEntitlementIds, canUseExpedition, tierForPackage, type MembershipTier } from "@workspace/membership";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
const USE_TEST_STORE = process.env.EXPO_PUBLIC_REVENUECAT_USE_TEST_STORE === "true";

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "premium";

let configuredPurchasesPromise: ReturnType<typeof loadPurchases> | null = null;
let identifiedRevenueCatUserId: string | null = null;
let identityOperation: Promise<void> = Promise.resolve();

function getRevenueCatApiKey() {
  if (!REVENUECAT_TEST_API_KEY || !REVENUECAT_IOS_API_KEY || !REVENUECAT_ANDROID_API_KEY) {
    throw new Error("RevenueCat Public API Keys not found");
  }

  if (!REVENUECAT_ENTITLEMENT_IDENTIFIER) {
    throw new Error("RevenueCat Entitlement Identifier not provided");
  }

  // Use test store when:
  // - explicitly requested via EXPO_PUBLIC_REVENUECAT_USE_TEST_STORE (dev/preview EAS builds)
  // - running in Expo Go (storeClient)
  // - running in dev mode
  // - running on web
  // The test store works without any App Store / Play Store configuration.
  if (USE_TEST_STORE || __DEV__ || Platform.OS === "web" || Constants.executionEnvironment === "storeClient") {
    return REVENUECAT_TEST_API_KEY;
  }

  if (Platform.OS === "ios") return REVENUECAT_IOS_API_KEY;
  if (Platform.OS === "android") return REVENUECAT_ANDROID_API_KEY;
  return REVENUECAT_TEST_API_KEY;
}

async function getConfiguredPurchases() {
  if (!configuredPurchasesPromise) {
    const attempt = loadPurchases().then((Purchases) => {
      const apiKey = getRevenueCatApiKey();
      if (!apiKey) throw new Error("RevenueCat Public API Key not found");
      Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      Purchases.configure({ apiKey });
      return Purchases;
    });
    configuredPurchasesPromise = attempt.catch((error) => {
      configuredPurchasesPromise = null;
      throw error;
    });
  }
  return configuredPurchasesPromise;
}

export async function initializeRevenueCat(): Promise<void> {
  await getConfiguredPurchases();
}

async function identifyRevenueCatUser(userId: string): Promise<void> {
  if (identifiedRevenueCatUserId === userId) return;
  identityOperation = identityOperation.catch(() => {}).then(async () => {
    if (identifiedRevenueCatUserId === userId) return;
    const Purchases = await getConfiguredPurchases();
    await Purchases.logIn(userId);
    identifiedRevenueCatUserId = userId;
  });
  return identityOperation;
}

export async function logoutRevenueCat(): Promise<void> {
  identityOperation = identityOperation.catch(() => {}).then(async () => {
    if (!configuredPurchasesPromise || !identifiedRevenueCatUserId) return;
    const Purchases = await configuredPurchasesPromise;
    await Purchases.logOut();
    identifiedRevenueCatUserId = null;
  });
  return identityOperation;
}

async function getPurchasesForUser(userId: string | null | undefined) {
  if (!userId) throw new Error("Authentication required for subscription access");
  const Purchases = await getConfiguredPurchases();
  await identifyRevenueCatUser(userId);
  return Purchases;
}

function useSubscriptionContext() {
  const [accessClock, setAccessClock] = useState(Date.now);
  useEffect(() => {
    const interval = setInterval(() => setAccessClock(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);
  const queryClient = useQueryClient();
  const { isLoaded: authLoaded, userId } = useAuth();
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<Error | null>(null);
  const revenueCatUserKey = userId ?? "anonymous";
  const customerInfoKey = ["revenuecat", "customer-info", revenueCatUserKey] as const;
  const offeringsKey = ["revenuecat", "offerings", revenueCatUserKey] as const;

  useEffect(() => {
    if (!authLoaded) return;
    let active = true;
    setSdkReady(false);
    setSdkError(null);
    const timer = setTimeout(() => {
      // Offerings are public store metadata. Load them for guests too, but
      // never purchase, restore or grant an entitlement without a Clerk owner.
      void (userId ? getPurchasesForUser(userId) : getConfiguredPurchases())
        .then(() => {
          if (active) setSdkReady(true);
        })
        .catch((error) => {
          if (!active) return;
          const normalized = error instanceof Error ? error : new Error(String(error));
          console.error(
            "[revenuecat-init]",
            normalized.message,
            normalized.stack ?? "Stack trace unavailable",
          );
          setSdkError(normalized);
        });
    }, 750);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [authLoaded, userId]);

  const customerInfoQuery = useQuery({
    queryKey: customerInfoKey,
    queryFn: async () => {
      const Purchases = await getPurchasesForUser(userId);
      const info = await Purchases.getCustomerInfo();
      if (identifiedRevenueCatUserId !== userId) throw new Error("Subscription account changed; retry verification.");
      return info;
    },
    enabled: sdkReady && !!userId,
    staleTime: 60 * 1000,
    // Retry while open, without resetting CustomerInfo.requestDate on SDK cache
    // hits. React Query retains the last evidence when a network request fails.
    refetchInterval: 5 * 60_000,
  });

  // Keep subscription state in sync with RevenueCat SDK events.
  // This fires immediately on purchase, restore, or background sync —
  // without it, isSubscribed stays stale until the next manual refetch.
  useEffect(() => {
    if (!sdkReady || !userId) return;
    let active = true;
    let purchases: Awaited<ReturnType<typeof loadPurchases>> | null = null;
    const handler = (info: import("react-native-purchases").CustomerInfo) => {
      if (!active || identifiedRevenueCatUserId !== userId) return;
      queryClient.setQueryData(customerInfoKey, info);
    };
    void getPurchasesForUser(userId)
      .then((Purchases) => {
        if (!active) return;
        purchases = Purchases;
        Purchases.addCustomerInfoUpdateListener(handler);
      })
      .catch((error) => {
        console.error("[revenuecat-listener]", error);
      });
    return () => {
      active = false;
      purchases?.removeCustomerInfoUpdateListener(handler);
    };
  }, [queryClient, revenueCatUserKey, sdkReady, userId]);

  const offeringsQuery = useQuery({
    queryKey: offeringsKey,
    queryFn: async () => {
      const Purchases = userId
        ? await getPurchasesForUser(userId)
        : await getConfiguredPurchases();
      const offerings = await Purchases.getOfferings();
      return offerings;
    },
    enabled: sdkReady && authLoaded,
    staleTime: 300 * 1000,
  });

  const trialEligibility = useQuery({
    queryKey: ["revenuecat", "intro-eligibility", revenueCatUserKey, offeringsQuery.data?.current?.identifier],
    enabled: sdkReady && !!userId && Platform.OS === "ios" && !!offeringsQuery.data,
    queryFn: async () => {
      const Purchases = await getPurchasesForUser(userId);
      const products = Object.values(offeringsQuery.data?.all ?? {})
        .flatMap(offering => offering.availablePackages.map(pkg => pkg.product.identifier));
      const result = await Purchases.checkTrialOrIntroductoryPriceEligibility([...new Set(products)]);
      return Object.fromEntries(Object.entries(result).map(([id, value]) =>
        [id, value.status === Purchases.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE]));
    },
    staleTime: 60_000,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: any) => {
      const Purchases = await getPurchasesForUser(userId);
      const before = accessFromEntitlements(cachedEntitlementIds(customerInfoQuery.data));
      const target = tierForPackage(packageToPurchase?.identifier ?? "",
        packageToPurchase?.presentedOfferingContext?.offeringIdentifier ?? packageToPurchase?.offeringIdentifier);
      const upgrading = before.tier === "expeditions" && target === "pro";
      if (upgrading && !MEMBERSHIP.nativeUpgradesVerified)
        throw new Error("Manage your existing subscription in the store. Native replacement has not been enabled yet.");
      const oldProduct = customerInfoQuery.data?.entitlements.active[MEMBERSHIP.entitlements.expeditions]?.productIdentifier;
      if (upgrading && Platform.OS === "android" && !oldProduct) throw new Error("Restore your existing subscription before upgrading.");
      // StoreKit handles same-group changes. Play receives the old product so
      // this is a replacement, never a second independent subscription.
      const { customerInfo } = upgrading && Platform.OS === "android"
        ? await Purchases.purchasePackage(packageToPurchase, null, { oldProductIdentifier: oldProduct! })
        : await Purchases.purchasePackage(packageToPurchase);
      return { customerInfo, packageToPurchase };
    },
    onSuccess: ({ customerInfo, packageToPurchase }) => {
      const before = accessFromEntitlements(cachedEntitlementIds(customerInfoQuery.data));
      queryClient.setQueryData(customerInfoKey, customerInfo);
      void queryClient.invalidateQueries({ queryKey: ["revenuecat", "intro-eligibility", revenueCatUserKey] });
      const canonicalProduct = (value: string) => value.split(":")[0];
      const entitlement = Object.values(customerInfo.entitlements.active).find(e =>
        canonicalProduct(e.productIdentifier) === canonicalProduct(packageToPurchase?.product?.identifier ?? ""));
      if (entitlement) {
        const plan = entitlement.productIdentifier;
        const after = accessFromEntitlements(cachedEntitlementIds(customerInfo));
        void onceMembershipAnalytics(userId, "verified_purchase", `${plan}_${entitlement.latestPurchaseDate}`, async () => {
          if (entitlement.periodType === "TRIAL") await logTrialStarted({ plan });
          else {
            await logSubscriptionStarted({ plan });
            const product = packageToPurchase?.product;
            await logPurchase({
              plan,
              value: typeof product?.price === "number" ? product.price : undefined,
              currency: typeof product?.currencyCode === "string" ? product.currencyCode.toUpperCase() : undefined,
            });
          }
          await logAnalyticsEvent("subscription_purchase_verified", { tier: after.tier, plan });
          if (before.tier === "expeditions" && after.training)
            await logAnalyticsEvent("expeditions_to_pro_upgrade", { tier: "pro" });
        });
      }
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      const Purchases = await getPurchasesForUser(userId);
      return Purchases.restorePurchases();
    },
    onSuccess: (customerInfo) => {
      // Set immediately for instant UI update, then force a fresh server fetch
      // to guarantee we have the latest entitlement state.
      queryClient.setQueryData(customerInfoKey, customerInfo);
      queryClient.invalidateQueries({ queryKey: customerInfoKey });
    },
  });

  const access = accessFromEntitlements(cachedEntitlementIds(customerInfoQuery.data, accessClock));
  // Legacy callers mean training access, not "any paid tier".
  const isSubscribed = access.training;
  const packagesForTier = (tier: Exclude<MembershipTier, "explore">) => {
    const all = offeringsQuery.data?.all;
    const offering = tier === "expeditions"
      ? all?.[MEMBERSHIP.offerings.expeditions]
      : all?.[MEMBERSHIP.offerings.pro] ?? all?.[MEMBERSHIP.offerings.legacy];
    return { monthly: offering?.monthly ?? null, annual: offering?.annual ?? null };
  };
  const trialDaysForPackage = (pkg: any): number | null => {
    if (tierForPackage(pkg?.identifier ?? "", pkg?.presentedOfferingContext?.offeringIdentifier ?? pkg?.offeringIdentifier) !== "pro") return null;
    const product = pkg?.product;
    if (Platform.OS === "ios" && trialEligibility.data?.[product?.identifier] === true) {
      const intro = product?.introPrice;
      if (intro?.price !== 0 || intro?.cycles !== 1) return null;
      const days = intro.periodUnit === "DAY" ? intro.periodNumberOfUnits
        : intro.periodUnit === "WEEK" ? intro.periodNumberOfUnits * 7 : null;
      return days === 14 ? 14 : null;
    }
    // Play returns eligible subscription options; defaultOption is the option
    // RevenueCat will purchase, not an arbitrary advertised offer.
    if (Platform.OS === "android") {
      const phase = product?.defaultOption?.freePhase;
      return phase?.billingPeriod?.iso8601 === "P2W" || phase?.billingPeriod?.iso8601 === "P14D" ? 14 : null;
    }
    return null;
  };
  const sdkPending = !!userId && !sdkReady && !sdkError;

  return {
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    isSubscribed,
    access,
    canAccessExpedition: (id: string | null | undefined) => canUseExpedition(access, id),
    packagesForTier,
    trialDaysForPackage,
    isLoading: sdkPending || customerInfoQuery.isLoading || offeringsQuery.isLoading,
    isError: !!sdkError || customerInfoQuery.isError,
    offeringsLoading: sdkPending || offeringsQuery.isLoading,
    offeringsError: !!sdkError || offeringsQuery.isError,
    refetchOfferings: offeringsQuery.refetch,
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    refetchCustomerInfo: customerInfoQuery.refetch,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return ctx;
}
