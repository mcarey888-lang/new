import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, Footprints } from "lucide-react-native";
import { useApp } from "@/context/AppContext";
import { BASECAMP, TYPE } from "@/constants/tokens";

/** Local completed activities must remain accessible while server sync is down. */
export function CompletedHikesSection() {
  const { exploreHikes, isLoading } = useApp();
  const hikes = useMemo(() => [...exploreHikes].sort((a, b) =>
    b.date.localeCompare(a.date)), [exploreHikes]);
  return (
    <View style={styles.section} testID="you-completed-hikes">
      <Text style={styles.kicker}>YOUR RECORDED ACTIVITIES</Text>
      <Text style={styles.title}>Completed hikes</Text>
      <Text style={styles.message}>Your saved recordings, including hikes waiting to sync. These are private.</Text>
      {isLoading ? <ActivityIndicator color={BASECAMP.accent} accessibilityLabel="Loading completed hikes" />
        : hikes.length === 0 ? <Text style={styles.message}>Your completed hikes will appear here after you save them.</Text>
        : hikes.map(hike => (
          <Pressable key={hike.id} style={styles.row}
            testID={`you-completed-hike-${hike.id}`}
            accessibilityRole="button" accessibilityLabel={`Open completed hike: ${hike.name}`}
            onPress={() => router.push({ pathname: "/hike-detail", params: { id: hike.id } })}>
            <Footprints size={20} color={BASECAMP.accent} />
            <View style={styles.copy}>
              <Text style={styles.name}>{hike.name}</Text>
              <Text style={styles.meta}>{new Date(hike.date).toLocaleDateString("en-GB")} · {hike.distance.toFixed(2)} km · {Math.round(hike.elevationGain)} m ascent · {hike.timeTaken} min</Text>
              <Text style={styles.meta}>{hike.syncState === "synced" ? "Synced" :
                hike.activityId ? "Saved on this device · Sync pending" : "Saved on this device"}</Text>
            </View>
            <ChevronRight size={18} color={BASECAMP.textMuted} />
          </Pressable>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 20, backgroundColor: BASECAMP.glass, padding: 14, borderRadius: 16 },
  kicker: { ...TYPE.eyebrow, color: BASECAMP.textDim, marginBottom: 7 },
  title: { ...TYPE.title, color: BASECAMP.text, fontSize: 21 },
  message: { ...TYPE.body, color: BASECAMP.textMuted, paddingVertical: 8 },
  row: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderColor: BASECAMP.hairline },
  copy: { flex: 1, minWidth: 0 },
  name: { ...TYPE.body, color: BASECAMP.textStrong, fontFamily: "Inter_600SemiBold" },
  meta: { ...TYPE.caption, color: BASECAMP.textMuted, marginTop: 4 },
});
