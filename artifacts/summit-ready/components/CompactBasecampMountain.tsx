/**
 * Basecamp's compact view of the expedition Progress Mountain.
 *
 * ⚠ The mountain itself is PROTECTED. `MountainProgress` and its summit
 * behaviour are unchanged — this file only supplies the surface around it,
 * so the premium shell integrates the existing production component rather
 * than replacing it.
 *
 * The reduced-motion path is not a lesser version: it states the same
 * progress and the same stage statuses without animating anything.
 */
import React, { useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, Dimensions, Text } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import MountainProgress from "@/components/MountainProgress";
import { T } from "@/constants/theme";
import { BASECAMP, EXPLORE, SP, TYPE } from "@/constants/tokens";
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
        <View style={styles.headerText}>
          {/* Simulated, and labelled as such. This is what the expedition
              credits towards the objective, not an altitude you stood at. */}
          <Text style={styles.label}>SIMULATED PROGRESS</Text>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {`${Math.round(progress.currentSimulatedElevationM).toLocaleString()} m / ${Math.round(progress.targetSimulatedElevationM).toLocaleString()} m`}
          </Text>
        </View>
        <View style={styles.viewProgressBtn}>
          <Text style={styles.viewProgressText}>
            {`${Math.round(progress.simulatedPercent * 100)}%`}
          </Text>
          <ChevronRight size={13} color={EXPLORE.accent} />
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
    marginHorizontal: BASECAMP.gutter,
    borderRadius: 18,
    backgroundColor: BASECAMP.ink,
    borderWidth: 1,
    borderColor: BASECAMP.panelBorder,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SP.sm,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 11,
    borderBottomWidth: 1,
    borderBottomColor: BASECAMP.hairline,
  },
  headerText: { flex: 1, minWidth: 0 },
  label: {
    ...TYPE.eyebrow,
    fontSize: 9.5,
    color: BASECAMP.textDim,
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    lineHeight: 21,
    fontFamily: "Inter_700Bold",
    color: BASECAMP.text,
  },
  viewProgressBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: EXPLORE.accentDim,
    borderWidth: 1,
    borderColor: EXPLORE.accentLine,
    paddingHorizontal: 10,
    minHeight: 30,
    borderRadius: 999,
    gap: 3,
    flexShrink: 0,
  },
  viewProgressText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: EXPLORE.accent,
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
    backgroundColor: EXPLORE.accent,
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
