import {
  Activity, Calendar, Check, CheckCircle, ChevronRight, Flag,
  Globe, Minus, Mountain, Plus, TrendingUp, Zap,
} from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  type ImageSourcePropType,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp, type NearbyHill } from "@/context/AppContext";
import { HillPickerModal } from "@/components/HillPickerModal";
import { ExercisePickerModal, type GymExercise } from "@/components/ExercisePickerModal";
import { DayPickerModal, type OccupiedDay } from "@/components/DayPickerModal";
import { T, PHASE_COLOR } from "@/constants/theme";
import { BASECAMP, HIT } from "@/constants/tokens";
import {
  SRButton, SREyebrow, SRFactDivider, SRHeroFrame, SRPanel, SRScreenHeader,
  SREmptyState, SRSectionHeader, SRStatusPill, SRSubPanel,
} from "@/components/ui";
import { sessionPurpose } from "@/utils/sessionPurpose";
import { assignSessionsToDays, DAY_FULL } from "@/utils/dayAssignment";
import { parseDurationMidpoint } from "@/utils/planGenerator";
import { useSubscription } from "@/lib/revenuecat";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

/* One figure from the plan, with its label. Presentation only. */
function Stat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <View style={s.statCell}>
      <Text style={[s.statVal, tone ? { color: tone } : null]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={s.statLbl} numberOfLines={2}>{label}</Text>
    </View>
  );
}

/* A setup row: what is chosen, and the control that changes it. */
function SetupRow({
  icon, title, detail, action, onPress, muted = false,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  action: string;
  onPress: () => void;
  muted?: boolean;
}) {
  return (
    <SRSubPanel onPress={onPress} accessibilityLabel={`${title}. ${action}.`}>
      <View style={s.setupRow}>
        {icon}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.setupTitle, muted && { color: BASECAMP.textMuted }]} numberOfLines={1}>{title}</Text>
          <Text style={s.setupDetail} numberOfLines={2}>{detail}</Text>
        </View>
        <Text style={s.setupAction} numberOfLines={1}>{action}</Text>
        <ChevronRight size={13} color={BASECAMP.textDim} />
      </View>
    </SRSubPanel>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function typeIcon(type: string) {
  if (type === "hill")   return <Mountain size={16} color={T.green} />;
  if (type === "bigDay") return <TrendingUp size={16} color={T.orange} />;
  return <Activity size={16} color={T.blue} />;
}

function typeLabel(type: string) {
  if (type === "hill")   return "Hill Session";
  if (type === "bigDay") return "Big Day";
  return "Cardio";
}

function typeColor(type: string) {
  if (type === "hill")   return T.green;
  if (type === "bigDay") return T.orange;
  return T.blue;
}

// ── Inline tracker components ─────────────────────────────────────────────────

