/** Safety, About, Key facts, Offline, Sources and correction sections. */
import React from "react";
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Download, Trash2 } from "lucide-react-native";
import { BASECAMP, EXPLORE, SP, TYPE } from "@/constants/tokens";
import { SRPanel, SRSectionHeader } from "@/components/ui";
import { FactList } from "./parts";
import type { PresentedFact } from "@/utils/mountainDetailPresentation";
import type { MountainRoutePackage } from "@/utils/mountainHubStorage";
import type { MountainHazardNote } from "@/utils/mountainSafety";

const wrap = { paddingHorizontal: BASECAMP.gutter, marginTop: 20 } as const;
export const known = (facts: readonly PresentedFact[]) =>
  facts.filter(f => f.state !== "missing" && !!f.value);

export type HazardItem = MountainHazardNote;

export function SafetySection({ hazards }: { hazards: readonly HazardItem[] }) {
  return (
    <View style={wrap} testID="mountain-safety">
      <SRSectionHeader title="Safety & hazards" />
      <SRPanel radius={8} style={s.panel}>
        {hazards.length ? hazards.map((h, i) => (
          <View key={`${h.routeName}-${i}`} style={s.hazard}>
            <Text style={s.hazardLabel}>{h.label}</Text>
            <Text style={s.cap}>Route-specific · {h.routeName} · {h.confidence}</Text>
            <Text style={s.cap}>Source: {h.sourceName}{h.retrievedAt ? ` · retrieved ${new Date(h.retrievedAt).toLocaleDateString()}` : ""}</Text>
            <Text style={s.cap}>Severity has not been assessed. This is not a complete safety assessment.</Text>
            {h.sourceUrl ? (
              <Pressable accessibilityRole="link" accessibilityLabel={`Read ${h.sourceName} safety source`}
                onPress={() => void Linking.openURL(h.sourceUrl!).catch(() => Alert.alert("Source unavailable", "This source could not be opened."))}
                style={s.btn}><Text style={s.btnText}>Read source</Text></Pressable>
            ) : null}
          </View>
        )) : (
          <Text style={s.body}>No sourced hazard assessment is stored for this mountain.</Text>
        )}
        <Text style={s.warn}>Check current mountain weather and access notices before setting out.</Text>
      </SRPanel>
    </View>
  );
}

export function AboutSection({ text, state }: { text: string | null; state: "loading" | "ready" | "error" }) {
  if (state === "ready" && !text) return null;
  return (
    <View style={wrap}>
      <SRSectionHeader title="About this mountain" />
      <Text style={s.desc}>
        {state === "loading" ? "Loading description…" : state === "error" ? "Description is unavailable right now." : text}
      </Text>
      {text ? <Text style={s.cap}>Guide overview. Route and access details are not verified by this text.</Text> : null}
    </View>
  );
}

export function KeyFacts({ facts }: { facts: readonly PresentedFact[] }) {
  const list = known(facts);
  if (!list.length) return null;
  return (
    <View style={wrap}>
      <SRSectionHeader title="Key facts" />
      <SRPanel radius={8} style={{ marginTop: 10 }}><FactList facts={list} /></SRPanel>
    </View>
  );
}

function size(bytes: number) {
  return bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function OfflineSection({
  routeName, canPackage, pkg, saving, onSave, onRemove, onRefreshNeeded,
}: {
  routeName: string | null; canPackage: boolean; pkg: MountainRoutePackage | null; saving: boolean;
  onSave: () => void; onRemove: () => void; onRefreshNeeded?: boolean;
}) {
  return (
    <View style={wrap} testID="mountain-offline-section">
      <SRSectionHeader title="Offline downloads" />
      <SRPanel radius={8} style={s.panel}>
        <Text style={s.hazardLabel}>Route data</Text>
        {pkg ? (
          <>
            <Text style={s.body}>
              Saved on this device {new Date(pkg.savedAt).toLocaleDateString()} · {size(pkg.sizeBytes)}
              {routeName ? ` · ${routeName}` : ""}
            </Text>
            {onRefreshNeeded ? <Text style={s.warn}>A newer route version exists. Save again to update.</Text> : null}
          </>
        ) : (
          <Text style={s.body}>
            {canPackage
              ? "Save the selected route's geometry, facts and parking notes to this device. GPS recording works without it."
              : "Select a mapped route to save its data to this device."}
          </Text>
        )}
        <View style={s.row}>
          <Pressable testID="mountain-download-route" onPress={onSave} disabled={!canPackage || saving}
            accessibilityRole="button" accessibilityLabel={pkg ? "Update saved route data" : "Save route data to this device"}
            style={[s.btn, (!canPackage || saving) && { opacity: 0.5 }]}>
            {saving ? <ActivityIndicator color={EXPLORE.accent} /> : <Download size={15} color={EXPLORE.accent} />}
            <Text style={s.btnText}>{pkg ? "Update route data" : "Save route data"}</Text>
          </Pressable>
          {pkg ? (
            <Pressable testID="mountain-remove-download" onPress={onRemove} disabled={saving} accessibilityRole="button"
              accessibilityLabel="Remove saved route data" style={s.btn}>
              <Trash2 size={15} color={EXPLORE.accent} />
              <Text style={s.btnText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={s.divider} />
        <Text style={s.hazardLabel}>Offline map</Text>
        <Text style={s.body}>
          Offline map downloads are not available in this version. Map tiles are not cached, so maps need a connection. Recording your hike does not.
        </Text>
      </SRPanel>
    </View>
  );
}

export function SourcesSection({ sources }: { sources: readonly string[] }) {
  if (!sources.length) return null;
  return (
    <View style={wrap}>
      <SRSectionHeader title="Sources & last checked" />
      <SRPanel radius={8} style={s.panel}>
        {sources.map(src => <Text key={src} style={s.body}>{src}</Text>)}
      </SRPanel>
    </View>
  );
}

export function CorrectionRow() {
  return (
    <View style={wrap}>
      <Text style={s.cap} testID="mountain-correction-unavailable">
        Suggest a correction: reporting is not available in this version yet.
      </Text>
    </View>
  );
}

export function ProvenanceNote({ text }: { text: string }) {
  return <View style={wrap}><Text style={s.prov}>{text}</Text></View>;
}

const s = StyleSheet.create({
  panel: { marginTop: 10, padding: 14, gap: 8 },
  hazard: { gap: 2 },
  hazardLabel: { ...TYPE.bodyBold, color: BASECAMP.text },
  body: { ...TYPE.small, color: BASECAMP.textMuted },
  cap: { ...TYPE.caption, color: BASECAMP.textMuted, marginTop: 4 },
  warn: { ...TYPE.caption, color: EXPLORE.unverified },
  desc: { marginTop: 9, ...TYPE.body, color: BASECAMP.textMuted },
  row: { flexDirection: "row", flexWrap: "wrap", gap: SP.sm },
  btn: {
    flexDirection: "row", alignItems: "center", gap: 7, minHeight: 44, paddingHorizontal: 12, borderRadius: 7,
    backgroundColor: BASECAMP.panelSub, borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },
  btnText: { ...TYPE.smallBold, color: EXPLORE.accent },
  divider: { height: 1, backgroundColor: BASECAMP.glassBorder },
  prov: { fontSize: 10, lineHeight: 14, color: BASECAMP.textDim },
});
