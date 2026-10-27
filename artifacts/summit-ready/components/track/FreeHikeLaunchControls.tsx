import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ChevronUp, Play } from "lucide-react-native";
import { T } from "@/constants/theme";

/** The ready screen stays map-first; recording controls belong to the recorder. */
export function FreeHikeLaunchControls({
  bottomInset, gpsReady, offline, disabled, onOptions, onStart,
}: {
  bottomInset: number;
  gpsReady: boolean;
  offline: boolean;
  disabled: boolean;
  onOptions: () => void;
  onStart: () => void;
}) {
  return (
    <View pointerEvents="box-none" style={[styles.controls, { bottom: bottomInset + 48 }]}
      testID="free-hike-launch-controls">
      <TouchableOpacity style={styles.gps} onPress={onOptions} activeOpacity={0.8}
        accessibilityRole="button" accessibilityLabel="Hike options">
        <View style={[styles.dot, { backgroundColor: gpsReady ? T.green : T.orange }]} />
        <Text style={styles.gpsText}>
          {gpsReady ? "GPS ready" : "Finding GPS"}{offline ? " · Offline" : ""}
        </Text>
        <ChevronUp size={14} color={T.textMuted} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.start, disabled && styles.disabled]} onPress={onStart}
        disabled={disabled} activeOpacity={0.85} accessibilityRole="button"
        accessibilityLabel="Start tracking" testID="start-hike-tracking">
        <Play size={21} color="#03190d" fill="#03190d" />
        <Text style={styles.startText}>Start hike</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { position: "absolute", left: 24, right: 24, zIndex: 3, gap: 8 },
  gps: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7,
    minHeight: 44, paddingHorizontal: 12, borderRadius: 22, backgroundColor: "#10201eef",
  },
  dot: { height: 8, width: 8, borderRadius: 4 },
  gpsText: { color: T.text, fontSize: 12, fontFamily: "Inter_500Medium" },
  start: {
    minHeight: 56, borderRadius: 30, flexDirection: "row", justifyContent: "center",
    alignItems: "center", gap: 9, backgroundColor: T.green,
  },
  startText: { color: "#03190d", fontSize: 17, fontFamily: "Inter_700Bold" },
  disabled: { opacity: 0.45 },
});
