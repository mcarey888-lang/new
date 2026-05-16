import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { T } from "@/constants/theme";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

interface Coord { lat: number; lng: number }
interface RouteData {
  coords: Coord[];
  center: { lat: number; lng: number } | null;
  found: boolean;
}
interface TrailMapProps {
  landmarkName: string;
  trailLocation: string;
  difficultyColor: string;
}

// Singleton CDN loader — only fetches Leaflet once per page session
let leafletPromise: Promise<void> | null = null;
function loadLeaflet(): Promise<void> {
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise<void>((resolve) => {
    if ((window as unknown as Record<string, unknown>)["L"]) { resolve(); return; }

    const cssId = "leaflet-css-194";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => resolve();
    script.onerror = () => { leafletPromise = null; resolve(); };
    document.head.appendChild(script);
  });
  return leafletPromise;
}

export function TrailMap({ landmarkName, trailLocation, difficultyColor }: TrailMapProps) {
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const divRef = useRef<unknown>(null);
  const mapRef = useRef<unknown>(null);

  // Fetch route data from API
  useEffect(() => {
    let cancelled = false;
    setRouteData(null);
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/trail-route`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: landmarkName, location: trailLocation }),
        });
        if (res.ok) {
          const data = await res.json() as RouteData;
          if (!cancelled) setRouteData(data);
        }
      } catch { /* fall through */ }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [landmarkName, trailLocation]);

  // Initialise Leaflet once route data arrives and the div is in the DOM
  useEffect(() => {
    if (loading || !divRef.current) return;

    const el = divRef.current as HTMLDivElement;
    const center = routeData?.center ?? { lat: 54.0, lng: -2.0 };

    loadLeaflet().then(() => {
      // Leaflet loaded from CDN — use any to avoid installing the package
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (window as any).L as any;
      if (!L || !el) return;

      // Destroy previous instance if switching trails
      if (mapRef.current) {
        try { (mapRef.current as { remove(): void }).remove(); } catch { /* ignore */ }
        mapRef.current = null;
      }

      const map = L.map(el, { zoomControl: true, attributionControl: false })
        .setView([center.lat, center.lng], 12);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
      }).addTo(map);

      // Tiny OSM attribution
      L.control.attribution({ prefix: "" })
        .addAttribution('<a href="https://openstreetmap.org">© OSM</a>')
        .addTo(map);

      if (routeData?.found && routeData.coords.length > 1) {
        const latlngs = routeData.coords.map(c => [c.lat, c.lng] as [number, number]);

        L.polyline(latlngs, {
          color: difficultyColor,
          weight: 4.5,
          opacity: 0.9,
        }).addTo(map);

        // Start marker
        L.circleMarker(latlngs[0], {
          radius: 7,
          fillColor: difficultyColor,
          color: "#ffffff",
          weight: 2.5,
          fillOpacity: 1,
        }).bindPopup("Start").addTo(map);

        map.fitBounds(L.latLngBounds(latlngs), { padding: [28, 28] });
      }

      // Ensure Leaflet picks up the container dimensions correctly
      setTimeout(() => { try { map.invalidateSize(); } catch { /* ignore */ } }, 50);
    });

    return () => {
      if (mapRef.current) {
        try { (mapRef.current as { remove(): void }).remove(); } catch { /* ignore */ }
        mapRef.current = null;
      }
    };
  }, [loading, routeData, difficultyColor]);

  return (
    <View style={s.outer}>
      {loading ? (
        <View style={s.loading}>
          <ActivityIndicator color={T.green} />
          <Text style={s.text}>Loading route from OpenStreetMap…</Text>
        </View>
      ) : (
        // In react-native-web, View renders as <div> and ref gives the DOM element
        <View ref={divRef as React.Ref<View>} style={StyleSheet.absoluteFill} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  outer: {
    height: 240,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
    position: "relative",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  text: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
  },
});
