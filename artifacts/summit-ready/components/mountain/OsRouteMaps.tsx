import React from "react";
import { Text } from "react-native";
import type { RoutePoint } from "@/utils/offRoute";
import { T } from "@/constants/theme";
export function OsRouteMaps(_props: { points: readonly RoutePoint[] }) {
  return <Text style={{ color: T.textMuted, fontSize: 12, marginTop: 12 }}>
    Offline OS map downloads require the native app and remain disabled pending device verification.
  </Text>;
}