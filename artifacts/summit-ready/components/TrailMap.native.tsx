import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
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

export function TrailMap({ landmarkName, trailLocation, difficultyColor }: TrailMapProps) {
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <View style={s.placeholder}>
        <ActivityIndicator color={T.green} />
        <Text style={s.placeholderText}>Loading route from OpenStreetMap…</Text>
      </View>
    );
  }

  const center = routeData?.center;

  if (!center) {
    return (
      <View style={s.placeholder}>
        <Text style={s.placeholderText}>Route data unavailable</Text>
      </View>
    );
  }

  const hasRoute = routeData?.found && (routeData.coords?.length ?? 0) > 1;
  const latDelta = hasRoute ? 0.06 : 0.12;

  return (
    <View style={s.container}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: center.lat,
          longitude: center.lng,
          latitudeDelta: latDelta,
          longitudeDelta: latDelta * 1.5,
        }}
        mapType="terrain"
        showsCompass={false}
        showsScale
        showsUserLocation={false}
        toolbarEnabled={false}
      >
        {hasRoute && routeData && (
          <Polyline
            coordinates={routeData.coords.map(c => ({
              latitude: c.lat,
              longitude: c.lng,
            }))}
            strokeColor={difficultyColor}
            strokeWidth={3.5}
          />
        )}
        {hasRoute && routeData && routeData.coords.length > 0 && (
          <Marker
            coordinate={{
              latitude: routeData.coords[0].lat,
              longitude: routeData.coords[0].lng,
            }}
            title="Start"
            pinColor={difficultyColor}
          />
        )}
        {hasRoute && routeData && routeData.coords.length > 1 && (
          <Marker
            coordinate={{
              latitude: routeData.coords[routeData.coords.length - 1].lat,
              longitude: routeData.coords[routeData.coords.length - 1].lng,
            }}
            title="End"
            pinColor="#888"
          />
        )}
      </MapView>

      <View style={s.badge}>
        <Text style={s.badgeText}>
          {hasRoute ? "Route · OpenStreetMap" : "Area · OpenStreetMap"}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    height: 240,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: T.border,
  },
  placeholder: {
    height: 240,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  placeholderText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
  },
  badge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.85)",
  },
});
