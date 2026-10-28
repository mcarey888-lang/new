import { parkingDirectionsScript } from "./parking-directions-script";
import { Router, type IRouter } from "express";
import { summitLayerScript } from "./summit-layer-script";
import { recordingScript } from "./recording-script";
import { mapControlsScript } from "./map-controls-script";
import { initialMapLocationScript } from "./initial-map-location-script";
import { reviewEditorScript } from "./route-review-editor-script";

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
  /** Where this server answers snap requests. Absent means no snapping is
   *  available, and the page then draws straight lines and says so — which is
   *  the same honest state it is in when the network has no paths. */
  snapUrl?: string,
  /** Where this server computes height profiles. Absent means no ascent is
   *  shown — which is the right failure, since a wrong ascent on a mountain
   *  route is worse than none. */
  profileUrl?: string,
  /** Where this server builds GPX. Absent hides the download. */
  gpxUrl?: string,
  /** Where this server answers summit-pin requests. Absent means the map
   *  draws no summits at all, which is a quieter map rather than a broken
   *  one — route drawing does not depend on them. */
  summitsUrl?: string,
  /** Where this server looks up car parks. Absent means the summit card
   *  simply says nothing about parking, which is the honest outcome — a car
   *  park invented to fill the gap is worse than no line at all. */
  parkingUrl?: string,
  /** True when this page is hosting a recording: the overlay starts switched
   *  on, so the walker never sees the planning chrome at all. */
  recording?: boolean,
  hostedRouting = false,
  reviewEditor = false,
): string {
  const layers = baseLayers(osKey, tilePrefix, hasMapbox);
  const initial = layers[0];

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<title>Plan a route</title>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css"/>
<script src="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js"></script>
<style>
  html,body{margin:0;height:100%;background:#05090B;overflow:hidden}
  #map{position:absolute;inset:0}
  .maplibregl-ctrl-attrib{font-size:9px!important;background:rgba(0,0,0,0.55)!important}
  .maplibregl-ctrl-attrib a{color:rgba(255,255,255,0.45)!important}
  .parking-popup .maplibregl-popup-content{background:#0B1418;color:#F4F7F6;border:1px solid #34413F;border-radius:12px;padding:18px 14px 10px;font:13px/1.4 system-ui;box-shadow:0 4px 20px #0008}
  .parking-popup .maplibregl-popup-tip{border-top-color:#0B1418;border-bottom-color:#0B1418}
  .parking-popup strong{display:block;padding-right:24px;font-size:14px}
  .parking-popup p{font-size:12px;color:#C3CDCA;margin:8px 0}
  .parking-popup .maplibregl-popup-close-button{color:#F4F7F6;width:44px;height:44px;font-size:20px}
  .parking-popup a{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-height:44px;text-decoration:none;border-radius:8px}
  .parking-popup .parking-directions-main{width:100%;background:#F2C14E;color:#0B1418;font-weight:700}
  .parking-popup .parking-directions-option{width:50%;color:#F2C14E}
  .parking-popup a:focus-visible{outline:2px solid #F2C14E;outline-offset:2px}
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
  #snap[aria-pressed="true"]{background:#24EFA4;color:#05090B;border-color:transparent}
  #snap[disabled]{opacity:.4;cursor:default}
  #gpx[disabled]{opacity:.4;cursor:default}
  #gpx[hidden]{display:none}
  #save[disabled]{opacity:.4;cursor:default}
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
#summitNote { position: absolute; left: 12px; bottom: 12px; z-index: 3;
  background: rgba(11,20,24,.88); color: #F4F7F6; font: 500 12px/1.35 system-ui, sans-serif;
  padding: 7px 11px; border-radius: 6px; max-width: 62vw; }
  #hud[hidden]{display:none}
  #hudNote{display:block;margin-top:3px;font-weight:500;color:#E9B949}
  #retryPaths{margin-top:6px;padding:6px 10px;border:1px solid #E9B949;border-radius:6px;background:#152329;color:#E9B949;cursor:pointer}
  #retryPaths[hidden]{display:none}
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
  <button id="snap" aria-pressed="${snapUrl ? "true" : "false"}"${snapUrl ? "" : " disabled"}>Follow paths</button>
  <div class="edit">
    <button id="undo" disabled>Undo</button>
    <button id="clear" disabled>Clear</button>
  </div>
  <button id="fly" disabled>Flyover</button>
  <button id="gpx" disabled${gpxUrl ? "" : " hidden"}>Download GPX</button>
  <button id="save" disabled>Save route</button>
</div>
<div id="hud" hidden><span id="hudMain"></span><span id="hudNote"></span><button id="retryPaths" hidden>Retry paths</button></div>
<div id="summitNote" style="display:none"></div>
<script>
var LAYERS = ${JSON.stringify(layers)};
var TERRAIN = ${JSON.stringify(TERRAIN_TILES)};
var SNAP_URL = ${JSON.stringify(snapUrl ?? null)};
var HOSTED_ROUTING = ${JSON.stringify(hostedRouting)};
var PROFILE_URL = ${JSON.stringify(profileUrl ?? null)};
var GPX_URL = ${JSON.stringify(gpxUrl ?? null)};
/* The smallest tolerance a tap is ever given, in metres. Covers the offset
   between aerial imagery and mapped geometry, plus a thumb. Kept well under
   the spacing of genuinely distinct paths, and the snapper still takes the
   nearest way inside it, so a wider floor finds a path where there was
   nothing — it does not pick a different one. */
var SNAP_RADIUS_FLOOR_M = 25;
var ROUTE_COLOR = "#167DF7";
var SNAP_RADIUS_FLOOR_M = 25;
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
  // An overview while permission/a GPS fix is pending, not a pretend location.
  center: [-3, 54.5], zoom: 5, pitch: 0, bearing: 0,
  attributionControl: { compact: true, customAttribution: ${JSON.stringify(hostedRouting
    ? '© <a href="https://openrouteservice.org/">openrouteservice</a> by HeiGIT | Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>'
    : "")} }
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");

var activeLayer = ${JSON.stringify(initial.id)};
var mode = "2d";
var mapLoaded = false;
var terrainEnabled = false;
var worldView = false;
var localPitch = 62;

/* Globe projection automatically converges to Mercator around zoom 12,
   keeping local route geometry precise. Terrain belongs to that detailed
   view, not a planet-sized DEM. Only change it at the boundary, not on every
   animation frame. */
function syncTerrainForZoom() {
  if (!mapLoaded) return;
  var enabled = mode === "3d" && map.getZoom() >= 12;
  if (enabled === terrainEnabled) return;
  terrainEnabled = enabled;
  map.setTerrain(enabled ? { source: "terrain", exaggeration: 1.4 } : null);
  map.setLayoutProperty("hillshade", "visibility", enabled ? "visible" : "none");
}

map.on("zoom", function () {
  if (!mapLoaded) return;
  syncTerrainForZoom();
  var nextWorld = mode === "3d" && map.getZoom() < 6;
  if (worldView === nextWorld) return;
  worldView = nextWorld;
  if (nextWorld) {
    localPitch = map.getPitch();
    map.setPitch(0);
  } else if (mode === "3d") {
    map.setPitch(localPitch);
  }
});

/* The route, and whether it has been snapped to a surveyed path network.
   These travel together on purpose. A line drawn by tapping is a straight hop
   between taps — it crosses whatever lies between, crag included — and it must
   never be drawn in the same ink as a line that follows a mapped path. Until
   snapping exists, everything drawn here is unsnapped, so it renders amber and
   dashed and the readout says why. Presenting a guess as a surveyed route is
   the one failure this feature cannot have. */
/* A route is the taps a person made, plus what happened between each pair.
   Keeping those apart is what lets a leg be re-snapped when an end moves, and
   what lets one leg follow a path while the next is honestly a straight line
   over ground the map has nothing for. anchors[i] joins anchors[i+1] via
   legs[i], so there is always exactly one fewer leg than anchor. */
var anchors = [];
var legs = [];

/* Derived: every coordinate in order, for the flyover and the length. */
var routePts = [];

var drawing = false;
var snapping = !!SNAP_URL;

/* The last height profile, and the route it was computed for. Held together so
   a stale ascent can never be shown beside a route it does not describe —
   which on a mountain is the kind of wrong that gets believed. */
var profile = null;
var profileToken = 0;
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
  if (!mapLoaded) return;
  worldView = next === "3d" && map.getZoom() < 6;
  map.setProjection({ type: next === "3d" ? "globe" : "mercator" });
  syncTerrainForZoom();
  if (next === "3d") {
    map.easeTo({ pitch: worldView ? 0 : localPitch, duration: 900 });
  } else {
    map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
  }
  var fly = document.getElementById("fly");
  if (fly) fly.disabled = !(next === "3d" && routePts.length > 1);
}

// Review editing can initialize from the style immediately. Slow or rejected
// background tiles must not prevent importing the owner's saved geometry.
map.on(${JSON.stringify(reviewEditor ? "style.load" : "load")}, function () {
  mapLoaded = true;
  if (mode === "3d") setMode(mode);
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

  if (typeof addSummitLayers === "function") {
    addSummitLayers();
    setSummitsOn(true);
  }

  map.on("click", function (e) {
    /* A tap that grabbed an existing point was a grab, not a new point.
       Without this, touching a dot to drag it leaves a duplicate behind at the
       place it started. */
    if (suppressClick) { suppressClick = false; return; }
    var parking = typeof parkingAt === "function" ? parkingAt(e) : null;
    if (parking) { handleParkingTap(parking); return; }
    post({ type: "tap", lat: e.lngLat.lat, lng: e.lngLat.lng });
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
    anchors[dragIndex] = { lat: e.lngLat.lat, lng: e.lngLat.lng };
    /* Both legs become straight for the duration of the drag. Leaving the old
       snapped geometry on screen would show the line still following a path it
       no longer touches. */
    if (dragIndex > 0) legs[dragIndex - 1] = { kind: "straight", points: null };
    if (dragIndex < anchors.length - 1) legs[dragIndex] = { kind: "straight", points: null };
    redraw();
  }
  function drop() {
    if (dragIndex < 0) return;
    var moved = dragIndex;
    dragIndex = -1;
    map.dragPan.enable();
    /* Re-snapped on release rather than on every mousemove: a drag across the
       map would otherwise fire a request per frame at a service we are
       supposed to be sparing. */
    resnapAround(moved);
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
  /* The host measured itself before this page existed, so its first insets
     were sent into nothing. Ask again now there is something to receive. */
  if (typeof requestHostInsets === "function") requestHostInsets();
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

/* A leg is "surveyed" only when the server routed it over mapped paths. Every
   other state — waiting for an answer, a gap with no path across it, a tap on
   open ground, snapping switched off or unavailable — is a straight line
   between two taps, and is drawn and described as one. The default below is
   deliberately the cautious one: a leg nobody has confirmed is not surveyed. */
function legIsSurveyed(leg) { return leg && leg.kind === "routed"; }

/** Every coordinate of the route in order, legs expanded. */
function flatten() {
  var out = [];
  for (var i = 0; i < anchors.length; i++) {
    var leg = i > 0 ? legs[i - 1] : null;
    var pts = leg && leg.points && leg.points.length ? leg.points : [anchors[i]];
    for (var j = 0; j < pts.length; j++) {
      var q = pts[j];
      var last = out[out.length - 1];
      /* A leg starts where the previous one ended, so without this every
         junction is listed twice and the length counts a zero-length hop. */
      if (!last || last.lat !== q.lat || last.lng !== q.lng) out.push(q);
    }
  }
  return out;
}

function routeLength() {
  var t = 0;
  for (var i = 1; i < routePts.length; i++) t += metres(routePts[i - 1], routePts[i]);
  return t;
}

function fc(lineStrings) {
  return { type: "FeatureCollection", features: lineStrings.filter(function (c) {
    return c.length > 1;
  }).map(function (coords) {
    return { type: "Feature", properties: {},
      geometry: { type: "LineString", coordinates: coords } };
  }) };
}

/* One place decides what the map shows, so the line, the dots, the readout and
   the buttons can never disagree. Surveyed legs and asserted ones go to
   different sources because they are drawn in different ink, and that
   difference is the point. */
function redraw() {
  var surveyed = [], asserted = [];
  for (var i = 0; i < legs.length; i++) {
    var leg = legs[i];
    var pts = (leg && leg.points && leg.points.length) ? leg.points : [anchors[i], anchors[i + 1]];
    var coords = pts.map(function (q) { return [q.lng, q.lat]; });
    (legIsSurveyed(leg) ? surveyed : asserted).push(coords);
  }
  map.getSource("route").setData(fc(surveyed));
  map.getSource("asserted").setData(fc(asserted));
  map.getSource("marks").setData({ type: "FeatureCollection", features: anchors.map(function (q, i) {
    /* A tap the server could not place on any path is marked amber, so the
       person can see which one to move rather than guessing. */
    var off = (legs[i] && legs[i].offPath === "from") || (legs[i - 1] && legs[i - 1].offPath === "to");
    return { type: "Feature",
      properties: { kind: off ? "warn" : (i === 0 ? "first" : "point"), idx: i },
      geometry: { type: "Point", coordinates: [q.lng, q.lat] } };
  }) });

  routePts = flatten();
  updateHud();

  var undo = document.getElementById("undo");
  var clr = document.getElementById("clear");
  if (undo) undo.disabled = anchors.length === 0;
  if (clr) clr.disabled = anchors.length === 0;
  var fly = document.getElementById("fly");
  if (fly) fly.disabled = !(mode === "3d" && routePts.length > 1);
  var gpx = document.getElementById("gpx");
  if (gpx) gpx.disabled = routePts.length < 2;
  var save = document.getElementById("save");
  if (save) save.disabled = routePts.length < 2;
}

function updateHud() {
  var hud = document.getElementById("hud");
  if (!hud) return;
  if (anchors.length === 0) { hud.hidden = true; return; }
  hud.hidden = false;

  var km = routeLength() / 1000;
  var main = anchors.length + (anchors.length === 1 ? " point" : " points")
    + (routePts.length > 1 ? " · " + km.toFixed(2) + " km" : "");
  /* Ascent only when it is known for the whole route. A partial figure reads
     as the whole climb, and the part that failed is exactly where it might be
     climbing hardest. */
  if (profile && profile.outcome === "profiled") {
    main += " · ↑" + profile.ascentM + " m";
  }
  document.getElementById("hudMain").textContent = main;

  /* Counted rather than summarised, because "3 straight sections" tells
     somebody how much of their route is a guess and "partly snapped" does
     not. Said in words as well as colour: amber against blue fails anyone who
     cannot separate the two, and fails everyone in bright sun. */
  var pending = 0, gaps = 0, offPath = 0, unavailable = 0, noPaths = 0, throttled = 0, other = 0;
  for (var i = 0; i < legs.length; i++) {
    var leg = legs[i];
    var k = leg ? leg.kind : "straight";
    if (k === "pending") pending++;
    else if (k === "gap") gaps++;
    else if (k === "offPath") offPath++;
    else if (k !== "routed") {
      if (leg && leg.reason === "unavailable") unavailable++;
      else if (leg && leg.reason === "no_paths") noPaths++;
      else if (leg && leg.reason === "rate_limited") throttled++;
      else other++;
    }
  }
  var straight = gaps + offPath + unavailable + noPaths + throttled + other;
  var note = "";
  if (pending) note = "Finding paths…";
  else if (!snapping) note = "Snapping off — straight lines";
  else if (straight) {
    note = straight + (straight === 1 ? " section" : " sections") + " unconfirmed";
    /* One reason, the most actionable first. Listing all of them on a phone
       produces a sentence nobody reads; naming the one to act on is the point.
       A service that would not answer comes first because it is the only one
       that fixes itself by waiting, and the only one that is our fault. */
    /* Throttling first: it is the one that clears by itself, and the one
       where carrying on tapping makes it worse rather than better. */
    if (throttled) note += " · routing limit reached — try again later";
    else if (unavailable) note += " · couldn’t check paths — try again";
    else if (noPaths) note += " · no paths mapped here";
    else if (gaps) note += " · no path across the gap";
    else if (offPath) note += " · tap further onto the path";
    /* Every remaining case says SOMETHING. A bare "13 sections not on a path"
       is the least useful thing this readout can do: it is the one state where
       the person cannot tell a broken deployment from genuinely pathless
       ground, and it cost an afternoon of looking in the wrong place. The
       reasons that land here — a request that never came back, a server
       answering something that is not JSON, a route map served by a build
       that predates the snapping endpoint — all mean the same thing to
       whoever is holding the phone. */
    else note += " · could not reach the path service";
  }
  /* Said rather than left blank. A readout with distance and no climb looks
     like a route with no climb, which on a mountain is a dangerous reading. */
  if (!note && profile && profile.outcome && profile.outcome !== "profiled") {
    note = profile.outcome === "incomplete"
      ? "No height data for part of this route"
      : "Climb not available";
  }
  document.getElementById("hudNote").textContent = note;
  var retryPaths = document.getElementById("retryPaths");
  if (retryPaths) retryPaths.hidden = !snapping || !!pending || !straight;
  if (typeof placeRouteBar === "function") placeRouteBar();
}

/** Tell the host what the route is now, so it can hold the authoritative copy. */
function emit() {
  post({ type: "routeChanged",
         /* One straight section makes the whole route unsurveyed. A route that
            is "mostly" on paths is not a route that was checked. */
         snapped: legs.length > 0 && legs.every(legIsSurveyed),
         lengthM: Math.round(routeLength()),
         anchors: anchors.slice(),
         legs: legs.map(function (l) { return { kind: l.kind, lengthM: l.lengthM || null }; }),
         points: routePts.slice() });
  /* Hooked here because emit already fires on exactly the changes that
     invalidate a profile: a point added, undone, dragged, cleared, or a leg
     coming back snapped. One place to keep in step rather than six. */
  requestProfile();
}

function setDrawing(on) {
  drawing = !!on;
  var b = document.getElementById("draw");
  if (b) b.setAttribute("aria-pressed", String(drawing));
  document.body.classList.toggle("drawing", drawing);
  post({ type: "drawingChanged", on: drawing });
  /* A route planned towards a summit puts that summit on the end once the
     drawing is done. Guarded, because the summit layer is optional. */
  if (!drawing && typeof onDrawingFinished === "function") onDrawingFinished();
}

function setSnapping(on) {
  snapping = !!on && !!SNAP_URL;
  var b = document.getElementById("snap");
  if (b) b.setAttribute("aria-pressed", String(snapping));
  /* Switching snapping on re-asks for every leg that is not already on a path;
     switching it off leaves what is there, since a leg that does follow a path
     is still true. */
  if (snapping) for (var i = 0; i < legs.length; i++) if (!legIsSurveyed(legs[i])) snapLeg(i);
  redraw();
  post({ type: "snappingChanged", on: snapping });
}

/**
 * Ask the server to route one leg over the path network.
 *
 * Every failure lands on the same side: the leg stays a straight line, drawn
 * amber. A request that times out, a server that is down, a gap with no path
 * across it and a tap on open ground all leave a line the person can see is
 * unconfirmed. Nothing here can turn a failure into an apparently surveyed
 * route, which is the only outcome that would matter.
 */
/**
 * How far from a path a tap should still count, for the zoom now on screen.
 *
 * Scaled by zoom, because what a screen pixel is worth on the ground changes
 * and a fixed radius asks for an accuracy no thumb has when zoomed out.
 *
 * THE MULTIPLIER IS 45, AND IT WAS 20, AND 20 WAS WRONG.
 *
 * Twenty pixels was reasoned from fingertip size and it fails in practice,
 * because the error is not how wide a finger is — it is that a path at
 * planning zoom is a hairline a pixel or two across. Measured: picking a point
 * that looked like it was on a path, zoomed in, on a screenshot, taking care,
 * landed 113 m from the nearest mapped way. Twenty pixels was about 60 m
 * there, so the tap found nothing, and a whole route came back as straight
 * lines with the snapping working perfectly throughout.
 *
 * Forty-five pixels is roughly 135 m at planning zoom and about 30 m zoomed
 * right in, which is the shape this needs: forgiving where the map is small,
 * precise where it is not.
 *
 * The server still clamps it, so this cannot make a tap reach across a valley
 * however the zoom is abused.
 */
function snapRadiusM() {
  var lat = map.getCenter().lat;
  var metresPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, map.getZoom());
  /* Scaled by zoom, because a thumb covers the same pixels whatever the scale.
     But floored, because the scaling collapses at the top end: at zoom 19 the
     multiplier alone gives 8 m, and aerial imagery and OpenStreetMap geometry
     routinely disagree by more than that. Zoomed right in on a photograph, a
     tap placed exactly on the path somebody can SEE lands outside the path the
     data holds, and the readout can only say they tapped off the path — which
     reads as a lie to the person looking at their own finger on the line.
     Zooming in to be precise must not be what breaks it. */
  return Math.max(SNAP_RADIUS_FLOOR_M, Math.round(metresPerPixel * 45));
}

var legToken = 0;
var pathQueue = [];
var pathRequestsActive = 0;
/* Keep rapid drawing from producing a burst of upstream requests. Requests
   superseded by Undo/Clear/dragging are discarded before using any quota. */
function requestPath(body, isCurrent) {
  return new Promise(function (resolve) {
    pathQueue.push({ body: body, isCurrent: isCurrent, resolve: resolve });
    drainPathQueue();
  });
}
function drainPathQueue() {
  while (pathRequestsActive < 2 && pathQueue.length) {
    const job = pathQueue.shift();
    if (!job.isCurrent()) { job.resolve({ outcome: "cancelled" }); continue; }
    pathRequestsActive++;
    fetch(SNAP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(job.body)
    }).then(function (r) {
      if (!r.ok) return { outcome: r.status === 429 ? "rate_limited" : "http_" + r.status };
      return r.json();
    }).catch(function () {
      return { outcome: "unavailable" };
    }).then(job.resolve).finally(function () {
      pathRequestsActive--;
      drainPathQueue();
    });
  }
}
function snapLeg(i) {
  if (!snapping || !SNAP_URL) return;
  var from = anchors[i], to = anchors[i + 1];
  if (!from || !to) return;

  /* Each leg carries the token of its most recent request. An answer arriving
     for a leg that has since been dragged, undone or re-snapped is stale and
     is dropped — otherwise a slow reply overwrites a newer one and the line
     silently reverts to where the point used to be. */
  var token = ++legToken;
  legs[i] = { kind: "pending", token: token, points: null };
  redraw();

  requestPath({ from: from, to: to, radiusM: snapRadiusM() }, function () {
    return snapping && legs[i] && legs[i].token === token;
  }).then(function (data) {
    if (!legs[i] || legs[i].token !== token) return;
    if (!data || typeof data.outcome !== "string") {
      /* Something answered, but not with a snap result. A proxy error page, a
         login redirect, a limiter body. Named so it is not mistaken for the
         ground having no paths on it. */
      legs[i] = { kind: "straight", token: token, points: null, reason: "not_a_snap_reply" };
      redraw(); emit(); return;
    }
    if (data.outcome === "routed") {
      legs[i] = { kind: "routed", token: token, points: data.points,
                  lengthM: data.lengthM, detourFactor: data.detourFactor,
                  wayName: data.wayName };
    } else if (data.outcome === "disconnected") {
      legs[i] = { kind: "gap", token: token, points: null, gapM: data.gapM };
    } else if (data.outcome === "off_path") {
      legs[i] = { kind: "offPath", token: token, points: null, offPath: data.which };
    } else if (data.outcome === "unavailable" && data.status === 429) {
      legs[i] = { kind: "straight", token: token, points: null, reason: "rate_limited" };
    } else {
      /* no_paths, unavailable, or anything unrecognised. The reason is kept
         rather than flattened, because "Overpass refused" and "nothing is
         mapped here" call for completely different responses from the person
         holding the phone. */
      legs[i] = { kind: "straight", token: token, points: null, reason: data.outcome };
    }
    redraw();
    emit();
  }).catch(function () {
    if (!legs[i] || legs[i].token !== token) return;
    legs[i] = { kind: "straight", token: token, points: null, reason: "unreachable" };
    redraw();
    emit();
  });
}

/**
 * Ask the server what the route climbs.
 *
 * Debounced, and deliberately not per tap: a profile means sampling the ground
 * every thirty metres, and recomputing that mid-drag would be a lot of work
 * for a figure nobody can read while the line is still moving.
 *
 * The profile is cleared the moment the route changes. A number left on screen
 * from the previous shape would be read as describing the current one.
 */
var profileTimer = null;
function requestProfile() {
  profile = null;
  updateHud();
  if (!PROFILE_URL) return;
  if (profileTimer) clearTimeout(profileTimer);
  if (routePts.length < 2) return;

  profileTimer = setTimeout(function () {
    var token = ++profileToken;
    var pts = routePts.slice();
    fetch(PROFILE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points: pts })
    }).then(function (r) { return r.json(); }).then(function (data) {
      /* Dropped if the route moved on. An ascent for a line that no longer
         exists is worse than no ascent at all. */
      if (token !== profileToken) return;
      profile = data && data.outcome === "profiled" ? data : null;
      if (data && data.outcome !== "profiled") profile = { outcome: data.outcome };
      updateHud();
      post({ type: "profile", profile: data });
    }).catch(function () {
      if (token !== profileToken) return;
      profile = { outcome: "unavailable" };
      updateHud();
    });
  }, 600);
}

function addPoint(lngLat) {
  anchors.push({ lat: lngLat.lat, lng: lngLat.lng });
  if (anchors.length === 1 && snapping && SNAP_URL && !HOSTED_ROUTING) {
    /* Start loading the first point's network while the person chooses the
       next point. This read never moves anchors or marks a leg as routed;
       subsequent leg requests reuse the server's cached/in-flight region. */
    fetch(SNAP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: null, to: anchors[0], radiusM: snapRadiusM() })
    }).catch(function () { /* The actual leg request reports any failure. */ });
  }
  if (anchors.length > 1) {
    var i = anchors.length - 2;
    legs[i] = { kind: "straight", points: null };
    snapLeg(i);
  }
  redraw();
  emit();
}

/** After a point moves, only the legs touching it can have changed. */
function resnapAround(i) {
  if (i > 0) snapLeg(i - 1);
  if (i < anchors.length - 1) snapLeg(i);
}

function undoPoint() {
  if (!anchors.length) return;
  anchors.pop();
  legs.length = Math.max(0, anchors.length - 1);
  redraw();
  emit();
}

function clearRoute() {
  if (typeof clearSummitDestination === "function") clearSummitDestination();
  anchors = [];
  legs = [];
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

var communityPins = [];
function showCommunityPins(routes) {
  communityPins.forEach(function (pin) { pin.remove(); });
  communityPins = [];
  var bounds = new maplibregl.LngLatBounds();
  routes.slice(0, 100).forEach(function (route) {
    var p = route.startPoint;
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon) ||
      Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180 ||
      typeof route.owner !== "string" || typeof route.hikeId !== "string") return;
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = "Walk";
    button.setAttribute("aria-label", "Open member recording " + (route.name || "Hike"));
    button.style.cssText = "border:2px solid #24efa4;background:#071313;color:white;border-radius:18px;padding:7px;font:600 12px system-ui";
    button.onclick = function (event) {
      event.stopPropagation();
      post({type:"communityRouteSelected",owner:route.owner,hikeId:route.hikeId});
    };
    communityPins.push(new maplibregl.Marker({element:button}).setLngLat([p.lon,p.lat]).addTo(map));
    bounds.extend([p.lon,p.lat]);
  });
  if (communityPins.length) map.fitBounds(bounds, {padding:60,maxZoom:12,duration:0});
}
/* Reopen the stored line without recomputing it. Leg boundaries follow the
   closest saved anchor in route order; no stored vertex is discarded. */
function savedRouteLegs(savedAnchors, geometry, savedLegs) {
  var restored = [], start = 0;
  for (var i = 0; i < savedAnchors.length - 1; i++) {
    var end = geometry.length - 1;
    if (i < savedAnchors.length - 2 && geometry.length) {
      var nearest = Infinity;
      end = start;
      for (var j = start; j < geometry.length; j++) {
        var distance = metres(savedAnchors[i + 1], geometry[j]);
        if (distance < nearest) { nearest = distance; end = j; }
      }
    }
    var saved = savedLegs[i] || {};
    var kind = saved.kind === "routed" ? "routed"
      : saved.kind === "gap" || saved.kind === "offPath" ? saved.kind : "straight";
    restored.push({
      kind: geometry.length > 1 ? kind : "straight",
      points: geometry.length > 1 ? geometry.slice(start, end + 1) : null,
      lengthM: typeof saved.lengthM === "number" ? saved.lengthM : null
    });
    start = end;
  }
  return restored;
}

function fitSavedRoute(points) {
  if (!points.length) return;
  var height = map.getContainer().clientHeight;
  var bottom = typeof hostBottomInset === "number" ? hostBottomInset : 0;
  ["hud", "routeActions"].forEach(function (id) {
    var node = document.getElementById(id);
    if (!node || node.hidden || node.style.display === "none") return;
    var box = node.getBoundingClientRect();
    if (box.height) bottom = Math.max(bottom, height - box.top);
  });
  map.fitBounds(recBounds(points.map(function (p) { return [p.lng, p.lat]; })), {
    padding: { top: 64, right: 32, left: 32,
      bottom: Math.min(Math.max(32, height - 96), bottom + 24) },
    maxZoom: 16, duration: 450
  });
}

${reviewEditor ? reviewEditorScript() : ""}
function handleMsg(ev) {
  var msg;
  try { msg = JSON.parse(ev.data); } catch (err) { return; }
  if (!msg || !msg.type) return;
  ${reviewEditor ? 'if (ev.source !== window.parent || ev.origin !== window.location.origin) return;\n  if (loadReviewDraft(msg)) return;' : ""}
  if (msg.type === "communityPins" && Array.isArray(msg.routes)) { showCommunityPins(msg.routes); return; }

  if (msg.type === "route" && Array.isArray(msg.points)) {
    /* A route handed in by the host counts as surveyed unless it says
       otherwise. An explicit false still reads as unsurveyed, so a host
       passing a draft cannot have it drawn as checked by omission. */
    var surveyed = msg.snapped !== false;
    anchors = msg.points.slice();
    legs = [];
    for (var li = 0; li < anchors.length - 1; li++) {
      legs.push(surveyed
        ? { kind: "routed", points: [anchors[li], anchors[li + 1]] }
        : { kind: "straight", points: null });
    }
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
  /* Recording. Namespaced, because the page already has a "clear" that means
     the drawn route and a "locate" that only moves the camera. */
  if (msg.type === "recPoint") { recAddPoint(msg.lat, msg.lng); return; }
  if (msg.type === "recLocate") { recLocate(msg.lat, msg.lng); return; }
  if (msg.type === "recReplay" && Array.isArray(msg.points)) { recReplay(msg.points); return; }
  if (msg.type === "recPlanned" && Array.isArray(msg.points)) { recPlanned(msg.points); return; }
  if (msg.type === "recClear") { recClearTrack(); return; }
  if (msg.type === "recRecentre") { recRecentre(); return; }
  if (msg.type === "recording") { setRecording(msg.on !== false); return; }
  /* The hills this person says they have been up. Sent in by the app,
     because this page is public and has no business asking who is
     looking at it. */
  if (msg.type === "summitTicks" && typeof setSummitTicks === "function") {
    setSummitTicks(Array.isArray(msg.ids) ? msg.ids : []);
  }
  if (msg.type === "bottomInset") { setBottomInset(msg.px); return; }
  if (msg.type === "topInset") { setTopInset(msg.px); return; }

  if (msg.type === "layer") setLayer(msg.id);
  if (msg.type === "mode") setMode(msg.value === "3d" ? "3d" : "2d");
  if (msg.type === "flyover") flyover();
  if (msg.type === "clear") clearRoute();
  if (msg.type === "draw") setDrawing(msg.on !== false);
  if (msg.type === "undo") undoPoint();
  if (msg.type === "snap") setSnapping(msg.on !== false);

  /* A saved route coming back. Anchors and legs are restored together so the
     route can be edited rather than only looked at, and so a leg that was a
     straight line when it was saved is still drawn as one. Reconstructing it
     from the line alone would lose both. */
  if (msg.type === "loadRoute" && msg.route) {
    var r = msg.route;
    if (typeof clearSummitDestination === "function") clearSummitDestination();
    if (typeof hideSummitCard === "function") hideSummitCard();
    flying = false;
    setDrawing(false);
    profileToken++;
    anchors = Array.isArray(r.anchors) ? r.anchors.slice() : [];
    var savedLegs = Array.isArray(r.legs) ? r.legs : [];
    var geom = Array.isArray(r.geometry) ? r.geometry : [];
    legs = savedRouteLegs(anchors, geom, savedLegs);
    redraw();
    emit();
    fitSavedRoute(geom.length > 1 ? geom : anchors);
    if (typeof r.name === "string") post({ type: "routeLoaded", name: r.name });
  }

  if (msg.type === "saveResult") {
    var n = document.getElementById("hudNote");
    if (n) n.textContent = msg.ok ? "Saved" : (msg.reason || "Could not save");
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
document.getElementById("draw").onclick = function () { setDrawing(!drawing); };
document.getElementById("undo").onclick = undoPoint;
document.getElementById("clear").onclick = clearRoute;
document.getElementById("snap").onclick = function () { setSnapping(!snapping); };
document.getElementById("retryPaths").onclick = function () {
  if (!snapping) return;
  for (var i = 0; i < legs.length; i++) {
    if (legs[i] && legs[i].kind !== "pending" && !legIsSurveyed(legs[i])) snapLeg(i);
  }
};

/**
 * Hand the route to the app to be saved.
 *
 * Saving needs the signed-in person's token, and this page does not have one.
 * Giving it one would mean putting a token in a URL or in page script, where
 * it can be read, logged or left in history — so the page hands the route up
 * and the app, which holds the session, does the saving.
 *
 * Opened directly in a browser there is no app to hand it to. That says so
 * rather than appearing to work, because a save that silently does nothing is
 * how someone loses an afternoon's planning.
 */
function hasHost() {
  return !!window.ReactNativeWebView || window.parent !== window;
}

document.getElementById("save").onclick = function () {
  if (routePts.length < 2) return;
  var note = document.getElementById("hudNote");
  if (!hasHost()) {
    if (note) note.textContent = "Open the planner in the app to save routes";
    return;
  }
  var straight = 0;
  for (var i = 0; i < legs.length; i++) if (!legIsSurveyed(legs[i])) straight++;
  post({
    type: "saveRequested",
    route: {
      anchors: anchors.slice(),
      geometry: routePts.slice(),
      legs: legs.map(function (l) { return { kind: l.kind, lengthM: l.lengthM || null }; }),
      lengthM: Math.round(routeLength()),
      /* Null rather than absent or zero when unknown. A route whose heights
         could not be read has unknown ascent, and zero would say it is flat. */
      ascentM: (profile && profile.outcome === "profiled") ? profile.ascentM : null,
      descentM: (profile && profile.outcome === "profiled") ? profile.descentM : null,
      fullySnapped: legs.length > 0 && straight === 0
    }
  });
  if (note) note.textContent = "Saving…";
};

/**
 * Hand the route over as a GPX file.
 *
 * The points go up rather than being re-derived on the server, because the
 * page is what the person is looking at and the file has to match it. Heights
 * are NOT sent: the profile is sampled every thirty metres while the route has
 * a point at every bend, so pairing them off by position attaches heights to
 * the wrong coordinates. The server looks up each one for the exact point it
 * is writing.
 */
document.getElementById("gpx").onclick = function () {
  if (!GPX_URL || routePts.length < 2) return;
  var pts = routePts.map(function (q) { return { lat: q.lat, lng: q.lng }; });
  var straight = 0;
  for (var i = 0; i < legs.length; i++) if (!legIsSurveyed(legs[i])) straight++;

  fetch(GPX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      points: pts,
      unsnappedSections: straight,
      lengthM: Math.round(routeLength()),
      ascentM: (profile && profile.outcome === "profiled") ? profile.ascentM : null
    })
  }).then(function (r) {
    if (!r.ok) throw new Error("gpx failed");
    var name = r.headers.get("Content-Disposition") || "";
    var m = /filename="([^"]+)"/.exec(name);
    return r.blob().then(function (blob) { return { blob: blob, filename: m ? m[1] : "route.gpx" }; });
  }).then(function (out) {
    var url = URL.createObjectURL(out.blob);
    var a = document.createElement("a");
    a.href = url; a.download = out.filename;
    document.body.appendChild(a); a.click(); a.remove();
    /* Revoked on a later tick: revoking immediately races the download on
       some browsers and hands the person an empty file. */
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    post({ type: "gpxDownloaded", filename: out.filename });
  }).catch(function () {
    var note = document.getElementById("hudNote");
    if (note) note.textContent = "Could not build the GPX file";
  });
};

