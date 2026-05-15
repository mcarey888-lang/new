import {
  Check,
  ChevronRight,
  Clock,
  Crosshair,
  Map,
  MapPin,
  Minus,
  Plus,
  Search,
  TrendingUp,
  Trash2,
  X,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useApp, type ExploreHike } from "@/context/AppContext";
import { T } from "@/constants/theme";

// ── Storage key ───────────────────────────────────────────────────────────────
const LOCATION_KEY = "summitready_hikes_location";

// ── Mock hike data ────────────────────────────────────────────────────────────
// TODO: Replace with live trail API (e.g. OpenStreetMap Overpass, Komoot, AllTrails)
// Endpoint pattern: GET /api/hikes-near-me?lat=...&lng=...&radius=25

type TrainingValue = "easy" | "moderate" | "strong";
type Difficulty = "Easy" | "Moderate" | "Hard";

interface MockHike {
  name: string;
  distance: number;
  duration: number;
  elevationGain: number;
  difficulty: Difficulty;
  trainingValue: TrainingValue;
  region: string;
}

const TV_LABEL: Record<TrainingValue, string> = {
  easy: "Easy prep",
  moderate: "Moderate prep",
  strong: "Strong summit prep",
};
const TV_COLOR: Record<TrainingValue, string> = {
  easy: T.green,
  moderate: T.blue,
  strong: T.orange,
};

