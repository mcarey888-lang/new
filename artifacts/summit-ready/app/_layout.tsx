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
import React, { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Image, Platform, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { T } from "@/constants/theme";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RootErrorFallback } from "@/components/RootErrorFallback";
import { AppProvider } from "@/context/AppContext";
import { ChallengesProvider } from "@/context/ChallengesContext";
import { Stage8Provider } from "@/context/Stage8Context";
import { SubscriptionProvider } from "@/lib/revenuecat";
import { logAppOpen, logFirstOpenForReddit } from "@/lib/analytics";
import { clerkTokenCache } from "@/utils/clerkTokenCache";
import { installGlobalErrorHandler } from "@/utils/globalErrorHandler";
import { retrySyncOutbox } from "@/utils/syncOutbox";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

installGlobalErrorHandler();
SplashScreen.preventAutoHideAsync();

// Point the API client at the production API for native builds.
// Relative paths work automatically in web/preview; this is a no-op there.
const apiDomain = process.env.EXPO_PUBLIC_DOMAIN ?? "summitready.uk";
setBaseUrl(`https://${apiDomain}`);

const queryClient = new QueryClient();

/**
 * Per-user AsyncStorage namespacing makes user-switch data isolation
 * automatic, so no blocking pre-check is needed here.
 */
function UserSwitchGuard({ children }: { children: React.ReactNode }) {
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

function SyncOutboxBridge() {
  const { getToken, isLoaded, userId } = useAuth();

  useEffect(() => {
    if (!isLoaded || !userId) return;
    const retry = () => { void retrySyncOutbox(userId, getToken); };
    retry();
    const interval = setInterval(retry, 30_000);
    const appState = AppState.addEventListener("change", state => {
      if (state === "active") retry();
    });
    return () => {
      clearInterval(interval);
      appState.remove();
    };
  }, [getToken, isLoaded, userId]);

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

/**
 * Non-essential analytics startup is deferred until the app's provider tree
 * has rendered. Native SDKs must never block auth restoration or initial
 * routing.
 */
function NativeServicesGate({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      void logAppOpen();
      void logFirstOpenForReddit();
    }, 750);
    return () => clearTimeout(timer);
  }, []);

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
      <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="setup" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="(tabs)"       options={{ headerShown: false }} />
      <Stack.Screen name="(expedition)" options={{ headerShown: false }} />
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
      <Stack.Screen name="elevation-history" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="hike-tracking" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="challenge-detail" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="challenge-complete" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="mountain-demo" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="onboarding-demo" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="mobile/onboarding-demo" options={{ headerShown: false, presentation: "card" }} />
    </Stack>
  );
}

function RootApp() {
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

  const rawWebPath =
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.location.pathname
      : "";
  const canonicalWebPath = rawWebPath.replace(/^\/mobile(?=\/|$)/, "");
  const isIsolatedOnboardingDemo =
    canonicalWebPath === "/onboarding-demo" ||
    canonicalWebPath.startsWith("/onboarding-demo/");

  if (isIsolatedOnboardingDemo) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <RootLayoutNav />
          </KeyboardProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={clerkTokenCache}>
      <AuthBridge />
      <SyncOutboxBridge />
      <ClerkLoadedOrTimeout>
        <NativeServicesGate>
          <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
              <SubscriptionProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <KeyboardProvider>
                    <UserSwitchGuard>
                      <AppProvider>
                        <ChallengesProvider>
                          <Stage8Provider>
                            <RootLayoutNav />
                          </Stage8Provider>
                        </ChallengesProvider>
                      </AppProvider>
                    </UserSwitchGuard>
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </SubscriptionProvider>
            </QueryClientProvider>
          </SafeAreaProvider>
        </NativeServicesGate>
      </ClerkLoadedOrTimeout>
    </ClerkProvider>
  );
}

function logRootRenderError(error: Error, componentStack: string): void {
  console.error(
    "[root-error-boundary]",
    error.message,
    error.stack ?? "JavaScript stack unavailable",
    componentStack || "React component stack unavailable",
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary
      FallbackComponent={RootErrorFallback}
      onError={logRootRenderError}
    >
      <RootApp />
    </ErrorBoundary>
  );
}
