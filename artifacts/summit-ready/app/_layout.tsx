import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { ChallengesProvider } from "@/context/ChallengesContext";
import { initializeRevenueCat, SubscriptionProvider } from "@/lib/revenuecat";
import { clerkTokenCache } from "@/app/utils/clerkTokenCache";

SplashScreen.preventAutoHideAsync();

try {
  initializeRevenueCat();
} catch (err: any) {
  Alert.alert("RevenueCat Unavailable", err?.message ?? "Unknown error");
}

const queryClient = new QueryClient();

/**
 * Renders children once Clerk's auth state is ready, OR after a 4-second
 * timeout — whichever comes first.
 *
 * On timeout (isLoaded still false after 4 s), it means Clerk is stuck trying
 * to refresh a stale/expired session token. We clear the token cache and call
 * onTimeout(), which remounts <ClerkProvider> with a fresh key so Clerk
 * reinitialises from scratch. The second init has no cached token to validate,
 * so isLoaded becomes true within milliseconds.
 *
 * If the second attempt also times out (very unlikely — no token means no
 * network round-trip needed) we fall back to rendering children anyway so the
 * user is never stuck on a blank screen.
 */
function ClerkLoadedOrTimeout({
  children,
  onTimeout,
}: {
  children: React.ReactNode;
  onTimeout: () => void;
}) {
  const { isLoaded } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (isLoaded) return;
    const t = setTimeout(() => {
      // Notify parent to clear token + remount ClerkProvider.
      // Also set timedOut locally as a fallback so children render even if
      // the remount somehow also fails (prevents an infinite blank screen).
      onTimeoutRef.current();
      setTimedOut(true);
    }, 4000);
    return () => clearTimeout(t);
  }, [isLoaded]);

  if (!isLoaded && !timedOut) return null;
  return <>{children}</>;
}

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
  // Incremented to remount ClerkProvider and start a fresh Clerk init
  const [clerkKey, setClerkKey] = useState(0);
  const hasRemounted = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setFontTimeout(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const ready = fontsLoaded || !!fontError || fontTimeout;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  const handleClerkTimeout = useCallback(() => {
    // Only remount once — if the second attempt also times out we let the
    // fallback timedOut state in ClerkLoadedOrTimeout render children.
    if (hasRemounted.current) return;
    hasRemounted.current = true;
    // Clear stale token so the remounted ClerkProvider starts with no cache.
    void clerkTokenCache.clearAll();
    setClerkKey((k) => k + 1);
  }, []);

  return (
    <ClerkProvider key={clerkKey} publishableKey={publishableKey} tokenCache={clerkTokenCache}>
      <ClerkLoadedOrTimeout onTimeout={handleClerkTimeout}>
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <SubscriptionProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <KeyboardProvider>
                    <AppProvider>
                      <ChallengesProvider>
                        <RootLayoutNav />
                      </ChallengesProvider>
                    </AppProvider>
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
