import { ActionSheetIOS, Alert, Linking, Platform } from "react-native";

/** Safe wrapper — falls back to a web URL if the native scheme can't be opened. */
function openUrl(nativeUrl: string, webFallback: string) {
  Linking.openURL(nativeUrl).catch(() => {
    Linking.openURL(webFallback).catch(() => {});
  });
}

/** Open a verified GPS pin (use only when coords come from a trusted source e.g. postcodes.io). */
export function openMapPin(lat: number, lng: number, label: string) {
  const web = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  if (Platform.OS === "ios") {
    openUrl(`maps://?ll=${lat},${lng}&q=${encodeURIComponent(label)}`, web);
  } else if (Platform.OS === "android") {
    openUrl(`geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label)})`, web);
  } else {
    Linking.openURL(web).catch(() => {});
  }
}

/** Navigate to verified GPS coordinates (use only when coords are from a trusted source). */
export function openMapDirections(lat: number, lng: number, label: string) {
  const web = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  if (Platform.OS === "ios") {
    openUrl(`maps://?daddr=${lat},${lng}&q=${encodeURIComponent(label)}`, web);
  } else if (Platform.OS === "android") {
    openUrl(`geo:0,0?q=${lat},${lng}(${encodeURIComponent(label)})`, web);
  } else {
    Linking.openURL(web).catch(() => {});
  }
}

/** Navigate to a UK postcode (postcodes.io-validated coords on server; postcode string on client). */
export function openDirectionsToPostcode(postcode: string, label: string) {
  const dest = encodeURIComponent(`${postcode} ${label}`);
  const web = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
  if (Platform.OS === "ios") {
    openUrl(
      `maps://?daddr=${encodeURIComponent(postcode)}&q=${encodeURIComponent(label)}`,
      web
    );
  } else if (Platform.OS === "android") {
    openUrl(`geo:0,0?q=${dest}`, web);
  } else {
    Linking.openURL(web).catch(() => {});
  }
}

/** Search for a place by name — reliable for any named hill, route or location. */
export function openMapSearch(name: string) {
  const web = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
  if (Platform.OS === "ios") {
    openUrl(`maps://?q=${encodeURIComponent(name)}`, web);
  } else if (Platform.OS === "android") {
    openUrl(`geo:0,0?q=${encodeURIComponent(name)}`, web);
  } else {
    Linking.openURL(web).catch(() => {});
  }
}

/**
 * Open a hill or route in the map app.
 *
 * Uses name-based search as the primary strategy — Apple Maps, Google Maps and
 * Android's geo: handler all have excellent knowledge of named UK hills, fells
 * and trails, so this is more reliable than AI-generated lat/lng coordinates
 * which can be inaccurate.
 *
 * Set `directions = true` to open turn-by-turn navigation instead of a pin.
 */
export function openMapsForHill(
  _lat: number | undefined | null,
  _lng: number | undefined | null,
  name: string,
  directions = false
) {
  const searchName = directions ? `${name} car park` : name;
  const encoded = encodeURIComponent(searchName);

  if (Platform.OS === "ios") {
    openUrl(
      `maps://?q=${encoded}`,
      `https://www.google.com/maps/search/?api=1&query=${encoded}`
    );
  } else if (Platform.OS === "android") {
    if (directions) {
      openUrl(
        `google.navigation:q=${encoded}`,
        `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`
      );
    } else {
      openUrl(
        `geo:0,0?q=${encoded}`,
        `https://www.google.com/maps/search/?api=1&query=${encoded}`
      );
    }
  } else {
    const web = directions
      ? `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    Linking.openURL(web).catch(() => {});
  }
}

/** Opens a native action sheet (iOS) or alert (Android/web) letting the user
 *  pick which trail mapping app to open. */
export function openTrailMapChooser(trailName: string, location: string) {
  const query = encodeURIComponent(`${trailName} ${location}`);
  const nameOnly = encodeURIComponent(trailName);

  const allTrailsUrl = `https://www.alltrails.com/explore?q=${nameOnly}`;
  const osMapsUrl    = `https://explore.osmaps.com/search?q=${query}`;
  const googleUrl    = `https://maps.google.com/maps?q=${query}&t=p`;

  const open = (url: string) => Linking.openURL(url).catch(() => {});

  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "Open trail map in…",
        options: ["Cancel", "AllTrails", "OS Maps", "Google Maps (terrain)"],
        cancelButtonIndex: 0,
      },
      (idx) => {
        if (idx === 1) open(allTrailsUrl);
        if (idx === 2) open(osMapsUrl);
        if (idx === 3) open(googleUrl);
      }
    );
  } else if (Platform.OS === "android") {
    Alert.alert(
      "Open trail map",
      "Choose a maps app",
      [
        { text: "AllTrails",             onPress: () => open(allTrailsUrl) },
        { text: "OS Maps",               onPress: () => open(osMapsUrl) },
        { text: "Google Maps (terrain)", onPress: () => open(googleUrl) },
        { text: "Cancel", style: "cancel" },
      ]
    );
  } else {
    open(allTrailsUrl);
  }
}
