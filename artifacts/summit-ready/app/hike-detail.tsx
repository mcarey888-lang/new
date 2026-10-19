import {
  Clock, Gauge, HardDrive, Map, Route, TrendingUp,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
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
import { RecordedHikeRecoveryPanel } from "@/components/track/RecordedHikeRecoveryPanel";
import { RecordedTracePreview } from "@/components/track/RecordedTracePreview";
import { ActivityAudiencePicker } from "@/components/track/ActivityAudiencePicker";
import { recordedHikeElevationQuality } from "@/utils/elevationQuality";
import { exportRecordedGpx, shareRecordedRoute } from "@/utils/recordedHikeExport";
import { useAuth } from "@clerk/expo";
import { hasRecordedRoute, recordedHikeNotes, recordedMetricAvailability } from "@/utils/recordedHikePresentation";

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
  const { exploreHikes, updateExploreHike } = useApp();
  const { userId,getToken } = useAuth();
  const [showBasemap, setShowBasemap] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

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

  const hasRoute = hasRecordedRoute(hike.trackPoints);
  const notes = recordedHikeNotes(hike);
  const available = recordedMetricAvailability(hike);
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
  const distanceStr = available.distance ? `${Number(hike.distance.toFixed(1))} km` : null;
  const ascentStr = available.ascent
    ? `${Math.round(hike.elevationGain).toLocaleString()} m` : null;

  /* The recorder's own sync state, surfaced rather than assumed. A local-only
     activity is complete and counted; it simply has not left the device yet. */

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
              subtitle="Saved on this device"
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
          <SRPanel radius={8}>
            <View style={s.statsGrid}>
              <Stat icon={<Route size={13} color={BASECAMP.accent} />} value={distanceStr} label="Distance" />
              <Stat icon={<TrendingUp size={13} color={BASECAMP.accent} />} value={ascentStr} label="Elevation gain" />
              <Stat icon={<Clock size={13} color={BASECAMP.accent} />} value={durationStr} label="Recording time" />
              <Stat icon={<Gauge size={13} color={BASECAMP.accent} />} value={paceStr} label="Average pace" />
            </View>
          </SRPanel>
          <Text style={s.notesText}>{recordedHikeElevationQuality(hike).label}</Text>
          <ActivityAudiencePicker audience={hike.sharingIntentConfirmed ? hike.audience ?? null : null}
            error={detailError} onChange={audience => {
              void updateExploreHike(hike.id,{ audience, sharingIntentConfirmed:true })
                .then(()=>setDetailError(null)).catch(error=>setDetailError(error.message));
            }} />
          <Pressable accessibilityRole="button" disabled={!hasRoute}
            accessibilityState={{ disabled: !hasRoute }}
            style={{minHeight:48,padding:12,opacity:hasRoute ? 1 : 0.5}} onPress={() => {
              setExportError(null);
              void exportRecordedGpx(hike).catch(() =>
                setExportError("GPX could not be exported. Please try again."));
            }}>
            <Text style={s.notesText}>Export my recorded GPX</Text>
          </Pressable>
          {!hasRoute ? <Text style={s.notesText}>No recorded route to export as GPX.</Text> : null}
          {exportError ? <Text accessibilityRole="alert" style={s.notesText}>{exportError}</Text> : null}
          {hike.sharingIntentConfirmed && hike.audience !== "private" && userId ?
            <Pressable accessibilityRole="button" style={{minHeight:48,padding:12}} onPress={() =>
              void shareRecordedRoute(userId,hike.id,()=>getToken({skipCache:true})).catch(error=>setDetailError(error.message))}>
              <Text style={s.notesText}>Share member route link · recipient needs sign-in and access</Text>
            </Pressable> : null}
        </View>

        {/* ── Route ────────────────────────────────────────────────── */}
        <View style={s.section}>
          <SRSectionHeader title="Route" />
          <View style={s.mapWrap}>
            {hasRoute && showBasemap ? (Platform.OS === "web" ?
              <iframe title="Recorded hike basemap" srcDoc={mapHtml!} style={{border:0,width:"100%",height:"100%"}} /> :
              <WebView
                source={{ html: mapHtml! }}
                style={s.map}
                scrollEnabled={false}
                javaScriptEnabled
                originWhitelist={["*"]}
                allowsInlineMediaPlayback
                onError={() => {setShowBasemap(false);setDetailError("Basemap unavailable. Your recorded trace remains available offline.");}}
              />
            ) : hasRoute ? <RecordedTracePreview points={hike.trackPoints!} /> : (
              <View style={s.mapEmpty}>
                <SREmptyState
                  testID="activity-no-route"
                  icon={<Map size={22} color={BASECAMP.textDim} />}
                  title="No route recorded"
                  body={
                    notes.startsWith("Time-only recording")
                      ? "This is a time-only recording. No GPS track, measured distance or ascent was recorded."
                      : hike.activityId || hike.recordingDurationSeconds != null || hike.notes?.startsWith("GPS tracked")
                      ? "Route data was not saved for this activity. Its distance and elevation still count."
                      : "This activity was logged manually. Track one with GPS to see the route here."
                  }
                />
              </View>
            )}
          </View>
          {hasRoute ? <Pressable accessibilityRole="button" style={{minHeight:48,padding:12}} onPress={()=>setShowBasemap(v=>!v)}>
            <Text style={s.notesText}>{showBasemap?"Show offline trace":"Show online basemap (internet required)"}</Text>
          </Pressable> : null}
        </View>

        {/* ── Notes ────────────────────────────────────────────────── */}
        {notes ? (
          <View style={s.section}>
            <SRSectionHeader title="Notes" />
            <SRPanel radius={8} style={{ marginTop: 10 }}>
              <Text style={s.notesText}>{notes}</Text>
            </SRPanel>
          </View>
        ) : null}

        {/* ── Where this activity lives ────────────────────────────────
            The canonical id and the recorder's sync state, stated plainly.
            Nothing here changes either. */}
        <View style={s.section}>
          <SRSubPanel style={s.syncRow}>
            <HardDrive size={14} color={BASECAMP.textMuted} />
            <Text style={s.syncText}>
              Saved on this device. See private backup status below.
            </Text>
          </SRSubPanel>
        </View>
        <RecordedHikeRecoveryPanel hike={hike} />
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
    marginTop: 10, height: 280, borderRadius: 8, overflow: "hidden",
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
