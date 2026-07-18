import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { T } from "@/constants/theme";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { ChallengesProvider } from "@/context/ChallengesContext";
import { initializeRevenueCat, SubscriptionProvider } from "@/lib/revenuecat";
import { logAppOpen } from "@/lib/analytics";
import { clerkTokenCache } from "@/utils/clerkTokenCache";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

SplashScreen.preventAutoHideAsync();

try {
  initializeRevenueCat();
} catch (err: any) {
  Alert.alert("RevenueCat Unavailable", err?.message ?? "Unknown error");
}

// Point the API client at the production API for native builds.
// Relative paths work automatically in web/preview; this is a no-op there.
const apiDomain = process.env.EXPO_PUBLIC_DOMAIN ?? "summitready.uk";
setBaseUrl(`https://${apiDomain}`);

const queryClient = new QueryClient();

const LAST_USER_KEY = "summitready_last_user_id";

/**
 * Detects a user switch on cold start and clears all locally cached training
 * data before AppProvider mounts and reads from AsyncStorage.
 *
 * Scenario: app was force-quit while User A was signed in (doSignOut never
 * ran). User B then opens the app and signs in. Without this guard, AppProvider
 * would load User A's summit goal / sessions / plan into memory and display
 * them to User B.
 *
 * How it works:
 *  1. Blocks rendering children until the one-time async check completes.
 *  2. Reads the last stored userId; if it differs from the current Clerk
 *     userId, wipes AsyncStorage and the React Query cache.
 *  3. Stores the current userId so future launches can detect any switch.
 *
 * Must be placed inside ClerkProvider (needs useAuth) and outside AppProvider
 * (must run before AppProvider reads storage).
 */
function UserSwitchGuard({ children }: { children: React.ReactNode }) {
  const { isSignedIn, userId } = useAuth();
  const [ready, setReady] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    (async () => {
      if (isSignedIn && userId) {
        try {
          const stored = await AsyncStorage.getItem(LAST_USER_KEY);
          if (stored && stored !== userId) {
            await AsyncStorage.clear();
            queryClient.clear();
          }
          await AsyncStorage.setItem(LAST_USER_KEY, userId);
        } catch {}
      }
      setReady(true);
    })();
  // Intentional: one-time check on mount. isSignedIn/userId are already
  // resolved by ClerkLoadedOrTimeout before this component renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}

/**
 * Keeps the API client auth token in sync with the active Clerk session.
 * Must live inside ClerkProvider so useAuth() works.
 */
function AuthBridge() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      setAuthTokenGetter(() => getToken());
    } else {
      setAuthTokenGetter(null);
    }
    return () => {
      setAuthTokenGetter(null);
    };
  }, [isSignedIn, getToken]);

  return null;
}

/**
 * Renders children once Clerk's auth state is ready, OR after a 30-second
 * timeout — whichever comes first.
 *
 * Shows a branded loading screen while waiting so the user never sees a blank
 * screen. When the timeout fires we also clear the Clerk token cache so the
 * next launch starts fresh (no stale token to validate → Clerk loads in < 1 s).
 *
 * The sign-in / sign-up screens independently guard their submit buttons with
 * !isLoaded so there is no race between this timeout and the auth forms.
 */
function ClerkLoadedOrTimeout({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const [slowConnection, setSlowConnection] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      setSlowConnection(false);
      return;
    }
    // After 8 s without a connection, surface the "still connecting" label.
    const slowTimer = setTimeout(() => setSlowConnection(true), 8000);
    // After 30 s give up waiting and show the auth screens anyway.
    const hardTimer = setTimeout(async () => {
      try {
        await clerkTokenCache.clearAll();
      } catch {}
      setTimedOut(true);
    }, 30000);
    return () => {
      clearTimeout(slowTimer);
      clearTimeout(hardTimer);
    };
  }, [isLoaded]);

  if (!isLoaded && !timedOut) {
    return (
      <LinearGradient colors={T.bgGrad} style={ls.container}>
        <Image
          source={require("@/assets/images/logo.gif")}
          style={ls.logo}
          resizeMode="contain"
        />
        <ActivityIndicator color={T.green} size="large" style={ls.spinner} />
        {slowConnection && (
          <Text style={ls.slowText}>Still connecting…</Text>
        )}
      </LinearGradient>
    );
  }

  return <>{children}</>;
}

const ls = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: { width: 220, height: 88 },
  spinner: { marginTop: 32 },
  slowText: {
    marginTop: 16,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
  },
});

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="setup" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="paywall" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="subscription" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="hill-detail" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="trail-list" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="trail-detail" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="trails-saved" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="trails-completed" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="trails-create" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="hills-finder" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="past-activity" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="hike-tracking" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="challenge-detail" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="challenge-complete" options={{ headerShown: false, presentation: "card" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [fontTimeout, setFontTimeout] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFontTimeout(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const ready = fontsLoaded || !!fontError || fontTimeout;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    if (ready) void logAppOpen();
  }, [ready]);

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={clerkTokenCache}>
      <AuthBridge />
      <ClerkLoadedOrTimeout>
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <SubscriptionProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <KeyboardProvider>
                    <UserSwitchGuard>
                      <AppProvider>
                        <ChallengesProvider>
                          <RootLayoutNav />
                        </ChallengesProvider>
                      </AppProvider>
                    </UserSwitchGuard>
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </SubscriptionProvider>
            </QueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </ClerkLoadedOrTimeout>
    </ClerkProvider>
  );
}
