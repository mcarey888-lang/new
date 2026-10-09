import React, { useCallback, useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

/**
 * The map, on the Track screen.
 *
 * The same page the route planner uses — `/api/route-map` — so layers, hill
 * search, saved routes and route drawing are the ones already built rather
 * than a second set that drifts. `recording` switches the page into its
 * walking chrome: search and drawing put away, layers and recentre kept.
 */

const API_BASE =
  process.env.EXPO_PUBLIC_MAP_BASE ??
  (process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
    : "/api");

export interface TrackMapHandle {
  send(message: unknown): void;
}

interface Props {
  recording: boolean;
  onMessage?: (message: Record<string, unknown>) => void;
  mapRef?: React.MutableRefObject<TrackMapHandle | null>;
}

export function TrackMap({ recording, onMessage, mapRef }: Props) {
  const webViewRef = useRef<WebView>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const hostRef = useRef<View>(null);

  /* Built once and kept: reloading the page on every state change would throw
     away the recorded track drawn on it. */
  const url = `${API_BASE}/route-map${recording ? "?recording=1" : ""}`;
  const urlRef = useRef(url);

  const send = useCallback((message: unknown) => {
    const text = JSON.stringify(message);
    if (Platform.OS === "web") {
      try { frameRef.current?.contentWindow?.postMessage(text, "*"); } catch { /* cross-origin */ }
      return;
    }
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent("message",{data:${JSON.stringify(text)}}));true;`,
    );
  }, []);

  useEffect(() => {
    if (mapRef) mapRef.current = { send };
    return () => { if (mapRef) mapRef.current = null; };
  }, [mapRef, send]);

  /* Switching mode is a message, not a reload, so the track survives it. */
  useEffect(() => { send({ type: "recording", on: recording }); }, [recording, send]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return;
    const iframe = document.createElement("iframe");
    iframe.src = urlRef.current;
    iframe.style.cssText = "width:100%;height:100%;border:none;display:block;";
    iframe.allow = "geolocation";
    frameRef.current = iframe;
    host.appendChild(iframe);

    const listener = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data && typeof data === "object") onMessage?.(data as Record<string, unknown>);
      } catch { /* not ours */ }
    };
    window.addEventListener("message", listener);
    return () => {
      window.removeEventListener("message", listener);
      try { host.removeChild(iframe); } catch { /* already gone */ }
      frameRef.current = null;
    };
  }, [onMessage]);

  if (Platform.OS === "web") {
    return <View ref={hostRef} style={StyleSheet.absoluteFill} collapsable={false} />;
  }

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: urlRef.current }}
      style={StyleSheet.absoluteFill}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled
      geolocationEnabled
      allowsInlineMediaPlayback
      /* The page is our own server's; nothing here opens third-party URLs. */
      setSupportMultipleWindows={false}
      onMessage={event => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data && typeof data === "object") onMessage?.(data);
        } catch { /* not ours */ }
      }}
    />
  );
}
