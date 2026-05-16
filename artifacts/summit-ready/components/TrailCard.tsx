import { Bookmark, CheckCircle, Clock, MapPin, TrendingUp } from "lucide-react-native";
import React, { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { T } from "@/constants/theme";
import type { Trail, TrailDifficulty, TrailTerrain, TrailRouteType } from "@/constants/trailData";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const DIFF_COLOR: Record<TrailDifficulty, string> = {
  Easy: T.green,
  Moderate: T.blue,
  Hard: T.orange,
};

const TERRAIN_EMOJI: Record<TrailTerrain, string> = {
  woodland: "🌲",
  hill: "⛰️",
  mountain: "🏔️",
  coastal: "🌊",
  road: "🛣️",
  mixed: "🗺️",
};

const ROUTE_LABEL: Record<TrailRouteType, string> = {
  loop: "Loop",
  "out-and-back": "Out & back",
  "point-to-point": "Point-to-point",
};

interface Props {
  trail: Trail;
  isSaved?: boolean;
  isCompleted?: boolean;
  onPress: () => void;
  compact?: boolean;
}

export function TrailCard({ trail, isSaved, isCompleted, onPress, compact }: Props) {
  const dc = DIFF_COLOR[trail.difficulty];
  const [mapError, setMapError] = useState(false);

  const mapUri = mapError
    ? null
    : `${API_BASE}/trail-map-image?name=${encodeURIComponent(trail.name)}&location=${encodeURIComponent(trail.location)}&color=${dc.replace("#", "")}&width=600&height=200`;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.82} style={[s.card, compact && s.cardCompact]}>
      {isCompleted && <View style={s.completedBadge}><CheckCircle size={14} color={T.green} /></View>}

      {/* Static map thumbnail */}
      {!compact && (
        <View style={s.mapContainer}>
          {mapUri ? (
            <Image
              source={{ uri: mapUri }}
              style={s.mapImage}
              resizeMode="cover"
              onError={() => setMapError(true)}
            />
          ) : (
            <View style={[s.mapImage, s.mapFallback]}>
              <Text style={s.mapFallbackEmoji}>{trail.emoji}</Text>
            </View>
          )}
          <View style={[s.diffPill, { backgroundColor: dc }]}>
            <Text style={s.diffPillText}>{trail.difficulty}</Text>
          </View>
          {isSaved && (
            <View style={s.savedPill}>
              <Bookmark size={11} color={T.blue} fill={T.blue} />
            </View>
          )}
        </View>
      )}

      <View style={s.top}>
        {compact && (
          <View style={[s.iconBox, { backgroundColor: dc + "18" }]}>
            <Text style={s.emoji}>{trail.emoji}</Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={s.name} numberOfLines={1}>{trail.name}</Text>
            {trail.isCustom && (
              <View style={s.customBadge}><Text style={s.customBadgeText}>Custom</Text></View>
            )}
          </View>
          <Text style={s.location} numberOfLines={1}>{trail.location}</Text>
        </View>
        {compact && (
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <View style={[s.diffBadge, { backgroundColor: dc + "20" }]}>
              <Text style={[s.diffText, { color: dc }]}>{trail.difficulty}</Text>
            </View>
            {isSaved && <Bookmark size={13} color={T.blue} fill={T.blue} />}
          </View>
        )}
      </View>

      <View style={s.meta}>
        <Text style={s.metaTag}>{TERRAIN_EMOJI[trail.terrain]} {trail.terrain}</Text>
        <Text style={s.metaDot}>·</Text>
        <Text style={s.metaTag}>{ROUTE_LABEL[trail.routeType]}</Text>
      </View>

      {!compact && (
        <View style={s.stats}>
          <View style={s.stat}>
            <MapPin size={11} color={T.green} />
            <Text style={s.statVal}>{trail.distance}km</Text>
          </View>
          <View style={s.stat}>
            <TrendingUp size={11} color={T.orange} />
            <Text style={s.statVal}>{trail.elevationGain}m</Text>
          </View>
          <View style={s.stat}>
            <Clock size={11} color={T.purple} />
            <Text style={s.statVal}>{trail.estimatedTime}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border,
    overflow: "hidden",
  },
  cardCompact: { padding: 12, gap: 8 },
  completedBadge: { position: "absolute", top: 12, right: 12, zIndex: 2 },
  mapContainer: { position: "relative", width: "100%", height: 160 },
  mapImage: { width: "100%", height: 160 },
  mapFallback: { backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  mapFallbackEmoji: { fontSize: 40, opacity: 0.4 },
  diffPill: {
    position: "absolute", bottom: 10, left: 12,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7,
  },
  diffPillText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" },
  savedPill: {
    position: "absolute", bottom: 10, right: 12,
    backgroundColor: "rgba(0,0,0,0.5)", padding: 5, borderRadius: 8,
  },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 14, paddingTop: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  emoji: { fontSize: 17 },
  name: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text, flex: 1 },
  location: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, flexShrink: 0 },
  diffText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  customBadge: { backgroundColor: T.purpleDim, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  customBadgeText: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: T.purple },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14 },
  metaTag: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, textTransform: "capitalize" },
  metaDot: { fontSize: 11, color: T.textDim },
  stats: { flexDirection: "row", gap: 14, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 2 },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statVal: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.text },
});
