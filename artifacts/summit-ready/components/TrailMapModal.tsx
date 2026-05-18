import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  visible: boolean;
  url: string;
  onClose: () => void;
}

interface UserCoords { lat: number; lng: number }

export function TrailMapModal({ visible, url, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);

  // Request location permission and get initial position when modal opens
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    async function getLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || cancelled) return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } catch { /* silently ignore — GPS optional */ }
    }

    getLocation();
    return () => { cancelled = true; };
  }, [visible]);

  // Inject updated coordinates into the already-loaded WebView whenever they arrive
  useEffect(() => {
    if (!userCoords || !visible) return;
    const js = `
      if (typeof window.updateUserLocation === 'function') {
        window.updateUserLocation(${userCoords.lat}, ${userCoords.lng});
      }
      true;
    `;
    webViewRef.current?.injectJavaScript(js);
  }, [userCoords, visible]);

  // Append initial coords to URL if already known (fast path — coordinates pre-fetched
  // from a previous session or if location was already granted)
  const mapUrl = userCoords
    ? `${url}&userLat=${userCoords.lat.toFixed(6)}&userLng=${userCoords.lng.toFixed(6)}&_t=${Date.now()}`
    : `${url}&_t=${Date.now()}`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ uri: mapUrl }}
          style={styles.webview}
          geolocationEnabled
          javaScriptEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          originWhitelist={["*"]}
          cacheEnabled={false}
          allowsBackForwardNavigationGestures={false}
        />
        <TouchableOpacity
          style={[styles.closeBtn, { top: Platform.OS === "web" ? 16 : insets.top + 12 }]}
          onPress={onClose}
          activeOpacity={0.85}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111",
  },
  webview: {
    flex: 1,
  },
  closeBtn: {
    position: "absolute",
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
});
