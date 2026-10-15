/** Initial camera positioning only. Never supplies recorded GPS evidence. */
export function initialMapLocationScript(): string {
  return `
var initialLocationPending = true;

function cancelInitialLocation() { initialLocationPending = false; }

function initialLocationAllowed() {
  return initialLocationPending &&
    !(typeof recording !== "undefined" && recording) &&
    !(typeof drawing !== "undefined" && drawing) &&
    !(typeof anchors !== "undefined" && anchors.length) &&
    !(typeof recPts !== "undefined" && recPts.length) &&
    !(typeof summitDestination !== "undefined" && summitDestination);
}

function initialLocationFailed(reason) {
  if (!initialLocationPending) return;
  initialLocationPending = false;
  var button = document.querySelector('[aria-label="Show my location"]');
  if (button) {
    button.title = "Location unavailable — tap to retry";
    button.setAttribute("aria-label", "Location unavailable — tap to retry");
  }
  post({ type: "initialLocationUnavailable", reason: reason });
}

function locateInitialView() {
  if (!initialLocationAllowed()) return;
  if (!navigator.geolocation) { initialLocationFailed("unavailable"); return; }
  try {
    navigator.geolocation.getCurrentPosition(function (position) {
      if (!initialLocationAllowed()) return;
      var lat = position.coords.latitude;
      var lng = position.coords.longitude;
      if (typeof lat !== "number" || typeof lng !== "number" ||
          !Number.isFinite(lat) || !Number.isFinite(lng) ||
          Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        initialLocationFailed("invalid");
        return;
      }
      initialLocationPending = false;
      if (typeof showMyLocation === "function") {
        showMyLocation(lng, lat, position.coords.accuracy || 0);
      }
      map.easeTo({ center: [lng, lat], zoom: 13, duration: 600 });
      post({ type: "located", lat: lat, lng: lng, accuracyM: position.coords.accuracy || null });
    }, function (error) {
      initialLocationFailed(error && error.code === 1 ? "permission" : "unavailable");
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  } catch (_) { initialLocationFailed("unavailable"); }
}

// A late fix must not override panning, a selected hill, route handoff or replay.
// movestart covers deliberate programmatic camera moves as well as gestures.
map.on("movestart", cancelInitialLocation);
map.on("mousedown", cancelInitialLocation);
map.on("touchstart", cancelInitialLocation);
map.on("wheel", cancelInitialLocation);
map.once("load", locateInitialView);
`.trim();
}
