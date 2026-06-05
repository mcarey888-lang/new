import type { LucideIcon } from "lucide-react-native";
import {
  Heart, TrendingUp, Flag, X, Search, Minus, Plus,
  Map, Clock, Check, Activity, ChevronRight,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useState, useMemo, useEffect } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NearbyHill, TrainingWeek, useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";

// ── Shared types ─────────────────────────────────────────────────────────────

export type TrainingSeed = {
  type: "cardio" | "hill" | "bigDay";
  cardioSubtype?: "treadmill" | "stepper" | "outdoor";
  treadmillIncline?: number;
  label?: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

export const SESSION_TYPES: {
  value: "cardio" | "hill" | "bigDay";
  label: string;
  icon: LucideIcon;
  color: string;
}[] = [
  { value: "cardio",  label: "Cardio",       icon: Heart,     color: T.green  },
  { value: "hill",    label: "Hill Repeats",  icon: TrendingUp, color: T.blue   },
  { value: "bigDay",  label: "Big Day",       icon: Flag,      color: T.orange },
];

// ── Effort picker ─────────────────────────────────────────────────────────────

export function EffortPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const labels = ["Easy", "Steady", "Hard", "Very Hard", "Max"];
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 7 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(n)}
            style={[
              ms.effortBtn,
              { backgroundColor: n <= value ? T.orange : T.surface, borderColor: n <= value ? T.orange : T.border },
            ]}
          >
            <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: n <= value ? "#fff" : T.textMuted }}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted }}>
        {labels[value - 1]}
      </Text>
    </View>
  );
}

// ── Hill search + rep picker ──────────────────────────────────────────────────

