import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { TrailMapView } from "@/components/TrailMapView.native";
import { useOsDayMap, downloadOsRoute } from "@/hooks/useOsDayMap.native";
import { tilesForRoute, isFresh } from "@/utils/dayCache";
import { formatBytes } from "@/utils/offlineRegions";
import { mapReadiness, readinessMessage } from "@/utils/tileSource";
import type { RoutePoint } from "@/utils/offRoute";
import { EXPLORE, SP } from "@/constants/tokens";
import { T } from "@/constants/theme";
import { osRouteSupported } from "@/utils/osDayCacheStore";

export function OsRouteMaps({ points }: { points: readonly RoutePoint[] }) {
  const { lease, connectivity, error } = useOsDayMap();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), [points]);
  const supported = osRouteSupported(points);
  const needed = useMemo(() => supported ? tilesForRoute(points) : [], [points, supported]);
  const message = lease ? readinessMessage(mapReadiness(
    needed, lease.cache, Date.now(), connectivity, { fallbackAvailable: false },
  )) : connectivity === "offline"
    ? "No offline map for this route. The map will not work without a signal." : null;
  const region = useMemo(() => {
    if (!osRouteSupported(points)) return null;
    const lat = points.map(p => p.latitude), lng = points.map(p => p.longitude);
    const minLat = Math.min(...lat), maxLat = Math.max(...lat);
    const minLng = Math.min(...lng), maxLng = Math.max(...lng);
    return { latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(.01, (maxLat - minLat) * 1.3),
      longitudeDelta: Math.max(.01, (maxLng - minLng) * 1.3) };
  }, [points]);
  const download = async () => {
    if (busy || controller.current) return;
    controller.current = new AbortController();
    setBusy(true); setFailure(null);
    try { await downloadOsRoute(points, connectivity, undefined, controller.current.signal); }
    catch (e) { setFailure(e instanceof Error ? e.message : String(e)); }
    finally { controller.current = null; setBusy(false); }
  };
  const bytes = lease ? [...lease.cache.values()].filter(t => isFresh(t, Date.now())).reduce((n, t) => n + t.bytes, 0) : 0;
  if (!supported) return <Text style={s.text}>OS day-map downloads are limited to Great Britain.</Text>;
  return <View style={s.section} testID="os-route-map-readiness">
    {message ? <Text accessibilityRole="alert" style={s.notice}>{message}</Text> : null}
    {(failure || error) ? <Text accessibilityRole="alert" style={s.notice}>{failure || error}</Text> : null}
    <Text style={s.text}>Offline OS maps are not release-verified. Recording never waits for maps.</Text>
    {__DEV__ ? <>
      <Text style={s.text}>Development preview: OS Outdoor, not Explorer/Leisure. Saved maps expire within 22 hours. No permanent offline fallback is installed.</Text>
      <Pressable accessibilityRole="button" disabled={busy || connectivity === "offline"} onPress={download} style={s.button}>
        <Text style={s.action}>{busy ? "Downloading OS day maps…" : "Download OS day maps (development preview)"}</Text>
      </Pressable>
      {busy ? <Pressable accessibilityRole="button" onPress={() => controller.current?.abort()}>
        <Text style={s.action}>Cancel map download</Text>
      </Pressable> : null}
      <Text style={s.text}>Fresh downloaded tiles on this device: {formatBytes(bytes)}</Text>
      <Pressable accessibilityRole="button" onPress={() => setShow(v => !v)} style={s.button}>
        <Text style={s.action}>{show ? "Hide map preview" : "Show OS map preview"}</Text>
      </Pressable>
      {show ? <View style={s.map}>
        {lease && !error ? <TrailMapView trails={[]} region={region} routePoints={points} onPressTrail={() => {}} />
          : <Text style={s.text}>OS map unavailable while storage is being checked.</Text>}
      </View> : null}
      {show ? <Text style={s.text}>© Crown copyright and database rights {new Date().getFullYear()} Ordnance Survey. Native Apple/Google basemaps are not a permanent offline fallback.</Text> : null}
    </> : null}
  </View>;
}
const s = StyleSheet.create({
  section: { gap: SP.sm, marginTop: SP.md },
  text: { color: T.textMuted, fontSize: 12, lineHeight: 18 },
  notice: { color: EXPLORE.unverified, fontSize: 13, lineHeight: 20 },
  action: { color: EXPLORE.accent, fontSize: 13 },
  button: { paddingVertical: SP.sm },
  map: { height: 280, overflow: "hidden", borderRadius: 8 },
});