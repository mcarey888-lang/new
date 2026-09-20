/**
 * Expedition shell — separate route group for the virtual-expedition experience.
 * It uses the same SharedTabBar as (tabs) to provide a unified app shell visually.
 */

import React, { useEffect } from "react";
import { Tabs, useSegments } from "expo-router";
import { useApp } from "@/context/AppContext";
import { ModeTogglePill } from "@/components/ModeTogglePill";
import { SharedTabBar } from "@/components/SharedTabBar";

export default function ExpeditionLayout() {
  const { isLoading, activeExpeditionId, shellMode, setShellMode } = useApp();
  const segments = useSegments();
  const currentRoute = segments[segments.length - 1] || "";

  // If deep-linked here while in training mode, sync state to expedition
  // rather than bouncing the user back, BUT only if it's a mode-specific route.
  useEffect(() => {
    if (isLoading || shellMode === "expedition") return;
    const isModeSpecific = ["base-camp", "mountains", "track", "route", "progress", "profile", "account", "expedition-complete"].includes(currentRoute);
    if (isModeSpecific) {
      setShellMode("expedition").catch(() => {});
    }
  }, [isLoading, shellMode, setShellMode, currentRoute]);

  if (isLoading) return null;

  return (
    <>
      <Tabs
        initialRouteName={activeExpeditionId ? "base-camp" : "mountains"}
        tabBar={(props) => <SharedTabBar />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="base-camp" options={{ href: activeExpeditionId ? undefined : null }} />
        <Tabs.Screen name="mountains" />
        <Tabs.Screen name="track" />
        <Tabs.Screen name="route" />
        <Tabs.Screen name="progress" />
        <Tabs.Screen name="profile" />

        {/* Hidden from tab bar — navigated to programmatically */}
        <Tabs.Screen name="expedition-complete" options={{ href: null }} />
        <Tabs.Screen name="account" options={{ href: null }} />
      </Tabs>

      {/* Persistent shell toggle — sits in the safe-area zone above all tabs */}
      <ModeTogglePill />
    </>
  );
}
