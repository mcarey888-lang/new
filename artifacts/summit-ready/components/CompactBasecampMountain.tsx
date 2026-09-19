import React, { useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, Dimensions, Text } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import MountainProgress from "@/components/MountainProgress";
import { T } from "@/constants/theme";
import type { ExpeditionPresentationState } from "@/utils/expeditionProgress";

interface Props {
  presentation: ExpeditionPresentationState;
  mountainImageRef?: React.RefObject<View | null>;
  replayTrigger?: number;
}

export function CompactBasecampMountain({ presentation, mountainImageRef, replayTrigger }: Props) {
  const { progress, stages } = presentation;

  // Transform canonical stages into MountainProgress expected format
  const mpStages = useMemo(() => {
    return stages.map(stage => {
      let status: "completed" | "active" | "upcoming" = "upcoming";
      if (stage.status === "completed") status = "completed";
      else if (stage.status === "current") status = "active";

      return {
        name: stage.name,
        elevationGain: stage.simulatedElevationGainM,
        status,
      };
    });
  }, [stages]);

  const height = Math.min(Math.max(Dimensions.get("window").height * 0.32, 240), 320);
  const reducedMotion = useReducedMotion();

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => router.push("/(expedition)/progress")}
      accessibilityRole="button"
      accessibilityLabel="View full expedition progress"
      style={styles.container}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>SIMULATED PROGRESS</Text>
          <Text style={styles.title}>
            {Math.round(progress.currentSimulatedElevationM).toLocaleString()}m / {Math.round(progress.targetSimulatedElevationM).toLocaleString()}m ({Math.round(progress.simulatedPercent * 100)}%)
          </Text>
        </View>
        <View style={styles.viewProgressBtn}>
          <Text style={styles.viewProgressText}>View</Text>
          <ChevronRight size={14} color={T.blue} />
        </View>
      </View>

      <View ref={mountainImageRef} collapsable={false} style={{ height }}>
        {reducedMotion ? (
          <View style={styles.fallbackContainer} accessibilityLabel={`Expedition progress: ${Math.round(progress.simulatedPercent * 100)}%`}>
            <View style={styles.fallbackBar}>
              <View style={[styles.fallbackFill, { width: `${Math.max(0, Math.min(100, progress.simulatedPercent * 100))}%` }]} />
            </View>
            <View style={styles.fallbackStages}>
              {mpStages.map((s, i) => (
                <Text key={i} style={[
                  styles.fallbackStageText,
                  s.status === "completed" && { color: T.green },
                  s.status === "active" && { color: T.blue, fontFamily: "Inter_700Bold" }
                ]}>
                  {s.status === "completed" ? "✓ " : ""}{s.name}
                </Text>
              ))}
            </View>
          </View>
        ) : (
          <MountainProgress
            targetElevationGain={progress.targetSimulatedElevationM}
            currentElevationGain={progress.currentSimulatedElevationM}
            stages={mpStages}
            style={styles.mountain}
            replayTrigger={replayTrigger}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "#080F20",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  viewProgressBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(74,159,245,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 2,
  },
  viewProgressText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: T.blue,
  },
  mountain: {
    flex: 1,
    borderRadius: 0,
  },
  fallbackContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  fallbackBar: {
    height: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 20,
  },
  fallbackFill: {
    height: "100%",
    backgroundColor: T.green,
  },
  fallbackStages: {
    gap: 8,
  },
  fallbackStageText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
  },
});
