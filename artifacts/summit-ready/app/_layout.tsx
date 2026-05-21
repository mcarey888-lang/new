import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { ChallengesProvider } from "@/context/ChallengesContext";
import { initializeRevenueCat, SubscriptionProvider } from "@/lib/revenuecat";

SplashScreen.preventAutoHideAsync();

try {
  initializeRevenueCat();
} catch (err: any) {
  Alert.alert("RevenueCat Unavailable", err?.message ?? "Unknown error");
}

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
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
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  return (
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
  );
}
