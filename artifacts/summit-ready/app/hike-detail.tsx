import { ArrowLeft, Map, Clock, TrendingUp, TrendingDown, Gauge } from "lucide-react-native";
import React, { useMemo } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { T } from "@/constants/theme";
import { useApp } from "@/context/AppContext";

function buildMapHtml(points: Array<{ lat: number; lon: number }>): string {
  const coords = points.map(p => [p.lat, p.lon] as [number, number]);
  const centre = coords.length > 0 ? coords[Math.floor(coords.length / 2)] : [54.0, -2.0] as [number, number];
  const zoom = coords.length > 1 ? 13 : 6;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#map{height:100%;background:#050D1A}
.leaflet-control-zoom a{background:rgba(20,20,20,0.88)!important;color:#fff!important;border-color:rgba(255,255,255,0.15)!important}
.leaflet-control-attribution{font-size:9px!important;background:rgba(0,0,0,0.55)!important;color:rgba(255,255,255,0.4)!important}
.leaflet-control-attribution a{color:rgba(255,255,255,0.35)!important}
</style>
</head>
<body>
<div id="map"></div>
<script>
var map = L.map("map",{zoomControl:true,attributionControl:true}).setView(${JSON.stringify(centre)},${zoom});
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
  maxZoom:20,
  attribution:"&copy; OpenStreetMap contributors",
  subdomains:"abc"
}).addTo(map);
var coords=${JSON.stringify(coords)};
if(coords.length>1){
  var line=L.polyline(coords,{color:"#3ECF75",weight:4,opacity:0.9}).addTo(map);
  map.fitBounds(line.getBounds(),{padding:[24,24]});
  L.circleMarker(coords[0],{radius:7,color:"#3ECF75",fillColor:"#3ECF75",fillOpacity:1,weight:2}).addTo(map);
  L.circleMarker(coords[coords.length-1],{radius:7,color:"#FF4444",fillColor:"#FF4444",fillOpacity:1,weight:2}).addTo(map);
}
</script>
</body>
</html>`;
}

function StatCell({ icon, value, label, color }: {
  icon: React.ReactNode;
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <View style={s.statCell}>
      <View style={[s.statIcon, { backgroundColor: (color ?? T.green) + "18" }]}>
        {icon}
      </View>
      <Text style={[s.statVal, color ? { color } : {}]}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}

export default function HikeDetail() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { exploreHikes } = useApp();

  const hike = useMemo(() => exploreHikes.find(h => h.id === id), [exploreHikes, id]);

  if (!hike) {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: T.textMuted, fontSize: 15 }}>Hike not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: T.green, fontSize: 14 }}>Go back</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  const hasRoute = (hike.trackPoints?.length ?? 0) > 1;
  const mapHtml = hasRoute ? buildMapHtml(hike.trackPoints!) : null;

  const dateStr = new Date(hike.date).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const avgPaceMin = hike.distance > 0 ? hike.timeTaken / hike.distance : 0;
  const paceStr = avgPaceMin > 0
    ? `${Math.floor(avgPaceMin)}:${String(Math.round((avgPaceMin % 1) * 60)).padStart(2, "0")}/km`
    : "—";

  const hrs = Math.floor(hike.timeTaken / 60);
  const mins = hike.timeTaken % 60;
  const durationStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: Platform.OS === "web" ? 60 : insets.top + 20, paddingBottom: 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(0).duration(500)} style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
            <ArrowLeft size={20} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={s.title} numberOfLines={2}>{hike.name}</Text>
            <Text style={s.date}>{dateStr}</Text>
          </View>
        </Animated.View>

        {/* Stats row */}
        <Animated.View entering={FadeInDown.delay(60).duration(500)} style={s.statsCard}>
          <StatCell
            icon={<Map size={14} color={T.green} />}
            value={`${hike.distance} km`}
            label="Distance"
            color={T.green}
          />
          <View style={s.divider} />
          <StatCell
            icon={<TrendingUp size={14} color={T.orange} />}
            value={`${hike.elevationGain} m`}
            label="Elev gain"
            color={T.orange}
          />
          <View style={s.divider} />
          <StatCell
            icon={<Clock size={14} color={T.blue} />}
            value={durationStr}
            label="Duration"
            color={T.blue}
          />
          <View style={s.divider} />
          <StatCell
            icon={<Gauge size={14} color={T.purple} />}
            value={paceStr}
            label="Avg pace"
            color={T.purple}
          />
        </Animated.View>

        {/* Map */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Text style={s.sectionTitle}>Route</Text>
          {hasRoute ? (
            <View style={s.mapContainer}>
              <WebView
                source={{ html: mapHtml! }}
                style={s.map}
                scrollEnabled={false}
                javaScriptEnabled
                originWhitelist={["*"]}
                allowsInlineMediaPlayback
              />
            </View>
          ) : (
            <View style={[s.mapContainer, s.mapEmpty]}>
              <Map size={28} color={T.textDim} />
              <Text style={s.mapEmptyTitle}>No route recorded</Text>
              <Text style={s.mapEmptyBody}>
                {hike.notes?.startsWith("GPS tracked") ? "Route data wasn't saved for this hike." : "This session was logged manually — track a hike to see the route."}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Notes */}
        {!!hike.notes && (
          <Animated.View entering={FadeInDown.delay(140).duration(500)} style={s.notesCard}>
            <Text style={s.notesLabel}>Notes</Text>
            <Text style={s.notesText}>{hike.notes}</Text>
          </Animated.View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  backBtn: { padding: 4, marginTop: 2 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.text, lineHeight: 28 },
  date: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },
  statsCard: {
    flexDirection: "row", backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.border, padding: 14,
    alignItems: "center",
  },
  statCell: { flex: 1, alignItems: "center", gap: 5 },
  statIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  statVal: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.text },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted },
  divider: { width: 1, height: 36, backgroundColor: T.border },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.text, marginBottom: 10 },
  mapContainer: {
    height: 280, borderRadius: 16, overflow: "hidden",
    borderWidth: 1, borderColor: T.border,
  },
  map: { flex: 1, backgroundColor: "#050D1A" },
  mapEmpty: {
    alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: T.card, padding: 32,
  },
  mapEmptyTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.text },
  mapEmptyBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" },
  notesCard: {
    backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.border,
    padding: 14, gap: 6,
  },
  notesLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textDim, letterSpacing: 0.8 },
  notesText: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 20 },
});
