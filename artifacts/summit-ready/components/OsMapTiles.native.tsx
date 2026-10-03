import React from "react";
import { UrlTile } from "react-native-maps";
import { MAX_CACHE_ZOOM, MIN_CACHE_ZOOM } from "@/utils/dayCache";
import { OS_TILE_TEMPLATE, useOsDayMap } from "@/hooks/useOsDayMap.native";
import { CAPABILITIES } from "@/constants/capabilities";

/** Only supported with Android/default provider or iOS Apple Maps. */
export function OsMapTiles() {
  const { lease, connectivity, error } = useOsDayMap();
  if (!__DEV__ && !CAPABILITIES.routeOfflineDownload) return null;
  if (!lease || error || Date.now() < lease.createdAt || Date.now() >= lease.expiresAt) return null;
  return <UrlTile
    key={lease.path}
    urlTemplate={OS_TILE_TEMPLATE}
    tileCachePath={lease.path}
    offlineMode={connectivity === "offline"}
    minimumZ={MIN_CACHE_ZOOM}
    maximumZ={MAX_CACHE_ZOOM}
    maximumNativeZ={MAX_CACHE_ZOOM}
    tileSize={256}
    shouldReplaceMapContent
  />;
}