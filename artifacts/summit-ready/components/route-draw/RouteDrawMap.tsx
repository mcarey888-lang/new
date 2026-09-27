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
  /** Raster tile template, e.g. an OS Maps endpoint. Falls back to the OS map. */
  tileUrlTemplate?: string | null;
}

export function RouteDrawMap(_props: RouteDrawMapProps): React.ReactElement | null {
  return null;
}
