/**
 * MissionSection — "This week's mission" and the "Up next" rail.
 *
 * Composition from the prototype: a wide mission panel with a visual block on
 * the left and the action on the right, then a horizontally scrolling rail of
 * the sessions queued behind it.
 *
 * DATA is the Training Plan's. The mission is the plan's first incomplete
 * session and the rail is what follows it, both read through
 * `utils/basecampPresentation.ts` from the same completion map the plan screen
 * writes — so Basecamp's idea of "next" cannot drift from the plan's. Titles,
 * durations, target ascent and week numbers are the plan's own. Nothing is
 * generated here.
 *
 * The prototype gives every session its own photograph. Production has no
 * per-session photography and this task does not create artwork, so each
 * session gets a typed gradient block carrying its own icon instead. The shape,
 * rhythm and hierarchy of the approved composition are unchanged.
 */
import React from "react";
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Activity, ChevronRight, Clock, Mountain, TrendingUp } from "lucide-react-native";
import { BASECAMP, HIT, MOTION } from "@/constants/tokens";
import { BasecampPanel, BasecampSectionHeader, FactDivider } from "@/components/basecamp/primitives";
import { sessionFacts, type QueuedSession } from "@/utils/basecampPresentation";

/** Visual identity per plan session type. Icons only — no invented copy. */
const TYPE_VISUAL: Record<string, { Icon: typeof Activity; tint: readonly [string, string] }> = {
  cardio: { Icon: Activity, tint: ["rgba(36,239,164,0.20)", "rgba(10,17,19,0.28)"] },
  hill: { Icon: TrendingUp, tint: ["rgba(36,239,164,0.26)", "rgba(10,17,19,0.30)"] },
  bigDay: { Icon: Mountain, tint: ["rgba(36,239,164,0.32)", "rgba(10,17,19,0.34)"] },
};
const DEFAULT_VISUAL = TYPE_VISUAL.cardio;

function visualFor(type: string | null) {
  return (type && TYPE_VISUAL[type]) || DEFAULT_VISUAL;
}

/* ── Mission ───────────────────────────────────────────────────────────── */

export interface MissionCardProps {
  session: QueuedSession;
  /** The plan's phase for this week, when it has one. */
  phase?: string | null;
  onStart: () => void;
  onOpen: () => void;
}

export function MissionCard({ session, phase, onStart, onOpen }: MissionCardProps) {
  const { Icon, tint } = visualFor(session.type);
  const facts = sessionFacts(session);
  /* The visual block is the first thing to give way: on a narrow screen the
     title and the action need the room more than the illustration does. */
  const { width } = useWindowDimensions();
  const visualWidth = width < 360 ? 68 : width < 400 ? 82 : 92;

  return (
    <BasecampPanel
      onPress={onOpen}
      accessibilityLabel={`This week's mission: ${session.title}`}
      accessibilityHint="Opens the session detail"
      testID="basecamp-mission"
    >
      <View style={styles.missionRow}>
        <View style={[styles.missionVisual, { width: visualWidth }]} accessible={false}>
          <LinearGradient
            colors={tint}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Icon size={26} color={BASECAMP.accent} strokeWidth={1.6} />
        </View>

        <View style={styles.missionBody}>
          <View style={styles.missionTop}>
            <View style={styles.missionHeading}>
              <Text style={styles.missionEyebrow} numberOfLines={1}>
                {phase ? `WEEK ${session.weekNumber} · ${phase.toUpperCase()}` : `WEEK ${session.weekNumber}`}
              </Text>
              <Text style={styles.missionTitle} numberOfLines={2}>{session.title}</Text>
            </View>

            <TouchableOpacity
              onPress={onStart}
              style={styles.startButton}
              activeOpacity={0.85}
              hitSlop={HIT.slop}
              accessibilityRole="button"
              accessibilityLabel={`Start ${session.title}`}
            >
              <Text style={styles.startText}>START</Text>
              <ChevronRight size={13} color={BASECAMP.accentInk} />
            </TouchableOpacity>
          </View>

          {facts.length > 0 && (
            <View style={styles.factRow}>
              {facts.map((f, i) => (
                <React.Fragment key={f}>
                  {i > 0 && <FactDivider />}
                  <Text style={styles.factText} numberOfLines={1}>{f}</Text>
                </React.Fragment>
              ))}
            </View>
          )}

          {session.description && (
            <Text style={styles.missionDesc} numberOfLines={2}>{session.description}</Text>
          )}
        </View>
      </View>
    </BasecampPanel>
  );
}

/** Shown in place of the mission once the plan has nothing outstanding. */
export function MissionComplete({ onOpenPlan }: { onOpenPlan: () => void }) {
  return (
    <BasecampPanel onPress={onOpenPlan} accessibilityLabel="Training plan" testID="basecamp-mission-clear">
      <View style={styles.clearWrap}>
        <Text style={styles.clearTitle}>Nothing outstanding</Text>
        <Text style={styles.clearBody}>
          Every prescribed session in your plan is logged. Open the plan to look further ahead.
        </Text>
      </View>
    </BasecampPanel>
  );
}