const ALL_HIKES: MockHike[] = [
  // Peak District
  { name: "Mam Tor Circuit",         distance: 6.5,  duration: 150, elevationGain: 320, difficulty: "Easy",     trainingValue: "easy",     region: "Peak District" },
  { name: "Stanage Edge Ridge",       distance: 8.2,  duration: 180, elevationGain: 280, difficulty: "Easy",     trainingValue: "easy",     region: "Peak District" },
  { name: "Kinder Scout Plateau",     distance: 12.5, duration: 300, elevationGain: 600, difficulty: "Moderate", trainingValue: "moderate", region: "Peak District" },
  { name: "Lose Hill & Win Hill",     distance: 9.0,  duration: 210, elevationGain: 490, difficulty: "Moderate", trainingValue: "moderate", region: "Peak District" },
  // Yorkshire Dales
  { name: "Whernside from Ribblehead",distance: 12.0, duration: 270, elevationGain: 430, difficulty: "Moderate", trainingValue: "moderate", region: "Yorkshire Dales" },
  { name: "Pen-y-ghent Summit Loop",  distance: 10.5, duration: 240, elevationGain: 490, difficulty: "Moderate", trainingValue: "moderate", region: "Yorkshire Dales" },
  { name: "Ingleborough via Horton",  distance: 14.0, duration: 330, elevationGain: 560, difficulty: "Moderate", trainingValue: "moderate", region: "Yorkshire Dales" },
  { name: "The Three Peaks Challenge", distance: 39.0, duration: 720, elevationGain: 1585, difficulty: "Hard",   trainingValue: "strong",   region: "Yorkshire Dales" },
  // Lake District
  { name: "Skiddaw via Carlside",     distance: 11.0, duration: 270, elevationGain: 840, difficulty: "Moderate", trainingValue: "moderate", region: "Lake District" },
  { name: "Blencathra Sharp Edge",    distance: 9.5,  duration: 280, elevationGain: 670, difficulty: "Hard",     trainingValue: "strong",   region: "Lake District" },
  { name: "Helvellyn via Striding Edge",distance:13.5,duration: 330, elevationGain: 850, difficulty: "Hard",     trainingValue: "strong",   region: "Lake District" },
  { name: "Catbells & Maiden Moor",   distance: 7.5,  duration: 180, elevationGain: 490, difficulty: "Easy",     trainingValue: "easy",     region: "Lake District" },
  // Brecon Beacons
  { name: "Pen y Fan via Corn Du",    distance: 10.0, duration: 240, elevationGain: 590, difficulty: "Moderate", trainingValue: "moderate", region: "Brecon Beacons" },
  { name: "Fan y Big Ridge",          distance: 11.5, duration: 270, elevationGain: 520, difficulty: "Moderate", trainingValue: "moderate", region: "Brecon Beacons" },
  { name: "Brecon Beacons Horseshoe", distance: 14.0, duration: 360, elevationGain: 750, difficulty: "Hard",     trainingValue: "strong",   region: "Brecon Beacons" },
  // Snowdonia
  { name: "Snowdon Horseshoe",        distance: 11.5, duration: 360, elevationGain: 980, difficulty: "Hard",     trainingValue: "strong",   region: "Snowdonia" },
  { name: "Snowdon Ranger Path",      distance: 9.0,  duration: 240, elevationGain: 760, difficulty: "Moderate", trainingValue: "moderate", region: "Snowdonia" },
  { name: "Tryfan North Ridge",       distance: 7.5,  duration: 270, elevationGain: 620, difficulty: "Hard",     trainingValue: "strong",   region: "Snowdonia" },
  // Cairngorms
  { name: "Ben Macdui via Derry",     distance: 19.0, duration: 420, elevationGain: 900, difficulty: "Hard",     trainingValue: "strong",   region: "Cairngorms" },
  { name: "Cairn Gorm Summit",        distance: 10.0, duration: 240, elevationGain: 610, difficulty: "Moderate", trainingValue: "moderate", region: "Cairngorms" },
  { name: "Lairig Ghru (Partial)",    distance: 16.0, duration: 360, elevationGain: 530, difficulty: "Hard",     trainingValue: "strong",   region: "Cairngorms" },
  // Scottish Highlands (general)
  { name: "Ben Nevis Tourist Track",  distance: 16.0, duration: 420, elevationGain: 1350, difficulty: "Hard",    trainingValue: "strong",   region: "Scottish Highlands" },
  { name: "The Cobbler (Ben Arthur)", distance: 10.5, duration: 270, elevationGain: 760, difficulty: "Hard",     trainingValue: "strong",   region: "Scottish Highlands" },
  // South Downs / South England
  { name: "Devil's Dyke to Truleigh", distance: 9.5,  duration: 210, elevationGain: 310, difficulty: "Easy",     trainingValue: "easy",     region: "South Downs" },
  { name: "Butser Hill from QE Park", distance: 7.5,  duration: 150, elevationGain: 250, difficulty: "Easy",     trainingValue: "easy",     region: "South Downs" },
  // Dartmoor
  { name: "Yes Tor & High Willhays",  distance: 11.5, duration: 270, elevationGain: 480, difficulty: "Moderate", trainingValue: "moderate", region: "Dartmoor" },
  { name: "Hay Tor & Hound Tor Loop", distance: 9.0,  duration: 210, elevationGain: 320, difficulty: "Easy",     trainingValue: "easy",     region: "Dartmoor" },
];

// ── Location → region mapping ─────────────────────────────────────────────────
// Maps search terms (city names, areas) to one or more matching regions,
// ordered by proximity.

interface RegionMatch { regions: string[]; label: string }

const LOCATION_MAP: { keywords: string[]; regions: string[]; label: string }[] = [
  { keywords: ["manchester", "sheffield", "derby", "nottingham", "stoke", "buxton", "chesterfield", "bakewell"], regions: ["Peak District", "Yorkshire Dales"], label: "Peak District & Yorkshire" },
  { keywords: ["leeds", "bradford", "harrogate", "york", "skipton", "settle", "ingleton", "ripon", "ilkley"], regions: ["Yorkshire Dales", "Peak District"], label: "Yorkshire Dales & Peak District" },
  { keywords: ["keswick", "windermere", "penrith", "carlisle", "ambleside", "grasmere", "kendal", "barrow", "whitehaven"], regions: ["Lake District", "Yorkshire Dales"], label: "Lake District" },
  { keywords: ["cardiff", "bristol", "swansea", "newport", "merthyr", "abergavenny", "brecon"], regions: ["Brecon Beacons", "Snowdonia"], label: "Brecon Beacons & Snowdonia" },
  { keywords: ["bangor", "wrexham", "chester", "llandudno", "caernarfon", "betws", "beddgelert", "conwy", "snowdon", "snowdonia", "llanberis"], regions: ["Snowdonia", "Brecon Beacons"], label: "Snowdonia" },
  { keywords: ["edinburgh", "glasgow", "perth", "stirling", "dundee", "aviemore", "inverness", "aberdeen", "cairngorms", "braemar"], regions: ["Cairngorms", "Scottish Highlands"], label: "Scotland" },
  { keywords: ["fort william", "ben nevis", "oban", "loch lomond", "loch ness", "highland", "highlands"], regions: ["Scottish Highlands", "Cairngorms"], label: "Scottish Highlands" },
  { keywords: ["london", "brighton", "guildford", "worthing", "southampton", "portsmouth", "lewes", "eastbourne", "crawley"], regions: ["South Downs", "Dartmoor"], label: "South England" },
  { keywords: ["exeter", "plymouth", "torquay", "newton abbot", "tavistock", "okehampton", "dartmoor"], regions: ["Dartmoor", "South Downs"], label: "Dartmoor & South West" },
];

