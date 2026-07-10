import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
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
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import Animated, { FadeInDown, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import Svg, { Circle, Line, Polyline, Path, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AlertCircle, ArrowLeft, CalendarDays, CheckCircle, ChevronRight, Compass, Lock,
  MoreHorizontal, Mountain, TrendingUp, Zap,
} from "lucide-react-native";
import { T } from "@/constants/theme";
import { logChallengeStarted } from "@/lib/analytics";
import { CHALLENGES, DIFF_COLOR, getChallenge } from "@/constants/challenges";
import { useChallenges, type ChallengeActivity } from "@/context/ChallengesContext";
import { useApp } from "@/context/AppContext";
import { useSubscription } from "@/lib/revenuecat";
import { HillPlannerSection, type PlannedHillEntry } from "@/components/HillPlannerSection";
import { WainwrightTickList } from "@/components/WainwrightTickList";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

// ── Challenge Ring ─────────────────────────────────────────────────────────────
function ChallengeRing({
  pct, elevation, target, emoji, color, size = 160,
}: {
  pct: number; elevation: number; target: number; emoji: string; color: string; size?: number;
}) {
  const strokeWidth = 13;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(pct / 100, { duration: 1400, easing: Easing.out(Easing.cubic) });
  }, [pct]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={strokeWidth}
        />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ alignItems: "center", gap: 1 }}>
        <Text style={{ fontSize: 24, lineHeight: 28 }}>{emoji}</Text>
        <Text style={{ fontSize: 30, fontFamily: "Inter_700Bold", color: T.white, lineHeight: 34 }}>
          {elevation >= 1000 ? `${elevation.toLocaleString()}M` : `${elevation}M`}
        </Text>
        <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted }}>
          / {target.toLocaleString()}M
        </Text>
      </View>
    </View>
  );
}

// ── Progress Chart ─────────────────────────────────────────────────────────────
function ProgressChart({
  activities, target, color, metric,
}: {
  activities: ChallengeActivity[]; target: number; color: string; metric: string;
}) {
  const PAD_L = 44;
  const PAD_B = 22;
  const PAD_R = 10;
  const PAD_T = 8;
  const W = SCREEN_WIDTH - 40;
  const H = 150;
  const cW = W - PAD_L - PAD_R;
  const cH = H - PAD_T - PAD_B;

  const chartData = useMemo(() => {
    const sorted = [...activities].sort((a, b) => a.date.localeCompare(b.date));
    const data = [0];
    let running = 0;
    for (const act of sorted) {
      running += metric === "elevation" ? act.elevationGain : 1;
      data.push(running);
    }
    return data;
  }, [activities, metric]);

  const hasData = chartData.length >= 2;
  const toX = (v: number) => PAD_L + Math.min(1, v / target) * cW;
  const toY = (v: number) => PAD_T + cH - Math.min(1, v / target) * cH;

  const STEPS = 4;
  const yLabels = Array.from({ length: STEPS + 1 }, (_, i) => Math.round((target / STEPS) * i));
  const xLabels = ["0", "25%", "50%", "75%", "100%"];

  const polyPoints = hasData ? chartData.map((v) => `${toX(v)},${toY(v)}`).join(" ") : "";
  const lastVal = hasData ? chartData[chartData.length - 1] : 0;
  const lastX = hasData ? toX(lastVal) : PAD_L;
  const lastY = hasData ? toY(lastVal) : PAD_T + cH;
  const areaD = hasData
    ? `M${toX(0)},${PAD_T + cH} ${chartData.map((v) => `L${toX(v)},${toY(v)}`).join(" ")} L${lastX},${PAD_T + cH} Z`
    : "";

  function fmtY(v: number) {
    if (metric !== "elevation") return `${v}`;
    if (v === 0) return "0m";
    if (v >= 1000) return `${(v / 1000).toFixed(3).replace(/\.?0+$/, "")}k`;
    return `${v}m`;
  }

  return (
    <Svg width={W} height={H}>
      {yLabels.map((v, i) => {
        const y = PAD_T + (cH / STEPS) * (STEPS - i);
        return (
          <React.Fragment key={i}>
            <Line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <SvgText x={PAD_L - 4} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={9}>{fmtY(v)}</SvgText>
          </React.Fragment>
        );
      })}
      {xLabels.map((lbl, i) => (
        <SvgText
          key={i}
          x={PAD_L + (cW / (xLabels.length - 1)) * i}
          y={H - 5}
          textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}
          fill="rgba(255,255,255,0.3)"
          fontSize={9}
        >{lbl}</SvgText>
      ))}
      {/* target diagonal */}
      <Line x1={PAD_L} y1={PAD_T + cH} x2={W - PAD_R} y2={PAD_T} stroke="rgba(255,255,255,0.22)" strokeWidth={1.5} strokeDasharray="5,4" />
      {hasData && <Path d={areaD} fill={color} fillOpacity={0.09} />}
      {hasData && <Polyline points={polyPoints} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
      {/* current position dot */}
      <Circle cx={lastX} cy={lastY} r={6} fill="rgba(255,255,255,0.18)" />
      <Circle cx={lastX} cy={lastY} r={4} fill="white" />
    </Svg>
  );
}

