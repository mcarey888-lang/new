/** Parking interactions for the shared map. Planning taps never change parking confidence. */
export function parkingDirectionsScript(): string {
  return `
var parkingPopup = null;
function closeParkingPopup() {
  if (parkingPopup) { parkingPopup.remove(); parkingPopup = null; }
}
function parkingAt(event) {
  if (!event.point || !map.getLayer("parking-dot")) return null;
  var p = event.point;
  var hits = map.queryRenderedFeatures([[p.x - 22, p.y - 22], [p.x + 22, p.y + 22]], {
    layers: ["parking-dot"]
  });
  return hits && hits[0] || null;
}
function handleParkingTap(feature) {
  if (typeof drawing === "undefined" || !drawing) {
    showParkingPopup(feature);
    return;
  }
  var coordinates = feature.geometry && feature.geometry.coordinates;
  if (!coordinates || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1]) ||
      Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90) return;
  closeParkingPopup();
  // Use the pin itself, not the nearby finger position in its generous hit area.
  var point = { lng: coordinates[0], lat: coordinates[1] };
  post({ type: "tap", lat: point.lat, lng: point.lng });
  addPoint(point);
}
function parkingWebUrl(provider, lat, lng, label, agent) {
  var destination = lat + "," + lng;
  var google = "https://www.google.com/maps/dir/?api=1&destination=" +
    encodeURIComponent(destination) + "&travelmode=driving";
  if (provider === "waze") return "https://www.waze.com/ul?ll=" + encodeURIComponent(destination) + "&navigate=yes";
  if (provider === "google") return google;
  if (/android/i.test(agent)) {
    return "intent://0,0?q=" + encodeURIComponent(destination + "(" + label + ")") +
      "#Intent;scheme=geo;S.browser_fallback_url=" + encodeURIComponent(google) + ";end";
  }
  if (/iphone|ipad|ipod/i.test(agent)) return "https://maps.apple.com/?daddr=" +
    encodeURIComponent(destination) + "&dirflg=d";
  return google;
}
function showParkingPopup(feature) {
  var coordinates = feature.geometry && feature.geometry.coordinates;
  if (!coordinates || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1]) ||
      Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90) return;
  closeParkingPopup();
  var lng = coordinates[0], lat = coordinates[1], props = feature.properties || {};
  var label = typeof props.name === "string" ? props.name.slice(0, 200) : "Car park";
  var body = document.createElement("div");
  body.addEventListener("click", function (event) { event.stopPropagation(); });
  var title = document.createElement("strong");
  title.textContent = label;
  body.appendChild(title);
  var note = document.createElement("p");
  note.textContent = props.status === "gps_confirmed"
    ? "Visited by a walker. Check current access, charges and signs."
    : "Mapped parking — unconfirmed. Check vehicle access and local signs before travelling.";
  body.appendChild(note);
  function addLink(provider, text, primary) {
    var link = document.createElement("a");
    link.textContent = text;
    link.className = primary ? "parking-directions-main" : "parking-directions-option";
    link.setAttribute("aria-label", text + " to " + label);
    link.href = parkingWebUrl(provider, lat, lng, label, navigator.userAgent);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.onclick = function (event) {
      event.stopPropagation();
      if (window.ReactNativeWebView) {
        event.preventDefault();
        post({ type: "parkingDirections", lat: lat, lng: lng, name: label, provider: provider });
      }
    };
    body.appendChild(link);
  }
  addLink("default", "↗ Directions", true);
  addLink("google", "Google Maps", false);
  addLink("waze", "Waze", false);
  parkingPopup = new maplibregl.Popup({
    closeButton: true, closeOnClick: true, offset: 14, maxWidth: "260px", className: "parking-popup"
  }).setLngLat([lng, lat]).setDOMContent(body).addTo(map);
}
`;
}