function resolveLocation(query: string): RegionMatch | null {
  if (!query.trim()) return null;
  const q = query.toLowerCase().trim();
  for (const entry of LOCATION_MAP) {
    if (entry.keywords.some(k => q.includes(k) || k.includes(q.split(" ")[0]))) {
      return { regions: entry.regions, label: entry.label };
    }
  }
  return null;
}

function filterAndSortHikes(query: string): MockHike[] {
  const match = resolveLocation(query);
  if (!match) return ALL_HIKES;
  const primary = match.regions[0];
  const secondary = match.regions[1] ?? null;
  return [
    ...ALL_HIKES.filter(h => h.region === primary),
    ...ALL_HIKES.filter(h => h.region === secondary && secondary !== primary),
    ...ALL_HIKES.filter(h => h.region !== primary && h.region !== secondary),
  ];
}

// ── Location Search Bar ───────────────────────────────────────────────────────

interface LocationBarProps {
  value: string;
  onChange: (v: string) => void;
  onGps: () => void;
  gpsLoading: boolean;
}

function LocationBar({ value, onChange, onGps, gpsLoading }: LocationBarProps) {
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={lb.wrap}>
      <View style={lb.bar}>
        <Search size={15} color={T.textDim} style={{ flexShrink: 0 }} />
        <TextInput
          ref={inputRef}
          style={lb.input}
          value={value}
          onChangeText={onChange}
          placeholder="Enter your location…"
          placeholderTextColor={T.textDim}
          returnKeyType="search"
          clearButtonMode="never"
          autoCorrect={false}
          autoCapitalize="words"
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={() => onChange("")} hitSlop={8} style={lb.clearBtn}>
            <X size={13} color={T.textMuted} />
          </TouchableOpacity>
        )}
        <View style={lb.divider} />
        <TouchableOpacity onPress={onGps} hitSlop={8} style={lb.gpsBtn} disabled={gpsLoading}>
          {gpsLoading
            ? <ActivityIndicator size={15} color={T.green} />
            : <Crosshair size={15} color={T.green} />
          }
        </TouchableOpacity>
      </View>
      {value.trim() ? (
        <LocationStatus query={value} />
      ) : (
        <Text style={lb.hint}>
          Type a city or town — or tap{" "}
          <Text style={{ color: T.green }}>⊕</Text>
          {" "}to use GPS
        </Text>
      )}
    </View>
  );
}

function LocationStatus({ query }: { query: string }) {
  const match = resolveLocation(query);
  if (!match) {
    return (
      <Text style={lb.statusDim}>
        No trail data for this area yet — showing all UK hikes
      </Text>
    );
  }
  return (
    <View style={lb.statusRow}>
      <MapPin size={11} color={T.green} />
      <Text style={lb.statusGreen}>Showing hikes near {match.label}</Text>
    </View>
  );
}

