import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface Coord { lat: number; lng: number }

// ── Geocoding (same region-only strategy as trail-map-image) ─────────────────

const locationCache = new Map<string, Coord>();

const UK_REGIONS: Record<string, Coord> = {
  "lake district":    { lat: 54.461, lng: -3.073 },
  "peak district":    { lat: 53.363, lng: -1.822 },
  "snowdonia":        { lat: 53.068, lng: -4.076 },
  "yorkshire dales":  { lat: 54.228, lng: -2.147 },
  "brecon beacons":   { lat: 51.883, lng: -3.436 },
  "dartmoor":         { lat: 50.578, lng: -3.905 },
  "exmoor":           { lat: 51.139, lng: -3.648 },
  "cairngorms":       { lat: 57.122, lng: -3.616 },
  "ben nevis":        { lat: 56.797, lng: -5.004 },
  "glencoe":          { lat: 56.681, lng: -4.974 },
  "pennines":         { lat: 54.500, lng: -2.200 },
  "north york moors": { lat: 54.365, lng: -0.914 },
  "new forest":       { lat: 50.863, lng: -1.577 },
  "south downs":      { lat: 50.962, lng: -0.553 },
  "cotswolds":        { lat: 51.853, lng: -1.809 },
};

/** djb2 hash of s → float in [0, 1). Deterministic across restarts. */
function nameHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0) / 0x100000000;
}

/**
 * Offset the region centre by a deterministic amount derived from the trail
 * name (up to ±1.5 km per axis).  Guarantees a unique map position for every
 * trail even when multiple trails share the same geocoded town/region centre.
 */
function trailCenter(base: Coord, trailName: string): Coord {
  const h1 = nameHash(trailName);
  const h2 = nameHash(trailName + "\x01");
  const maxKm = 1.5;
  const dLat = (h1 * 2 - 1) * maxKm / 111.32;
  const dLng = (h2 * 2 - 1) * maxKm / (111.32 * Math.cos(base.lat * Math.PI / 180));
  return { lat: base.lat + dLat, lng: base.lng + dLng };
}

async function nominatimSearch(query: string): Promise<Coord | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SummitReady/1.0 (hiking training app)" },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { /* fall through */ }
  return null;
}

async function geocodeLocation(location: string): Promise<Coord> {
  const key = location.toLowerCase().trim();
  const cached = locationCache.get(key);
  if (cached) return cached;

  for (const [region, coord] of Object.entries(UK_REGIONS)) {
    if (key.includes(region)) {
      locationCache.set(key, coord);
      return coord;
    }
  }

  const coord = await nominatimSearch(location);
  const result = coord ?? { lat: 54.0, lng: -2.0 };
  locationCache.set(key, result);
  return result;
}

// ── Mapbox Directions route ───────────────────────────────────────────────────

function loopWaypoints(center: Coord, radiusKm: number): Array<[number, number]> {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  const angles = [90, 162, 234, 306, 18];
  const radii  = [1.0, 0.85, 1.1, 0.9, 1.05];
  const pts: Array<[number, number]> = [[center.lng, center.lat]];
  for (let i = 0; i < angles.length; i++) {
    const rad = (angles[i] * Math.PI) / 180;
    pts.push([
      center.lng + dLng * Math.sin(rad) * radii[i],
      center.lat + dLat * Math.cos(rad) * radii[i],
    ]);
  }
  pts.push([center.lng, center.lat]);
  return pts;
}

async function fetchMapboxRoute(
  center: Coord,
  radiusKm: number,
  token: string,
): Promise<Array<[number, number]> | null> {
  const waypoints = loopWaypoints(center, radiusKm);
  const coordStr = waypoints.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(";");
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/walking/${coordStr}` +
    `?geometries=geojson&overview=full&access_token=${token}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SummitReady/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      routes?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>;
    };
    const coords = data.routes?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    return coords;
  } catch { return null; }
}

