/**
 * Harness for the snap-to-path route drawing feature.
 *
 * NOT LINKED FROM ANYWHERE. Reachable only by navigating to `/route-draw-demo`,
 * the same way `demo.tsx` and `mountain-demo.tsx` are. Nothing in the shipping
 * app changes by this file existing, which is the point: the mechanism can be
 * confirmed working on a real device before any decision is made about where it
 * belongs.
 *
 * THE PRESENTATION HERE IS SCAFFOLDING, NOT A DESIGN.
 * It uses `SRPanel`, `SRButton` and the `BASECAMP`/`EXPLORE` tokens so it does
 * not look foreign, and it invents no visual language. The real screen should be
 * reproduced from an approved prototype; this one exists to prove the state
 * machine, the snapping and the gap handling behave on a phone. Every number it
 * shows comes from the engine, so what you see here is what the real screen
 * would have to work with.
 *
 * The path data is a 277-way demo extract around Ogwen, trimmed from the data
 * engine's committed network. It is demo data and labelled as such on screen.
 */

import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { SRButton, SREyebrow, SRPanel } from "@/components/ui";
import { RouteMapBridge, type MapMode } from "@/components/route-draw/RouteMapBridge";
import { BASECAMP, EXPLORE } from "@/constants/tokens";
import { useSnapDrawing } from "@/hooks/useSnapDrawing";
import { regionFromBbox, staticPathNetworkSource } from "@/utils/pathNetworkSource";
import demoNetwork from "@/assets/path-networks/ogwen-demo.json";

/* The extract's own extent. Built once at module scope because parsing 277 ways
   is not something to repeat on every mount. */
const SOURCE = staticPathNetworkSource({
  document: demoNetwork,
  attribution: "© OpenStreetMap contributors, ODbL",
  describe: "Ogwen demo extract, 277 ways (trimmed from the data engine)",
  retrievedAt: "2026-08-24",
});

const REGION = regionFromBbox([-4.03, 53.09, -3.96, 53.14]);

/* Tryfan, which is what the demo extract covers. The map page opens here and
   the person pans from there. */
const INITIAL = { latitude: 53.1149, longitude: -3.9976 };

