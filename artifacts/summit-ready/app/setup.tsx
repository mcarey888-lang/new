import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SummitGoal, useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";

type Difficulty = "Easy" | "Moderate" | "Hard" | "Alpine";
type Fitness = "Beginner" | "Average" | "Strong";

interface RouteOption {
  name: string;
  distance: number;
  elevationGain: number;
  highestAltitude: number;
  difficulty: Difficulty;
  description: string;
  startingPoint?: string;
}

interface MountainResult {
  mountainName: string;
  country?: string;
  region?: string;
  routes: RouteOption[];
}

const DIFF_ICONS: Record<Difficulty, string> = {
  Easy: "🌿", Moderate: "🏔️", Hard: "⛰️", Alpine: "🗻",
};
const DIFF_COLORS: Record<Difficulty, string> = {
  Easy: T.green, Moderate: T.blue, Hard: T.orange, Alpine: "#FF4444",
};
const FIT_ICONS: Record<Fitness, string> = {
  Beginner: "🌱", Average: "🏃", Strong: "⚡",
};

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const { setSummitGoal } = useApp();

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [dist, setDist] = useState("");
  const [elev, setElev] = useState("");
  const [alt, setAlt] = useState("");
  const [diff, setDiff] = useState<Difficulty>("Moderate");
  const [fit, setFit] = useState<Fitness>("Average");
  const [loc, setLoc] = useState("");
  const [radius, setRadius] = useState("25");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Mountain lookup state
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "results" | "error">("idle");
  const [mountainResult, setMountainResult] = useState<MountainResult | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [lookupError, setLookupError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const FITNESS: Fitness[] = ["Beginner", "Average", "Strong"];

  // Lookup mountain info with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (name.trim().length < 3) {
      if (lookupState !== "idle") {
        setLookupState("idle");
        setMountainResult(null);
        setSelectedRoute(null);
      }
      return;
    }
    debounceRef.current = setTimeout(() => lookupMountain(name.trim()), 900);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [name]);

  async function lookupMountain(mountainName: string) {
    setLookupState("loading");
    setSelectedRoute(null);
    setMountainResult(null);
    try {
      const res = await fetch(`${API_BASE}/mountain-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: mountainName }),
      });
      if (!res.ok) throw new Error("Lookup failed");
      const data: MountainResult = await res.json();
      setMountainResult(data);
      setLookupState("results");
    } catch (e) {
      setLookupError("Could not look up route data. Fill in manually.");
      setLookupState("error");
    }
  }

  function selectRoute(route: RouteOption) {
    setSelectedRoute(route);
    setDist(String(route.distance));
    setElev(String(route.elevationGain));
    setAlt(String(route.highestAltitude));
    setDiff(route.difficulty);
    if (mountainResult?.mountainName) {
      setName(mountainResult.mountainName);
    }
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Required";
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) e.date = "Format: YYYY-MM-DD";
    else if (new Date(date) <= new Date()) e.date = "Must be a future date";
    if (!dist || isNaN(+dist) || +dist <= 0) e.dist = "Enter km";
    if (!elev || isNaN(+elev) || +elev <= 0) e.elev = "Enter metres";
    if (!alt || isNaN(+alt)) e.alt = "Enter metres";
    if (!loc.trim()) e.loc = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setSaving(true);
    await setSummitGoal({
      mountainName: name.trim(),
      summitDate: date,
      distance: +dist,
      elevationGain: +elev,
      highestAltitude: +alt,
      difficulty: diff,
      fitnessLevel: fit,
      location: loc.trim(),
      maxRadius: +radius || 25,
    });
    setSaving(false);
    router.replace("/(tabs)/dashboard");
  }

  const inp = (field: string) => [
    styles.input,
    errors[field] ? { borderColor: T.red + "80" } : null,
  ];

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: Platform.OS === "web" ? 72 : insets.top + 16,
              paddingBottom: Platform.OS === "web" ? 60 : insets.bottom + 40,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="arrow-left" size={20} color={T.white} />
            </TouchableOpacity>
            <View>
              <Text style={styles.title}>Your Summit</Text>
              <Text style={styles.subtitle}>Set up your training plan</Text>
            </View>
          </View>

          {/* Mountain name + auto-lookup */}
          <Section label="Mountain / Hike" icon="map-pin">
            <View style={styles.fieldWrap}>
              <Text style={styles.fLabel}>Mountain or Hike Name</Text>
              <View style={styles.mountainInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }, errors.name ? { borderColor: T.red + "80" } : null]}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Hörnlihütte, Ben Nevis, Mont Blanc…"
                  placeholderTextColor={T.textDim}
                  autoCorrect={false}
                />
                {lookupState === "loading" && (
                  <View style={styles.lookupSpinner}>
                    <ActivityIndicator size="small" color={T.green} />
                  </View>
                )}
                {lookupState !== "loading" && name.trim().length >= 3 && (
                  <TouchableOpacity
                    style={styles.lookupBtn}
                    onPress={() => lookupMountain(name.trim())}
                    activeOpacity={0.8}
                  >
                    <Feather name="search" size={16} color={T.green} />
                  </TouchableOpacity>
                )}
              </View>
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>

            {/* Lookup status */}
            {lookupState === "loading" && (
              <Animated.View entering={FadeInDown.duration(300)} style={styles.lookupCard}>
                <ActivityIndicator size="small" color={T.green} />
                <Text style={styles.lookupLoadingText}>Looking up routes for "{name}"…</Text>
              </Animated.View>
            )}

            {lookupState === "error" && (
              <Animated.View entering={FadeInDown.duration(300)} style={[styles.lookupCard, styles.lookupError]}>
                <Feather name="alert-circle" size={14} color={T.orange} />
                <Text style={styles.lookupErrorText}>{lookupError}</Text>
              </Animated.View>
            )}

            {lookupState === "results" && mountainResult && (
              <Animated.View entering={FadeInDown.duration(400)}>
                <View style={styles.mountainInfo}>
                  <View style={styles.mountainInfoHeader}>
                    <View>
                      <Text style={styles.mountainInfoName}>{mountainResult.mountainName}</Text>
                      {(mountainResult.region || mountainResult.country) && (
                        <Text style={styles.mountainInfoLocation}>
                          {[mountainResult.region, mountainResult.country].filter(Boolean).join(", ")}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.routeCountBadge, { backgroundColor: T.greenDim }]}>
                      <Text style={[styles.routeCountText, { color: T.green }]}>
                        {mountainResult.routes.length} routes
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.routePickerLabel}>Select a route to auto-fill details:</Text>
                {mountainResult.routes.map((route, i) => {
                  const isSelected = selectedRoute?.name === route.name;
                  const dc = DIFF_COLORS[route.difficulty];
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => selectRoute(route)}
                      activeOpacity={0.8}
                      style={[
                        styles.routeCard,
                        isSelected && { borderColor: dc, borderWidth: 1.5 },
                      ]}
                    >
                      <LinearGradient
                        colors={isSelected ? [dc + "12", "transparent"] : ["transparent", "transparent"]}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.routeCardTop}>
                        <Text style={styles.routeEmoji}>{DIFF_ICONS[route.difficulty]}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.routeName}>{route.name}</Text>
                          {route.startingPoint && (
                            <Text style={styles.routeStart}>From {route.startingPoint}</Text>
                          )}
                        </View>
                        <View style={[styles.diffBadge, { backgroundColor: dc + "20" }]}>
                          <Text style={[styles.diffBadgeText, { color: dc }]}>{route.difficulty}</Text>
                        </View>
                        {isSelected && (
                          <View style={[styles.checkMark, { backgroundColor: dc }]}>
                            <Feather name="check" size={12} color="#fff" />
                          </View>
                        )}
                      </View>
                      <Text style={styles.routeDesc} numberOfLines={2}>{route.description}</Text>
                      <View style={styles.routeStats}>
                        <RouteStatPill icon="map" val={`${route.distance}km`} color={T.blue} />
                        <RouteStatPill icon="trending-up" val={`${route.elevationGain}m`} color={T.orange} />
                        <RouteStatPill icon="navigation" val={`${route.highestAltitude}m asl`} color={T.purple} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </Animated.View>
            )}
          </Section>

          {/* Summit date */}
          <Section label="Summit Date" icon="calendar">
            <View style={styles.fieldWrap}>
              <Text style={styles.fLabel}>Target Date</Text>
              <TextInput
                style={inp("date")}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={T.textDim}
                keyboardType="numbers-and-punctuation"
              />
              {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
            </View>
          </Section>

          {/* Route details — auto-filled or manual */}
          <Section label="Route Details" icon="trending-up">
            {selectedRoute && (
              <Animated.View entering={FadeInDown.duration(300)}>
                <View style={styles.autofillBanner}>
                  <Feather name="zap" size={13} color={T.green} />
                  <Text style={styles.autofillText}>
                    Auto-filled from "{selectedRoute.name}" — edit if needed
                  </Text>
                </View>
              </Animated.View>
            )}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={styles.fieldWrap}>
                <Text style={styles.fLabel}>Distance (km)</Text>
                <TextInput style={[inp("dist"), { minWidth: 0 }]} value={dist} onChangeText={setDist}
                  placeholder="14" placeholderTextColor={T.textDim} keyboardType="decimal-pad" />
                {errors.dist && <Text style={styles.errorText}>{errors.dist}</Text>}
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.fLabel}>Elev. Gain (m)</Text>
                <TextInput style={[inp("elev"), { minWidth: 0 }]} value={elev} onChangeText={setElev}
                  placeholder="1220" placeholderTextColor={T.textDim} keyboardType="number-pad" />
                {errors.elev && <Text style={styles.errorText}>{errors.elev}</Text>}
              </View>
            </View>
            <View style={styles.fieldWrap}>
              <Text style={styles.fLabel}>Highest Altitude (m asl)</Text>
              <TextInput style={inp("alt")} value={alt} onChangeText={setAlt}
                placeholder="3260" placeholderTextColor={T.textDim} keyboardType="number-pad" />
              {errors.alt && <Text style={styles.errorText}>{errors.alt}</Text>}
            </View>

            <Text style={styles.fLabel}>Difficulty</Text>
            <View style={styles.diffRow}>
              {(["Easy", "Moderate", "Hard", "Alpine"] as Difficulty[]).map(d => {
                const dc = DIFF_COLORS[d];
                return (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setDiff(d)}
                    style={[
                      styles.diffBtn,
                      diff === d && { borderColor: dc, backgroundColor: dc + "18" },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.diffEmoji}>{DIFF_ICONS[d]}</Text>
                    <Text style={[styles.diffLabel, diff === d && { color: dc }]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          {/* Fitness */}
          <Section label="Your Fitness" icon="zap">
            <View style={styles.fitRow}>
              {FITNESS.map(f => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFit(f)}
                  style={[
                    styles.fitBtn,
                    fit === f && { borderColor: T.orange, backgroundColor: T.orangeDim },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.fitEmoji}>{FIT_ICONS[f]}</Text>
                  <Text style={[styles.fitLabel, fit === f && { color: T.orange }]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          {/* Location */}
          <Section label="Your Location" icon="map">
            <View style={styles.fieldWrap}>
              <Text style={styles.fLabel}>Location / Postcode</Text>
              <TextInput style={inp("loc")} value={loc} onChangeText={setLoc}
                placeholder="e.g. Leeds, UK" placeholderTextColor={T.textDim} />
              {errors.loc && <Text style={styles.errorText}>{errors.loc}</Text>}
            </View>
            <View style={styles.fieldWrap}>
              <Text style={styles.fLabel}>Max Training Radius (km)</Text>
              <TextInput style={inp("radius")} value={radius} onChangeText={setRadius}
                placeholder="25" placeholderTextColor={T.textDim} keyboardType="number-pad" />
            </View>
          </Section>

          <TouchableOpacity
            onPress={submit}
            disabled={saving}
            style={[styles.submitBtn, { opacity: saving ? 0.7 : 1 }]}
            activeOpacity={0.85}
          >
            <LinearGradient colors={["#3ECF75", "#2AB860"]} style={styles.submitGrad}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Feather name="check-circle" size={20} color="#fff" />
              }
              <Text style={styles.submitText}>
                {saving ? "Generating plan…" : "Generate my training plan"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function RouteStatPill({ icon, val, color }: { icon: keyof typeof Feather.glyphMap; val: string; color: string }) {
  return (
    <View style={[statStyles.pill, { backgroundColor: color + "15" }]}>
      <Feather name={icon} size={11} color={color} />
      <Text style={[statStyles.text, { color }]}>{val}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  text: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});

function Section({ label, icon, children }: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={secStyles.wrap}>
      <View style={secStyles.head}>
        <View style={secStyles.iconBox}>
          <Feather name={icon} size={13} color={T.green} />
        </View>
        <Text style={secStyles.label}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

const secStyles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 22 },
  iconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: T.greenDim, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white, letterSpacing: 0.3 },
});

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.white },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  fieldWrap: { flex: 1, marginBottom: 12 },
  fLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: T.textMuted, marginBottom: 7 },
  input: {
    height: 50,
    backgroundColor: T.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: T.white,
  },
  errorText: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.red, marginTop: 4 },
  mountainInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  lookupSpinner: { width: 44, height: 50, alignItems: "center", justifyContent: "center" },
  lookupBtn: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: T.greenDim,
    borderWidth: 1,
    borderColor: T.green + "40",
    alignItems: "center",
    justifyContent: "center",
  },
  lookupCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: T.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    padding: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  lookupError: { borderColor: T.orange + "40", backgroundColor: T.orangeDim },
  lookupLoadingText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, flex: 1 },
  lookupErrorText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.orange, flex: 1 },
  mountainInfo: {
    backgroundColor: T.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.green + "40",
    padding: 14,
    marginBottom: 12,
  },
  mountainInfoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  mountainInfoName: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.white },
  mountainInfoLocation: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },
  routeCountBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  routeCountText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  routePickerLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted, marginBottom: 8, letterSpacing: 0.3 },
  routeCard: {
    backgroundColor: T.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.cardBorder,
    padding: 14,
    marginBottom: 8,
    overflow: "hidden",
    gap: 8,
  },
  routeCardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeEmoji: { fontSize: 22 },
  routeName: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white },
  routeStart: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  diffBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  checkMark: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  routeDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18 },
  routeStats: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  autofillBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: T.greenDim,
    borderWidth: 1,
    borderColor: T.green + "40",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  autofillText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: T.green },
  diffRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  diffBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  diffEmoji: { fontSize: 15 },
  diffLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  fitRow: { flexDirection: "row", gap: 8 },
  fitBtn: {
    flex: 1,
    alignItems: "center",
    gap: 7,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  fitEmoji: { fontSize: 20 },
  fitLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  submitBtn: { borderRadius: 18, overflow: "hidden", marginTop: 28 },
  submitGrad: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  submitText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
});
