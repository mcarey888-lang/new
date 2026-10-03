import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/expo";
import { ChevronLeft, Trash2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FollowRouteButton } from "@/components/track/FollowRouteButton";
import {
  deleteRoute,
  describeRoute,
  listRoutes,
  loadRoute,
  saveRoute,
  type PlannedRoute,
} from "../utils/plannedRouteApi";
import { readMountainRoutePackage } from "../utils/mountainHubStorage";

/**
 * Route planner — the map, inside the app.
 *
 * The map itself is a web page this app's own server renders at
 * /api/route-map: basemaps, 3D terrain, drawing, snapping to the OpenStreetMap
 * path network, ascent, and GPX. It lives there because the snapping engine
 * and the Mapbox token both have to stay server-side, and because that is
 * already how this app shows maps.
 *
 * This screen is the frame, the way back, and the one thing the page cannot do
 * for itself: saving. Saving needs the signed-in person's token, and handing
 * one to a web page means putting it somewhere it can be read or logged. So
 * the page hands the route up and this screen saves it.
 *
 * ⚠️ Saved routes are personal plans. They are not canonical routes, they are
 * not published, and nothing here can make them either.
 */

const API_BASE =
  process.env.EXPO_PUBLIC_MAP_BASE ??
  (process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
    : "/api");

const MAP_URL = `${API_BASE}/route-map`;
const MAP_URL_IS_RELATIVE = !/^https?:\/\//i.test(MAP_URL);

interface DraftFromPage {
  anchors: Array<{ lat: number; lng: number }>;
  geometry: Array<{ lat: number; lng: number }>;
  /* The page emits exactly these. Typed narrowly here so a new kind added
     there becomes a compile error rather than a silently unsaved leg. */
  legs: Array<{ kind: "routed" | "gap" | "offPath" | "straight" | "pending"; lengthM: number | null }>;
  lengthM: number;
  ascentM: number | null;
  descentM: number | null;
  fullySnapped: boolean;
}