${parkingDirectionsScript()}
${summitsUrl ? summitLayerScript(summitsUrl, parkingUrl) : ""}
${summitsUrl ? `map.on("moveend", scheduleSummits);` : ""}

${recordingScript()}
${recording ? `map.on("load", function () { setRecording(true); });` : ""}

${chrome === "full" ? mapControlsScript(Boolean(gpxUrl)) : ""}
${chrome === "full" ? "buildControls();" : ""}
${recording || reviewEditor ? "" : initialMapLocationScript()}
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
  const snapUrl = `${req.baseUrl}/path-snap`;
  const profileUrl = `${req.baseUrl}/route-profile`;
  const gpxUrl = `${req.baseUrl}/route-gpx`;
  const summitsUrl = `${req.baseUrl}/summits`;
  const parkingUrl = `${req.baseUrl}/summits/parking`;
  /* The recorder opens this page with ?recording=1 so the walking chrome is
     there from the first paint — no flash of a search box being put away. */
  const recording = req.query["recording"] === "1";
  // Reuse the actual planner in the private admin host, without automatic
  // location/profile requests or personal-route saving. The host owns saving.
  const adminReview = req.query["adminReview"] === "1";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Vary on the query so a chromeless response is not served to a browser.
  /* This page is application code, not an asset. Cached for an hour, a fix
     shipped today reaches a phone that already opened the map tomorrow —
     which is how a corrected summit card went on being drawn in the old
     place, and a renamed button went on saying the old thing, long after
     both were fixed. The ETag above still makes a revalidation cheap: an
     unchanged page comes back 304 with no body. */
  res.setHeader("Cache-Control", "no-cache");
  let html = buildRouteMapHtml(osKey, chrome, tilePrefix, Boolean(process.env.MAPBOX_TOKEN), snapUrl,
    adminReview ? undefined : profileUrl, adminReview ? undefined : gpxUrl,
    summitsUrl, parkingUrl, recording, Boolean(process.env.OPENROUTESERVICE_API_KEY), adminReview);
  if (adminReview) html = html.replace(/>Save route</g, ">Save as new draft<").replace('save.textContent = "Save route"', 'save.textContent = "Save as new draft"');
  res.send(html);
});

export default router;