/**
 * Calculate the loop radius from the actual trail distance when available.
 *
 * For a circular walking route Mapbox follows real paths, so the actual path
 * length is longer than the geometric perimeter (2πr). A path factor of ~1.35
 * accounts for road detours and terrain undulations:
 *
 *   actualDistance ≈ 2π × r × 1.35  →  r = distance / (2π × 1.35) ≈ distance / 8.48
 *
 * Clamped to [0.5, 3.5] km so the map zoom level stays sensible.
 */
function estimateRadiusKm(name: string, distanceKm?: number): number {
  if (distanceKm && distanceKm > 0) {
    return Math.min(3.5, Math.max(0.5, distanceKm / 8.48));
  }
  // Fallback: keyword estimate
  const n = name.toLowerCase();
  if (n.includes("horseshoe") || n.includes("ridge") || n.includes("traverse")) return 2.2;
  if (n.includes("great") || n.includes("long") || n.includes("fell")) return 2.0;
  if (n.includes("summit") || n.includes("mountain") || n.includes("munro")) return 1.8;
  if (n.includes("circular") || n.includes("loop") || n.includes("circuit")) return 1.2;
  if (n.includes("easy") || n.includes("short") || n.includes("gentle")) return 0.8;
  return 1.2;
}

// ── HTML template ─────────────────────────────────────────────────────────────