// ── Climb Row ──────────────────────────────────────────────────────────────────
function ClimbRow({ activity, color }: { activity: ChallengeActivity; color: string }) {
  const [imgErr, setImgErr] = useState(false);
  const imgUri = `${API_BASE}/mountain-image?name=${encodeURIComponent(activity.title)}`;
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  let dateLabel: string;
  if (activity.date === today) dateLabel = "Today";
  else if (activity.date === yesterday) dateLabel = "Yesterday";
  else {
    const diff = Math.round((Date.now() - new Date(activity.date).getTime()) / 86400000);
    dateLabel = diff <= 6
      ? `${diff} days ago`
      : new Date(activity.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }
  return (
    <View style={cr.row}>
      {!imgErr ? (
        <Image source={{ uri: imgUri }} style={cr.thumb} onError={() => setImgErr(true)} resizeMode="cover" />
      ) : (
        <View style={[cr.thumb, cr.thumbFb]}>
          <Text style={{ fontSize: 18 }}>⛰️</Text>
        </View>
      )}
      <Text style={cr.name} numberOfLines={1}>{activity.title}</Text>
      <View style={cr.right}>
        {activity.elevationGain > 0 && (
          <Text style={[cr.elev, { color }]}>{activity.elevationGain.toLocaleString()}m</Text>
        )}
        <Text style={cr.date}>{dateLabel}</Text>
      </View>
    </View>
  );
}
const cr = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  thumb: { width: 42, height: 42, borderRadius: 10, backgroundColor: T.surface, flexShrink: 0 },
  thumbFb: { alignItems: "center", justifyContent: "center" },
  name: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.text },
  right: { alignItems: "flex-end", gap: 2 },
  elev: { fontSize: 14, fontFamily: "Inter_700Bold" },
  date: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
});

