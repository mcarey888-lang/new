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
  /** Tile scheme size. Mapbox's styled imagery serves 512; everything else
   *  here serves 256, and mixing them up misaligns imagery against terrain. */
  tileSize: 256 | 512;
}

/**
 * Basemaps, in the order they appear in the switcher.
 *
 * OS first because it is the only one carrying rights of way, which is the
 * thing a UK hill route is planned against. OSM last as the layer that always
 * works: no key, no quota, and the fallback when OS tiles fail.
 */
export function baseLayers(
  osKey: string | undefined,
  /** Where this server serves proxied tiles, e.g. "/api/map-tiles". Passed in
   *  rather than hardcoded so the page keeps working if the API mount moves. */
  tilePrefix?: string,
  /** Whether a Mapbox token is configured. The token itself never reaches this
   *  function — it stays in the proxy, which is the whole point of the proxy. */
  hasMapbox = false,
): BaseLayerSpec[] {
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
          tileSize: 256,
        }
      : null;

  /* Satellite comes through this server, not straight from Mapbox, so the
     token stays server-side. See map-tiles.ts for why that matters.

     It sits after the OS layers deliberately. Imagery shows ground cover,
     crag and scree, which is worth having when judging whether a line is
     walkable — but it marks no paths at all, so it is the layer you check
     against, not the one you draw on. */
  const satellite = (id: string, label: string, tileSize: 256 | 512): BaseLayerSpec | null =>
    hasMapbox && tilePrefix
      ? {
          id,
          label,
          tiles: `${tilePrefix}/${id}/{z}/{x}/{y}`,
          attribution:
            '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> ' +
            '&copy; <a href="https://www.maxar.com/">Maxar</a>',
          // The proxy refuses anything deeper, so asking for more would only
          // produce 400s where a stretched tile reads better.
          maxZoom: 19,
          tileSize,
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
      tileSize: 256,
    },
    satellite("satellite", "Satellite", 256),
    satellite("satellite-streets", "Satellite + Labels", 512),
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
  tilePrefix?: string,
  hasMapbox = false,
): string {
  const layers = baseLayers(osKey, tilePrefix, hasMapbox);
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
  #draw[aria-pressed="true"]{background:#E9B949;color:#05090B;border-color:transparent}
  .edit{display:flex;gap:5px}
  .edit button{min-width:0;flex:1;text-align:center}
  .edit button[disabled]{opacity:.4;cursor:default}
  /* While drawing, the pointer has to say so: on a map a plain arrow means
     "drag me" and the first tap would otherwise feel like a misfire. */
  .drawing .maplibregl-canvas{cursor:crosshair}
  #hud{
    position:absolute;left:10px;bottom:26px;z-index:3;max-width:min(60vw,290px);
    padding:8px 11px;border-radius:9px;background:rgba(11,20,24,.86);
    border:1px solid rgba(255,255,255,.12);
    -webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);
    font:600 11px/1.45 -apple-system,system-ui,sans-serif;color:rgba(255,255,255,.82);
  }
  #hud[hidden]{display:none}
  #hudNote{display:block;margin-top:3px;font-weight:500;color:#E9B949}
  ${chrome === "none" ? ".panel,#hud{display:none}" : ""}
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
  <button id="draw" aria-pressed="false">Draw route</button>
  <div class="edit">
    <button id="undo" disabled>Undo</button>
    <button id="clear" disabled>Clear</button>
  </div>
  <button id="fly" disabled>Flyover</button>
</div>
<div id="hud" hidden><span id="hudMain"></span><span id="hudNote"></span></div>
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
    type: "raster", tiles: [l.tiles], tileSize: l.tileSize,
    maxzoom: l.maxZoom, attribution: l.attribution
  };
  styleLayers.push({
    id: "base-" + l.id, type: "raster", source: "base-" + l.id,
    layout: { visibility: i === 0 ? "visible" : "none" }
  });
});
/* Hillshade sits above the basemap and below the route. In 2D it is hidden:
   OS sheets already carry their own relief, and doubling it muddies them.

   In 3D it is deliberately faint, and SHADOW ONLY. MapLibre's default
   highlight is white, which lays a wash over the basemap and drains the
   colour out of an OS sheet — the cartography stops reading as cartography.
   A transparent highlight and accent leave the lit faces as OS drew them,
   and the small amount of shadow left is enough to seat the sheet on the
   terrain. The sense of relief comes from the 3D geometry anyway; the
   hillshade only has to stop the far slopes looking flat. */
