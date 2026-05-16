import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Map, ExternalLink } from "lucide-react-native";
import { T } from "@/constants/theme";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

interface RouteData {
  coords: Array<{ lat: number; lng: number }>;
  center: { lat: number; lng: number } | null;
  found: boolean;
}

interface TrailMapProps {
  landmarkName: string;
  trailLocation: string;
  difficultyColor: string;
}

export function TrailMap({ landmarkName, trailLocation }: TrailMapProps) {
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

  const center = routeData?.center;

  function openOnOSM() {
    if (!center) return;
    const url = `https://www.openstreetmap.org/?mlat=${center.lat}&mlon=${center.lng}#map=13/${center.lat}/${center.lng}&layers=C`;
    Linking.openURL(url);
  }

  if (loading) {
    return (
      <View style={s.card}>
        <ActivityIndicator color={T.green} />
        <Text style={s.muted}>Loading route data…</Text>
      </View>
    );
  }

  return (
    <View style={s.card}>
      <Map size={28} color={T.textDim} />
      <Text style={s.title}>Interactive map on device</Text>
      <Text style={s.body}>
        {routeData?.found
          ? `Route found on OpenStreetMap for ${landmarkName}. Open on your phone to see the full interactive map with the trail highlighted.`
          : `Area map centred on ${trailLocation}. Open on your phone to see the interactive map.`}
      </Text>

      {center && (
        <TouchableOpacity style={s.btn} onPress={openOnOSM} activeOpacity={0.8}>
          <ExternalLink size={14} color={T.green} />
          <Text style={s.btnText}>View on OpenStreetMap</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    height: 200,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: T.textMuted,
    textAlign: "center",
  },
  body: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: T.textDim,
    textAlign: "center",
    lineHeight: 18,
  },
  muted: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.green + "40",
    backgroundColor: T.greenDim,
    marginTop: 4,
  },
  btnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: T.green,
  },
});
