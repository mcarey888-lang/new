/** Primary action grid and the Track mountain choices. */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Download, Footprints, MapPin, PenLine, Play, Route as RouteIcon, Save } from "lucide-react-native";
import { BASECAMP, EXPLORE, SP, TYPE } from "@/constants/tokens";
import { SRPanel } from "@/components/ui";

export function ActionTile({
  label, icon, onPress, testID, primary, disabled, hint,
}: {
  label: string; icon: React.ReactNode; onPress: () => void; testID: string;
  primary?: boolean; disabled?: boolean; hint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={[styles.tile, primary && styles.tilePrimary, disabled && { opacity: 0.55 }]}
    >
      {icon}
      <Text style={[styles.tileText, primary && { color: BASECAMP.text }]} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

export function ActionGrid({
  resumable, busy, onRoutes, onParking, onTrack, onResume, onOffline,
}: {
  resumable: boolean; busy: boolean;
  onRoutes: () => void; onParking: () => void; onTrack: () => void; onResume: () => void; onOffline: () => void;
}) {
  return (
    <View style={styles.grid}>
      <ActionTile testID="mountain-view-routes" label="View routes" onPress={onRoutes}
        icon={<RouteIcon size={17} color={EXPLORE.accent} />} hint="Scrolls to the routes section" />
      <ActionTile testID="mountain-parking" label="Parking & starts" onPress={onParking}
        icon={<MapPin size={17} color={EXPLORE.accent} />} hint="Scrolls to parking and start points" />
      <ActionTile testID="mountain-track" primary disabled={busy}
        label={resumable ? "Resume activity" : "Track mountain"}
        onPress={resumable ? onResume : onTrack}
        icon={<Play size={17} color={EXPLORE.accent} />} />
      <ActionTile testID="mountain-offline" label="Download offline" onPress={onOffline}
        icon={<Download size={17} color={EXPLORE.accent} />} hint="Scrolls to offline downloads" />
    </View>
  );
}

export function TrackChoices({
  busy, onFollow, onFreeHike, onPlan, onSaved, onClose,
}: {
  busy: boolean; onFollow: () => void; onFreeHike: () => void; onPlan: () => void; onSaved: () => void; onClose: () => void;
}) {
  return (
    <SRPanel radius={8} style={styles.choices} testID="mountain-track-choices">
      <Text style={styles.choiceTitle}>How do you want to track?</Text>
      <ActionTile testID="mountain-follow-route" label="Follow route" onPress={onFollow}
        icon={<RouteIcon size={17} color={EXPLORE.accent} />} />
      <ActionTile testID="mountain-free-hike" label="Record free hike" onPress={onFreeHike} disabled={busy}
        icon={<Footprints size={17} color={EXPLORE.accent} />} hint="Starts recording without a route" />
      <ActionTile testID="mountain-plan-route" label="Plan my own route" onPress={onPlan}
        icon={<PenLine size={17} color={EXPLORE.accent} />} />
      <ActionTile testID="mountain-saved-routes" label="Saved routes" onPress={onSaved}
        icon={<Save size={17} color={EXPLORE.accent} />} />
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close track choices" style={styles.close}>
        <Text style={styles.closeText}>Close</Text>
      </Pressable>
    </SRPanel>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SP.sm, paddingHorizontal: BASECAMP.gutter, marginTop: 14 },
  tile: {
    flexGrow: 1, flexBasis: "46%", minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 13, paddingVertical: 10, borderRadius: 8,
    backgroundColor: BASECAMP.panelSub, borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },
  tilePrimary: { borderColor: EXPLORE.accentLine },
  tileText: { flex: 1, ...TYPE.smallBold, color: BASECAMP.textStrong },
  choices: { marginHorizontal: BASECAMP.gutter, marginTop: 10, padding: 12, gap: SP.sm },
  choiceTitle: { ...TYPE.bodyBold, color: BASECAMP.text, marginBottom: 2 },
  close: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  closeText: { ...TYPE.smallBold, color: BASECAMP.textMuted },
});