export default function RouteDrawDemoScreen() {
  const { drawing, status, ready, onPathFraction, tap, acceptGap, rejectGap, undo, clear } =
    useSnapDrawing(SOURCE, REGION);

  const [mode, setMode] = useState<MapMode>("2d");
  const [layerId, setLayerId] = useState<string | null>(null);
  /* A counter, not a flag: asking for a second flyover has to run a second
     flyover rather than latch on the first. */
  const [flyoverToken, setFlyoverToken] = useState(0);
  const [basemap, setBasemap] = useState<string | null>(null);

  const handleLayerChanged = useCallback((id: string, reason?: string) => {
    setLayerId(id);
    setBasemap(reason === "tiles_failed" ? `${id} (OS tiles failed)` : id);
  }, []);

  const km = (drawing.lengthM / 1000).toFixed(2);
  const gap = drawing.pendingGap;

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={s.headerRow}>
        <SRButton label="Back" variant="quiet" compact onPress={() => router.back()} />
        <Text style={s.title}>Route drawing harness</Text>
      </View>

      <View style={s.mapWrap}>
        <RouteMapBridge
          drawing={drawing}
          mode={mode}
          layerId={layerId}
          onTap={tap}
          onLayerChanged={handleLayerChanged}
          flyoverToken={flyoverToken}
          initialCentre={INITIAL}
        />
      </View>

      <ScrollView style={s.tray} contentContainerStyle={s.trayInner}>
        {gap ? (
          <SRPanel style={s.panel}>
            <SREyebrow tone={EXPLORE.unverified}>No path joins these</SREyebrow>
            <Text style={s.gapText}>
              The network has no route between your last point and this one — a gap of{" "}
              {Math.round(gap.gapM)} m. Draw straight across it, or move the point.
            </Text>
            <View style={s.row}>
              <SRButton label="Draw across" variant="secondary" compact onPress={acceptGap} />
              <SRButton label="Move point" variant="quiet" compact onPress={rejectGap} />
            </View>
          </SRPanel>
        ) : null}

        <SRPanel style={s.panel}>
          <View style={s.statRow}>
            <Stat label="Points" value={String(drawing.points.length)} />
            <Stat label="Distance" value={`${km} km`} />
            <Stat
              label="On path"
              value={drawing.lengthM > 0 ? `${Math.round(onPathFraction * 100)}%` : "—"}
            />
          </View>
          <View style={s.row}>
            <SRButton
              label={mode === "3d" ? "2D" : "3D"}
              variant="secondary"
              compact
              onPress={() => setMode(mode === "3d" ? "2d" : "3d")}
              accessibilityHint="Switch between a flat map and terrain"
            />
            <SRButton
              label="Flyover"
              variant="secondary"
              compact
              /* Only in 3D, and only with a line to follow: a flyover of a flat
                 map is just a pan, and a flyover of nothing is nothing. */
              disabled={mode !== "3d" || drawing.coordinates.length < 2}
              onPress={() => setFlyoverToken(t => t + 1)}
            />
          </View>
          <View style={s.row}>
            <SRButton
              label="Undo"
              variant="secondary"
              compact
              onPress={undo}
              disabled={drawing.points.length === 0 && !gap}
            />
            <SRButton
              label="Clear"
              variant="quiet"
              compact
              onPress={clear}
              disabled={drawing.points.length === 0}
            />
          </View>
          <Text style={s.hint}>
            {ready
              ? "Enough to export. Naming and saving is the next screen, not this one."
              : "Tap along a path to begin. Frequent taps keep the line on the route you mean."}
          </Text>
        </SRPanel>

        {drawing.warnings.length > 0 ? (
          <SRPanel style={s.panel}>
            <SREyebrow tone={EXPLORE.unverified}>
              {drawing.warnings.length} to check
            </SREyebrow>
            {drawing.warnings.map((warning, index) => (
              <Text key={`${warning.kind}-${warning.atIndex}-${index}`} style={s.warning}>
                {warning.message}
              </Text>
            ))}
          </SRPanel>
        ) : null}

        <SRPanel style={s.panel}>
          <SREyebrow>Path data</SREyebrow>
          <Text style={s.meta}>
            {status.kind === "loading" ? "Loading path network…" : null}
            {status.kind === "ready"
              ? `${status.bundle.ways.length} ways · ${status.network.edges.length} segments\n` +
                `${status.bundle.describe}\n${status.bundle.attribution}`
              : null}
            {status.kind === "unavailable"
              ? "No path data for this area. Drawing still works, entirely freehand."
              : null}
            {status.kind === "failed" ? status.message : null}
          </Text>
          <Text style={s.meta}>
            {basemap
              ? `Basemap: ${basemap}`
              : "Basemap: served by /api/route-map — switch layers on the map itself."}
          </Text>
          <Text style={s.disclaimer}>
            Demo extract. Presentation here is scaffolding awaiting an approved
            prototype; the figures come from the real engine.
          </Text>
        </SRPanel>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BASECAMP.ink },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: BASECAMP.gutter,
    paddingBottom: 8,
  },
  title: { color: BASECAMP.textStrong, fontSize: 15, fontWeight: "700" },
  mapWrap: { flex: 1, minHeight: 240, overflow: "hidden" },
  tray: { maxHeight: "46%" },
  trayInner: { padding: BASECAMP.gutter, gap: 10 },
  panel: { padding: 14, borderRadius: 14, gap: 10 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  statRow: { flexDirection: "row", gap: 18 },
  stat: { gap: 2 },
  statValue: { color: BASECAMP.text, fontSize: 19, fontWeight: "700" },
  statLabel: {
    color: BASECAMP.textDim,
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  gapText: { color: BASECAMP.textMuted, fontSize: 13, lineHeight: 19 },
  hint: { color: BASECAMP.textDim, fontSize: 12, lineHeight: 17 },
  warning: { color: EXPLORE.unverified, fontSize: 12, lineHeight: 18 },
  meta: { color: BASECAMP.textMuted, fontSize: 11, lineHeight: 17 },
  disclaimer: { color: BASECAMP.textFaint, fontSize: 10, lineHeight: 15 },
});
