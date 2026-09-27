/**
 * React binding for the snap-to-path drawing state machine.
 *
 * Thin by design. Every decision lives in `utils/snapDrawing`, which is
 * headless and exhaustively tested; this only holds the reducer, builds the
 * network once per bundle, and exposes callbacks. Anything that looks like a
 * rule belongs in the reducer, not here.
 *
 * The network is built in an effect rather than during render because building
 * it is ~75 ms on a real region — fine once, unacceptable on every render.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { NetworkRegion, PathNetworkBundle, PathNetworkSource } from "@/utils/pathNetworkSource";
import { buildPathNetwork, type LatLng, type PathNetwork } from "@/utils/pathSnapping";
import {
  canExport,
  drawingReducer,
  emptyDrawing,
  snappedFraction,
  type DrawingAction,
  type DrawingState,
} from "@/utils/snapDrawing";

export type NetworkStatus =
  | { kind: "loading" }
  /** Paths are loaded and taps will snap. */
  | { kind: "ready"; bundle: PathNetworkBundle; network: PathNetwork }
  /** No extract covers this region. Drawing still works, entirely freehand. */
  | { kind: "unavailable" }
  | { kind: "failed"; message: string };

export interface UseSnapDrawing {
  drawing: DrawingState;
  status: NetworkStatus;
  /** Whether the route can be named and exported. */
  ready: boolean;
  /** How much of the line follows a mapped path, 0–1. */
  onPathFraction: number;
  tap: (at: LatLng) => void;
  acceptGap: () => void;
  rejectGap: () => void;
  undo: () => void;
  clear: () => void;
}

export function useSnapDrawing(
  source: PathNetworkSource,
  region: NetworkRegion | null,
  snapRadiusM?: number,
): UseSnapDrawing {
  const [status, setStatus] = useState<NetworkStatus>({ kind: "loading" });

  const regionKey = region
    ? `${region.minLatitude},${region.minLongitude},${region.maxLatitude},${region.maxLongitude}`
    : null;

  useEffect(() => {
    if (!region) {
      setStatus({ kind: "unavailable" });
      return;
    }
    let live = true;
    setStatus({ kind: "loading" });
    source
      .load(region)
      .then(bundle => {
        if (!live) return;
        if (!bundle) {
          setStatus({ kind: "unavailable" });
          return;
        }
        setStatus({ kind: "ready", bundle, network: buildPathNetwork(bundle.ways) });
      })
      .catch((error: unknown) => {
        if (!live) return;
        setStatus({
          kind: "failed",
          message: error instanceof Error ? error.message : "Could not load path data.",
        });
      });
    // Ignoring a region that changed only by float noise avoids rebuilding the
    // network every time the map settles.
    return () => {
      live = false;
    };
  }, [source, regionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const network = status.kind === "ready" ? status.network : null;

  /* The reducer needs the current network, and a stale one would silently snap
     against paths that are no longer shown. A ref keeps the dispatch identity
     stable while always reading the live network. */
  const config = useRef({ network, snapRadiusM });
  config.current = { network, snapRadiusM };

  const [drawing, dispatch] = useReducer(
    (state: DrawingState, action: DrawingAction) =>
      drawingReducer(state, action, config.current),
    emptyDrawing,
  );

  const tap = useCallback((at: LatLng) => dispatch({ type: "tap", at }), []);
  const acceptGap = useCallback(() => dispatch({ type: "acceptGap" }), []);
  const rejectGap = useCallback(() => dispatch({ type: "rejectGap" }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const clear = useCallback(() => dispatch({ type: "clear" }), []);

  return useMemo(
    () => ({
      drawing,
      status,
      ready: canExport(drawing),
      onPathFraction: snappedFraction(drawing),
      tap,
      acceptGap,
      rejectGap,
      undo,
      clear,
    }),
    [drawing, status, tap, acceptGap, rejectGap, undo, clear],
  );
}