styleLayers.push({
  id: "hillshade", type: "hillshade", source: "terrain",
  layout: { visibility: "none" },
  paint: {
    "hillshade-exaggeration": 0.15,
    "hillshade-shadow-color": "#3C4A42",
    "hillshade-highlight-color": "rgba(255,255,255,0)",
    "hillshade-accent-color": "rgba(0,0,0,0)"
  }
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

/* The route, and whether it has been snapped to a surveyed path network.
   These travel together on purpose. A line drawn by tapping is a straight hop
   between taps — it crosses whatever lies between, crag included — and it must
   never be drawn in the same ink as a line that follows a mapped path. Until
   snapping exists, everything drawn here is unsnapped, so it renders amber and
   dashed and the readout says why. Presenting a guess as a surveyed route is
   the one failure this feature cannot have. */
var routePts = [];
var routeSnapped = false;

var drawing = false;
var dragIndex = -1;
var suppressClick = false;

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
  var fly = document.getElementById("fly");
  if (fly) fly.disabled = !(next === "3d" && routePts.length > 1);
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
    /* A tap that grabbed an existing point was a grab, not a new point.
       Without this, touching a dot to drag it leaves a duplicate behind at the
       place it started. */
    if (suppressClick) { suppressClick = false; return; }
    if (drawing) addPoint(e.lngLat);
  });

  /* Dragging a placed point, because the alternative is undoing back to the
     mistake. On a twenty-point ridge line that is the difference between a
     tool and a toy. Pointer and touch are wired separately: MapLibre does not
     synthesise one from the other, and a finger is the likely input here. */
  function grab(e) {
    if (!drawing || !e.features || !e.features.length) return;
    e.preventDefault();
    dragIndex = e.features[0].properties.idx;
    suppressClick = true;
    map.dragPan.disable();
  }
  function move(e) {
    if (dragIndex < 0) return;
    routePts[dragIndex] = { lat: e.lngLat.lat, lng: e.lngLat.lng };
    routeSnapped = false;
    redraw();
  }
  function drop() {
    if (dragIndex < 0) return;
    dragIndex = -1;
    map.dragPan.enable();
    emit();
  }
  map.on("mousedown", "mark-dots", grab);
  map.on("touchstart", "mark-dots", grab);
  map.on("mousemove", move);
  map.on("touchmove", move);
  map.on("mouseup", drop);
  map.on("touchend", drop);
  /* A pointer that leaves the canvas mid-drag never sends mouseup, and the
     point would then follow the cursor back in. */
  map.getCanvas().addEventListener("mouseleave", drop);

  post({ type: "ready" });
});

function empty() {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } };
}
function line(points) {
  return { type: "Feature", properties: {},
    geometry: { type: "LineString", coordinates: points.map(function (p) { return [p.lng, p.lat]; }) } };
}

/* Great-circle distance. The route readout is the only number this page
   states, so it is computed rather than approximated: a flat-earth shortcut is
   fine over a kilometre and wrong by enough to matter over a long day. */
