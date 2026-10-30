import React, { useEffect, useState } from "react";
import { View, Text, Switch, Pressable, StyleSheet, Platform } from "react-native";
import { T } from "@/constants/theme";
import { privacySnapshot, privacyLoaded, subscribePrivacy, savePrivacyChoice, initialiseNativePrivacy } from "@/lib/privacy";

/** Non-blocking: essential features remain available without making a choice. */
export function PrivacyChoices({ settings = false }: { settings?: boolean }) {
  const [, refresh] = useState(0);
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => subscribePrivacy(() => refresh(n => n + 1)), []);
  useEffect(() => { initialiseNativePrivacy().catch(() => setError("Optional measurement is unavailable and remains off.")); }, []);
  const saved = privacySnapshot();
  useEffect(() => {
    setAnalytics(saved?.analytics ?? false);
    setAdvertising(saved?.advertising ?? false);
  }, [saved]);
  if (!settings && (!privacyLoaded() || saved !== null)) return null;
  async function save(a: boolean, d: boolean) {
    setBusy(true); setError("");
    try { await savePrivacyChoice(a, d); }
    catch { setError("Could not save this choice. Optional measurement is off; please try again."); }
    finally { setBusy(false); }
  }
  return <View style={styles.panel} accessibilityLabel="Privacy choices">
    <Text style={styles.title}>Your privacy choices</Text>
    <Text style={styles.body}>Sign-in, purchases, maps and hike recording work without optional measurement. No optional events are sent before your choice. You can change or withdraw it here in You → Account.</Text>
    <View style={styles.row}><Text style={styles.label}>Usage analytics (Firebase)</Text><Switch accessibilityLabel="Allow usage analytics" value={analytics} onValueChange={setAnalytics} /></View>
    {Platform.OS === "android" && <View style={styles.row}><Text style={styles.label}>Advertising measurement (Reddit)</Text><Switch accessibilityLabel="Allow advertising measurement" value={advertising} onValueChange={setAdvertising} /></View>}
    <Text style={styles.body}>Analytics uses app-instance identifiers and usage events. Android advertising measurement shares an installation ID, IP address and conversion events with Reddit. Google Advertising ID collection is disabled. Withdrawal stops future optional events; it cannot recall information already sent.</Text>
    <View style={styles.row}>
      <Pressable disabled={busy} onPress={() => save(false, false)} style={styles.button}><Text style={styles.label}>Decline / withdraw all</Text></Pressable>
      <Pressable disabled={busy} onPress={() => save(analytics, Platform.OS === "android" && advertising)} style={styles.button}><Text style={styles.label}>Save choices</Text></Pressable>
    </View>
    {!!error && <Text style={styles.body} accessibilityRole="alert">{error}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  panel: { padding: 16, backgroundColor: T.surface, borderColor: T.border, borderWidth: 1, borderRadius: 12, margin: 12 },
  title: { color: T.text, fontSize: 17, fontWeight: "600", marginBottom: 8 },
  body: { color: T.textMuted, fontSize: 12, lineHeight: 18 },
  label: { color: T.text, fontSize: 13, flexShrink: 1 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginVertical: 10 },
  button: { padding: 10, borderWidth: 1, borderColor: T.border, borderRadius: 8, flexShrink: 1 },
});
