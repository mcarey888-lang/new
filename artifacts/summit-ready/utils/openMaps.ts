import { Linking, Platform } from "react-native";

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
