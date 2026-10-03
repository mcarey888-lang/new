import { useEffect } from "react";
import { AppState } from "react-native";
import { startOsDayMaps, sweepOsDayMaps } from "@/hooks/useOsDayMap.native";

/** Never await this at Start or gate the application's navigation. */
export function OfflineMapLifecycle() {
  useEffect(() => {
    void startOsDayMaps().catch(error => console.warn("OS map startup sweep failed:", String(error)));
    const listener = AppState.addEventListener("change", state => {
      if (state === "active") void sweepOsDayMaps().catch(error => console.warn("OS map foreground sweep failed:", String(error)));
    });
    const expiry = setInterval(() => {
      if (AppState.currentState === "active") void sweepOsDayMaps().catch(error => console.warn("OS map expiry sweep failed:", String(error)));
    }, 60000);
    return () => { listener.remove(); clearInterval(expiry); };
  }, []);
  return null;
}