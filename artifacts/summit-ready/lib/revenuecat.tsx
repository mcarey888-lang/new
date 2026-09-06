import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { logPurchase, logTrialStarted, logSubscriptionStarted } from "@/lib/analytics";
import { loadPurchases } from "@/lib/revenuecatSdk";

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
    if (!userId) {
      return () => {
        active = false;
      };
    }
    const timer = setTimeout(() => {
      void getPurchasesForUser(userId)
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
      return info;
    },
    enabled: sdkReady && !!userId,
    staleTime: 60 * 1000,
  });

  // Keep subscription state in sync with RevenueCat SDK events.
  // This fires immediately on purchase, restore, or background sync —
  // without it, isSubscribed stays stale until the next manual refetch.
  useEffect(() => {
    if (!sdkReady || !userId) return;
    let active = true;
    let purchases: Awaited<ReturnType<typeof loadPurchases>> | null = null;
    const handler = (info: import("react-native-purchases").CustomerInfo) => {
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
      const Purchases = await getPurchasesForUser(userId);
      const offerings = await Purchases.getOfferings();
      return offerings;
    },
    enabled: sdkReady && !!userId,
    staleTime: 300 * 1000,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: any) => {
      const Purchases = await getPurchasesForUser(userId);
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      return { customerInfo, packageToPurchase };
    },
    onSuccess: ({ customerInfo, packageToPurchase }) => {
      queryClient.setQueryData(customerInfoKey, customerInfo);
      const entitlement = customerInfo.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];
      if (entitlement) {
        const plan = entitlement.productIdentifier;
        if (entitlement.periodType === "TRIAL" || entitlement.periodType === "INTRO") {
          void logTrialStarted({ plan });
        } else {
          void logSubscriptionStarted({ plan });
          const product = packageToPurchase?.product;
          void logPurchase({
            plan,
            value: typeof product?.price === "number" ? product.price : undefined,
            currency: typeof product?.currencyCode === "string"
              ? product.currencyCode.toUpperCase()
              : undefined,
          });
        }
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

  const isSubscribed =
    customerInfoQuery.data?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;
  const sdkPending = !!userId && !sdkReady && !sdkError;

  return {
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    isSubscribed,
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
