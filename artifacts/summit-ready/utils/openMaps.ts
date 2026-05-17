import { ActionSheetIOS, Alert, Linking, Platform } from "react-native";

export function openMapPin(lat: number, lng: number, label: string) {
  if (Platform.OS === "ios") {
    Linking.openURL(
      `maps://?ll=${lat},${lng}&q=${encodeURIComponent(label)}`
    );
  } else if (Platform.OS === "android") {
    Linking.openURL(
      `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label)})`
    );
  } else {
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    );
  }
}

export function openMapDirections(lat: number, lng: number, label: string) {
  if (Platform.OS === "ios") {
    Linking.openURL(`maps://?daddr=${lat},${lng}&q=${encodeURIComponent(label)}`);
  } else if (Platform.OS === "android") {
    Linking.openURL(
      `geo:0,0?q=${lat},${lng}(${encodeURIComponent(label)})`
    );
  } else {
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
    );
  }
}

export function openMapSearch(name: string) {
  if (Platform.OS === "ios") {
    Linking.openURL(`maps://?q=${encodeURIComponent(name)}`);
  } else if (Platform.OS === "android") {
    Linking.openURL(`geo:0,0?q=${encodeURIComponent(name)}`);
  } else {
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`
    );
  }
}

export function openMapsForHill(
  lat: number | undefined | null,
  lng: number | undefined | null,
  name: string,
  directions = false
) {
  if (lat && lng) {
    if (directions) {
      openMapDirections(lat, lng, name);
    } else {
      openMapPin(lat, lng, name);
    }
  } else {
    if (directions) {
      if (Platform.OS === "ios") {
        Linking.openURL(
          `maps://?q=${encodeURIComponent(name + " car park")}`
        );
      } else if (Platform.OS === "android") {
        Linking.openURL(
          `geo:0,0?q=${encodeURIComponent(name + " car park")}`
        );
      } else {
        Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(name + " car park")}&travelmode=driving`
        );
      }
    } else {
      openMapSearch(name);
    }
  }
}

// Opens a native action sheet (iOS) or alert (Android/web) letting the user
// pick which trail mapping app to open.  AllTrails and OS Maps both show real
// walking routes; Google Maps terrain is a solid universal fallback.
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
        { text: "AllTrails",            onPress: () => open(allTrailsUrl) },
        { text: "OS Maps",              onPress: () => open(osMapsUrl) },
        { text: "Google Maps (terrain)",onPress: () => open(googleUrl) },
        { text: "Cancel", style: "cancel" },
      ]
    );
  } else {
    open(allTrailsUrl);
  }
}
