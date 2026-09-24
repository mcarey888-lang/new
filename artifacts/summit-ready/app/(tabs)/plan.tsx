import type { LucideIcon } from "lucide-react-native";
import { Flag, Minus, Plus, Check, ChevronDown, ChevronUp, ChevronLeft, TrendingUp, Zap, Pencil, CheckCircle, RefreshCw, ChevronRight, Calendar, Cpu, Lock, Activity, Square, Package, Anchor, Droplet, Wind, Mountain, Play, Settings, Moon } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";

import { NearbyHill, TrainingWeek, useApp } from "@/context/AppContext";
import { DayPickerModal, type OccupiedDay } from "@/components/DayPickerModal";
import { HillPickerModal } from "@/components/HillPickerModal";
import { T, PHASE_COLOR } from "@/constants/theme";
import { BASECAMP, HIT, TYPE } from "@/constants/tokens";
import {
  SRButton, SREmptyState, SREyebrow, SRFactDivider, SRHeroFrame, SRPanel, SRProgress,
  SRScreenHeader, SRSectionHeader, SRStatusPill, SRSubPanel, SRUnderlineTabs,
} from "@/components/ui";
import { ModeTogglePill } from "@/components/ModeTogglePill";
import { useScreenView } from "@/lib/analytics";
import { planWeekDays, weekDateRange, weeksUntilPlanStart } from "@/utils/basecampPresentation";
import { mountainImageUri, sessionImageSubject } from "@/utils/mountainImage";
import { useReadinessV2 } from "@/hooks/useReadinessV2";
import { getCurrentWeek, parseDurationMidpoint } from "@/utils/planGenerator";
import { useSubscription } from "@/lib/revenuecat";
import { assignSessionsToDays, DAY_SHORT } from "@/utils/dayAssignment";
import { authenticatedJsonHeaders, responseError } from "@/utils/authRequest";
import { enqueueSyncFailure, enqueueSyncPending, markSyncComplete, retrySyncOutbox } from "@/utils/syncOutbox";

const PLAN_API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

// ── Hill Action Card ──────────────────────────────────────────────────────────
// Shows per-rep elevation, target reps, total gain, data-confidence badge, and
// two CTA buttons: "Track this hike" (launches GPS) and "Mark complete".
function HillActionCard({
  sessionKey,
  assignedHill,
  elevPerRep,
  targetReps,
  estimatedTotalGain,
  isDone,
  isSubmitted,
  onMarkComplete,
  onTrack,
}: {
  sessionKey: string;
  assignedHill?: import("@/context/AppContext").NearbyHill;
  elevPerRep: number;
  targetReps: number;
  estimatedTotalGain: number;
  isDone: boolean;
  isSubmitted: boolean;
  onMarkComplete: () => void;
  onTrack: () => void;
}) {
  const hillName = assignedHill?.name ?? null;
  const { getToken, userId } = useAuth();

  async function handleMarkComplete() {
    if (!isDone) {
      onMarkComplete();
      const body = {
        plannedHillName: hillName ?? sessionKey,
        trainingSessionId: sessionKey,
        targetReps,
        estimatedGainPerRepM: elevPerRep,
        estimatedTotalGainM: Math.round(estimatedTotalGain),
      };
      const syncId = `hill-session:complete:${sessionKey}`;
      try {
        if (!userId) throw new Error("Authentication required");
        await retrySyncOutbox(userId, getToken);
        await enqueueSyncPending(userId, {
          id: syncId,
          kind: "hill-session",
          url: `${PLAN_API_BASE}/hill-session/complete`,
          method: "POST",
          body,
        });
        const token = await getToken();
        const res = await fetch(`${PLAN_API_BASE}/hill-session/complete`, {
          method: "POST",
          headers: authenticatedJsonHeaders(token),
          body: JSON.stringify(body),
        });
        if (!res.ok) throw await responseError(res, "Could not sync hill session");
        await markSyncComplete(userId, syncId);
      } catch {
        if (userId) await enqueueSyncFailure(userId, {
          id: syncId,
          kind: "hill-session",
          url: `${PLAN_API_BASE}/hill-session/complete`,
          method: "POST",
          body,
        });
      }
    }
  }

  return (
    <View style={hacStyles.container}>
      {/* Stats row */}
      <View style={hacStyles.statsRow}>
        <View style={hacStyles.statCell}>
          <Text style={hacStyles.statVal}>{elevPerRep}m</Text>
          <Text style={hacStyles.statLbl}>per rep</Text>
        </View>
        <View style={[hacStyles.statCell, hacStyles.statCellMid]}>
          <Text style={hacStyles.statVal}>{targetReps}</Text>
          <Text style={hacStyles.statLbl}>reps target</Text>
        </View>
        <View style={hacStyles.statCell}>
          <Text style={hacStyles.statVal}>{Math.round(estimatedTotalGain)}m</Text>
          <Text style={hacStyles.statLbl}>total gain</Text>
        </View>
      </View>

      {/* Data confidence badge */}
      <View style={hacStyles.badgeRow}>
        <View style={hacStyles.badge}>
          <Text style={hacStyles.badgeText}>ESTIMATED DATA</Text>
        </View>
        <Text style={hacStyles.badgeSub}>GPS track improves accuracy for everyone</Text>
      </View>

      {/* Action buttons */}
      {!isSubmitted && (
        <View style={hacStyles.btnRow}>
          <TouchableOpacity
            style={[hacStyles.btn, hacStyles.btnTrack, isDone && { opacity: 0.5 }]}
            onPress={onTrack}
            activeOpacity={0.8}
            disabled={isDone}
          >
            <Activity size={13} color={T.blue} />
            <Text style={[hacStyles.btnText, { color: T.blue }]}>Track this hike</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[hacStyles.btn, hacStyles.btnComplete, isDone && hacStyles.btnDone]}
            onPress={handleMarkComplete}
            activeOpacity={0.8}
            disabled={isDone}
          >
            <CheckCircle size={13} color={isDone ? T.green : T.textMuted} />
            <Text style={[hacStyles.btnText, { color: isDone ? T.green : T.textMuted }]}>
              {isDone ? "Completed" : "Mark complete"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const hacStyles = StyleSheet.create({
  container: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 10,
    gap: 8,
  },
  statsRow: {
    flexDirection: "row",
  },
  statCell: { flex: 1, alignItems: "center", gap: 2 },
  statCellMid: {
    borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  statVal: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.white },
  statLbl: { fontSize: 9, fontFamily: "Inter_400Regular", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    backgroundColor: "rgba(251,146,60,0.1)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.3)",
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: T.orange, letterSpacing: 0.7 },
  badgeSub: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim, flex: 1 },
  btnRow: { flexDirection: "row", gap: 8 },
  btn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 9, borderRadius: 10, borderWidth: 1,
  },
  btnTrack: { backgroundColor: T.blueDim, borderColor: T.blue + "40" },
  btnComplete: { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.12)" },
  btnDone: { backgroundColor: T.greenDim, borderColor: T.green + "40" },
  btnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});

// ── Rep Tracker ───────────────────────────────────────────────────────────────
// Shows summit-equivalent target reps, lets user log how many they actually
// managed, and turns green when they hit the target.
function RepStepper({
  sessionKey,
  targetReps,
  elevPerRep,
  sessionReps,
  isDone,
  onSet,
}: {
  sessionKey: string;
  targetReps: number;
  elevPerRep: number;
  sessionReps: Record<string, number>;
  isDone: boolean;
  onSet: (key: string, reps: number) => void;
}) {
  const logged = sessionReps[sessionKey];
  const hasLogged = logged !== undefined;
  const displayReps = hasLogged ? logged : 0;
  const hitTarget = hasLogged && logged >= targetReps;
  const targetElev = elevPerRep > 0 ? targetReps * elevPerRep : null;
  const loggedElev = hasLogged && elevPerRep > 0 ? logged * elevPerRep : null;

  return (
    <View style={[rsStyles.container, isDone && rsStyles.containerDone]}>
      <View style={rsStyles.targetRow}>
        <Flag size={11} color={T.orange} />
        <Text style={rsStyles.targetLabel}>
          Today's target:{" "}
          <Text style={rsStyles.targetNum}>{targetReps} reps</Text>
        </Text>
        {targetElev !== null && (
          <Text style={rsStyles.targetElev}>= {targetElev}m total</Text>
        )}
      </View>

      <View style={rsStyles.logRow}>
        <Text style={rsStyles.logLabel}>Today I did:</Text>

        <TouchableOpacity
          onPress={() => onSet(sessionKey, displayReps - 1)}
          style={[rsStyles.btn, (displayReps <= 0 || isDone) && rsStyles.btnDisabled]}
          activeOpacity={0.7}
          disabled={displayReps <= 0 || isDone}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Minus size={12} color={(displayReps <= 0 || isDone) ? T.textDim : T.white} />
        </TouchableOpacity>

        <Text style={[rsStyles.count, hitTarget && rsStyles.countHit, hasLogged && !hitTarget && rsStyles.countPartial]}>
          {hasLogged ? displayReps : "–"}
        </Text>

        <TouchableOpacity
          onPress={() => onSet(sessionKey, displayReps + 1)}
          style={[rsStyles.btn, isDone && rsStyles.btnDisabled]}
          activeOpacity={0.7}
          disabled={isDone}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Plus size={12} color={isDone ? T.textDim : T.white} />
        </TouchableOpacity>

        {loggedElev !== null && (
          <Text style={[rsStyles.logElev, hitTarget && { color: T.green }]}>
            = {loggedElev}m
          </Text>
        )}

        {hitTarget && (
          <View style={rsStyles.hitBadge}>
            <Check size={10} color={T.green} />
            <Text style={rsStyles.hitText}>Target hit!</Text>
          </View>
        )}

        {hasLogged && !hitTarget && logged > 0 && (
          <Text style={rsStyles.progressText}>
            {logged}/{targetReps}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Flights Logger ────────────────────────────────────────────────────────────
// For stair repeat sessions. Logs flights of stairs (1 flight = 1 floor ≈ 3m).
function FlightsLogger({
  sessionKey,
  targetFlights,
  sessionReps,
  isDone,
  onSet,
}: {
  sessionKey: string;
  targetFlights: number;
  sessionReps: Record<string, number>;
  isDone: boolean;
  onSet: (key: string, value: number) => void;
}) {
  const logged = sessionReps[sessionKey];
  const hasLogged = logged !== undefined;
  const displayVal = hasLogged ? logged : 0;
  const hitTarget = hasLogged && displayVal >= targetFlights;

  function handleDecrement() {
    onSet(sessionKey, Math.max(0, displayVal - 1));
  }
  function handleIncrement() {
    onSet(sessionKey, displayVal + 1);
  }

  return (
    <View style={[rsStyles.container, isDone && rsStyles.containerDone]}>
      <View style={rsStyles.targetRow}>
        <Flag size={11} color={T.orange} />
        <Text style={rsStyles.targetLabel}>
          Target:{" "}
          <Text style={rsStyles.targetNum}>{targetFlights} flights</Text>
        </Text>
      </View>
      <View style={rsStyles.logRow}>
        <Text style={rsStyles.logLabel}>Flights done:</Text>
        <TouchableOpacity
          onPress={handleDecrement}
          style={[rsStyles.btn, (displayVal <= 0 || isDone) && rsStyles.btnDisabled]}
          activeOpacity={0.7}
          disabled={displayVal <= 0 || isDone}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Minus size={12} color={(displayVal <= 0 || isDone) ? T.textDim : T.white} />
        </TouchableOpacity>
        <Text style={[rsStyles.count, hitTarget && rsStyles.countHit, hasLogged && !hitTarget && rsStyles.countPartial]}>
          {hasLogged ? `${displayVal}` : "–"}
        </Text>
        <TouchableOpacity
          onPress={handleIncrement}
          style={[rsStyles.btn, isDone && rsStyles.btnDisabled]}
          activeOpacity={0.7}
          disabled={isDone}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Plus size={12} color={isDone ? T.textDim : T.white} />
        </TouchableOpacity>
        {hitTarget && (
          <View style={rsStyles.hitBadge}>
            <Check size={10} color={T.green} />
            <Text style={rsStyles.hitText}>Target hit!</Text>
          </View>
        )}
        {hasLogged && !hitTarget && displayVal > 0 && (
          <Text style={rsStyles.progressText}>{displayVal}/{targetFlights} flights</Text>
        )}
      </View>
    </View>
  );
}

// ── Elevation Logger ──────────────────────────────────────────────────────────
// For non-gym cardio sessions (uphill walks, taper walks).
// Logs actual elevation gain in metres against the session's target.
function ElevationLogger({
  sessionKey,
  targetElevation,
  sessionReps,
  isDone,
  onSet,
}: {
  sessionKey: string;
  targetElevation: number;
  sessionReps: Record<string, number>;
  isDone: boolean;
  onSet: (key: string, value: number) => void;
}) {
  const step = targetElevation >= 500 ? 100 : targetElevation >= 200 ? 50 : 25;
  const logged = sessionReps[sessionKey];
  const hasLogged = logged !== undefined;
  const displayVal = hasLogged ? logged : 0;
  const hitTarget = hasLogged && displayVal >= targetElevation;

  function handleDecrement() {
    onSet(sessionKey, Math.max(0, displayVal - step));
  }
  function handleIncrement() {
    onSet(sessionKey, displayVal + step);
  }

  return (
    <View style={[rsStyles.container, isDone && rsStyles.containerDone]}>
      <View style={rsStyles.targetRow}>
        <Flag size={11} color={T.orange} />
        <Text style={rsStyles.targetLabel}>
          Target:{" "}
          <Text style={rsStyles.targetNum}>{targetElevation}m elevation gain</Text>
        </Text>
      </View>
      <View style={rsStyles.logRow}>
        <Text style={rsStyles.logLabel}>I did:</Text>
        <TouchableOpacity
          onPress={handleDecrement}
          style={[rsStyles.btn, (displayVal <= 0 || isDone) && rsStyles.btnDisabled]}
          activeOpacity={0.7}
          disabled={displayVal <= 0 || isDone}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Minus size={12} color={(displayVal <= 0 || isDone) ? T.textDim : T.white} />
        </TouchableOpacity>
        <Text style={[rsStyles.count, hitTarget && rsStyles.countHit, hasLogged && !hitTarget && rsStyles.countPartial]}>
          {hasLogged ? `${displayVal}m` : "–"}
        </Text>
        <TouchableOpacity
          onPress={handleIncrement}
          style={[rsStyles.btn, isDone && rsStyles.btnDisabled]}
          activeOpacity={0.7}
          disabled={isDone}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Plus size={12} color={isDone ? T.textDim : T.white} />
        </TouchableOpacity>
        {hitTarget && (
          <View style={rsStyles.hitBadge}>
            <Check size={10} color={T.green} />
            <Text style={rsStyles.hitText}>Target hit!</Text>
          </View>
        )}
        {hasLogged && !hitTarget && displayVal > 0 && (
          <Text style={rsStyles.progressText}>{displayVal}/{targetElevation}m</Text>
        )}
      </View>
    </View>
  );
}

function GymTracker({
  sessionKey,
  gymExercise,
  targetKm,
  targetFloors,
  inclinePct,
  sessionReps,
  isDone,
  onSet,
}: {
  sessionKey: string;
  gymExercise: "treadmill" | "stepper";
  targetKm?: number;
  targetFloors?: number;
  inclinePct?: number;
  sessionReps: Record<string, number>;
  isDone: boolean;
  onSet: (key: string, value: number) => void;
}) {
  const isTreadmill = gymExercise === "treadmill";
  const incline = inclinePct ?? 10;
  const target = isTreadmill ? (targetKm ?? 0) : (targetFloors ?? 0);
  const step = isTreadmill ? 0.5 : 5;
  const logged = sessionReps[sessionKey];
  const hasLogged = logged !== undefined;
  const displayVal = hasLogged ? logged : 0;
  const hitTarget = hasLogged && displayVal >= target;
  const targetElev = isTreadmill ? Math.round(target * incline * 10) : Math.round(target * 3);
  const loggedElev = hasLogged && displayVal > 0
    ? (isTreadmill ? Math.round(displayVal * incline * 10) : Math.round(displayVal * 3))
    : null;

  function handleDecrement() {
    const next = parseFloat((displayVal - step).toFixed(1));
    // Passing 0 (or below) clears the entry so it returns to "–"
    onSet(sessionKey, Math.max(0, next));
  }

  function handleIncrement() {
    const next = parseFloat((displayVal + step).toFixed(1));
    onSet(sessionKey, next);
  }

  return (
    <View style={[rsStyles.container, isDone && rsStyles.containerDone]}>
      <View style={rsStyles.targetRow}>
        <Flag size={11} color={T.orange} />
        <Text style={rsStyles.targetLabel}>
          Target:{" "}
          <Text style={rsStyles.targetNum}>
            {isTreadmill ? `${target.toFixed(1)}km @ ${incline}% incline` : `${target} floors`}
          </Text>
        </Text>
        <Text style={rsStyles.targetElev}>≈ {targetElev}m gain</Text>
      </View>

      <View style={rsStyles.logRow}>
        <Text style={rsStyles.logLabel}>I did:</Text>

        <TouchableOpacity
          onPress={handleDecrement}
          style={[rsStyles.btn, (displayVal <= 0 || isDone) && rsStyles.btnDisabled]}
          activeOpacity={0.7}
          disabled={displayVal <= 0 || isDone}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Minus size={12} color={(displayVal <= 0 || isDone) ? T.textDim : T.white} />
        </TouchableOpacity>

        <Text style={[rsStyles.count, hitTarget && rsStyles.countHit, hasLogged && !hitTarget && rsStyles.countPartial]}>
          {hasLogged
            ? (isTreadmill ? `${displayVal.toFixed(1)}km` : `${displayVal} fl`)
            : "–"}
        </Text>

        <TouchableOpacity
          onPress={handleIncrement}
          style={[rsStyles.btn, isDone && rsStyles.btnDisabled]}
          activeOpacity={0.7}
          disabled={isDone}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Plus size={12} color={isDone ? T.textDim : T.white} />
        </TouchableOpacity>

        {loggedElev !== null && (
          <Text style={[rsStyles.logElev, hitTarget && { color: T.green }]}>
            ≈ {loggedElev}m
          </Text>
        )}

        {hitTarget && (
          <View style={rsStyles.hitBadge}>
            <Check size={10} color={T.green} />
            <Text style={rsStyles.hitText}>Target hit!</Text>
          </View>
        )}

        {hasLogged && !hitTarget && displayVal > 0 && (
          <Text style={rsStyles.progressText}>
            {isTreadmill
              ? `${displayVal.toFixed(1)} / ${target.toFixed(1)}km`
              : `${displayVal} / ${target} fl`}
          </Text>
        )}
      </View>
    </View>
  );
}

const rsStyles = StyleSheet.create({
  container: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: T.border,
    gap: 8,
  },
  containerDone: { opacity: 0.55 },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  targetLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  targetNum: { fontFamily: "Inter_600SemiBold", color: T.orange },
  targetElev: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, marginLeft: 2 },
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
  },
  logLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim },
  btn: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: T.surface,
    borderWidth: 1, borderColor: T.border,
    alignItems: "center", justifyContent: "center",
  },
  btnDisabled: { opacity: 0.35 },
  count: {
    fontSize: 15, fontFamily: "Inter_700Bold", color: T.textMuted,
    minWidth: 22, textAlign: "center",
  },
  countPartial: { color: T.white },
  countHit: { color: T.green },
  logElev: { fontSize: 11, fontFamily: "Inter_500Medium", color: T.orange },
  hitBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: T.greenDim,
    borderWidth: 1, borderColor: T.green + "40",
  },
  hitText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.green },
  progressText: { fontSize: 11, fontFamily: "Inter_500Medium", color: T.textMuted },
});

