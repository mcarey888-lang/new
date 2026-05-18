import React, { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
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
}

export function TrailMapView({ trails, region, onPressTrail }: TrailMapViewProps) {
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
    <MapView
      ref={mapRef}
      style={s.map}
      initialRegion={region}
      showsUserLocation
      showsCompass={false}
    >
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
  );
}

const s = StyleSheet.create({
  map: { flex: 1 },
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
