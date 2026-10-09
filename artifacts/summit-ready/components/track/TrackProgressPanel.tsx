import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import MountainProgress from "@/components/MountainProgress";
import { T } from "@/constants/theme";
import type { SavedExpedition } from "@/context/AppContext";
import { selectExpeditionPresentation } from "@/utils/expeditionProgress";
import { liveProgress, liveProgressCaption } from "@/utils/liveProgress";

/**
 * The expedition's mountain, while a hike is being recorded.
 *
 * The existing artwork, the existing fill and the existing stage markers —
 * MountainProgress, fed by the same selectExpeditionPresentation the rest of
 * the app uses. Nothing is recalculated here and no second mountain is drawn;
 * the only thing added is the ascent recorded so far, so the fill moves while
 * you climb rather than jumping once you finish.
 */

interface Props {
  expedition: SavedExpedition | null | undefined;
  /** Ascent recorded in this hike so far, in metres. */
  recordedGainM: number;
}

export function TrackProgressPanel({ expedition, recordedGainM }: Props) {
  const presentation = useMemo(
    () => selectExpeditionPresentation(expedition),
    [expedition],
  );

  const stages = useMemo(
    () => presentation.stages.map(stage => ({
      name: stage.name,
      elevationGain: stage.simulatedElevationGainM,
      status: stage.status === "completed" ? "completed" as const
        : stage.status === "current" ? "active" as const
        : "upcoming" as const,
    })),
    [presentation.stages],
  );

  const progress = liveProgress(presentation.progress, recordedGainM);
  const caption = liveProgressCaption(progress);
  const currentStage = presentation.stages.find(stage => stage.status === "current");

  if (presentation.availability !== "ready" || !stages.length) {
    /* Said plainly rather than drawn as an empty mountain, which reads as a
       expedition with no progress rather than one that could not be read. */
    return (
      <View style={st.empty}>
        <Text style={st.emptyText}>Expedition progress is unavailable right now.</Text>
      </View>
    );
  }

  return (
    <View style={st.wrap}>
      <MountainProgress
        targetElevationGain={progress.targetM}
        currentElevationGain={progress.shownM}
        stages={stages}
        style={st.mountain}
      />
      <View style={st.readout}>
        {currentStage ? (
          <Text style={st.stage} numberOfLines={1}>{currentStage.name}</Text>
        ) : null}
        {caption ? <Text style={st.caption}>{caption}</Text> : null}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { gap: 8 },
  mountain: { width: "100%" },
  readout: { gap: 2, paddingHorizontal: 2 },
  stage: { color: T.text, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  caption: { color: T.textMuted, fontSize: 12, fontFamily: "Inter_400Regular" },
  empty: { paddingVertical: 28, alignItems: "center" },
  emptyText: { color: T.textMuted, fontSize: 13, fontFamily: "Inter_400Regular" },
});
