import {
  AlertCircle,
  BarChart2,
  Check,
  ChevronRight,
  Clock,
  Map,
  MapPin,
  Minus,
  Plus,
  PlusCircle,
  CheckCircle,
  Radio,
  RefreshCw,
  Repeat,
  Search,
  TrendingUp,
  Trash2,
  X,
  Zap,
  Route,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { useApp, type ExploreHike, type NearbyHill } from "@/context/AppContext";
import { T } from "@/constants/theme";

// ── Storage keys ──────────────────────────────────────────────────────────────
const LOCATION_KEY = "summitready_hikes_location";
const RADIUS_KEY   = "summitready_hikes_radius";
const HILLS_KEY    = "summitready_hikes_results";

// ── API base ──────────────────────────────────────────────────────────────────
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

// ── Constants ─────────────────────────────────────────────────────────────────
const RADIUS_STEPS = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

const GRADE_COLOR: Record<string, string> = {
  "Easy": T.green,
  "Easy–Mod": T.green,
  "Moderate": T.blue,
  "Hard": T.orange,
  "Alpine": "#FF4444",
};

// ── Hill card ─────────────────────────────────────────────────────────────────

function HillCard({ hill, onLog }: { hill: NearbyHill; onLog: (name: string) => void }) {
  const gc = GRADE_COLOR[hill.grade] ?? T.blue;
  const isRoute = hill.routeType === "circular" || hill.routeType === "out-and-back";
  const routeLabel = hill.routeType === "circular" ? "Circular" : hill.routeType === "out-and-back" ? "Out & back" : null;

  return (
    <View style={hc.card}>
      <LinearGradient colors={[gc + "08", "transparent"]} style={StyleSheet.absoluteFill} />

      <View style={hc.top}>
        <View style={[hc.iconBox, { backgroundColor: gc + "18" }]}>
          <Text style={hc.emoji}>{hill.emoji}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={hc.name}>{hill.name}</Text>
          <Text style={hc.surface}>{hill.surface}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <View style={[hc.gradeBadge, { backgroundColor: gc + "20" }]}>
            <Text style={[hc.gradeText, { color: gc }]}>{hill.grade}</Text>
          </View>
          {routeLabel && (
            <View style={hc.routeBadge}>
              <Route size={9} color={T.blue} />
              <Text style={hc.routeBadgeText}>{routeLabel}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={hc.stats}>
        <View style={hc.stat}>
          <MapPin size={12} color={T.green} />
          <Text style={hc.statVal}>{hill.distance}km</Text>
          <Text style={hc.statLbl}>away</Text>
        </View>
        <View style={hc.stat}>
          <TrendingUp size={12} color={T.orange} />
          <Text style={hc.statVal}>{hill.elevation}m</Text>
          <Text style={hc.statLbl}>gain</Text>
        </View>
        {isRoute ? (
          <>
            {hill.routeDistance != null && (
              <View style={hc.stat}>
                <Route size={12} color={T.blue} />
                <Text style={hc.statVal}>{hill.routeDistance}km</Text>
                <Text style={hc.statLbl}>route</Text>
              </View>
            )}
            {hill.estimatedTime && (
              <View style={hc.stat}>
                <Clock size={12} color={T.purple} />
                <Text style={hc.statVal}>{hill.estimatedTime}</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <View style={hc.stat}>
              <Repeat size={12} color={T.textMuted} />
              <Text style={hc.statVal}>1×</Text>
              <Text style={hc.statLbl}>reps</Text>
            </View>
            <View style={hc.stat}>
              <BarChart2 size={12} color={T.purple} />
              <Text style={hc.statVal}>{hill.elevation}m</Text>
              <Text style={hc.statLbl}>total</Text>
            </View>
          </>
        )}
      </View>

      <TouchableOpacity style={hc.logBtn} onPress={() => onLog(hill.name)} activeOpacity={0.8}>
        <Text style={hc.logBtnText}>Log a session here</Text>
        <ChevronRight size={13} color={T.green} />
      </TouchableOpacity>
    </View>
  );
}

const hc = StyleSheet.create({
  card: {
    backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border,
    padding: 16, gap: 12, overflow: "hidden",
  },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  emoji: { fontSize: 18 },
  name: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.text },
  surface: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  gradeBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, flexShrink: 0 },
  gradeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  routeBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
    backgroundColor: T.blueDim, borderWidth: 1, borderColor: T.blue + "40",
  },
  routeBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.blue },
  stats: { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  stat: { flexDirection: "row", alignItems: "center", gap: 3 },
  statVal: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text },
  statLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  logBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 3,
    borderTopWidth: 1, borderTopColor: T.border, paddingTop: 10, marginTop: 2,
  },
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
        <View style={lh.meta}>
          <Text style={lh.dim}>{dateStr}</Text>
          <Text style={lh.dot}>·</Text>
          <Text style={lh.dim}>{hike.distance}km</Text>
          <Text style={lh.dot}>·</Text>
          <Text style={lh.dim}>{hike.elevationGain}m gain</Text>
          <Text style={lh.dot}>·</Text>
          <Text style={lh.dim}>{hike.timeTaken}min</Text>
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
  meta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
  dim: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  dot: { fontSize: 12, color: T.textDim },
  notes: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, fontStyle: "italic" },
  delBtn: { padding: 4, flexShrink: 0 },
});