export default function RoutePlannerScreen() {
  const router = useRouter();
  const { plannedRouteId, focusLat, focusLng, startLabel, canonicalPackageRouteId, canonicalPackageMountainId, canonicalPackageVersion } =
    useLocalSearchParams<{
      plannedRouteId?: string; focusLat?: string; focusLng?: string; startLabel?: string;
      canonicalPackageRouteId?: string; canonicalPackageMountainId?: string; canonicalPackageVersion?: string;
    }>();
  const insets = useSafeAreaInsets();
  const { getToken, userId } = useAuth();
  const tokenGetter = useRef(getToken);
  tokenGetter.current = getToken;
  const [mapReady, setMapReady] = useState(false);
  const [routeLoadError, setRouteLoadError] = useState<string | null>(null);
  const [routeLoadAttempt, setRouteLoadAttempt] = useState(0);
  const [selectedSavedRoute, setSelectedSavedRoute] = useState<{ owner: string; route: PlannedRoute } | null>(null);
  const loadingSavedRoute = useRef<{ owner: string; route: PlannedRoute } | null>(null);
  const currentOwner = useRef(userId);
  currentOwner.current = userId;
  const webViewRef = useRef<WebView>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const [draft, setDraft] = useState<DraftFromPage | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [routes, setRoutes] = useState<PlannedRoute[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [snapshotName, setSnapshotName] = useState<string | null>(null);
  const [snapshotAttribution, setSnapshotAttribution] = useState<string | null>(null);

  /** Send a message into the page, whichever way it is embedded. */
  const toPage = useCallback((msg: unknown) => {
    const text = JSON.stringify(msg);
    if (Platform.OS === "web") frameRef.current?.contentWindow?.postMessage(text, "*");
    else webViewRef.current?.postMessage(text);
  }, []);

  const onMessage = useCallback((raw: string) => {
    let msg: { type?: string; route?: DraftFromPage };
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === "ready") setMapReady(true);
    if (msg.type === "routeChanged") setSelectedSavedRoute(null);
    if (msg.type === "routeLoaded") {
      const pending = loadingSavedRoute.current;
      if (pending?.owner === currentOwner.current) setSelectedSavedRoute(pending);
      loadingSavedRoute.current = null;
    }
    if (msg.type === "saveRequested" && msg.route) {
      setDraft(msg.route);
      setName("");
    }
  }, []);

  /* On web the page talks through window.postMessage, which needs a listener
     rather than a prop. */
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e: MessageEvent) => {
      if (typeof e.data === "string") onMessage(e.data);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onMessage]);

  useEffect(() => {
    let cancelled = false;
    setRouteLoadError(null);
    setSelectedSavedRoute(null);
    loadingSavedRoute.current = null;
    if (!mapReady || !plannedRouteId) return;
    toPage({ type: "clear" });
    if (!userId) return;
    void loadRoute(plannedRouteId, () => tokenGetter.current()).then(result => {
      if (cancelled) return;
      if (result.ok) {
        loadingSavedRoute.current = { owner: userId, route: result.value };
        toPage({ type: "loadRoute", route: result.value });
      }
      else setRouteLoadError(result.reason);
    });
    return () => { cancelled = true; };
  }, [mapReady, plannedRouteId, userId, routeLoadAttempt, toPage]);

  useEffect(() => {
    if (!mapReady || plannedRouteId || canonicalPackageRouteId) return;
    if (!focusLat?.trim() || !focusLng?.trim()) return;
    const lat = Number(focusLat), lng = Number(focusLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
    if (startLabel?.trim()) {
      // An explicit access-point choice seeds a PERSONAL plan, not a canonical route.
      toPage({ type: "route", points: [{ lat, lng }], snapped: false });
    }
    toPage({ type: "locate", lat, lng, zoom: 13 });
  }, [mapReady, plannedRouteId, canonicalPackageRouteId, focusLat, focusLng, startLabel, toPage]);

  useEffect(() => {
    let cancelled = false;
    setSnapshotName(null);
    setSnapshotAttribution(null);
    if (!mapReady || plannedRouteId || !canonicalPackageRouteId || !canonicalPackageMountainId) return;
    toPage({ type: "clear" });
    if (!userId) { setRouteLoadError("Sign in to view your saved route data."); return; }
    void readMountainRoutePackage(userId, canonicalPackageRouteId, canonicalPackageMountainId, canonicalPackageVersion)
      .then(pkg => {
        if (cancelled) return;
        if (!pkg?.record.geometry) { setRouteLoadError("This exact route snapshot is not saved on this device."); return; }
        const points = pkg.record.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
        toPage({ type: "loadRoute", route: {
          name: pkg.record.route.canonicalName,
          anchors: [points[0], points[points.length - 1]], geometry: points,
          legs: [{ kind: "routed" }],
        } });
        toPage({ type: "draw", on: false });
        toPage({ type: "locate", ...points[0], zoom: 13 });
        setSnapshotName(pkg.record.route.canonicalName);
        setSnapshotAttribution([...new Set(pkg.record.geometry.sourceMembers.map(source =>
          `${source.attribution || source.provider}${source.licence ? ` · ${source.licence}` : ""}`,
        ))].join("; "));
      }).catch(() => { if (!cancelled) setRouteLoadError("Saved route data could not be read."); });
    return () => { cancelled = true; };
  }, [mapReady, plannedRouteId, canonicalPackageRouteId, canonicalPackageMountainId, canonicalPackageVersion, userId, toPage]);

  const doSave = useCallback(async () => {
    if (!draft) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    const result = await saveRoute({ ...draft, name: trimmed }, getToken);
    setSaving(false);
    /* The page is told either way, so the readout stops saying "Saving…"
       whatever happened. A spinner that never resolves is worse than a
       failure. */
    toPage({ type: "saveResult", ok: result.ok, reason: result.ok ? null : result.reason });
    if (result.ok) {
      if (userId) setSelectedSavedRoute({ owner: userId, route: result.value });
      setDraft(null);
      setRoutes(null); // the list is stale now
    }
  }, [draft, name, getToken, toPage, userId]);

  const openList = useCallback(async () => {
    setListOpen(true);
    setListError(null);
    const result = await listRoutes(getToken);
    if (result.ok) setRoutes(result.value);
    else { setRoutes([]); setListError(result.reason); }
  }, [getToken]);

  const open = useCallback((route: PlannedRoute) => {
    if (userId) loadingSavedRoute.current = { owner: userId, route };
    toPage({ type: "loadRoute", route });
    setListOpen(false);
  }, [toPage, userId]);

  const remove = useCallback(async (route: PlannedRoute) => {
    const result = await deleteRoute(route.id, getToken);
    if (result.ok) setRoutes(prev => (prev ?? []).filter(r => r.id !== route.id));
    else setListError(result.reason);
  }, [getToken]);

  /* A map that will not load is the likely state while this is being set up,
     and a black screen says nothing about why. */
  if (Platform.OS !== "web" && MAP_URL_IS_RELATIVE) {
    return (
      <View style={[styles.container, styles.centred]}>
        <Text style={styles.failTitle}>No map server configured</Text>
        <Text style={styles.failBody}>
          This screen loads the map from the API server, and no address for it
          is set. On a device a relative path cannot be opened at all.
        </Text>
        <Text style={styles.failBody}>
          Set EXPO_PUBLIC_MAP_BASE to the API server&apos;s origin, including
          its port, and reload.
        </Text>
        <Text style={styles.failUrl}>tried: {MAP_URL}</Text>
        <Pressable onPress={() => router.back()} style={styles.failBack}>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {routeLoadError && (
        <Pressable onPress={() => setRouteLoadAttempt(value => value + 1)}
          accessibilityRole="button" accessibilityLabel="Retry loading saved route"
          style={styles.routeLoadError}>
          <Text style={styles.backLabel}>Could not open saved route: {routeLoadError}. Tap to retry.</Text>
        </Pressable>
      )}
      {Platform.OS === "web" ? (
        React.createElement("iframe", {
          ref: frameRef,
          src: MAP_URL,
          style: { border: "none", width: "100%", height: "100%" },
          title: "Route planner",
        })
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: MAP_URL }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          geolocationEnabled
          originWhitelist={["*"]}
          onMessage={e => onMessage(e.nativeEvent.data)}
          allowsBackForwardNavigationGestures={false}
        />
      )}

      <Pressable
        onPress={() => router.back()}
        style={[styles.back, { top: Platform.OS === "web" ? 16 : insets.top + 12 }]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <ChevronLeft size={18} color="#fff" />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>
      {snapshotName || startLabel ? (
        <View pointerEvents="none" style={{ position: "absolute", bottom: Math.max(34, insets.bottom + 12), left: 12, right: 12, padding: 12, borderRadius: 8, backgroundColor: "#080e16ee" }}>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>{snapshotName ?? startLabel}</Text>
          <Text style={{ color: "#c4ceda", fontSize: 11, marginTop: 4 }}>
            {snapshotName ? "Saved route snapshot. Basemap tiles require a connection. Any edited copy is a personal plan." : "Selected access point for your personal plan. Confirm local access before setting out."}
          </Text>
          {snapshotAttribution ? <Text style={{ color: "#c4ceda", fontSize: 10, marginTop: 4 }}>{snapshotAttribution}</Text> : null}
        </View>
      ) : null}

      <Pressable
        onPress={openList}
        style={[styles.saved, { top: Platform.OS === "web" ? 16 : insets.top + 12 }]}
      >
        <Text style={styles.backLabel}>Saved routes</Text>
      </Pressable>
      {selectedSavedRoute?.owner === userId && selectedSavedRoute ? (
        <View style={styles.followRoutePanel}>
          <Text style={styles.backLabel} numberOfLines={1}>{selectedSavedRoute.route.name}</Text>
          <FollowRouteButton route={selectedSavedRoute.route} />
        </View>
      ) : null}

      {/* Naming happens here rather than in the page because Alert.prompt is
          iOS only, and a route worth saving is worth being able to name on
          every device. */}
      <Modal visible={draft !== null} transparent animationType="fade" onRequestClose={() => setDraft(null)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Name this route</Text>
            {draft ? (
              <Text style={styles.sheetMeta}>
                {describeRoute({
                  lengthM: draft.lengthM,
                  ascentM: draft.ascentM,
                  fullySnapped: draft.fullySnapped,
                })}
              </Text>
            ) : null}
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="North Ridge"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={styles.input}
              autoFocus
              maxLength={120}
              onSubmitEditing={doSave}
            />
            <View style={styles.sheetRow}>
              <Pressable onPress={() => setDraft(null)} style={[styles.sheetBtn, styles.sheetBtnGhost]}>
                <Text style={styles.sheetBtnGhostLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={doSave}
                disabled={saving || !name.trim()}
                style={[styles.sheetBtn, (saving || !name.trim()) && styles.sheetBtnOff]}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#05090B" />
                  : <Text style={styles.sheetBtnLabel}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={listOpen} transparent animationType="slide" onRequestClose={() => setListOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={[styles.sheet, styles.listSheet]}>
            <Text style={styles.sheetTitle}>Saved routes</Text>
            {listError ? <Text style={styles.sheetError}>{listError}</Text> : null}
            {routes === null ? (
              <ActivityIndicator color="#24EFA4" style={{ marginVertical: 24 }} />
            ) : routes.length === 0 && !listError ? (
              <Text style={styles.sheetMeta}>Nothing saved yet.</Text>
            ) : (
              <FlatList
                data={routes}
                keyExtractor={r => r.id}
                style={{ maxHeight: 320 }}
                renderItem={({ item }) => (
                  <View style={styles.row}>
                    <Pressable onPress={() => open(item)} style={{ flex: 1 }}>
                      <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.rowMeta}>{describeRoute(item)}</Text>
                    </Pressable>
                    <Pressable onPress={() => remove(item)} hitSlop={10} style={styles.rowDelete}>
                      <Trash2 size={16} color="rgba(255,255,255,0.45)" />
                    </Pressable>
                  </View>
                )}
              />
            )}
            <Pressable onPress={() => setListOpen(false)} style={[styles.sheetBtn, styles.sheetBtnGhost, { marginTop: 10 }]}>
              <Text style={styles.sheetBtnGhostLabel}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  followRoutePanel: { position: "absolute", bottom: Platform.OS === "web" ? 110 : 140, left: 16, right: 16, backgroundColor: "#16221e", padding: 12, borderRadius: 12 },
  routeLoadError: { position: "absolute", bottom: 150, left: 16, right: 16, zIndex: 10, backgroundColor: "#16221e", padding: 16, borderRadius: 12 },
  container: { flex: 1, backgroundColor: "#05090B" },
  webview: { flex: 1, backgroundColor: "#05090B" },
  back: {
    position: "absolute", left: 12, flexDirection: "row", alignItems: "center", gap: 4,
    paddingVertical: 8, paddingHorizontal: 11, borderRadius: 9,
    backgroundColor: "rgba(11,20,24,0.86)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  saved: {
    position: "absolute", left: 92, paddingVertical: 8, paddingHorizontal: 11, borderRadius: 9,
    backgroundColor: "rgba(11,20,24,0.86)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  backLabel: { color: "rgba(255,255,255,0.82)", fontSize: 11, fontWeight: "600" },
  centred: { alignItems: "center", justifyContent: "center", padding: 28, gap: 10 },
  failTitle: { color: "#E9B949", fontSize: 15, fontWeight: "700" },
  failBody: { color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 19, textAlign: "center" },
  failUrl: { color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 4 },
  failBack: {
    marginTop: 12, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 9,
    backgroundColor: "rgba(11,20,24,0.86)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(5,9,11,0.72)", justifyContent: "center", padding: 22 },
  sheet: {
    backgroundColor: "#0B1418", borderRadius: 16, padding: 18, gap: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  listSheet: { maxHeight: "80%" },
  sheetTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  sheetMeta: { color: "rgba(255,255,255,0.6)", fontSize: 12 },
  sheetError: { color: "#E9B949", fontSize: 12 },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 9, paddingHorizontal: 12,
    paddingVertical: 10, color: "#fff", fontSize: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  sheetRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  sheetBtn: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 11, borderRadius: 9, backgroundColor: "#24EFA4", minHeight: 42,
  },
  sheetBtnOff: { opacity: 0.4 },
  sheetBtnLabel: { color: "#05090B", fontSize: 13, fontWeight: "700" },
  sheetBtnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  sheetBtnGhostLabel: { color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: "600" },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)",
  },
  rowName: { color: "#fff", fontSize: 14, fontWeight: "600" },
  rowMeta: { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 },
  rowDelete: { padding: 6 },
});
