import React from "react";
import type { Trail } from "@/constants/trailData";

export type MappedTrail = Trail & { lat: number; lng: number };

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

export function TrailMapView(_props: TrailMapViewProps): React.ReactElement | null {
  return null;
}
