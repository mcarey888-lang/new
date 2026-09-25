import React, { useState } from "react";
import {
  KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import type { AlpineExperience, AlpineExperienceCategory } from "@/context/AppContext";
import { T } from "@/constants/theme";

const SOURCES: { value: AlpineExperience["source"]; label: string }[] = [
  { value: "prior-experience", label: "Prior experience" },
  { value: "course", label: "Course / instructor" },
  { value: "guided-trip", label: "Guided trip" },
  { value: "other", label: "Other" },
];

interface Props {
  category: AlpineExperienceCategory;
  requirement: string;
  existing?: AlpineExperience;
  onSave: (record: AlpineExperience) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
}

export function AlpineExperienceEditor({
  category, requirement, existing, onSave, onRemove, onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<AlpineExperience["status"]>(existing?.status ?? "completed");
  const [source, setSource] = useState<AlpineExperience["source"]>(existing?.source ?? "prior-experience");
  const [note, setNote] = useState(existing?.note ?? "");
  const [date, setDate] = useState(existing?.date ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    const detail = note.trim();
    const when = date.trim();
    const parsedDate = when ? new Date(`${when}T12:00:00`) : null;
    if (!detail) {
      setError("Describe the experience, training, or booked trip.");
      return;
    }
    if (when && (!/^\d{4}-\d{2}-\d{2}$/.test(when)
      || !parsedDate || Number.isNaN(parsedDate.getTime())
      || parsedDate.toISOString().slice(0, 10) !== when)) {
      setError("Use a valid date in YYYY-MM-DD format, or leave it blank.");
      return;
    }
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    if (status === "completed" && parsedDate && parsedDate.getTime() > today.getTime()) {
      setError("A future trip or training day should be recorded as planned.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ status, source, note: detail, ...(when ? { date: when } : {}) });
      onClose();
    } catch {
      setError("Couldn't save this record. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setError("");
    try {
      await onRemove();
      onClose();
    } catch {
      setError("Couldn't remove this record. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>{category === "technical" ? "TECHNICAL SKILLS" : "ALTITUDE PREPARATION"}</Text>
              <Text style={styles.title}>Record your experience</Text>
            </View>
            <TouchableOpacity
              onPress={onClose} accessibilityRole="button" accessibilityLabel="Close experience form"
              style={styles.close} disabled={saving}
            >
              <X size={21} color={T.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text style={styles.requirement}>{requirement}</Text>
            <Text style={styles.helper}>A booked trip can include training or acclimatisation days. Record it as planned until those days have happened.</Text>

            <Text style={styles.label}>STATUS</Text>
            <View style={styles.options}>
              {(["completed", "planned"] as const).map(option => (
                <TouchableOpacity
                  key={option} onPress={() => { setStatus(option); setError(""); }}
                  accessibilityRole="radio" accessibilityState={{ selected: status === option }}
                  accessibilityLabel={option === "completed" ? "Already completed" : "Planned for a future trip"}
                  style={[styles.choice, status === option && styles.choiceSelected]}
                >
                  <Text style={[styles.choiceText, status === option && styles.choiceTextSelected]}>
                    {option === "completed" ? "Already done" : "Planned"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>HOW DID YOU LEARN OR PLAN THIS?</Text>
            <View style={styles.options}>
              {SOURCES.map(option => (
                <TouchableOpacity
                  key={option.value} onPress={() => setSource(option.value)}
                  accessibilityRole="radio" accessibilityState={{ selected: source === option.value }}
                  accessibilityLabel={option.label}
                  style={[styles.choice, source === option.value && styles.choiceSelected]}
                >
                  <Text style={[styles.choiceText, source === option.value && styles.choiceTextSelected]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>DETAILS</Text>
            <TextInput
              value={note} onChangeText={setNote} multiline
              maxLength={600}
              placeholder={category === "technical"
                ? "e.g. Practised crampon walking and ice axe arrest with a guide…"
                : "e.g. Booked a trip with two acclimatisation days…"}
              placeholderTextColor={T.textDim}
              style={[styles.input, styles.notes]}
              accessibilityLabel="Experience or trip details"
              textAlignVertical="top"
            />
            <Text style={styles.label}>DATE (OPTIONAL)</Text>
            <TextInput
              value={date} onChangeText={setDate}
              maxLength={10} placeholder="YYYY-MM-DD" placeholderTextColor={T.textDim}
              autoCapitalize="none" keyboardType="numbers-and-punctuation"
              style={styles.input} accessibilityLabel="Experience or planned trip date"
            />
            <Text style={styles.disclaimer}>Saved on this device and self-reported. This is a preparation record, not a certification or a guide's assessment of readiness.</Text>
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <TouchableOpacity
              onPress={save} disabled={saving}
              style={[styles.save, saving && styles.disabled]}
              accessibilityRole="button" accessibilityLabel="Save experience"
            >
              <Text style={styles.saveText}>{saving ? "Saving…" : "Save experience"}</Text>
            </TouchableOpacity>
            {existing && (
              confirmRemove ? (
                <View style={styles.removeConfirm}>
                  <Text style={styles.helper}>Remove this record? Its progress will no longer count.</Text>
                  <View style={styles.options}>
                    <TouchableOpacity onPress={() => setConfirmRemove(false)} style={styles.choice} accessibilityRole="button">
                      <Text style={styles.choiceText}>Keep it</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={remove} disabled={saving} style={styles.choice} accessibilityRole="button">
                      <Text style={styles.removeText}>Remove record</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setConfirmRemove(true)} style={styles.remove} accessibilityRole="button">
                  <Text style={styles.removeText}>Remove record</Text>
                </TouchableOpacity>
              )
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.68)" },
  sheet: { backgroundColor: T.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderTopWidth: 1, borderColor: T.border, maxHeight: "88%" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  headerText: { flex: 1 },
  eyebrow: { fontSize: 10, letterSpacing: 1.5, color: T.blue, fontFamily: "Inter_700Bold" },
  title: { color: T.text, fontFamily: "Inter_700Bold", fontSize: 20, marginTop: 5 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingBottom: 20, gap: 11 },
  requirement: { color: T.text, fontFamily: "Inter_600SemiBold", fontSize: 14, lineHeight: 20 },
  helper: { color: T.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  label: { color: T.textMuted, fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.3, marginTop: 9 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { borderWidth: 1, borderColor: T.border, borderRadius: 8, backgroundColor: T.surface, paddingHorizontal: 12, paddingVertical: 9, minHeight: 40, justifyContent: "center" },
  choiceSelected: { borderColor: T.blue, backgroundColor: T.blue + "22" },
  choiceText: { color: T.textMuted, fontFamily: "Inter_600SemiBold", fontSize: 12 },
  choiceTextSelected: { color: T.text },
  input: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 8, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, color: T.text, fontSize: 14, fontFamily: "Inter_400Regular" },
  notes: { minHeight: 92 },
  disclaimer: { color: T.textDim, fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 16, marginTop: 4 },
  error: { color: T.orange, fontFamily: "Inter_500Medium", fontSize: 12 },
  save: { minHeight: 46, borderRadius: 8, backgroundColor: T.green, alignItems: "center", justifyContent: "center", marginTop: 4 },
  saveText: { color: T.bg, fontSize: 13, fontFamily: "Inter_700Bold" },
  disabled: { opacity: 0.55 },
  remove: { alignSelf: "center", padding: 12 },
  removeConfirm: { gap: 8, alignItems: "center", marginTop: 4 },
  removeText: { color: T.orange, fontFamily: "Inter_600SemiBold", fontSize: 12 },
});