function RepLog({
  sessionKey, targetReps, elevPerRep, sessionReps, isDone, onSet,
}: {
  sessionKey: string; targetReps: number; elevPerRep: number;
  sessionReps: Record<string, number>; isDone: boolean;
  onSet: (key: string, val: number) => void;
}) {
  const logged = sessionReps[sessionKey];
  const display = logged ?? 0;
  const hit = logged !== undefined && logged >= targetReps;
  const loggedElev = logged !== undefined && elevPerRep > 0 ? logged * elevPerRep : null;
  return (
    <View style={trk.box}>
      <View style={trk.metaRow}>
        <Flag size={12} color={BASECAMP.accent} />
        <Text style={trk.metaText}>Target: <Text style={trk.metaVal}>{targetReps} reps</Text></Text>
        {elevPerRep > 0 && <Text style={trk.metaDim}>= {targetReps * elevPerRep}m gain</Text>}
      </View>
      <View style={trk.logRow}>
        <Text style={trk.logLabel}>I did:</Text>
        <TouchableOpacity
          onPress={() => onSet(sessionKey, Math.max(0, display - 1))}
          style={[trk.btn, (display <= 0 || isDone) && trk.btnDim]}
          disabled={display <= 0 || isDone}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Minus size={14} color={display <= 0 || isDone ? BASECAMP.textFaint : BASECAMP.text} />
        </TouchableOpacity>
        <Text style={[trk.val, hit && trk.valGreen, logged !== undefined && !hit && trk.valWhite]}>
          {logged !== undefined ? display : "–"}
        </Text>
        <TouchableOpacity
          onPress={() => onSet(sessionKey, display + 1)}
          style={[trk.btn, isDone && trk.btnDim]}
          disabled={isDone}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Plus size={14} color={isDone ? BASECAMP.textFaint : BASECAMP.text} />
        </TouchableOpacity>
        {loggedElev !== null && (
          <Text style={[trk.logElev, hit && { color: BASECAMP.accent }]}>= {loggedElev}m</Text>
        )}
        {hit && (
          <View style={trk.hitBadge}>
            <Check size={10} color={BASECAMP.accent} />
            <Text style={trk.hitText}>Target hit!</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function MeterLog({
  sessionKey, target, unit, step, sessionReps, isDone, onSet,
}: {
  sessionKey: string; target: number; unit: string; step: number;
  sessionReps: Record<string, number>; isDone: boolean;
  onSet: (key: string, val: number) => void;
}) {
  const logged = sessionReps[sessionKey];
  const display = logged ?? 0;
  const hit = logged !== undefined && display >= target;
  return (
    <View style={trk.box}>
      <View style={trk.metaRow}>
        <Flag size={12} color={BASECAMP.accent} />
        <Text style={trk.metaText}>Target: <Text style={trk.metaVal}>{target} {unit}</Text></Text>
      </View>
      <View style={trk.logRow}>
        <Text style={trk.logLabel}>I did:</Text>
        <TouchableOpacity
          onPress={() => onSet(sessionKey, Math.max(0, parseFloat((display - step).toFixed(2))))}
          style={[trk.btn, (display <= 0 || isDone) && trk.btnDim]}
          disabled={display <= 0 || isDone}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Minus size={14} color={display <= 0 || isDone ? BASECAMP.textFaint : BASECAMP.text} />
        </TouchableOpacity>
        <Text style={[trk.val, hit && trk.valGreen, logged !== undefined && !hit && trk.valWhite]}>
          {logged !== undefined ? `${display}${unit}` : "–"}
        </Text>
        <TouchableOpacity
          onPress={() => onSet(sessionKey, parseFloat((display + step).toFixed(2)))}
          style={[trk.btn, isDone && trk.btnDim]}
          disabled={isDone}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Plus size={14} color={isDone ? BASECAMP.textFaint : BASECAMP.text} />
        </TouchableOpacity>
        {hit && (
          <View style={trk.hitBadge}>
            <Check size={10} color={BASECAMP.accent} />
            <Text style={trk.hitText}>Target!</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const trk = StyleSheet.create({
  /* The loggers keep their existing behaviour exactly; only their surface,
     type and accent move into the approved language. */
  box: {
    backgroundColor: BASECAMP.panelSub,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BASECAMP.panelSubBorder,
    padding: 14,
    gap: 10,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },
  metaVal: { fontFamily: "Inter_600SemiBold", color: BASECAMP.text },
  metaDim: { fontSize: 11, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  logRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  logLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  btn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
    alignItems: "center", justifyContent: "center",
  },
  btnDim: { opacity: 0.35 },
  val: {
    fontSize: 19, fontFamily: "Inter_700Bold", color: BASECAMP.textDim,
    width: 72, textAlign: "center",
  },
  valWhite: { color: BASECAMP.text },
  valGreen: { color: BASECAMP.accent },
  logElev: { fontSize: 12, fontFamily: "Inter_500Medium", color: BASECAMP.textMuted },
  hitBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 20, backgroundColor: "rgba(36,239,164,0.13)",
    borderWidth: 1, borderColor: "rgba(36,239,164,0.45)",
  },
  hitText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: BASECAMP.accent },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SessionDetailScreen() {
  const insets = useSafeAreaInsets();
  const { weekNum: weekNumStr, sessionIdx: sessionIdxStr } = useLocalSearchParams<{
    weekNum: string;
    sessionIdx: string;
  }>();
  const weekNum    = parseInt(weekNumStr    ?? "0", 10);
  const sessionIdx = parseInt(sessionIdxStr ?? "0", 10);

  const {
    trainingPlan, summitGoal,
    completedPlanSessions, submittedPlanSessions,
    assignedHills, sessionReps,
    nearbyHills, addToNearbyHills,
    assignHillToSession, updatePlanSession,
    togglePlanSession, setSessionReps, submitWeekSessions,
    sessionDayOverrides, setSessionDayOverride, clearSessionDayOverride,
  } = useApp();
  const { isSubscribed } = useSubscription();

  const week    = trainingPlan.find(w => w.weekNumber === weekNum);
  const session = week?.sessions[sessionIdx];
  const sessionKey = session?.id ?? `${weekNum}-${sessionIdx}`;

  const isDone      = !!completedPlanSessions[sessionKey];
  const isSubmitted = !!submittedPlanSessions[sessionKey];
  // Fall back to the plan-generator's hill (week.hills[0]) when no explicit assignment exists
  const planHill = (session?.type !== "cardio" && week?.hills[0])
    ? { ...week.hills[0], emoji: "⛰️", surface: "Mixed", grade: "Moderate" } as NearbyHill
    : null;
  const assignedHill: NearbyHill | null = assignedHills[sessionKey] ?? planHill ?? null;

  const [showManual, setShowManual] = useState(isDone && !isSubmitted);
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [hillPickerOpen, setHillPickerOpen] = useState(false);
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);

  const handleHillSelect = useCallback(async (hill: NearbyHill) => {
    setHillPickerOpen(false);
    // Recalculate reps to keep total gain near the session's target, not the hill's default
    const sessionTarget = session?.targetElevation ?? hill.elevation * hill.repeats;
    const adjustedReps = Math.max(1, Math.round(sessionTarget / Math.max(1, hill.elevation)));
    const adjustedHill: NearbyHill = { ...hill, repeats: adjustedReps, totalElevation: adjustedReps * hill.elevation };
    const description =
      `Head to ${adjustedHill.name} (${adjustedHill.elevation}m gain per rep). ` +
      `Complete ${adjustedReps} rep${adjustedReps !== 1 ? "s" : ""} for a total of ${adjustedHill.totalElevation}m elevation gain. ` +
      `Focus on a steady pace on the ascent and controlled steps on the descent to build the leg strength you'll need on summit day.`;
    await assignHillToSession(weekNum, sessionIdx, adjustedHill);
    await updatePlanSession(weekNum, sessionIdx, { targetElevation: adjustedHill.totalElevation, description });
  }, [weekNum, sessionIdx, session?.targetElevation, assignHillToSession, updatePlanSession]);

  const EXERCISE_LABEL: Record<GymExercise, string> = {
    "treadmill":       "Incline Treadmill",
    "stepper":         "Stairmaster",
    "box-steps":       "Box Step-Ups",
    "weighted-stairs": "Weighted Stairs",
    "elliptical":      "Elliptical (High Resistance)",
    "outdoor":         "Outdoor Cardio",
  };

  const EXERCISE_DESCRIPTION: Record<GymExercise, string> = {
    "treadmill":       "Set the treadmill to 12% incline and maintain a brisk walking pace. Keep your heels down and drive through your glutes — the same movement as ascending a real hill. Focus on steady breathing throughout.",
    "stepper":         "Set the stairmaster to a steady, sustainable pace you can hold for the full session. Step through your whole foot to engage your glutes and calves. This directly simulates the leg drive needed on summit day.",
    "box-steps":       "Perform alternating step-ups onto a box or bench at roughly hip height. Add a loaded backpack if available. Control each step down — the eccentric phase builds the quad strength you need for long descents.",
    "weighted-stairs": "Climb stairs with a loaded pack or weight vest. Maintain an upright posture and a steady rhythm — this is the closest gym simulation to carrying kit on summit day.",
    "elliptical":      "Set the resistance high enough that talking is difficult. Maintain an upright posture and push through your heels. Sustained high-resistance effort builds the aerobic capacity you need on the hill.",
    "outdoor":         "Head outside for a brisk walk, jog, or hike on any available elevation. Focus on time on feet at a conversational pace. Consistency outdoors is the best training for mountain days.",
  };

  const handleExerciseSelect = useCallback(async (gymEx: GymExercise) => {
    setExercisePickerOpen(false);
    const targetElev = session?.targetElevation ?? 0;
    const label = EXERCISE_LABEL[gymEx];
    const baseDescription = EXERCISE_DESCRIPTION[gymEx];
    if (gymEx === "treadmill") {
      // At 10–15% incline: 1 km ≈ 100 m elevation gain
      const distKm = Math.max(0.5, Math.round((targetElev / 100) * 10) / 10);
      const description = `${baseDescription} Target: ${distKm} km at 12% incline.`;
      await updatePlanSession(weekNum, sessionIdx, {
        label,
        gymExercise: "treadmill",
        targetDistanceKm: distKm,
        inclinePct: 12,
        description,
      });
    } else if (gymEx === "stepper") {
      // ~3 m per floor
      const floors = Math.max(5, Math.round(targetElev / 3));
      const description = `${baseDescription} Target: ${floors} floors.`;
      await updatePlanSession(weekNum, sessionIdx, {
        label,
        gymExercise: "stepper",
        targetFloors: floors,
        description,
      });
    } else {
      // box-steps, weighted-stairs, elliptical, outdoor — elevation-based
      const description = targetElev > 0
        ? `${baseDescription} Target: ~${targetElev} m elevation gain.`
        : baseDescription;
      await updatePlanSession(weekNum, sessionIdx, { label, gymExercise: gymEx, description });
    }
  }, [weekNum, sessionIdx, session?.targetElevation, updatePlanSession]);

  // Derived hill metadata (same logic as existing HillActionCard)
  const elevPerRep = assignedHill
    ? assignedHill.elevation
    : (session?.targetElevation && session.type !== "cardio"
        ? Math.round(session.targetElevation / Math.max(1, week?.hills[0]?.repeats ?? 2))
        : 0);
  const targetReps = assignedHill
    ? assignedHill.repeats
    : (week?.hills[0]?.repeats ?? 2);
  const estimatedTotalGain = session?.targetElevation ?? 0;

  const pc = PHASE_COLOR[week?.phase ?? "Base"] ?? T.green;
  const tc = session ? typeColor(session.type) : T.blue;

  // Infer gym subtype — computed before hero so we can use it for the image
  const gymText = `${session?.label ?? ""} ${session?.description ?? ""}`.toLowerCase();
  const inferredGymExercise: GymExercise | null =
    session?.gymExercise
      ? session.gymExercise
      : gymText.includes("treadmill")
      ? "treadmill"
      : gymText.includes("stepper") || gymText.includes("step machine") || gymText.includes("stairmaster")
      ? "stepper"
      : gymText.includes("elliptical")
      ? "elliptical"
      : (gymText.includes("stair") && !gymText.includes("stairmaster"))
        || gymText.includes("flights")
        || gymText.includes("uphill")
        || gymText.includes("brisk walk")
      ? "outdoor"
      : session?.type === "cardio"
      ? "outdoor"
      : null;
  // Only treat as a "stair repeat" session when no explicit exercise type is set,
  // and the text isn't just "stairmaster" (which maps to the stepper gymExercise).
  const isStairRepeat = !session?.gymExercise && (
    gymText.includes("stair repeat") ||
    gymText.includes("flights") ||
    (gymText.includes("stair") && !gymText.includes("stairmaster"))
  );
  const isOutdoorCardio = inferredGymExercise === "outdoor"
    || inferredGymExercise === "box-steps"
    || inferredGymExercise === "weighted-stairs"
    || (!inferredGymExercise && !isStairRepeat && session?.type === "cardio");

  // Hero image: exercise-specific keyword for cardio; hill/mountain name for hill sessions
  const heroSubject = session?.type === "cardio"
    ? inferredGymExercise === "treadmill"       ? "incline treadmill training gym workout"
      : inferredGymExercise === "stepper"         ? "stair stepper machine gym climbing"
      : inferredGymExercise === "box-steps"       ? "box step ups exercise training gym"
      : inferredGymExercise === "weighted-stairs" ? "weighted hiking backpack stair training"
      : inferredGymExercise === "elliptical"      ? "elliptical machine gym cardio training"
      : isStairRepeat                             ? "outdoor stair climbing exercise training"
      : "outdoor trail walking hiking fitness nature"
    : (assignedHill?.name ?? session?.label ?? summitGoal?.mountainName ?? "");
  // Local asset overrides take priority; fall back to the API for hill/stair sessions
  const heroImageSource: ImageSourcePropType | null = !imageError
    ? inferredGymExercise === "treadmill"       ? require("@/assets/images/exercise-treadmill.png")
    : inferredGymExercise === "stepper"         ? require("@/assets/images/exercise-stepper.png")
    : inferredGymExercise === "box-steps"       ? require("@/assets/images/exercise-box-steps.png")
    : inferredGymExercise === "weighted-stairs" ? require("@/assets/images/exercise-weighted-stairs.png")
    : inferredGymExercise === "elliptical"      ? require("@/assets/images/exercise-elliptical.png")
    : inferredGymExercise === "outdoor"         ? require("@/assets/images/exercise-outdoor.png")
    : heroSubject
      ? { uri: `${API_BASE}/mountain-image?name=${encodeURIComponent(heroSubject)}&width=800&height=400${assignedHill?.routeIdentityKey ? `&routeIdentityKey=${encodeURIComponent(assignedHill.routeIdentityKey)}` : ""}${assignedHill?.summitIdentityKey ? `&summitIdentityKey=${encodeURIComponent(assignedHill.summitIdentityKey)}` : ""}${assignedHill?.lat != null ? `&lat=${assignedHill.lat}` : ""}${assignedHill?.lng != null ? `&lng=${assignedHill.lng}` : ""}` }
      : null
    : null;

  const midDur = parseDurationMidpoint(session?.duration ?? "45 min");

  // Day scheduling derived values
  const autoAssignedDow: number | null = week
    ? (assignSessionsToDays(week.sessions.length, summitGoal?.availableDays).find(a => a.sessionIdx === sessionIdx)?.dayOfWeek ?? null)
    : null;
  const sessionDow: number | null = sessionDayOverrides[sessionKey] !== undefined
    ? sessionDayOverrides[sessionKey]
    : autoAssignedDow;
  const hasDayOverride = sessionDayOverrides[sessionKey] !== undefined;
  const occupiedDows: Partial<Record<number, OccupiedDay>> = {};
  if (week) {
    const _weekAuto = assignSessionsToDays(week.sessions.length, summitGoal?.availableDays);
    week.sessions.forEach((s, i) => {
      if (i === sessionIdx) return;
      const k = s.id ?? `${weekNum}-${i}`;
      const dow = sessionDayOverrides[k] !== undefined
        ? sessionDayOverrides[k]
        : (_weekAuto.find(a => a.sessionIdx === i)?.dayOfWeek ?? null);
      if (dow !== null) occupiedDows[dow] = { label: s.label, type: s.type };
    });
  }

  // Submit the week after manual completion
  const handleSubmitWeek = useCallback(async () => {
    setSaving(true);
    await submitWeekSessions(weekNum);
    setSaving(false);
  }, [submitWeekSessions, weekNum]);

  // Count unsubmitted completed sessions in this week for the submit button
  const unsubmittedCount = week
    ? week.sessions.filter((_, i) => {
        const k = week.sessions[i].id ?? `${weekNum}-${i}`;
        return completedPlanSessions[k] && !submittedPlanSessions[k];
      }).length
    : 0;

  const submittedCount = week
    ? week.sessions.filter((s, i) => submittedPlanSessions[s.id ?? `${weekNum}-${i}`]).length
    : 0;

  if (!session || !week) {
    return (
      <View style={{ flex: 1, backgroundColor: BASECAMP.ink }}>
        <View style={{ paddingTop: Platform.OS === "web" ? 18 : insets.top + 8 }}>
          <SRScreenHeader title="Training session" onBack={() => router.back()} />
        </View>
        <View style={{ paddingHorizontal: BASECAMP.gutter, paddingTop: 30 }}>
          <SREmptyState
            testID="session-not-found"
            title="This session is no longer in your plan"
            body="It may have been rescheduled or the plan rebuilt. Open your plan to find the current one."
            action="Open training plan"
            onAction={() => router.replace("/(tabs)/plan")}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BASECAMP.ink }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 80 : insets.bottom + 80 }}
      >
        {/* ── Hero: the prescription, over its own artwork ────────────────
            `heroImageSource` is unchanged: the local exercise asset for a gym
            session, otherwise the existing mountain-image service for the
            assigned hill. Nothing new is invented, and a failure falls through
            to the designed gradient rather than a broken image. */}
        <SRHeroFrame
          source={heroImageSource}
          onImageError={() => setImageError(true)}
          minHeight={286}
          dim={0.96}
        >
          <View style={{ paddingTop: Platform.OS === "web" ? 18 : insets.top + 8 }}>
            <SRScreenHeader
              title="Training session"
              subtitle={`Week ${weekNum} · ${week.phase}`}
              onBack={() => router.back()}
            />
          </View>

          <View style={s.heroBody}>
            <View style={s.pillRow}>
              <SRStatusPill label={typeLabel(session.type)} tone={BASECAMP.accent} />
              {isDone ? <SRStatusPill label="Done" tone={BASECAMP.accent} /> : null}
              {isSubmitted ? <SRStatusPill label="Submitted" tone={BASECAMP.accent} /> : null}
            </View>

            <Text style={s.title} numberOfLines={3}>{session.label}</Text>

            <View style={s.heroFacts}>
              <Text style={s.heroFact} numberOfLines={1}>{session.duration}</Text>
              {session.targetElevation > 0 && (
                <>
                  <SRFactDivider />
                  <Text style={s.heroFact} numberOfLines={1}>
                    {session.targetElevation.toLocaleString()} m gain
                  </Text>
                </>
              )}
              {sessionDow !== null && (
                <>
                  <SRFactDivider />
                  <Text style={s.heroFact} numberOfLines={1}>{DAY_FULL[sessionDow]}</Text>
                </>
              )}
            </View>
          </View>
        </SRHeroFrame>

        <Animated.View entering={FadeInDown.duration(400)}>
          {/* ── Why this session ─────────────────────────────────────────
              Built from the plan's own session and the real summit goal —
              nothing here is generated or estimated. */}
          {(() => {
            const purpose = sessionPurpose({
              type: session.type,
              description: session.description,
              targetElevation: session.targetElevation,
              mountainName: summitGoal?.mountainName ?? null,
            });
            return (
              <View style={s.section}>
                <SRSectionHeader title="Why this session" />
                <SRPanel radius={16} style={{ marginTop: 10 }}>
                  <View style={s.purposeBody}>
                    <Text style={s.purposeBuilds}>{purpose.builds}</Text>
                    {purpose.relationship ? (
                      <Text style={s.purposeRelationship}>{purpose.relationship}</Text>
                    ) : null}
                  </View>
                </SRPanel>
              </View>
            );
          })()}

          {/* ── The prescription ─────────────────────────────────────────
              Every figure is the plan's own; a target the plan did not set is
              omitted rather than shown as zero. */}
          <View style={s.section}>
            <SRSectionHeader title="The prescription" />
            <SRPanel radius={16} style={{ marginTop: 10 }}>
              <View style={s.statsGrid}>
                <Stat value={session.duration} label="Duration" />
                {session.targetElevation > 0 && (
                  <Stat
                    value={`${session.targetElevation.toLocaleString()} m`}
                    label="Elevation"
                    tone={BASECAMP.accent}
                  />
                )}
                {session.type !== "cardio" && elevPerRep > 0 && (
                  <Stat value={String(targetReps)} label={`Reps × ${elevPerRep} m`} />
                )}
                {inferredGymExercise === "treadmill" && session.targetDistanceKm ? (
                  <Stat
                    value={`${session.targetDistanceKm} km`}
                    label={`At ${session.inclinePct ?? 10}% grade`}
                  />
                ) : null}
                {inferredGymExercise === "stepper" && session.targetFloors ? (
                  <Stat value={`${session.targetFloors}`} label="Floors" />
                ) : null}
                {isStairRepeat && session.targetFlights ? (
                  <Stat value={`${session.targetFlights}`} label="Flights" />
                ) : null}
              </View>
            </SRPanel>
          </View>

          {/* ── Where and when ───────────────────────────────────────────
              The hill assignment, the exercise choice and the scheduled day.
              All three actions are the existing ones. */}
          <View style={s.section}>
            <SRSectionHeader title="Where and when" />
            <View style={{ marginTop: 10, gap: 8 }}>
              {(session.type === "hill" || session.type === "bigDay") && (
                <SetupRow
                  icon={<Mountain size={16} color={assignedHill ? BASECAMP.accent : BASECAMP.textDim} />}
                  title={assignedHill?.name ?? "No hill assigned"}
                  detail={assignedHill
                    ? `${assignedHill.distance} km away · ${assignedHill.surface} · ${assignedHill.grade} grade`
                    : "Choose a training hill for this session"}
                  action={assignedHill ? "Change" : "Assign"}
                  muted={!assignedHill}
                  onPress={() => setHillPickerOpen(true)}
                />
              )}

              {session.type === "cardio" && !isStairRepeat && (
                <SetupRow
                  icon={<Activity size={16} color={BASECAMP.accent} />}
                  title={
                    inferredGymExercise === "treadmill" ? "Incline treadmill"
                      : inferredGymExercise === "stepper" ? "Stepper machine"
                      : inferredGymExercise === "box-steps" ? "Box step-ups"
                      : inferredGymExercise === "weighted-stairs" ? "Weighted stairs"
                      : inferredGymExercise === "elliptical" ? "Elliptical, high resistance"
                      : "Outdoor walk or run"
                  }
                  detail={
                    inferredGymExercise === "treadmill"
                      ? `${session.targetDistanceKm ?? "—"} km at ${session.inclinePct ?? 12}% incline`
                      : inferredGymExercise === "stepper"
                      ? `${session.targetFloors ?? "—"} floors`
                      : session.targetElevation > 0
                      ? `${session.targetElevation.toLocaleString()} m elevation gain`
                      : "No elevation target set"
                  }
                  action="Change"
                  onPress={() => setExercisePickerOpen(true)}
                />
              )}

              <SetupRow
                icon={<Calendar size={16} color={sessionDow !== null ? BASECAMP.accent : BASECAMP.textDim} />}
                title={sessionDow !== null ? DAY_FULL[sessionDow] : "Unscheduled"}
                detail={sessionDow !== null
                  ? "Move this session to a different day"
                  : "Plan which day you will do this"}
                action={sessionDow !== null ? "Change" : "Schedule"}
                muted={sessionDow === null}
                onPress={() => setDayPickerOpen(true)}
              />
            </View>
          </View>

          {/* ── Coaching notes ───────────────────────────────────────── */}
          {session.description ? (
            <View style={s.section}>
              <SRSectionHeader title="Coaching notes" />
              <SRPanel radius={16} style={{ marginTop: 10 }}>
                <Text style={s.descText}>{session.description}</Text>
              </SRPanel>
            </View>
          ) : null}

          {/* ── Complete this session ────────────────────────────────────
              Every route out of this screen is unchanged: GPS tracking carries
              the same params, manual completion still calls togglePlanSession,
              the loggers still write through setSessionReps, and the week is
              still submitted by submitWeekSessions. */}
          {!isSubmitted && (
            <View style={s.section}>
              <SRSectionHeader title="Complete this session" />

              {(session.type === "hill" || session.type === "bigDay") && (
                <>
                  <SRPanel
                    radius={16}
                    style={s.gpsPanel}
                    onPress={() =>
                      router.push({
                        pathname: "/hike-tracking",
                        params: {
                          hillSessionKey: sessionKey,
                          hillName: assignedHill?.name ?? session.label,
                          targetReps: String(targetReps),
                          estimatedGainPerRep: String(elevPerRep),
                          estimatedTotalGain: String(estimatedTotalGain),
                        },
                      })
                    }
                    accessibilityLabel="Track this session with GPS"
                    accessibilityHint="Records elevation and maps your route"
                  >
                    <View style={s.ctaRow}>
                      <View style={s.ctaIcon}>
                        <Globe size={18} color={BASECAMP.accentInk} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.ctaTitle}>Track with GPS</Text>
                        <Text style={s.ctaSub}>Records elevation and maps your route</Text>
                      </View>
                      <ChevronRight size={16} color={BASECAMP.accent} />
                    </View>
                  </SRPanel>

                  <View style={s.accuracyNote}>
                    <Zap size={11} color={BASECAMP.textFaint} />
                    <Text style={s.accuracyNoteText}>
                      GPS tracking records verified elevation and improves hill accuracy for
                      everyone. Manual completion counts equally toward your readiness score.
                    </Text>
                  </View>
                </>
              )}

              {!isDone ? (
                <SRSubPanel
                  style={s.manualRow}
                  onPress={async () => {
                    await togglePlanSession(weekNum, sessionIdx);
                    setShowManual(true);
                  }}
                  accessibilityLabel="Complete without GPS"
                >
                  <View style={s.ctaRow}>
                    <CheckCircle size={17} color={BASECAMP.textMuted} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.ctaTitleQuiet}>Complete without GPS</Text>
                      <Text style={s.ctaSub}>Mark done and log your effort</Text>
                    </View>
                    <ChevronRight size={16} color={BASECAMP.textDim} />
                  </View>
                </SRSubPanel>
              ) : (
                <SRSubPanel
                  style={[s.manualRow, s.manualDone]}
                  onPress={() => togglePlanSession(weekNum, sessionIdx)}
                  accessibilityLabel="Marked complete. Tap to undo."
                >
                  <View style={s.ctaRow}>
                    <CheckCircle size={17} color={BASECAMP.accent} />
                    <Text style={[s.ctaTitleQuiet, { color: BASECAMP.accent, flex: 1 }]}>
                      Marked complete
                    </Text>
                    <Text style={s.undoText}>Tap to undo</Text>
                  </View>
                </SRSubPanel>
              )}

              {(isDone || showManual) && (
                <View style={s.trackerWrap}>
                  <SREyebrow>LOG YOUR NUMBERS</SREyebrow>

                  {(session.type === "hill" || session.type === "bigDay") && elevPerRep > 0 && (
                    <RepLog
                      sessionKey={sessionKey}
                      targetReps={targetReps}
                      elevPerRep={elevPerRep}
                      sessionReps={sessionReps}
                      isDone={false}
                      onSet={setSessionReps}
                    />
                  )}
                  {inferredGymExercise === "treadmill" && session.targetDistanceKm && (
                    <MeterLog sessionKey={sessionKey} target={session.targetDistanceKm} unit="km"
                      step={0.5} sessionReps={sessionReps} isDone={false} onSet={setSessionReps} />
                  )}
                  {inferredGymExercise === "stepper" && session.targetFloors && (
                    <MeterLog sessionKey={sessionKey} target={session.targetFloors} unit=" fl"
                      step={5} sessionReps={sessionReps} isDone={false} onSet={setSessionReps} />
                  )}
                  {isStairRepeat && session.targetFlights && (
                    <MeterLog sessionKey={sessionKey} target={session.targetFlights} unit=" flights"
                      step={1} sessionReps={sessionReps} isDone={false} onSet={setSessionReps} />
                  )}
                  {isOutdoorCardio && session.targetElevation > 0 && (
                    <MeterLog sessionKey={sessionKey} target={session.targetElevation} unit="m"
                      step={session.targetElevation >= 500 ? 100 : session.targetElevation >= 200 ? 50 : 25}
                      sessionReps={sessionReps} isDone={false} onSet={setSessionReps} />
                  )}
                </View>
              )}

              {unsubmittedCount > 0 && (
                <SRButton
                  label={saving
                    ? "Saving…"
                    : `Submit ${unsubmittedCount} session${unsubmittedCount > 1 ? "s" : ""}`}
                  onPress={handleSubmitWeek}
                  disabled={saving}
                  style={{ marginTop: 12 }}
                  accessibilityHint="Updates your readiness with this week's completed sessions"
                  icon={<CheckCircle size={16} color={BASECAMP.accentInk} />}
                />
              )}
              {submittedCount > 0 && unsubmittedCount === 0 && (
                <View style={s.submittedBanner}>
                  <CheckCircle size={14} color={BASECAMP.accent} />
                  <Text style={s.submittedText}>
                    {submittedCount} session{submittedCount > 1 ? "s" : ""} submitted · readiness updated
                  </Text>
                </View>
              )}
            </View>
          )}

          {isSubmitted && (
            <View style={s.section}>
              <View style={s.submittedBanner}>
                <CheckCircle size={14} color={BASECAMP.accent} />
                <Text style={s.submittedText}>Session submitted · readiness updated</Text>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Hill picker modal */}
      <HillPickerModal
        visible={hillPickerOpen}
        hills={nearbyHills}
        location={summitGoal?.location ?? ""}
        onSelect={handleHillSelect}
        onSearchAdd={addToNearbyHills}
        onClose={() => setHillPickerOpen(false)}
      />

      {/* Exercise picker modal */}
      <ExercisePickerModal
        visible={exercisePickerOpen}
        current={inferredGymExercise}
        onSelect={handleExerciseSelect}
        onClose={() => setExercisePickerOpen(false)}
      />

      {/* Day picker modal */}
      <DayPickerModal
        visible={dayPickerOpen}
        sessionLabel={session.label}
        weekStartDate={week.startDate}
        currentDow={sessionDow}
        occupiedDows={occupiedDows}
        preferredDows={summitGoal?.availableDays ?? []}
        hasOverride={hasDayOverride}
        onSelect={async (dow) => {
          setDayPickerOpen(false);
          await setSessionDayOverride(weekNum, sessionIdx, dow);
        }}
        onClear={async () => {
          setDayPickerOpen(false);
          await clearSessionDayOverride(weekNum, sessionIdx);
        }}
        onClose={() => setDayPickerOpen(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  /* ── The approved Training Session composition ──────────────────────
     One rhythm shared with Training Basecamp and Full Readiness: the
     17pt gutter, the tracked-out section label, the gradient panel. */
  section: { marginTop: 20, paddingHorizontal: BASECAMP.gutter },

  heroBody: { paddingHorizontal: BASECAMP.gutter, marginTop: 22, paddingBottom: 22 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  title: {
    marginTop: 10,
    fontSize: 30, lineHeight: 34, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: -0.8,
  },
  heroFacts: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 9, flexWrap: "wrap" },
  heroFact: {
    fontSize: 12.5, lineHeight: 17, fontFamily: "Inter_500Medium", color: BASECAMP.textStrong,
  },

  purposeBody: { padding: 14, gap: 6 },
  purposeBuilds: {
    fontSize: 14, lineHeight: 20, fontFamily: "Inter_600SemiBold", color: BASECAMP.text,
  },
  purposeRelationship: {
    fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },

  statsGrid: {
    flexDirection: "row", flexWrap: "wrap", padding: 14, rowGap: 14,
  },
  statCell: { flexGrow: 1, flexBasis: "33%", minWidth: 92, paddingRight: 8 },
  statVal: {
    fontSize: 19, lineHeight: 23, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: -0.4,
  },
  statLbl: {
    marginTop: 3, fontSize: 10, lineHeight: 13,
    fontFamily: "Inter_500Medium", color: BASECAMP.textDim,
  },

  setupRow: {
    flexDirection: "row", alignItems: "center", gap: 11,
    padding: 12, minHeight: HIT.minTarget,
  },
  setupTitle: { fontSize: 13.5, lineHeight: 18, fontFamily: "Inter_600SemiBold", color: BASECAMP.text },
  setupDetail: {
    marginTop: 2, fontSize: 11, lineHeight: 15,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },
  setupAction: { fontSize: 11.5, lineHeight: 15, fontFamily: "Inter_600SemiBold", color: BASECAMP.accent },

  descText: {
    padding: 14, fontSize: 13, lineHeight: 20,
    fontFamily: "Inter_400Regular", color: BASECAMP.textStrong,
  },

  gpsPanel: { marginTop: 10, borderColor: "rgba(36,239,164,0.30)" },
  ctaRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, minHeight: HIT.minTarget },
  ctaIcon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: "center", justifyContent: "center", backgroundColor: BASECAMP.accent,
  },
  ctaTitle: { fontSize: 14.5, lineHeight: 19, fontFamily: "Inter_700Bold", color: BASECAMP.text },
  ctaTitleQuiet: { fontSize: 13.5, lineHeight: 18, fontFamily: "Inter_600SemiBold", color: BASECAMP.text },
  ctaSub: {
    marginTop: 2, fontSize: 11, lineHeight: 15,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },
  undoText: { fontSize: 11, lineHeight: 15, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },

  accuracyNote: { flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 9, paddingHorizontal: 2 },
  accuracyNoteText: {
    flex: 1, fontSize: 10.5, lineHeight: 15,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },

  manualRow: { marginTop: 10 },
  manualDone: { borderColor: "rgba(36,239,164,0.35)", backgroundColor: "rgba(36,239,164,0.08)" },

  trackerWrap: { marginTop: 16, gap: 10 },

  submittedBanner: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12,
    paddingVertical: 11, paddingHorizontal: 13, borderRadius: 12,
    backgroundColor: "rgba(36,239,164,0.09)",
    borderWidth: 1, borderColor: "rgba(36,239,164,0.28)",
  },
  submittedText: {
    flex: 1, fontSize: 12, lineHeight: 16,
    fontFamily: "Inter_600SemiBold", color: BASECAMP.accent,
  },
});
