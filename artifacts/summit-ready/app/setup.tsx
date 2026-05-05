import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SummitGoal, useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";

type Difficulty = "Easy" | "Moderate" | "Hard" | "Alpine";
type Fitness = "Beginner" | "Average" | "Strong";

const DIFF_ICONS: Record<Difficulty, string> = {
  Easy: "🌿", Moderate: "🏔️", Hard: "⛰️", Alpine: "🗻",
};
const FIT_ICONS: Record<Fitness, string> = {
  Beginner: "🌱", Average: "🏃", Strong: "⚡",
};

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

  const DIFFICULTIES: Difficulty[] = ["Easy", "Moderate", "Hard", "Alpine"];
  const FITNESS: Fitness[] = ["Beginner", "Average", "Strong"];

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
    errors[field] && { borderColor: T.red + "80" },
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
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="arrow-left" size={20} color={T.white} />
            </TouchableOpacity>
            <View>
              <Text style={styles.title}>Your Summit</Text>
              <Text style={styles.subtitle}>Set up your training plan</Text>
            </View>
          </View>

          <Section label="Target Mountain" icon="map-pin">
            <Field label="Mountain / Hike Name" error={errors.name}>
              <TextInput style={inp("name")} value={name} onChangeText={setName}
                placeholder="e.g. Hörnlihütte from Schwarzsee" placeholderTextColor={T.textDim} />
            </Field>
            <Field label="Summit Date" error={errors.date}>
              <TextInput style={inp("date")} value={date} onChangeText={setDate}
                placeholder="YYYY-MM-DD" placeholderTextColor={T.textDim} keyboardType="numbers-and-punctuation" />
            </Field>
          </Section>

          <Section label="Route Details" icon="trending-up">
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Field label="Distance (km)" error={errors.dist} style={{ flex: 1 }}>
                <TextInput style={inp("dist")} value={dist} onChangeText={setDist}
                  placeholder="14" placeholderTextColor={T.textDim} keyboardType="decimal-pad" />
              </Field>
              <Field label="Elev. Gain (m)" error={errors.elev} style={{ flex: 1 }}>
                <TextInput style={inp("elev")} value={elev} onChangeText={setElev}
                  placeholder="1220" placeholderTextColor={T.textDim} keyboardType="number-pad" />
              </Field>
            </View>
            <Field label="Highest Altitude (m)" error={errors.alt}>
              <TextInput style={inp("alt")} value={alt} onChangeText={setAlt}
                placeholder="3260" placeholderTextColor={T.textDim} keyboardType="number-pad" />
            </Field>
          </Section>

          <Section label="Difficulty" icon="flag">
            <View style={styles.optionGrid}>
              {DIFFICULTIES.map(d => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDiff(d)}
                  style={[
                    styles.optionBtn,
                    diff === d && { borderColor: T.green, backgroundColor: T.greenDim },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.optionEmoji}>{DIFF_ICONS[d]}</Text>
                  <Text style={[styles.optionLabel, diff === d && { color: T.green }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          <Section label="Fitness Level" icon="zap">
            <View style={styles.optionGrid}>
              {FITNESS.map(f => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFit(f)}
                  style={[
                    styles.optionBtn,
                    fit === f && { borderColor: T.orange, backgroundColor: T.orangeDim },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.optionEmoji}>{FIT_ICONS[f]}</Text>
                  <Text style={[styles.optionLabel, fit === f && { color: T.orange }]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          <Section label="Your Location" icon="map">
            <Field label="Location / Postcode" error={errors.loc}>
              <TextInput style={inp("loc")} value={loc} onChangeText={setLoc}
                placeholder="e.g. Leeds, UK" placeholderTextColor={T.textDim} />
            </Field>
            <Field label="Max Training Radius (km)">
              <TextInput style={inp("radius")} value={radius} onChangeText={setRadius}
                placeholder="25" placeholderTextColor={T.textDim} keyboardType="number-pad" />
            </Field>
          </Section>

          <TouchableOpacity
            onPress={submit}
            disabled={saving}
            style={[styles.submitBtn, { opacity: saving ? 0.7 : 1 }]}
            activeOpacity={0.85}
          >
            <LinearGradient colors={["#3ECF75", "#2AB860"]} style={styles.submitGrad}>
              <Feather name={saving ? "loader" : "check-circle"} size={20} color="#fff" />
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

function Section({ label, icon, children }: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={s2.section}>
      <View style={s2.sectionHead}>
        <View style={s2.sectionIconBox}>
          <Feather name={icon} size={14} color={T.green} />
        </View>
        <Text style={s2.sectionLabel}>{label}</Text>
      </View>
      <View style={s2.sectionBody}>{children}</View>
    </View>
  );
}

function Field({ label, error, children, style }: {
  label: string;
  error?: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[{ marginBottom: 12 }, style]}>
      <Text style={s2.fieldLabel}>{label}</Text>
      {children}
      {error && <Text style={s2.errorText}>{error}</Text>}
    </View>
  );
}

const s2 = StyleSheet.create({
  section: { marginBottom: 8 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    marginTop: 20,
  },
  sectionIconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: T.greenDim, alignItems: "center", justifyContent: "center" },
  sectionLabel: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white, letterSpacing: 0.3 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: T.textMuted, marginBottom: 7 },
  errorText: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.red, marginTop: 4 },
});

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.white },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
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
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  optionEmoji: { fontSize: 15 },
  optionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  submitBtn: { borderRadius: 18, overflow: "hidden", marginTop: 28 },
  submitGrad: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  submitText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
});
