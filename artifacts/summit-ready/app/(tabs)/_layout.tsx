import React, { useEffect } from "react";
import { Alert } from "react-native";
import { Tabs, useSegments } from "expo-router";
import { useApp } from "@/context/AppContext";
import { ModeTogglePill } from "@/components/ModeTogglePill";
import { SharedTabBar } from "@/components/SharedTabBar";

export default function TabLayout() {
  const {
    scoreStagnation,
    clearScoreStagnation,
    isLoading,
    shellMode,
    setShellMode,
  } = useApp();
  const segments = useSegments();
  const currentRoute = segments[segments.length - 1] || "";

  // If the user arrives here via deep link but is in expedition mode,
  // we sync the state to training rather than aggressively redirecting away,
  // honoring "switching mode must not corrupt state or silently reset progress"
  // and "preserve deep links/back behavior". We only do this for mode-specific routes.
  useEffect(() => {
    if (isLoading || shellMode === "training") return;
    const isModeSpecific = ["dashboard", "plan", "trails", "hills", "account"].includes(currentRoute);
    if (isModeSpecific) {
      setShellMode("training").catch(() => {});
    }
  }, [isLoading, shellMode, setShellMode, currentRoute]);

  // Show "why didn't my score improve?" popup whenever a session or hike
  // is logged and the readiness score stays the same or drops.
  useEffect(() => {
    if (!scoreStagnation) return;
    Alert.alert(
      scoreStagnation.title,
      `${scoreStagnation.body}\n\n💡 ${scoreStagnation.tip}`,
      [{ text: "Got it", onPress: clearScoreStagnation, style: "default" }],
      { cancelable: true, onDismiss: clearScoreStagnation },
    );
  }, [scoreStagnation, clearScoreStagnation]);

  if (isLoading) return null;

  return (
    <>
      <Tabs tabBar={(props) => <SharedTabBar />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="dashboard" />
        <Tabs.Screen name="plan" />
        <Tabs.Screen name="challenges" />
        <Tabs.Screen name="trails" />
        <Tabs.Screen name="hills" />
        <Tabs.Screen name="account" />
        <Tabs.Screen name="explore" options={{ href: null }} />
        <Tabs.Screen name="log" options={{ href: null }} />
        <Tabs.Screen name="hikes" options={{ href: null }} />
        <Tabs.Screen name="virtual" options={{ href: null }} />
        <Tabs.Screen name="v-home" options={{ href: null }} />
        <Tabs.Screen name="v-mountain" options={{ href: null }} />
        <Tabs.Screen name="v-hills" options={{ href: null }} />
        <Tabs.Screen name="v-progress" options={{ href: null }} />
      </Tabs>
      {currentRoute !== "dashboard" && currentRoute !== "explore" && <ModeTogglePill />}
    </>
  );
}
