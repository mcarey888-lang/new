import { Router, type IRouter } from "express";

const router: IRouter = Router();

function buildHtml(osKey: string | undefined): string {
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
<title>Live Track</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;background:#050D1A;overflow:hidden}
#map{position:absolute;inset:0}
#pill{
  display:none;position:absolute;bottom:14px;left:50%;transform:translateX(-50%);
  background:rgba(0,0,0,0.65);color:rgba(255,255,255,0.75);
  font-family:system-ui,sans-serif;font-size:11px;padding:5px 12px;
  border-radius:16px;z-index:1000;pointer-events:none;white-space:nowrap;
}
#waiting{
  position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  background:#050D1A;font-family:system-ui,sans-serif;
  color:rgba(255,255,255,0.35);font-size:13px;z-index:2000;
}
.leaflet-control-zoom a{background:rgba(20,20,20,0.88)!important;color:#fff!important;border-color:rgba(255,255,255,0.15)!important}
.leaflet-control-attribution{font-size:9px!important;background:rgba(0,0,0,0.55)!important;color:rgba(255,255,255,0.4)!important}
.leaflet-control-attribution a{color:rgba(255,255,255,0.35)!important}
</style>
</head>
<body>
<div id="waiting">Waiting for GPS…</div>
<div id="map"></div>
<div id="pill"></div>
<script>
var map = L.map("map", { zoomControl: true, attributionControl: true }).setView([54.0, -2.0], 6);
L.tileLayer(${JSON.stringify(tileUrl)}, {
  maxZoom: 20,
  attribution: ${JSON.stringify(attribution)}
}).addTo(map);

var pts = [];
var polyline = L.polyline([], {
  color: "#3ECF75", weight: 4.5, opacity: 0.92,
  lineCap: "round", lineJoin: "round"
}).addTo(map);

var glowLine = L.polyline([], {
  color: "rgba(62,207,117,0.25)", weight: 10, opacity: 1,
  lineCap: "round", lineJoin: "round", interactive: false
}).addTo(map);

var posMarker = null;
var startMarker = null;

function addPoint(lat, lng) {
  var p = [lat, lng];
  pts.push(p);
  polyline.setLatLngs(pts);
  glowLine.setLatLngs(pts);

  if (!posMarker) {
    document.getElementById("waiting").style.display = "none";
    document.getElementById("pill").style.display = "block";

    startMarker = L.circleMarker(p, {
      radius: 6, fillColor: "#fff", color: "#3ECF75", weight: 3, fillOpacity: 1
    }).bindTooltip("Start", { permanent: false, direction: "top" }).addTo(map);

    posMarker = L.circleMarker(p, {
      radius: 9, fillColor: "#3ECF75", color: "#fff", weight: 3, fillOpacity: 1
    }).addTo(map);

    map.setView(p, 15);
  } else {
    posMarker.setLatLng(p);
    if (pts.length > 3 && pts.length % 5 === 0) {
      map.fitBounds(polyline.getBounds(), { padding: [48, 48], maxZoom: 17, animate: true });
    }
  }

  var dist = 0;
  for (var i = 1; i < pts.length; i++) {
    var dLat = (pts[i][0] - pts[i-1][0]) * Math.PI / 180;
    var dLng = (pts[i][1] - pts[i-1][1]) * Math.PI / 180;
    var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
            Math.cos(pts[i-1][0]*Math.PI/180)*Math.cos(pts[i][0]*Math.PI/180)*
            Math.sin(dLng/2)*Math.sin(dLng/2);
    dist += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  document.getElementById("pill").textContent =
    dist < 1 ? Math.round(dist * 1000) + " m tracked" : dist.toFixed(2) + " km tracked";
}

// Receive messages from React Native (injectJavaScript calls addPoint/clearTrack)
document.addEventListener("message", function(e) {
  try {
    var msg = JSON.parse(e.data);
    if (msg.type === "point") addPoint(msg.lat, msg.lng);
    if (msg.type === "clear") {
      pts = []; polyline.setLatLngs([]); glowLine.setLatLngs([]);
      if (posMarker) { map.removeLayer(posMarker); posMarker = null; }
      if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
      document.getElementById("waiting").style.display = "flex";
      document.getElementById("pill").style.display = "none";
    }
  } catch(err) {}
});
window.addEventListener("message", function(e) {
  try {
    var msg = JSON.parse(e.data);
    if (msg.type === "point") addPoint(msg.lat, msg.lng);
    if (msg.type === "clear") {
      pts = []; polyline.setLatLngs([]); glowLine.setLatLngs([]);
      if (posMarker) { map.removeLayer(posMarker); posMarker = null; }
      if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
      document.getElementById("waiting").style.display = "flex";
      document.getElementById("pill").style.display = "none";
    }
  } catch(err) {}
});
</script>
</body>
</html>`;
}

router.get("/hike-map", (_req, res) => {
  const osKey = process.env.OS_MAPS_KEY;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(buildHtml(osKey));
});

export default router;
