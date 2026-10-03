/**
 * Parking & start points. Directions only ever go to a validated access point.
 * Operator-listed car parks have grid references, not entrance pins, so they
 * stay Find-in-Maps / source links.
 */
import React from "react";
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Footprints, MapPin, Navigation } from "lucide-react-native";
import { BASECAMP, EXPLORE, SP, TYPE } from "@/constants/tokens";
import { SRPanel, SRSectionHeader } from "@/components/ui";
import { openMapDirections, openMapPin, openMapSearch } from "@/utils/openMaps";
import type { MountainAccessPoint } from "@/utils/mountainAccess";
import type { MountainParkingOption } from "@/utils/mountainParkingOptions";

export type AccessState = "idle" | "loading" | "done" | "error";

export function ParkingSection({
  mountainName, place, options, access, accessState, onFind, onUseAsStart,
  routeStart, onWalkToRouteStart,
}: {
  mountainName: string; place: string | null;
  options: readonly MountainParkingOption[];
  access: MountainAccessPoint | null; accessState: AccessState;
  onFind: () => void; onUseAsStart: (p: MountainAccessPoint) => void;
  routeStart?: { label: string } | null; onWalkToRouteStart?: () => void;
}) {
  const failedDirections = () =>
    Alert.alert("Directions unavailable", "No map application could open this destination.");
  return (
    <View style={styles.wrap}>
      <SRSectionHeader title="Parking & start points" icon={<MapPin size={13} color={EXPLORE.accent} />} />

      {access ? (
        <SRPanel radius={8} style={styles.card} testID="mountain-access-point">
          <Text style={styles.trust}>{access.trust.toUpperCase()}</Text>
          <Text style={styles.name}>{access.name}</Text>
          <Text style={styles.meta}>{access.sourceName}{access.lastChecked ? ` · checked ${access.lastChecked}` : ""}</Text>
          <Text style={styles.note}>{access.note}</Text>
          <View style={styles.row}>
            {access.canGetDirections ? (
              <Btn label="Get directions" a11y={`Get directions to ${access.name}`} icon="nav"
                onPress={() => void openMapDirections(access.latitude, access.longitude, access.name)
                  .then(ok => { if (!ok) failedDirections(); })} />
            ) : null}
            <Btn label="View on map" a11y={`View ${access.name} on map`} icon="pin"
              onPress={() => openMapPin(access.latitude, access.longitude, access.name)} />
            {access.canGetDirections ? (
              <Btn label="Use as route start" a11y={`Use ${access.name} as route start`} icon="foot"
                onPress={() => onUseAsStart(access)} />
            ) : null}
            <Btn label="Source" a11y={`Open ${access.sourceName} source`} icon="pin"
              onPress={() => void Linking.openURL(access.sourceUrl).catch(() =>
                Alert.alert("Source unavailable", "The source could not be opened right now."))} />
          </View>
          {!access.canGetDirections ? (
            <Text style={styles.caveat}>This is a candidate, not a confirmed place to park. Directions are not offered; check the source and local signs.</Text>
          ) : null}
        </SRPanel>
      ) : null}

      {routeStart && onWalkToRouteStart ? (
        <SRPanel radius={8} style={styles.card}>
          <Text style={styles.trust}>MAPPED ROUTE START</Text>
          <Text style={styles.name}>{routeStart.label}</Text>
          <View style={styles.row}>
            <Btn label="Walking directions" a11y={`Walking directions to ${routeStart.label}`} icon="foot" onPress={onWalkToRouteStart} />
          </View>
          <Text style={styles.caveat}>Walking directions to the route's mapped start. This is not a confirmed car park.</Text>
        </SRPanel>
      ) : null}

      {options.map(o => (
        <SRPanel key={o.id} radius={8} style={styles.card}>
          <Text style={styles.trust}>LISTED BY OPERATOR</Text>
          <Text style={styles.name}>{o.name}</Text>
          <Text style={styles.meta}>{o.approach} · {o.osGridReference} · {o.postcode}</Text>
          <Text style={styles.note}>{o.note}</Text>
          <View style={styles.row}>
            <Btn label="Find in Maps" a11y={`Find ${o.name} in Maps`} icon="pin" onPress={() => openMapSearch(o.mapSearch)} />
            <Btn label={`${o.sourceName} listing`} a11y={`Read ${o.sourceName} listing for ${o.name}`} icon="pin"
              onPress={() => void Linking.openURL(o.sourceUrl).catch(() =>
                Alert.alert("Source unavailable", "The listing could not be opened right now."))} />
          </View>
        </SRPanel>
      ))}

      <SRPanel radius={8} style={styles.card}>
        <Text style={styles.note}>
          {access || options.length
            ? "Grid references locate an area, not the vehicle entrance. Check access and signs before travelling."
            : "No confirmed parking is stored for this mountain yet."}
        </Text>
        {accessState === "done" && !access ? (
          <Text style={styles.caveat}>No access point could be confirmed from available sources.</Text>
        ) : null}
        {accessState === "error" ? (
          <Text style={styles.caveat}>Parking lookup is unavailable right now.</Text>
        ) : null}
        <View style={styles.row}>
          <Btn testID="mountain-find-parking"
            label={accessState === "loading" ? "Looking…" : "Find parking"}
            a11y={`Find parking for ${mountainName}`} icon="nav" disabled={accessState === "loading"}
            onPress={onFind} />
          <Btn label="Search nearby parking" a11y={`Search the map for parking near ${mountainName}`} icon="nav"
            onPress={() => openMapSearch(`${mountainName} car park ${place ?? ""}`.trim())} />
        </View>
        {accessState === "loading" ? <ActivityIndicator color={EXPLORE.accent} style={{ alignSelf: "flex-start", marginTop: 6 }} /> : null}
      </SRPanel>
    </View>
  );
}

function Btn({ label, a11y, icon, onPress, disabled, testID }: {
  label: string; a11y: string; icon: "nav" | "pin" | "foot"; onPress: () => void; disabled?: boolean; testID?: string;
}) {
  const I = icon === "nav" ? Navigation : icon === "foot" ? Footprints : MapPin;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={a11y}
      accessibilityState={{ disabled: !!disabled }} testID={testID} style={[styles.btn, disabled && { opacity: 0.55 }]}>
      <I size={15} color={EXPLORE.accent} />
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: BASECAMP.gutter, marginTop: 20 },
  card: { marginTop: 10, padding: 14 },
  trust: { ...TYPE.eyebrow, color: EXPLORE.accent },
  name: { marginTop: 4, ...TYPE.bodyBold, color: BASECAMP.text },
  meta: { marginTop: 3, ...TYPE.caption, color: BASECAMP.textStrong },
  note: { marginTop: 6, ...TYPE.caption, color: BASECAMP.textMuted },
  caveat: { marginTop: 8, ...TYPE.caption, color: EXPLORE.unverified },
  row: { flexDirection: "row", flexWrap: "wrap", gap: SP.sm, marginTop: 10 },
  btn: {
    flexDirection: "row", alignItems: "center", gap: 7, minHeight: 44, paddingHorizontal: 12, borderRadius: 7,
    backgroundColor: BASECAMP.panelSub, borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },
  btnText: { ...TYPE.smallBold, color: EXPLORE.accent },
});