/* ── Up next ───────────────────────────────────────────────────────────── */

export function UpNextRail({
  sessions, onOpenSession, onOpenPlan,
}: {
  sessions: QueuedSession[];
  onOpenSession: (s: QueuedSession) => void;
  onOpenPlan: () => void;
}) {
  const reduced = useReducedMotion();
  if (sessions.length === 0) return null;

  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(MOTION.stagger * 2).duration(MOTION.enter)}
      style={styles.railSection}
    >
      <BasecampSectionHeader
        title="Up next"
        action="View full plan"
        onAction={onOpenPlan}
        style={{ paddingHorizontal: BASECAMP.gutter }}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railContent}
        style={styles.rail}
      >
        {sessions.map(s => (
          <SessionCard key={s.key} session={s} onPress={() => onOpenSession(s)} />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

function SessionCard({ session, onPress }: { session: QueuedSession; onPress: () => void }) {
  const { Icon, tint } = visualFor(session.type);
  const elevation = session.elevationM !== null ? `${session.elevationM.toLocaleString()} m gain` : null;

  return (
    <BasecampPanel
      radius={15}
      style={styles.card}
      onPress={onPress}
      accessibilityLabel={`${session.weekLabel}: ${session.title}`}
      accessibilityHint="Opens the session detail"
    >
      <View style={styles.cardVisual} accessible={false}>
        <LinearGradient colors={tint} start={{ x: 0.1, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Icon size={20} color={BASECAMP.accent} strokeWidth={1.6} />
        <View style={styles.cardChev}>
          <ChevronRight size={11} color={BASECAMP.textStrong} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardWeek} numberOfLines={1}>{session.weekLabel}</Text>
        <Text style={styles.cardTitle} numberOfLines={2}>{session.title}</Text>
        {elevation && <Text style={styles.cardDetail} numberOfLines={1}>{elevation}</Text>}
        {session.duration && (
          <View style={styles.cardMeta}>
            <Clock size={12} color={BASECAMP.textDim} />
            <Text style={styles.cardMetaText} numberOfLines={1}>{session.duration}</Text>
          </View>
        )}
      </View>
    </BasecampPanel>
  );
}

const styles = StyleSheet.create({
  missionRow: { flexDirection: "row", alignItems: "stretch" },
  missionVisual: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(8,13,15,0.5)",
  },
  missionBody: { flex: 1, minWidth: 0, padding: 13 },
  missionTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  missionHeading: { flex: 1, minWidth: 0 },
  missionEyebrow: {
    fontSize: 9.5, lineHeight: 12, fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.8, color: BASECAMP.textMuted,
  },
  missionTitle: {
    fontSize: 20, lineHeight: 24, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: -0.5, marginTop: 4,
  },
  startButton: {
    flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 4,
    height: 38, paddingLeft: 13, paddingRight: 9, borderRadius: 11,
    backgroundColor: BASECAMP.accent,
  },
  startText: {
    fontSize: 10.5, lineHeight: 13, fontFamily: "Inter_700Bold",
    letterSpacing: 0.6, color: BASECAMP.accentInk,
  },
  factRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 8, flexWrap: "wrap" },
  factText: {
    fontSize: 12.5, lineHeight: 16, fontFamily: "Inter_500Medium", color: BASECAMP.textStrong,
  },
  missionDesc: {
    fontSize: 11.5, lineHeight: 16, fontFamily: "Inter_400Regular",
    color: BASECAMP.textDim, marginTop: 8,
  },

  clearWrap: { padding: 16 },
  clearTitle: { fontSize: 16, lineHeight: 20, fontFamily: "Inter_700Bold", color: BASECAMP.text },
  clearBody: {
    fontSize: 12.5, lineHeight: 18, fontFamily: "Inter_400Regular",
    color: BASECAMP.textDim, marginTop: 5,
  },

  railSection: { marginTop: 20 },
  rail: { marginTop: 10 },
  railContent: { paddingHorizontal: BASECAMP.gutter, gap: 8, paddingBottom: 2 },
  card: { width: 136 },
  cardVisual: {
    height: 74, alignItems: "center", justifyContent: "center", overflow: "hidden",
    backgroundColor: "rgba(8,13,15,0.5)",
  },
  cardChev: {
    position: "absolute", top: 7, right: 7,
    width: 21, height: 21, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1, borderColor: BASECAMP.glassBorder,
  },
  cardBody: { padding: 11, paddingTop: 9 },
  cardWeek: { fontSize: 10, lineHeight: 13, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  cardTitle: {
    fontSize: 14.5, lineHeight: 18, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: -0.3, marginTop: 4,
  },
  cardDetail: { fontSize: 11, lineHeight: 14, fontFamily: "Inter_500Medium", color: BASECAMP.textStrong, marginTop: 3 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 },
  cardMetaText: { fontSize: 10.5, lineHeight: 13, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
});
