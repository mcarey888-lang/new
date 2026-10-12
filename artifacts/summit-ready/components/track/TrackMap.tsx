import React, { useCallback, useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { activityApiBase as API_BASE } from "@/utils/activityAudience";

/**
 * The map, on the Track screen.
 *
 * The same page the route planner uses — `/api/route-map` — so layers, hill
 * search, saved routes and route drawing are the ones already built rather
 * than a second set that drifts. `recording` switches the page into its
 * walking chrome: search and drawing put away, layers and recentre kept.
 */

export interface TrackMapHandle {
  send(message: unknown): void;
}

interface Props {
  recording: boolean;
  onMessage?: (message: Record<string, unknown>) => void;
  onReady?: () => void;
  mapRef?: React.MutableRefObject<TrackMapHandle | null>;
}

export function TrackMap({ recording, onMessage, onReady, mapRef }: Props) {
  const webViewRef = useRef<WebView>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const hostRef = useRef<View>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const recordingRef = useRef(recording);
  recordingRef.current = recording;

  /* Built once and kept: reloading the page on every state change would throw
     away the recorded track drawn on it. */
  // A shared-host identity also avoids reusing a fresh cached legacy wrapper page.
  // Do not disable tile/asset caching: only the application-page URL changes.
  const url = `${API_BASE}/route-map${recording ? "?recording=1&host=shared-track" : "?host=shared-track"}`;
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

  const receive = useCallback((data: Record<string, unknown>) => {
    if (data.type === "ready") {
      // Replay the latest mode after style/page loading, not a lost early message.
      // An initially normal map may now be drawing a route. Reasserting false
      // would reopen its search UI over the drawing toolbar on a layer change.
      if (recordingRef.current || urlRef.current.includes("recording=1")) {
        send({ type: "recording", on: recordingRef.current });
      }
      onReadyRef.current?.();
    }
    onMessageRef.current?.(data);
  }, [send]);

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
      if (event.source !== iframe.contentWindow) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data && typeof data === "object") receive(data as Record<string, unknown>);
      } catch { /* not ours */ }
    };
    window.addEventListener("message", listener);
    return () => {
      window.removeEventListener("message", listener);
      try { host.removeChild(iframe); } catch { /* already gone */ }
      frameRef.current = null;
    };
  }, [receive]);

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
          if (data && typeof data === "object") receive(data);
        } catch { /* not ours */ }
      }}
    />
  );
}
