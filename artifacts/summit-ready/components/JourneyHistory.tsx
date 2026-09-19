import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Check, MapPin, Circle } from "lucide-react-native";
import { T } from "@/constants/theme";
import type { ExpeditionPresentationState } from "@/utils/expeditionProgress";
import { englishPlaceName } from "@/utils/placeNames";

export function JourneyHistory({ presentation }: { presentation: ExpeditionPresentationState }) {
  const { stages } = presentation;

  if (stages.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>JOURNEY HISTORY</Text>
      <View style={styles.list}>
        {stages.map((stage, i) => {
          const isLast = i === stages.length - 1;
          const isCompleted = stage.status === "completed";
          const isCurrent = stage.status === "current";

          return (
            <View key={stage.index} style={styles.item}>
              <View style={styles.timeline}>
                <View style={[
                  styles.dot,
                  isCompleted && styles.dotCompleted,
                  isCurrent && styles.dotCurrent
                ]}>
                  {isCompleted ? (
                    <Check size={10} color="#fff" />
                  ) : isCurrent ? (
                    <MapPin size={10} color={T.blue} />
                  ) : (
                    <Circle size={8} color="rgba(255,255,255,0.3)" />
                  )}
                </View>
                {!isLast && (
                  <View style={[
                    styles.line,
                    isCompleted && styles.lineCompleted
                  ]} />
                )}
              </View>
              <View style={styles.content}>
                <Text style={[
                  styles.name,
                  isCompleted && styles.nameCompleted,
                  isCurrent && styles.nameCurrent
                ]}>
                  {englishPlaceName(stage.name)}
                </Text>
                <Text style={styles.meta}>
                  Stage {i + 1} • {stage.simulatedElevationGainM}m gain
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 14,
    marginTop: 14,
    backgroundColor: "#080F20",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 16,
  },
  header: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  list: {
    paddingLeft: 4,
  },
  item: {
    flexDirection: "row",
    minHeight: 48,
  },
  timeline: {
    width: 24,
    alignItems: "center",
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  dotCompleted: {
    backgroundColor: T.green,
    borderColor: T.green,
  },
  dotCurrent: {
    backgroundColor: "rgba(74,159,245,0.15)",
    borderColor: T.blue,
  },
  line: {
    position: "absolute",
    top: 20,
    bottom: -4,
    width: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    zIndex: 1,
  },
  lineCompleted: {
    backgroundColor: T.green,
  },
  content: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
  },
  name: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.5)",
    marginBottom: 2,
  },
  nameCompleted: {
    color: "rgba(255,255,255,0.9)",
  },
  nameCurrent: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
  meta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
  }
});
