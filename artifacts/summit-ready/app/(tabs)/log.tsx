import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { Session, useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const { width } = Dimensions.get("window");

const SESSION_TYPES = [
  { value: "cardio" as const, label: "Cardio", icon: "heart" as const, color: "#4CAF74" },
  { value: "hill" as const, label: "Hill Repeats", icon: "trending-up" as const, color: "#3B9CF5" },
  { value: "bigDay" as const, label: "Big Day", icon: "flag" as const, color: "#F2994A" },
];

function EffortDots({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const colors = useColors();
  const labels = ["Easy", "Moderate", "Hard", "Very Hard", "Max"];
  return (
    <View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(n)}
            style={[
              styles.effortDot,
              { backgroundColor: n <= value ? colors.accent : colors.border },
            ]}
          />
        ))}
      </View>
      {value > 0 && (
        <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 }}>
          {labels[value - 1]}
        </Text>
      )}
    </View>
  );
}

function SessionCard({ session, onDelete, onToggle }: {
  session: Session;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const colors = useColors();
  const typeInfo = SESSION_TYPES.find(t => t.value === session.type) ?? SESSION_TYPES[0];

  return (
    <View style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.sessionCardTop}>
        <View style={[styles.sessionTypeIcon, { backgroundColor: typeInfo.color + "20" }]}>
          <Feather name={typeInfo.icon} size={16} color={typeInfo.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sessionCardTitle, { color: colors.foreground }]}>{typeInfo.label}</Text>
          <Text style={[styles.sessionCardDate, { color: colors.mutedForeground }]}>
            {new Date(session.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onToggle(); }}
          style={[styles.checkBtn, { backgroundColor: session.completed ? colors.primary : colors.border }]}
        >
          <Feather name="check" size={14} color={session.completed ? "#fff" : colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
          <Feather name="trash-2" size={15} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      <View style={styles.sessionStats}>
        <View style={styles.statItem}>
          <Feather name="trending-up" size={12} color={colors.accent} />
          <Text style={[styles.statItemText, { color: colors.secondaryForeground }]}>{session.elevationGain}m</Text>
        </View>
        <View style={styles.statItem}>
          <Feather name="map" size={12} color={colors.primary} />
          <Text style={[styles.statItemText, { color: colors.secondaryForeground }]}>{session.distance}km</Text>
        </View>
        <View style={styles.statItem}>
          <Feather name="clock" size={12} color={colors.mutedForeground} />
          <Text style={[styles.statItemText, { color: colors.secondaryForeground }]}>{session.duration}min</Text>
        </View>
        <View style={styles.effortBar}>
          {[1, 2, 3, 4, 5].map(n => (
            <View
              key={n}
              style={[styles.effortBarPip, { backgroundColor: n <= session.effort ? colors.accent : colors.border }]}
            />
          ))}
        </View>
      </View>
      {session.notes ? (
        <Text style={[styles.notesText, { color: colors.mutedForeground }]} numberOfLines={2}>{session.notes}</Text>
      ) : null}
    </View>
  );
}

function AddSessionModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addSession, trainingPlan } = useApp();
  const [type, setType] = useState<"cardio" | "hill" | "bigDay">("cardio");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [distance, setDistance] = useState("");
  const [elevationGain, setElevationGain] = useState("");
  const [duration, setDuration] = useState("");
  const [effort, setEffort] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!distance || !elevationGain || !duration) return;
    setSaving(true);

    const today = new Date();
    const sessionDate = new Date(date);
    const weekNumber = trainingPlan.find(w => {
      const start = new Date(w.startDate);
      const end = new Date(w.endDate);
      return sessionDate >= start && sessionDate <= end;
    })?.weekNumber ?? 1;

    await addSession({
      date,
      type,
      distance: Number(distance),
      elevationGain: Number(elevationGain),
      duration: Number(duration),
      effort,
      notes: notes.trim(),
      completed: true,
      weekNumber,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(false);
    onClose();
    setDistance(""); setElevationGain(""); setDuration(""); setNotes(""); setEffort(3);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <LinearGradient colors={["#050C18", "#0B1120"]} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.modalScroll,
            { paddingTop: Platform.OS === "web" ? 60 : insets.top + 10, paddingBottom: 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Log Session</Text>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.surface }]}>
              <Feather name="x" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Session Type</Text>
          <View style={styles.typeRow}>
            {SESSION_TYPES.map(t => (
              <TouchableOpacity
                key={t.value}
                onPress={() => setType(t.value)}
                style={[
                  styles.typeChip,
                  { backgroundColor: type === t.value ? t.color : colors.surface, borderColor: type === t.value ? t.color : colors.border },
                ]}
              >
                <Feather name={t.icon} size={14} color={type === t.value ? "#fff" : colors.mutedForeground} />
                <Text style={[styles.typeChipText, { color: type === t.value ? "#fff" : colors.mutedForeground }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Date</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.mutedForeground}
          />

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Distance (km)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={distance}
                onChangeText={setDistance}
                placeholder="8.5"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Elev. Gain (m)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={elevationGain}
                onChangeText={setElevationGain}
                placeholder="450"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Duration (min)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
            value={duration}
            onChangeText={setDuration}
            placeholder="90"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Effort</Text>
          <EffortDots value={effort} onChange={v => setEffort(v as 1 | 2 | 3 | 4 | 5)} />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 16 }]}>Notes</Text>
          <TextInput
            style={[styles.notesInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="How did it feel?"
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: saving ? colors.muted : colors.primary }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Feather name="check" size={18} color="#fff" />
            <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Log Session"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
}

export default function LogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sessions, deleteSession, updateSession } = useApp();
  const [modalVisible, setModalVisible] = useState(false);

  const totalElev = sessions.filter(s => s.completed).reduce((a, s) => a + s.elevationGain, 0);
  const totalDist = sessions.filter(s => s.completed).reduce((a, s) => a + s.distance, 0);

  return (
    <LinearGradient colors={["#050C18", "#0B1120"]} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Platform.OS === "web" ? 80 : insets.top + 12,
            paddingBottom: Platform.OS === "web" ? 50 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logHeader}>
          <Text style={[styles.logTitle, { color: colors.foreground }]}>Session Log</Text>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => setModalVisible(true)}
          >
            <Feather name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.totalRow}>
          <View style={[styles.totalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="trending-up" size={18} color={colors.accent} />
            <Text style={[styles.totalVal, { color: colors.foreground }]}>{totalElev}m</Text>
            <Text style={[styles.totalLbl, { color: colors.mutedForeground }]}>Total Elevation</Text>
          </View>
          <View style={[styles.totalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="map" size={18} color={colors.primary} />
            <Text style={[styles.totalVal, { color: colors.foreground }]}>{totalDist.toFixed(1)}km</Text>
            <Text style={[styles.totalLbl, { color: colors.mutedForeground }]}>Total Distance</Text>
          </View>
          <View style={[styles.totalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="check-circle" size={18} color={colors.primary} />
            <Text style={[styles.totalVal, { color: colors.foreground }]}>{sessions.filter(s => s.completed).length}</Text>
            <Text style={[styles.totalLbl, { color: colors.mutedForeground }]}>Sessions</Text>
          </View>
        </View>

        {sessions.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="activity" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No sessions yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Log your first training session</Text>
            <TouchableOpacity
              style={[styles.emptyAddBtn, { backgroundColor: colors.primary }]}
              onPress={() => setModalVisible(true)}
            >
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Log a session</Text>
            </TouchableOpacity>
          </View>
        ) : (
          sessions.map(session => (
            <SessionCard
              key={session.id}
              session={session}
              onDelete={() => deleteSession(session.id)}
              onToggle={() => updateSession(session.id, { completed: !session.completed })}
            />
          ))
        )}
      </ScrollView>

      <AddSessionModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16 },
  logHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  logTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  addBtn: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  totalRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  totalCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: "center", gap: 4 },
  totalVal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  totalLbl: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  sessionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  sessionCardTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  sessionTypeIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sessionCardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sessionCardDate: { fontSize: 12, fontFamily: "Inter_400Regular" },
  checkBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  deleteBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  sessionStats: { flexDirection: "row", alignItems: "center", gap: 10 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statItemText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  effortBar: { flexDirection: "row", gap: 3, marginLeft: "auto" as any },
  effortBarPip: { width: 8, height: 8, borderRadius: 2 },
  notesText: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8, lineHeight: 16 },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular" },
  emptyAddBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  effortDot: { width: 36, height: 12, borderRadius: 4 },
  modalScroll: { paddingHorizontal: 20, gap: 0 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  modalTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  closeBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, marginTop: 14 },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  typeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  typeChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  notesInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 80,
    textAlignVertical: "top",
  },
  saveBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
  },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