const { width } = Dimensions.get("window");

function getExerciseAlternatives(label: string): { name: string; icon: LucideIcon; desc: string }[] {
  const l = label.toLowerCase();
  const isStairs = l.includes("stair") || l.includes("step") || l.includes("climb");
  const isRun = l.includes("run") || l.includes("jog") || l.includes("walk");

  const stairAlts = [
    { name: "Incline Treadmill", icon: TrendingUp, desc: "10–15% incline, brisk hike pace" },
    { name: "Stepper Machine", icon: Activity, desc: "Step machine for leg drive and cardio" },
    { name: "Box Step-Ups", icon: Square, desc: "Weighted step-ups onto a box or bench" },
    { name: "Weighted Stairs", icon: Package, desc: "Stairs with a loaded pack or weight vest" },
    { name: "Elliptical (high resistance)", icon: RefreshCw, desc: "High resistance, simulate climbing effort" },
  ];
  const cardioAlts = [
    { name: "Incline Treadmill", icon: TrendingUp, desc: "10–15% incline, brisk hike pace" },
    { name: "Indoor Cycling", icon: Wind, desc: "High cadence cycling for aerobic base" },
    { name: "Rowing Machine", icon: Anchor, desc: "Full body cardio with strong leg drive" },
    { name: "Elliptical", icon: RefreshCw, desc: "Sustained aerobic effort, moderate resistance" },
    { name: "Stepper Machine", icon: Activity, desc: "Step machine for leg drive and cardio" },
    { name: "Swimming", icon: Droplet, desc: "Low impact aerobic conditioning" },
  ];
  if (isStairs) return stairAlts;
  if (isRun) return cardioAlts;
  return stairAlts; // hill training default
}