// ── Stepper helpers ───────────────────────────────────────────────────────────

function stepRadius(current: number, dir: 1 | -1): number {
  const idx = RADIUS_STEPS.indexOf(current);
  if (idx === -1) {
    return RADIUS_STEPS.reduce((p, c) =>
      Math.abs(c - current) < Math.abs(p - current) ? c : p
    );
  }
  const next = idx + dir;
  if (next < 0) return RADIUS_STEPS[0];
  if (next >= RADIUS_STEPS.length) return RADIUS_STEPS[RADIUS_STEPS.length - 1];
  return RADIUS_STEPS[next];
}

// ── Numeric stepper ───────────────────────────────────────────────────────────

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
    setNotes("");
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={md.container}>
          <View style={md.handle} />
          <View style={md.header}>
            <Text style={md.title}>Log a Session</Text>
            <TouchableOpacity onPress={onClose} style={md.closeBtn}>
              <X size={18} color={T.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={md.scroll} showsVerticalScrollIndicator={false}>
            <View style={md.field}>
              <Text style={md.label}>Hill / trail name *</Text>
              <TextInput style={md.input} value={name} onChangeText={setName} placeholder="e.g. Mam Tor" placeholderTextColor={T.textDim} />
            </View>
            <View style={md.field}>
              <Text style={md.label}>Date</Text>
              <TextInput style={md.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={T.textDim} />
            </View>
            <View style={md.row}>
              <View style={[md.field, { flex: 1 }]}>
                <Text style={md.label}>Distance (km)</Text>
                <Stepper value={distance} onChange={setDistance} min={1} />
              </View>
              <View style={[md.field, { flex: 1 }]}>
                <Text style={md.label}>Time (min)</Text>
                <Stepper value={timeTaken} onChange={setTimeTaken} min={10} step={5} />
              </View>
            </View>
            <View style={md.field}>
              <Text style={md.label}>Elevation gain (m)</Text>
              <Stepper value={elevationGain} onChange={setElevationGain} min={0} step={50} />
            </View>
            <View style={md.field}>
              <Text style={md.label}>Notes (optional)</Text>
              <TextInput style={[md.input, md.textArea]} value={notes} onChangeText={setNotes} placeholder="How did it feel?" placeholderTextColor={T.textDim} multiline numberOfLines={3} />
            </View>
          </ScrollView>

          <View style={md.footer}>
            <TouchableOpacity
              style={[md.saveBtn, (!name.trim() || saving) && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={!name.trim() || saving}
              activeOpacity={0.85}
            >
              <LinearGradient colors={["#3ECF75", "#2AB860"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={md.saveBtnGrad}>
                <Check size={18} color="#fff" />
                <Text style={md.saveBtnText}>{saving ? "Saving…" : "Save session"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const md = StyleSheet.create({
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
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HikesScreen() {
  const insets = useSafeAreaInsets();
  const { exploreHikes, deleteExploreHike } = useApp();

  // Location + radius
  const [location, setLocation] = useState("");
  const [radius, setRadius]     = useState(25);
  const locInputRef = useRef<TextInput>(null);

  // AI hill results
  const [hills, setHills]           = useState<NearbyHill[]>([]);
  const [hillsLoading, setHillsLoading] = useState(false);
  const [hillsError, setHillsError] = useState<string | null>(null);

  // Specific hill search
  const [searchText, setSearchText]         = useState("");
  const [searchLoading, setSearchLoading]   = useState(false);
  const [searchResult, setSearchResult]     = useState<NearbyHill | null>(null);
  const [searchError, setSearchError]       = useState<string | null>(null);
  const [searchAdded, setSearchAdded]       = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // Log hike modal
  const [modalVisible, setModalVisible] = useState(false);
  const [prefillName, setPrefillName]   = useState<string | undefined>(undefined);

  // Load persisted state
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(LOCATION_KEY),
      AsyncStorage.getItem(RADIUS_KEY),
      AsyncStorage.getItem(HILLS_KEY),
    ]).then(([loc, rad, saved]) => {
      if (loc) setLocation(loc);
      if (rad) setRadius(Number(rad));
      if (saved) {
        try { setHills(JSON.parse(saved) as NearbyHill[]); } catch { /* ignore */ }
      }
    });
  }, []);

  // Fetch hills from AI
  const fetchHills = useCallback(async (loc?: string, rad?: number) => {
    const useLoc = (loc ?? location).trim();
    const useRad = rad ?? radius;
    if (!useLoc) {
      locInputRef.current?.focus();
      return;
    }
    setHillsLoading(true);
    setHillsError(null);
    try {
      const res = await fetch(`${API_BASE}/hills-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: useLoc, radius: useRad }),
      });
      if (!res.ok) throw new Error("Lookup failed");
      const data = await res.json() as { hills: NearbyHill[] };
      setHills(data.hills);
      await AsyncStorage.setItem(HILLS_KEY, JSON.stringify(data.hills));
    } catch {
      setHillsError("Couldn't load hills — check your connection and try again.");
    } finally {
      setHillsLoading(false);
    }
  }, [location, radius]);

  // Search for a specific hill
  async function handleHillSearch() {
    const query = searchText.trim();
    if (query.length < 2) return;
    setSearchLoading(true);
    setSearchResult(null);
    setSearchError(null);
    setSearchAdded(false);
    try {
      const res = await fetch(`${API_BASE}/hills-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hillName: query, location: location.trim() }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json() as { hill: NearbyHill };
      setSearchResult(data.hill);
    } catch {
      setSearchError("Couldn't find that hill — try a different name or spelling.");
    } finally {
      setSearchLoading(false);
    }
  }

  function handleAddSearchResult() {
    if (!searchResult) return;
    setHills(prev => {
      const next = prev.some(h => h.name === searchResult.name) ? prev : [searchResult, ...prev];
      AsyncStorage.setItem(HILLS_KEY, JSON.stringify(next));
      return next;
    });
    setSearchAdded(true);
  }

  function handleLocationChange(v: string) {
    setLocation(v);
    AsyncStorage.setItem(LOCATION_KEY, v);
  }

  function handleRadiusChange(dir: 1 | -1) {
    const next = stepRadius(radius, dir);
    setRadius(next);
    AsyncStorage.setItem(RADIUS_KEY, String(next));
  }

  function openLog(name?: string) {
    setPrefillName(name);
    setModalVisible(true);
  }

  const hasFetched = hills.length > 0;

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
        <Animated.View entering={FadeInDown.delay(40).duration(600)} style={p.header}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={p.eyebrow}>HIKES NEAR ME</Text>
            <Text style={p.title}>Trail Finder</Text>
          </View>
          <TouchableOpacity style={p.logFab} onPress={() => openLog()} activeOpacity={0.85}>
            <Plus size={16} color="#fff" />
            <Text style={p.logFabText}>Log session</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Location + radius controls */}
        <Animated.View entering={FadeInDown.delay(80).duration(600)}>
          <View style={p.controlCard}>
            {/* Location row */}
            <View style={p.controlRow}>
              <View style={p.controlLabelRow}>
                <MapPin size={13} color={T.green} />
                <Text style={p.controlLabel}>Your location</Text>
              </View>
              <View style={p.locInputWrap}>
                <TextInput
                  ref={locInputRef}
                  style={p.locInput}
                  value={location}
                  onChangeText={handleLocationChange}
                  placeholder="e.g. Manchester, Sheffield…"
                  placeholderTextColor={T.textDim}
                  returnKeyType="search"
                  onSubmitEditing={() => fetchHills()}
                  autoCorrect={false}
                  autoCapitalize="words"
                />
                {location.length > 0 && (
                  <TouchableOpacity
                    onPress={() => { handleLocationChange(""); setHills([]); setHillsError(null); }}
                    hitSlop={8}
                    style={p.clearBtn}
                  >
                    <X size={12} color={T.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={p.controlDivider} />

            {/* Radius row */}
            <View style={p.controlRow}>
              <View style={p.controlLabelRow}>
                <Radio size={13} color={T.blue} />
                <Text style={p.controlLabel}>Search radius</Text>
              </View>
              <View style={p.radiusStepper}>
                <TouchableOpacity
                  onPress={() => handleRadiusChange(-1)}
                  disabled={radius <= RADIUS_STEPS[0]}
                  style={[p.stepBtn, radius <= RADIUS_STEPS[0] && { opacity: 0.3 }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Minus size={14} color={T.white} />
                </TouchableOpacity>
                <View style={p.radiusBox}>
                  <Text style={p.radiusVal}>{radius}<Text style={p.radiusUnit}> km</Text></Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRadiusChange(1)}
                  disabled={radius >= RADIUS_STEPS[RADIUS_STEPS.length - 1]}
                  style={[p.stepBtn, radius >= RADIUS_STEPS[RADIUS_STEPS.length - 1] && { opacity: 0.3 }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Plus size={14} color={T.white} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Specific hill search */}
        <Animated.View entering={FadeInDown.delay(120).duration(600)}>
          <View style={p.searchCard}>
            <View style={p.searchLabelRow}>
              <Search size={13} color={T.purple} />
              <Text style={p.searchLabel}>Search a specific hill</Text>
            </View>
            <Text style={p.searchHint}>Know a hill you want to train on? Search it by name.</Text>
            <View style={p.searchRow}>
              <TextInput
                ref={searchInputRef}
                style={p.searchInput}
                value={searchText}
                onChangeText={t => { setSearchText(t); setSearchResult(null); setSearchError(null); setSearchAdded(false); }}
                placeholder="e.g. Pendle Hill, Ben Nevis…"
                placeholderTextColor={T.textDim}
                returnKeyType="search"
                onSubmitEditing={handleHillSearch}
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={handleHillSearch}
                disabled={searchLoading || searchText.trim().length < 2}
                style={[p.searchBtn, (searchLoading || searchText.trim().length < 2) && { opacity: 0.45 }]}
                activeOpacity={0.75}
              >
                {searchLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Search size={16} color="#fff" />}
              </TouchableOpacity>
            </View>

            {searchError && (
              <View style={p.searchErrRow}>
                <AlertCircle size={13} color={T.red} />
                <Text style={p.searchErrText}>{searchError}</Text>
              </View>
            )}

            {searchResult && (
              <View style={p.searchResult}>
                <LinearGradient colors={[T.purpleDim, "transparent"]} style={StyleSheet.absoluteFill} />
                <View style={p.searchResultTop}>
                  <Text style={{ fontSize: 22 }}>{searchResult.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={p.searchResultName}>{searchResult.name}</Text>
                    <Text style={p.searchResultSub}>{searchResult.surface}</Text>
                  </View>
                  <View style={[p.searchGradeBadge, { backgroundColor: (GRADE_COLOR[searchResult.grade] ?? T.blue) + "25" }]}>
                    <Text style={[p.searchGradeText, { color: GRADE_COLOR[searchResult.grade] ?? T.blue }]}>{searchResult.grade}</Text>
                  </View>
                </View>
                <View style={p.searchResultStats}>
                  <View style={p.searchStat}>
                    <TrendingUp size={11} color={T.orange} />
                    <Text style={p.searchStatVal}>{searchResult.elevation}m</Text>
                    <Text style={p.searchStatLbl}>gain</Text>
                  </View>
                  <View style={p.searchStat}>
                    <MapPin size={11} color={T.green} />
                    <Text style={p.searchStatVal}>{searchResult.distance}km</Text>
                    <Text style={p.searchStatLbl}>away</Text>
                  </View>
                  <View style={p.searchStat}>
                    <Repeat size={11} color={T.textMuted} />
                    <Text style={p.searchStatVal}>1×</Text>
                    <Text style={p.searchStatLbl}>reps</Text>
                  </View>
                  <View style={p.searchStat}>
                    <BarChart2 size={11} color={T.purple} />
                    <Text style={p.searchStatVal}>{searchResult.elevation}m</Text>
                    <Text style={p.searchStatLbl}>total</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={handleAddSearchResult}
                  disabled={searchAdded}
                  style={[p.searchAddBtn, searchAdded && { backgroundColor: T.greenDim, borderColor: T.green + "50" }]}
                  activeOpacity={0.75}
                >
                  {searchAdded ? <CheckCircle size={14} color={T.green} /> : <PlusCircle size={14} color={T.purple} />}
                  <Text style={[p.searchAddText, searchAdded && { color: T.green }]}>
                    {searchAdded ? "Added to results!" : "Add to my list"}
                  </Text>
                </TouchableOpacity>

                {/* Log directly from search result */}
                <TouchableOpacity
                  onPress={() => openLog(searchResult.name)}
                  style={p.searchLogBtn}
                  activeOpacity={0.75}
                >
                  <Clock size={13} color={T.green} />
                  <Text style={p.searchLogText}>Log a session here</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Find / Refresh button */}
        <Animated.View entering={FadeInDown.delay(160).duration(600)}>
          <TouchableOpacity
            onPress={() => fetchHills()}
            disabled={hillsLoading}
            style={[p.fetchBtn, hillsLoading && { opacity: 0.7 }]}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={hasFetched ? [T.surface, T.surface] : [T.greenDim, T.greenDim]}
              style={p.fetchBtnInner}
            >
              {hillsLoading ? (
                <>
                  <ActivityIndicator size="small" color={T.green} />
                  <Text style={p.fetchBtnText}>Finding hills within {radius}km…</Text>
                </>
              ) : hasFetched ? (
                <>
                  <RefreshCw size={15} color={T.green} />
                  <Text style={p.fetchBtnText}>Refresh with AI</Text>
                </>
              ) : (
                <>
                  <Zap size={15} color={T.green} />
                  <Text style={p.fetchBtnText}>Find hikes with AI</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Error state */}
        {hillsError && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <View style={p.errCard}>
              <AlertCircle size={14} color={T.red} />
              <Text style={p.errText}>{hillsError}</Text>
            </View>
          </Animated.View>
        )}

        {/* Empty state */}
        {!hasFetched && !hillsLoading && !hillsError && (
          <Animated.View entering={FadeInDown.delay(160).duration(600)}>
            <View style={p.emptyCard}>
              <Text style={p.emptyEmoji}>🏔️</Text>
              <Text style={p.emptyTitle}>No hills loaded yet</Text>
              <Text style={p.emptyText}>
                Enter your location above and tap{" "}
                <Text style={{ color: T.green }}>Find hikes with AI</Text>
                {" "}to discover real training hills near you.
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Hill results */}
        {hasFetched && (
          <Animated.View entering={FadeInDown.delay(60).duration(600)} style={{ gap: 12 }}>
            <Text style={p.sectionLabel}>HILLS NEAR {location.toUpperCase()}</Text>
            {hills.map((hill, i) => (
              <HillCard key={`${hill.name}-${i}`} hill={hill} onLog={name => openLog(name)} />
            ))}
          </Animated.View>
        )}

        {/* Hike history */}
        {exploreHikes.length > 0 && (
          <Animated.View entering={FadeInDown.delay(260).duration(600)}>
            <View style={p.histHead}>
              <Text style={p.histTitle}>YOUR SESSION HISTORY</Text>
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

  // Controls card
  controlCard: { backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border, padding: 14, gap: 12 },
  controlRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  controlLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  controlLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  controlDivider: { height: 1, backgroundColor: T.border },
  locInputWrap: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface, borderRadius: 10, borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 10, paddingVertical: Platform.OS === "ios" ? 9 : 7,
    gap: 6,
  },
  locInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: T.text, paddingVertical: 0 },
  clearBtn: { padding: 2 },

  // Radius stepper
  radiusStepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepBtn: { width: 28, height: 28, backgroundColor: T.surface, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: T.border },
  radiusBox: { width: 58, alignItems: "center" },
  radiusVal: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.text },
  radiusUnit: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },

  // Fetch button
  fetchBtn: { borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: T.border },
  fetchBtnInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  fetchBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.green },

  // Error
  errCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: T.red + "15", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: T.red + "30" },
  errText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: T.red },

  // Empty state
  emptyCard: { backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border, padding: 24, alignItems: "center", gap: 10 },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.text },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 20 },

  // Section label
  sectionLabel: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 1, textTransform: "uppercase" },

  // Hill search card
  searchCard: { backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border, padding: 16, gap: 12, overflow: "hidden" },
  searchLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  searchLabel: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text },
  searchHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: -4 },
  searchRow: { flexDirection: "row", gap: 8 },
  searchInput: {
    flex: 1, backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 12, paddingVertical: Platform.OS === "ios" ? 11 : 9,
    fontSize: 14, fontFamily: "Inter_400Regular", color: T.text,
  },
  searchBtn: { width: 44, backgroundColor: T.purple, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  searchErrRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  searchErrText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: T.red },
  searchResult: { backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 14, gap: 12, overflow: "hidden" },
  searchResultTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  searchResultName: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },
  searchResultSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  searchGradeBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, flexShrink: 0 },
  searchGradeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  searchResultStats: { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  searchStat: { flexDirection: "row", alignItems: "center", gap: 3 },
  searchStatVal: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text },
  searchStatLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  searchAddBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: T.purpleDim, borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: T.purple + "30" },
  searchAddText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.purple },
  searchLogBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: T.greenDim, borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: T.green + "30" },
  searchLogText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.green },

  // History
  histHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  histTitle: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 1, textTransform: "uppercase" },
  histCount: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.green },
});