function buildHtml(opts: {
  token: string;
  trailName: string;
  color: string;
  routeCoords: Array<[number, number]>;
  center: Coord;
  userLat: number | null;
  userLng: number | null;
}): string {
  const { token, trailName, color, routeCoords, center, userLat, userLng } = opts;
  const pinCenter = routeCoords.length > 0 ? routeCoords[0] : [center.lng, center.lat];
  const coordsJson = JSON.stringify(routeCoords);
  const safeTitle = trailName.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const jsName = JSON.stringify(trailName);
  const initLat = userLat !== null ? userLat.toFixed(6) : "null";
  const initLng = userLng !== null ? userLng.toFixed(6) : "null";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<title>${safeTitle}</title>
<link href="https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.css" rel="stylesheet"/>
<script src="https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;background:#111;overflow:hidden}
#map{position:absolute;inset:0}
.mapboxgl-ctrl-group{background:rgba(20,20,20,0.88)!important;border:1px solid rgba(255,255,255,0.1)!important;box-shadow:0 2px 8px rgba(0,0,0,0.4)!important}
.mapboxgl-ctrl-group button{filter:invert(1) brightness(0.9)}
.mapboxgl-ctrl-attrib{font-size:9px!important;background:rgba(0,0,0,0.55)!important;color:rgba(255,255,255,0.6)!important}
.mapboxgl-ctrl-attrib a{color:rgba(255,255,255,0.5)!important}
.trail-label{background:rgba(20,20,20,0.85);color:#fff;padding:6px 12px;border-radius:20px;font-family:-apple-system,sans-serif;font-size:13px;font-weight:600;border:1px solid rgba(255,255,255,0.15);white-space:nowrap;max-width:240px;overflow:hidden;text-overflow:ellipsis;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,0.4)}
.user-dot{width:18px;height:18px;border-radius:50%;background:#007AFF;border:3px solid #fff;box-shadow:0 0 0 2px rgba(0,122,255,0.35),0 2px 6px rgba(0,0,0,0.4)}
</style>
</head>
<body>
<div id="map"></div>
<script>
mapboxgl.accessToken=${JSON.stringify(token)};
var routeCoords=${coordsJson};
var color=${JSON.stringify("#" + color)};
var trailName=${jsName};
var pinLng=${pinCenter[0]};
var pinLat=${pinCenter[1]};
var mapCenter=[${center.lng},${center.lat}];

// Injected from native GPS via URL param or injectJavaScript
var initUserLat=${initLat};
var initUserLng=${initLng};

var map=new mapboxgl.Map({
  container:"map",
  style:"mapbox://styles/mapbox/outdoors-v12",
  center:mapCenter,
  zoom:12,
  attributionControl:true,
  logoPosition:"bottom-left"
});

map.addControl(new mapboxgl.NavigationControl({showCompass:true,showZoom:true}),"top-right");

// GeolocateControl — for live tracking after initial position shown
var geolocate=new mapboxgl.GeolocateControl({
  positionOptions:{enableHighAccuracy:true},
  trackUserLocation:true,
  showUserHeading:true
});
map.addControl(geolocate,"top-right");

// Native-injected user location dot
var userMarker=null;

function placeUserDot(lat,lng){
  var el=document.createElement("div");
  el.className="user-dot";
  if(userMarker){
    userMarker.setLngLat([lng,lat]);
  } else {
    userMarker=new mapboxgl.Marker({element:el,anchor:"center"})
      .setLngLat([lng,lat])
      .addTo(map);
  }
}

// Called by TrailMapModal.injectJavaScript when coords arrive after page load
window.updateUserLocation=function(lat,lng){
  placeUserDot(lat,lng);
};

map.on("load",function(){
  if(routeCoords&&routeCoords.length>1){
    map.addSource("route",{
      type:"geojson",
      data:{type:"Feature",properties:{},geometry:{type:"LineString",coordinates:routeCoords}}
    });
    map.addLayer({
      id:"route-outline",type:"line",source:"route",
      paint:{"line-color":"#fff","line-width":7,"line-opacity":0.45}
    });
    map.addLayer({
      id:"route-line",type:"line",source:"route",
      layout:{"line-cap":"round","line-join":"round"},
      paint:{"line-color":color,"line-width":5}
    });

    new mapboxgl.Marker({color:color,scale:1.1})
      .setLngLat([pinLng,pinLat])
      .setPopup(new mapboxgl.Popup({offset:28,closeButton:false}).setHTML("<b style='font-family:-apple-system,sans-serif'>"+trailName+"</b>"))
      .addTo(map);

    var bounds=routeCoords.reduce(function(b,c){return b.extend(c)},new mapboxgl.LngLatBounds(routeCoords[0],routeCoords[0]));
    map.fitBounds(bounds,{padding:{top:100,bottom:80,left:50,right:50},maxZoom:14,duration:800});
  }

  // Show native-provided GPS position immediately (no permission prompt needed)
  if(initUserLat!==null&&initUserLng!==null){
    placeUserDot(initUserLat,initUserLng);
  }

  // Also trigger the Mapbox GeolocateControl for live tracking
  // Wrapped in try/catch — silently skipped if WebView geolocation is unavailable
  setTimeout(function(){try{geolocate.trigger()}catch(e){}},1000);
});
</script>
</body>
</html>`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

router.get("/trail-map-web", async (req, res) => {
  const { name, location, color = "3ECF75", userLat, userLng, distance } = req.query as Record<string, string>;

  const token = process.env.MAPBOX_TOKEN;
  if (!token) { res.status(503).send("Mapbox token not configured"); return; }
  if (!name || name.trim().length < 2) { res.status(400).send("name required"); return; }

  const safeColor = color.replace(/[^0-9a-fA-F]/g, "").slice(0, 6) || "3ECF75";

  const parsedUserLat = userLat ? parseFloat(userLat) : null;
  const parsedUserLng = userLng ? parseFloat(userLng) : null;
  const validUserCoords =
    parsedUserLat !== null && parsedUserLng !== null &&
    isFinite(parsedUserLat) && isFinite(parsedUserLng) &&
    parsedUserLat >= -90 && parsedUserLat <= 90 &&
    parsedUserLng >= -180 && parsedUserLng <= 180;

  const distanceKm = distance ? parseFloat(distance) : undefined;

  // Geocode the region centre (cached per location string), then apply a
  // deterministic per-trail offset so every trail gets a unique map position.
  const base = await geocodeLocation(location || "United Kingdom");
  const center = trailCenter(base, name.trim());
  const radiusKm = estimateRadiusKm(name, isFinite(distanceKm ?? NaN) ? distanceKm : undefined);
  const routeCoords = await fetchMapboxRoute(center, radiusKm, token);

  const html = buildHtml({
    token,
    trailName: name.trim(),
    color: safeColor,
    routeCoords: routeCoords ?? [],
    center,
    userLat: validUserCoords ? parsedUserLat : null,
    userLng: validUserCoords ? parsedUserLng : null,
  });

  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store");
  res.send(html);
});

export default router;
