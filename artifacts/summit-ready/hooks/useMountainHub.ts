/**
 * Mountain hub behaviour: guarded tracker launch and private route packages.
 * Both reuse existing systems; neither is a recorder or a map cache.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { readActiveHike } from "@/utils/activeHikeSession";
import {
  readMountainRoutePackage, removeMountainRoutePackage, saveMountainRoutePackage,
} from "@/utils/mountainHubStorage";
import type { MountainRoutePackage } from "@/utils/mountainHubStorage";
import type { CanonicalRouteRecord } from "@/utils/routeIntelligence";
import type { MountainParkingOption } from "@/utils/mountainParkingOptions";

type ActiveShape = { userId?: string; status?: string };
const LIVE = new Set(["tracking", "paused", "finished"]);

async function hasLiveActivity(userId: string): Promise<boolean> {
  const active = await readActiveHike<ActiveShape>(userId);
  return !!active && active.userId === userId && !!active.status && LIVE.has(active.status);
}

export function useTrackLauncher(userId: string | null | undefined) {
  const loadingRef = useRef(false);
  const [launching, setLaunching] = useState(false);
  const [resumable, setResumable] = useState(false);
  const ownerRef = useRef(userId);
  ownerRef.current = userId;

  const refresh = useCallback(async () => {
    try {
      const active = userId ? await hasLiveActivity(userId) : false;
      if (ownerRef.current === userId) setResumable(active);
    } catch { if (ownerRef.current === userId) setResumable(false); }
  }, [userId]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  /** Reread persisted state before EVERY launch; resume instead of competing. */
  const launch = useCallback(async (go: () => Promise<void> | void) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLaunching(true);
    try {
      const active = userId ? await hasLiveActivity(userId) : false;
      if (ownerRef.current !== userId) return;
      if (active) {
        setResumable(true);
        router.push({ pathname: "/hike-tracking" as any, params: { restore: "1" } });
        return;
      }
      await go();
    } catch {
      Alert.alert("Tracking unavailable", "Your active recording could not be checked. Try again; no new recording was started.");
    } finally {
      loadingRef.current = false;
      setLaunching(false);
    }
  }, [userId]);

  const resume = useCallback(() => {
    router.push({ pathname: "/hike-tracking" as any, params: { restore: "1" } });
  }, []);

  return { launch, resume, launching, resumable, refresh };
}

export type PackageState = "idle" | "saving" | "error";

export function useRoutePackage(
  userId: string | null | undefined,
  record: CanonicalRouteRecord | null,
  parking: readonly MountainParkingOption[],
) {
  const [pkg, setPkg] = useState<MountainRoutePackage | null>(null);
  const [status, setStatus] = useState<PackageState>("idle");
  const parkingRef = useRef(parking);
  parkingRef.current = parking;
  const routeId = record?.route.version.routeId;
  const mountainId = record?.route.version.mountainId;
  const version = record?.route.version.version;
  const identity = `${userId ?? ""}:${routeId ?? ""}:${version ?? ""}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const mutationRef = useRef(false);

  useEffect(() => {
    setPkg(null);
    setStatus("idle");
    if (!userId || !routeId || !mountainId) return;
    let cancelled = false;
    void readMountainRoutePackage(userId, routeId, mountainId, version)
      .then(p => { if (!cancelled) setPkg(p); })
      .catch(() => { if (!cancelled) setPkg(null); });
    return () => { cancelled = true; };
  }, [userId, routeId, mountainId, version]);

  const save = useCallback(async () => {
    if (!userId || !record || mutationRef.current) return null;
    mutationRef.current = true;
    setStatus("saving");
    try {
      const saved = await saveMountainRoutePackage(userId, record, parkingRef.current);
      if (identityRef.current !== identity) return null;
      setPkg(saved);
      setStatus("idle");
      return saved;
    } catch {
      if (identityRef.current === identity) {
        setStatus("error");
        Alert.alert("Not saved", "This route data could not be saved on this device.");
      }
      return null;
    } finally { mutationRef.current = false; }
  }, [userId, record, identity]);

  const remove = useCallback(async () => {
    if (!userId || !routeId || mutationRef.current) return;
    mutationRef.current = true;
    setStatus("saving");
    try {
      await removeMountainRoutePackage(userId, routeId);
      if (identityRef.current === identity) setPkg(null);
    } catch {
      if (identityRef.current === identity) Alert.alert("Not removed", "The saved route data could not be removed.");
    } finally {
      mutationRef.current = false;
      if (identityRef.current === identity) setStatus("idle");
    }
  }, [userId, routeId, identity]);

  const visiblePackage = pkg && pkg.ownerUserId === userId &&
    pkg.record.route.version.routeId === routeId &&
    pkg.record.route.version.version === version ? pkg : null;
  return { pkg: visiblePackage, status, save, remove };
}