function ProgressBar({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) {
  return (
    <View style={[pb.track, { height }]}>
      <View style={[pb.fill, { width: `${Math.min(100, pct)}%` as any, backgroundColor: color, height }]} />
    </View>
  );
}
const pb = StyleSheet.create({
  track: { borderRadius: 4, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  fill:  { borderRadius: 4 },
});

function LogModal({
  challengeId,
  visible,
  onClose,
  onSubmit,
  color,
}: {
  challengeId: string;
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<ChallengeActivity, "id" | "createdAt">[]) => void;
  color: string;
}) {
  const { sessions, exploreHikes } = useApp();
  const insets = useSafeAreaInsets();
  const todayStr = () => new Date().toISOString().split("T")[0];

  const [tab, setTab] = useState<"new" | "history">("new");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [dateStr, setDateStr] = useState(todayStr());
  const [elev, setElev] = useState("");
  const [dist, setDist] = useState("");
  const [dur, setDur] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setTab("new"); setSelected(new Set());
    setTitle(""); setDateStr(todayStr()); setElev(""); setDist(""); setDur(""); setNotes("");
  }

  // Build merged history list: completed training sessions + GPS-tracked hikes
  const historyItems = useMemo(() => {
    const fromSessions = sessions
      .filter(s => s.completed)
      .map(s => ({
        key: `s-${s.id}`,
        title: s.type === "hill" ? (s.hillName || "Hill session") : s.type === "cardio" ? "Cardio session" : "Big day",
        date: s.date,
        elevationGain: s.elevationGain,
        distance: s.distance,
        duration: s.duration,
      }));
    const fromHikes = exploreHikes.map(h => ({
      key: `h-${h.id}`,
      title: h.name,
      date: h.date,
      elevationGain: h.elevationGain,
      distance: h.distance,
      duration: h.timeTaken,
    }));
    return [...fromSessions, ...fromHikes].sort((a, b) => b.date.localeCompare(a.date));
  }, [sessions, exploreHikes]);

  function toggleSelect(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function handleSubmitNew() {
    const elevNum = parseFloat(elev) || 0;
    const distNum = parseFloat(dist) || 0;
    const durNum = parseInt(dur) || 0;
    if (!title.trim() && elevNum === 0) {
      Alert.alert("Add a title or elevation", "Please fill in at least the activity name or elevation gain.");
      return;
    }
    let resolvedDate = todayStr();
    const dmyMatch = dateStr.trim().match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
    const isoymdMatch = dateStr.trim().match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/);
    if (dmyMatch) {
      resolvedDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, "0")}-${dmyMatch[1].padStart(2, "0")}`;
    } else if (isoymdMatch) {
      resolvedDate = `${isoymdMatch[1]}-${isoymdMatch[2].padStart(2, "0")}-${isoymdMatch[3].padStart(2, "0")}`;
    }
    if (resolvedDate > todayStr()) resolvedDate = todayStr();
    onSubmit([{
      challengeId,
      title: title.trim() || "Training session",
      date: resolvedDate,
      elevationGain: elevNum,
      distance: distNum,
      duration: durNum,
      notes: notes.trim(),
    }]);
    reset();
    onClose();
  }

  function handleAddFromHistory() {
    if (selected.size === 0) return;
    const entries = historyItems
      .filter(h => selected.has(h.key))
      .map(item => ({
        challengeId,
        title: item.title,
        date: item.date,
        elevationGain: item.elevationGain,
        distance: item.distance,
        duration: item.duration,
        notes: "",
      }));
    onSubmit(entries);
    reset();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={[lm.container, Platform.OS === "android" && { paddingBottom: insets.bottom + 20 }]}>
          <View style={lm.handle} />
          <Text style={lm.title}>Log Activity</Text>

          {/* Tab switcher */}
          <View style={lm.tabs}>
            <TouchableOpacity
              style={[lm.tab, tab === "new" && { borderBottomColor: color, borderBottomWidth: 2 }]}
              onPress={() => setTab("new")} activeOpacity={0.7}
            >
              <Text style={[lm.tabText, tab === "new" && { color }]}>Log New</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[lm.tab, tab === "history" && { borderBottomColor: color, borderBottomWidth: 2 }]}
              onPress={() => setTab("history")} activeOpacity={0.7}
            >
              <Text style={[lm.tabText, tab === "history" && { color }]}>
                From History{historyItems.length > 0 ? ` (${historyItems.length})` : ""}
              </Text>
            </TouchableOpacity>
          </View>

          {tab === "new" ? (
            <>
              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={lm.fields}>
                <View style={lm.row}>
                  <View style={[lm.field, { flex: 2 }]}>
                    <Text style={lm.label}>Activity name</Text>
                    <TextInput
                      style={lm.input}
                      value={title}
                      onChangeText={setTitle}
                      placeholder="e.g. Local hill repeats"
                      placeholderTextColor={T.textDim}
                    />
                  </View>
                  <View style={[lm.field, { flex: 1 }]}>
                    <Text style={lm.label}>Date</Text>
                    <TextInput
                      style={lm.input}
                      value={dateStr}
                      onChangeText={setDateStr}
                      placeholder="DD/MM/YYYY"
                      placeholderTextColor={T.textDim}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>
                <View style={lm.row}>
                  <View style={[lm.field, { flex: 1 }]}>
                    <Text style={lm.label}>Elevation gain (m)</Text>
                    <TextInput
                      style={lm.input}
                      value={elev}
                      onChangeText={setElev}
                      placeholder="450"
                      placeholderTextColor={T.textDim}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[lm.field, { flex: 1 }]}>
                    <Text style={lm.label}>Distance (km)</Text>
                    <TextInput
                      style={lm.input}
                      value={dist}
                      onChangeText={setDist}
                      placeholder="6"
                      placeholderTextColor={T.textDim}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <View style={lm.field}>
                  <Text style={lm.label}>Duration (minutes)</Text>
                  <TextInput
                    style={lm.input}
                    value={dur}
                    onChangeText={setDur}
                    placeholder="90"
                    placeholderTextColor={T.textDim}
                    keyboardType="numeric"
                  />
                </View>
                <View style={lm.field}>
                  <Text style={lm.label}>Notes (optional)</Text>
                  <TextInput
                    style={[lm.input, { height: 80, textAlignVertical: "top" }]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="How did it go?"
                    placeholderTextColor={T.textDim}
                    multiline
                  />
                </View>
              </ScrollView>
              <View style={lm.actions}>
                <TouchableOpacity onPress={onClose} style={lm.cancelBtn} activeOpacity={0.7}>
                  <Text style={lm.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSubmitNew} style={[lm.submitBtn, { backgroundColor: color }]} activeOpacity={0.8}>
                  <TrendingUp size={15} color={T.bg} />
                  <Text style={lm.submitText}>Log Activity</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {historyItems.length === 0 ? (
                <View style={lm.emptyHistory}>
                  <Text style={lm.emptyHistoryText}>No previous sessions found.</Text>
                  <Text style={lm.emptyHistorySubText}>Complete training sessions or track hikes to import them here.</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
                  {historyItems.map(item => {
                    const isSelected = selected.has(item.key);
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={[lm.histRow, isSelected && { borderColor: color }]}
                        onPress={() => toggleSelect(item.key)}
                        activeOpacity={0.75}
                      >
                        <View style={[lm.checkbox, isSelected && { backgroundColor: color, borderColor: color }]}>
                          {isSelected && <Text style={lm.checkMark}>✓</Text>}
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={lm.histName} numberOfLines={1}>{item.title}</Text>
                          <Text style={lm.histMeta}>
                            {item.date}
                            {item.elevationGain > 0 ? ` · ${item.elevationGain.toLocaleString()}m` : ""}
                            {item.distance > 0 ? ` · ${item.distance}km` : ""}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
              <View style={lm.actions}>
                <TouchableOpacity onPress={onClose} style={lm.cancelBtn} activeOpacity={0.7}>
                  <Text style={lm.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAddFromHistory}
                  style={[lm.submitBtn, { backgroundColor: selected.size === 0 ? T.surface : color }]}
                  activeOpacity={0.8}
                  disabled={selected.size === 0}
                >
                  <CheckCircle size={15} color={selected.size === 0 ? T.textMuted : T.bg} />
                  <Text style={[lm.submitText, selected.size === 0 && { color: T.textMuted }]}>
                    {selected.size === 0 ? "Select sessions" : `Add ${selected.size} session${selected.size > 1 ? "s" : ""}`}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const lm = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg, padding: 20, paddingTop: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: T.border, alignSelf: "center", marginBottom: 20 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: T.text, marginBottom: 4 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, marginBottom: 20, lineHeight: 18 },
  // Tabs
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: T.border, marginBottom: 16 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  // New activity form
  fields: { gap: 14, paddingBottom: 20 },
  field: { gap: 6 },
  row: { flexDirection: "row", gap: 10 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  input: {
    backgroundColor: T.card, borderRadius: 12, borderWidth: 1, borderColor: T.border,
    color: T.text, fontFamily: "Inter_400Regular", fontSize: 14, padding: 12,
  },
  // History list
  histRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.card, borderRadius: 12, borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: 0, marginBottom: 8,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: T.border,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  checkMark: { fontSize: 12, color: "#fff", fontFamily: "Inter_700Bold" },
  histName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.text },
  histMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  emptyHistory: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 24 },
  emptyHistoryText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.text, textAlign: "center" },
  emptyHistorySubText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 18 },
  // Actions
  actions: { flexDirection: "row", gap: 10, paddingTop: 12 },
  cancelBtn: {
    flex: 1, backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border,
    paddingVertical: 14, alignItems: "center",
  },
  cancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  submitBtn: {
    flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 12, paddingVertical: 14,
  },
  submitText: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.bg },
});

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { activeChallenges, startChallenge, abandonChallenge, logActivity } = useChallenges();
  const { isSubscribed } = useSubscription();
  const [logVisible, setLogVisible] = useState(false);

  // Planned hills state — lifted from HillPlannerSection via onPlannedChange
  const [plannedHills, setPlannedHills] = useState<PlannedHillEntry[]>([]);
  const plannerLogRef = useRef<(() => Promise<void>) | null>(null);
  const isLoggingRef = useRef(false);

  // Animate sticky log bar in/out when hills are selected
  const logBarAnim = useSharedValue(0);
  useEffect(() => {
    logBarAnim.value = withTiming(plannedHills.length > 0 ? 1 : 0, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [plannedHills.length]);
  const logBarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - logBarAnim.value) * 80 }],
    opacity: logBarAnim.value,
  }));

  async function handleLogBarPress() {
    if (!plannerLogRef.current || isLoggingRef.current) return;
    isLoggingRef.current = true;
    try {
      await plannerLogRef.current();
    } finally {
      isLoggingRef.current = false;
    }
  }

  const c = getChallenge(id ?? "");

  // Derive ac and progress from the reactive activeChallenges array so the
  // screen re-renders immediately when startChallenge / logActivity updates state.
  const ac = useMemo(
    () => activeChallenges.find(a => a.challengeId === (id ?? "")),
    [activeChallenges, id],
  );
  const progress = useMemo(() => {
    if (!ac || !c) return 0;
    const total = ac.activities.reduce((sum, a) => {
      if (c.metric === "hikes") return sum + 1;
      return sum + a.elevationGain;
    }, 0);
    return Math.min(total, c.targetValue);
  }, [ac, c]);

  const pct = useMemo(() => {
    if (!c) return 0;
    return Math.min(100, Math.round((progress / c.targetValue) * 100));
  }, [c, progress]);

  const milestoneReached = useMemo(() => {
    if (!c) return [];
    return c.milestones.filter(m => pct >= m.pct);
  }, [c, pct]);

  const nextMilestone = useMemo(() => {
    if (!c) return undefined;
    return c.milestones.find(m => pct < m.pct);
  }, [c, pct]);

  if (!c) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: T.textMuted }}>Challenge not found</Text>
      </View>
    );
  }

  const color = c.color;
  const diffColor = DIFF_COLOR[c.difficulty];
  const locked = c.isPremium && !isSubscribed;
  const isActive = ac && !ac.completed;
  const isCompleted = ac?.completed === true;

  function handleStart() {
    if (locked) { router.push("/paywall"); return; }
    startChallenge(c!.id);
    void logChallengeStarted({ challenge_id: c!.id });
  }

  async function handleLog(entries: Omit<ChallengeActivity, "id" | "createdAt">[]) {
    let newProgress = progress;
    for (const data of entries) {
      await logActivity(data);
      newProgress += data.elevationGain || (c!.metric === "hikes" ? 1 : 0);
    }
    if (newProgress >= c!.targetValue && !isCompleted) {
      router.replace({ pathname: "/challenge-complete", params: { id: c!.id } });
    }
  }

  async function handlePlannerLog(hills: PlannedHillEntry[]) {
    if (locked) { router.push("/paywall"); return; }
    if (!ac) await startChallenge(c!.id);
    const today = new Date().toISOString().split("T")[0];
    let runningProgress = progress;
    for (const { hill, reps } of hills) {
      const elevGain = hill.elevation * reps;
      await logActivity({
        challengeId: c!.id,
        title: reps > 1 ? `${hill.name} ×${reps}` : hill.name,
        date: today,
        elevationGain: elevGain,
        distance: hill.distance ? hill.distance * reps : 0,
        duration: 0,
        notes: `${reps} rep${reps !== 1 ? "s" : ""} of ${hill.name} (${hill.elevation}m per rep)`,
      });
      runningProgress += c!.metric === "hikes" ? 1 : elevGain;
    }
    if (runningProgress >= c!.targetValue && !isCompleted) {
      router.replace({ pathname: "/challenge-complete", params: { id: c!.id } });
    }
  }

  async function handleAbandon() {
    if (Platform.OS === "web") {
      abandonChallenge(c!.id);
      return;
    }
    Alert.alert("Abandon challenge?", "Your logged activities will still count toward your training.", [
      { text: "Cancel", style: "cancel" },
      { text: "Abandon", style: "destructive", onPress: () => abandonChallenge(c!.id) },
    ]);
  }

  function openMenu() {
    Alert.alert(c!.title, "What would you like to do?", [
      { text: "Log Activity", onPress: () => setLogVisible(true) },
      { text: "Abandon Challenge", style: "destructive", onPress: handleAbandon },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: Platform.OS === "web" ? 60 : insets.top + 12, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentInset={{ bottom: plannedHills.length > 0 ? 80 : 0 }}
      >
        {/* Header */}
        <View style={s.cdHeader}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} activeOpacity={0.7} style={s.headerBtn}>
            <ArrowLeft size={18} color={T.textMuted} />
          </TouchableOpacity>
          <Text style={s.cdTitle} numberOfLines={1}>{c.title.toUpperCase()}</Text>
          {isActive ? (
            <TouchableOpacity style={s.headerBtn} activeOpacity={0.7} onPress={openMenu}>
              <MoreHorizontal size={20} color={T.textMuted} />
            </TouchableOpacity>
          ) : (
            <View style={s.headerBtn} />
          )}
        </View>

        {isActive ? (
          <>
            {/* Ring */}
            <Animated.View entering={FadeInDown.delay(40).duration(600)} style={s.ringSection}>
              <ChallengeRing
                pct={pct}
                elevation={c.metric === "elevation" ? progress : ac.activities.length}
                target={c.targetValue}
                emoji={c.emoji}
                color={color}
                size={160}
              />
              <Text style={[s.pctText, { color }]}>{pct}% COMPLETED</Text>
              <Text style={s.toGoText}>
                {c.metric === "elevation"
                  ? `${(c.targetValue - progress).toLocaleString()}M to go`
                  : `${c.targetValue - ac.activities.length} sessions remaining`}
              </Text>
            </Animated.View>

            {/* Chart — always visible so users see the target line from day one */}
            <Animated.View entering={FadeInDown.delay(80).duration(600)} style={s.chartCard}>
              <ProgressChart
                activities={ac.activities}
                target={c.targetValue}
                color={color}
                metric={c.metric}
              />
            </Animated.View>

            {/* Stat tiles */}
            <Animated.View entering={FadeInDown.delay(100).duration(600)} style={s.statTilesRow}>
              <View style={s.statTile}>
                <Compass size={22} color={color} />
                <Text style={[s.statTileVal, { color }]}>{ac.activities.length}</Text>
                <Text style={s.statTileLbl}>Climbs</Text>
              </View>
              <View style={s.statTileDivider} />
              <View style={s.statTile}>
                <TrendingUp size={22} color={color} />
                <Text style={[s.statTileVal, { color }]}>
                  {c.metric === "elevation" ? `${progress.toLocaleString()}m` : `${ac.activities.length}`}
                </Text>
                <Text style={s.statTileLbl}>Gained</Text>
              </View>
              <View style={s.statTileDivider} />
              <View style={s.statTile}>
                <CalendarDays size={22} color={color} />
                <Text style={[s.statTileVal, { color }]}>
                  {new Set(ac.activities.map(a => a.date)).size}
                </Text>
                <Text style={s.statTileLbl}>Days Active</Text>
              </View>
            </Animated.View>

            {/* Recent Climbs */}
            {ac.activities.length > 0 && (
              <Animated.View entering={FadeInDown.delay(120).duration(600)}>
                <View style={s.recentHeader}>
                  <Text style={s.recentTitle}>RECENT CLIMBS</Text>
                  <TouchableOpacity onPress={() => setLogVisible(true)} activeOpacity={0.7}>
                    <Text style={[s.recentViewAll, { color }]}>View all</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.recentList}>
                  {[...ac.activities].reverse().slice(0, 5).map((a, i, arr) => (
                    <React.Fragment key={a.id}>
                      <ClimbRow activity={a} color={color} />
                      {i < arr.length - 1 && <View style={s.recentDivider} />}
                    </React.Fragment>
                  ))}
                </View>
              </Animated.View>
            )}

            {/* Hill Planner — hidden for Wainwrights (use tick list instead) */}
            {c.id !== "all-wainwrights" && (
              <Animated.View entering={FadeInDown.delay(140).duration(600)}>
                <HillPlannerSection
                  targetValue={c.targetValue}
                  metric={c.metric}
                  color={color}
                  currentProgress={progress}
                  onLog={handlePlannerLog}
                  onPlannedChange={setPlannedHills}
                  logTriggerRef={plannerLogRef}
                />
              </Animated.View>
            )}

            {/* Wainwright tick list */}
            {c.id === "all-wainwrights" && (
              <Animated.View entering={FadeInDown.delay(140).duration(600)}>
                <WainwrightTickList
                  challengeId={c.id}
                  color={color}
                  isActive={isActive}
                />
              </Animated.View>
            )}

            {/* Next milestone banner */}
            {nextMilestone && (
              <Animated.View entering={FadeInDown.delay(160).duration(500)} style={s.milestoneBanner}>
                <ChevronRight size={13} color={color} />
                <Text style={[s.milestoneBannerText, { color }]}>
                  Next: {nextMilestone.label} at {nextMilestone.pct}%
                </Text>
              </Animated.View>
            )}
          </>
        ) : (
          <>
            {/* Hero card — non-active state */}
            <Animated.View entering={FadeInDown.delay(40).duration(600)} style={s.hero}>
              <LinearGradient colors={[color + "18", "transparent"]} style={StyleSheet.absoluteFill} />
              <View style={s.heroTop}>
                <View style={[s.heroEmoji, { backgroundColor: color + "22" }]}>
                  <Text style={s.heroEmojiText}>{c.emoji}</Text>
                </View>
                <View style={s.heroBadges}>
                  <View style={[s.badge, { backgroundColor: diffColor + "22" }]}>
                    <Text style={[s.badgeText, { color: diffColor }]}>{c.difficulty}</Text>
                  </View>
                  {c.isPremium && (
                    <View style={[s.badge, { backgroundColor: T.purpleDim }]}>
                      <Zap size={9} color={T.purple} />
                      <Text style={[s.badgeText, { color: T.purple }]}>Pro</Text>
                    </View>
                  )}
                  {isCompleted && (
                    <View style={[s.badge, { backgroundColor: T.greenDim }]}>
                      <CheckCircle size={9} color={T.green} />
                      <Text style={[s.badgeText, { color: T.green }]}>Complete</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={s.heroTitle}>{c.title}</Text>
              <Text style={s.heroDesc}>{c.description}</Text>
              <View style={s.heroMeta}>
                <Text style={s.heroMetaText}>
                  {c.metric === "elevation" ? `${c.targetValue.toLocaleString()}m total` : `${c.targetValue} sessions`}
                </Text>
                {c.durationDays && <Text style={s.heroMetaDot}>·</Text>}
                {c.durationDays && <Text style={s.heroMetaText}>{c.durationDays} days</Text>}
                <Text style={s.heroMetaDot}>·</Text>
                <Text style={s.heroMetaText}>{c.mountain}</Text>
              </View>
            </Animated.View>

            {/* Not-started banner */}
            {!ac && (
              <Animated.View entering={FadeInDown.delay(60).duration(600)} style={s.notStartedBanner}>
                <AlertCircle size={15} color={T.orange} />
                <Text style={s.notStartedText}>
                  Tap <Text style={s.notStartedBold}>Start Challenge</Text> below before logging — activities won't be saved until active.
                </Text>
              </Animated.View>
            )}

            {/* Hill planner — hidden for Wainwrights */}
            {!isCompleted && c.id !== "all-wainwrights" && (
              <Animated.View entering={FadeInDown.delay(80).duration(600)}>
                <HillPlannerSection
                  targetValue={c.targetValue}
                  metric={c.metric}
                  color={color}
                  currentProgress={progress}
                  onLog={handlePlannerLog}
                  onPlannedChange={setPlannedHills}
                  logTriggerRef={plannerLogRef}
                />
              </Animated.View>
            )}

            {/* Wainwright tick list — shown on non-active/completed state too */}
            {c.id === "all-wainwrights" && (
              <Animated.View entering={FadeInDown.delay(80).duration(600)}>
                <WainwrightTickList
                  challengeId={c.id}
                  color={color}
                  isActive={isActive ?? false}
                />
              </Animated.View>
            )}

            {/* Milestones */}
            <Animated.View entering={FadeInDown.delay(100).duration(600)} style={s.card}>
              <Text style={s.cardTitle}>Milestones</Text>
              {c.milestones.map((m) => {
                const reached = pct >= m.pct;
                return (
                  <View key={m.pct} style={s.milestoneRow}>
                    <View style={[s.milestoneDot, reached && { backgroundColor: color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.milestoneLabel, reached && { color: T.text }]}>{m.label}</Text>
                    </View>
                    <Text style={s.milestoneEmoji}>{reached ? m.emoji : "○"}</Text>
                    <Text style={[s.milestonePct, reached && { color }]}>{m.pct}%</Text>
                  </View>
                );
              })}
            </Animated.View>

            {/* CTA */}
            <Animated.View entering={FadeInDown.delay(120).duration(600)} style={s.ctaArea}>
              {!ac && (
                <TouchableOpacity onPress={handleStart} style={[s.ctaBtn, locked && s.ctaBtnLocked]} activeOpacity={0.85}>
                  <LinearGradient
                    colors={locked ? [T.surface, T.surface] : [color, color + "CC"]}
                    style={s.ctaBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  >
                    {locked ? <Lock size={16} color={T.textMuted} /> : <Zap size={16} color={T.bg} />}
                    <Text style={[s.ctaBtnText, locked && { color: T.textMuted }]}>
                      {locked ? "Unlock with Pro" : "Start Challenge"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
              {isCompleted && (
                <TouchableOpacity
                  onPress={() => router.push({ pathname: "/challenge-complete", params: { id: c.id } })}
                  style={s.ctaBtn} activeOpacity={0.85}
                >
                  <LinearGradient colors={[T.green, T.green + "CC"]} style={s.ctaBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <CheckCircle size={16} color={T.bg} />
                    <Text style={s.ctaBtnText}>View Results</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </Animated.View>
          </>
        )}
      </ScrollView>

      {/* Sticky "Log hills" bar — slides up from bottom when hills are selected */}
      <Animated.View
        style={[s.logBar, { bottom: Platform.OS === "web" ? 20 : insets.bottom + 10 }, logBarStyle]}
        pointerEvents={plannedHills.length > 0 ? "auto" : "none"}
      >
        <TouchableOpacity
          onPress={handleLogBarPress}
          activeOpacity={0.88}
          style={[s.logBarInner, { backgroundColor: color }]}
        >
          <CheckCircle size={18} color={T.bg} />
          <Text style={s.logBarText}>
            Log {plannedHills.length} hill{plannedHills.length !== 1 ? "s" : ""} as completed
          </Text>
        </TouchableOpacity>
      </Animated.View>

      <LogModal
        challengeId={c.id}
        visible={logVisible}
        onClose={() => setLogVisible(false)}
        onSubmit={handleLog}
        color={color}
      />
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 16 },

  // ── Sticky log bar ────────────────────────────────────────────────────────
  logBar: { position: "absolute", left: 20, right: 20 },
  logBarInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9,
    paddingVertical: 17, borderRadius: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
  },
  logBarText: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.bg },


  // ── Header ────────────────────────────────────────────────────────────────
  cdHeader: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  cdTitle: { flex: 1, textAlign: "center", fontSize: 13, fontFamily: "Inter_700Bold", color: T.text, letterSpacing: 1.5 },

  // ── Active state ──────────────────────────────────────────────────────────
  ringSection: { alignItems: "center", gap: 8, paddingVertical: 4 },
  pctText: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  toGoText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },

  chartCard: {
    backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.border,
    paddingTop: 14, paddingBottom: 6, paddingHorizontal: 0, overflow: "hidden",
  },

  statTilesRow: {
    flexDirection: "row", backgroundColor: T.card,
    borderRadius: 16, borderWidth: 1, borderColor: T.border,
    paddingVertical: 16,
  },
  statTile: { flex: 1, alignItems: "center", gap: 6 },
  statTileVal: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statTileLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  statTileDivider: { width: 1, backgroundColor: T.border, marginVertical: 8 },

  recentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  recentTitle: { fontSize: 11, fontFamily: "Inter_700Bold", color: T.textMuted, letterSpacing: 1.4 },
  recentViewAll: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  recentList: { backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.border, paddingHorizontal: 14 },
  recentDivider: { height: 1, backgroundColor: T.border },

  milestoneBanner: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: T.card, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: T.border },
  milestoneBannerText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },


  // ── Hero / non-active ─────────────────────────────────────────────────────
  hero: { backgroundColor: T.card, borderRadius: 20, borderWidth: 1, borderColor: T.border, padding: 18, gap: 10, overflow: "hidden" },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroEmoji: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  heroEmojiText: { fontSize: 26 },
  heroBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 4 },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  heroTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.text, lineHeight: 28 },
  heroDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 19 },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  heroMetaText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textDim },
  heroMetaDot: { fontSize: 12, color: T.textDim },

  card: { backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 16, gap: 12 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },

  milestoneRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  milestoneDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.border, flexShrink: 0 },
  milestoneLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },
  milestoneEmoji: { fontSize: 16 },
  milestonePct: { fontSize: 12, fontFamily: "Inter_700Bold", color: T.textDim, minWidth: 32, textAlign: "right" },

  ctaArea: { gap: 10 },
  ctaBtn: { borderRadius: 14, overflow: "hidden" },
  ctaBtnLocked: { opacity: 0.8 },
  ctaBtnInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 },
  ctaBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.bg },

  notStartedBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "rgba(255,144,48,0.10)", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,144,48,0.25)", padding: 14,
  },
  notStartedText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 19 },
  notStartedBold: { fontFamily: "Inter_700Bold", color: T.text },
});
