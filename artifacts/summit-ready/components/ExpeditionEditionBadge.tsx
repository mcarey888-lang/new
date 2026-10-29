import React from "react";
import { Text, View } from "react-native";
import { expeditionEdition, EXPEDITION_EDITION_LABELS } from "@/utils/expeditionEdition";

export function ExpeditionEditionBadge({ challengeId }: { challengeId?: string | null }) {
  const edition = expeditionEdition(challengeId);
  if (!edition) return null;
  const label = EXPEDITION_EDITION_LABELS[edition];
  return (
    <View accessibilityLabel={label} style={{
      alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 7,
      paddingVertical: 3, marginBottom: 6,
      backgroundColor: edition === "summit" ? "#0E3B2C" : "#192635",
    }}>
      <Text style={{ color: edition === "summit" ? "#55E8AC" : "#BAC7D5", fontSize: 10, fontFamily: "Inter_600SemiBold" }}>
        {label}
      </Text>
    </View>
  );
}
