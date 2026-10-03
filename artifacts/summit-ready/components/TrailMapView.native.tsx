import React, { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { OsMapTiles } from "@/components/OsMapTiles.native";
import type { RoutePoint } from "@/utils/offRoute";
import { CAPABILITIES } from "@/constants/capabilities";
import { T } from "@/constants/theme";
import type { Trail, TrailDifficulty } from "@/constants/trailData";

export type MappedTrail = Trail & { lat: number; lng: number };

function getDifficultyColor(difficulty: TrailDifficulty): string {
  if (difficulty === "Easy") return T.green;
  if (difficulty === "Moderate") return "#4a9eff";
  return "#ff7043";
}

export interface TrailMapViewProps {
  trails: MappedTrail[];
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null;
  onPressTrail: (trail: MappedTrail) => void;
  routePoints?: readonly RoutePoint[];
}

export function TrailMapView({ trails, region, onPressTrail, routePoints }: TrailMapViewProps) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (region && mapRef.current) {
      mapRef.current.animateToRegion(region, 600);
    }
  }, [region?.latitude, region?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!region) {
    return (
      <View style={s.placeholder}>
        <ActivityIndicator size="large" color={T.green} />
        <Text style={s.placeholderText}>Locating trails…</Text>
      </View>
    );
  }

  return (
    <View style={s.map}>
    <MapView
      ref={mapRef}
      style={s.map}
      initialRegion={region}
      provider={PROVIDER_DEFAULT}
      showsUserLocation
      showsCompass={false}
    >
      <OsMapTiles />
      {routePoints?.length ? <Polyline coordinates={[...routePoints]} strokeColor={T.green} strokeWidth={3} /> : null}
      {trails.map((trail) => (
        <Marker
          key={trail.id}
          coordinate={{ latitude: trail.lat, longitude: trail.lng }}
          onPress={() => onPressTrail(trail)}
        >
          <View style={[
            s.markerPin,
            { borderColor: getDifficultyColor(trail.difficulty) },
          ]}>
            <Text style={s.markerEmoji}>{trail.emoji}</Text>
          </View>
        </Marker>
      ))}
    </MapView>
    {(__DEV__ || CAPABILITIES.routeOfflineDownload) ? (
      <View pointerEvents="none" style={s.attribution}>
        <Text style={s.attributionText}>OS Outdoor · © Crown copyright and database rights {new Date().getFullYear()} Ordnance Survey</Text>
      </View>
    ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  map: { flex: 1 },
  attribution: { position: "absolute", bottom: 4, left: 4, right: 4, backgroundColor: T.card, padding: 3 },
  attributionText: { fontSize: 9, color: T.textMuted },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  placeholderText: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted },
  markerPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.card,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  markerEmoji: { fontSize: 16 },
});
