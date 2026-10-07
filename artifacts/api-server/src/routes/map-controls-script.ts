/**
 * The control rail, rebuilt as three icons.
 *
 * Twelve buttons stacked down the edge, all the same size and weight, so
 * nothing read as primary. This replaces them with what the established
 * hiking apps settled on: layers, locate, and one pencil that starts a route.
 * Everything else appears when it becomes relevant and goes away again.
 *
 * WHY IT DELEGATES RATHER THAN REPLACES. The original panel stays in the page,
 * hidden. Its buttons remain the mechanism: this rail calls the same functions
 * they call, and mirrors their enabled state rather than deciding its own.
 *
 * That is not timidity about deleting code. It is that "when is Undo
 * available" is a question with one right answer, and a second copy of it
 * would drift. It also keeps this change out of the parts of the map file
 * that another branch is editing — the globe and terrain work lives a few
 * hundred lines away and would collide with a rewritten panel.
 */
export function mapControlsScript(hasGpx: boolean): string {
  return `
/* ── Controls ───────────────────────────────────────────────────────────── */

var HAS_GPX = ${hasGpx ? "true" : "false"};
var CONTROL_INK = "#0B1418";
var CONTROL_FACE = "rgba(11,20,24,.9)";
var CONTROL_EDGE = "rgba(255,255,255,.14)";
var CONTROL_ON = "#F2C14E";

function controlButton(label, glyph) {
  var b = document.createElement("button");
  b.type = "button";
  b.setAttribute("aria-label", label);
  b.title = label;
  b.innerHTML = glyph;
  b.style.cssText = [
    "width:44px", "height:44px", "border-radius:22px",
    "background:" + CONTROL_FACE, "border:1px solid " + CONTROL_EDGE,
    "color:#F4F7F6", "cursor:pointer", "display:flex",
    "align-items:center", "justify-content:center", "padding:0",
    "box-shadow:0 2px 10px rgba(0,0,0,.35)",
  ].join(";");
  return b;
}

/* Drawn rather than lettered: a glyph reads at a glance and does not need
   translating. Stroke colour follows the button so the pressed state carries
   through without a second rule. */
var ICON_LAYERS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/></svg>';
var ICON_LOCATE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg>';
var ICON_PENCIL = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20Z"/></svg>';

var panel = null;         // the original buttons, kept as the mechanism
var layersSheet = null;
var drawBar = null;
var routeBar = null;
var controlsBuilt = false;

function originalButton(id) { return document.getElementById(id); }

function buildControls() {
  if (controlsBuilt) return;
  panel = document.querySelector(".panel");
  if (!panel) return;
  /* Hidden, not removed: its buttons still carry the enabled state this rail
     reads, and the existing handlers still do the work. */
  panel.style.display = "none";
  controlsBuilt = true;

  var rail = document.createElement("div");
  rail.style.cssText = [
    "position:absolute", "top:12px", "right:12px", "z-index:4",
    "display:flex", "flex-direction:column", "gap:9px",
  ].join(";");

  var layersBtn = controlButton("Map layers", ICON_LAYERS);
  layersBtn.setAttribute("aria-expanded", "false");
  layersBtn.onclick = function () { toggleLayersSheet(); };

  var locateBtn = controlButton("Show my location", ICON_LOCATE);
  locateBtn.onclick = locateMe;

  var drawBtn = controlButton("Plan a route", ICON_PENCIL);
  drawBtn.id = "ctlDraw";
  drawBtn.onclick = function () { setDrawing(!drawing); syncControls(); };

  rail.appendChild(layersBtn);
  rail.appendChild(locateBtn);
  rail.appendChild(drawBtn);
  document.body.appendChild(rail);

  buildLayersSheet();
  buildDrawBar();
  buildRouteBar();

  /* The original panel decides when Undo, Save and the rest are available.
     Watching it keeps that decision in one place instead of two. */
  if (typeof MutationObserver === "function") {
    new MutationObserver(syncControls).observe(panel, {
      attributes: true, subtree: true, attributeFilter: ["disabled", "aria-pressed", "hidden"],
    });
  }
  syncControls();
}

function sheetShell() {
  var el = document.createElement("div");
  el.style.cssText = [
    "position:absolute", "z-index:5", "display:none",
    "background:" + CONTROL_FACE, "border:1px solid " + CONTROL_EDGE,
    "border-radius:10px", "padding:10px", "color:#F4F7F6",
    "font:400 13px/1.4 system-ui,-apple-system,sans-serif",
    "box-shadow:0 10px 30px rgba(0,0,0,.45)",
  ].join(";");
  return el;
}

function sheetButton(label) {
  var b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.style.cssText = [
    "display:block", "width:100%", "text-align:left", "padding:9px 11px",
    "margin:0", "border:0", "border-radius:7px", "background:transparent",
    "color:#F4F7F6", "font:400 13px system-ui,sans-serif", "cursor:pointer",
  ].join(";");
  return b;
}

function buildLayersSheet() {
  layersSheet = sheetShell();
  layersSheet.style.top = "66px";
  layersSheet.style.right = "12px";
  layersSheet.style.minWidth = "188px";

  var dim = document.createElement("div");
  dim.textContent = "View";
  dim.style.cssText = "color:#9FB0AC;font-size:11px;letter-spacing:.07em;text-transform:uppercase;padding:2px 11px 6px";
  layersSheet.appendChild(dim);

  /* 2D and 3D sit with the layers because both answer the same question:
     how is this map drawn. They were a separate pair of buttons for no
     reason other than that they arrived first. */
  var pair = document.createElement("div");
  pair.style.cssText = "display:flex;gap:6px;padding:0 7px 9px";
  [["2D", "2d"], ["3D", "3d"]].forEach(function (entry) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = entry[0];
    b.dataset.mode = entry[1];
    b.className = "ctlMode";
    b.style.cssText = "flex:1;padding:7px;border-radius:6px;border:1px solid " + CONTROL_EDGE +
      ";background:transparent;color:#F4F7F6;font:500 13px system-ui,sans-serif;cursor:pointer";
    b.onclick = function () { setMode(entry[1]); syncControls(); };
    pair.appendChild(b);
  });
  layersSheet.appendChild(pair);

  var flyRow = document.createElement("div");
  flyRow.style.cssText = "padding:0 7px 9px";
  var fly = document.createElement("button");
  fly.type = "button";
  fly.id = "ctlFly";
  fly.textContent = "Fly the route";
  fly.style.cssText = "width:100%;padding:7px;border-radius:6px;border:1px solid " + CONTROL_EDGE +
    ";background:transparent;color:#F4F7F6;font:500 13px system-ui,sans-serif;cursor:pointer";
  /* It belongs with the view controls because that is what it is. Without a
     home here, hiding the old panel left it unreachable and the feature
     quietly dead. */
  fly.onclick = function () { var o = originalButton("fly"); if (o && !o.disabled) o.click(); };
  flyRow.appendChild(fly);
  layersSheet.appendChild(flyRow);

  var head = document.createElement("div");
  head.textContent = "Map";
  head.style.cssText = "color:#9FB0AC;font-size:11px;letter-spacing:.07em;text-transform:uppercase;padding:2px 11px 4px;border-top:1px solid " + CONTROL_EDGE;
  layersSheet.appendChild(head);

  for (var i = 0; i < LAYERS.length; i++) {
    (function (layer) {
      var b = sheetButton(layer.label);
      b.dataset.layer = layer.id;
      b.className = "ctlLayer";
      b.onclick = function () {
        setLayer(layer.id);
        /* The old buttons posted this and the app's protocol documents it.
           Calling setLayer alone changes the map and tells nobody. */
        post({ type: "layerChanged", id: layer.id });
        syncControls();
        closeLayersSheet();
      };
      layersSheet.appendChild(b);
    })(LAYERS[i]);
  }
  document.body.appendChild(layersSheet);
}

function toggleLayersSheet() {
  var open = layersSheet.style.display === "block";
  layersSheet.style.display = open ? "none" : "block";
  var btn = document.querySelector('[aria-label="Map layers"]');
  if (btn) btn.setAttribute("aria-expanded", open ? "false" : "true");
  if (!open) syncControls();
}

function closeLayersSheet() {
  layersSheet.style.display = "none";
  var btn = document.querySelector('[aria-label="Map layers"]');
  if (btn) btn.setAttribute("aria-expanded", "false");
}

function buildDrawBar() {
  /* Only while drawing. Undo and Clear mean nothing before there is a line,
     and a disabled button is still something to read past. */
  drawBar = sheetShell();
  drawBar.style.left = "12px";
  /* Below the host screen's own Back and Saved routes chips, which sit at the
     very top left. Level with them, Follow paths and Undo end up underneath. */
  drawBar.style.top = "64px";
  drawBar.style.padding = "7px";
  drawBar.style.display = "none";

  var row = document.createElement("div");
  row.style.cssText = "display:flex;gap:6px;align-items:center";

  var follow = document.createElement("button");
  follow.type = "button";
  follow.id = "ctlFollow";
  follow.textContent = "Follow paths";
  follow.style.cssText = "padding:7px 10px;border-radius:6px;border:1px solid " + CONTROL_EDGE +
    ";background:transparent;color:#F4F7F6;font:500 13px system-ui,sans-serif;cursor:pointer";
  follow.onclick = function () { setSnapping(!snapping); syncControls(); };

  var undo = document.createElement("button");
  undo.type = "button";
  undo.id = "ctlUndo";
  undo.textContent = "Undo";
  undo.style.cssText = follow.style.cssText;
  undo.onclick = function () { undoPoint(); syncControls(); };

  var clear = document.createElement("button");
  clear.type = "button";
  clear.id = "ctlClear";
  clear.textContent = "Clear";
  clear.style.cssText = follow.style.cssText;
  clear.onclick = function () { clearRoute(); syncControls(); };

  var done = document.createElement("button");
  done.type = "button";
  done.textContent = "Done";
  done.style.cssText = "padding:7px 12px;border-radius:6px;border:0;background:" + CONTROL_ON +
    ";color:" + CONTROL_INK + ";font:600 13px system-ui,sans-serif;cursor:pointer";
  done.onclick = function () { setDrawing(false); syncControls(); };

  row.appendChild(follow); row.appendChild(undo); row.appendChild(clear); row.appendChild(done);
  drawBar.appendChild(row);
  document.body.appendChild(drawBar);
}

function buildRouteBar() {
  /* Saving and exporting appear once there is a route to save or export, and
     not a moment before. */
  routeBar = sheetShell();
  /* Above the route readout, not beside it.
     
     Beside it was my first attempt and it was wrong on a phone: the readout
     is up to 60% of the width and this bar is about half, so on a 400-pixel
     screen they still overlapped and the distance, ascent and save messages
     disappeared behind Save route. Stacking cannot collide at any width. */
  routeBar.style.left = "12px";
  routeBar.style.padding = "7px";

  var row = document.createElement("div");
  row.style.cssText = "display:flex;gap:6px";

  var save = document.createElement("button");
  save.type = "button";
  save.id = "ctlSave";
  save.textContent = "Save route";
  save.style.cssText = "padding:8px 12px;border-radius:6px;border:0;background:" + CONTROL_ON +
    ";color:" + CONTROL_INK + ";font:600 13px system-ui,sans-serif;cursor:pointer";
  save.onclick = function () { var o = originalButton("save"); if (o) o.click(); };
  row.appendChild(save);

  if (HAS_GPX) {
    var gpx = document.createElement("button");
    gpx.type = "button";
    gpx.id = "ctlGpx";
    gpx.textContent = "GPX";
    gpx.style.cssText = "padding:8px 12px;border-radius:6px;border:1px solid " + CONTROL_EDGE +
      ";background:transparent;color:#F4F7F6;font:500 13px system-ui,sans-serif;cursor:pointer";
    gpx.onclick = function () { var o = originalButton("gpx"); if (o) o.click(); };
    row.appendChild(gpx);
  }

  routeBar.appendChild(row);
  document.body.appendChild(routeBar);
  placeRouteBar();
  window.addEventListener("resize", placeRouteBar);
}

/**
 * Sit the bar clear of the readout, whatever height it happens to be.
 *
 * Measured rather than guessed: the readout is one line or two depending on
 * whether a section missed a path, and a fixed offset is wrong half the time.
 */
function placeRouteBar() {
  if (!routeBar) return;
  var hud = document.getElementById("hud");
  var bottom = 12;
  if (hud && !hud.hidden) {
    var box = hud.getBoundingClientRect();
    if (box.height > 0) {
      bottom = Math.max(12, Math.round(window.innerHeight - box.top) + 10);
    }
  }
  routeBar.style.bottom = bottom + "px";
}

function mirror(controlId, originalId) {
  var control = document.getElementById(controlId);
  var original = originalButton(originalId);
  if (!control || !original) return;
  control.disabled = original.disabled;
  control.style.opacity = original.disabled ? "0.45" : "1";
  control.style.cursor = original.disabled ? "default" : "pointer";
}

function syncControls() {
  if (!controlsBuilt) return;

  var drawBtn = document.getElementById("ctlDraw");
  if (drawBtn) {
    drawBtn.style.background = drawing ? CONTROL_ON : CONTROL_FACE;
    drawBtn.style.color = drawing ? CONTROL_INK : "#F4F7F6";
    drawBtn.setAttribute("aria-pressed", drawing ? "true" : "false");
  }
  if (drawBar) drawBar.style.display = drawing ? "block" : "none";

  var follow = document.getElementById("ctlFollow");
  if (follow) {
    follow.style.background = snapping ? CONTROL_ON : "transparent";
    follow.style.color = snapping ? CONTROL_INK : "#F4F7F6";
    follow.setAttribute("aria-pressed", snapping ? "true" : "false");
    var snapOriginal = originalButton("snap");
    follow.disabled = !!(snapOriginal && snapOriginal.disabled);
  }

  mirror("ctlFly", "fly");
  mirror("ctlUndo", "undo");
  mirror("ctlClear", "clear");
  mirror("ctlSave", "save");
  mirror("ctlGpx", "gpx");

  /* The bar earns its place by there being something to save. */
  var saveOriginal = originalButton("save");
  if (routeBar) {
    routeBar.style.display = saveOriginal && !saveOriginal.disabled ? "block" : "none";
    placeRouteBar();
  }

  var modes = document.querySelectorAll(".ctlMode");
  for (var i = 0; i < modes.length; i++) {
    var on = modes[i].dataset.mode === mode;
    modes[i].style.background = on ? CONTROL_ON : "transparent";
    modes[i].style.color = on ? CONTROL_INK : "#F4F7F6";
    modes[i].setAttribute("aria-pressed", on ? "true" : "false");
  }

  var choices = document.querySelectorAll(".ctlLayer");
  for (var j = 0; j < choices.length; j++) {
    var active = choices[j].dataset.layer === activeLayer;
    choices[j].style.background = active ? "rgba(242,193,78,.18)" : "transparent";
    choices[j].style.fontWeight = active ? "600" : "400";
  }
}

/**
 * Draw where the person is.
 *
 * The button used to centre the map and nothing else, which is not what
 * anybody means by "show my location" — it moved the view and left them
 * guessing which part of it was them.
 *
 * Two marks: a soft circle for how certain the fix is, and a solid dot for
 * the position. The halo is the honest part. A bare dot claims a precision
 * that a phone on a hillside does not have.
 */
function showMyLocation(lng, lat, accuracyM) {
  if (!map.getSource("me")) {
    map.addSource("me", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
      id: "me-accuracy", type: "circle", source: "me",
      paint: {
        "circle-color": "#4C9BE8", "circle-opacity": 0.18,
        "circle-stroke-color": "#4C9BE8", "circle-stroke-opacity": 0.4, "circle-stroke-width": 1,
        /* Metres on the ground rather than pixels, so the circle keeps
           meaning the same thing as the map is zoomed. */
        "circle-radius": ["interpolate", ["exponential", 2], ["zoom"],
          0, 0, 22, ["/", ["get", "accuracyM"], 0.0187]],
      },
    });
    map.addLayer({
      id: "me-dot", type: "circle", source: "me",
      paint: {
        "circle-color": "#4C9BE8", "circle-radius": 7,
        "circle-stroke-color": "#FFFFFF", "circle-stroke-width": 2.5,
      },
    });
  }
  map.getSource("me").setData({
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: { accuracyM: accuracyM > 0 ? accuracyM : 0 },
    }],
  });
}

function locateMe() {
  if (!navigator.geolocation) {
    /* Named rather than silent. A button that does nothing is worse than one
       that says why. */
    post({ type: "locateUnavailable" });
    return;
  }
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      showMyLocation(pos.coords.longitude, pos.coords.latitude, pos.coords.accuracy || 0);
      map.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: Math.max(map.getZoom(), 13), duration: 600 });
      post({ type: "located", lat: pos.coords.latitude, lng: pos.coords.longitude,
             accuracyM: pos.coords.accuracy || null });
    },
    function (err) {
      /* Which kind of failure matters: refused permission is the person's to
         change, a timeout on a hillside is not. */
      post({ type: "locateDenied", reason: err && err.code === 1 ? "permission" : "unavailable" });
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
  );
}
`.trim();
}
