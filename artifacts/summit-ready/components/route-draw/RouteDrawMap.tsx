/**
 * Platform dispatcher for the route-drawing map, following the convention
 * `TrailMapView` established: this file carries the props and renders nothing,
 * `.native.tsx` draws the real map, `.web.tsx` explains why there isn't one.
 */

import React from "react";
import type { LatLng } from "@/utils/pathSnapping";
import type { DrawingState } from "@/utils/snapDrawing";

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface RouteDrawMapProps {
  initialRegion: MapRegion;
  drawing: DrawingState;
  /** Path geometry to show faintly beneath the line, so taps have a target. */
  pathHints: LatLng[][];
  onTap: (at: LatLng) => void;
  /**
   * Raster tile template, e.g. an Ordnance Survey endpoint. When absent the
   * platform basemap shows through, which is a supported state — the drawing
   * engine does not care what is underneath.
   */
  tileUrlTemplate?: string | null;
  /** Deepest zoom the tile layer publishes. Beyond it, tiles come back blank. */
  tileMaximumZ?: number | null;
}

export function RouteDrawMap(_props: RouteDrawMapProps): React.ReactElement | null {
  return null;
}
