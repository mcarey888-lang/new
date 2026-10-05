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
  if (!summitShouldRefetch(summitLoaded, next)) return;

  /* Each request carries a generation. An answer for a view the map has since
     left is dropped, because otherwise a slow reply lands after a newer one
     and the pins jump back to where they used to be. */
  var token = ++summitRequest;
  if (summitAbort) summitAbort.abort();
  summitAbort = typeof AbortController === "function" ? new AbortController() : null;

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
              classification: s.classification,
              place: s.place,
            },
          };
        }),
      });
      summitLoaded = {
        minLat: next.minLat, maxLat: next.maxLat,
        minLng: next.minLng, maxLng: next.maxLng,
        band: band,
        truncated: !!(data && data.truncated),
      };
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
