import type { LucideIcon } from "lucide-react-native";
import { Heart, TrendingUp, Flag, X, Search, Minus, Plus, Map, Clock, Check, Trash2, Activity, CheckCircle } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useState, useMemo } from "react";
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

import { Session, ExploreHike, NearbyHill, useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";

const SESSION_TYPES: { value: "cardio" | "hill" | "bigDay"; label: string; icon: LucideIcon; color: string }[] = [
  { value: "cardio", label: "Cardio", icon: Heart, color: T.green },
  { value: "hill", label: "Hill Repeats", icon: TrendingUp, color: T.blue },
  { value: "bigDay", label: "Big Day", icon: Flag, color: T.orange },
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

// ── Hill Search + Rep Picker ────────────────────────────────────────────────
function HillSearchSection({
  hills,
  selectedHill,
  reps,
  onSelectHill,
  onChangeReps,
}: {
  hills: NearbyHill[];
  selectedHill: NearbyHill | null;
  reps: number;
  onSelectHill: (h: NearbyHill | null) => void;
  onChangeReps: (r: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return hills.slice(0, 8);
    const q = query.toLowerCase();
    return hills.filter(h => h.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, hills]);

  const showList = focused && !selectedHill && hills.length > 0;

  return (
    <View style={{ gap: 0 }}>
      <Text style={styles.fLabel}>Hill</Text>

      {selectedHill ? (
        // Selected hill pill
        <View style={styles.hillSelectedRow}>
          <Text style={styles.hillEmoji}>{selectedHill.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.hillSelectedName}>{selectedHill.name}</Text>
            <Text style={styles.hillSelectedMeta}>
              {selectedHill.elevation}m gain · {selectedHill.grade} grade
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => { onSelectHill(null); setQuery(""); }}
            style={styles.hillClearBtn}
          >
            <X size={14} color={T.textMuted} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.hillSearchWrap}>
          <Search size={15} color={T.textMuted} style={{ marginLeft: 14 }} />
          <TextInput
            style={styles.hillSearchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={hills.length > 0 ? "Search your hills..." : "No hills found — add some in setup"}
            placeholderTextColor={T.textDim}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            editable={hills.length > 0}
          />
        </View>
      )}

      {showList && (
        <View style={styles.hillListBox}>
          {filtered.length === 0 ? (
            <Text style={styles.hillNoMatch}>No hills match "{query}"</Text>
          ) : (
            filtered.map((h, i) => (
              <TouchableOpacity
                key={h.name + i}
                onPress={() => {
                  onSelectHill(h);
                  setFocused(false);
                  setQuery("");
                  Haptics.selectionAsync();
                }}
                style={[styles.hillListItem, i > 0 && styles.hillListDivider]}
              >
                <Text style={styles.hillItemEmoji}>{h.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hillItemName}>{h.name}</Text>
                  <Text style={styles.hillItemMeta}>{h.elevation}m · {h.grade} · {h.distance.toFixed(1)}km</Text>
                </View>
                <Text style={styles.hillItemElev}>↑{h.elevation}m</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {/* Rep stepper — only visible once a hill is selected */}
      {selectedHill && (
        <View style={styles.repSection}>
          <Text style={styles.fLabel}>Reps</Text>
          <View style={styles.repRow}>
            <TouchableOpacity
              onPress={() => { if (reps > 1) { onChangeReps(reps - 1); Haptics.selectionAsync(); } }}
              style={[styles.repBtn, { opacity: reps <= 1 ? 0.35 : 1 }]}
            >
              <Minus size={18} color={T.white} />
            </TouchableOpacity>

            <View style={styles.repDisplay}>
              <Text style={styles.repCount}>{reps}</Text>
              <Text style={styles.repUnit}>rep{reps !== 1 ? "s" : ""}</Text>
            </View>

            <TouchableOpacity
              onPress={() => { onChangeReps(reps + 1); Haptics.selectionAsync(); }}
              style={styles.repBtn}
            >
              <Plus size={18} color={T.white} />
            </TouchableOpacity>

            <View style={styles.repAutoFill}>
              <TrendingUp size={12} color={T.orange} />
              <Text style={styles.repAutoFillText}>
                {selectedHill.elevation * reps}m gain
              </Text>
              <Text style={styles.repAutoFillSep}>·</Text>
              <Map size={12} color={T.blue} />
              <Text style={[styles.repAutoFillText, { color: T.blue }]}>
                {(selectedHill.distance * reps).toFixed(1)}km
              </Text>
            </View>
          </View>
        </View>
      )}
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
            {(() => { const TIcon = t.icon; return <TIcon size={16} color={t.color} />; })()}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scTitle}>
              {session.hillName ? session.hillName : t.label}
            </Text>
            <Text style={styles.scDate}>
              {new Date(session.date).toLocaleDateString("en-GB", {
                weekday: "short", day: "numeric", month: "short",
              })}
              {session.reps ? ` · ${session.reps} rep${session.reps !== 1 ? "s" : ""}` : ""}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onToggle(); }}
            style={[styles.checkBtn, { backgroundColor: session.completed ? T.green : T.surface }]}
          >
            <Check size={13} color={session.completed ? "#fff" : T.textDim} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.delBtn}>
            <Trash2 size={14} color={T.textDim} />
          </TouchableOpacity>
        </View>
        <View style={styles.scStats}>
          {([
            { icon: TrendingUp, val: `${session.elevationGain}m`, color: T.orange },
            { icon: Map, val: `${session.distance}km`, color: T.blue },
            { icon: Clock, val: `${session.duration}min`, color: T.textMuted },
          ] as { icon: LucideIcon; val: string; color: string }[]).map((s, i) => {
            const SIcon = s.icon;
            return (
            <View key={i} style={styles.scStat}>
              <SIcon size={11} color={s.color} />
              <Text style={[styles.scStatText, { color: s.color }]}>{s.val}</Text>
            </View>
          );
          })}
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

function ExploreHikeCard({ hike, onDelete, index }: {
  hike: ExploreHike;
  onDelete: () => void;
  index: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
      <View style={styles.sessionCard}>
        <LinearGradient colors={[T.green + "08", "transparent"]} style={StyleSheet.absoluteFill} />
        <View style={styles.scTop}>
          <View style={[styles.scTypeIcon, { backgroundColor: T.green + "18" }]}>
            <Map size={16} color={T.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scTitle}>{hike.name}</Text>
            <Text style={styles.scDate}>
              {new Date(hike.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
              {" · Trail / Hike"}
            </Text>
          </View>
          <TouchableOpacity onPress={onDelete} style={styles.delBtn}>
            <Trash2 size={14} color={T.textDim} />
          </TouchableOpacity>
        </View>
        <View style={styles.scStats}>
          {([
            { icon: TrendingUp, val: `${hike.elevationGain}m`, color: T.orange },
            { icon: Map, val: `${hike.distance}km`, color: T.blue },
            { icon: Clock, val: `${hike.timeTaken}min`, color: T.textMuted },
          ] as { icon: LucideIcon; val: string; color: string }[]).map((s, i) => {
            const SIcon = s.icon;
            return (
              <View key={i} style={styles.scStat}>
                <SIcon size={11} color={s.color} />
                <Text style={[styles.scStatText, { color: s.color }]}>{s.val}</Text>
              </View>
            );
          })}
        </View>
        {!!hike.notes && <Text style={styles.scNotes} numberOfLines={2}>{hike.notes}</Text>}
      </View>
    </Animated.View>
  );
}

function AddModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { addSession, trainingPlan, nearbyHills } = useApp();
  const [type, setType] = useState<"cardio" | "hill" | "bigDay">("cardio");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [dist, setDist] = useState("");
  const [elev, setElev] = useState("");
  const [dur, setDur] = useState("");
  const [effort, setEffort] = useState<number>(3);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Hill repeats
  const [selectedHill, setSelectedHill] = useState<NearbyHill | null>(null);
  const [reps, setReps] = useState(3);

  function handleSelectHill(h: NearbyHill | null) {
    setSelectedHill(h);
    if (h) {
      setElev(String(h.elevation * reps));
      setDist((h.distance * reps).toFixed(1));
    }
  }

  function handleChangeReps(r: number) {
    setReps(r);
    if (selectedHill) {
      setElev(String(selectedHill.elevation * r));
      setDist((selectedHill.distance * r).toFixed(1));
    }
  }

  function handleTypeChange(t: "cardio" | "hill" | "bigDay") {
    setType(t);
    if (t !== "hill") {
      setSelectedHill(null);
      setReps(3);
    }
  }

  function reset() {
    setType("cardio");
    setDate(new Date().toISOString().split("T")[0]);
    setDist(""); setElev(""); setDur(""); setNotes(""); setEffort(3);
    setSelectedHill(null); setReps(3);
  }

  async function save() {
    if (!elev || !dur) return;
    setSaving(true);
    const d = new Date(date);
    const weekNum = trainingPlan.find(w => {
      return new Date(w.startDate) <= d && new Date(w.endDate) >= d;
    })?.weekNumber ?? 1;

    await addSession({
      date, type,
      distance: Number(dist) || 0,
      elevationGain: Number(elev),
      duration: Number(dur),
      effort: effort as 1 | 2 | 3 | 4 | 5,
      notes: notes.trim(),
      completed: true,
      weekNumber: weekNum,
      hillName: selectedHill?.name,
      reps: selectedHill ? reps : undefined,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(false);
    onClose();
    reset();
  }

  // Validation: hill sessions only need elev + dur; others need dist too
  const isValid = type === "hill"
    ? !!elev && !!dur
    : !!dist && !!elev && !!dur;

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
              <TouchableOpacity onPress={() => { onClose(); reset(); }} style={styles.closeBtn}>
                <X size={18} color={T.white} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fLabel}>Session Type</Text>
            <View style={styles.typeRow}>
              {SESSION_TYPES.map(t => (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => handleTypeChange(t.value)}
                  style={[
                    styles.typeBtn,
                    { borderColor: type === t.value ? t.color : T.border },
                    type === t.value && { backgroundColor: t.color + "18" },
                  ]}
                >
                  {(() => { const TBtnIcon = t.icon; return <TBtnIcon size={15} color={type === t.value ? t.color : T.textMuted} />; })()}
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

            {/* Hill search — only for Hill Repeats */}
            {type === "hill" && (
              <HillSearchSection
                hills={nearbyHills}
                selectedHill={selectedHill}
                reps={reps}
                onSelectHill={handleSelectHill}
                onChangeReps={handleChangeReps}
              />
            )}

            {/* Stats row — auto-filled from hill selection but always editable */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              {type !== "hill" && (
                <View style={{ flex: 1 }}>
                  <Text style={styles.fLabel}>Distance (km)</Text>
                  <TextInput style={inp} value={dist} onChangeText={setDist} placeholder="8.5" placeholderTextColor={T.textDim} keyboardType="decimal-pad" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.fLabel}>Elev. Gain (m)</Text>
                <TextInput
                  style={[inp, selectedHill && styles.inputAutoFilled]}
                  value={elev}
                  onChangeText={setElev}
                  placeholder="450"
                  placeholderTextColor={T.textDim}
                  keyboardType="number-pad"
                />
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
              disabled={saving || !isValid}
              style={[styles.saveBtn, { opacity: saving || !isValid ? 0.5 : 1 }]}
              activeOpacity={0.85}
            >
              <LinearGradient colors={["#3ECF75", "#2AB860"]} style={styles.saveBtnGrad}>
                <Check size={18} color="#fff" />
                <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Log Session"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Modal>
  );
}

type LogItem =
  | { kind: "session"; data: Session }
  | { kind: "hike"; data: ExploreHike };

export default function LogScreen() {
  const insets = useSafeAreaInsets();
  const { sessions, deleteSession, updateSession, exploreHikes, deleteExploreHike } = useApp();
  const [modalOpen, setModalOpen] = useState(false);

  const allItems = useMemo<LogItem[]>(() => {
    const items: LogItem[] = [
      ...sessions.map(s => ({ kind: "session" as const, data: s })),
      ...exploreHikes.map(h => ({ kind: "hike" as const, data: h })),
    ];
    return items.sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());
  }, [sessions, exploreHikes]);

  const totalElev = useMemo(() =>
    sessions.filter(s => s.completed).reduce((a, s) => a + s.elevationGain, 0) +
    exploreHikes.reduce((a, h) => a + h.elevationGain, 0),
  [sessions, exploreHikes]);

  const totalDist = useMemo(() =>
    sessions.filter(s => s.completed).reduce((a, s) => a + s.distance, 0) +
    exploreHikes.reduce((a, h) => a + h.distance, 0),
  [sessions, exploreHikes]);

  const totalCount = sessions.filter(s => s.completed).length + exploreHikes.length;

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
              <Plus size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Summary Strip */}
        <Animated.View entering={FadeInDown.delay(60).duration(400)}>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryItem}>
              <TrendingUp size={18} color={T.orange} />
              <Text style={styles.summaryVal}>{totalElev}m</Text>
              <Text style={styles.summaryLbl}>Total Elevation</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Map size={18} color={T.blue} />
              <Text style={styles.summaryVal}>{totalDist.toFixed(1)}km</Text>
              <Text style={styles.summaryLbl}>Distance</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <CheckCircle size={18} color={T.green} />
              <Text style={styles.summaryVal}>{totalCount}</Text>
              <Text style={styles.summaryLbl}>Sessions</Text>
            </View>
          </View>
        </Animated.View>

        {allItems.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: T.blueDim }]}>
              <Activity size={30} color={T.blue} />
            </View>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptySub}>Log your first training session or hike</Text>
            <TouchableOpacity onPress={() => setModalOpen(true)} style={styles.emptyBtn}>
              <LinearGradient colors={["#3ECF75", "#2AB860"]} style={styles.emptyBtnGrad}>
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Log a session</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          allItems.map((item, i) =>
            item.kind === "session" ? (
              <SessionCard
                key={item.data.id}
                session={item.data}
                index={i}
                onDelete={() => deleteSession(item.data.id)}
                onToggle={() => updateSession(item.data.id, { completed: !item.data.completed })}
              />
            ) : (
              <ExploreHikeCard
                key={item.data.id}
                hike={item.data}
                index={i}
                onDelete={() => deleteExploreHike(item.data.id)}
              />
            )
          )
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
  inputAutoFilled: {
    borderColor: T.orange + "50",
    backgroundColor: T.orange + "08",
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

  // Hill search
  hillSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.blue + "40",
    height: 50,
    gap: 8,
  },
  hillSearchInput: {
    flex: 1,
    height: 50,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: T.white,
    paddingRight: 14,
  },
  hillListBox: {
    backgroundColor: T.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    marginTop: 6,
    overflow: "hidden",
  },
  hillListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  hillListDivider: {
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  hillItemEmoji: { fontSize: 20 },
  hillItemName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.white },
  hillItemMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  hillItemElev: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.orange },
  hillSelectedRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.blue + "12",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.blue + "40",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  hillEmoji: { fontSize: 24 },
  hillSelectedName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.white },
  hillSelectedMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  hillClearBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: T.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  hillNoMatch: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, padding: 14 },

  // Rep stepper
  repSection: { marginTop: 0 },
  repRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  repBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
  },
  repDisplay: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    minWidth: 52,
    justifyContent: "center",
  },
  repCount: { fontSize: 28, fontFamily: "Inter_700Bold", color: T.white },
  repUnit: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },
  repAutoFill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: T.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: T.border,
  },
  repAutoFillText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.orange },
  repAutoFillSep: { fontSize: 12, color: T.textDim },
});
