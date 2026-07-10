import type { LucideIcon } from "lucide-react-native";
import { TrendingUp, X, Plus, Map, Clock, Check, Trash2, Activity, CheckCircle, Footprints, ChevronLeft, ChevronRight } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useState, useMemo } from "react";
import { router } from "expo-router";
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

import { Session, ExploreHike, TrainingWeek, useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";
import { useScreenView } from "@/lib/analytics";
import {
  TrainingSeed,
  SESSION_TYPES,
  EffortPicker,
  HillSearchSection,
  AddSessionModal,
} from "@/components/LogSessionModals";

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
              {session.gymSubtype === "stepper" && session.stepperFloors ? ` · ${session.stepperFloors} floors` : ""}
              {session.gymSubtype === "treadmill" && session.treadmillKm ? ` · ${session.treadmillKm}km @ ${session.treadmillInclinePct ?? 10}%` : ""}
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

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function ExploreHikeCard({ hike, onDelete, onPress, index }: {
  hike: ExploreHike;
  onDelete: () => void;
  onPress: () => void;
  index: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.82}>
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
            <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); onDelete(); }} style={styles.delBtn}>
              <Trash2 size={14} color={T.textDim} />
            </TouchableOpacity>
          </View>
          <View style={styles.scStats}>
            {([
              { icon: TrendingUp, val: `${hike.elevationGain}m`, color: T.orange },
              { icon: Map, val: `${hike.distance.toFixed(2)}km`, color: T.blue },
              { icon: Clock, val: fmtDuration(hike.timeTaken), color: T.textMuted },
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
      </TouchableOpacity>
    </Animated.View>
  );
}

function HikeDetailSheet({ hike, onClose }: { hike: ExploreHike; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.hdOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.hdSheet, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.hdHandle} />
          <View style={styles.hdHeader}>
            <View style={[styles.scTypeIcon, { backgroundColor: T.green + "18", width: 44, height: 44, borderRadius: 14 }]}>
              <Map size={20} color={T.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hdTitle}>{hike.name}</Text>
              <Text style={styles.hdDate}>
                {new Date(hike.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.hdCloseBtn}>
              <X size={16} color={T.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.hdStatRow}>
            <View style={styles.hdStatCell}>
              <TrendingUp size={20} color={T.orange} />
              <Text style={styles.hdStatVal}>{hike.elevationGain}m</Text>
              <Text style={styles.hdStatLbl}>Elevation</Text>
            </View>
            <View style={styles.hdStatDivider} />
            <View style={styles.hdStatCell}>
              <Map size={20} color={T.blue} />
              <Text style={styles.hdStatVal}>{hike.distance.toFixed(2)}km</Text>
              <Text style={styles.hdStatLbl}>Distance</Text>
            </View>
            <View style={styles.hdStatDivider} />
            <View style={styles.hdStatCell}>
              <Clock size={20} color={T.textMuted} />
              <Text style={styles.hdStatVal}>{fmtDuration(hike.timeTaken)}</Text>
              <Text style={styles.hdStatLbl}>Duration</Text>
            </View>
          </View>

          {!!hike.notes && (
            <View style={styles.hdNotesBox}>
              <Text style={styles.hdNotesText}>{hike.notes}</Text>
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["Mo","Tu","We","Th","Fr","Sa","Su"];

function MiniCalendar({ sessions, exploreHikes, trainingPlan }: {
  sessions: Session[];
  exploreHikes: ExploreHike[];
  trainingPlan: TrainingWeek[];
}) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const loggedDates = useMemo(() => {
    const s = new Set<string>();
    sessions.forEach(sess => { if (sess.completed) s.add(sess.date.slice(0, 10)); });
    exploreHikes.forEach(h => s.add(h.date.slice(0, 10)));
    return s;
  }, [sessions, exploreHikes]);

  const plannedDates = useMemo(() => {
    const s = new Set<string>();
    trainingPlan.forEach(week => {
      if (!week.startDate || !week.endDate) return;
      const cur = new Date(week.startDate);
      const end = new Date(week.endDate);
      while (cur <= end) {
        s.add(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    });
    return s;
  }, [trainingPlan]);

  const today = new Date().toISOString().slice(0, 10);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const offset = (firstDay + 6) % 7;

  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={calSt.wrap}>
      <View style={calSt.header}>
        <TouchableOpacity onPress={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} style={calSt.navBtn}>
          <ChevronLeft size={16} color={T.textMuted} />
        </TouchableOpacity>
        <Text style={calSt.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
        <TouchableOpacity onPress={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} style={calSt.navBtn}>
          <ChevronRight size={16} color={T.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={calSt.dayLabelsRow}>
        {DAY_LABELS.map(l => <Text key={l} style={calSt.dayLabel}>{l}</Text>)}
      </View>

      {rows.map((row, ri) => (
        <View key={ri} style={calSt.row}>
          {row.map((day, ci) => {
            if (day === null) return <View key={ci} style={calSt.cell} />;
            const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isToday = iso === today;
            const hasLog = loggedDates.has(iso);
            const hasPlan = plannedDates.has(iso);
            return (
              <View key={ci} style={calSt.cell}>
                {hasPlan && <View style={calSt.planBg} />}
                <View style={[calSt.dayCircle, isToday && calSt.todayCircle]}>
                  <Text style={[calSt.dayNum, isToday && calSt.dayNumToday]}>{day}</Text>
                </View>
                {hasLog && <View style={calSt.dotGreen} />}
                {hasPlan && !hasLog && <View style={calSt.dotBlue} />}
              </View>
            );
          })}
        </View>
      ))}

      <View style={calSt.legend}>
        <View style={calSt.legendItem}><View style={calSt.dotGreen} /><Text style={calSt.legendText}>Logged</Text></View>
        <View style={calSt.legendItem}><View style={[calSt.planBg, { position: "relative", width: 12, height: 12, borderRadius: 4 }]} /><Text style={calSt.legendText}>Training week</Text></View>
      </View>
    </View>
  );
}

type LogItem =
  | { kind: "session"; data: Session }
  | { kind: "hike"; data: ExploreHike };

const EXERCISE_CHOICES: {
  label: string;
  sub: string;
  icon: typeof Activity;
  color: string;
  seed: TrainingSeed;
}[] = [
  {
    label: "Incline Treadmill",
    sub: "10–15% incline, brisk hike pace",
    icon: TrendingUp,
    color: T.green,
    seed: { type: "cardio", cardioSubtype: "treadmill", treadmillIncline: 10 },
  },
  {
    label: "Stepper Machine",
    sub: "Step machine for leg drive and cardio",
    icon: Activity,
    color: T.blue,
    seed: { type: "cardio", cardioSubtype: "stepper" },
  },
  {
    label: "Outdoor Walk / Hike",
    sub: "Weighted pack or natural terrain",
    icon: Map,
    color: T.orange,
    seed: { type: "cardio", cardioSubtype: "outdoor" },
  },
];

export default function LogScreen() {
  useScreenView("log");
  const insets = useSafeAreaInsets();
  const { sessions, deleteSession, updateSession, exploreHikes, deleteExploreHike, trainingPlan } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [addModalSeed, setAddModalSeed] = useState<TrainingSeed | undefined>();
  const [selectedHike, setSelectedHike] = useState<ExploreHike | null>(null);

  function openExercise(seed: TrainingSeed) {
    setAddModalSeed(seed);
    setModalOpen(true);
  }

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

        {/* Past activity shortcut */}
        <Animated.View entering={FadeInDown.delay(75).duration(400)}>
          <TouchableOpacity
            onPress={() => router.push("/past-activity" as never)}
            style={styles.pastActCard}
            activeOpacity={0.8}
          >
            <View style={styles.pastActIconWrap}>
              <Clock size={17} color={T.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pastActTitle}>Add past summits</Text>
              <Text style={styles.pastActSub}>Log hills you've already done</Text>
            </View>
            <ChevronRight size={15} color={T.textDim} />
          </TouchableOpacity>
        </Animated.View>

        {/* Calendar */}
        <Animated.View entering={FadeInDown.delay(90).duration(400)}>
          <MiniCalendar sessions={sessions} exploreHikes={exploreHikes} trainingPlan={trainingPlan} />
        </Animated.View>

        {/* Start Hiking */}
        <Animated.View entering={FadeInDown.delay(120).duration(400)}>
          <TouchableOpacity
            onPress={() => router.push("/hike-tracking")}
            activeOpacity={0.85}
            style={styles.startHikeBtn}
          >
            <View style={styles.startHikeLeft}>
              <View style={styles.startHikeIconBox}>
                <Footprints size={22} color={T.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.startHikeTitle}>Start Hiking</Text>
                <Text style={styles.startHikeSub} numberOfLines={1}>Track your route in real time</Text>
              </View>
            </View>
            <View style={styles.startHikeArrow}>
              <Text style={{ color: T.white, fontSize: 18 }}>›</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Exercise picker */}
        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <Text style={styles.exerciseHeading}>Log a Session</Text>
          {EXERCISE_CHOICES.map((ex, i) => (
            <TouchableOpacity
              key={ex.label}
              onPress={() => openExercise(ex.seed)}
              activeOpacity={0.8}
              style={styles.exerciseRow}
            >
              <View style={[styles.exerciseIconBox, { backgroundColor: ex.color + "18" }]}>
                {(() => { const EIcon = ex.icon; return <EIcon size={20} color={ex.color} />; })()}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.exerciseLabel}>{ex.label}</Text>
                <Text style={styles.exerciseSub}>{ex.sub}</Text>
              </View>
              <ChevronRight size={16} color={T.textDim} />
            </TouchableOpacity>
          ))}
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
                onPress={() => setSelectedHike(item.data)}
              />
            )
          )
        )}
      </ScrollView>
      <AddSessionModal
        visible={modalOpen}
        onClose={() => { setModalOpen(false); setAddModalSeed(undefined); }}
        seed={addModalSeed}
      />
      {selectedHike && <HikeDetailSheet hike={selectedHike} onClose={() => setSelectedHike(null)} />}
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
  pastActCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14,
  },
  pastActIconWrap: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: T.green + "18", borderWidth: 1, borderColor: T.green + "40",
    alignItems: "center", justifyContent: "center",
  },
  pastActTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.white },
  pastActSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  startHikeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    backgroundColor: T.green,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  startHikeLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  startHikeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  startHikeTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.white },
  startHikeSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 1 },
  startHikeArrow: { width: 28, height: 28, borderRadius: 9, backgroundColor: "rgba(0,0,0,0.15)", alignItems: "center", justifyContent: "center" },
  exerciseHeading: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: T.textMuted,
    letterSpacing: 0.5, marginBottom: 10, marginTop: 4,
  },
  exerciseRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.cardBorder,
    paddingVertical: 14, paddingHorizontal: 14,
    marginBottom: 10,
  },
  exerciseIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  exerciseLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.white },
  exerciseSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },

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
  autoCalcRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingHorizontal: 2 },
  autoCalcText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.orange },
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

  // Hike detail sheet
  hdOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  hdSheet: { backgroundColor: T.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 20, borderWidth: 1, borderColor: T.green + "25" },
  hdHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: T.border, alignSelf: "center", marginBottom: 20 },
  hdHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  hdTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.white },
  hdDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },
  hdCloseBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  hdStatRow: { flexDirection: "row", backgroundColor: T.surface, borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 20, marginBottom: 16 },
  hdStatCell: { flex: 1, alignItems: "center", gap: 8 },
  hdStatVal: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.white },
  hdStatLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  hdStatDivider: { width: 1, backgroundColor: T.border, marginHorizontal: 4 },
  hdNotesBox: { backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 14 },
  hdNotesText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 19 },
});

const calSt = StyleSheet.create({
  wrap: { backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.cardBorder, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10, marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  navBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  monthLabel: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white },
  dayLabelsRow: { flexDirection: "row", marginBottom: 4 },
  dayLabel: { flex: 1, textAlign: "center", fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  row: { flexDirection: "row", marginBottom: 2 },
  cell: { flex: 1, alignItems: "center", paddingVertical: 2, minHeight: 38, position: "relative" },
  planBg: { position: "absolute", top: 0, left: 1, right: 1, bottom: 0, backgroundColor: T.blue + "18", borderRadius: 8 },
  dayCircle: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  todayCircle: { backgroundColor: T.green },
  dayNum: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.text },
  dayNumToday: { fontFamily: "Inter_700Bold", color: T.bg },
  dotGreen: { width: 5, height: 5, borderRadius: 3, backgroundColor: T.green, marginTop: 1 },
  dotBlue: { width: 5, height: 5, borderRadius: 3, backgroundColor: T.blue, marginTop: 1 },
  legend: { flexDirection: "row", gap: 14, justifyContent: "flex-end", marginTop: 6, paddingRight: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendText: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted },
});
