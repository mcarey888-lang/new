import {
  Clock, Gauge, HardDrive, Map, Route, TrendingUp,
  CloudCheck,
} from "lucide-react-native";
import React, { useMemo } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { router, useLocalSearchParams } from "expo-router";
import { useApp } from "@/context/AppContext";
import { BASECAMP } from "@/constants/tokens";
import {
  SREmptyState, SRPanel, SRScreenHeader, SRSectionHeader, SRSubPanel,
} from "@/components/ui";
import { formatDuration, formatPace } from "@/utils/readinessEvidencePresentation";

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
html,body,#map{height:100%;background:#070E10}
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
  var line=L.polyline(coords,{color:"#24EFA4",weight:4,opacity:0.9}).addTo(map);
  map.fitBounds(line.getBounds(),{padding:[24,24]});
  L.circleMarker(coords[0],{radius:7,color:"#24EFA4",fillColor:"#24EFA4",fillOpacity:1,weight:2}).addTo(map);
  L.circleMarker(coords[coords.length-1],{radius:7,color:"#FF4444",fillColor:"#FF4444",fillOpacity:1,weight:2}).addTo(map);
}
</script>
</body>
</html>`;
}

/* One recorded figure with its label. A missing value is an em dash. */
function Stat({ icon, value, label }: {
  icon: React.ReactNode;
  value: string | null;
  label: string;
}) {
  return (
    <View style={s.statCell}>
      <View style={s.statHead}>
        {icon}
        <Text style={s.statLbl} numberOfLines={1}>{label}</Text>
      </View>
      <Text
        style={[s.statVal, value === null && { color: BASECAMP.textDim }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value ?? "—"}
      </Text>
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
      <View style={{ flex: 1, backgroundColor: BASECAMP.ink }}>
        <View style={{ paddingTop: Platform.OS === "web" ? 18 : insets.top + 8 }}>
          <SRScreenHeader title="Activity" onBack={() => router.back()} />
        </View>
        <View style={{ paddingHorizontal: BASECAMP.gutter, paddingTop: 30 }}>
          <SREmptyState
            testID="activity-not-found"
            title="This activity is no longer here"
            body="It may have been removed on another device. Your other activities are unaffected."
            action="Back to activity"
            onAction={() => router.replace("/(tabs)/log")}
          />
        </View>
      </View>
    );
  }

  const hasRoute = (hike.trackPoints?.length ?? 0) > 1;
  const mapHtml = hasRoute ? buildMapHtml(hike.trackPoints!) : null;

  const parsedDate = Date.parse(hike.date);
  const dateStr = Number.isFinite(parsedDate)
    ? new Date(parsedDate).toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : null;

  /* Every figure is the stored activity's own. A value the record does not
     carry shows an em dash — never a zero, and never a derived guess. */
  const paceStr = formatPace(hike.timeTaken, hike.distance);
  const durationStr = formatDuration(hike.timeTaken);
  const distanceStr = hike.distance > 0 ? `${Number(hike.distance.toFixed(1))} km` : null;
  const ascentStr = hike.elevationGain > 0
    ? `${Math.round(hike.elevationGain).toLocaleString()} m` : null;

  /* The recorder's own sync state, surfaced rather than assumed. A local-only
     activity is complete and counted; it simply has not left the device yet. */
  const sync = hike.syncState ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: BASECAMP.ink }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 40 : insets.bottom) + 44 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── The activity, over its own route ──────────────────────────
            The map is the activity's recorded track, so the hero is the
            evidence itself rather than stock photography. */}
        <View>
          <View style={{ paddingTop: Platform.OS === "web" ? 18 : insets.top + 8 }}>
            <SRScreenHeader
              title="Activity"
              subtitle={sync === "local_only" ? "Saved on this device" : null}
              onBack={() => router.back()}
            />
          </View>

          <View style={s.titleWrap}>
            <Text style={s.title} numberOfLines={3}>{hike.name}</Text>
            {dateStr ? <Text style={s.date}>{dateStr}</Text> : null}
          </View>
        </View>

        {/* ── The numbers ──────────────────────────────────────────── */}
        <View style={s.section}>
          <SRPanel radius={16}>
            <View style={s.statsGrid}>
              <Stat icon={<Route size={13} color={BASECAMP.accent} />} value={distanceStr} label="Distance" />
              <Stat icon={<TrendingUp size={13} color={BASECAMP.accent} />} value={ascentStr} label="Elevation gain" />
              <Stat icon={<Clock size={13} color={BASECAMP.accent} />} value={durationStr} label="Moving time" />
              <Stat icon={<Gauge size={13} color={BASECAMP.accent} />} value={paceStr} label="Average pace" />
            </View>
          </SRPanel>
        </View>

        {/* ── Route ────────────────────────────────────────────────── */}
        <View style={s.section}>
          <SRSectionHeader title="Route" />
          <View style={s.mapWrap}>
            {hasRoute ? (
              <WebView
                source={{ html: mapHtml! }}
                style={s.map}
                scrollEnabled={false}
                javaScriptEnabled
                originWhitelist={["*"]}
                allowsInlineMediaPlayback
              />
            ) : (
              <View style={s.mapEmpty}>
                <SREmptyState
                  testID="activity-no-route"
                  icon={<Map size={22} color={BASECAMP.textDim} />}
                  title="No route recorded"
                  body={
                    hike.notes?.startsWith("GPS tracked")
                      ? "Route data was not saved for this activity. Its distance and elevation still count."
                      : "This activity was logged manually. Track one with GPS to see the route here."
                  }
                />
              </View>
            )}
          </View>
        </View>

        {/* ── Notes ────────────────────────────────────────────────── */}
        {hike.notes ? (
          <View style={s.section}>
            <SRSectionHeader title="Notes" />
            <SRPanel radius={16} style={{ marginTop: 10 }}>
              <Text style={s.notesText}>{hike.notes}</Text>
            </SRPanel>
          </View>
        ) : null}

        {/* ── Where this activity lives ────────────────────────────────
            The canonical id and the recorder's sync state, stated plainly.
            Nothing here changes either. */}
        <View style={s.section}>
          <SRSubPanel style={s.syncRow}>
            {sync === "synced"
              ? <CloudCheck size={14} color={BASECAMP.accent} />
              : <HardDrive size={14} color={BASECAMP.textMuted} />}
            <Text style={s.syncText}>
              {sync === "synced"
                ? "Synced to your account."
                : sync === "queued"
                ? "Saved on this device and queued to sync."
                : "Saved on this device. It will sync when you are back in signal."}
            </Text>
          </SRSubPanel>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginTop: 18, paddingHorizontal: BASECAMP.gutter },

  titleWrap: { paddingHorizontal: BASECAMP.gutter, marginTop: 18 },
  title: {
    fontSize: 30, lineHeight: 34, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: -0.8,
  },
  date: {
    marginTop: 7, fontSize: 12.5, lineHeight: 17,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", padding: 14, rowGap: 16 },
  statCell: { flexGrow: 1, flexBasis: "50%", minWidth: 110, paddingRight: 10 },
  statHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  statVal: {
    marginTop: 5, fontSize: 19, lineHeight: 23,
    fontFamily: "Inter_700Bold", color: BASECAMP.text, letterSpacing: -0.4,
  },
  statLbl: { fontSize: 10, lineHeight: 13, fontFamily: "Inter_500Medium", color: BASECAMP.textDim },

  mapWrap: {
    marginTop: 10, height: 280, borderRadius: 16, overflow: "hidden",
    borderWidth: 1, borderColor: BASECAMP.panelBorder, backgroundColor: "#070E10",
  },
  map: { flex: 1, backgroundColor: "#070E10" },
  mapEmpty: { flex: 1, justifyContent: "center", paddingHorizontal: 20 },

  notesText: {
    padding: 14, fontSize: 13, lineHeight: 20,
    fontFamily: "Inter_400Regular", color: BASECAMP.textStrong,
  },

  syncRow: { flexDirection: "row", alignItems: "center", gap: 9, padding: 12 },
  syncText: {
    flex: 1, fontSize: 11, lineHeight: 15,
    fontFamily: "Inter_400Regular", color: BASECAMP.textMuted,
  },
});
