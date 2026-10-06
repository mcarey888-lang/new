import { ALL_SUMMITS_ZOOM, MIN_PIN_ZOOM, zoomBandTable } from "../services/summits/summitPins";
import { shouldRefetchSource } from "../services/summits/summitViewport";

/**
 * The summit layer, as a script the map page includes.
 *
 * Kept out of `route-map-web.ts` deliberately. That file carries the globe and
 * terrain work and is edited on two branches at once; a hundred lines of
 * clustering dropped into the middle of it would collide with every change
 * anybody else makes. Here it is one function, and the page gains one line.
 *
 * The clustering itself is MapLibre's. What needed care is everything around
 * it: not asking the server on every frame, not letting a slow answer
 * overwrite a newer one, and saying so when the list came back cut short.
 */
export function summitLayerScript(summitsUrl: string): string {
  const bands = JSON.stringify(zoomBandTable());
  return `
/* ── Summit pins ────────────────────────────────────────────────────────── */

var SUMMITS_URL = ${JSON.stringify(summitsUrl)};
var SUMMIT_BANDS = ${bands};
var SUMMIT_MIN_ZOOM = ${MIN_PIN_ZOOM};
var SUMMIT_ALL_ZOOM = ${ALL_SUMMITS_ZOOM};
var SUMMIT_COLOR = "#F2C14E";
var SUMMIT_INK = "#0B1418";

/* Generated from the server's own ladder, so the map and the query cannot
   disagree about which hills belong at a zoom. */
function summitBandFor(zoom) {
  for (var i = 0; i < SUMMIT_BANDS.length; i++) {
    if (zoom >= SUMMIT_BANDS[i][0]) return SUMMIT_BANDS[i][1];
  }
  return "none";
}

/* Serialised from the server module that the tests exercise. One
   implementation, not two. */
var summitShouldRefetch = ${shouldRefetchSource()};

var summitLoaded = null;       // the rectangle and band currently held
var summitRequest = 0;         // generation, so a slow answer cannot win
var summitAbort = null;
var summitPending = null;   // the view the in-flight request is for
var summitTimer = null;
var summitsOn = false;

function summitEmpty() { return { type: "FeatureCollection", features: [] }; }

function addSummitLayers() {
  map.addSource("summits", {
    type: "geojson",
    data: summitEmpty(),
    cluster: true,
    /* Stop clustering where the map starts showing everything: past this, two
       pins close together are two real hills and merging them hides one. */
    clusterMaxZoom: SUMMIT_ALL_ZOOM,
    clusterRadius: 48,
  });

  map.addLayer({
    id: "summit-cluster", type: "circle", source: "summits",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": SUMMIT_COLOR,
      "circle-opacity": 0.92,
      /* Grows with what it holds, but slowly — area reads as quantity, so a
         linear radius would make a cluster of fifty look ten times a cluster
         of five. */
      "circle-radius": ["step", ["get", "point_count"], 15, 10, 19, 50, 24, 200, 30],
      "circle-stroke-color": SUMMIT_INK,
      "circle-stroke-width": 2,
    },
  });

  map.addLayer({
    id: "summit-cluster-count", type: "symbol", source: "summits",
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-size": 12,
      "text-font": ["Noto Sans Bold", "Open Sans Bold", "Arial Unicode MS Bold"],
      "text-allow-overlap": true,
    },
    paint: { "text-color": SUMMIT_INK },
  });

  map.addLayer({
    id: "summit-point", type: "circle", source: "summits",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": SUMMIT_COLOR,
      "circle-radius": 6,
      "circle-stroke-color": SUMMIT_INK,
      "circle-stroke-width": 2,
    },
  });

  map.addLayer({
    id: "summit-label", type: "symbol", source: "summits",
    filter: ["!", ["has", "point_count"]],
    /* Names only once there is room for them. Earlier they collide into an
       unreadable mat, and MapLibre drops most of them anyway. */
    minzoom: 10,
    layout: {
      "text-field": ["get", "name"],
      "text-size": 11,
      "text-font": ["Noto Sans Regular", "Open Sans Regular", "Arial Unicode MS Regular"],
      "text-offset": [0, 1.1],
      "text-anchor": "top",
      "text-optional": true,
    },
    paint: {
      "text-color": "#F4F7F6",
      "text-halo-color": SUMMIT_INK,
      "text-halo-width": 1.4,
    },
  });

  /* A cluster opens rather than selects: tapping one asks the map how far in
     it has to go before these separate, and goes there. */
  map.on("click", "summit-cluster", function (e) {
    var feature = e.features && e.features[0];
    if (!feature) return;
    map.getSource("summits").getClusterExpansionZoom(feature.properties.cluster_id)
      .then(function (zoom) {
        map.easeTo({ center: feature.geometry.coordinates, zoom: zoom, duration: 420 });
      })
      .catch(function () { /* A cluster that has gone is not worth reporting. */ });
  });

  map.on("click", "summit-point", function (e) {
    var feature = e.features && e.features[0];
    if (!feature) return;
    var p = feature.properties || {};
    showSummitCard(p, feature.geometry.coordinates);
    post({
      type: "summitSelected",
      id: p.id,
      name: p.name,
      alternativeName: p.alternativeName || null,
      heightM: p.heightM === undefined || p.heightM === null || p.heightM === "" ? null : Number(p.heightM),
      classification: p.classification || null,
      place: p.place || null,
      lat: feature.geometry.coordinates[1],
      lng: feature.geometry.coordinates[0],
    });
  });

  var pointer = function () { map.getCanvas().style.cursor = "pointer"; };
  var normal = function () { map.getCanvas().style.cursor = ""; };
  map.on("mouseenter", "summit-cluster", pointer);
  map.on("mouseleave", "summit-cluster", normal);
  map.on("mouseenter", "summit-point", pointer);
  map.on("mouseleave", "summit-point", normal);
}

/* ── The card a tapped summit opens ─────────────────────────────────────── */

var summitCard = null;
var summitCardFor = null;

function ensureSummitCard() {
  if (summitCard) return summitCard;
  summitCard = document.createElement("div");
  summitCard.id = "summitCard";
  summitCard.setAttribute("role", "dialog");
  summitCard.setAttribute("aria-label", "Summit details");
  /* Built here rather than in the page so the map file gains nothing but the
     call that starts this layer. */
  summitCard.style.cssText = [
    "position:absolute", "left:12px", "right:12px", "bottom:12px", "z-index:5",
    "max-width:420px", "margin:0 auto", "display:none",
    "background:rgba(11,20,24,.96)", "color:#F4F7F6",
    "border:1px solid rgba(242,193,78,.35)", "border-radius:10px",
    "padding:14px 16px", "box-shadow:0 10px 30px rgba(0,0,0,.45)",
    "font:400 14px/1.45 system-ui,-apple-system,sans-serif",
  ].join(";");
  document.body.appendChild(summitCard);
  return summitCard;
}

function summitCardText(p) {
  /* Height, list and place on one line, in that order, because that is the
     order somebody reads them: what it is, how big, where. Any part that is
     missing is left out rather than filled with a dash. */
  var bits = [];
  if (p.classification) bits.push(String(p.classification));
  if (p.heightM !== null && p.heightM !== undefined && p.heightM !== "") {
    bits.push(Math.round(Number(p.heightM)) + " m");
  }
  if (p.place) bits.push(String(p.place));
  return bits.join(" · ");
}

function summitAscentLine(p) {
  /* Nothing at all when it is not known, and it almost never is: the
     catalogue holds a couple of dozen route ascents against twenty-one
     thousand hills. A dash or a zero here would read as a flat walk. */
  var metres = p.ascentM;
  if (metres === null || metres === undefined || metres === "" || Number(metres) <= 0) return "";
  var route = p.ascentRoute;
  return route ? Math.round(Number(metres)) + " m of climbing via " + route
               : Math.round(Number(metres)) + " m of climbing";
}

function escapeSummitText(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showSummitCard(p, coordinates) {
  var card = ensureSummitCard();
  summitCardFor = { id: p.id, lat: coordinates[1], lng: coordinates[0], name: p.name };

  var ascent = summitAscentLine(p);
  card.innerHTML =
    '<button type="button" id="summitCardClose" aria-label="Close" ' +
      'style="position:absolute;top:8px;right:10px;background:none;border:0;color:#9FB0AC;' +
      'font-size:20px;line-height:1;cursor:pointer">&times;</button>' +
    /* The card itself opens the mountain. Tapping a pin should show you what
       it is without taking you anywhere; wanting more is a second deliberate
       tap, which is how every map app people already use behaves. */
    '<div id="summitCardOpen" role="button" tabindex="0" ' +
      'style="cursor:pointer;padding-right:24px">' +
    '<div style="font:600 17px/1.25 system-ui,sans-serif">' +
      escapeSummitText(p.name) + '</div>' +
    (p.alternativeName
      ? '<div style="color:#9FB0AC;font-size:13px;margin-top:2px">' + escapeSummitText(p.alternativeName) + '</div>'
      : '') +
    '<div style="color:#C8D4D1;margin-top:7px">' + escapeSummitText(summitCardText(p)) + '</div>' +
    (ascent ? '<div style="color:#C8D4D1;margin-top:3px">' + escapeSummitText(ascent) + '</div>' : '') +
    '<div style="color:#8E9D99;font-size:12px;margin-top:8px">Tap for routes and detail</div>' +
    '</div>' +
    '<button type="button" id="summitPlanRoute" ' +
      'style="margin-top:12px;width:100%;padding:10px;border:0;border-radius:7px;' +
      'background:#F2C14E;color:#0B1418;font:600 14px system-ui,sans-serif;cursor:pointer">' +
      'Plan a route from here</button>';
  card.style.display = "block";

  document.getElementById("summitCardClose").onclick = hideSummitCard;

  var open = document.getElementById("summitCardOpen");
  var openMountain = function () {
    /* Everything the mountain page asks for by name. The catalogue id makes
       the lookup exact; the rest is what it falls back to. */
    post({ type: "openMountain", catalogueId: p.id, name: p.name,
           region: p.area || null, country: p.country || null });
  };
  open.onclick = openMountain;
  open.onkeydown = function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openMountain(); }
  };

  document.getElementById("summitPlanRoute").onclick = function () {
    /* Handled here rather than by the app: starting a route from a summit is
       the map's own job, and a round trip to ask permission would only add a
       way for it to fail. The app is told so it can follow along. */
    var at = { lng: summitCardFor.lng, lat: summitCardFor.lat };
    post({ type: "planRouteFrom", id: summitCardFor.id, name: summitCardFor.name,
           lat: summitCardFor.lat, lng: summitCardFor.lng });
    hideSummitCard();
    if (typeof setDrawing === "function" && typeof addPoint === "function") {
      if (!drawing) setDrawing(true);
      addPoint(at);
      if (typeof syncControls === "function") syncControls();
    }
  };
}

function hideSummitCard() {
  if (summitCard) summitCard.style.display = "none";
  summitCardFor = null;
}

function summitVisibility(on) {
  var layers = ["summit-cluster", "summit-cluster-count", "summit-point", "summit-label"];
  for (var i = 0; i < layers.length; i++) {
    if (map.getLayer(layers[i])) {
      map.setLayoutProperty(layers[i], "visibility", on ? "visible" : "none");
    }
  }
}

function setSummitsOn(on) {
  summitsOn = !!on;
  if (!summitsOn) hideSummitCard();
  summitVisibility(summitsOn);
  if (summitsOn) requestSummits();
  else summitNotice(null);
}

function summitNotice(text) {
  var el = document.getElementById("summitNote");
  if (!el) return;
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
}

function requestSummits() {
  if (!summitsOn || !map.getSource("summits")) return;

  var zoom = map.getZoom();
  var band = summitBandFor(zoom);
  if (band === "none") {
    /* Not an error and not an empty map by accident: at this scale there is
       nothing worth drawing, and the person is looking at a whole hemisphere. */
    map.getSource("summits").setData(summitEmpty());
    summitLoaded = null;
    summitNotice(null);
    return;
  }

  var b = map.getBounds();
  var next = {
    minLat: b.getSouth(), maxLat: b.getNorth(),
    minLng: b.getWest(), maxLng: b.getEast(),
    band: band,
  };
  if (!summitShouldRefetch(summitLoaded, next)) {
    /* Nothing to ask for. But a request may still be in flight for somewhere
       the map has since left, and letting it run costs a round trip whose
       answer will only be thrown away. */
    if (summitAbort && summitPending && summitShouldRefetch(summitPending, next)) {
      summitAbort.abort();
      summitAbort = null;
      summitPending = null;
    }
    return;
  }

  /* Each request carries a generation. An answer for a view the map has since
     left is dropped, because otherwise a slow reply lands after a newer one
     and the pins jump back to where they used to be. */
  var token = ++summitRequest;
  if (summitAbort) summitAbort.abort();
  summitAbort = typeof AbortController === "function" ? new AbortController() : null;
  summitPending = { minLat: next.minLat, maxLat: next.maxLat, minLng: next.minLng, maxLng: next.maxLng, band: band, truncated: false };

  var url = SUMMITS_URL + "?bbox=" +
    [next.minLng, next.minLat, next.maxLng, next.maxLat].map(function (n) { return n.toFixed(5); }).join(",") +
    "&zoom=" + Math.round(zoom);

  fetch(url, summitAbort ? { signal: summitAbort.signal } : undefined)
    .then(function (r) {
      if (!r.ok) throw new Error("summits " + r.status);
      return r.json();
    })
    .then(function (data) {
      if (token !== summitRequest) return;

      /* The guard above asks whether this is the newest request. That is not
         the same question as whether it still answers anything.
         
         Pan to Ben Nevis and straight back to Snowdonia: the return journey
         issues no request at all, because Snowdonia is already loaded. So the
         Ben Nevis request stays the newest, arrives, and is accepted — and
         the map, sitting over Snowdonia, is handed Ben Nevis's hills and
         shows none at all. Silently, with no error anywhere.
         
         So the real test is whether this answer covers where the map is NOW.
         If it does not, it is an answer to a question nobody is asking any
         more, and the pins already on screen are the better ones to keep. */
      var covered = (data && data.covered) || null;
      var arriving = {
        minLat: covered ? covered.minLat : next.minLat,
        maxLat: covered ? covered.maxLat : next.maxLat,
        minLng: covered ? covered.minLng : next.minLng,
        maxLng: covered ? covered.maxLng : next.maxLng,
        band: band,
        truncated: !!(data && data.truncated),
      };
      var bounds = map.getBounds();
      var here = {
        minLat: bounds.getSouth(), maxLat: bounds.getNorth(),
        minLng: bounds.getWest(), maxLng: bounds.getEast(),
        band: summitBandFor(map.getZoom()),
      };
      if (summitShouldRefetch(arriving, here)) {
        /* Not for here. Leave what is drawn alone and let the next move ask
           again for the right place. */
        return;
      }

      summitPending = null;
      var pins = (data && data.summits) || [];
      map.getSource("summits").setData({
        type: "FeatureCollection",
        features: pins.map(function (s) {
          return {
            type: "Feature",
            geometry: { type: "Point", coordinates: [s.lng, s.lat] },
            properties: {
              id: s.id, name: s.name,
              alternativeName: s.alternativeName,
              heightM: s.heightM,
              prominenceM: s.prominenceM,
              classification: s.classification,
              place: s.place,
              country: s.country,
              area: s.area,
              /* Flattened: MapLibre feature properties are a flat bag, and an
                 object arrives at the other end as "[object Object]". */
              ascentM: s.ascent && s.ascent.kind === "known" ? s.ascent.metres : null,
              ascentRoute: s.ascent && s.ascent.kind === "known" ? s.ascent.routeName : null,
            },
          };
        }),
      });
      /* What the server actually searched, which is wider than what was
         asked for. Recording the narrower rectangle made every small pan look
         like new ground and asked again for hills already held. */
      summitLoaded = arriving;
      /* Said plainly. A map quietly showing the biggest few hundred, with no
         hint that there are more, is a map that lies by omission. */
      summitNotice(summitLoaded.truncated ? "Showing the most prominent hills — zoom in for the rest" : null);
    })
    .catch(function (err) {
      if (err && err.name === "AbortError") return;
      if (token !== summitRequest) return;
      /* Names the failure rather than leaving an empty map that looks like
         ground with no hills on it. */
      summitNotice("Could not load summits");
    });
}

function scheduleSummits() {
  if (summitTimer) clearTimeout(summitTimer);
  /* Panning fires continuously. A short wait turns a drag across the country
     into one request instead of forty. */
  summitTimer = setTimeout(requestSummits, 220);
}
`.trim();
}
