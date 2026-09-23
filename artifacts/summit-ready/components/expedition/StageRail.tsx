/**
 * The stage rail: every stage of the expedition at a glance.
 *
 * Stages are REAL local hills and routes, not generic training phases, so
 * each one is labelled with the hill it actually is. Status comes from the
 * selected presentation state; this draws it and nothing more.
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BASECAMP, EXPLORE, HIT } from "@/constants/tokens";
import { StageDot } from "./parts";
import type { ExpeditionPresentationStage } from "@/utils/expeditionProgress";

export function StageRail({
  stages, onSelect,
}: {
  stages: readonly ExpeditionPresentationStage[];
  onSelect?: (stage: ExpeditionPresentationStage) => void;
}) {
  if (stages.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      accessibilityLabel={`${stages.length} stages`}
    >
      {stages.map((stage, i) => (
        <Pressable
          key={`${stage.routeIdentityKey || stage.name}-${stage.index}`}
          onPress={onSelect ? () => onSelect(stage) : undefined}
          disabled={!onSelect}
          accessibilityRole="button"
          accessibilityLabel={`Stage ${i + 1}, ${stage.name}, ${stage.status}`}
          hitSlop={HIT.slop}
          style={styles.item}
        >
          <View style={styles.dotRow}>
            {i > 0 ? (
              <View
                style={[
                  styles.connector,
                  { backgroundColor: i <= stages.filter(s => s.status === "completed").length
                      ? EXPLORE.accent : "rgba(255,255,255,0.15)" },
                ]}
              />
            ) : null}
            <StageDot status={stage.status} label={String(i + 1)} />
          </View>
          <Text
            style={[styles.label, stage.status === "locked" && { color: BASECAMP.textDim }]}
            numberOfLines={2}
          >
            {stage.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { paddingHorizontal: BASECAMP.gutter, gap: 2 },
  item: { width: 56, alignItems: "center", gap: 6 },
  dotRow: { width: "100%", alignItems: "center", justifyContent: "center" },
  connector: { position: "absolute", right: "50%", marginRight: 14, width: 26, height: 1 },
  label: {
    fontSize: 8.5, lineHeight: 10.5, textAlign: "center",
    fontFamily: "Inter_400Regular", color: BASECAMP.textStrong,
  },
});
