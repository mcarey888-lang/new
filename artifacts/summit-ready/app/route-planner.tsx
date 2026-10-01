import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Route planner — the map, inside the app.
 *
 * The map itself is a web page this app's own server renders at
 * /api/route-map: basemaps, 3D terrain, drawing, and snapping to the
 * OpenStreetMap path network. It lives there rather than here because the
 * snapping engine and the Mapbox token both have to stay server-side, and
 * because that is already how this app shows maps — hike tracking and trail
 * detail both load a served page into a WebView.
 *
 * So this screen is deliberately thin: it is a frame and a way back. Every
 * control belongs to the page, which is why `chrome` is left at its default.
 * Adding buttons here would leave two sets disagreeing the moment either was
 * used.
 *
 * ⚠️ A TEST SCREEN, not a finished feature. Nothing it draws is saved yet: the
 * route lives in the page and is gone when the screen closes. Wiring it to the
 * app's route storage is the next piece, and that touches canonical route
 * handling, so it waits for a decision rather than being assumed.
 */

/**
 * Where the map page is served from.
 *
 * EXPO_PUBLIC_MAP_BASE comes first and exists for development. In a Replit
 * workspace the Expo dev server and the API server listen on different ports,
 * so the relative "/api" fallback resolves against Expo and returns its 404
 * rather than the map — a blank screen with nothing to explain it. Setting
 * EXPO_PUBLIC_MAP_BASE to the API server's own origin, port included, is the
 * way through that, and it leaves the shared EXPO_PUBLIC_DOMAIN convention
 * alone for everything else.
 *
 * Built apps have EXPO_PUBLIC_DOMAIN set (see eas.json) and need none of this.
 */
const API_BASE =
  process.env.EXPO_PUBLIC_MAP_BASE ??
  (process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
    : "/api");

const MAP_URL = `${API_BASE}/route-map`;

/** True when the URL has no host and so cannot be opened by a WebView. On the
 *  phone a relative path is not a mistake that shows up as a 404; it fails
 *  before any request is made, and the screen is simply black. */
const MAP_URL_IS_RELATIVE = !/^https?:\/\//i.test(MAP_URL);

export default function RoutePlannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  /* A map that will not load is the likely state while this is being set up,
     and a black screen says nothing about why. Naming the address it tried,
     and what to set, turns a dead end into a one-line fix. */
  const cannotLoad = Platform.OS !== "web" && MAP_URL_IS_RELATIVE;

  if (cannotLoad) {
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
      {/* react-native-webview has no real web implementation, so on web the
          same page goes in an iframe. Same URL, same page — only the element
          holding it differs. */}
      {Platform.OS === "web" ? (
        // eslint-disable-next-line react/forbid-dom-props
        React.createElement("iframe", {
          src: MAP_URL,
          style: { border: "none", width: "100%", height: "100%" },
          title: "Route planner",
        })
      ) : (
        <WebView
          source={{ uri: MAP_URL }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          geolocationEnabled
          originWhitelist={["*"]}
          /* The map is one page that talks to its own server; following a link
             away from it would strand someone inside a frame with no browser
             chrome to get back. */
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#05090B" },
  webview: { flex: 1, backgroundColor: "#05090B" },
  back: {
    position: "absolute",
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 9,
    backgroundColor: "rgba(11,20,24,0.86)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  backLabel: { color: "rgba(255,255,255,0.82)", fontSize: 11, fontWeight: "600" },
  centred: { alignItems: "center", justifyContent: "center", padding: 28, gap: 10 },
  failTitle: { color: "#E9B949", fontSize: 15, fontWeight: "700" },
  failBody: { color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 19, textAlign: "center" },
  failUrl: { color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 4 },
  failBack: {
    marginTop: 12, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 9,
    backgroundColor: "rgba(11,20,24,0.86)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
});
