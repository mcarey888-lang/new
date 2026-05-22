import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { DEV_PROFILES, loadDevProfile } from "@/utils/devProfiles";
import { useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";

export default function DemoLoader() {
  const { p } = useLocalSearchParams<{ p: string }>();
  const { reloadApp } = useApp();
  const [status, setStatus] = useState("Loading demo data…");

  useEffect(() => {
    const profile = DEV_PROFILES.find((x) => x.id === p);
    if (!profile) {
      setStatus(`Unknown profile: ${p}`);
      return;
    }
    loadDevProfile(profile)
      .then(() => reloadApp())
      .then(() => {
        setStatus("Redirecting…");
        router.replace("/(tabs)/dashboard");
      })
      .catch((err: unknown) => {
        setStatus(`Error: ${String(err)}`);
      });
  }, [p]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: T.textMuted, fontFamily: "Inter_400Regular", fontSize: 14 }}>{status}</Text>
    </View>
  );
}
