import React from "react";
import { Alert, Linking, Text, View } from "react-native";
import { T } from "@/constants/theme";

export function HillSourceAttribution() {
  const open = (url: string) => { void Linking.openURL(url).catch(() => Alert.alert("Couldn't open link", url)); };
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return (
    <View style={{ gap: 5, paddingVertical: 10 }}>
      <Text accessibilityRole="link" onPress={() => open("https://www.openstreetmap.org/copyright")}
        style={{ fontSize: 11, color: T.textMuted }}>
        Includes hill data © OpenStreetMap contributors · ODbL
      </Text>
      <Text style={{ fontSize: 11, color: T.textMuted }}>
        Terrain-estimated ascent is not a verified walking route or confirmation of access.
      </Text>
      {domain && <Text accessibilityRole="link" onPress={() => open(`https://${domain}/api/local-hills/source`)}
        style={{ fontSize: 11, color: T.blue }}>Download UK hill source data</Text>}
    </View>
  );
}
