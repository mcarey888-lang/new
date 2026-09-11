import { router } from "expo-router";
import React from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { DEMO_DARK, DEMO_GREEN } from "./constants";
import { demoRoute } from "./routes";

export function DemoScreen({ title, body, next, children }: {
  title: string; body?: string; next?: string; children?: React.ReactNode;
}) {
  return <SafeAreaView style={styles.safe}><View style={styles.page}>
    <Text style={styles.kicker}>SUMMITREADY</Text><Text style={styles.title}>{title}</Text>
    {body ? <Text style={styles.body}>{body}</Text> : null}{children}
    {next ? <Pressable style={styles.button} onPress={() => router.push(demoRoute(next) as never)}><Text style={styles.buttonText}>Continue</Text></Pressable> : null}
  </View></SafeAreaView>;
}
export function Choice({ label, href, onPress }: { label: string; href?: string; onPress?: () => void }) {
  return <Pressable style={styles.choice} onPress={() => { onPress?.(); if (href) router.push(demoRoute(href) as never); }}><Text style={styles.choiceText}>{label}</Text><Text style={styles.arrow}>›</Text></Pressable>;
}
export function Back() { return <Pressable onPress={() => router.push(demoRoute("/onboarding-demo") as never)}><Text style={styles.back}>‹ Back</Text></Pressable>; }
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f5ef" }, page: { flex: 1, padding: 28, justifyContent: "center" },
  kicker: { color: DEMO_GREEN, fontSize: 12, fontWeight: "700", letterSpacing: 2, marginBottom: 18 },
  title: { color: DEMO_DARK, fontSize: 34, lineHeight: 40, fontWeight: "700", marginBottom: 16 },
  body: { color: "#53645b", fontSize: 17, lineHeight: 25, marginBottom: 28 }, button: { backgroundColor: DEMO_GREEN, borderRadius: 12, padding: 17, alignItems: "center", marginTop: 28 },
  buttonText: { color: "white", fontWeight: "700", fontSize: 16 }, choice: { backgroundColor: "white", borderRadius: 14, padding: 20, marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: "#e3e6df" },
  choiceText: { color: DEMO_DARK, fontSize: 16, fontWeight: "600", flex: 1 }, arrow: { color: DEMO_GREEN, fontSize: 27 }, back: { color: DEMO_GREEN, marginBottom: 20, fontSize: 15 },
});