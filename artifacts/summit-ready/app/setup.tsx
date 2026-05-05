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
import { useColors } from "@/hooks/useColors";

type Difficulty = "Easy" | "Moderate" | "Hard" | "Alpine";
type Fitness = "Beginner" | "Average" | "Strong";

export default function SetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setSummitGoal } = useApp();

  const [mountainName, setMountainName] = useState("");
  const [summitDate, setSummitDate] = useState("");
  const [distance, setDistance] = useState("");
  const [elevationGain, setElevationGain] = useState("");
  const [highestAltitude, setHighestAltitude] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Moderate");
  const [fitnessLevel, setFitnessLevel] = useState<Fitness>("Average");
  const [location, setLocation] = useState("");
  const [maxRadius, setMaxRadius] = useState("25");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const difficulties: Difficulty[] = ["Easy", "Moderate", "Hard", "Alpine"];
  const fitnessLevels: Fitness[] = ["Beginner", "Average", "Strong"];

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!mountainName.trim()) e.mountainName = "Required";
    if (!summitDate.match(/^\d{4}-\d{2}-\d{2}$/)) e.summitDate = "Use YYYY-MM-DD format";
    else {
      const d = new Date(summitDate);
      if (isNaN(d.getTime()) || d <= new Date()) e.summitDate = "Must be a future date";
    }
    if (!distance || isNaN(Number(distance)) || Number(distance) <= 0) e.distance = "Enter km";
    if (!elevationGain || isNaN(Number(elevationGain)) || Number(elevationGain) <= 0) e.elevationGain = "Enter metres";
    if (!highestAltitude || isNaN(Number(highestAltitude))) e.highestAltitude = "Enter metres";
    if (!location.trim()) e.location = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    const goal: SummitGoal = {
      mountainName: mountainName.trim(),
      summitDate,
      distance: Number(distance),
      elevationGain: Number(elevationGain),
      highestAltitude: Number(highestAltitude),
      difficulty,
      fitnessLevel,
      location: location.trim(),
      maxRadius: Number(maxRadius) || 25,
    };
    await setSummitGoal(goal);
    setSaving(false);
    router.replace("/(tabs)/dashboard");
  }

  const inputStyle = (field: string) => [
    styles.input,
    {
      backgroundColor: colors.surface,
      borderColor: errors[field] ? colors.danger : colors.border,
      color: colors.foreground,
    },
  ];

  return (
    <LinearGradient colors={["#050C18", "#0B1120"]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: Platform.OS === "web" ? 80 : insets.top + 16,
              paddingBottom: Platform.OS === "web" ? 50 : insets.bottom + 30,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="arrow-left" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.foreground }]}>Your Summit</Text>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.primary }]}>Target</Text>

          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Mountain / Hike Name</Text>
            <TextInput
              style={inputStyle("mountainName")}
              value={mountainName}
              onChangeText={setMountainName}
              placeholder="e.g. Hörnlihütte from Schwarzsee"
              placeholderTextColor={colors.mutedForeground}
            />
            {errors.mountainName && <Text style={styles.error}>{errors.mountainName}</Text>}
          </View>

          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Summit Date</Text>
            <TextInput
              style={inputStyle("summitDate")}
              value={summitDate}
              onChangeText={setSummitDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numbers-and-punctuation"
            />
            {errors.summitDate && <Text style={styles.error}>{errors.summitDate}</Text>}
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldWrap, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Distance (km)</Text>
              <TextInput
                style={inputStyle("distance")}
                value={distance}
                onChangeText={setDistance}
                placeholder="14"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
              />
              {errors.distance && <Text style={styles.error}>{errors.distance}</Text>}
            </View>
            <View style={[styles.fieldWrap, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Elev. Gain (m)</Text>
              <TextInput
                style={inputStyle("elevationGain")}
                value={elevationGain}
                onChangeText={setElevationGain}
                placeholder="1200"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
              />
              {errors.elevationGain && <Text style={styles.error}>{errors.elevationGain}</Text>}
            </View>
          </View>

          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Highest Altitude (m)</Text>
            <TextInput
              style={inputStyle("highestAltitude")}
              value={highestAltitude}
              onChangeText={setHighestAltitude}
              placeholder="3260"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
            />
            {errors.highestAltitude && <Text style={styles.error}>{errors.highestAltitude}</Text>}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.primary }]}>Difficulty</Text>
          <View style={styles.chips}>
            {difficulties.map(d => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.chip,
                  {
                    backgroundColor: difficulty === d ? colors.primary : colors.surface,
                    borderColor: difficulty === d ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setDifficulty(d)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, { color: difficulty === d ? "#fff" : colors.mutedForeground }]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.primary }]}>Fitness Level</Text>
          <View style={styles.chips}>
            {fitnessLevels.map(f => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.chip,
                  {
                    backgroundColor: fitnessLevel === f ? colors.accent : colors.surface,
                    borderColor: fitnessLevel === f ? colors.accent : colors.border,
                  },
                ]}
                onPress={() => setFitnessLevel(f)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, { color: fitnessLevel === f ? "#fff" : colors.mutedForeground }]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.primary }]}>Location</Text>
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Your Location / Postcode</Text>
            <TextInput
              style={inputStyle("location")}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Leeds, UK"
              placeholderTextColor={colors.mutedForeground}
            />
            {errors.location && <Text style={styles.error}>{errors.location}</Text>}
          </View>

          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Max Training Radius (km)</Text>
            <TextInput
              style={inputStyle("maxRadius")}
              value={maxRadius}
              onChangeText={setMaxRadius}
              placeholder="25"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: saving ? colors.muted : colors.primary }]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={saving}
          >
            <Feather name={saving ? "loader" : "check"} size={20} color="#fff" />
            <Text style={styles.saveText}>{saving ? "Generating plan..." : "Generate my training plan"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 28,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141E30",
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 20,
  },
  fieldWrap: { marginBottom: 14 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6 },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  error: { fontSize: 11, color: "#E53E3E", marginTop: 4, fontFamily: "Inter_400Regular" },
  row: { flexDirection: "row", gap: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  saveButton: {
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 30,
    shadowColor: "#4CAF74",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  saveText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
