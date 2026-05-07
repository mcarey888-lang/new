import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Dimensions,
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
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Session, useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";

const SESSION_TYPES = [
  { value: "cardio" as const, label: "Cardio", icon: "heart" as const, color: T.green },
  { value: "hill" as const, label: "Hill Repeats", icon: "trending-up" as const, color: T.blue },
  { value: "bigDay" as const, label: "Big Day", icon: "flag" as const, color: T.orange },
];

function EffortPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const labels = ["Easy", "Steady", "Hard", "Very Hard", "Max"];
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 7 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(n)}
            style={[
              styles.effortBtn,
              { backgroundColor: n <= value ? T.orange : T.surface, borderColor: n <= value ? T.orange : T.border },
            ]}
          >
            <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: n <= value ? "#fff" : T.textMuted }}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted }}>{labels[value - 1]}</Text>
    </View>
  );
}

function SessionCard({ session, onDelete, onToggle, index }: {
  session: Session;
  onDelete: () => void;
  onToggle: () => void;
  index: number;
}) {
  const t = SESSION_TYPES.find(x => x.value === session.type) ?? SESSION_TYPES[0];
  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
      <View style={styles.sessionCard}>
        <LinearGradient
          colors={[t.color + "08", "transparent"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.scTop}>
          <View style={[styles.scTypeIcon, { backgroundColor: t.color + "18" }]}>
            <Feather name={t.icon} size={16} color={t.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scTitle}>{t.label}</Text>
            <Text style={styles.scDate}>
              {new Date(session.date).toLocaleDateString("en-GB", {
                weekday: "short", day: "numeric", month: "short",
              })}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onToggle(); }}
            style={[styles.checkBtn, { backgroundColor: session.completed ? T.green : T.surface }]}
          >
            <Feather name="check" size={13} color={session.completed ? "#fff" : T.textDim} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.delBtn}>
            <Feather name="trash-2" size={14} color={T.textDim} />
          </TouchableOpacity>
        </View>
        <View style={styles.scStats}>
          {[
            { icon: "trending-up" as const, val: `${session.elevationGain}m`, color: T.orange },
            { icon: "map" as const, val: `${session.distance}km`, color: T.blue },
            { icon: "clock" as const, val: `${session.duration}min`, color: T.textMuted },
          ].map((s, i) => (
            <View key={i} style={styles.scStat}>
              <Feather name={s.icon} size={11} color={s.color} />
              <Text style={[styles.scStatText, { color: s.color }]}>{s.val}</Text>
            </View>
          ))}
          <View style={styles.effortDots}>
            {[1, 2, 3, 4, 5].map(n => (
              <View
                key={n}
                style={[
                  styles.effortPip,
                  { backgroundColor: n <= session.effort ? T.orange : T.border },
                ]}
              />
            ))}
          </View>
        </View>
        {!!session.notes && (
          <Text style={styles.scNotes} numberOfLines={2}>{session.notes}</Text>
        )}
      </View>
    </Animated.View>
  );
}

function AddModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { addSession, trainingPlan } = useApp();
  const [type, setType] = useState<"cardio" | "hill" | "bigDay">("cardio");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [dist, setDist] = useState("");
  const [elev, setElev] = useState("");
  const [dur, setDur] = useState("");
  const [effort, setEffort] = useState<number>(3);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!dist || !elev || !dur) return;
    setSaving(true);
    const d = new Date(date);
    const weekNum = trainingPlan.find(w => {
      return new Date(w.startDate) <= d && new Date(w.endDate) >= d;
    })?.weekNumber ?? 1;

    await addSession({
      date, type,
      distance: Number(dist),
      elevationGain: Number(elev),
      duration: Number(dur),
      effort: effort as 1 | 2 | 3 | 4 | 5,
      notes: notes.trim(),
      completed: true,
      weekNumber: weekNum,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(false);
    onClose();
    setDist(""); setElev(""); setDur(""); setNotes(""); setEffort(3);
  }

  const inp = [styles.input];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={[
              styles.modalScroll,
              { paddingTop: Platform.OS === "web" ? 60 : insets.top + 16, paddingBottom: 48 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Session</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Feather name="x" size={18} color={T.white} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fLabel}>Session Type</Text>
            <View style={styles.typeRow}>
              {SESSION_TYPES.map(t => (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => setType(t.value)}
                  style={[
                    styles.typeBtn,
                    { borderColor: type === t.value ? t.color : T.border },
                    type === t.value && { backgroundColor: t.color + "18" },
                  ]}
                >
                  <Feather name={t.icon} size={15} color={type === t.value ? t.color : T.textMuted} />
                  <Text style={[styles.typeBtnText, { color: type === t.value ? t.color : T.textMuted }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fLabel}>Date</Text>
            <TextInput
              style={inp}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={T.textDim}
              keyboardType="numbers-and-punctuation"
            />

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fLabel}>Distance (km)</Text>
                <TextInput style={inp} value={dist} onChangeText={setDist} placeholder="8.5" placeholderTextColor={T.textDim} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fLabel}>Elev. Gain (m)</Text>
                <TextInput style={inp} value={elev} onChangeText={setElev} placeholder="450" placeholderTextColor={T.textDim} keyboardType="number-pad" />
              </View>
            </View>

            <Text style={styles.fLabel}>Duration (min)</Text>
            <TextInput style={inp} value={dur} onChangeText={setDur} placeholder="90" placeholderTextColor={T.textDim} keyboardType="number-pad" />

            <Text style={styles.fLabel}>Effort Level</Text>
            <EffortPicker value={effort} onChange={setEffort} />

            <Text style={[styles.fLabel, { marginTop: 16 }]}>Notes</Text>
            <TextInput
              style={[inp, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="How did it feel?"
              placeholderTextColor={T.textDim}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              onPress={save}
              disabled={saving}
              style={[styles.saveBtn, { opacity: saving ? 0.7 : 1 }]}
              activeOpacity={0.85}
            >
              <LinearGradient colors={["#3ECF75", "#2AB860"]} style={styles.saveBtnGrad}>
                <Feather name="check" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Log Session"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Modal>
  );
}

export default function LogScreen() {
  const insets = useSafeAreaInsets();
  const { sessions, deleteSession, updateSession } = useApp();
  const [modalOpen, setModalOpen] = useState(false);

  const done = sessions.filter(s => s.completed);
  const totalElev = done.reduce((a, s) => a + s.elevationGain, 0);
  const totalDist = done.reduce((a, s) => a + s.distance, 0);

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Platform.OS === "web" ? 56 : insets.top + 16,
            paddingBottom: Platform.OS === "web" ? 110 : insets.bottom + 110,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <Text style={styles.title}>Session Log</Text>
          <TouchableOpacity onPress={() => setModalOpen(true)} style={styles.addBtn}>
            <LinearGradient colors={["#3ECF75", "#2AB860"]} style={styles.addBtnGrad}>
              <Feather name="plus" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Summary Strip */}
        <Animated.View entering={FadeInDown.delay(60).duration(400)}>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryItem}>
              <Feather name="trending-up" size={18} color={T.orange} />
              <Text style={styles.summaryVal}>{totalElev}m</Text>
              <Text style={styles.summaryLbl}>Total Elevation</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Feather name="map" size={18} color={T.blue} />
              <Text style={styles.summaryVal}>{totalDist.toFixed(1)}km</Text>
              <Text style={styles.summaryLbl}>Distance</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Feather name="check-circle" size={18} color={T.green} />
              <Text style={styles.summaryVal}>{done.length}</Text>
              <Text style={styles.summaryLbl}>Sessions</Text>
            </View>
          </View>
        </Animated.View>

        {sessions.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: T.blueDim }]}>
              <Feather name="activity" size={30} color={T.blue} />
            </View>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptySub}>Log your first training session</Text>
            <TouchableOpacity onPress={() => setModalOpen(true)} style={styles.emptyBtn}>
              <LinearGradient colors={["#3ECF75", "#2AB860"]} style={styles.emptyBtnGrad}>
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Log a session</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          sessions.map((s, i) => (
            <SessionCard
              key={s.id}
              session={s}
              index={i}
              onDelete={() => deleteSession(s.id)}
              onToggle={() => updateSession(s.id, { completed: !s.completed })}
            />
          ))
        )}
      </ScrollView>
      <AddModal visible={modalOpen} onClose={() => setModalOpen(false)} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.white },
  addBtn: { borderRadius: 13, overflow: "hidden" },
  addBtnGrad: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  summaryStrip: {
    backgroundColor: T.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.cardBorder,
    flexDirection: "row",
    paddingVertical: 16,
    marginBottom: 16,
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 4 },
  summaryVal: { fontSize: 20, fontFamily: "Inter_700Bold", color: T.white },
  summaryLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  summaryDivider: { width: 1, backgroundColor: T.border, marginVertical: 4 },
  sessionCard: {
    backgroundColor: T.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.cardBorder,
    padding: 14,
    marginBottom: 10,
    overflow: "hidden",
    gap: 10,
  },
  scTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  scTypeIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  scTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.white },
  scDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  checkBtn: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  delBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  scStats: { flexDirection: "row", alignItems: "center", gap: 12 },
  scStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  scStatText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  effortDots: { flexDirection: "row", gap: 3, marginLeft: "auto" as any },
  effortPip: { width: 9, height: 9, borderRadius: 3 },
  scNotes: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 17 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: T.white, marginTop: 4 },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted },
  emptyBtn: { borderRadius: 14, overflow: "hidden", marginTop: 8 },
  emptyBtnGrad: { paddingHorizontal: 28, paddingVertical: 14 },
  effortBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: { paddingHorizontal: 22, gap: 0 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 28 },
  modalTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.white },
  closeBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  fLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted, letterSpacing: 0.4, marginBottom: 8, marginTop: 16 },
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
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    gap: 5,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: T.surface,
  },
  typeBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  notesInput: { height: 80, paddingTop: 14, textAlignVertical: "top" },
  saveBtn: { borderRadius: 16, overflow: "hidden", marginTop: 24 },
  saveBtnGrad: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  saveBtnText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
});
