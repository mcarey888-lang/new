import React, { useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";
import { BASECAMP, EXPLORE } from "@/constants/tokens";
import { splitDrawnRuns } from "@/utils/snapDrawing";
import type { RouteDrawMapProps } from "./RouteDrawMap";

export type { RouteDrawMapProps } from "./RouteDrawMap";

/**
 * The drawing surface.
 *
 * Colour carries meaning here and the meanings are the ones `EXPLORE` already
 * defines, so none are invented:
 *
 *   accent (blue)      the route as it follows mapped path — navigation
 *   unverified (amber) a stretch drawn across a gap, and the point that ends a
 *                      leg which wandered. "Attention, not alarm", which is
 *                      exactly right: an asserted line is legitimate, and it
 *                      must not look identical to a surveyed one.
 *
 * Path hints are drawn beneath everything at low opacity so a person can see
 * what there is to snap to. Without them, tapping is guesswork and the snap
 * radius feels arbitrary.
 *
 * `tileUrlTemplate` is where an Ordnance Survey raster endpoint goes. Left out,
 * the platform's own map shows instead — which is why the drawing works before
 * any tile licensing question is settled.
 */
export function RouteDrawMap({
  initialRegion,
  drawing,
  pathHints,
  onTap,
  tileUrlTemplate,
}: RouteDrawMapProps) {
  const mapRef = useRef<MapView>(null);

  /* Split the line into on-path and asserted runs so they can be drawn
     differently. A single polyline cannot say which parts were followed. */
  const { followed, asserted } = useMemo(() => splitDrawnRuns(drawing), [drawing]);

  const warnedPoints = useMemo(
    () =>
      new Set(
        drawing.warnings
          .filter(w => w.kind === "detour" || w.kind === "freehand_crossing")
          // A leg's warning is shown on the point that ends it.
          .map(w => w.atIndex + 1),
      ),
    [drawing.warnings],
  );

  return (
    <MapView
      ref={mapRef}
      style={s.map}
      initialRegion={initialRegion}
      showsUserLocation
      showsCompass={false}
      rotateEnabled={false}
      onPress={event => onTap(event.nativeEvent.coordinate)}
    >
      {tileUrlTemplate ? <UrlTile urlTemplate={tileUrlTemplate} maximumZ={17} zIndex={-1} /> : null}

      {pathHints.map((hint, index) => (
        <Polyline
          key={`hint-${index}`}
          coordinates={hint}
          strokeColor={HINT}
          strokeWidth={2}
          zIndex={1}
        />
      ))}

      {followed.map((run, index) => (
        <Polyline
          key={`followed-${index}`}
          coordinates={run}
          strokeColor={EXPLORE.accent}
          strokeWidth={5}
          zIndex={3}
        />
      ))}

      {asserted.map((run, index) => (
        <Polyline
          key={`asserted-${index}`}
          coordinates={run}
          strokeColor={EXPLORE.unverified}
          strokeWidth={4}
          // Dashes say "not surveyed" without a legend.
          lineDashPattern={[8, 7]}
          zIndex={3}
        />
      ))}

      {drawing.pendingGap ? (
        <Polyline
          coordinates={[
            drawing.points[drawing.pendingGap.fromIndex].position,
            drawing.pendingGap.candidate.position,
          ]}
          strokeColor={EXPLORE.unverifiedLine}
          strokeWidth={2}
          lineDashPattern={[3, 6]}
          zIndex={2}
        />
      ) : null}

      {drawing.points.map((point, index) => (
        <Marker
          key={`point-${index}`}
          coordinate={point.position}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <Dot
            warned={warnedPoints.has(index)}
            offPath={point.origin === "freehand"}
            first={index === 0}
          />
        </Marker>
      ))}

      {drawing.pendingGap ? (
        <Marker
          coordinate={drawing.pendingGap.candidate.position}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <Dot warned offPath={false} first={false} pending />
        </Marker>
      ) : null}
    </MapView>
  );
}

const HINT = "rgba(255,255,255,0.22)";

function Dot({
  warned,
  offPath,
  first,
  pending,
}: {
  warned: boolean;
  offPath: boolean;
  first: boolean;
  pending?: boolean;
}) {
  const colour = warned || offPath ? EXPLORE.unverified : EXPLORE.accent;
  return (
    <View
      style={[
        s.dot,
        { backgroundColor: colour },
        first && s.dotFirst,
        pending && s.dotPending,
      ]}
    />
  );
}

const s = StyleSheet.create({
  map: { flex: 1 },
  dot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: BASECAMP.ink,
  },
  dotFirst: { width: 17, height: 17, borderRadius: 9 },
  dotPending: { opacity: 0.75, borderStyle: "dashed" },
});