function WeekCard({
  week,
  isExpanded,
  onToggle,
  index,
  completedPlanSessions,
  submittedPlanSessions,
  sessionDayOverrides,
  autoAssignedDows,
  onToggleSession,
  onSubmitWeek,
  onEditSession,
  onSwapExercise,
  onChangeHill,
  onScheduleSession,
  onSessionPress,
}: {
  week: TrainingWeek;
  isExpanded: boolean;
  onToggle: () => void;
  index: number;
  completedPlanSessions: Record<string, boolean>;
  submittedPlanSessions: Record<string, boolean>;
  sessionDayOverrides: Record<string, number>;
  autoAssignedDows: (number | null)[];
  onToggleSession: (weekNum: number, sessionIdx: number) => void;
  onSubmitWeek: (weekNum: number) => void;
  onEditSession: (weekNum: number, sessionIdx: number) => void;
  onSwapExercise: (weekNum: number, sessionIdx: number, label: string) => void;
  onChangeHill: (weekNum: number, sessionIdx: number) => void;
  onScheduleSession: (weekNum: number, sessionIdx: number) => void;
  onSessionPress: (sessionIdx: number) => void;
}) {
  const pc = PHASE_COLOR[week.phase] ?? T.green;
  const totalSessions = week.sessions.length;
  const completedInWeek = week.sessions.filter((_, i) =>
    completedPlanSessions[week.sessions[i].id ?? `${week.weekNumber}-${i}`]
  ).length;
  const allDone = completedInWeek === totalSessions;

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(400)}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.8}
        style={[
          styles.weekCard,
          week.isCurrentWeek && { borderColor: pc + "60", borderWidth: 1.5 },
          allDone && { borderColor: T.green + "50", borderWidth: 1.5 },
        ]}
      >
        {week.isCurrentWeek && !allDone && (
          <View style={[styles.currentBanner, { backgroundColor: pc }]}>
            <Text style={styles.currentBannerText}>● CURRENT WEEK</Text>
          </View>
        )}
        {allDone && (
          <View style={[styles.currentBanner, { backgroundColor: T.green }]}>
            <Text style={styles.currentBannerText}>✓ WEEK COMPLETE</Text>
          </View>
        )}

        <LinearGradient colors={[pc + "08", "transparent"]} style={StyleSheet.absoluteFill} />

        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <View style={[styles.weekNumBadge, { backgroundColor: pc + "20" }]}>
              <Text style={[styles.weekNumText, { color: pc }]}>{week.weekNumber}</Text>
            </View>
            <View>
              <Text style={styles.phaseName}>{week.phase} Phase</Text>
              <Text style={styles.weekDates}>
                {new Date(week.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
                {new Date(week.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </Text>
            </View>
          </View>
          <View style={styles.cardRight}>
            {week.weekNumber === 1 && (
              <View style={[styles.weekBadge, { backgroundColor: T.greenDim }]}>
                <Text style={[styles.weekBadgeText, { color: T.green }]}>FREE</Text>
              </View>
            )}
            {week.isPeakWeek && (
              <View style={[styles.weekBadge, { backgroundColor: T.orangeDim }]}>
                <Text style={[styles.weekBadgeText, { color: T.orange }]}>PEAK</Text>
              </View>
            )}
            {week.isTaperWeek && (
              <View style={[styles.weekBadge, { backgroundColor: T.purpleDim }]}>
                <Text style={[styles.weekBadgeText, { color: T.purple }]}>TAPER</Text>
              </View>
            )}
            {completedInWeek > 0 && (
              <View style={[styles.weekBadge, { backgroundColor: T.greenDim }]}>
                <Text style={[styles.weekBadgeText, { color: T.green }]}>{completedInWeek}/{totalSessions}</Text>
              </View>
            )}
            {isExpanded ? <ChevronUp size={18} color={T.textMuted} /> : <ChevronDown size={18} color={T.textMuted} />}
          </View>
        </View>

        <View style={styles.cardMeta}>
          <View style={[styles.elevChip, { backgroundColor: T.orangeDim }]}>
            <TrendingUp size={12} color={T.orange} />
            <Text style={[styles.elevText, { color: T.orange }]}>{week.targetElevation}m</Text>
          </View>
          <Text style={styles.purposeSnippet} numberOfLines={isExpanded ? undefined : 1}>
            {week.purpose}
          </Text>
        </View>

        {week.adjustNote && (
          <View style={styles.adjustNoteBadge}>
            <Zap size={11} color={T.blue} />
            <Text style={styles.adjustNoteText}>{week.adjustNote}</Text>
          </View>
        )}

        {isExpanded && (
          <View style={styles.expanded}>
            <View style={[styles.divider, { backgroundColor: pc + "30" }]} />

            <Text style={styles.sectionHead}>SESSIONS</Text>
            {week.sessions.map((s, i) => {
              const sessionKey = s.id ?? `${week.weekNumber}-${i}`;
              const isDone = !!completedPlanSessions[sessionKey];
              const isSubmitted = !!submittedPlanSessions[sessionKey];
              const tc = s.type === "bigDay" ? T.orange : s.type === "cardio" ? T.blue : T.green;
              const sessionDow: number | null = sessionDayOverrides[sessionKey] !== undefined
                ? sessionDayOverrides[sessionKey]
                : (autoAssignedDows[i] ?? null);
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.sessionRow, isDone && styles.sessionRowDone, { alignItems: "center" }]}
                  onPress={() => onSessionPress(i)}
                  activeOpacity={0.85}
                >
                  <TouchableOpacity
                    onPress={() => { if (!isSubmitted) onToggleSession(week.weekNumber, i); }}
                    style={[styles.checkbox, isDone && styles.checkboxDone]}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    disabled={isSubmitted}
                  >
                    {isDone && <Check size={15} color="#fff" />}
                  </TouchableOpacity>

                  <View style={[
                    styles.sessionIcon,
                    { backgroundColor: s.type === "bigDay" ? T.orangeDim : s.type === "cardio" ? T.blueDim : T.greenDim },
                    isDone && { opacity: 0.5 },
                  ]}>
                    {s.type === "cardio" ? <Activity size={14} color={tc} /> :
                     s.type === "hill"   ? <TrendingUp size={14} color={tc} /> :
                                           <Flag size={14} color={tc} />}
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                      <Text style={[styles.sessionLabel, isDone && styles.sessionLabelDone, { flex: 1 }]} numberOfLines={1}>{s.label}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.sessionDur}>{s.duration}</Text>
                        <TouchableOpacity
                          onPress={() => onEditSession(week.weekNumber, i)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.7}
                        >
                          <Pencil size={12} color={T.textDim} />
                        </TouchableOpacity>
                        {s.type === "cardio" && (
                          <TouchableOpacity
                            onPress={() => onSwapExercise(week.weekNumber, i, s.label)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.7}
                          >
                            <RefreshCw size={12} color={T.textDim} />
                          </TouchableOpacity>
                        )}
                        {(s.type === "hill" || s.type === "bigDay") && (
                          <TouchableOpacity
                            onPress={() => onChangeHill(week.weekNumber, i)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.7}
                          >
                            <Mountain size={12} color={T.textDim} />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => onScheduleSession(week.weekNumber, i)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.7}
                        >
                          <Calendar size={12} color={sessionDow !== null ? T.blue : T.textDim} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {s.targetElevation > 0 && (
                        <Text style={[styles.sessionElev, { color: T.orange }]}>↑{s.targetElevation}m</Text>
                      )}
                      <Text style={[styles.sessionElev, { color: sessionDow !== null ? T.blue : T.textDim }]}>
                        {sessionDow !== null ? DAY_SHORT[sessionDow] : "Unscheduled"}
                      </Text>
                    </View>
                  </View>

                  {isSubmitted ? (
                    <CheckCircle size={15} color={T.green} />
                  ) : (
                    <ChevronRight size={15} color={T.textDim} />
                  )}
                </TouchableOpacity>
              );
            })}


            {/* Submit / confirmation row */}
            {(() => {
              const unsubmitted = week.sessions.filter((s, i) => {
                const key = s.id ?? `${week.weekNumber}-${i}`;
                return completedPlanSessions[key] && !submittedPlanSessions[key];
              }).length;
              const submitted = week.sessions.filter((s, i) =>
                submittedPlanSessions[s.id ?? `${week.weekNumber}-${i}`]
              ).length;

              if (unsubmitted > 0) {
                return (
                  <TouchableOpacity
                    onPress={() => onSubmitWeek(week.weekNumber)}
                    style={styles.submitWeekBtn}
                    activeOpacity={0.8}
                  >
                    <LinearGradient colors={["#3ECF75", "#2AB860"]} style={styles.submitWeekGrad}>
                      <CheckCircle size={15} color="#fff" />
                      <Text style={styles.submitWeekText}>
                        Submit {unsubmitted} completed session{unsubmitted > 1 ? "s" : ""} → update progress
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              }
              if (submitted > 0) {
                return (
                  <View style={styles.submittedBanner}>
                    <CheckCircle size={14} color={T.green} />
                    <Text style={styles.submittedBannerText}>
                      {submitted} session{submitted > 1 ? "s" : ""} submitted · dashboard updated
                    </Text>
                  </View>
                );
              }
              return null;
            })()}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Week Celebration Overlay ──────────────────────────────────────────────────
const CELEBRATION_PARTICLES = [
  { emoji: "🎉", xPct: 0.12 },
  { emoji: "🏔️", xPct: 0.28 },
  { emoji: "✨", xPct: 0.48 },
  { emoji: "🌟", xPct: 0.65 },
  { emoji: "💪", xPct: 0.80 },
  { emoji: "⛰️", xPct: 0.95 },
];

function WeekCelebrationOverlay({
  visible,
  weekNum,
  hasNextWeek,
  onDismiss,
  onViewNextWeek,
}: {
  visible: boolean;
  weekNum: number;
  hasNextWeek: boolean;
  onDismiss: () => void;
  onViewNextWeek: () => void;
}) {
  const cardW = width - 32;

  // Banner entrance
  const bannerScale = useSharedValue(0.88);
  const bannerOpacity = useSharedValue(0);

  // 6 particle pairs (y + opacity) — fixed count so hook rules are respected
  const p0y = useSharedValue(0); const p0o = useSharedValue(0);
  const p1y = useSharedValue(0); const p1o = useSharedValue(0);
  const p2y = useSharedValue(0); const p2o = useSharedValue(0);
  const p3y = useSharedValue(0); const p3o = useSharedValue(0);
  const p4y = useSharedValue(0); const p4o = useSharedValue(0);
  const p5y = useSharedValue(0); const p5o = useSharedValue(0);

  const particleYs = [p0y, p1y, p2y, p3y, p4y, p5y];
  const particleOs = [p0o, p1o, p2o, p3o, p4o, p5o];

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: bannerOpacity.value,
    transform: [{ scale: bannerScale.value }],
  }));
  const p0Style = useAnimatedStyle(() => ({ opacity: p0o.value, transform: [{ translateY: p0y.value }] }));
  const p1Style = useAnimatedStyle(() => ({ opacity: p1o.value, transform: [{ translateY: p1y.value }] }));
  const p2Style = useAnimatedStyle(() => ({ opacity: p2o.value, transform: [{ translateY: p2y.value }] }));
  const p3Style = useAnimatedStyle(() => ({ opacity: p3o.value, transform: [{ translateY: p3y.value }] }));
  const p4Style = useAnimatedStyle(() => ({ opacity: p4o.value, transform: [{ translateY: p4y.value }] }));
  const p5Style = useAnimatedStyle(() => ({ opacity: p5o.value, transform: [{ translateY: p5y.value }] }));
  const particleStyles = [p0Style, p1Style, p2Style, p3Style, p4Style, p5Style];

  useEffect(() => {
    if (visible) {
      // Animate banner in
      bannerScale.value = withSpring(1, { damping: 14, stiffness: 160 });
      bannerOpacity.value = withTiming(1, { duration: 320 });

      // Launch particles with staggered delays
      const delays = [0, 80, 40, 160, 100, 220];
      particleYs.forEach((py, i) => {
        const po = particleOs[i];
        const d = delays[i];
        py.value = 0;
        po.value = 0;
        py.value = withDelay(d, withTiming(-160, { duration: 1500 }));
        po.value = withDelay(
          d,
          withSequence(
            withTiming(1, { duration: 180 }),
            withDelay(700, withTiming(0, { duration: 620 }))
          )
        );
      });
    } else {
      bannerScale.value = withTiming(0.92, { duration: 180 });
      bannerOpacity.value = withTiming(0, { duration: 180 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[celebStyles.card, bannerStyle]}>
      {/* Green glow gradient */}
      <LinearGradient
        colors={["rgba(62,207,117,0.18)", "rgba(62,207,117,0.04)"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Floating emoji particles */}
      <View style={celebStyles.particleContainer} pointerEvents="none">
        {CELEBRATION_PARTICLES.map((p, i) => (
          <Animated.Text
            key={i}
            style={[
              celebStyles.particle,
              { left: cardW * p.xPct - 12 },
              particleStyles[i],
            ]}
          >
            {p.emoji}
          </Animated.Text>
        ))}
      </View>

      {/* Header */}
      <View style={celebStyles.headerRow}>
        <View style={celebStyles.weekBadge}>
          <Text style={celebStyles.weekBadgeText}>WEEK {weekNum}</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={celebStyles.title}>Week Complete! 🎉</Text>
      <Text style={celebStyles.subtitle}>
        All sessions done — outstanding work. Keep the momentum going!
      </Text>

      {/* Completion pip row */}
      <View style={celebStyles.pipRow}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={celebStyles.pip} />
        ))}
      </View>

      {/* CTAs */}
      <View style={celebStyles.btnRow}>
        {hasNextWeek && (
          <TouchableOpacity
            style={celebStyles.nextWeekBtn}
            activeOpacity={0.85}
            onPress={onViewNextWeek}
          >
            <LinearGradient colors={["#3ECF75", "#2AB860"]} style={celebStyles.nextWeekInner}>
              <Text style={celebStyles.nextWeekText}>View Next Week</Text>
              <ChevronRight size={15} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[celebStyles.dismissBtn, !hasNextWeek && { flex: 1 }]}
          activeOpacity={0.7}
          onPress={onDismiss}
        >
          <Text style={celebStyles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const celebStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: T.green + "55",
    backgroundColor: T.card,
    padding: 20,
    overflow: "hidden",
    gap: 12,
  },
  particleContainer: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    height: 180,
    pointerEvents: "none",
  } as any,
  particle: {
    position: "absolute",
    fontSize: 22,
    bottom: 0,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  weekBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: T.greenDim,
    borderWidth: 1,
    borderColor: T.green + "50",
  },
  weekBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: T.green,
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: T.white,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    lineHeight: 20,
  },
  pipRow: {
    flexDirection: "row",
    gap: 6,
    marginVertical: 4,
  },
  pip: {
    width: 28,
    height: 5,
    borderRadius: 3,
    backgroundColor: T.green,
    opacity: 0.8,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  nextWeekBtn: {
    flex: 1.5,
    borderRadius: 14,
    overflow: "hidden",
  },
  nextWeekInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
  },
  nextWeekText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  dismissBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
  },
  dismissText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: T.textMuted,
  },
});

