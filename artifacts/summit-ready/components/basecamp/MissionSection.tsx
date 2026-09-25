/**
 * MissionSection — "This week's mission" and the "Up next" rail.
 *
 * Composition from the prototype: a wide mission panel with a square visual
 * flush to the left and the action on the right, then a horizontally scrolling
 * rail of the sessions queued behind it.
 *
 * DATA is the Training Plan's. The mission is the plan's first incomplete
 * session and the rail is what follows it, both read through
 * `utils/basecampPresentation.ts` from the same completion map the plan screen
 * writes — so Basecamp's idea of "next" cannot drift from the plan's. Titles,
 * durations, target ascent and week numbers are the plan's own. Nothing is
 * generated here.
 *
 * Mountain sessions use their assigned hill or objective photography. Exercise
 * sessions use the right-half crop of their selected exercise-library artwork.
 */
import React, { useEffect, useState } from "react";
import {
  Image, type ImageSourcePropType, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Activity, ChevronRight, Clock, Mountain, TrendingUp } from "lucide-react-native";
import { BASECAMP, HIT, MOTION } from "@/constants/tokens";
import { SRPanel, SRSectionHeader, SRFactDivider } from "@/components/ui";
import { sessionFacts, type QueuedSession } from "@/utils/basecampPresentation";
import { exerciseCardArtwork } from "@/utils/exerciseArtwork";

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

/**
 * The photograph for a session block, with the typed gradient behind it.
 *
 * The gradient is always drawn, so a slow or failed image resolves into the
 * designed block rather than a grey rectangle. `scrim` darkens the edge the
 * text sits against, which is how the approved cards keep their titles legible
 * over photography.
 */
function SessionVisual({
  uri, source, type, iconSize, scrim, children, style,
}: {
  uri: string | null;
  source?: ImageSourcePropType;
  type: string | null;
  iconSize: number;
  scrim: "right" | "bottom" | "none";
  children?: React.ReactNode;
  style?: object;
}) {
  const { Icon, tint } = visualFor(type);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri, source]);
  const photoSource = source ?? (uri ? { uri } : null);
  const showPhoto = !!photoSource && !failed;

  return (
    <View style={[styles.visual, style]} accessible={false}>
      <LinearGradient
        colors={tint}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {showPhoto ? (
        <Image
          source={photoSource!}
          style={styles.visualImage}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessible={false}
        />
      ) : (
        <Icon size={iconSize} color={BASECAMP.accent} strokeWidth={1.6} />
      )}
      {showPhoto && scrim !== "none" && (
        <LinearGradient
          colors={scrim === "right"
            ? ["rgba(5,9,11,0)", "rgba(12,20,20,0.92)"]
            : ["rgba(5,9,11,0)", "rgba(10,17,19,0.85)"]}
          locations={scrim === "right" ? [0.55, 1] : [0.45, 1]}
          start={scrim === "right" ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }}
          end={scrim === "right" ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {children}
    </View>
  );
}

/* ── Mission ───────────────────────────────────────────────────────────── */

export interface MissionCardProps {
  session: QueuedSession;
  /** The plan's phase for this week, when it has one. */
  phase?: string | null;
  /** The assigned hill or objective, used for non-exercise sessions. */
  imageUri?: string | null;
  onStart: () => void;
  onOpen: () => void;
}

export function MissionCard({ session, phase, imageUri, onStart, onOpen }: MissionCardProps) {
  const facts = sessionFacts(session);
  const artwork = exerciseCardArtwork({ ...session, label: session.title });
  return (
    <SRPanel
      onPress={onOpen}
      accessibilityLabel={`This week's mission: ${session.title}`}
      accessibilityHint="Opens the session detail"
      testID="basecamp-mission"
    >
      <View style={styles.missionRow}>
        <SessionVisual
          uri={artwork ? null : imageUri ?? null}
          source={artwork ?? undefined}
          type={session.type}
          iconSize={20}
          scrim="none"
          style={styles.missionVisual}
        />

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
                  {i > 0 && <SRFactDivider />}
                  <Text style={styles.factText} numberOfLines={1}>{f}</Text>
                </React.Fragment>
              ))}
            </View>
          )}

          {session.description && (
            <Text style={styles.missionDesc} numberOfLines={1}>{session.description}</Text>
          )}
        </View>
      </View>
    </SRPanel>
  );
}

/** Shown in place of the mission once the plan has nothing outstanding. */
export function MissionComplete({ onOpenPlan }: { onOpenPlan: () => void }) {
  return (
    <SRPanel onPress={onOpenPlan} accessibilityLabel="Training plan" testID="basecamp-mission-clear">
      <View style={styles.clearWrap}>
        <Text style={styles.clearTitle}>Nothing outstanding</Text>
        <Text style={styles.clearBody}>
          Every prescribed session in your plan is logged. Open the plan to look further ahead.
        </Text>
      </View>
    </SRPanel>
  );
}

