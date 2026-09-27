import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BASECAMP } from "@/constants/tokens";
import type { RouteDrawMapProps } from "./RouteDrawMap";

export type { RouteDrawMapProps } from "./RouteDrawMap";

/**
 * Drawing needs a real map surface and a finger. The state machine underneath is
 * platform-free and fully tested on web, so this says what it is rather than
 * pretending to be a map.
 */
export function RouteDrawMap({ drawing }: RouteDrawMapProps) {
  return (
    <View style={s.container}>
      <Text style={s.title}>Route drawing is a phone feature</Text>
      <Text style={s.body}>
        Open SummitReady on your phone to plan a route on the map.
      </Text>
      <Text style={s.state}>
        {drawing.points.length} point{drawing.points.length === 1 ? "" : "s"} ·{" "}
        {(drawing.lengthM / 1000).toFixed(2)} km
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: BASECAMP.gutter,
    backgroundColor: BASECAMP.ink,
  },
  title: { color: BASECAMP.text, fontSize: 16, fontWeight: "700", marginBottom: 8 },
  body: { color: BASECAMP.textDim, fontSize: 13, textAlign: "center", lineHeight: 19 },
  state: { color: BASECAMP.textDim, fontSize: 12, marginTop: 14 },
});
