import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BASECAMP, EXPLORE } from "@/constants/tokens";
import { splitDrawnRuns } from "@/utils/snapDrawing";
import type { LatLng } from "@/utils/pathSnapping";
import type { RouteDrawMapProps } from "./RouteDrawMap";

export type { RouteDrawMapProps } from "./RouteDrawMap";

/**
 * The drawing surface on web.
 *
 * react-native-maps has no web implementation, so this was a placeholder saying
 * "open it on your phone". That made the planner undemonstrable in a browser and
 * undevelopable without a device build, which is the wrong trade for a feature
 * whose whole value is what happens when you click.
 *
 * Leaflet rather than a hand-rolled tile grid: raster ZXY layers are its core
 * case, it has no React dependency, and pan, pinch and tile recycling are
 * exactly the fiddly parts not worth reimplementing. The drawing engine is
 * untouched — this renders the same `DrawingState` the native map does, from
 * the same `splitDrawnRuns`, so the two surfaces cannot drift in what they
 * claim about a route.
 *
 * Colour follows the native map and `EXPLORE`: accent blue for line that
 * follows mapped path, unverified amber for what was asserted across a gap.
 */
export function RouteDrawMap({
  initialRegion,
  drawing,
  pathHints,
  onTap,
  tileUrlTemplate,
  tileMaximumZ,
}: RouteDrawMapProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  /* Drawn geometry is cleared and redrawn on every change; hints are drawn once.
     Separate layers so a redraw of the route does not cost 277 polylines. */
  const hintLayer = useRef<L.LayerGroup | null>(null);
  const drawLayer = useRef<L.LayerGroup | null>(null);
  /* Leaflet fires click with its own coordinates; the callback must stay fresh
     without tearing the map down, so it is read through a ref. */
  const tapRef = useRef(onTap);
  tapRef.current = onTap;

  useEffect(() => {
    if (!host.current || map.current) return;

    // latitudeDelta spans the whole viewport, so half of it is the radius the
    // bounds need — using the full delta would zoom out by one level.
    const instance = L.map(host.current, { zoomControl: true, attributionControl: true }).fitBounds([
      [
        initialRegion.latitude - initialRegion.latitudeDelta / 2,
        initialRegion.longitude - initialRegion.longitudeDelta / 2,
      ],
      [
        initialRegion.latitude + initialRegion.latitudeDelta / 2,
        initialRegion.longitude + initialRegion.longitudeDelta / 2,
      ],
    ]);

    if (tileUrlTemplate) {
      L.tileLayer(tileUrlTemplate, {
        maxZoom: tileMaximumZ ?? 17,
        attribution: "Contains OS data &copy; Crown copyright and database right",
      }).addTo(instance);
    }
    // No tile layer without a key. The map is then an empty graticule with the
    // path network drawn on it, which is honest: there is no basemap licence
    // to fall back to on web the way a phone has its platform map.

    hintLayer.current = L.layerGroup().addTo(instance);
    drawLayer.current = L.layerGroup().addTo(instance);

    instance.on("click", event => {
      tapRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    });

    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
    };
    // Built once. A changing region should pan the existing map, not rebuild it.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const layer = hintLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const hint of pathHints) {
      L.polyline(toLeaflet(hint), {
        color: "#FFFFFF",
        opacity: 0.22,
        weight: 2,
        interactive: false,
      }).addTo(layer);
    }
  }, [pathHints]);

  useEffect(() => {
    const layer = drawLayer.current;
    if (!layer) return;
    layer.clearLayers();

    const { followed, asserted } = splitDrawnRuns(drawing);
    for (const run of followed) {
      L.polyline(toLeaflet(run), { color: EXPLORE.accent, weight: 5 }).addTo(layer);
    }
    for (const run of asserted) {
      L.polyline(toLeaflet(run), {
        color: EXPLORE.unverified,
        weight: 4,
        dashArray: "8 7",
      }).addTo(layer);
    }

    if (drawing.pendingGap) {
      L.polyline(
        toLeaflet([
          drawing.points[drawing.pendingGap.fromIndex].position,
          drawing.pendingGap.candidate.position,
        ]),
        { color: EXPLORE.unverifiedLine, weight: 2, dashArray: "3 6" },
      ).addTo(layer);
    }

    const warned = new Set(
      drawing.warnings
        .filter(w => w.kind === "detour" || w.kind === "freehand_crossing")
        // A leg's warning belongs on the point that ends it.
        .map(w => w.atIndex + 1),
    );
    drawing.points.forEach((point, index) => {
      L.circleMarker([point.position.latitude, point.position.longitude], {
        radius: index === 0 ? 8 : 6,
        color: BASECAMP.ink,
        weight: 2,
        fillColor: warned.has(index) || point.origin === "freehand"
          ? EXPLORE.unverified
          : EXPLORE.accent,
        fillOpacity: 1,
      }).addTo(layer);
    });

    if (drawing.pendingGap) {
      const candidate = drawing.pendingGap.candidate.position;
      L.circleMarker([candidate.latitude, candidate.longitude], {
        radius: 7,
        color: BASECAMP.ink,
        weight: 2,
        fillColor: EXPLORE.unverified,
        fillOpacity: 0.7,
      }).addTo(layer);
    }
  }, [drawing]);

  return (
    <View style={s.container}>
      {/* Leaflet needs a real DOM node with a definite height, which
          react-native-web's View provides once flex has resolved. */}
      <div ref={host} style={{ width: "100%", height: "100%", background: BASECAMP.ink }} />
    </View>
  );
}

function toLeaflet(points: readonly LatLng[]): Array<[number, number]> {
  return points.map(point => [point.latitude, point.longitude]);
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BASECAMP.ink, overflow: "hidden" },
});
