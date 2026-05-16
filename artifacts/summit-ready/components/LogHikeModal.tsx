import { Check, X } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { T } from "@/constants/theme";
import { useApp } from "@/context/AppContext";

function Stepper({ value, onChange, min = 0, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; step?: number }) {
  return (
    <View style={s.stepRow}>
      <TouchableOpacity onPress={() => onChange(Math.max(min, value - step))} style={s.stepBtn}>
        <Text style={s.stepBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={s.stepVal}>{value}</Text>
      <TouchableOpacity onPress={() => onChange(value + step)} style={s.stepBtn}>
        <Text style={s.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

interface Props {
  visible: boolean;
  prefillName?: string;
  onClose: () => void;
}

export function LogHikeModal({ visible, prefillName, onClose }: Props) {
  const { logExploreHike } = useApp();
  const today = new Date().toISOString().split("T")[0];
  const [name, setName] = useState(prefillName ?? "");
  const [date, setDate] = useState(today);
  const [distance, setDistance] = useState(5);
  const [elevationGain, setElevationGain] = useState(200);
  const [timeTaken, setTimeTaken] = useState(90);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(prefillName ?? "");
      setDate(today);
    }
  }, [visible, prefillName]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await logExploreHike({ name: name.trim(), date, distance, elevationGain, timeTaken, notes });
    setSaving(false);
    setNotes("");
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={s.container}>
          <View style={s.handle} />
          <View style={s.header}>
            <Text style={s.title}>Log a Session</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <X size={18} color={T.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={s.field}>
              <Text style={s.label}>Hill / trail name *</Text>
              <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Mam Tor" placeholderTextColor={T.textDim} />
            </View>
            <View style={s.field}>
              <Text style={s.label}>Date</Text>
              <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={T.textDim} />
            </View>
            <View style={s.row}>
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.label}>Distance (km)</Text>
                <Stepper value={distance} onChange={setDistance} min={1} />
              </View>
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.label}>Time (min)</Text>
                <Stepper value={timeTaken} onChange={setTimeTaken} min={10} step={5} />
              </View>
            </View>
            <View style={s.field}>
              <Text style={s.label}>Elevation gain (m)</Text>
              <Stepper value={elevationGain} onChange={setElevationGain} min={0} step={50} />
            </View>
            <View style={s.field}>
              <Text style={s.label}>Notes (optional)</Text>
              <TextInput style={[s.input, s.textArea]} value={notes} onChangeText={setNotes} placeholder="How did it feel?" placeholderTextColor={T.textDim} multiline numberOfLines={3} />
            </View>
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity
              style={[s.saveBtn, (!name.trim() || saving) && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={!name.trim() || saving}
              activeOpacity={0.85}
            >
              <LinearGradient colors={["#3ECF75", "#2AB860"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtnGrad}>
                <Check size={18} color="#fff" />
                <Text style={s.saveBtnText}>{saving ? "Saving…" : "Save session"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  handle: { width: 36, height: 4, backgroundColor: T.surface, borderRadius: 2, alignSelf: "center", marginTop: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: T.text },
  closeBtn: { padding: 6, backgroundColor: T.surface, borderRadius: 10 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32, gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: T.text },
  textArea: { height: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 14 },
  footer: { paddingHorizontal: 20, paddingBottom: Platform.OS === "ios" ? 36 : 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.border },
  saveBtn: { borderRadius: 16, overflow: "hidden" },
  saveBtnGrad: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  stepRow: { flexDirection: "row", alignItems: "center" },
  stepBtn: { width: 36, height: 36, backgroundColor: T.surface, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stepBtnText: { fontSize: 20, color: T.text, lineHeight: 24 },
  stepVal: { width: 50, textAlign: "center", fontSize: 16, fontFamily: "Inter_700Bold", color: T.text },
});
