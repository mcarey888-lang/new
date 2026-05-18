import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface Coord { lat: number; lng: number }

// ── Geocoding ─────────────────────────────────────────────────────────────────
// Used only when the AI did not return lat/lng for the trail.

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

function nameHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0) / 0x100000000;
}

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

// ── Mapbox walking route ──────────────────────────────────────────────────────
// Generates a realistic loop walk by routing between triangle waypoints using
// the Mapbox walking-directions engine, which follows actual OSM footpaths.
// No Overpass needed — Mapbox routing snaps waypoints to real paths.

function loopWaypoints(center: Coord, radiusKm: number): Array<[number, number]> {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  const angles = [0, 120, 240];
  const radii  = [1.0, 0.95, 1.05];
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

function estimateRadiusKm(name: string, distanceKm?: number): number {
  if (distanceKm && distanceKm > 0) {
    return Math.min(3.5, Math.max(0.5, distanceKm / 8.48));
  }
  const n = name.toLowerCase();
  if (n.includes("horseshoe") || n.includes("ridge") || n.includes("traverse")) return 2.2;
  if (n.includes("great") || n.includes("long") || n.includes("fell")) return 2.0;
  if (n.includes("summit") || n.includes("mountain") || n.includes("munro")) return 1.8;
  if (n.includes("circular") || n.includes("loop") || n.includes("circuit")) return 1.2;
  if (n.includes("easy") || n.includes("short") || n.includes("gentle")) return 0.8;
  return 1.2;
}

// ── HTML template (Leaflet + OS Maps raster tiles) ───────────────────────────
// Using Leaflet instead of Mapbox GL JS — Leaflet is purpose-built for raster
// tile layers, needs no token validation, and renders OS Maps tiles reliably.
// The Mapbox Directions route is generated server-side and passed as coordinates.

function buildHtml(opts: {
  token: string;
  osKey: string | undefined;
  trailName: string;
  color: string;
  routeCoords: Array<[number, number]>;
  center: Coord;
  userLat: number | null;
  userLng: number | null;
}): string {
  const { osKey, trailName, color, routeCoords, center, userLat, userLng } = opts;

  // Leaflet expects [lat, lng]; our coords are [lng, lat] from Mapbox Directions.
  const leafletCoords = routeCoords.map(([lng, lat]) => [lat, lng]);
  const coordsJson = JSON.stringify(leafletCoords);
  const safeTitle = trailName.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const jsName = JSON.stringify(trailName);
  const initLat = userLat !== null ? userLat.toFixed(6) : "null";
  const initLng = userLng !== null ? userLng.toFixed(6) : "null";
  const safeColor = "#" + color;

  // Tile source — OS Maps Outdoor when key is present, OSM fallback otherwise.
  const tileUrl = osKey
    ? `https://api.os.uk/maps/raster/v1/zxy/Outdoor_3857/{z}/{x}/{y}.png?key=${osKey}`
    : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const attribution = osKey
    ? "&copy; Crown copyright and database rights 2024 OS"
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<title>${safeTitle}</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;background:#1a1a1a;overflow:hidden}
#map{position:absolute;inset:0}
.leaflet-control-zoom a{background:rgba(20,20,20,0.88)!important;color:#fff!important;border-color:rgba(255,255,255,0.15)!important}
.leaflet-control-zoom a:hover{background:rgba(40,40,40,0.95)!important}
.leaflet-control-attribution{font-size:9px!important;background:rgba(0,0,0,0.55)!important;color:rgba(255,255,255,0.5)!important}
.leaflet-control-attribution a{color:rgba(255,255,255,0.4)!important}
.user-dot{width:18px;height:18px;border-radius:50%;background:#007AFF;border:3px solid #fff;box-shadow:0 0 0 3px rgba(0,122,255,0.3),0 2px 6px rgba(0,0,0,0.5)}
</style>
</head>
<body>
<div id="map"></div>
<script>
var routeCoords=${coordsJson};
var color=${JSON.stringify(safeColor)};
var trailName=${jsName};
var mapCenter=[${center.lat},${center.lng}];
var initUserLat=${initLat};
var initUserLng=${initLng};

var map=L.map("map",{zoomControl:true,attributionControl:true}).setView(mapCenter,13);

L.tileLayer(${JSON.stringify(tileUrl)},{
  maxZoom:20,
  attribution:${JSON.stringify(attribution)}
}).addTo(map);

var userMarker=null;

window.updateUserLocation=function(lat,lng){
  if(userMarker){
    userMarker.setLatLng([lat,lng]);
  } else {
    var el=document.createElement("div");
    el.className="user-dot";
    userMarker=L.marker([lat,lng],{
      icon:L.divIcon({className:"",html:el,iconSize:[18,18],iconAnchor:[9,9]})
    }).addTo(map);
  }
};

if(routeCoords&&routeCoords.length>1){
  // White outline for contrast against light OS map background
  L.polyline(routeCoords,{color:"#fff",weight:7,opacity:0.5,smoothFactor:1}).addTo(map);
  // Coloured route line
  var routeLine=L.polyline(routeCoords,{color:color,weight:5,opacity:0.95,smoothFactor:1}).addTo(map);

  // Start marker
  var startLatLng=routeCoords[0];
  L.circleMarker(startLatLng,{
    radius:7,fillColor:color,color:"#fff",weight:2,opacity:1,fillOpacity:1
  }).bindTooltip(trailName,{permanent:false,direction:"top"}).addTo(map);

  // Fit map to route with padding
  map.fitBounds(routeLine.getBounds(),{padding:[60,60],maxZoom:14});
}

if(initUserLat!==null&&initUserLng!==null){
  window.updateUserLocation(initUserLat,initUserLng);
}
</script>
</body>
</html>`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

router.get("/trail-map-web", async (req, res) => {
  const {
    name, location, color = "3ECF75",
    userLat, userLng,
    distance,
    trailLat, trailLng,
  } = req.query as Record<string, string>;

  const token = process.env.MAPBOX_TOKEN;
  if (!token) { res.status(503).send("Mapbox token not configured"); return; }
  if (!name || name.trim().length < 2) { res.status(400).send("name required"); return; }

  const osKey = process.env.OS_MAPS_KEY || undefined;
  const safeColor = color.replace(/[^0-9a-fA-F]/g, "").slice(0, 6) || "3ECF75";

  const parsedUserLat = userLat ? parseFloat(userLat) : null;
  const parsedUserLng = userLng ? parseFloat(userLng) : null;
  const validUserCoords =
    parsedUserLat !== null && parsedUserLng !== null &&
    isFinite(parsedUserLat) && isFinite(parsedUserLng) &&
    parsedUserLat >= -90 && parsedUserLat <= 90 &&
    parsedUserLng >= -180 && parsedUserLng <= 180;

  const distanceKm = distance ? parseFloat(distance) : undefined;
  const radiusKm = estimateRadiusKm(name, isFinite(distanceKm ?? NaN) ? distanceKm : undefined);

  // Use AI-provided trail coordinates as the routing centre when available —
  // this is far more accurate than geocoding the location string.
  let center: Coord;
  const parsedTrailLat = trailLat ? parseFloat(trailLat) : NaN;
  const parsedTrailLng = trailLng ? parseFloat(trailLng) : NaN;
  if (isFinite(parsedTrailLat) && isFinite(parsedTrailLng)) {
    center = { lat: parsedTrailLat, lng: parsedTrailLng };
  } else {
    const base = await geocodeLocation(location || "United Kingdom");
    center = trailCenter(base, name.trim());
  }

  // Mapbox walking directions follow real OSM footpaths — reliable and fast.
  const routeCoords = await fetchMapboxRoute(center, radiusKm, token);

  const html = buildHtml({
    token,
    osKey,
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