function metres(a, b) {
  var R = 6371000;
  var la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
  var dla = la2 - la1, dlo = (b.lng - a.lng) * Math.PI / 180;
  var h = Math.sin(dla / 2) * Math.sin(dla / 2)
        + Math.cos(la1) * Math.cos(la2) * Math.sin(dlo / 2) * Math.sin(dlo / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function routeLength() {
  var t = 0;
  for (var i = 1; i < routePts.length; i++) t += metres(routePts[i - 1], routePts[i]);
  return t;
}

/* One place decides what the map shows, so the line, the dots, the readout and
   the buttons can never disagree about how many points there are. */
function redraw() {
  var drawn = line(routePts);
  map.getSource("route").setData(routeSnapped ? drawn : empty());
  map.getSource("asserted").setData(routeSnapped ? empty() : drawn);
  map.getSource("marks").setData({ type: "FeatureCollection", features: routePts.map(function (p, i) {
    return { type: "Feature",
      properties: { kind: i === 0 ? "first" : "point", idx: i },
      geometry: { type: "Point", coordinates: [p.lng, p.lat] } };
  }) });

  var hud = document.getElementById("hud");
  if (hud) {
    if (routePts.length === 0) { hud.hidden = true; }
    else {
      hud.hidden = false;
      var km = routeLength() / 1000;
      document.getElementById("hudMain").textContent =
        routePts.length + (routePts.length === 1 ? " point" : " points")
        + (routePts.length > 1 ? " · " + km.toFixed(2) + " km" : "");
      /* Said plainly and every time, not once on first use. The number above
         is the length of the straight hops, not of a walk. */
      document.getElementById("hudNote").textContent = routeSnapped
        ? ""
        : "Straight lines — not following paths yet";
    }
  }

  var undo = document.getElementById("undo");
  var clr = document.getElementById("clear");
  if (undo) undo.disabled = routePts.length === 0;
  if (clr) clr.disabled = routePts.length === 0;
  var fly = document.getElementById("fly");
  if (fly) fly.disabled = !(mode === "3d" && routePts.length > 1);
}

/** Tell the host what the route is now, so it can hold the authoritative copy. */
function emit() {
  post({ type: "routeChanged", snapped: routeSnapped,
         lengthM: Math.round(routeLength()), points: routePts.slice() });
}

function setDrawing(on) {
  drawing = !!on;
  var b = document.getElementById("draw");
  if (b) b.setAttribute("aria-pressed", String(drawing));
  document.body.classList.toggle("drawing", drawing);
  post({ type: "drawingChanged", on: drawing });
}

function addPoint(lngLat) {
  /* A point added by hand makes the route a drawn one again. Without this a
     snapped route that someone extends would keep claiming to be snapped
     along a section that never was. */
  routeSnapped = false;
  routePts.push({ lat: lngLat.lat, lng: lngLat.lng });
  redraw();
  emit();
}

function undoPoint() {
  if (!routePts.length) return;
  routePts.pop();
  redraw();
  emit();
}

function clearRoute() {
  routePts = [];
  routeSnapped = false;
  redraw();
  emit();
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
    /* A route handed in by the host is snapped unless it says otherwise, since
       the host is where snapping will happen. An explicit false still reads as
       unsnapped, so a host passing a draft cannot have it drawn as surveyed. */
    routeSnapped = msg.snapped !== false;
    redraw();
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
  if (msg.type === "clear") clearRoute();
  if (msg.type === "draw") setDrawing(msg.on !== false);
  if (msg.type === "undo") undoPoint();
}
document.addEventListener("message", handleMsg);
window.addEventListener("message", handleMsg);

Array.prototype.forEach.call(document.querySelectorAll(".layer"), function (b) {
  b.onclick = function () { setLayer(b.dataset.layer); post({ type: "layerChanged", id: b.dataset.layer }); };
});
document.getElementById("m2d").onclick = function () { setMode("2d"); };
document.getElementById("m3d").onclick = function () { setMode("3d"); };
document.getElementById("fly").onclick = flyover;
document.getElementById("draw").onclick = function () { setDrawing(!drawing); };
document.getElementById("undo").onclick = undoPoint;
document.getElementById("clear").onclick = clearRoute;
</script>
</body>
</html>`;
}

router.get("/route-map", (req, res) => {
  const osKey = process.env.OS_MAPS_KEY;
  const chrome = req.query["chrome"] === "none" ? "none" : "full";
  /* Derived from where this router is actually mounted rather than written as
     "/api", so moving the mount does not silently break every satellite tile. */
  const tilePrefix = `${req.baseUrl}/map-tiles`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Vary on the query so a chromeless response is not served to a browser.
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(buildRouteMapHtml(osKey, chrome, tilePrefix, Boolean(process.env.MAPBOX_TOKEN)));
});

export default router;
