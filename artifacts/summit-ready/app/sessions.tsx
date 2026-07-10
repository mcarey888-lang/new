import type { LucideIcon } from "lucide-react-native";
import {
  Activity,
  ArrowLeft,
  Check,
  CheckCircle,
  Clock,
  Map,
  Plus,
  TrendingUp,
  Trash2,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import { router } from "expo-router";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type Session, type ExploreHike, useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";
import { logWorkoutCompleted } from "@/lib/analytics";

// ── Types ────────────────────────────────────────────────────────────────────
type FilterTab = "all" | "training" | "hikes";
type LogItem =
  | { kind: "session"; data: Session }
  | { kind: "hike"; data: ExploreHike };

// ── Helpers ──────────────────────────────────────────────────────────────────
const SESSION_TYPES: { value: "cardio" | "hill" | "bigDay"; label: string; icon: LucideIcon; color: string }[] = [
  { value: "cardio", label: "Cardio",       icon: CheckCircle, color: T.green  },
  { value: "hill",   label: "Hill Repeats", icon: TrendingUp,  color: T.blue   },
  { value: "bigDay", label: "Big Day",      icon: Map,         color: T.orange },
];

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ── Session card ─────────────────────────────────────────────────────────────
function SessionCard({
  session, index, onDelete, onToggle,
}: { session: Session; index: number; onDelete: () => void; onToggle: () => void }) {
  const t = SESSION_TYPES.find(x => x.value === session.type) ?? SESSION_TYPES[0];
  const TIcon = t.icon;
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 12) * 40).duration(350)}>
      <View style={s.card}>
        <LinearGradient colors={[t.color + "0A", "transparent"]} style={StyleSheet.absoluteFill} />
        <View style={s.cardTop}>
          <View style={[s.cardIcon, { backgroundColor: t.color + "18" }]}>
            <TIcon size={16} color={t.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{session.hillName || t.label}</Text>
            <Text style={s.cardSub}>
              {new Date(session.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
              {session.reps ? ` · ${session.reps} rep${session.reps !== 1 ? "s" : ""}` : ""}
              {" · Week "}{session.weekNumber + 1}
            </Text>
          </View>
          <TouchableOpacity onPress={onDelete} style={s.delBtn}>
            <Trash2 size={14} color={T.textDim} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onToggle(); }}
          activeOpacity={0.8}
          style={session.completed ? s.completedPill : s.markCompletePill}
        >
          <Check size={11} color={session.completed ? T.green : T.textDim} />
          <Text style={session.completed ? s.completedPillText : s.markCompleteText}>
            {session.completed ? "Completed" : "Mark as complete"}
          </Text>
        </TouchableOpacity>
        <View style={s.cardStats}>
          {([
            { icon: TrendingUp, val: `${session.elevationGain}m`, color: T.orange },
            { icon: Map,        val: `${session.distance}km`,     color: T.blue   },
            { icon: Clock,      val: fmtDuration(session.duration), color: T.textMuted },
          ] as { icon: LucideIcon; val: string; color: string }[]).map((st, i) => {
            const SIcon = st.icon;
            return (
              <View key={i} style={s.stat}>
                <SIcon size={11} color={st.color} />
                <Text style={[s.statText, { color: st.color }]}>{st.val}</Text>
              </View>
            );
          })}
          <View style={s.effortDots}>
            {[1, 2, 3, 4, 5].map(n => (
              <View key={n} style={[s.effortPip, { backgroundColor: n <= session.effort ? T.orange : T.border }]} />
            ))}
          </View>
        </View>
        {!!session.notes && (
          <Text style={s.cardNotes} numberOfLines={2}>{session.notes}</Text>
        )}
      </View>
    </Animated.View>
  );
}