export default function PlanScreen() {
  useScreenView("plan");
  const insets = useSafeAreaInsets();
  const {
    summitGoal,
    trainingPlan,
    completedPlanSessions,
    nearbyHills,
    submittedPlanSessions,
    sessionEfforts,
    togglePlanSession,
    assignHillToSession,
    assignedHills,
    planAdjustNote,
    submitWeekSessions,
    setSessionReps,
    setSessionEffort,
    updatePlanSession,
    addToNearbyHills,
    sessions,
    exploreHikes,
    sessionDayOverrides,
    setSessionDayOverride,
    clearSessionDayOverride,
    patchGoal,
  } = useApp();

  async function handleSubmitWeek(weekNum: number) {
    await submitWeekSessions(weekNum);
  }

  const { isSubscribed } = useSubscription();
  const currentWeek = getCurrentWeek(trainingPlan);
  const [heroImageError, setHeroImageError] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(
    new Set(currentWeek ? [currentWeek.weekNumber] : [])
  );
  const [hillPickerOpen, setHillPickerOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<{ weekNum: number; sessionIdx: number } | null>(null);
  const [dayPickerFor, setDayPickerFor] = useState<{ weekNum: number; sessionIdx: number } | null>(null);

  /* Which section of the plan is showing. Two real sections only — the
     prototype sketches a third, and production has nothing truthful for it. */
  const [planSection, setPlanSection] = useState<"schedule" | "full">("schedule");

  // Mission dashboard navigation state
  const [viewedWeekNum, setViewedWeekNum] = useState<number>(currentWeek?.weekNumber ?? 1);
  const [selectedDow, setSelectedDow] = useState<number>(new Date().getDay());

  // Week completion celebration
  const [showWeekCelebration, setShowWeekCelebration] = useState(false);
  const [celebratedWeeks, setCelebratedWeeks] = useState<Set<number>>(new Set());
  // Swipe ref pattern: keeps advanceDay fresh without recreating PanResponder
  const missionSwipeRef = useRef<(dir: 1 | -1) => void>(() => {});
  const missionPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5,
      onPanResponderRelease: (_, { dx }) => {
        if (dx < -50) missionSwipeRef.current(1);
        else if (dx > 50) missionSwipeRef.current(-1);
      },
    })
  ).current;

  // Edit session modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{ weekNum: number; sessionIdx: number } | null>(null);
  const [editDuration, setEditDuration] = useState("");
  const [editEffort, setEditEffort] = useState<1 | 2 | 3 | 4 | 5>(3);

  // Swap exercise modal state
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<{ weekNum: number; sessionIdx: number; label: string } | null>(null);

  function toggle(n: number) {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  function openHillPicker(weekNum: number, sessionIdx: number) {
    setActiveSession({ weekNum, sessionIdx });
    setHillPickerOpen(true);
  }

  function handleHillSelect(hill: NearbyHill) {
    if (activeSession) {
      const week = trainingPlan.find(w => w.weekNumber === activeSession.weekNum);
      const session = week?.sessions[activeSession.sessionIdx];
      // Fit reps to keep total gain close to the session's target, not the hill's default
      const sessionTarget = session?.targetElevation ?? hill.elevation * hill.repeats;
      const adjustedReps = Math.max(1, Math.round(sessionTarget / Math.max(1, hill.elevation)));
      const adjustedHill: NearbyHill = { ...hill, repeats: adjustedReps, totalElevation: adjustedReps * hill.elevation };
      assignHillToSession(activeSession.weekNum, activeSession.sessionIdx, adjustedHill);
      updatePlanSession(activeSession.weekNum, activeSession.sessionIdx, {
        label: `Hill Repeats — ${hill.name}`,
        targetElevation: adjustedHill.totalElevation,
      });
    }
    setHillPickerOpen(false);
    setActiveSession(null);
  }

  function openEditSession(weekNum: number, sessionIdx: number) {
    const week = trainingPlan.find(w => w.weekNumber === weekNum);
    const session = week?.sessions[sessionIdx];
    if (!session) return;
    const key = trainingPlan.find(w => w.weekNumber === weekNum)?.sessions[sessionIdx]?.id
      ?? `${weekNum}-${sessionIdx}`;
    setEditTarget({ weekNum, sessionIdx });
    setEditDuration(session.duration);
    setEditEffort((sessionEfforts[key] ?? 3) as 1 | 2 | 3 | 4 | 5);
    setEditModalOpen(true);
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    const key = `${editTarget.weekNum}-${editTarget.sessionIdx}`;
    await updatePlanSession(editTarget.weekNum, editTarget.sessionIdx, {
      duration: editDuration.trim() || editDuration,
    });
    await setSessionEffort(key, editEffort);
    setEditModalOpen(false);
    setEditTarget(null);
  }

  function openSwapExercise(weekNum: number, sessionIdx: number, label: string) {
    setSwapTarget({ weekNum, sessionIdx, label });
    setSwapModalOpen(true);
  }

  async function handleSwapSelect(newLabel: string, newDescription: string) {
    if (!swapTarget) return;
    const week = trainingPlan.find(w => w.weekNumber === swapTarget.weekNum);
    const session = week?.sessions[swapTarget.sessionIdx];
    const duration = session?.duration ?? "30–40 min";
    const midDur = parseDurationMidpoint(duration);
    const l = newLabel.toLowerCase();

    const updates: Parameters<typeof updatePlanSession>[2] = {
      label: newLabel,
      description: newDescription,
    };

    if (l.includes("treadmill")) {
      const targetDistanceKm = Math.max(0.5, Math.round((midDur / 60) * 4.5 * 10) / 10);
      updates.type = "cardio";
      updates.gymExercise = "treadmill";
      updates.targetDistanceKm = targetDistanceKm;
      updates.targetElevation = Math.round(targetDistanceKm * 100);
      updates.inclinePct = 10;
    } else if (l.includes("stepper") || l.includes("step machine") || l.includes("stairmaster")) {
      const targetFloors = Math.max(10, Math.round(midDur * 3));
      updates.type = "cardio";
      updates.gymExercise = "stepper";
      updates.targetFloors = targetFloors;
      updates.targetElevation = targetFloors * 3;
    } else {
      updates.type = "cardio";
      updates.gymExercise = undefined;
      updates.targetDistanceKm = undefined;
      updates.targetFloors = undefined;
      updates.inclinePct = undefined;
      updates.targetElevation = 0;
    }

    await updatePlanSession(swapTarget.weekNum, swapTarget.sessionIdx, updates);
    setSwapModalOpen(false);
    setSwapTarget(null);
  }

  // Sync viewed week to current week once plan loads
  useEffect(() => {
    if (currentWeek && viewedWeekNum <= 1) {
      setViewedWeekNum(currentWeek.weekNumber);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeek?.weekNumber]);

  // Detect week completion and trigger celebration
  const viewedWeekForEffect = trainingPlan.find(w => w.weekNumber === viewedWeekNum);
  const isViewedWeekCompleteSig = viewedWeekForEffect
    ? viewedWeekForEffect.sessions.every((_, i) =>
        !!completedPlanSessions[`${viewedWeekNum}-${i}`]
      )
    : false;

  useEffect(() => {
    if (
      isViewedWeekCompleteSig &&
      viewedWeekForEffect &&
      viewedWeekForEffect.sessions.length > 0 &&
      !celebratedWeeks.has(viewedWeekNum)
    ) {
      setShowWeekCelebration(true);
      setCelebratedWeeks(prev => new Set([...prev, viewedWeekNum]));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewedWeekCompleteSig, viewedWeekNum]);

  // Hide celebration when user navigates to a different week
  useEffect(() => {
    setShowWeekCelebration(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewedWeekNum]);

  if (!summitGoal) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center" }}>
          <Calendar size={28} color={T.blue} />
        </View>
        <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: T.white }}>No plan yet</Text>
        <TouchableOpacity
          onPress={() => router.push("/setup")}
          style={{ paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14, backgroundColor: T.green }}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Set up my summit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (trainingPlan.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center" }}>
          <Calendar size={28} color={T.blue} />
        </View>
        <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: T.white }}>No plan yet</Text>
        <TouchableOpacity
          onPress={() => router.push("/setup")}
          style={{ paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14, backgroundColor: T.green }}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Set up my summit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalWeeks = trainingPlan.length;
  const weeksLeft = trainingPlan.filter(w => new Date(w.endDate) >= new Date()).length;
  const phases = [...new Set(trainingPlan.map(w => w.phase))];
  const weeksCompleted = trainingPlan.filter(w => new Date(w.endDate) < new Date()).length;
  const progressPct = totalWeeks > 0 ? Math.min(100, (weeksCompleted / totalWeeks) * 100) : 0;
  const pc = PHASE_COLOR[currentWeek?.phase ?? "Base"] ?? T.green;
  const totalElevTrained =
    sessions.reduce((sum, s) => sum + (s.elevationGain || 0), 0) +
    exploreHikes.reduce((sum, h) => sum + (h.elevationGain || 0), 0);
  const daysToSummit = Math.ceil(
    (new Date(summitGoal.summitDate + "T12:00:00").getTime() - Date.now()) / 86400000
  );
  const nextSession = currentWeek
    ? (() => {
        for (let i = 0; i < currentWeek.sessions.length; i++) {
          const key = `${currentWeek.weekNumber}-${i}`;
          if (!completedPlanSessions[key]) {
            return { session: currentWeek.sessions[i], weekNum: currentWeek.weekNumber, sessionIdx: i };
          }
        }
        return null;
      })()
    : null;
  const heroImageUri = !heroImageError
    ? `${PLAN_API_BASE}/mountain-image?name=${encodeURIComponent(summitGoal.mountainName)}`
    : null;

  // ── Elevation Bank ─────────────────────────────────────────────────────────
  const elevationMultiplier = summitGoal.elevationGain > 0
    ? totalElevTrained / summitGoal.elevationGain : 0;
  const summitDisplayName = summitGoal.mountainName.split(/[\s,]+/)[0];
  const elevBankLabel = totalElevTrained >= 1000
    ? `${(totalElevTrained / 1000).toFixed(1)}k m`
    : `${Math.round(totalElevTrained)} m`;

  // ── Mission Dashboard — viewed week & day-session mapping ──────────────────
  /* Readiness 2.0 — the figure Training Basecamp states. */
  const readinessV2 = useReadinessV2();
  const heroReadiness = readinessV2?.result?.overallScore ?? null;
  const readinessColor = heroReadiness === null
    ? T.textMuted
    : heroReadiness >= 70 ? T.green : heroReadiness >= 40 ? T.orange : "#EF4444";

  const viewedWeek = trainingPlan.find(w => w.weekNumber === viewedWeekNum) ?? trainingPlan[0];

  /* The viewed week's own dates, and — when the plan has not begun — how far
     off it is. Both read the plan the engine generated; neither changes it. */
  const viewedWeekRange = weekDateRange(viewedWeek?.startDate, viewedWeek?.endDate);
  const viewedWeekDays = planWeekDays(viewedWeek?.startDate);
  const displayOrder = viewedWeekDays.map(day => day.dow);
  const weeksUntilStart = weeksUntilPlanStart(trainingPlan[0]?.startDate);
  const viewedAutoAssigned = viewedWeek
    ? assignSessionsToDays(viewedWeek.sessions.length, summitGoal.availableDays)
    : [];
  const viewedDowToSession: Record<number, number> = {};
  for (const { sessionIdx, dayOfWeek } of viewedAutoAssigned) {
    const key = `${viewedWeek?.weekNumber}-${sessionIdx}`;
    const dow = sessionDayOverrides[key] !== undefined ? sessionDayOverrides[key] : dayOfWeek;
    if (dow !== null && viewedDowToSession[dow] === undefined) {
      viewedDowToSession[dow] = sessionIdx;
    }
  }

  // ── Day Picker modal computed props ────────────────────────────────────────
  const dayPickerWeek = dayPickerFor
    ? trainingPlan.find(w => w.weekNumber === dayPickerFor.weekNum) ?? null
    : null;
  const _dayPickerAuto = dayPickerWeek
    ? assignSessionsToDays(dayPickerWeek.sessions.length, summitGoal.availableDays)
    : [];
  const dayPickerCurrentDow: number | null = dayPickerFor
    ? (sessionDayOverrides[`${dayPickerFor.weekNum}-${dayPickerFor.sessionIdx}`]
       ?? _dayPickerAuto.find(a => a.sessionIdx === dayPickerFor.sessionIdx)?.dayOfWeek
       ?? null)
    : null;
  const dayPickerHasOverride = dayPickerFor
    ? sessionDayOverrides[`${dayPickerFor.weekNum}-${dayPickerFor.sessionIdx}`] !== undefined
    : false;
  const dayPickerOccupied: Partial<Record<number, OccupiedDay>> = {};
  if (dayPickerFor && dayPickerWeek) {
    dayPickerWeek.sessions.forEach((s, i) => {
      if (i === dayPickerFor.sessionIdx) return;
      const key = `${dayPickerFor.weekNum}-${i}`;
      const dow = sessionDayOverrides[key] !== undefined
        ? sessionDayOverrides[key]
        : (_dayPickerAuto.find(a => a.sessionIdx === i)?.dayOfWeek ?? null);
      if (dow !== null) dayPickerOccupied[dow] = { label: s.label, type: s.type };
    });
  }
  const dayPickerLabel = dayPickerFor && dayPickerWeek
    ? (dayPickerWeek.sessions[dayPickerFor.sessionIdx]?.label ?? "")
    : "";
  const selectedSessionIdx = viewedDowToSession[selectedDow];
  const selectedSession = selectedSessionIdx !== undefined ? viewedWeek?.sessions[selectedSessionIdx] : undefined;
  const selectedSessionKey = viewedWeek && selectedSessionIdx !== undefined
    ? `${viewedWeek.weekNumber}-${selectedSessionIdx}` : "";
  const selectedIsDone = selectedSessionKey ? !!completedPlanSessions[selectedSessionKey] : false;
  // Prefer explicit assignment; fall back to the plan generator's hill for this week
  const selectedHill = viewedWeek && selectedSessionIdx !== undefined
    ? (assignedHills[`${viewedWeek.weekNumber}-${selectedSessionIdx}`]
        ?? (selectedSession?.type !== "cardio" && viewedWeek.hills[0]
            ? { ...viewedWeek.hills[0], emoji: "⛰️", surface: "Mixed", grade: "Moderate" }
            : undefined))
    : undefined;
  const _missionCardioText = selectedSession
    ? `${selectedSession.label} ${selectedSession.description ?? ""}`.toLowerCase()
    : "";
  const _missionGymEx = selectedSession?.gymExercise
    ?? (_missionCardioText.includes("treadmill") ? "treadmill"
      : _missionCardioText.includes("stepper") || _missionCardioText.includes("stairmaster") ? "stepper"
      : _missionCardioText.includes("elliptical") ? "elliptical"
      : (_missionCardioText.includes("stair") && !_missionCardioText.includes("stairmaster"))
        || _missionCardioText.includes("flights")
        || _missionCardioText.includes("uphill")
        || _missionCardioText.includes("brisk walk") ? "outdoor"
      : selectedSession?.type === "cardio" ? "outdoor"
      : undefined);
  /* `missionImageSource` used to be assembled here and never rendered — dead
     since the panel carried no photograph. The panel now has one, and it is
     built by `missionBleedUri` below, which refuses generated artwork. */

  /* The session panel's bleed photograph is a PLACE — the assigned hill, or
     the objective. The exercise assets are generated artwork carrying their
     own large lettering ("INCLINE TREADMILL"), designed to fill a hero, not to
     sit behind a title; bled into a panel their type shows through the
     description. A gym session therefore gets no bleed at all. */
  const missionBleedUri = _missionGymEx
    ? null
    : mountainImageUri(
        sessionImageSubject({
          assignedHillName: selectedHill?.name ?? null,
          mountainName: summitGoal.mountainName,
        }),
        { width: 260, height: 280 },
      );

  // Upcoming this week: rest of the week's sessions (not the selected one)
  const upcomingSessions = viewedWeek
    ? viewedWeek.sessions
        .map((s, idx) => {
          const auto = viewedAutoAssigned.find(a => a.sessionIdx === idx);
          const overrideKey = `${viewedWeek.weekNumber}-${idx}`;
          const dow = sessionDayOverrides[overrideKey] !== undefined
            ? sessionDayOverrides[overrideKey]
            : (auto?.dayOfWeek ?? null);
          return { session: s, sessionIdx: idx, dow };
        })
        .filter(({ sessionIdx }) => sessionIdx !== selectedSessionIdx)
        .sort((a, b) => {
          const da = a.dow ?? 99;
          const db = b.dow ?? 99;
          return da - db;
        })
    : [];

  /* The whole week, not only what is left of it: the rail is a record of the
     week as well as a queue, so a completed session stays visible with its
     tick rather than disappearing. `upcomingSessions` (the selected day
     excluded) is still what the swipe and reschedule logic reads. */
  const weekSessions = viewedWeek
    ? viewedWeek.sessions.map((session, sessionIdx) => {
        const auto = viewedAutoAssigned.find(a => a.sessionIdx === sessionIdx);
        const overrideKey = `${viewedWeek.weekNumber}-${sessionIdx}`;
        const dow = sessionDayOverrides[overrideKey] !== undefined
          ? sessionDayOverrides[overrideKey]
          : (auto?.dayOfWeek ?? null);
        return { session, sessionIdx, dow };
      }).sort((a, b) => (a.dow ?? 99) - (b.dow ?? 99))
    : [];
  const weekDoneCount = weekSessions.filter(
    ({ sessionIdx }) => !!completedPlanSessions[`${viewedWeek?.weekNumber}-${sessionIdx}`],
  ).length;

  // Keep swipe callback fresh
  missionSwipeRef.current = (dir: 1 | -1) => {
    const currentDowIdx = displayOrder.indexOf(selectedDow);
    if (currentDowIdx === -1) return;
    const nextDowIdx = currentDowIdx + dir;
    if (nextDowIdx >= 0 && nextDowIdx < displayOrder.length) {
      setSelectedDow(displayOrder[nextDowIdx]);
    } else if (nextDowIdx >= displayOrder.length) {
      const nextW = trainingPlan.find(w => w.weekNumber === viewedWeekNum + 1);
      if (nextW) {
        setViewedWeekNum(nextW.weekNumber);
        setSelectedDow(planWeekDays(nextW.startDate)[0].dow);
      }
    } else {
      const prevW = trainingPlan.find(w => w.weekNumber === viewedWeekNum - 1);
      if (prevW) {
        setViewedWeekNum(prevW.weekNumber);
        setSelectedDow(planWeekDays(prevW.startDate)[6].dow);
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: BASECAMP.ink }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── The goal, compactly ──────────────────────────────────────
            The Training Basecamp hero at plan scale: the objective, the
            authoritative readiness figure and the countdown. Photograph via
            the existing mountain-image service, with the designed gradient
            when it is unavailable. */}
        <SRHeroFrame
          uri={heroImageUri}
          onImageError={() => setHeroImageError(true)}
          minHeight={252}
          dim={0.95}
          style={{ justifyContent: "space-between" }}
        >
          <View style={{ paddingTop: Platform.OS === "web" ? 18 : insets.top + 8 }}>
            {/* The mode toggle has a row of its own, above the title. The
                floating toggle used to land on top of this header because
                both are centred at the top of the window; Training Plan now
                owns its toggle, so the two can no longer collide. */}
            <View style={dash.modeRow}>
              <ModeTogglePill embedded />
            </View>
            <SRScreenHeader
              scrim
              title="Training plan"
              subtitle={currentWeek ? `${currentWeek.phase} phase · week ${currentWeek.weekNumber} of ${totalWeeks}` : null}
              onBack={() => router.push("/(tabs)/dashboard")}
              right={
                <TouchableOpacity
                  onPress={() => router.push("/setup")}
                  hitSlop={HIT.slop}
                  accessibilityRole="button"
                  accessibilityLabel="Plan settings"
                >
                  <Settings size={18} color={BASECAMP.textStrong} />
                </TouchableOpacity>
              }
            />
          </View>

          <View style={dash.heroBody}>
            <SREyebrow tone={BASECAMP.accent}>YOUR GOAL</SREyebrow>
            <Text style={dash.goalName} numberOfLines={2}>{summitGoal.mountainName}</Text>

            <View style={dash.heroMeta}>
              {/* The SAME readiness Basecamp shows. This hero previously read
                  the legacy context score while Basecamp read Readiness 2.0,
                  so the two screens could state different figures for the same
                  user. Neither engine changed; this reads the authoritative
                  one. A score the engine cannot produce shows an em dash
                  rather than a confident-looking zero. */}
              <View style={dash.heroReadiness}>
                <Text style={dash.heroMetaLabel}>Readiness</Text>
                <Text style={dash.heroMetaValue}>
                  {heroReadiness === null ? "—" : `${heroReadiness}%`}
                </Text>
                <SRProgress
                  value={heroReadiness ?? 0}
                  height={7}
                  style={{ marginTop: 6 }}
                  accessibilityLabel={heroReadiness === null
                    ? "Readiness unavailable"
                    : `Readiness ${heroReadiness} percent`}
                />
              </View>
              <View style={dash.heroDivider} />
              <View>
                <Text style={dash.heroCount}>
                  {Math.max(0, daysToSummit).toLocaleString()}
                </Text>
                <Text style={dash.heroMetaLabel}>days to go</Text>
              </View>
            </View>
          </View>
        </SRHeroFrame>

        {/* ── Sections ─────────────────────────────────────────────────
            Two real sections. The prototype sketches a third, but production
            has nothing truthful to put behind it, so it is not drawn. */}
        <SRUnderlineTabs
          style={{ marginTop: 4 }}
          value={planSection}
          onChange={setPlanSection}
          options={[
            { value: "schedule", label: "Schedule" },
            { value: "full", label: "Full plan" },
          ]}
        />

        {planSection === "schedule" ? (
          <>
            {/* ── Week navigator ───────────────────────────────────── */}
            <View style={dash.weekNav}>
              <TouchableOpacity
                onPress={() => {
                  const prev = trainingPlan.find(w => w.weekNumber === viewedWeekNum - 1);
                  if (prev) { setViewedWeekNum(viewedWeekNum - 1); setSelectedDow(new Date().getDay()); }
                }}
                style={[dash.weekNavBtn, viewedWeekNum <= 1 && { opacity: 0.25 }]}
                disabled={viewedWeekNum <= 1}
                hitSlop={HIT.slop}
                accessibilityRole="button"
                accessibilityLabel="Previous week"
                accessibilityState={{ disabled: viewedWeekNum <= 1 }}
              >
                <ChevronLeft size={15} color={BASECAMP.text} />
              </TouchableOpacity>

              <View style={dash.weekNavCentre}>
                <Text style={dash.weekNavTitle} accessibilityRole="header" numberOfLines={1}>
                  WEEK {viewedWeekNum} OF {totalWeeks}
                </Text>
                {/* The week's real dates. Without them "week 1 of 8" beside a
                    target 109 days away reads as a contradiction; with them it
                    is obviously an eight-week block scheduled to finish on the
                    target date. The dates are the plan engine's own. */}
                <Text style={dash.weekNavSub} numberOfLines={1}>
                  {[
                    viewedWeekRange,
                    viewedWeek?.isCurrentWeek ? "This week" : null,
                    viewedWeek?.phase ?? null,
                  ].filter(Boolean).join(" · ")}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  const next = trainingPlan.find(w => w.weekNumber === viewedWeekNum + 1);
                  if (next) { setViewedWeekNum(viewedWeekNum + 1); setSelectedDow(new Date().getDay()); }
                }}
                style={[dash.weekNavBtn, viewedWeekNum >= trainingPlan.length && { opacity: 0.25 }]}
                disabled={viewedWeekNum >= trainingPlan.length}
                hitSlop={HIT.slop}
                accessibilityRole="button"
                accessibilityLabel="Next week"
                accessibilityState={{ disabled: viewedWeekNum >= trainingPlan.length }}
              >
                <ChevronRight size={15} color={BASECAMP.text} />
              </TouchableOpacity>
            </View>

            {/* ── When the plan begins ─────────────────────────────────
                A plan can legitimately sit ahead of today: when there is more
                time than the block needs, the engine schedules it to FINISH on
                the target date rather than starting immediately. Without this
                line "week 1 of 8" beside a target months away reads as a
                fault. The engine is unchanged; this states what it decided. */}
            {weeksUntilStart !== null && (
              <Text style={dash.planStartNote}>
                {`Your ${totalWeeks}-week plan is scheduled to finish on your target date, so it begins in about ${weeksUntilStart} ${weeksUntilStart === 1 ? "week" : "weeks"}. You can start it now from Plan settings.`}
              </Text>
            )}

            {/* ── The week, day by day ─────────────────────────────────
                One cell per day. A day with no prescribed session is a rest
                day and says so — it is not left blank. */}
            <View style={dash.strip}>
              {viewedWeekDays.map(({ dow, date: cellDate, isToday: isTodayCell }) => {
                const sIdx = viewedDowToSession[dow];
                const session = sIdx !== undefined ? viewedWeek?.sessions[sIdx] : undefined;
                const isDone = sIdx !== undefined
                  && !!completedPlanSessions[`${viewedWeek?.weekNumber}-${sIdx}`];
                const isSelected = dow === selectedDow;
                /* Today is a real calendar match against the week's own
                   dates, not "the plan says this is the current week and the
                   weekday matches" — a plan that has not begun has no today. */
                const isToday = isTodayCell;
                const label = session
                  ? (session.type === "hill" ? "Hill" : session.type === "bigDay" ? "Big day" : "Cardio")
                  : "Rest";
                return (
                  <TouchableOpacity
                    key={dow}
                    style={[dash.dayCell, isSelected && dash.dayCellOn]}
                    onPress={() => setSelectedDow(dow)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${DAY_SHORT[dow]}: ${label}${isDone ? ", complete" : ""}`}
                  >
                    <Text style={[dash.dayName, isToday && { color: BASECAMP.accent }]} numberOfLines={1}>
                      {DAY_SHORT[dow]}
                    </Text>
                    {cellDate !== null && (
                      <Text style={[dash.dayDate, isToday && { color: BASECAMP.accent }]} numberOfLines={1}>
                        {cellDate}
                      </Text>
                    )}
                    <View style={dash.dayGlyph}>
                      {session ? (
                        isDone ? <Check size={14} color={BASECAMP.accent} strokeWidth={3} />
                          : session.type === "hill" ? <TrendingUp size={14} color={BASECAMP.accent} />
                          : session.type === "bigDay" ? <Flag size={14} color={BASECAMP.accent} />
                          : <Activity size={14} color={BASECAMP.accent} />
                      ) : <View style={dash.restDot} />}
                    </View>
                    <Text
                      style={[dash.dayType, !session && { color: BASECAMP.textFaint }]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                    <View style={[
                      dash.dayDot,
                      isDone && { backgroundColor: BASECAMP.accent },
                      !isDone && session && { backgroundColor: "rgba(36,239,164,0.40)" },
                    ]} />
                  </TouchableOpacity>
                );
              })}
            </View>

            <WeekCelebrationOverlay
              visible={showWeekCelebration}
              weekNum={viewedWeekNum}
              hasNextWeek={!!trainingPlan.find(w => w.weekNumber === viewedWeekNum + 1)}
              onDismiss={() => setShowWeekCelebration(false)}
              onViewNextWeek={() => {
                const nextW = trainingPlan.find(w => w.weekNumber === viewedWeekNum + 1);
                if (nextW) {
                  setViewedWeekNum(viewedWeekNum + 1);
                  setSelectedDow(new Date().getDay());
                }
                setShowWeekCelebration(false);
              }}
            />

            {/* ── The selected day ─────────────────────────────────────
                Every action is the existing one: GPS tracking carries the
                same params, the hill picker and the editor open unchanged. */}
            <View style={dash.section} {...missionPanResponder.panHandlers}>
              {selectedSession && viewedWeek && selectedSessionIdx !== undefined ? (
                <SRPanel radius={18}>
                  {/* The session's own photograph, bleeding in from the right
                      as the approved panel has it. Only ever a place, and only
                      when one is known — see `missionBleedUri`. */}
                  {missionBleedUri && (
                  <View style={dash.missionPhoto} pointerEvents="none">
                    <Image
                      source={{ uri: missionBleedUri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                      accessible={false}
                    />
                    <LinearGradient
                      colors={["rgba(11,18,19,0.98)", "rgba(11,18,19,0.32)", "rgba(11,18,19,0)"]}
                      locations={[0, 0.46, 1]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={StyleSheet.absoluteFill}
                    />
                    {/* Fully inked by the foot of the block, so the photograph
                        resolves into the panel instead of ending on a line. */}
                    <LinearGradient
                      colors={["rgba(11,18,19,0)", "rgba(11,18,19,0.72)", "rgb(11,18,19)"]}
                      locations={[0.38, 0.8, 1]}
                      style={StyleSheet.absoluteFill}
                    />
                  </View>
                  )}

                  <View style={dash.missionBody}>
                    <View style={[dash.missionTop, missionBleedUri && dash.missionTopInset]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={dash.missionPills}>
                          <SRStatusPill
                            label={selectedSession.type === "hill" ? "Hill session"
                              : selectedSession.type === "bigDay" ? "Big day" : "Cardio"}
                            tone={BASECAMP.accent}
                          />
                          {completedPlanSessions[selectedSessionKey ?? ""] ? (
                            <SRStatusPill label="Completed" tone={BASECAMP.accent} />
                          ) : null}
                        </View>
                        <Text style={dash.missionTitle} numberOfLines={2}>{selectedSession.label}</Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => openEditSession(viewedWeek.weekNumber, selectedSessionIdx)}
                        hitSlop={HIT.slop}
                        style={dash.missionEdit}
                        accessibilityRole="button"
                        accessibilityLabel="Edit this session"
                      >
                        <Pencil size={14} color={BASECAMP.textDim} />
                      </TouchableOpacity>
                    </View>

                    <View style={dash.missionFacts}>
                      <Text style={dash.missionFact} numberOfLines={1}>{selectedSession.duration}</Text>
                      {selectedSession.targetElevation > 0 && (
                        <>
                          <SRFactDivider />
                          <Text style={dash.missionFact} numberOfLines={1}>
                            {selectedSession.targetElevation.toLocaleString()} m gain
                          </Text>
                        </>
                      )}
                      {selectedHill?.name ? (
                        <>
                          <SRFactDivider />
                          <Text style={dash.missionFact} numberOfLines={1}>{selectedHill.name}</Text>
                        </>
                      ) : null}
                    </View>

                    {selectedSession.description ? (
                      <Text style={dash.missionDesc} numberOfLines={3}>{selectedSession.description}</Text>
                    ) : null}

                    <View style={dash.missionActions}>
                      <SRButton
                        compact
                        label="Start session"
                        style={{ flexGrow: 1, flexBasis: 150 }}
                        icon={<Play size={13} color={BASECAMP.accentInk} fill={BASECAMP.accentInk} />}
                        onPress={() => {
                          if (!viewedWeek) return;
                          if (selectedSession.type === "hill" || selectedSession.type === "bigDay") {
                            router.push({
                              pathname: "/hike-tracking",
                              params: {
                                hillSessionKey: selectedSessionKey,
                                hillName: selectedHill?.name ?? selectedSession.label,
                                targetReps: String(viewedWeek.hills[0]?.repeats ?? 2),
                                estimatedGainPerRep: String(selectedHill?.elevation ?? Math.round((selectedSession.targetElevation || 0) / Math.max(1, viewedWeek.hills[0]?.repeats ?? 2))),
                                estimatedTotalGain: String(selectedSession.targetElevation ?? 0),
                              },
                            });
                          } else {
                            router.push({
                              pathname: "/session-detail",
                              params: { weekNum: String(viewedWeek.weekNumber), sessionIdx: String(selectedSessionIdx) },
                            });
                          }
                        }}
                      />
                      <SRButton
                        compact
                        variant="secondary"
                        label="Details"
                        style={{ flexGrow: 1, flexBasis: 110 }}
                        onPress={() => viewedWeek && router.push({
                          pathname: "/session-detail",
                          params: { weekNum: String(viewedWeek.weekNumber), sessionIdx: String(selectedSessionIdx) },
                        })}
                      />
                    </View>

                    {(selectedSession.type === "hill" || selectedSession.type === "bigDay") && (
                      <TouchableOpacity
                        onPress={() => openHillPicker(viewedWeek.weekNumber, selectedSessionIdx)}
                        style={dash.swapHill}
                        hitSlop={HIT.slop}
                        accessibilityRole="button"
                        accessibilityLabel="Change the hill for this session"
                      >
                        <Mountain size={13} color={BASECAMP.accent} />
                        <Text style={dash.swapHillText}>
                          {selectedHill?.name ? "Change hill" : "Assign a hill"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </SRPanel>
              ) : (
                /* A rest day is a line, not a page. Recovery stays clearly
                   stated without taking the room a session needs. */
                <SRPanel radius={18} testID="plan-rest-day">
                  <View style={dash.restRow}>
                    <View style={dash.restMark}>
                      <Moon size={15} color={BASECAMP.textMuted} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={dash.restTitle}>Rest day</Text>
                      <Text style={dash.restBody} numberOfLines={2}>
                        Recovery is part of the plan. Pick another day to look ahead.
                      </Text>
                    </View>
                  </View>
                </SRPanel>
              )}
              <Text style={dash.swipeHint}>Swipe to change day</Text>
            </View>

            {/* ── This week ─────────────────────────────────────────────
                The approved composition: the week's sessions as a horizontal
                rail of photographic cards with the week's progress stated
                beside the heading — not a vertical stack of wide cards. The
                photograph is the hill the plan assigned, or the objective. */}
            {weekSessions.length > 0 && (
              <View style={dash.weekSection}>
                <View style={dash.weekHead}>
                  <Text style={dash.weekHeadTitle} numberOfLines={1}>THIS WEEK</Text>
                  <View style={dash.weekHeadProgress}>
                    <Text style={dash.weekHeadCount} numberOfLines={1}>
                      {`${weekDoneCount} OF ${weekSessions.length} SESSIONS`}
                    </Text>
                    <SRProgress
                      value={weekSessions.length === 0 ? 0 : (weekDoneCount / weekSessions.length) * 100}
                      height={7}
                      style={dash.weekHeadBar}
                      accessibilityLabel={`${weekDoneCount} of ${weekSessions.length} sessions complete`}
                    />
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={dash.weekRail}
                >
                  {weekSessions.map(({ session, sessionIdx, dow }) => {
                    const key = `${viewedWeek?.weekNumber}-${sessionIdx}`;
                    const isDone = !!completedPlanSessions[key];
                    const isSelected = dow !== null && dow === selectedDow;
                    const hillName = assignedHills?.[key]?.name ?? null;
                    const photo = mountainImageUri(
                      sessionImageSubject({
                        assignedHillName: hillName,
                        mountainName: summitGoal.mountainName,
                      }),
                      { width: 260, height: 180 },
                    );
                    return (
                      <TouchableOpacity
                        key={key}
                        activeOpacity={0.85}
                        style={[dash.weekCard, isSelected && dash.weekCardOn]}
                        onPress={() => {
                          if (dow !== null) setSelectedDow(dow);
                          else if (viewedWeek) router.push({
                            pathname: "/session-detail",
                            params: { weekNum: String(viewedWeek.weekNumber), sessionIdx: String(sessionIdx) },
                          });
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={
                          `${dow === null ? "Unscheduled" : DAY_SHORT[dow]}: ${session.label}`
                          + (isDone ? ", complete" : "")
                        }
                      >
                        <View style={dash.weekCardVisual}>
                          {photo ? (
                            <Image
                              source={{ uri: photo }}
                              style={StyleSheet.absoluteFill}
                              resizeMode="cover"
                              accessible={false}
                            />
                          ) : null}
                          <LinearGradient
                            colors={["rgba(5,9,11,0.05)", "rgba(10,17,19,0.88)"]}
                            locations={[0.38, 1]}
                            style={StyleSheet.absoluteFill}
                            pointerEvents="none"
                          />
                          <View style={[dash.weekCardBadge, isDone && dash.weekCardBadgeDone]}>
                            {isDone
                              ? <Check size={12} color={BASECAMP.accentInk} strokeWidth={3} />
                              : <ChevronRight size={11} color={BASECAMP.textStrong} />}
                          </View>
                        </View>
                        <View style={dash.weekCardBody}>
                          <Text style={dash.weekCardDay} numberOfLines={1}>
                            {dow === null ? "UNSCHEDULED" : DAY_SHORT[dow]}
                          </Text>
                          <Text
                            style={[dash.weekCardTitle, isDone && dash.weekCardTitleDone]}
                            numberOfLines={2}
                          >
                            {session.label}
                          </Text>
                          {session.targetElevation > 0 && (
                            <Text style={dash.weekCardFact} numberOfLines={1}>
                              {`${session.targetElevation.toLocaleString()} m gain`}
                            </Text>
                          )}
                          {session.duration && (
                            <Text style={dash.weekCardMeta} numberOfLines={1}>{session.duration}</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* ── Into the hills ───────────────────────────────────── */}
            <View style={dash.section}>
              <SRPanel
                radius={16}
                onPress={() => router.push("/(tabs)/hills")}
                accessibilityLabel="Find hills that match your plan"
              >
                <View style={dash.banner}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <SREyebrow>EXPLORE ROUTES</SREyebrow>
                    <Text style={dash.bannerTitle}>
                      Find hills that match{"\n"}your training plan.
                    </Text>
                  </View>
                  <ChevronRight size={16} color={BASECAMP.textDim} />
                </View>
              </SRPanel>
            </View>
          </>
        ) : (
          /* ── Full plan ─────────────────────────────────────────────
             Every week, with the existing week card, the existing actions,
             and the EXISTING ENTITLEMENT GATE: an unsubscribed user still
             sees week 1 and the same upgrade card in place of the rest. */
          <View style={dash.section}>
            <SRSectionHeader title={`${totalWeeks} weeks · ${weeksLeft} remaining`} />

            {planAdjustNote ? (
              <SRPanel radius={16} style={{ marginTop: 10 }}>
                <View style={dash.adjustRow}>
                  <Cpu size={15} color={BASECAMP.accent} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={dash.adjustTitle}>Plan adjusted by AI</Text>
                    <Text style={dash.adjustBody}>{planAdjustNote}</Text>
                  </View>
                </View>
              </SRPanel>
            ) : null}

            {phases.length > 0 && (
              <View style={dash.phaseBar}>
                {phases.map(phase => (
                  <View key={phase} style={dash.legendItem}>
                    <View style={[dash.legendDot, { backgroundColor: PHASE_COLOR[phase] }]} />
                    <Text style={dash.legendText}>{phase}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ marginTop: 12, gap: 10 }}>
              {trainingPlan.map((week, i) => {
                const isPlanLocked = !isSubscribed && week.weekNumber > 1;
                if (isPlanLocked && week.weekNumber === 2) {
                  return (
                    <SRPanel
                      key={week.weekNumber}
                      radius={18}
                      onPress={() => router.push("/paywall")}
                      accessibilityLabel={`Unlock the remaining ${trainingPlan.length - 1} weeks of your plan`}
                    >
                      <View style={dash.lockCard}>
                        <View style={dash.lockIcon}>
                          <Lock size={20} color={BASECAMP.accent} />
                        </View>
                        <Text style={dash.lockTitle}>
                          {trainingPlan.length - 1} more weeks in your plan
                        </Text>
                        <Text style={dash.lockSub}>
                          Unlock your full {trainingPlan.length}-week plan, AI-powered adaptation and
                          week-by-week guidance all the way to your summit.
                        </Text>
                        <View style={dash.lockFeatures}>
                          {["Adaptive AI plan", "All weeks unlocked", "Progress tracking"].map(f => (
                            <View key={f} style={dash.lockChip}>
                              <Check size={11} color={BASECAMP.accent} />
                              <Text style={dash.lockChipText}>{f}</Text>
                            </View>
                          ))}
                        </View>
                        <View style={dash.lockCta}>
                          <Zap size={13} color={BASECAMP.accentInk} />
                          <Text style={dash.lockCtaText}>UNLOCK FULL PLAN</Text>
                        </View>
                      </View>
                    </SRPanel>
                  );
                }
                if (isPlanLocked) return null;
                return (
                  <WeekCard
                    key={week.weekNumber}
                    week={week}
                    isExpanded={expandedWeeks.has(week.weekNumber)}
                    onToggle={() => toggle(week.weekNumber)}
                    index={i}
                    completedPlanSessions={completedPlanSessions}
                    submittedPlanSessions={submittedPlanSessions}
                    onToggleSession={togglePlanSession}
                    onSubmitWeek={handleSubmitWeek}
                    onEditSession={openEditSession}
                    onSwapExercise={openSwapExercise}
                    onChangeHill={openHillPicker}
                    onScheduleSession={(weekNum, sessionIdx) => setDayPickerFor({ weekNum, sessionIdx })}
                    sessionDayOverrides={sessionDayOverrides}
                    autoAssignedDows={assignSessionsToDays(week.sessions.length, summitGoal.availableDays).map(a => a.dayOfWeek)}
                    onSessionPress={(sessionIdx) => router.push({
                      pathname: "/session-detail",
                      params: { weekNum: String(week.weekNumber), sessionIdx: String(sessionIdx) },
                    })}
                  />
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>


      <DayPickerModal
        visible={dayPickerFor !== null}
        sessionLabel={dayPickerLabel}
        weekStartDate={dayPickerWeek?.startDate}
        currentDow={dayPickerCurrentDow}
        occupiedDows={dayPickerOccupied}
        preferredDows={summitGoal.availableDays ?? []}
        hasOverride={dayPickerHasOverride}
        onSelect={async (dow) => {
          if (dayPickerFor) await setSessionDayOverride(dayPickerFor.weekNum, dayPickerFor.sessionIdx, dow);
          setDayPickerFor(null);
        }}
        onClear={async () => {
          if (dayPickerFor) await clearSessionDayOverride(dayPickerFor.weekNum, dayPickerFor.sessionIdx);
          setDayPickerFor(null);
        }}
        onClose={() => setDayPickerFor(null)}
      />

      <HillPickerModal
        visible={hillPickerOpen}
        hills={nearbyHills}
        location={summitGoal?.location ?? ""}
        onSelect={handleHillSelect}
        onSearchAdd={addToNearbyHills}
        onClose={() => { setHillPickerOpen(false); setActiveSession(null); }}
      />

      {/* Edit Session Modal */}
      <Modal visible={editModalOpen} transparent animationType="fade" onRequestClose={() => setEditModalOpen(false)}>
        <TouchableOpacity style={editStyles.backdrop} activeOpacity={1} onPress={() => setEditModalOpen(false)} />
        <View style={[editStyles.sheet, { paddingBottom: Math.max(36, insets.bottom + 20) }]}>
          <View style={editStyles.handle} />
          <View style={editStyles.titleRow}>
            <Pencil size={16} color={T.blue} />
            <Text style={editStyles.title}>Edit Session</Text>
          </View>

          <Text style={editStyles.fieldLabel}>Duration</Text>
          <TextInput
            style={editStyles.input}
            value={editDuration}
            onChangeText={setEditDuration}
            placeholderTextColor={T.textDim}
            placeholder="e.g. 45 min"
            autoCorrect={false}
          />

          <Text style={editStyles.fieldLabel}>How hard was it?</Text>
          <View style={editStyles.effortRow}>
            {([1, 2, 3, 4, 5] as const).map(n => (
              <TouchableOpacity
                key={n}
                onPress={() => setEditEffort(n)}
                style={[editStyles.effortPip, { backgroundColor: n <= editEffort ? T.orange : T.surface, borderColor: n <= editEffort ? T.orange : T.border }]}
                activeOpacity={0.7}
              />
            ))}
            <Text style={editStyles.effortLabel}>
              {["", "Easy", "Light", "Moderate", "Hard", "Max"][editEffort]}
            </Text>
          </View>

          <View style={editStyles.btnRow}>
            <TouchableOpacity
              onPress={() => setEditModalOpen(false)}
              style={editStyles.cancelBtn}
              activeOpacity={0.7}
            >
              <Text style={editStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveEdit}
              style={editStyles.saveBtn}
              activeOpacity={0.85}
            >
              <LinearGradient colors={["#4A9FF5", "#2E7FD4"]} style={editStyles.saveBtnGrad}>
                <Check size={15} color="#fff" />
                <Text style={editStyles.saveText}>Save changes</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Swap Exercise Modal */}
      <Modal visible={swapModalOpen} transparent animationType="fade" onRequestClose={() => setSwapModalOpen(false)}>
        <TouchableOpacity style={editStyles.backdrop} activeOpacity={1} onPress={() => setSwapModalOpen(false)} />
        <View style={[editStyles.sheet, { paddingBottom: Math.max(36, insets.bottom + 20) }]}>
          <View style={editStyles.handle} />
          <View style={editStyles.titleRow}>
            <RefreshCw size={16} color={T.blue} />
            <Text style={editStyles.title}>Swap Exercise</Text>
          </View>
          <Text style={editStyles.swapHint}>
            Choose an alternative to <Text style={{ color: T.text, fontFamily: "Inter_600SemiBold" }}>{swapTarget?.label}</Text>
          </Text>
          {getExerciseAlternatives(swapTarget?.label ?? "").map((opt) => (
            <TouchableOpacity
              key={opt.name}
              style={editStyles.swapOption}
              activeOpacity={0.75}
              onPress={() => handleSwapSelect(opt.name, opt.desc)}
            >
              <View style={editStyles.swapIcon}>
                {(() => { const OIcon = opt.icon; return <OIcon size={15} color={T.blue} />; })()}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={editStyles.swapName}>{opt.name}</Text>
                <Text style={editStyles.swapDesc}>{opt.desc}</Text>
              </View>
              <ChevronRight size={14} color={T.textMuted} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setSwapModalOpen(false)}
            style={[editStyles.cancelBtn, { marginTop: 4 }]}
            activeOpacity={0.7}
          >
            <Text style={editStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const editStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: T.border,
    padding: 20, paddingBottom: 36, gap: 10,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: T.border, alignSelf: "center", marginBottom: 8,
  },
  titleRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4,
  },
  title: {
    fontSize: 17, fontFamily: "Inter_700Bold", color: T.white,
  },
  fieldLabel: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 4,
  },
  input: {
    backgroundColor: T.surface, borderRadius: 12,
    borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, fontFamily: "Inter_400Regular", color: T.white,
  },
  inputMulti: { minHeight: 72, paddingTop: 11 },
  effortRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4,
  },
  effortPip: {
    width: 30, height: 30, borderRadius: 8, borderWidth: 1.5,
  },
  effortLabel: {
    fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.orange, marginLeft: 4,
  },
  btnRow: {
    flexDirection: "row", gap: 10, marginTop: 8,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 14,
    borderWidth: 1, borderColor: T.border,
    alignItems: "center", justifyContent: "center",
  },
  cancelText: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.textMuted,
  },
  saveBtn: {
    flex: 2, borderRadius: 14, overflow: "hidden",
  },
  saveBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 13,
  },
  saveText: {
    fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff",
  },
  swapHint: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, marginBottom: 4,
  },
  swapOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: T.surface, borderRadius: 14,
    borderWidth: 1, borderColor: T.border,
  },
  swapIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center",
  },
  swapName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.text },
  swapDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
});


const styles = StyleSheet.create({
  weekCard: {
    backgroundColor: T.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.cardBorder,
    marginBottom: 10,
    overflow: "hidden",
    padding: 16,
  },
  currentBanner: {
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 14,
    paddingVertical: 5,
    alignItems: "center",
  },
  currentBannerText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1.5 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  weekNumBadge: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  weekNumText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  phaseName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.white },
  weekDates: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  cardRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  weekBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  weekBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  elevChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  elevText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  purposeSnippet: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18 },
  adjustNoteBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: T.blueDim,
    alignSelf: "flex-start",
  },
  adjustNoteText: { fontSize: 11, fontFamily: "Inter_500Medium", color: T.blue },
  expanded: {},
  divider: { height: 1, marginVertical: 12 },
  sectionHead: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 1.5, marginBottom: 10, textTransform: "uppercase" },
  sessionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
    backgroundColor: T.surface,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "flex-start",
  },
  sessionRowDone: {
    backgroundColor: T.greenDim,
    borderColor: T.green + "30",
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: T.textMuted,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxDone: {
    backgroundColor: T.green,
    borderColor: T.green,
  },
  sessionIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sessionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.white },
  sessionLabelDone: { textDecorationLine: "line-through", color: T.textMuted },
  sessionDur: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  sessionElev: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 3 },
  submitWeekBtn: {
    marginTop: 14,
    borderRadius: 14,
    overflow: "hidden",
  },
  submitWeekGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  submitWeekText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  submittedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: T.greenDim,
    borderWidth: 1,
    borderColor: T.green + "30",
  },
  submittedBannerText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.green },
});


/* ──────────────────────────────────────────────────────────────────────────
   The approved Training Plan composition.

   One rhythm with Training Basecamp and Full Readiness: the 17pt gutter, the
   tracked-out section label, the gradient panel, the accent used only for
   progress and actions.
   ────────────────────────────────────────────────────────────────────────── */
const dash = StyleSheet.create({
  section: { marginTop: 20, paddingHorizontal: BASECAMP.gutter },

  heroBody: { paddingHorizontal: BASECAMP.gutter, marginTop: 22, paddingBottom: 20 },
  goalName: {
    marginTop: 5, fontSize: 31, lineHeight: 35,
    fontFamily: "Inter_700Bold", color: BASECAMP.text, letterSpacing: -0.9,
  },
  heroMeta: { flexDirection: "row", alignItems: "flex-end", gap: 14, marginTop: 15 },
  heroReadiness: { flex: 1, minWidth: 0, maxWidth: 210 },
  heroMetaLabel: { fontSize: 10.5, lineHeight: 14, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },
  heroMetaValue: {
    marginTop: 1, fontSize: 17, lineHeight: 21,
    fontFamily: "Inter_700Bold", color: BASECAMP.text, letterSpacing: -0.4,
  },
  heroDivider: { width: 1, height: 36, backgroundColor: BASECAMP.hairline, marginBottom: 3 },
  heroCount: {
    fontSize: 19, lineHeight: 23, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: -0.4,
  },

  modeRow: { alignItems: "center", paddingBottom: 10 },
  planStartNote: {
    marginTop: 12, marginHorizontal: BASECAMP.gutter,
    fontSize: 11.5, lineHeight: 16,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },
  weekSection: { marginTop: 20 },
  weekHead: {
    paddingHorizontal: BASECAMP.gutter,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
  },
  weekHeadTitle: {
    ...TYPE.eyebrow, fontSize: 11.5, letterSpacing: 2, color: BASECAMP.textMuted,
  },
  weekHeadProgress: { flexDirection: "row", alignItems: "center", gap: 9, flexShrink: 1 },
  weekHeadCount: {
    fontSize: 10, lineHeight: 13, fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8, color: BASECAMP.textDim,
  },
  weekHeadBar: { width: 84, flexShrink: 0 },
  weekRail: { paddingHorizontal: BASECAMP.gutter, gap: 8, paddingTop: 11 },
  weekCard: {
    width: 116, borderRadius: 15, overflow: "hidden",
    backgroundColor: BASECAMP.panelSub,
    borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },
  weekCardOn: { borderColor: BASECAMP.accentLine },
  weekCardVisual: { height: 66, backgroundColor: "#12202A" },
  weekCardBadge: {
    position: "absolute", top: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.32)",
  },
  weekCardBadgeDone: { backgroundColor: BASECAMP.accent, borderColor: BASECAMP.accent },
  weekCardBody: { padding: 10, paddingTop: 8 },
  weekCardDay: {
    fontSize: 9, lineHeight: 11, fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8, color: BASECAMP.textDim,
  },
  weekCardTitle: {
    marginTop: 3, fontSize: 13.5, lineHeight: 16,
    fontFamily: "Inter_700Bold", letterSpacing: -0.25, color: BASECAMP.text,
  },
  weekCardTitleDone: { color: BASECAMP.textDim, textDecorationLine: "line-through" },
  weekCardFact: { marginTop: 3, fontSize: 10.5, lineHeight: 13, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },
  weekCardMeta: { fontSize: 10.5, lineHeight: 13, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },

  weekNav: {
    marginTop: 16, paddingHorizontal: BASECAMP.gutter,
    flexDirection: "row", alignItems: "center", gap: 14,
  },
  weekNavBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
    backgroundColor: BASECAMP.panelSub,
    borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },
  weekNavCentre: { flex: 1, minWidth: 0, alignItems: "center" },
  weekNavTitle: {
    fontSize: 13, lineHeight: 17, fontFamily: "Inter_700Bold",
    letterSpacing: 1.8, color: BASECAMP.text,
  },
  weekNavSub: {
    marginTop: 3, fontSize: 11, lineHeight: 14,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },

  strip: {
    marginTop: 13, paddingHorizontal: BASECAMP.gutter,
    flexDirection: "row", gap: 5,
  },
  dayCell: {
    flex: 1, minWidth: 0, alignItems: "center",
    paddingVertical: 8, paddingHorizontal: 1, gap: 3,
    borderRadius: 12,
    backgroundColor: BASECAMP.panelSub,
    borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },
  dayCellOn: { borderColor: "rgba(36,239,164,0.65)", backgroundColor: "rgba(36,239,164,0.09)" },
  dayName: {
    fontSize: 8.5, lineHeight: 11, fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8, color: BASECAMP.textMuted,
  },
  dayDate: {
    fontSize: 16, lineHeight: 19, fontFamily: "Inter_700Bold",
    letterSpacing: -0.3, color: BASECAMP.text,
  },
  dayGlyph: { height: 18, alignItems: "center", justifyContent: "center" },
  restDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: BASECAMP.textFaint },
  dayType: {
    fontSize: 7.5, lineHeight: 10, fontFamily: "Inter_500Medium",
    color: BASECAMP.textMuted, textAlign: "center",
  },
  dayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "transparent" },

  restRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  restMark: {
    width: 36, height: 36, borderRadius: 12, flexShrink: 0,
    alignItems: "center", justifyContent: "center",
    backgroundColor: BASECAMP.panelSub,
    borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },
  restTitle: { ...TYPE.bodyBold, fontSize: 14, color: BASECAMP.text },
  restBody: { marginTop: 2, ...TYPE.caption, fontSize: 11.5, lineHeight: 15, color: BASECAMP.textDim },

  missionPhoto: {
    position: "absolute", right: 0, top: 0,
    width: 124, height: 132, overflow: "hidden",
  },
  missionTopInset: { paddingRight: 96 },
  missionBody: { padding: 15 },
  missionTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  missionPills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  missionTitle: {
    marginTop: 8, fontSize: 21, lineHeight: 25,
    fontFamily: "Inter_700Bold", color: BASECAMP.text, letterSpacing: -0.5,
  },
  missionEdit: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
    backgroundColor: BASECAMP.panelSub,
    borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },
  missionFacts: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 8, flexWrap: "wrap" },
  missionFact: { fontSize: 12.5, lineHeight: 17, fontFamily: "Inter_500Medium", color: BASECAMP.textStrong },
  missionDesc: {
    marginTop: 9, fontSize: 11.5, lineHeight: 16,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },
  missionActions: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap", rowGap: 8 },
  swapHill: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, minHeight: 32 },
  swapHillText: { fontSize: 11.5, lineHeight: 15, fontFamily: "Inter_600SemiBold", color: BASECAMP.accent },
  swipeHint: {
    marginTop: 9, textAlign: "center", fontSize: 10, lineHeight: 13,
    fontFamily: "Inter_400Regular", color: BASECAMP.textFaint,
  },

  upRow: { flexDirection: "row", alignItems: "center", gap: 11, padding: 12, minHeight: HIT.minTarget },
  upDay: {
    width: 30, fontSize: 10, lineHeight: 13, fontFamily: "Inter_700Bold",
    letterSpacing: 0.8, color: BASECAMP.textMuted,
  },
  upName: { fontSize: 13.5, lineHeight: 18, fontFamily: "Inter_600SemiBold", color: BASECAMP.text },
  upSub: {
    marginTop: 2, fontSize: 11, lineHeight: 15,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },

  banner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15, minHeight: 88 },
  bannerTitle: {
    marginTop: 6, fontSize: 15, lineHeight: 20,
    fontFamily: "Inter_700Bold", color: BASECAMP.text, letterSpacing: -0.3,
  },

  adjustRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 13 },
  adjustTitle: { fontSize: 13, lineHeight: 17, fontFamily: "Inter_700Bold", color: BASECAMP.text },
  adjustBody: {
    marginTop: 3, fontSize: 11.5, lineHeight: 16,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },

  phaseBar: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 10.5, lineHeight: 14, fontFamily: "Inter_500Medium", color: BASECAMP.textDim },

  lockCard: { padding: 18, alignItems: "center", gap: 9 },
  lockIcon: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(36,239,164,0.12)",
    borderWidth: 1, borderColor: "rgba(36,239,164,0.35)",
  },
  lockTitle: {
    fontSize: 17, lineHeight: 22, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, textAlign: "center", letterSpacing: -0.3,
  },
  lockSub: {
    fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular",
    color: BASECAMP.textDim, textAlign: "center",
  },
  lockFeatures: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 2 },
  lockChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999,
    backgroundColor: BASECAMP.panelSub,
    borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },
  lockChipText: { fontSize: 10.5, lineHeight: 14, fontFamily: "Inter_500Medium", color: BASECAMP.textStrong },
  lockCta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    marginTop: 6, alignSelf: "stretch", minHeight: HIT.minTarget,
    borderRadius: 12, backgroundColor: BASECAMP.accent,
  },
  lockCtaText: {
    fontSize: 12, lineHeight: 16, fontFamily: "Inter_700Bold",
    letterSpacing: 1, color: BASECAMP.accentInk,
  },
});
