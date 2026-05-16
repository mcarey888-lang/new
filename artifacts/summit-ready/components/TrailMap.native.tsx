import React, { useEffect, useRef, useState } from "react";
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
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

export function TrailMap({ landmarkName, trailLocation, difficultyColor, onInteractionStart, onInteractionEnd }: TrailMapProps) {
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<MapView>(null);

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

  const coordinates = hasRoute && routeData
    ? routeData.coords.map(c => ({ latitude: c.lat, longitude: c.lng }))
    : [];

  return (
    <View style={s.container}>
      {/* Touch intercept: disables parent ScrollView scrolling while the map is being used */}
      <View
        style={StyleSheet.absoluteFill}
        onTouchStart={() => onInteractionStart?.()}
        onTouchEnd={() => onInteractionEnd?.()}
        onTouchCancel={() => onInteractionEnd?.()}
        pointerEvents="box-none"
      />
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: center.lat,
          longitude: center.lng,
          latitudeDelta: latDelta,
          longitudeDelta: latDelta * 1.5,
        }}
        showsCompass={false}
        showsScale
        showsUserLocation={false}
        toolbarEnabled={false}
        onMapReady={() => {
          if (hasRoute && coordinates.length > 1) {
            mapRef.current?.fitToCoordinates(coordinates, {
              edgePadding: { top: 32, right: 32, bottom: 32, left: 32 },
              animated: false,
            });
          }
        }}
      >
        {hasRoute && coordinates.length > 0 && (
          <Polyline
            coordinates={coordinates}
            strokeColor={difficultyColor}
            strokeWidth={4}
            lineDashPattern={undefined}
          />
        )}
        {hasRoute && coordinates.length > 0 && (
          <Marker
            coordinate={coordinates[0]}
            title="Start"
            pinColor={difficultyColor}
          />
        )}
        {hasRoute && coordinates.length > 1 && (
          <Marker
            coordinate={coordinates[coordinates.length - 1]}
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