/* ── Up next ───────────────────────────────────────────────────────────── */

export function UpNextRail({
  sessions, onOpenSession, onOpenPlan, imageUriFor,
}: {
  sessions: QueuedSession[];
  onOpenSession: (s: QueuedSession) => void;
  onOpenPlan: () => void;
  /** The photograph for a session, from its assigned hill or the objective. */
  imageUriFor?: (s: QueuedSession) => string | null;
}) {
  const reduced = useReducedMotion();
  if (sessions.length === 0) return null;

  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(MOTION.stagger * 2).duration(MOTION.enter)}
      style={styles.railSection}
    >
      <SRSectionHeader
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
          <SessionCard
            key={s.key}
            session={s}
            imageUri={imageUriFor?.(s) ?? null}
            onPress={() => onOpenSession(s)}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

function SessionCard({
  session, imageUri, onPress,
}: { session: QueuedSession; imageUri: string | null; onPress: () => void }) {
  const elevation = session.elevationM !== null ? `${session.elevationM.toLocaleString()} m gain` : null;
  const artwork = exerciseCardArtwork({ ...session, label: session.title });

  return (
    <SRPanel
      radius={7.5}
      style={styles.card}
      onPress={onPress}
      accessibilityLabel={`${session.weekLabel}: ${session.title}`}
      accessibilityHint="Opens the session detail"
    >
      <View style={styles.cardRow}>
        <SessionVisual
          uri={artwork ? null : imageUri}
          source={artwork ?? undefined}
          type={session.type}
          iconSize={20}
          scrim="none"
          style={styles.cardVisual}
        >
          <View style={styles.cardChev}>
            <ChevronRight size={11} color={BASECAMP.textStrong} />
          </View>
        </SessionVisual>
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
      </View>
    </SRPanel>
  );
}

const styles = StyleSheet.create({
  missionRow: { flexDirection: "row", alignItems: "stretch" },
  visual: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(8,13,15,0.5)",
  },
  visualImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  missionVisual: { width: 88, height: 88 },
  missionBody: { flex: 1, minWidth: 0, paddingTop: 9, paddingBottom: 9, paddingLeft: 10, paddingRight: 9 },
  missionTop: { flexDirection: "row", alignItems: "flex-start", gap: 5 },
  missionHeading: { flex: 1, minWidth: 0 },
  missionEyebrow: {
    fontSize: 9.5, lineHeight: 12, fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.8, color: BASECAMP.textMuted,
  },
  missionTitle: {
    fontSize: 16, lineHeight: 19, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: -0.5, marginTop: 4,
  },
  startButton: {
    flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 4,
    minHeight: 29, paddingLeft: 9, paddingRight: 6, borderRadius: 5.5,
    backgroundColor: BASECAMP.accent,
  },
  startText: {
    fontSize: 9, lineHeight: 12, fontFamily: "Inter_700Bold",
    letterSpacing: 0.6, color: BASECAMP.accentInk,
  },
  factRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, flexWrap: "wrap" },
  factText: {
    fontSize: 10, lineHeight: 13, fontFamily: "Inter_500Medium", color: BASECAMP.textStrong,
  },
  missionDesc: {
    fontSize: 11.5, lineHeight: 16, fontFamily: "Inter_400Regular",
    color: BASECAMP.textDim, marginTop: 5,
  },

  clearWrap: { padding: 16 },
  clearTitle: { fontSize: 16, lineHeight: 20, fontFamily: "Inter_700Bold", color: BASECAMP.text },
  clearBody: {
    fontSize: 12.5, lineHeight: 18, fontFamily: "Inter_400Regular",
    color: BASECAMP.textDim, marginTop: 5,
  },

  railSection: { marginTop: 10 },
  rail: { marginTop: 5 },
  railContent: { paddingHorizontal: BASECAMP.gutter, gap: 8, paddingBottom: 2 },
  card: { width: 224 },
  cardRow: { flexDirection: "row", alignItems: "stretch" },
  cardVisual: { width: 82, height: 82 },
  cardChev: {
    position: "absolute", top: 7, right: 7,
    width: 21, height: 21, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1, borderColor: BASECAMP.glassBorder,
  },
  cardBody: { flex: 1, minWidth: 0, padding: 7, paddingTop: 6 },
  cardWeek: { fontSize: 10, lineHeight: 13, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  cardTitle: {
    fontSize: 13, lineHeight: 16, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: -0.3, marginTop: 4,
  },
  cardDetail: { fontSize: 11, lineHeight: 14, fontFamily: "Inter_500Medium", color: BASECAMP.textStrong, marginTop: 3 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 },
  cardMetaText: { fontSize: 10.5, lineHeight: 13, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
});