export function HillSearchSection({
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
      <Text style={ms.fLabel}>Hill</Text>

      {selectedHill ? (
        <View style={ms.hillSelectedRow}>
          <Text style={ms.hillEmoji}>{selectedHill.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={ms.hillSelectedName}>{selectedHill.name}</Text>
            <Text style={ms.hillSelectedMeta}>
              {selectedHill.elevation}m gain · {selectedHill.grade} grade
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => { onSelectHill(null); setQuery(""); }}
            style={ms.hillClearBtn}
          >
            <X size={14} color={T.textMuted} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={ms.hillSearchWrap}>
          <Search size={15} color={T.textMuted} style={{ marginLeft: 14 }} />
          <TextInput
            style={ms.hillSearchInput}
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
        <View style={ms.hillListBox}>
          {filtered.length === 0 ? (
            <Text style={ms.hillNoMatch}>No hills match "{query}"</Text>
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
                style={[ms.hillListItem, i > 0 && ms.hillListDivider]}
              >
                <Text style={ms.hillItemEmoji}>{h.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={ms.hillItemName}>{h.name}</Text>
                  <Text style={ms.hillItemMeta}>{h.elevation}m · {h.grade} · {h.distance.toFixed(1)}km</Text>
                </View>
                <Text style={ms.hillItemElev}>↑{h.elevation}m</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {selectedHill && (
        <View style={ms.repSection}>
          <Text style={ms.fLabel}>Reps</Text>
          <View style={ms.repRow}>
            <TouchableOpacity
              onPress={() => { if (reps > 1) { onChangeReps(reps - 1); Haptics.selectionAsync(); } }}
              style={[ms.repBtn, { opacity: reps <= 1 ? 0.35 : 1 }]}
            >
              <Minus size={18} color={T.white} />
            </TouchableOpacity>

            <View style={ms.repDisplay}>
              <Text style={ms.repCount}>{reps}</Text>
              <Text style={ms.repUnit}>rep{reps !== 1 ? "s" : ""}</Text>
            </View>

            <TouchableOpacity
              onPress={() => { onChangeReps(reps + 1); Haptics.selectionAsync(); }}
              style={ms.repBtn}
            >
              <Plus size={18} color={T.white} />
            </TouchableOpacity>

            <View style={ms.repAutoFill}>
              <TrendingUp size={12} color={T.orange} />
              <Text style={ms.repAutoFillText}>
                {selectedHill.elevation * reps}m gain
              </Text>
              <Text style={ms.repAutoFillSep}>·</Text>
              <Map size={12} color={T.blue} />
              <Text style={[ms.repAutoFillText, { color: T.blue }]}>
                {(selectedHill.distance * reps).toFixed(1)}km
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Add Session modal ─────────────────────────────────────────────────────────

export function AddSessionModal({
  visible,
  onClose,
  seed,
}: {
  visible: boolean;
  onClose: () => void;
  seed?: TrainingSeed;
}) {
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

  const [selectedHill, setSelectedHill] = useState<NearbyHill | null>(null);
  const [reps, setReps] = useState(3);

  const [cardioSubtype, setCardioSubtype] = useState<"treadmill" | "stepper" | "outdoor">("outdoor");
  const [treadmillKm, setTreadmillKm] = useState("");
  const [treadmillIncline, setTreadmillIncline] = useState("10");
  const [stepperFloors, setStepperFloors] = useState("");

  useEffect(() => {
    if (visible && seed) {
      setType(seed.type);
      if (seed.cardioSubtype) setCardioSubtype(seed.cardioSubtype);
      if (seed.treadmillIncline) setTreadmillIncline(String(seed.treadmillIncline));
    }
  }, [visible, seed]);

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
    if (t !== "hill") { setSelectedHill(null); setReps(3); }
    if (t !== "cardio") { setCardioSubtype("outdoor"); setTreadmillKm(""); setTreadmillIncline("10"); setStepperFloors(""); }
  }

  function reset() {
    setType("cardio");
    setDate(new Date().toISOString().split("T")[0]);
    setDist(""); setElev(""); setDur(""); setNotes(""); setEffort(3);
    setSelectedHill(null); setReps(3);
    setCardioSubtype("outdoor"); setTreadmillKm(""); setTreadmillIncline("10"); setStepperFloors("");
  }

  async function save() {
    setSaving(true);
    const d = new Date(date);
    const weekNum = trainingPlan.find(w => {
      return new Date(w.startDate) <= d && new Date(w.endDate) >= d;
    })?.weekNumber ?? 1;

    let effectiveElev: number;
    let effectiveDist: number;
    let gymSubtype: "treadmill" | "stepper" | "outdoor" | undefined;
    let savedTreadmillKm: number | undefined;
    let savedTreadmillInclinePct: number | undefined;
    let savedStepperFloors: number | undefined;

    if (type === "cardio" && cardioSubtype === "treadmill") {
      const km = parseFloat(treadmillKm) || 0;
      const inc = parseFloat(treadmillIncline) || 10;
      effectiveElev = Math.round(km * 1000 * (inc / 100));
      effectiveDist = km;
      gymSubtype = "treadmill";
      savedTreadmillKm = km;
      savedTreadmillInclinePct = inc;
    } else if (type === "cardio" && cardioSubtype === "stepper") {
      const floors = parseInt(stepperFloors) || 0;
      effectiveElev = floors * 3;
      effectiveDist = 0;
      gymSubtype = "stepper";
      savedStepperFloors = floors;
    } else {
      effectiveElev = Number(elev);
      effectiveDist = Number(dist) || 0;
      if (type === "cardio") gymSubtype = "outdoor";
    }

    await addSession({
      date, type,
      distance: effectiveDist,
      elevationGain: effectiveElev,
      duration: Number(dur),
      effort: effort as 1 | 2 | 3 | 4 | 5,
      notes: notes.trim(),
      completed: true,
      weekNumber: weekNum,
      hillName: selectedHill?.name,
      reps: selectedHill ? reps : undefined,
      gymSubtype,
      treadmillKm: savedTreadmillKm,
      treadmillInclinePct: savedTreadmillInclinePct,
      stepperFloors: savedStepperFloors,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(false);
    onClose();
    reset();
  }

  const isValid = type === "hill"
    ? !!elev && !!dur
    : type === "cardio" && cardioSubtype === "treadmill"
      ? !!treadmillKm && !!dur
      : type === "cardio" && cardioSubtype === "stepper"
        ? !!stepperFloors && !!dur
        : !!dist && !!elev && !!dur;

  const inp = [ms.input];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={[
              ms.modalScroll,
              { paddingTop: Platform.OS === "web" ? 60 : insets.top + 16, paddingBottom: Math.max(48, insets.bottom + 24) },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={ms.modalHeader}>
              <Text style={ms.modalTitle}>Log Session</Text>
              <TouchableOpacity onPress={() => { onClose(); reset(); }} style={ms.closeBtn}>
                <X size={18} color={T.white} />
              </TouchableOpacity>
            </View>

            <Text style={ms.fLabel}>Session Type</Text>
            <View style={ms.typeRow}>
              {SESSION_TYPES.map(t => (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => handleTypeChange(t.value)}
                  style={[
                    ms.typeBtn,
                    { borderColor: type === t.value ? t.color : T.border },
                    type === t.value && { backgroundColor: t.color + "18" },
                  ]}
                >
                  {(() => { const TBtnIcon = t.icon; return <TBtnIcon size={15} color={type === t.value ? t.color : T.textMuted} />; })()}
                  <Text style={[ms.typeBtnText, { color: type === t.value ? t.color : T.textMuted }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={ms.fLabel}>Date</Text>
            <TextInput
              style={inp}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={T.textDim}
              keyboardType="numbers-and-punctuation"
            />

            {type === "hill" && (
              <HillSearchSection
                hills={nearbyHills}
                selectedHill={selectedHill}
                reps={reps}
                onSelectHill={handleSelectHill}
                onChangeReps={handleChangeReps}
              />
            )}

            {type === "cardio" && (
              <>
                <Text style={ms.fLabel}>Exercise type</Text>
                <View style={ms.typeRow}>
                  {(["treadmill", "stepper", "outdoor"] as const).map(sub => {
                    const labels = { treadmill: "Treadmill", stepper: "Stepper", outdoor: "Outdoor / Walk" };
                    const colors = { treadmill: T.green, stepper: T.blue, outdoor: T.orange };
                    const SubIcon = sub === "treadmill" ? TrendingUp : sub === "stepper" ? Activity : Map;
                    const active = cardioSubtype === sub;
                    return (
                      <TouchableOpacity
                        key={sub}
                        onPress={() => { setCardioSubtype(sub); setTreadmillKm(""); setStepperFloors(""); }}
                        style={[ms.typeBtn, { borderColor: active ? colors[sub] : T.border }, active && { backgroundColor: colors[sub] + "18" }]}
                      >
                        <SubIcon size={15} color={active ? colors[sub] : T.textMuted} />
                        <Text style={[ms.typeBtnText, { color: active ? colors[sub] : T.textMuted }]}>{labels[sub]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {cardioSubtype === "treadmill" && (
                  <>
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <View style={{ flex: 2 }}>
                        <Text style={ms.fLabel}>Distance (km)</Text>
                        <TextInput style={inp} value={treadmillKm} onChangeText={setTreadmillKm} placeholder="3.0" placeholderTextColor={T.textDim} keyboardType="decimal-pad" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={ms.fLabel}>Incline (%)</Text>
                        <TextInput style={inp} value={treadmillIncline} onChangeText={setTreadmillIncline} placeholder="10" placeholderTextColor={T.textDim} keyboardType="number-pad" />
                      </View>
                    </View>
                    {!!treadmillKm && (
                      <View style={ms.autoCalcRow}>
                        <TrendingUp size={13} color={T.orange} />
                        <Text style={ms.autoCalcText}>
                          ≈ {Math.round((parseFloat(treadmillKm) || 0) * 1000 * ((parseFloat(treadmillIncline) || 10) / 100))}m elevation gain
                        </Text>
                      </View>
                    )}
                  </>
                )}

                {cardioSubtype === "stepper" && (
                  <>
                    <Text style={ms.fLabel}>Floors completed</Text>
                    <TextInput style={inp} value={stepperFloors} onChangeText={setStepperFloors} placeholder="120" placeholderTextColor={T.textDim} keyboardType="number-pad" />
                    {!!stepperFloors && (
                      <View style={ms.autoCalcRow}>
                        <TrendingUp size={13} color={T.orange} />
                        <Text style={ms.autoCalcText}>
                          ≈ {(parseInt(stepperFloors) || 0) * 3}m elevation gain
                        </Text>
                      </View>
                    )}
                  </>
                )}

                {cardioSubtype === "outdoor" && (
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={ms.fLabel}>Distance (km)</Text>
                      <TextInput style={inp} value={dist} onChangeText={setDist} placeholder="8.5" placeholderTextColor={T.textDim} keyboardType="decimal-pad" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={ms.fLabel}>Elev. Gain (m)</Text>
                      <TextInput style={inp} value={elev} onChangeText={setElev} placeholder="450" placeholderTextColor={T.textDim} keyboardType="number-pad" />
                    </View>
                  </View>
                )}
              </>
            )}

            {type !== "cardio" && (
              <View style={{ flexDirection: "row", gap: 12 }}>
                {type !== "hill" && (
                  <View style={{ flex: 1 }}>
                    <Text style={ms.fLabel}>Distance (km)</Text>
                    <TextInput style={inp} value={dist} onChangeText={setDist} placeholder="8.5" placeholderTextColor={T.textDim} keyboardType="decimal-pad" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={ms.fLabel}>Elev. Gain (m)</Text>
                  <TextInput
                    style={[inp, selectedHill && ms.inputAutoFilled]}
                    value={elev}
                    onChangeText={setElev}
                    placeholder="450"
                    placeholderTextColor={T.textDim}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            )}

            <Text style={ms.fLabel}>Duration (min)</Text>
            <TextInput style={inp} value={dur} onChangeText={setDur} placeholder="90" placeholderTextColor={T.textDim} keyboardType="number-pad" />

            <Text style={ms.fLabel}>Effort Level</Text>
            <EffortPicker value={effort} onChange={setEffort} />

            <Text style={[ms.fLabel, { marginTop: 16 }]}>Notes</Text>
            <TextInput
              style={[inp, ms.notesInput]}
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
              style={[ms.saveBtn, { opacity: saving || !isValid ? 0.5 : 1 }]}
              activeOpacity={0.85}
            >
              <LinearGradient colors={["#3ECF75", "#2AB860"]} style={ms.saveBtnGrad}>
                <Check size={18} color="#fff" />
                <Text style={ms.saveBtnText}>{saving ? "Saving..." : "Log Session"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Modal>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const ms = StyleSheet.create({
  effortBtn: {
    flex: 1, height: 40, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  modalScroll: { paddingHorizontal: 22, gap: 0 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 28 },
  modalTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.white },
  closeBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  fLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted, letterSpacing: 0.4, marginBottom: 8, marginTop: 16 },
  input: {
    height: 50, backgroundColor: T.surface, borderRadius: 14, borderWidth: 1,
    borderColor: T.border, paddingHorizontal: 16, fontSize: 15,
    fontFamily: "Inter_400Regular", color: T.white,
  },
  inputAutoFilled: { borderColor: T.orange + "50", backgroundColor: T.orange + "08" },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flex: 1, flexDirection: "column", alignItems: "center", gap: 5,
    paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, backgroundColor: T.surface,
  },
  typeBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  notesInput: { height: 80, paddingTop: 14, textAlignVertical: "top" },
  saveBtn: { borderRadius: 16, overflow: "hidden", marginTop: 24 },
  saveBtnGrad: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  saveBtnText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
  autoCalcRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingHorizontal: 2 },
  autoCalcText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.orange },
  hillSearchWrap: {
    flexDirection: "row", alignItems: "center", backgroundColor: T.surface,
    borderRadius: 14, borderWidth: 1, borderColor: T.blue + "40", height: 50, gap: 8,
  },
  hillSearchInput: {
    flex: 1, height: 50, fontSize: 15, fontFamily: "Inter_400Regular",
    color: T.white, paddingRight: 14,
  },
  hillListBox: {
    backgroundColor: T.card, borderRadius: 14, borderWidth: 1,
    borderColor: T.border, marginTop: 6, overflow: "hidden",
  },
  hillListItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11, gap: 10 },
  hillListDivider: { borderTopWidth: 1, borderTopColor: T.border },
  hillItemEmoji: { fontSize: 20 },
  hillItemName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.white },
  hillItemMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  hillItemElev: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.orange },
  hillSelectedRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: T.blue + "12",
    borderRadius: 14, borderWidth: 1, borderColor: T.blue + "40",
    paddingHorizontal: 14, paddingVertical: 10, gap: 10,
  },
  hillEmoji: { fontSize: 24 },
  hillSelectedName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.white },
  hillSelectedMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  hillClearBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  hillNoMatch: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, padding: 14 },
  repSection: { marginTop: 0 },
  repRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  repBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: T.surface,
    borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center",
  },
  repDisplay: { flexDirection: "row", alignItems: "baseline", gap: 4, minWidth: 52, justifyContent: "center" },
  repCount: { fontSize: 28, fontFamily: "Inter_700Bold", color: T.white },
  repUnit: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },
  repAutoFill: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: T.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: T.border,
  },
  repAutoFillText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.orange },
  repAutoFillSep: { fontSize: 12, color: T.textDim },
});
