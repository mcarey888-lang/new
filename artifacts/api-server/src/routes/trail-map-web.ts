import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface Coord { lat: number; lng: number }

// ── Geocoding ─────────────────────────────────────────────────────────────────

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

// ── Pick zoom level based on trail distance ───────────────────────────────────

function pickZoom(distanceKm: number | undefined): number {
  if (!distanceKm || distanceKm <= 0) return 13;
  if (distanceKm > 20) return 12;
  if (distanceKm < 3)  return 14;
  return 13;
}

// ── HTML template — Leaflet + OS Maps Outdoor tiles only ─────────────────────
// No synthetic route overlay. OS Outdoor already draws every footpath,
// bridleway, summit, contour and stile — the user can read the actual terrain.

function buildHtml(opts: {
  osKey: string | undefined;
  apiOrigin: string;
  trailName: string;
  trailLocation: string;
  trailId: string;
  color: string;
  center: Coord;
  zoom: number;
  userLat: number | null;
  userLng: number | null;
}): string {
  const { osKey, apiOrigin, trailName, trailLocation, trailId, color, center, zoom, userLat, userLng } = opts;

  const safeTitle  = trailName.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const jsName     = JSON.stringify(trailName);
  const jsLocation = JSON.stringify(trailLocation);
  const initLat    = userLat !== null ? userLat.toFixed(6) : "null";
  const initLng    = userLng !== null ? userLng.toFixed(6) : "null";
  const safeColor  = "#" + color;

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
#loading{
  position:absolute;bottom:20px;left:50%;transform:translateX(-50%);
  background:rgba(0,0,0,0.65);color:rgba(255,255,255,0.8);
  font-family:system-ui,sans-serif;font-size:12px;padding:6px 14px;
  border-radius:20px;z-index:1000;pointer-events:none;white-space:nowrap;
}
#no-route{
  display:none;position:absolute;bottom:20px;left:50%;transform:translateX(-50%);
  background:rgba(15,15,15,0.88);border:1px solid rgba(255,255,255,0.12);
  font-family:system-ui,sans-serif;padding:12px 16px;border-radius:14px;
  z-index:1000;text-align:center;min-width:220px;
}
#no-route p{color:rgba(255,255,255,0.55);font-size:11px;margin-bottom:10px}
.ext-btn{
  display:inline-block;padding:7px 14px;border-radius:20px;font-size:12px;
  font-weight:600;text-decoration:none;color:#fff;margin:0 4px;
}
.btn-at{background:#3ddc84;color:#000}
.btn-km{background:#6ea8fe;color:#000}
.leaflet-control-zoom a{background:rgba(20,20,20,0.88)!important;color:#fff!important;border-color:rgba(255,255,255,0.15)!important}
.leaflet-control-zoom a:hover{background:rgba(40,40,40,0.95)!important}
.leaflet-control-attribution{font-size:9px!important;background:rgba(0,0,0,0.55)!important;color:rgba(255,255,255,0.5)!important}
.leaflet-control-attribution a{color:rgba(255,255,255,0.4)!important}
.user-dot{width:18px;height:18px;border-radius:50%;background:#007AFF;border:3px solid #fff;box-shadow:0 0 0 3px rgba(0,122,255,0.3),0 2px 6px rgba(0,0,0,0.5)}
</style>
</head>
<body>
<div id="map"></div>
<div id="loading">Loading route…</div>
<div id="no-route">
  <p>No route data — find it on:</p>
  <a id="btn-at" class="ext-btn btn-at" target="_blank" rel="noopener">AllTrails</a>
  <a id="btn-km" class="ext-btn btn-km" target="_blank" rel="noopener">Komoot</a>
</div>
<script>
var color=${JSON.stringify(safeColor)};
var trailName=${jsName};
var trailLocation=${jsLocation};
var trailId=${JSON.stringify(trailId)};
var mapCenter=[${center.lat.toFixed(6)},${center.lng.toFixed(6)}];
var initZoom=${zoom};
var initUserLat=${initLat};
var initUserLng=${initLng};

var map=L.map("map",{zoomControl:true,attributionControl:true}).setView(mapCenter,initZoom);

L.tileLayer(${JSON.stringify(tileUrl)},{
  maxZoom:20,
  attribution:${JSON.stringify(attribution)}
}).addTo(map);

// Fallback centre pin (replaced by route start once polyline loads)
var centerPin=L.circleMarker(mapCenter,{
  radius:8,fillColor:color,color:"#fff",weight:2.5,opacity:1,fillOpacity:1
}).bindTooltip(trailName,{permanent:false,direction:"top"}).addTo(map);

// ── Route display: OSM-backed trails get a polyline; others get external links ─
if(trailId&&trailId.startsWith("osm_")){
  // We have a seeded OSM trail — fetch and draw the route geometry
  document.getElementById("loading").style.display="block";
  var routeUrl=${JSON.stringify(apiOrigin + "/api/trail-route")};
  fetch(routeUrl,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({name:trailName,location:trailLocation,lat:mapCenter[0],lng:mapCenter[1],trailId:trailId})
  })
  .then(function(r){if(!r.ok){throw new Error("HTTP "+r.status);}return r.json();})
  .then(function(data){
    document.getElementById("loading").style.display="none";
    if(!data.found||!data.coords||data.coords.length<2){
      document.getElementById("loading").textContent="Route not found";
      document.getElementById("loading").style.display="block";
      setTimeout(function(){document.getElementById("loading").style.display="none";},2500);
      return;
    }
    var latlngs=data.coords.map(function(c){return[c.lat,c.lng];});
    L.polyline(latlngs,{color:"rgba(0,0,0,0.35)",weight:8,lineCap:"round",lineJoin:"round",interactive:false}).addTo(map);
    L.polyline(latlngs,{color:color,weight:4,opacity:0.92,lineCap:"round",lineJoin:"round",interactive:false}).addTo(map);
    L.circleMarker(latlngs[0],{radius:7,fillColor:"#fff",color:color,weight:3,opacity:1,fillOpacity:1}).bindTooltip("Start",{permanent:false,direction:"top"}).addTo(map);
    var s=latlngs[0],e=latlngs[latlngs.length-1];
    if(Math.sqrt((s[0]-e[0])*(s[0]-e[0])+(s[1]-e[1])*(s[1]-e[1]))>0.0005){
      L.circleMarker(e,{radius:7,fillColor:color,color:"#fff",weight:3,opacity:1,fillOpacity:1}).bindTooltip("End",{permanent:false,direction:"top"}).addTo(map);
    }
    map.removeLayer(centerPin);
    map.fitBounds(L.latLngBounds(latlngs),{padding:[32,32],maxZoom:15});
  })
  .catch(function(err){
    var el=document.getElementById("loading");
    el.textContent="Route error: "+(err&&err.message?err.message:"network");
    setTimeout(function(){el.style.display="none";},4000);
  });
} else {
  // No OSM route data — show the terrain map and external link buttons
  document.getElementById("loading").style.display="none";
  var q=encodeURIComponent(trailName);
  document.getElementById("btn-at").href="https://www.alltrails.com/search?q="+q;
  document.getElementById("btn-km").href="https://www.komoot.com/discover/walks-and-hikes?sport=hike&keywords="+q;
  document.getElementById("no-route").style.display="block";
}

// ── User location dot (updated from native via postMessage) ──────────────────
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
    trailId,
  } = req.query as Record<string, string>;

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

  // Resolve trail centre: prefer AI-provided coords over geocoding
  let center: Coord;
  const parsedTrailLat = trailLat ? parseFloat(trailLat) : NaN;
  const parsedTrailLng = trailLng ? parseFloat(trailLng) : NaN;
  if (isFinite(parsedTrailLat) && isFinite(parsedTrailLng)) {
    center = { lat: parsedTrailLat, lng: parsedTrailLng };
  } else {
    const base = await geocodeLocation(location || "United Kingdom");
    center = trailCenter(base, name.trim());
  }

  const zoom = pickZoom(isFinite(distanceKm ?? NaN) ? distanceKm : undefined);

  // Build absolute origin so the in-page fetch always resolves correctly,
  // regardless of WebView/iframe base-URL behaviour.
  // Replit's reverse proxy absorbs x-forwarded-* headers before they reach
  // the API process, so we derive the public domain from the env instead.
  const publicDomain =
    process.env.REPLIT_DOMAINS?.split(",")[0]?.trim() ||
    process.env.REPLIT_DEV_DOMAIN ||
    req.get("host") ||
    "localhost";
  const apiOrigin = `https://${publicDomain}`;

  const html = buildHtml({
    osKey,
    apiOrigin,
    trailName: name.trim(),
    trailLocation: (location ?? "").trim(),
    trailId: (trailId ?? "").trim(),
    color: safeColor,
    center,
    zoom,
    userLat: validUserCoords ? parsedUserLat : null,
    userLng: validUserCoords ? parsedUserLng : null,
  });

  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store");
  res.send(html);
});

export default router;