const lb = StyleSheet.create({
  wrap: { gap: 6 },
  bar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 12, paddingVertical: Platform.OS === "ios" ? 12 : 10,
  },
  input: {
    flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: T.text,
    paddingVertical: 0,
  },
  clearBtn: { padding: 2, backgroundColor: T.card, borderRadius: 8 },
  divider: { width: 1, height: 18, backgroundColor: T.border },
  gpsBtn: { padding: 4, width: 28, alignItems: "center" },
  hint: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, paddingLeft: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 2 },
  statusGreen: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.green },
  statusDim: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, paddingLeft: 2 },
});

// ── Hike card ─────────────────────────────────────────────────────────────────

const DIFF_COLOR: Record<Difficulty, string> = { Easy: T.green, Moderate: T.blue, Hard: T.orange };

function HikeCard({ hike, onLog, highlighted }: { hike: MockHike; onLog: (name: string) => void; highlighted?: boolean }) {
  return (
    <View style={[hc.card, highlighted && hc.cardHighlighted]}>
      <View style={hc.top}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={hc.name}>{hike.name}</Text>
          <Text style={hc.region}>📍 {hike.region}</Text>
        </View>
        <View style={[hc.diffBadge, { backgroundColor: DIFF_COLOR[hike.difficulty] + "1A" }]}>
          <Text style={[hc.diffText, { color: DIFF_COLOR[hike.difficulty] }]}>{hike.difficulty}</Text>
        </View>
      </View>

      <View style={hc.stats}>
        <View style={hc.stat}>
          <MapPin size={12} color={T.textDim} />
          <Text style={hc.statText}>{hike.distance}km</Text>
        </View>
        <View style={hc.stat}>
          <TrendingUp size={12} color={T.textDim} />
          <Text style={hc.statText}>{hike.elevationGain}m gain</Text>
        </View>
        <View style={hc.stat}>
          <Clock size={12} color={T.textDim} />
          <Text style={hc.statText}>{Math.floor(hike.duration / 60)}h {hike.duration % 60 > 0 ? `${hike.duration % 60}m` : ""}</Text>
        </View>
      </View>

      <View style={hc.bottom}>
        <View style={[hc.tvBadge, { backgroundColor: TV_COLOR[hike.trainingValue] + "15" }]}>
          <Text style={[hc.tvText, { color: TV_COLOR[hike.trainingValue] }]}>
            {TV_LABEL[hike.trainingValue]}
          </Text>
        </View>
        <TouchableOpacity style={hc.logBtn} onPress={() => onLog(hike.name)} activeOpacity={0.8}>
          <Text style={hc.logBtnText}>Log this hike</Text>
          <ChevronRight size={12} color={T.green} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const hc = StyleSheet.create({
  card: {
    backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border,
    padding: 16, gap: 12,
  },
  cardHighlighted: { borderColor: "rgba(62,207,117,0.25)" },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  name: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.text },
  region: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  diffBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, flexShrink: 0 },
  diffText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  stats: { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tvBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  tvText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  logBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  logBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.green },
});

// ── Logged hike row ───────────────────────────────────────────────────────────

function LoggedHikeRow({ hike, onDelete }: { hike: ExploreHike; onDelete: (id: string) => void }) {
  const dateStr = new Date(hike.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <View style={lh.row}>
      <View style={lh.iconWrap}>
        <Map size={14} color={T.green} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={lh.name}>{hike.name}</Text>
        <View style={lh.stats}>
          <Text style={lh.stat}>{dateStr}</Text>
          <Text style={lh.dot}>·</Text>
          <Text style={lh.stat}>{hike.distance}km</Text>
          <Text style={lh.dot}>·</Text>
          <Text style={lh.stat}>{hike.elevationGain}m</Text>
          <Text style={lh.dot}>·</Text>
          <Text style={lh.stat}>{hike.timeTaken}min</Text>
        </View>
        {!!hike.notes && <Text style={lh.notes}>{hike.notes}</Text>}
      </View>
      <TouchableOpacity
        onPress={() => {
          if (Platform.OS === "web") { onDelete(hike.id); return; }
          Alert.alert("Delete hike?", "This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => onDelete(hike.id) },
          ]);
        }}
        style={lh.delBtn}
        hitSlop={8}
      >
        <Trash2 size={14} color={T.red} />
      </TouchableOpacity>
    </View>
  );
}

