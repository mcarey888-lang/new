import {
  chromeFor, FOLLOW_ZOOM, isUserGesture, PLANNED_COLOR, shouldRecentre, TRACK_COLOR,
} from "../services/track/recordingView";

/**
 * Recording, on the same map as everything else.
 *
 * Before this, a hike was recorded on a second map — a Leaflet page at
 * /hike-map with its own tiles, its own track drawing and no basemap switch.
 * Two maps meant the one thing people want on a hill, swapping to satellite to
 * read the ground, was the one thing recording could not do.
 *
 * So the recording overlay lives here, on the MapLibre page, and the recorder
 * points at this page instead. Kept in its own module for the same reason the
 * summit layer is: route-map-web.ts carries the globe and projection work, and
 * gains only a few lines from this.
 */
export function recordingScript(): string {
  return `
var TRACK_COLOR = ${JSON.stringify(TRACK_COLOR)};
var PLANNED_COLOR = ${JSON.stringify(PLANNED_COLOR)};
var FOLLOW_ZOOM = ${FOLLOW_ZOOM};

/* Serialised from the module the tests exercise, so the browser runs the same
   rules rather than a second copy that drifts. */
var recChromeFor = ${chromeFor.toString()};
var recIsUserGesture = ${isUserGesture.toString()};
var recShouldRecentre = ${shouldRecentre.toString()};

var recPts = [];               // the recorded track, [lng, lat]
var recFollow = { following: true, offCentre: false };
var recording = false;
var recRecentreBtn = null;

/**
 * Lift the map's own furniture above whatever the app has put over it.
 *
 * The Track screen covers the bottom of the map with its sheet, and the
 * attribution sits bottom-right. "Contains OS data © Crown copyright" is a
 * condition of the OS licence, not a courtesy, so a sheet covering it is a
 * licence problem rather than a cosmetic one. The host says how much room it
 * is taking and the controls move up by that much.
 */
function setBottomInset(px) {
  var inset = Math.max(0, Math.min(600, Number(px) || 0));
  var nodes = document.querySelectorAll(
    ".maplibregl-ctrl-bottom-right, .maplibregl-ctrl-bottom-left"
  );
  for (var i = 0; i < nodes.length; i++) {
    nodes[i].style.marginBottom = inset + "px";
  }
  if (recRecentreBtn) recRecentreBtn.style.bottom = (inset + 16) + "px";
}

function recEmpty() { return { type: "FeatureCollection", features: [] }; }

function recLine(points) {
  return points.length > 1
    ? { type: "FeatureCollection", features: [{
        type: "Feature", geometry: { type: "LineString", coordinates: points }, properties: {},
      }] }
    : recEmpty();
}

function recMetres(a, b) {
  var rad = Math.PI / 180;
  var dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad;
  var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function ensureRecordingLayers() {
  if (map.getSource("rec-track")) return;
  map.addSource("rec-planned", { type: "geojson", data: recEmpty() });
  map.addSource("rec-track", { type: "geojson", data: recEmpty() });
  map.addSource("rec-pos", { type: "geojson", data: recEmpty() });

  /* The planned route goes underneath and dashed. Where the two agree the
     recorded line covers it, which is the thing worth seeing at a glance. */
  map.addLayer({
    id: "rec-planned-line", type: "line", source: "rec-planned",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": PLANNED_COLOR, "line-width": 4, "line-dasharray": [2, 1.6], "line-opacity": 0.95 },
  });
  map.addLayer({
    id: "rec-track-casing", type: "line", source: "rec-track",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#05090B", "line-width": 9, "line-opacity": 0.55 },
  });
  map.addLayer({
    id: "rec-track-line", type: "line", source: "rec-track",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": TRACK_COLOR, "line-width": 5 },
  });
  map.addLayer({
    id: "rec-pos-halo", type: "circle", source: "rec-pos",
    filter: ["==", ["get", "kind"], "here"],
    paint: { "circle-color": TRACK_COLOR, "circle-opacity": 0.22, "circle-radius": 18 },
  });
  map.addLayer({
    id: "rec-pos-dot", type: "circle", source: "rec-pos",
    paint: {
      "circle-color": ["case", ["==", ["get", "kind"], "start"], "#FFFFFF", TRACK_COLOR],
      "circle-radius": ["case", ["==", ["get", "kind"], "start"], 6, 8],
      "circle-stroke-color": ["case", ["==", ["get", "kind"], "start"], TRACK_COLOR, "#FFFFFF"],
      "circle-stroke-width": 3,
    },
  });

  /* Following must survive the map moving itself. Only a move carrying the
     person's own input counts as letting go. */
  map.on("movestart", function (e) {
    if (recording && recIsUserGesture(e)) {
      recFollow = { following: false, offCentre: true };
      updateRecenterButton();
    }
  });
}

function recPositionData() {
  var features = [];
  if (recPts.length) {
    features.push({
      type: "Feature", geometry: { type: "Point", coordinates: recPts[0] },
      properties: { kind: "start" },
    });
    features.push({
      type: "Feature", geometry: { type: "Point", coordinates: recPts[recPts.length - 1] },
      properties: { kind: "here" },
    });
  }
  return { type: "FeatureCollection", features: features };
}

function recDraw() {
  if (!map.getSource("rec-track")) return;
  map.getSource("rec-track").setData(recLine(recPts));
  map.getSource("rec-pos").setData(recPositionData());
}

function recAddPoint(lat, lng) {
  ensureRecordingLayers();
  var next = [lng, lat];
  var moved = recPts.length ? recMetres(recPts[recPts.length - 1], next) : Infinity;
  recPts.push(next);
  recDraw();

  if (recPts.length === 1) {
    /* The first fix. Always go there, however the map is set: it is the
       answer to "where am I", which is why the screen was opened. */
    map.easeTo({ center: next, zoom: FOLLOW_ZOOM, duration: 600 });
    recFollow = { following: true, offCentre: false };
    updateRecenterButton();
    return;
  }
  if (recShouldRecentre(recFollow, moved)) {
    map.easeTo({ center: next, duration: 900 });
  }
}

/**
 * Where you are, before anything is being recorded.
 *
 * Kept out of the track: a point shown while waiting at the car park is not
 * part of the walk, and adding it would draw a line from the car park to
 * wherever the first real fix lands.
 */
function recLocate(lat, lng) {
  ensureRecordingLayers();
  if (recPts.length) return;
  map.getSource("rec-pos").setData({
    type: "FeatureCollection",
    features: [{
      type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] },
      properties: { kind: "here" },
    }],
  });
  if (recFollow.following) map.easeTo({ center: [lng, lat], zoom: FOLLOW_ZOOM, duration: 600 });
}

function recReplay(points) {
  ensureRecordingLayers();
  recPts = [];
  for (var i = 0; i < points.length; i++) {
    /* The recorder sends [lat, lng]; the map wants [lng, lat]. */
    recPts.push([points[i][1], points[i][0]]);
  }
  recDraw();
  if (recPts.length > 1) recFitTrack();
  else if (recPts.length === 1) map.easeTo({ center: recPts[0], zoom: FOLLOW_ZOOM, duration: 0 });
}

function recPlanned(points) {
  ensureRecordingLayers();
  var coords = [];
  for (var i = 0; i < points.length; i++) coords.push([points[i][1], points[i][0]]);
  map.getSource("rec-planned").setData(recLine(coords));
  /* Framed only when there is no track yet: once recording, the walker's own
     position is what the map is for. */
  if (coords.length > 1 && !recPts.length) recFitBounds(coords);
}

function recClearTrack() {
  recPts = [];
  if (map.getSource("rec-track")) recDraw();
}

function recBounds(coords) {
  var b = new maplibregl.LngLatBounds(coords[0], coords[0]);
  for (var i = 1; i < coords.length; i++) b.extend(coords[i]);
  return b;
}

function recFitBounds(coords) {
  if (!coords.length) return;
  map.fitBounds(recBounds(coords), { padding: 64, maxZoom: 16, duration: 0 });
}

function recFitTrack() { recFitBounds(recPts); }

function recRecentre() {
  recFollow = { following: true, offCentre: false };
  updateRecenterButton();
  if (recPts.length) map.easeTo({ center: recPts[recPts.length - 1], zoom: FOLLOW_ZOOM, duration: 600 });
}

/* ── Chrome ─────────────────────────────────────────────────────────────── */

function updateRecenterButton() {
  if (!recRecentreBtn) return;
  /* Shown only when it would do something. A button that recentres an
     already-centred map is a button that teaches people to ignore it. */
  recRecentreBtn.style.display = recFollow.offCentre ? "flex" : "none";
}

function buildRecenterButton() {
  if (recRecentreBtn) return;
  recRecentreBtn = document.createElement("button");
  recRecentreBtn.type = "button";
  recRecentreBtn.setAttribute("aria-label", "Recentre on my position");
  recRecentreBtn.style.cssText = [
    "position:absolute", "right:12px", "bottom:96px", "z-index:6",
    "width:44px", "height:44px", "border-radius:22px", "display:none",
    "align-items:center", "justify-content:center", "cursor:pointer",
    "background:rgba(11,20,24,.92)", "border:1px solid rgba(255,255,255,.16)",
    "box-shadow:0 2px 10px rgba(0,0,0,.4)",
  ].join(";");
  recRecentreBtn.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F4F7F6" stroke-width="2">' +
    '<circle cx="12" cy="12" r="7"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg>';
  recRecentreBtn.onclick = recRecentre;
  document.body.appendChild(recRecentreBtn);
}

/**
 * Put away what gets in the way on a hill, keep what gets used.
 *
 * Search and route drawing both live at the top of the screen, over the track,
 * and neither is something anybody does mid-walk. The basemap switch and the
 * way back to your own position are the opposite.
 */
function setRecording(on) {
  recording = !!on;
  ensureRecordingLayers();
  buildRecenterButton();
  var chrome = recChromeFor(recording);

  if (typeof setSearchVisible === "function") setSearchVisible(chrome.search);
  var railDraw = document.getElementById("railDraw");
  if (railDraw) railDraw.style.display = chrome.planning ? "" : "none";
  if (recording && typeof setDrawing === "function" && typeof drawing !== "undefined" && drawing) {
    setDrawing(false);
    if (typeof syncControls === "function") syncControls();
  }
  if (recording && typeof hideSummitCard === "function") hideSummitCard();
  updateRecenterButton();
  post({ type: "recordingMode", on: recording });
}
`.trim();
}
