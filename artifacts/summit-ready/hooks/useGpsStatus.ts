import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import { gpsState, type GpsState } from "@/utils/gpsStatus";

/**
 * Watch the GPS well enough to say something true about it.
 *
 * Deliberately passive: it asks for a fix and reports what it gets. It never
 * blocks, never gates anything, and a failure here is a label change rather
 * than a screen that will not start a hike.
 */
export function useGpsStatus(active = true): { state: GpsState; accuracyM: number | null } {
  const [state, setState] = useState<GpsState>("checking");
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    (async () => {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && !navigator.geolocation) {
        if (!cancelled) setState("unavailable");
        return;
      }
      const services = await Location.hasServicesEnabledAsync().catch(() => true);
      if (cancelled) return;
      if (!services) { setState("unavailable"); return; }

      const existing = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (cancelled) return;
      let granted = existing?.status === "granted";
      if (!granted) {
        const asked = await Location.requestForegroundPermissionsAsync().catch(() => null);
        if (cancelled) return;
        granted = asked?.status === "granted";
        if (!granted) { setState("denied"); return; }
      }
      setState(gpsState({ permission: "granted", accuracyM: null }));

      subRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 5, timeInterval: 4000 },
        loc => {
          if (cancelled) return;
          const acc = typeof loc.coords.accuracy === "number" ? loc.coords.accuracy : null;
          setAccuracyM(acc);
          setState(gpsState({ permission: "granted", accuracyM: acc }));
        },
      ).catch(() => null);
    })();

    return () => {
      cancelled = true;
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [active]);

  return { state, accuracyM };
}
