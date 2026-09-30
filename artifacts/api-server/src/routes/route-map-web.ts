import { Router, type IRouter } from "express";

const router: IRouter = Router();

/**
 * The route planner's map surface, served into a WebView.
 *
 * A SEPARATE PAGE FROM `/hike-map`, DELIBERATELY. That one draws a live GPS
 * track during an activity and is on the offline-tracking path; this one is a
 * planning surface that takes taps and draws a route back. Sharing one page
 * would put planning changes on the tracking screen's critical path, so they
 * stay apart until someone decides otherwise.
 *
 * MAPLIBRE RATHER THAN LEAFLET, and it is the 3D that decides it. Leaflet is
 * strictly two-dimensional: there is no camera, no pitch and no terrain, so a
 * flyover cannot be built on it at all. MapLibre does raster basemaps, layer
 * switching AND terrain, which means one library rather than two.
 *
 * WHAT THE APP SENDS (postMessage, mirroring `/hike-map`'s vocabulary):
 *   {type:"route",  points:[{lat,lng}...]}  the line as the engine computed it
 *   {type:"marks",  points:[{lat,lng,kind}]} the tapped waypoints
 *   {type:"locate", lat, lng, zoom?}        move the camera
 *   {type:"layer",  id}                     switch basemap
 *   {type:"mode",   value:"2d"|"3d"}        flat or terrain
 *   {type:"flyover"}                        run the camera along the route
 *   {type:"clear"}
 *
 * WHAT THE PAGE SENDS BACK:
 *   {type:"tap", lat, lng}                  a map tap, for the snapping engine
 *   {type:"ready"}                          style loaded, safe to send state
 *   {type:"layerChanged", id}               the person used the on-map switcher
 *
 * The page never decides where a route goes. It reports taps and draws what it
 * is given; `utils/snapDrawing` owns every decision, so the two surfaces — this
 * and the native map — cannot disagree about a route.
 */

export interface BaseLayerSpec {
  id: string;
  label: string;
  tiles: string;
  attribution: string;
  maxZoom: number;
}

/**
 * Basemaps, in the order they appear in the switcher.
 *
 * OS first because it is the only one carrying rights of way, which is the
 * thing a UK hill route is planned against. OSM last as the layer that always
 * works: no key, no quota, and the fallback when OS tiles fail.
 */
export function baseLayers(osKey: string | undefined): BaseLayerSpec[] {
  const os = (layer: string, label: string): BaseLayerSpec | null =>
    osKey
      ? {
          id: layer,
          label,
          tiles: `https://api.os.uk/maps/raster/v1/zxy/${layer}/{z}/{x}/{y}.png?key=${osKey}`,
          attribution: "Contains OS data &copy; Crown copyright and database right",
          // 17 is confirmed against the live API; past a layer's maximum the
          // API returns blank tiles rather than an error.
          maxZoom: 17,
        }
      : null;

  return [
    os("Outdoor_3857", "OS Outdoor"),
    os("Light_3857", "OS Light"),
    os("Road_3857", "OS Road"),
    {
      id: "osm",
      label: "OpenStreetMap",
      tiles: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    },
  ].filter((l): l is BaseLayerSpec => l !== null);
}

/** Free global elevation, in terrarium encoding, which is what MapLibre reads. */
const TERRAIN_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const TERRAIN_ATTRIBUTION = "Elevation: Mapzen / AWS Terrain Tiles";

/**
 * `chrome: "none"` hides the page's own controls.
 *
 * Embedded in the app the screen supplies its own 2D/3D and Flyover buttons,
 * and showing both sets leaves two controls for one thing, disagreeing the
 * moment either is used. Opened directly in a browser the page has no host to
 * supply them, so it keeps its own.
 */