// ── Hike card ────────────────────────────────────────────────────────────────
function HikeCard({
  hike, index, onDelete, onAddToPlan, addedToPlan, hasPlan,
}: {
  hike: ExploreHike;
  index: number;
  onDelete: () => void;
  onAddToPlan?: () => void;
  addedToPlan?: boolean;
  hasPlan?: boolean;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 12) * 40).duration(350)}>
      <View style={s.card}>
        <LinearGradient colors={[T.green + "0A", "transparent"]} style={StyleSheet.absoluteFill} />
        <View style={s.cardTop}>
          <View style={[s.cardIcon, { backgroundColor: T.green + "18" }]}>
            <Map size={16} color={T.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{hike.name}</Text>
            <Text style={s.cardSub}>
              {new Date(hike.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
              {" · Trail / Hike"}
            </Text>
          </View>
          <TouchableOpacity onPress={onDelete} style={s.delBtn}>
            <Trash2 size={14} color={T.textDim} />
          </TouchableOpacity>
        </View>
        <View style={s.cardStats}>
          {([
            { icon: TrendingUp, val: `${hike.elevationGain}m`,         color: T.orange   },
            { icon: Map,        val: `${hike.distance.toFixed(2)}km`,   color: T.blue     },
            { icon: Clock,      val: fmtDuration(hike.timeTaken),       color: T.textMuted },
          ] as { icon: LucideIcon; val: string; color: string }[]).map((st, i) => {
            const SIcon = st.icon;
            return (
              <View key={i} style={s.stat}>
                <SIcon size={11} color={st.color} />
                <Text style={[s.statText, { color: st.color }]}>{st.val}</Text>
              </View>
            );
          })}
        </View>
        {!!hike.notes && <Text style={s.cardNotes} numberOfLines={2}>{hike.notes}</Text>}
        {hasPlan && (
          addedToPlan ? (
            <View style={s.addedPill}>
              <Check size={11} color={T.green} />
              <Text style={s.addedText}>Added to training plan</Text>
            </View>
          ) : (
            <TouchableOpacity style={s.addToPlanBtn} onPress={onAddToPlan} activeOpacity={0.8}>
              <Plus size={12} color={T.green} />
              <Text style={s.addToPlanText}>Add to training plan</Text>
            </TouchableOpacity>
          )
        )}
      </View>
    </Animated.View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function SessionsScreen() {
  const insets = useSafeAreaInsets();
  const { sessions, exploreHikes, deleteSession, updateSession, deleteExploreHike, addSession, trainingPlan } = useApp();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const hasPlan = !!(trainingPlan && trainingPlan.length > 0);

  async function handleAddToPlan(hike: ExploreHike) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAddedIds(prev => new Set(prev).add(hike.id));
    const wi = trainingPlan?.findIndex(w => w.isCurrentWeek) ?? -1;
    const weekNum = wi >= 0 ? wi : 0;
    await addSession({
      date: hike.date,
      type: "cardio",
      distance: hike.distance,
      elevationGain: hike.elevationGain,
      duration: hike.timeTaken,
      effort: 3,
      notes: `From hike log: ${hike.name}.`,
      completed: true,
      weekNumber: weekNum,
      hillName: hike.name,
    });
  }

  const allItems = useMemo<LogItem[]>(() => {
    const base: LogItem[] = [
      ...sessions.map(d => ({ kind: "session" as const, data: d })),
      ...exploreHikes.map(d => ({ kind: "hike" as const, data: d })),
    ];
    return base.sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());
  }, [sessions, exploreHikes]);

  const visible = useMemo(() => {
    if (filter === "training") return allItems.filter(i => i.kind === "session");
    if (filter === "hikes")    return allItems.filter(i => i.kind === "hike");
    return allItems;
  }, [allItems, filter]);

  const totalElev = useMemo(() =>
    sessions.filter(s => s.completed).reduce((a, s) => a + s.elevationGain, 0) +
    exploreHikes.reduce((a, h) => a + h.elevationGain, 0),
  [sessions, exploreHikes]);

  const totalDist = useMemo(() =>
    sessions.filter(s => s.completed).reduce((a, s) => a + s.distance, 0) +
    exploreHikes.reduce((a, h) => a + h.distance, 0),
  [sessions, exploreHikes]);

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all",      label: "All",      count: allItems.length },
    { key: "training", label: "Training", count: sessions.length },
    { key: "hikes",    label: "Hikes",    count: exploreHikes.length },
  ];

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          {
            paddingTop: Platform.OS === "web" ? 56 : insets.top + 16,
            paddingBottom: Platform.OS === "web" ? 110 : insets.bottom + 110,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(350)} style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ArrowLeft size={22} color={T.text} />
          </TouchableOpacity>
          <Text style={s.title}>Sessions</Text>
          <View style={{ width: 22 }} />
        </Animated.View>

        {/* Summary strip */}
        <Animated.View entering={FadeInDown.delay(40).duration(350)} style={s.strip}>
          <View style={s.stripItem}>
            <TrendingUp size={17} color={T.orange} />
            <Text style={s.stripVal}>{totalElev.toLocaleString()}m</Text>
            <Text style={s.stripLbl}>Total elevation</Text>
          </View>
          <View style={s.stripDiv} />
          <View style={s.stripItem}>
            <Map size={17} color={T.blue} />
            <Text style={s.stripVal}>{totalDist.toFixed(1)}km</Text>
            <Text style={s.stripLbl}>Distance</Text>
          </View>
          <View style={s.stripDiv} />
          <View style={s.stripItem}>
            <CheckCircle size={17} color={T.green} />
            <Text style={s.stripVal}>{allItems.length}</Text>
            <Text style={s.stripLbl}>Sessions</Text>
          </View>
        </Animated.View>

        {/* Filter tabs */}
        <Animated.View entering={FadeInDown.delay(70).duration(350)} style={s.tabs}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[s.tab, filter === tab.key && s.tabActive]}
              onPress={() => setFilter(tab.key)}
              activeOpacity={0.75}
            >
              <Text style={[s.tabText, filter === tab.key && s.tabTextActive]}>
                {tab.label}
              </Text>
              {tab.count > 0 && (
                <View style={[s.tabBadge, filter === tab.key && s.tabBadgeActive]}>
                  <Text style={[s.tabBadgeText, filter === tab.key && s.tabBadgeTextActive]}>
                    {tab.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Session list */}
        {visible.length === 0 ? (
          <View style={s.empty}>
            <View style={[s.emptyIcon, { backgroundColor: T.blueDim }]}>
              <Activity size={30} color={T.blue} />
            </View>
            <Text style={s.emptyTitle}>No sessions yet</Text>
            <Text style={s.emptySub}>
              {filter === "training"
                ? "Log a training session from the Session Log tab"
                : filter === "hikes"
                  ? "Track a hike to see it here"
                  : "Log your first training session or hike"}
            </Text>
          </View>
        ) : (
          visible.map((item, i) =>
            item.kind === "session" ? (
              <SessionCard
                key={item.data.id}
                session={item.data}
                index={i}
                onDelete={() => deleteSession(item.data.id)}
                onToggle={() => {
                  const willComplete = !item.data.completed;
                  updateSession(item.data.id, { completed: willComplete });
                  if (willComplete) {
                    void logWorkoutCompleted({ workout_type: item.data.type, week_number: item.data.weekNumber });
                  }
                }}
              />
            ) : (
              <HikeCard
                key={item.data.id}
                hike={item.data}
                index={i}
                onDelete={() => deleteExploreHike(item.data.id)}
                hasPlan={hasPlan}
                addedToPlan={addedIds.has(item.data.id)}
                onAddToPlan={() => handleAddToPlan(item.data)}
              />
            )
          )
        )}
      </ScrollView>
    </LinearGradient>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  scroll: { paddingHorizontal: 18, gap: 0 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 20,
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.text },

  strip: {
    flexDirection: "row",
    backgroundColor: T.card, borderRadius: 18,
    borderWidth: 1, borderColor: T.cardBorder,
    paddingVertical: 16, marginBottom: 14,
  },
  stripItem: { flex: 1, alignItems: "center", gap: 4 },
  stripVal:  { fontSize: 18, fontFamily: "Inter_700Bold", color: T.text },
  stripLbl:  { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  stripDiv:  { width: 1, backgroundColor: T.border, marginVertical: 4 },

  tabs: {
    flexDirection: "row", gap: 8, marginBottom: 16,
  },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
    backgroundColor: T.surface, borderColor: T.border,
  },
  tabActive: {
    backgroundColor: T.green + "18", borderColor: T.green + "60",
  },
  tabText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.textMuted },
  tabTextActive: { color: T.green },
  tabBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: T.border,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabBadgeActive: { backgroundColor: T.green + "30" },
  tabBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.textMuted },
  tabBadgeTextActive: { color: T.green },

  card: {
    backgroundColor: T.card, borderRadius: 18,
    borderWidth: 1, borderColor: T.cardBorder,
    padding: 14, marginBottom: 10, overflow: "hidden", gap: 10,
  },
  cardTop:   { flexDirection: "row", alignItems: "center", gap: 10 },
  cardIcon:  { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.text },
  cardSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  cardStats: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardNotes: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 17 },

  stat:     { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  effortDots: { flexDirection: "row", gap: 3, marginLeft: "auto" as any },
  effortPip:  { width: 9, height: 9, borderRadius: 3 },

  completedPill: {
    flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start",
    backgroundColor: T.green + "18", borderRadius: 9,
    borderWidth: 1, borderColor: T.green + "40",
    paddingHorizontal: 9, paddingVertical: 5, marginBottom: 2,
  },
  completedPillText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.green },
  markCompletePill: {
    flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start",
    backgroundColor: T.surface, borderRadius: 9,
    borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 9, paddingVertical: 5, marginBottom: 2,
  },
  markCompleteText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim },
  delBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },

  addToPlanBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start",
    backgroundColor: T.green + "18", borderRadius: 10,
    borderWidth: 1, borderColor: T.green + "40",
    paddingHorizontal: 10, paddingVertical: 6,
  },
  addToPlanText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.green },
  addedPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    alignSelf: "flex-start",
    backgroundColor: T.green + "10", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  addedText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.green },

  empty:      { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyIcon:  { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: T.text, marginTop: 4 },
  emptySub:   { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", paddingHorizontal: 24 },
});
