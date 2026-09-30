import React, { useCallback, useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { BASECAMP } from "@/constants/tokens";
import type { LatLng } from "@/utils/pathSnapping";
import { splitDrawnRuns, type DrawingState } from "@/utils/snapDrawing";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

/* chrome=none hides the page's own buttons. The screen supplies 2D/3D and
   Flyover, and two controls for one thing disagree the moment either is used.
   Opened directly in a browser the page keeps its controls, because there is
   no host to provide them. */
const MAP_URL = `${API_BASE}/route-map?chrome=none`;

/**
 * The route planner's map, as served by `/api/route-map`.
 *
 * A WebView over a server-rendered page rather than a native map component,
 * matching how `hike-tracking` already shows its map. That is not just
 * consistency: the page is MapLibre, which is the only way to get terrain and a
 * flyover, and it keeps the Ordnance Survey key on the server where it belongs
 * rather than shipping it in the bundle.
 *
 * NATIVE AND WEB BOTH, mirroring `hike-tracking`: a WebView on a device, a
 * plain iframe in the browser, because react-native-webview renders nothing on
 * web. Both speak the same postMessage vocabulary, so the page cannot tell them
 * apart.
 *
 * THE BRIDGE CARRIES STATE ONE WAY AND EVENTS THE OTHER. `drawing` goes out as
 * three messages — the followed line, the asserted line, the waypoints — and
 * taps come back. The page holds no opinion about where a route goes;
 * `utils/snapDrawing` decides everything, which is what keeps this surface and
 * the engine from disagreeing.
 */

export type MapMode = "2d" | "3d";

export interface RouteMapBridgeProps {
  drawing: DrawingState;
  mode: MapMode;
  /** Sent once the page reports itself ready, and whenever it changes after. */
  layerId?: string | null;
  onTap: (at: LatLng) => void;
  /** The page switched basemap itself — by its own control, or an OS failure. */
  onLayerChanged?: (id: string, reason?: string) => void;
  onReady?: () => void;
  /** Bumping this runs a flyover. A counter rather than a boolean, so asking
      twice runs it twice instead of latching. */
  flyoverToken?: number;
  initialCentre?: LatLng;
}

/* The wire format is `{lat,lng}`, which is what the page and `/hike-map` both
   speak. The engine uses `{latitude,longitude}`. Keeping them as separate types
   rather than one loose shape is what stops a mis-keyed point reaching the map
   as undefined and drawing at the origin. */
interface WirePoint {
  lat: number;
  lng: number;
}

type Outbound =
  | { type: "route"; points: WirePoint[] }
  | { type: "asserted"; points: WirePoint[] }
  | { type: "marks"; points: Array<WirePoint & { kind: string }> }
  | { type: "locate"; lat: number; lng: number; zoom?: number }
  | { type: "layer"; id: string }
  | { type: "mode"; value: MapMode }
  | { type: "flyover" }
  | { type: "clear" };

/** The one place the engine's latitude-first shape becomes the wire's. */
const toWire = (points: readonly LatLng[]): WirePoint[] =>
  points.map(p => ({ lat: p.latitude, lng: p.longitude }));

export function RouteMapBridge({
  drawing,
  mode,
  layerId,
  onTap,
  onLayerChanged,
  onReady,
  flyoverToken = 0,
  initialCentre,
}: RouteMapBridgeProps) {
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hostRef = useRef<View>(null);
  const readyRef = useRef(false);

  const send = useCallback((message: Outbound) => {
    const payload = JSON.stringify(message);
    if (Platform.OS === "web") {
      try {
        iframeRef.current?.contentWindow?.postMessage(payload, "*");
      } catch {
        /* cross-origin before load; the ready handshake resends */
      }
      return;
    }
    webViewRef.current?.postMessage(payload);
  }, []);

  /* Push the whole drawing, not a diff. The page is stateless about routes, and
     a diff would need both sides to agree on history — which is exactly the
     kind of drift this design exists to avoid. */
  const pushDrawing = useCallback(() => {
    const { followed, asserted } = splitDrawnRuns(drawing);
    send({ type: "route", points: toWire(followed.flat()) });
    send({ type: "asserted", points: toWire(asserted.flat()) });

    const warned = new Set(
      drawing.warnings
        .filter(w => w.kind === "detour" || w.kind === "freehand_crossing")
        // A leg's warning belongs on the point that ends it.
        .map(w => w.atIndex + 1),
    );
    send({
      type: "marks",
      points: drawing.points.map((p, i) => ({
        lat: p.position.latitude,
        lng: p.position.longitude,
        kind: i === 0 ? "first" : warned.has(i) || p.origin === "freehand" ? "warn" : "point",
      })),
    });
  }, [drawing, send]);

  const handleMessage = useCallback(
    (raw: string) => {
      let msg: { type?: string; lat?: number; lng?: number; id?: string; reason?: string };
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (msg.type === "ready") {
        readyRef.current = true;
        if (initialCentre) {
          send({ type: "locate", lat: initialCentre.latitude, lng: initialCentre.longitude, zoom: 13.5 });
        }
        if (layerId) send({ type: "layer", id: layerId });
        send({ type: "mode", value: mode });
        pushDrawing();
        onReady?.();
        return;
      }
      if (msg.type === "tap" && typeof msg.lat === "number" && typeof msg.lng === "number") {
        onTap({ latitude: msg.lat, longitude: msg.lng });
        return;
      }
      if (msg.type === "layerChanged" && msg.id) onLayerChanged?.(msg.id, msg.reason);
    },
    [initialCentre, layerId, mode, onLayerChanged, onReady, onTap, pushDrawing, send],
  );

  // Web: a plain iframe, since react-native-webview renders nothing here.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const container = hostRef.current as unknown as HTMLElement | null;
    if (!container) return;

    const iframe = document.createElement("iframe");
    iframe.src = MAP_URL;
    iframe.style.cssText = "width:100%;height:100%;border:none;display:block;";
    iframeRef.current = iframe;
    container.appendChild(iframe);

    const onWindowMessage = (event: MessageEvent) => {
      if (typeof event.data === "string") handleMessage(event.data);
    };
    window.addEventListener("message", onWindowMessage);
    return () => {
      window.removeEventListener("message", onWindowMessage);
      try {
        container.removeChild(iframe);
      } catch {
        /* already gone */
      }
      iframeRef.current = null;
      readyRef.current = false;
    };
    // Built once; the page keeps itself in step through messages.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Only resend once the page has said it is ready. Before that the handshake
     sends everything anyway, and posting into a half-loaded page is silently
     dropped — which looks exactly like a route that will not draw. */
  useEffect(() => {
    if (readyRef.current) pushDrawing();
  }, [pushDrawing]);

  useEffect(() => {
    if (readyRef.current) send({ type: "mode", value: mode });
  }, [mode, send]);

  useEffect(() => {
    if (readyRef.current && layerId) send({ type: "layer", id: layerId });
  }, [layerId, send]);

  useEffect(() => {
    if (readyRef.current && flyoverToken > 0) send({ type: "flyover" });
  }, [flyoverToken, send]);

  if (Platform.OS === "web") {
    return <View ref={hostRef} style={s.host} />;
  }

  return (
    <View style={s.host}>
      <WebView
        ref={webViewRef}
        source={{ uri: MAP_URL }}
        style={s.web}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        onMessage={event => handleMessage(event.nativeEvent.data)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  host: { flex: 1, backgroundColor: BASECAMP.ink, overflow: "hidden" },
  web: { flex: 1, backgroundColor: BASECAMP.ink },
});