export function buildRouteMapHtml(
  osKey: string | undefined,
  chrome: "full" | "none" = "full",
): string {
  const layers = baseLayers(osKey);
  const initial = layers[0];

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<title>Plan a route</title>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"/>
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<style>
  html,body{margin:0;height:100%;background:#05090B;overflow:hidden}
  #map{position:absolute;inset:0}
  .maplibregl-ctrl-attrib{font-size:9px!important;background:rgba(0,0,0,0.55)!important}
  .maplibregl-ctrl-attrib a{color:rgba(255,255,255,0.45)!important}
  .panel{
    position:absolute;top:10px;right:10px;z-index:3;display:flex;flex-direction:column;gap:7px;
    font:600 11px/1 -apple-system,system-ui,sans-serif;
  }
  .panel button{
    min-width:112px;padding:9px 11px;border-radius:9px;cursor:pointer;text-align:left;
    background:rgba(11,20,24,.86);color:rgba(255,255,255,.72);
    border:1px solid rgba(255,255,255,.12);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);
  }
  .panel button[aria-pressed="true"]{background:#167DF7;color:#fff;border-color:transparent}
  .modes{display:flex;gap:5px}
  .modes button{min-width:0;flex:1;text-align:center}
  #fly{background:rgba(36,239,164,.16);color:#24EFA4;border-color:rgba(36,239,164,.45)}
  #fly[disabled]{opacity:.4;cursor:default}
  ${chrome === "none" ? ".panel{display:none}" : ""}
</style>
</head>
<body>
<div id="map"></div>
<div class="panel">
  <div class="modes">
    <button id="m2d" aria-pressed="true">2D</button>
    <button id="m3d" aria-pressed="false">3D</button>
  </div>
  ${layers
    .map(
      l =>
        `<button class="layer" data-layer="${l.id}" aria-pressed="${
          l.id === initial.id ? "true" : "false"
        }">${l.label}</button>`,
    )
    .join("")}
  <button id="fly" disabled>Flyover</button>
</div>
<script>
var LAYERS = ${JSON.stringify(layers)};
var TERRAIN = ${JSON.stringify(TERRAIN_TILES)};
var ROUTE_COLOR = "#167DF7";
var ASSERTED_COLOR = "#E9B949";

function post(msg) {
  var s = JSON.stringify(msg);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
  else if (window.parent !== window) window.parent.postMessage(s, "*");
}

/* Every basemap is declared up front and toggled by visibility. Swapping the
   whole style instead would drop the route and the terrain with it, and the
   line would blink on every layer change. */
var sources = { terrain: {
  type: "raster-dem", tiles: [TERRAIN], encoding: "terrarium",
  tileSize: 256, maxzoom: 14, attribution: ${JSON.stringify(TERRAIN_ATTRIBUTION)}
} };
var styleLayers = [{ id: "bg", type: "background", paint: { "background-color": "#0B1418" } }];
LAYERS.forEach(function (l, i) {
  sources["base-" + l.id] = {
    type: "raster", tiles: [l.tiles], tileSize: 256,
    maxzoom: l.maxZoom, attribution: l.attribution
  };
  styleLayers.push({
    id: "base-" + l.id, type: "raster", source: "base-" + l.id,
    layout: { visibility: i === 0 ? "visible" : "none" }
  });
});
/* Hillshade sits above the basemap and below the route. In 2D it is hidden:
   OS sheets already carry their own relief, and doubling it muddies them. */
styleLayers.push({
  id: "hillshade", type: "hillshade", source: "terrain",
  layout: { visibility: "none" },
  paint: { "hillshade-exaggeration": 0.45 }
});

var map = new maplibregl.Map({
  container: "map",
  style: { version: 8, sources: sources, layers: styleLayers },
  center: [-3.9976, 53.1149], zoom: 13, pitch: 0, bearing: 0,
  attributionControl: { compact: true }
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");

var activeLayer = ${JSON.stringify(initial.id)};
var mode = "2d";
var routePts = [];

/* OS tiles can fail — a wrong key, an expired plan, no signal. Rather than
   leave a blank map, count errors and fall back to OpenStreetMap, which needs
   no key. Mirrors what /hike-map already does. */
var osErrors = {};
map.on("error", function (e) {
  var id = e && e.sourceId;
  if (!id || id.indexOf("base-") !== 0) return;
  var layerId = id.slice(5);
  if (layerId === "osm") return;
  osErrors[layerId] = (osErrors[layerId] || 0) + 1;
  if (osErrors[layerId] === 4 && activeLayer === layerId) {
    setLayer("osm");
    post({ type: "layerChanged", id: "osm", reason: "tiles_failed" });
  }
});

function setLayer(id) {
  LAYERS.forEach(function (l) {
    map.setLayoutProperty("base-" + l.id, "visibility", l.id === id ? "visible" : "none");
  });
  activeLayer = id;
  Array.prototype.forEach.call(document.querySelectorAll(".layer"), function (b) {
    b.setAttribute("aria-pressed", String(b.dataset.layer === id));
  });
}

function setMode(next) {
  mode = next;
  document.getElementById("m2d").setAttribute("aria-pressed", String(next === "2d"));
  document.getElementById("m3d").setAttribute("aria-pressed", String(next === "3d"));
  if (next === "3d") {
    map.setTerrain({ source: "terrain", exaggeration: 1.4 });
    map.setLayoutProperty("hillshade", "visibility", "visible");
    map.easeTo({ pitch: 62, duration: 900 });
  } else {
    map.setTerrain(null);
    map.setLayoutProperty("hillshade", "visibility", "none");
    map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
  }
  document.getElementById("fly").disabled = !(next === "3d" && routePts.length > 1);
}

map.on("load", function () {
  map.addSource("route", { type: "geojson", data: empty() });
  map.addSource("asserted", { type: "geojson", data: empty() });
  map.addSource("marks", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

  // A dark casing under the line, so it reads over pale OS paper and dark rock alike.
  map.addLayer({ id: "route-casing", type: "line", source: "route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#05090B", "line-width": 9, "line-opacity": 0.55 } });
  map.addLayer({ id: "route-line", type: "line", source: "route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ROUTE_COLOR, "line-width": 5 } });
  map.addLayer({ id: "asserted-line", type: "line", source: "asserted",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ASSERTED_COLOR, "line-width": 4, "line-dasharray": [2, 1.6] } });
  map.addLayer({ id: "mark-dots", type: "circle", source: "marks",
    paint: {
      "circle-radius": ["case", ["==", ["get", "kind"], "first"], 7, 5.5],
      "circle-color": ["case", ["==", ["get", "kind"], "warn"], ASSERTED_COLOR, ROUTE_COLOR],
      "circle-stroke-color": "#05090B", "circle-stroke-width": 2
    } });

  map.on("click", function (e) {
    post({ type: "tap", lat: e.lngLat.lat, lng: e.lngLat.lng });
  });

  post({ type: "ready" });
});

function empty() {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } };
}
function line(points) {
  return { type: "Feature", properties: {},
    geometry: { type: "LineString", coordinates: points.map(function (p) { return [p.lng, p.lat]; }) } };
}

/**
 * Fly the camera along the route.
 *
 * Stepped easeTo rather than one flyTo: a single call takes a great-circle arc
 * between two points and ignores everything between, which on a mountain route
 * is the entire point. Each leg also faces the next, so the camera turns the
 * way a walker would.
 */
var flying = false;
function flyover() {
  if (flying || routePts.length < 2) return;
  flying = true;
  var i = 0;
  function leg() {
    if (i >= routePts.length) {
      flying = false;
      map.easeTo({ pitch: 62, duration: 1200 });
      return;
    }
    var p = routePts[i];
    var next = routePts[Math.min(i + 1, routePts.length - 1)];
    var bearing = Math.atan2(next.lng - p.lng, next.lat - p.lat) * 180 / Math.PI;
    map.easeTo({
      center: [p.lng, p.lat], zoom: 15.4, pitch: 74, bearing: bearing,
      duration: i === 0 ? 1400 : 900, essential: true
    });
    i += Math.max(1, Math.round(routePts.length / 12));
    setTimeout(leg, i === 0 ? 1400 : 900);
  }
  leg();
}

function handleMsg(ev) {
  var msg;
  try { msg = JSON.parse(ev.data); } catch (err) { return; }
  if (!msg || !msg.type) return;

  if (msg.type === "route" && Array.isArray(msg.points)) {
    routePts = msg.points;
    map.getSource("route").setData(line(msg.points));
    document.getElementById("fly").disabled = !(mode === "3d" && routePts.length > 1);
  }
  if (msg.type === "asserted" && Array.isArray(msg.points)) {
    map.getSource("asserted").setData(line(msg.points));
  }
  if (msg.type === "marks" && Array.isArray(msg.points)) {
    map.getSource("marks").setData({ type: "FeatureCollection", features: msg.points.map(function (p) {
      return { type: "Feature", properties: { kind: p.kind || "point" },
        geometry: { type: "Point", coordinates: [p.lng, p.lat] } };
    }) });
  }
  if (msg.type === "locate") {
    map.easeTo({ center: [msg.lng, msg.lat], zoom: msg.zoom || 14, duration: 600 });
  }
  if (msg.type === "layer") setLayer(msg.id);
  if (msg.type === "mode") setMode(msg.value === "3d" ? "3d" : "2d");
  if (msg.type === "flyover") flyover();
  if (msg.type === "clear") {
    routePts = [];
    map.getSource("route").setData(empty());
    map.getSource("asserted").setData(empty());
    map.getSource("marks").setData({ type: "FeatureCollection", features: [] });
    document.getElementById("fly").disabled = true;
  }
}
document.addEventListener("message", handleMsg);
window.addEventListener("message", handleMsg);

Array.prototype.forEach.call(document.querySelectorAll(".layer"), function (b) {
  b.onclick = function () { setLayer(b.dataset.layer); post({ type: "layerChanged", id: b.dataset.layer }); };
});
document.getElementById("m2d").onclick = function () { setMode("2d"); };
document.getElementById("m3d").onclick = function () { setMode("3d"); };
document.getElementById("fly").onclick = flyover;
</script>
</body>
</html>`;
}

router.get("/route-map", (req, res) => {
  const osKey = process.env.OS_MAPS_KEY;
  const chrome = req.query["chrome"] === "none" ? "none" : "full";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Vary on the query so a chromeless response is not served to a browser.
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(buildRouteMapHtml(osKey, chrome));
});

export default router;