const lh = StyleSheet.create({
  row: {
    backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.border,
    padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 12,
  },
  iconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: T.greenDim, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  name: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },
  stats: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
  stat: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  dot: { fontSize: 12, color: T.textDim },
  notes: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, fontStyle: "italic" },
  delBtn: { padding: 4, flexShrink: 0 },
});

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({ value, onChange, min = 0, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; step?: number }) {
  return (
    <View style={st.row}>
      <TouchableOpacity onPress={() => onChange(Math.max(min, value - step))} style={st.btn}>
        <Minus size={14} color={T.text} />
      </TouchableOpacity>
      <Text style={st.val}>{value}</Text>
      <TouchableOpacity onPress={() => onChange(value + step)} style={st.btn}>
        <Plus size={14} color={T.text} />
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  btn: { width: 36, height: 36, backgroundColor: T.surface, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  val: { width: 50, textAlign: "center", fontSize: 16, fontFamily: "Inter_700Bold", color: T.text },
});

// ── Log Hike Modal ────────────────────────────────────────────────────────────

function LogHikeModal({ visible, prefillName, onClose }: { visible: boolean; prefillName?: string; onClose: () => void }) {
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
    setName("");
    setNotes("");
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={m.container}>
          <View style={m.handle} />
          <View style={m.header}>
            <Text style={m.title}>Log a Hike</Text>
            <TouchableOpacity onPress={onClose} style={m.closeBtn}>
              <X size={18} color={T.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={m.scroll} showsVerticalScrollIndicator={false}>
            <View style={m.field}>
              <Text style={m.label}>Hike name *</Text>
              <TextInput
                style={m.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Mam Tor Circuit"
                placeholderTextColor={T.textDim}
              />
            </View>

            <View style={m.field}>
              <Text style={m.label}>Date</Text>
              <TextInput
                style={m.input}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={T.textDim}
              />
            </View>

            <View style={m.row}>
              <View style={[m.field, { flex: 1 }]}>
                <Text style={m.label}>Distance (km)</Text>
                <Stepper value={distance} onChange={setDistance} min={1} />
              </View>
              <View style={[m.field, { flex: 1 }]}>
                <Text style={m.label}>Time (min)</Text>
                <Stepper value={timeTaken} onChange={setTimeTaken} min={10} step={5} />
              </View>
            </View>

            <View style={m.field}>
              <Text style={m.label}>Elevation gain (m)</Text>
              <Stepper value={elevationGain} onChange={setElevationGain} min={0} step={50} />
            </View>

            <View style={m.field}>
              <Text style={m.label}>Notes (optional)</Text>
              <TextInput
                style={[m.input, m.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="How did it feel?"
                placeholderTextColor={T.textDim}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          <View style={m.footer}>
            <TouchableOpacity
              style={[m.saveBtn, (!name.trim() || saving) && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={!name.trim() || saving}
              activeOpacity={0.85}
            >
              <LinearGradient colors={["#3ECF75", "#2AB860"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={m.saveBtnGrad}>
                <Check size={18} color="#fff" />
                <Text style={m.saveBtnText}>{saving ? "Saving…" : "Save hike"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const m = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  handle: { width: 36, height: 4, backgroundColor: T.surface, borderRadius: 2, alignSelf: "center", marginTop: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: T.text },
  closeBtn: { padding: 6, backgroundColor: T.surface, borderRadius: 10 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32, gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: "Inter_400Regular", color: T.text,
  },
  textArea: { height: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 14 },
  footer: { paddingHorizontal: 20, paddingBottom: Platform.OS === "ios" ? 36 : 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.border },
  saveBtn: { borderRadius: 16, overflow: "hidden" },
  saveBtnGrad: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HikesScreen() {
  const insets = useSafeAreaInsets();
  const { exploreHikes, deleteExploreHike } = useApp();

  const [location, setLocationText] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [prefillName, setPrefillName] = useState<string | undefined>(undefined);

  // Load persisted location on mount
  useEffect(() => {
    AsyncStorage.getItem(LOCATION_KEY).then(v => {
      if (v) setLocationText(v);
    });
  }, []);

  // Persist location whenever it changes
  const handleLocationChange = useCallback((v: string) => {
    setLocationText(v);
    AsyncStorage.setItem(LOCATION_KEY, v);
  }, []);

  // GPS detection
  const handleGps = useCallback(async () => {
    if (Platform.OS === "web") {
      // Web geolocation
      if (!navigator.geolocation) {
        Alert.alert("Not supported", "GPS is not available in this browser.");
        return;
      }
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        async pos => {
          try {
            const res = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            const place = res[0];
            const name = place?.city || place?.subregion || place?.region || place?.country || "";
            handleLocationChange(name);
          } catch {
            Alert.alert("Location error", "Could not determine your location name.");
          }
          setGpsLoading(false);
        },
        () => {
          Alert.alert("Location denied", "Allow location access to find hikes near you.");
          setGpsLoading(false);
        },
      );
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location denied", "Allow location access to find hikes near you.");
      return;
    }
    setGpsLoading(true);
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const res = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const place = res[0];
      const name = place?.city || place?.subregion || place?.region || place?.country || "";
      if (name) handleLocationChange(name);
      else Alert.alert("Location unknown", "Could not determine your area from GPS.");
    } catch {
      Alert.alert("GPS error", "Could not get your location. Try again or type it manually.");
    }
    setGpsLoading(false);
  }, [handleLocationChange]);

  function openLog(name?: string) {
    setPrefillName(name);
    setModalVisible(true);
  }

  const visibleHikes = useMemo(() => filterAndSortHikes(location), [location]);
  const match = useMemo(() => resolveLocation(location), [location]);
  const primaryRegion = match?.regions[0] ?? null;

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          p.scroll,
          { paddingTop: Platform.OS === "web" ? 60 : insets.top + 20, paddingBottom: 120 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(60).duration(600)} style={p.header}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={p.eyebrow}>HIKES NEAR ME</Text>
            <Text style={p.title}>Trail Finder</Text>
          </View>
          <TouchableOpacity style={p.logFab} onPress={() => openLog()} activeOpacity={0.85}>
            <Plus size={16} color="#fff" />
            <Text style={p.logFabText}>Log hike</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Location search bar */}
        <Animated.View entering={FadeInDown.delay(120).duration(600)}>
          <LocationBar
            value={location}
            onChange={handleLocationChange}
            onGps={handleGps}
            gpsLoading={gpsLoading}
          />
        </Animated.View>

        {/* Hike list */}
        <Animated.View entering={FadeInDown.delay(180).duration(600)} style={{ gap: 12 }}>
          {visibleHikes.map((hike, i) => (
            <HikeCard
              key={`${hike.name}-${i}`}
              hike={hike}
              highlighted={!!primaryRegion && hike.region === primaryRegion}
              onLog={name => openLog(name)}
            />
          ))}
        </Animated.View>

        {/* Logged hike history */}
        {exploreHikes.length > 0 && (
          <Animated.View entering={FadeInDown.delay(260).duration(600)}>
            <View style={p.histHead}>
              <Text style={p.histTitle}>YOUR HIKE HISTORY</Text>
              <Text style={p.histCount}>{exploreHikes.length} logged</Text>
            </View>
            <View style={{ gap: 10 }}>
              {[...exploreHikes].reverse().map(h => (
                <LoggedHikeRow key={h.id} hike={h} onDelete={deleteExploreHike} />
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <LogHikeModal
        visible={modalVisible}
        prefillName={prefillName}
        onClose={() => setModalVisible(false)}
      />
    </LinearGradient>
  );
}

const p = StyleSheet.create({
  scroll: { paddingHorizontal: 18, gap: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  eyebrow: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.green, letterSpacing: 1.2, textTransform: "uppercase" },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", color: T.text },
  logFab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: T.green, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9,
    shadowColor: T.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  logFabText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  histHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  histTitle: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 1, textTransform: "uppercase" },
  histCount: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.green },
});
