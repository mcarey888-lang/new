import { ArrowLeft, Check } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
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
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { T } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import type {
  TrailDifficulty,
  TrailTerrain,
  TrailRouteType,
  TrailBestFor,
  TrailBenefit,
} from "@/constants/trailData";

const DIFFICULTY_OPTIONS: TrailDifficulty[] = ["Easy", "Moderate", "Hard"];
const TERRAIN_OPTIONS: TrailTerrain[] = ["woodland", "hill", "mountain", "coastal", "road", "mixed"];
const ROUTE_OPTIONS: TrailRouteType[] = ["loop", "out-and-back", "point-to-point"];
const BEST_FOR_OPTIONS: TrailBestFor[] = ["training", "family walk", "summit prep", "scenic walk"];
const BENEFIT_OPTIONS: TrailBenefit[] = ["cardio", "elevation", "endurance", "pack weight"];

const TERRAIN_EMOJI: Record<TrailTerrain, string> = {
  woodland: "🌲", hill: "⛰️", mountain: "🏔️", coastal: "🌊", road: "🛣️", mixed: "🗺️",
};

function SingleSelect<T extends string>({
  options,
  value,
  onChange,
  getLabel,
}: {
  options: T[];
  value: T | null;
  onChange: (v: T) => void;
  getLabel?: (v: T) => string;
}) {
  return (
    <View style={f.chips}>
      {options.map((o) => (
        <TouchableOpacity
          key={o}
          onPress={() => onChange(o)}
          style={[f.chip, value === o && f.chipActive]}
          activeOpacity={0.75}
        >
          <Text style={[f.chipText, value === o && f.chipTextActive]}>
            {getLabel ? getLabel(o) : o}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function MultiSelect<T extends string>({
  options,
  value,
  onChange,
  getLabel,
}: {
  options: T[];
  value: T[];
  onChange: (v: T[]) => void;
  getLabel?: (v: T) => string;
}) {
  function toggle(o: T) {
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  }
  return (
    <View style={f.chips}>
      {options.map((o) => (
        <TouchableOpacity
          key={o}
          onPress={() => toggle(o)}
          style={[f.chip, value.includes(o) && f.chipActive]}
          activeOpacity={0.75}
        >
          <Text style={[f.chipText, value.includes(o) && f.chipTextActive]}>
            {getLabel ? getLabel(o) : o}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function StepperField({
  label,
  value,
  onChange,
  min,
  step,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  unit?: string;
}) {
  const s = step ?? 1;
  const m = min ?? 0;
  return (
    <View style={f.field}>
      <Text style={f.label}>{label}</Text>
      <View style={f.stepRow}>
        <TouchableOpacity onPress={() => onChange(Math.max(m, value - s))} style={f.stepBtn}>
          <Text style={f.stepBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={f.stepVal}>{value}{unit}</Text>
        <TouchableOpacity onPress={() => onChange(value + s)} style={f.stepBtn}>
          <Text style={f.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const TERRAIN_LABELS: Record<TrailTerrain, string> = {
  woodland: "🌲 Woodland",
  hill: "⛰️ Hill",
  mountain: "🏔️ Mountain",
  coastal: "🌊 Coastal",
  road: "🛣️ Road",
  mixed: "🗺️ Mixed",
};

const ROUTE_LABELS: Record<TrailRouteType, string> = {
  loop: "🔄 Loop",
  "out-and-back": "↔️ Out & back",
  "point-to-point": "→ Point-to-point",
};

const BEST_FOR_LABELS: Record<TrailBestFor, string> = {
  training: "🏃 Training",
  "family walk": "👨‍👩‍👧 Family walk",
  "summit prep": "🏔️ Summit prep",
  "scenic walk": "📸 Scenic walk",
};

const BENEFIT_LABELS: Record<TrailBenefit, string> = {
  cardio: "💚 Cardio",
  elevation: "🟠 Elevation",
  endurance: "🟣 Endurance",
  "pack weight": "🔵 Pack weight",
};

export default function TrailsCreateScreen() {
  const insets = useSafeAreaInsets();
  const { addCustomRoute } = useApp();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [distance, setDistance] = useState(5);
  const [elevationGain, setElevationGain] = useState(200);
  const [estimatedTime, setEstimatedTime] = useState("2h 00m");
  const [difficulty, setDifficulty] = useState<TrailDifficulty | null>(null);
  const [terrain, setTerrain] = useState<TrailTerrain | null>(null);
  const [routeType, setRouteType] = useState<TrailRouteType | null>(null);
  const [bestFor, setBestFor] = useState<TrailBestFor[]>([]);
  const [trainingBenefits, setTrainingBenefits] = useState<TrailBenefit[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0 && location.trim().length > 0 && difficulty !== null && terrain !== null && routeType !== null;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addCustomRoute({
      name: name.trim(),
      location: location.trim(),
      description: description.trim(),
      distance,
      elevationGain,
      estimatedTime,
      difficulty: difficulty!,
      terrain: terrain!,
      routeType: routeType!,
      bestFor,
      trainingBenefits,
      notes,
      emoji: TERRAIN_EMOJI[terrain!],
    });
    setSaving(false);
    router.back();
  }

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            f.scroll,
            { paddingTop: Platform.OS === "web" ? 60 : insets.top + 16, paddingBottom: 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(400)} style={f.header}>
            <TouchableOpacity onPress={() => router.back()} style={f.backBtn}>
              <ArrowLeft size={20} color={T.text} />
            </TouchableOpacity>
            <View>
              <Text style={f.eyebrow}>EXPLORE TRAILS</Text>
              <Text style={f.title}>Create My Own Route</Text>
            </View>
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInDown.delay(60).duration(400)} style={f.form}>
            <View style={f.field}>
              <Text style={f.label}>Route name *</Text>
              <TextInput style={f.input} value={name} onChangeText={setName} placeholder="e.g. Bleaklow Loop" placeholderTextColor={T.textDim} />
            </View>

            <View style={f.field}>
              <Text style={f.label}>Location *</Text>
              <TextInput style={f.input} value={location} onChangeText={setLocation} placeholder="e.g. Peak District, Derbyshire" placeholderTextColor={T.textDim} />
            </View>

            <View style={f.field}>
              <Text style={f.label}>Description</Text>
              <TextInput style={[f.input, f.textArea]} value={description} onChangeText={setDescription} placeholder="Describe the route, highlights, conditions…" placeholderTextColor={T.textDim} multiline numberOfLines={4} textAlignVertical="top" />
            </View>

            <View style={f.row}>
              <StepperField label="Distance (km)" value={distance} onChange={setDistance} min={1} step={1} />
              <StepperField label="Elevation (m)" value={elevationGain} onChange={setElevationGain} min={0} step={50} />
            </View>

            <View style={f.field}>
              <Text style={f.label}>Estimated time</Text>
              <TextInput style={f.input} value={estimatedTime} onChangeText={setEstimatedTime} placeholder="e.g. 3h 30m" placeholderTextColor={T.textDim} />
            </View>

            <View style={f.field}>
              <Text style={f.label}>Difficulty *</Text>
              <SingleSelect options={DIFFICULTY_OPTIONS} value={difficulty} onChange={setDifficulty} />
            </View>

            <View style={f.field}>
              <Text style={f.label}>Terrain type *</Text>
              <SingleSelect options={TERRAIN_OPTIONS} value={terrain} onChange={setTerrain} getLabel={(v) => TERRAIN_LABELS[v]} />
            </View>

            <View style={f.field}>
              <Text style={f.label}>Route type *</Text>
              <SingleSelect options={ROUTE_OPTIONS} value={routeType} onChange={setRouteType} getLabel={(v) => ROUTE_LABELS[v]} />
            </View>

            <View style={f.field}>
              <Text style={f.label}>Best for</Text>
              <MultiSelect options={BEST_FOR_OPTIONS} value={bestFor} onChange={setBestFor} getLabel={(v) => BEST_FOR_LABELS[v]} />
            </View>

            <View style={f.field}>
              <Text style={f.label}>Training benefits</Text>
              <MultiSelect options={BENEFIT_OPTIONS} value={trainingBenefits} onChange={setTrainingBenefits} getLabel={(v) => BENEFIT_LABELS[v]} />
            </View>

            <View style={f.field}>
              <Text style={f.label}>Notes (optional)</Text>
              <TextInput style={[f.input, f.textArea]} value={notes} onChangeText={setNotes} placeholder="Personal notes, tips, parking, etc." placeholderTextColor={T.textDim} multiline numberOfLines={3} textAlignVertical="top" />
            </View>
          </Animated.View>

          {/* Save button */}
          <Animated.View entering={FadeInDown.delay(120).duration(400)}>
            <TouchableOpacity
              style={[f.saveBtn, (!canSave || saving) && { opacity: 0.4 }]}
              onPress={handleSave}
              disabled={!canSave || saving}
              activeOpacity={0.85}
            >
              <LinearGradient colors={["#3ECF75", "#2AB860"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={f.saveBtnGrad}>
                <Check size={18} color="#fff" />
                <Text style={f.saveBtnText}>{saving ? "Saving…" : "Save route"}</Text>
              </LinearGradient>
            </TouchableOpacity>
            {!canSave && (
              <Text style={f.hint}>Fill in name, location, difficulty, terrain and route type to save.</Text>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const f = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  eyebrow: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.textDim, letterSpacing: 1.2 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: T.text },
  form: { gap: 18, backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 18 },
  field: { gap: 10 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: T.text },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 14 },
  stepRow: { flexDirection: "row", alignItems: "center" },
  stepBtn: { width: 38, height: 38, backgroundColor: T.surface, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stepBtnText: { fontSize: 20, color: T.text, lineHeight: 24 },
  stepVal: { width: 60, textAlign: "center", fontSize: 15, fontFamily: "Inter_700Bold", color: T.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border },
  chipActive: { backgroundColor: T.greenDim, borderColor: T.green + "60" },
  chipText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  chipTextActive: { fontFamily: "Inter_600SemiBold", color: T.green },
  saveBtn: { borderRadius: 16, overflow: "hidden" },
  saveBtnGrad: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center", marginTop: 8 },
});
