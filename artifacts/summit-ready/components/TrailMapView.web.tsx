import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { T } from "@/constants/theme";
import type { Trail } from "@/constants/trailData";

export type MappedTrail = Trail & { lat: number; lng: number };

export interface TrailMapViewProps {
  trails: MappedTrail[];
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null;
  onPressTrail: (trail: MappedTrail) => void;
}

export function TrailMapView(_props: TrailMapViewProps) {
  return (
    <View style={s.container}>
      <Text style={s.emoji}>🗺️</Text>
      <Text style={s.title}>Map view on mobile</Text>
      <Text style={s.body}>
        Open SummitReady on your phone to explore trails on an interactive map.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emoji: { fontSize: 48 },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: T.text,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
});
