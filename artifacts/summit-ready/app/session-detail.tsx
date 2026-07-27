import {
  Activity, ArrowLeft, Check, CheckCircle, ChevronRight, Flag,
  Globe, MapPin, Minus, Mountain, Plus, TrendingUp, Zap,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  ImageBackground,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { T, PHASE_COLOR } from "@/constants/theme";
import { parseDurationMidpoint } from "@/utils/planGenerator";
import { useSubscription } from "@/lib/revenuecat";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

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
        <Flag size={12} color={T.orange} />
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
          <Minus size={14} color={display <= 0 || isDone ? T.textDim : T.white} />
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
          <Plus size={14} color={isDone ? T.textDim : T.white} />
        </TouchableOpacity>
        {loggedElev !== null && (
          <Text style={[trk.logElev, hit && { color: T.green }]}>= {loggedElev}m</Text>
        )}
        {hit && (
          <View style={trk.hitBadge}>
            <Check size={10} color={T.green} />
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
        <Flag size={12} color={T.orange} />
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
          <Minus size={14} color={display <= 0 || isDone ? T.textDim : T.white} />
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
          <Plus size={14} color={isDone ? T.textDim : T.white} />
        </TouchableOpacity>
        {hit && (
          <View style={trk.hitBadge}>
            <Check size={10} color={T.green} />
            <Text style={trk.hitText}>Target!</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const trk = StyleSheet.create({
  box: {
    backgroundColor: T.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    padding: 14,
    gap: 10,
    marginTop: 4,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  metaVal: { fontFamily: "Inter_600SemiBold", color: T.orange },
  metaDim: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim },
  logRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  logLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim },
  btn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
    alignItems: "center", justifyContent: "center",
  },
  btnDim: { opacity: 0.35 },
  val: { fontSize: 18, fontFamily: "Inter_700Bold", color: T.textMuted, minWidth: 28, textAlign: "center" },
  valWhite: { color: T.white },
  valGreen: { color: T.green },
  logElev: { fontSize: 12, fontFamily: "Inter_500Medium", color: T.orange },
  hitBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 20, backgroundColor: T.greenDim,
    borderWidth: 1, borderColor: T.green + "40",
  },
  hitText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.green },
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
    togglePlanSession, setSessionReps, submitWeekSessions,
  } = useApp();
  const { isSubscribed } = useSubscription();

  const week    = trainingPlan.find(w => w.weekNumber === weekNum);
  const session = week?.sessions[sessionIdx];
  const sessionKey = `${weekNum}-${sessionIdx}`;

  const isDone      = !!completedPlanSessions[sessionKey];
  const isSubmitted = !!submittedPlanSessions[sessionKey];
  const assignedHill = assignedHills[sessionKey];

  const [showManual, setShowManual] = useState(isDone && !isSubmitted);
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState(false);

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

  // Hero image: assigned hill name → session label → summit name
  const heroSubject =
    assignedHill?.name ??
    (session?.type !== "cardio" ? session?.label : null) ??
    summitGoal?.mountainName ??
    "";
  const heroImageUri = !imageError && heroSubject
    ? `${API_BASE}/mountain-image?name=${encodeURIComponent(heroSubject)}&width=800&height=400`
    : null;

  const pc = PHASE_COLOR[week?.phase ?? "Base"] ?? T.green;
  const tc = session ? typeColor(session.type) : T.blue;

  // Infer gym subtype (mirrors plan.tsx logic)
  const gymText = `${session?.label ?? ""} ${session?.description ?? ""}`.toLowerCase();
  const inferredGymExercise: "treadmill" | "stepper" | null =
    session?.gymExercise === "treadmill" || session?.gymExercise === "stepper"
      ? session.gymExercise
      : gymText.includes("treadmill")
      ? "treadmill"
      : gymText.includes("stepper") || gymText.includes("step machine") || gymText.includes("stairmaster")
      ? "stepper"
      : null;
  const isStairRepeat  = gymText.includes("stair") || gymText.includes("stair repeat") || gymText.includes("flights");
  const isOutdoorCardio = session?.gymExercise === "outdoor" || (!inferredGymExercise && !isStairRepeat && session?.type === "cardio");

  const midDur = parseDurationMidpoint(session?.duration ?? "45 min");

  // Submit the week after manual completion
  const handleSubmitWeek = useCallback(async () => {
    setSaving(true);
    await submitWeekSessions(weekNum);
    setSaving(false);
  }, [submitWeekSessions, weekNum]);

  // Count unsubmitted completed sessions in this week for the submit button
  const unsubmittedCount = week
    ? week.sessions.filter((_, i) => {
        const k = `${weekNum}-${i}`;
        return completedPlanSessions[k] && !submittedPlanSessions[k];
      }).length
    : 0;

  const submittedCount = week
    ? week.sessions.filter((_, i) => submittedPlanSessions[`${weekNum}-${i}`]).length
    : 0;

  if (!session || !week) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: T.textMuted, fontSize: 15, fontFamily: "Inter_400Regular" }}>
          Session not found.
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: T.green, fontFamily: "Inter_600SemiBold" }}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 80 : insets.bottom + 80 }}
      >
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <View style={s.heroWrap}>
          {heroImageUri ? (
            <ImageBackground
              source={{ uri: heroImageUri }}
              style={s.heroImg}
              resizeMode="cover"
              onError={() => setImageError(true)}
            >
              <LinearGradient
                colors={["transparent", "rgba(6,13,27,0.6)", T.bg]}
                style={StyleSheet.absoluteFill}
              />
              {/* Back button */}
              <TouchableOpacity
                onPress={() => router.back()}
                style={[s.backBtn, { top: Platform.OS === "web" ? 20 : insets.top + 8 }]}
                activeOpacity={0.8}
              >
                <ArrowLeft size={20} color={T.white} />
              </TouchableOpacity>
            </ImageBackground>
          ) : (
            <LinearGradient colors={[pc + "30", T.bg]} style={s.heroImg}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={[s.backBtn, { top: Platform.OS === "web" ? 20 : insets.top + 8 }]}
                activeOpacity={0.8}
              >
                <ArrowLeft size={20} color={T.white} />
              </TouchableOpacity>
            </LinearGradient>
          )}
        </View>

        {/* ── Header metadata ───────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(400)} style={s.content}>

          {/* Phase + week chips */}
          <View style={s.chipRow}>
            <View style={[s.chip, { backgroundColor: pc + "20", borderColor: pc + "50" }]}>
              <Text style={[s.chipText, { color: pc }]}>{week.phase} Phase</Text>
            </View>
            <View style={[s.chip, { backgroundColor: T.surface, borderColor: T.border }]}>
              <Text style={[s.chipText, { color: T.textMuted }]}>Week {weekNum}</Text>
            </View>
            <View style={[s.chip, { backgroundColor: tc + "18", borderColor: tc + "40" }]}>
              {typeIcon(session.type)}
              <Text style={[s.chipText, { color: tc }]}>{typeLabel(session.type)}</Text>
            </View>
            {isDone && (
              <View style={[s.chip, { backgroundColor: T.greenDim, borderColor: T.green + "50" }]}>
                <CheckCircle size={11} color={T.green} />
                <Text style={[s.chipText, { color: T.green }]}>Done</Text>
              </View>
            )}
          </View>

          {/* Session title */}
          <Text style={s.title}>{session.label}</Text>

          {/* Stats row */}
          <View style={s.statsRow}>
            <View style={s.statCell}>
              <Text style={s.statVal}>{session.duration}</Text>
              <Text style={s.statLbl}>Duration</Text>
            </View>
            {session.targetElevation > 0 && (
              <View style={[s.statCell, s.statMid]}>
                <Text style={[s.statVal, { color: T.orange }]}>↑{session.targetElevation}m</Text>
                <Text style={s.statLbl}>Elevation</Text>
              </View>
            )}
            {session.type !== "cardio" && elevPerRep > 0 && (
              <View style={s.statCell}>
                <Text style={s.statVal}>{targetReps}</Text>
                <Text style={s.statLbl}>Reps × {elevPerRep}m</Text>
              </View>
            )}
            {inferredGymExercise === "treadmill" && session.targetDistanceKm && (
              <View style={s.statCell}>
                <Text style={[s.statVal, { color: T.blue }]}>{session.targetDistanceKm}km</Text>
                <Text style={s.statLbl}>@ {session.inclinePct ?? 10}% grade</Text>
              </View>
            )}
            {inferredGymExercise === "stepper" && session.targetFloors && (
              <View style={s.statCell}>
                <Text style={[s.statVal, { color: T.blue }]}>{session.targetFloors} fl</Text>
                <Text style={s.statLbl}>Floors</Text>
              </View>
            )}
            {isStairRepeat && session.targetFlights && (
              <View style={s.statCell}>
                <Text style={[s.statVal, { color: T.blue }]}>{session.targetFlights}</Text>
                <Text style={s.statLbl}>Flights</Text>
              </View>
            )}
          </View>

          {/* Assigned hill */}
          {assignedHill && (
            <View style={s.hillRow}>
              <Text style={s.hillEmoji}>{assignedHill.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.hillName}>{assignedHill.name}</Text>
                <Text style={s.hillSub}>
                  {assignedHill.distance}km away · {assignedHill.surface} · {assignedHill.grade} grade
                </Text>
              </View>
              <MapPin size={13} color={T.textMuted} />
            </View>
          )}

          {/* Description / coaching */}
          {session.description ? (
            <View style={s.descCard}>
              <Text style={s.descLabel}>COACHING NOTES</Text>
              <Text style={s.descText}>{session.description}</Text>
            </View>
          ) : null}

          {/* ── DIVIDER: Complete this session ────────────────────────── */}
          {!isSubmitted && (
            <View style={s.completeSection}>
              <Text style={s.completeSectionLabel}>COMPLETE THIS SESSION</Text>

              {/* CTA 1: Track with GPS */}
              {(session.type === "hill" || session.type === "bigDay") && (
                <TouchableOpacity
                  style={[s.ctaBtn, s.ctaBtnGps]}
                  activeOpacity={0.85}
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
                >
                  <LinearGradient colors={["#3ECF75", "#2AB860"]} style={s.ctaBtnInner}>
                    <Globe size={17} color="#fff" />
                    <View>
                      <Text style={s.ctaBtnTitle}>Track with GPS</Text>
                      <Text style={s.ctaBtnSub}>Records elevation + maps your route</Text>
                    </View>
                    <ChevronRight size={16} color="#fff" style={{ marginLeft: "auto" }} />
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {/* Accuracy note */}
              {(session.type === "hill" || session.type === "bigDay") && (
                <View style={s.accuracyNote}>
                  <Zap size={11} color={T.textDim} />
                  <Text style={s.accuracyNoteText}>
                    GPS tracking records verified elevation and improves hill accuracy for everyone. 
                    Manual completion counts equally toward your readiness score.
                  </Text>
                </View>
              )}

              {/* CTA 2: Complete without GPS */}
              {!isDone ? (
                <TouchableOpacity
                  style={[s.ctaBtn, s.ctaBtnManual]}
                  activeOpacity={0.85}
                  onPress={async () => {
                    await togglePlanSession(weekNum, sessionIdx);
                    setShowManual(true);
                  }}
                >
                  <View style={s.ctaBtnInner}>
                    <CheckCircle size={17} color={T.textMuted} />
                    <View>
                      <Text style={[s.ctaBtnTitle, { color: T.text }]}>Complete without GPS</Text>
                      <Text style={s.ctaBtnSub}>Mark done and log your effort</Text>
                    </View>
                    <ChevronRight size={16} color={T.textMuted} style={{ marginLeft: "auto" }} />
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[s.ctaBtn, s.ctaBtnDone]}
                  activeOpacity={0.85}
                  onPress={() => togglePlanSession(weekNum, sessionIdx)}
                >
                  <View style={s.ctaBtnInner}>
                    <CheckCircle size={17} color={T.green} />
                    <Text style={[s.ctaBtnTitle, { color: T.green }]}>Marked complete</Text>
                    <Text style={[s.ctaBtnSub, { color: T.textDim, marginLeft: "auto" }]}>Tap to undo</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Manual tracker widgets (shown once the user marks done) */}
              {(isDone || showManual) && (
                <View style={s.trackerWrap}>
                  <Text style={s.trackerLabel}>LOG YOUR NUMBERS</Text>

                  {/* Hill / bigDay: rep logging */}
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

                  {/* Treadmill */}
                  {inferredGymExercise === "treadmill" && session.targetDistanceKm && (
                    <MeterLog
                      sessionKey={sessionKey}
                      target={session.targetDistanceKm}
                      unit="km"
                      step={0.5}
                      sessionReps={sessionReps}
                      isDone={false}
                      onSet={setSessionReps}
                    />
                  )}

                  {/* Stepper */}
                  {inferredGymExercise === "stepper" && session.targetFloors && (
                    <MeterLog
                      sessionKey={sessionKey}
                      target={session.targetFloors}
                      unit=" fl"
                      step={5}
                      sessionReps={sessionReps}
                      isDone={false}
                      onSet={setSessionReps}
                    />
                  )}

                  {/* Stair repeats */}
                  {isStairRepeat && session.targetFlights && (
                    <MeterLog
                      sessionKey={sessionKey}
                      target={session.targetFlights}
                      unit=" flights"
                      step={1}
                      sessionReps={sessionReps}
                      isDone={false}
                      onSet={setSessionReps}
                    />
                  )}

                  {/* Outdoor / elevation logger */}
                  {isOutdoorCardio && session.targetElevation > 0 && (
                    <MeterLog
                      sessionKey={sessionKey}
                      target={session.targetElevation}
                      unit="m"
                      step={session.targetElevation >= 500 ? 100 : session.targetElevation >= 200 ? 50 : 25}
                      sessionReps={sessionReps}
                      isDone={false}
                      onSet={setSessionReps}
                    />
                  )}
                </View>
              )}

              {/* Submit button */}
              {unsubmittedCount > 0 && (
                <TouchableOpacity
                  onPress={handleSubmitWeek}
                  activeOpacity={0.85}
                  style={s.submitBtn}
                  disabled={saving}
                >
                  <LinearGradient colors={["#3ECF75", "#2AB860"]} style={s.submitBtnInner}>
                    <CheckCircle size={16} color="#fff" />
                    <Text style={s.submitText}>
                      {saving ? "Saving…" : `Submit ${unsubmittedCount} session${unsubmittedCount > 1 ? "s" : ""} → update progress`}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
              {submittedCount > 0 && unsubmittedCount === 0 && (
                <View style={s.submittedBanner}>
                  <CheckCircle size={14} color={T.green} />
                  <Text style={s.submittedText}>
                    {submittedCount} session{submittedCount > 1 ? "s" : ""} submitted · readiness updated
                  </Text>
                </View>
              )}
            </View>
          )}

          {isSubmitted && (
            <View style={[s.submittedBanner, { marginTop: 20 }]}>
              <CheckCircle size={14} color={T.green} />
              <Text style={s.submittedText}>Session submitted · readiness updated</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  heroWrap: { width: "100%", height: 240 },
  heroImg: { width: "100%", height: "100%", justifyContent: "flex-end" },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(6,13,27,0.6)",
    alignItems: "center", justifyContent: "center",
  },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 4 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  chipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.white, lineHeight: 32 },

  statsRow: {
    flexDirection: "row",
    backgroundColor: T.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    overflow: "hidden",
  },
  statCell: {
    flex: 1, paddingVertical: 14, alignItems: "center", gap: 3,
  },
  statMid: {
    borderLeftWidth: 1, borderRightWidth: 1, borderColor: T.border,
  },
  statVal: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.white },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },

  hillRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border,
    padding: 12,
  },
  hillEmoji: { fontSize: 22 },
  hillName: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white },
  hillSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },

  descCard: {
    backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border,
    padding: 16, gap: 8,
  },
  descLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim,
    letterSpacing: 1.2, textTransform: "uppercase",
  },
  descText: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 21 },

  completeSection: { gap: 10, paddingTop: 8 },
  completeSectionLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim,
    letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 2,
  },

  ctaBtn: { borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: T.border },
  ctaBtnGps: { borderColor: T.green + "60" },
  ctaBtnManual: { borderColor: T.border },
  ctaBtnDone: { borderColor: T.green + "50", backgroundColor: T.greenDim },
  ctaBtnInner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 16, paddingHorizontal: 18,
  },
  ctaBtnTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  ctaBtnSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 2 },

  accuracyNote: {
    flexDirection: "row", gap: 7, alignItems: "flex-start",
    paddingHorizontal: 4,
  },
  accuracyNoteText: {
    flex: 1, fontSize: 11, fontFamily: "Inter_400Regular",
    color: T.textDim, lineHeight: 16,
  },

  trackerWrap: { gap: 10 },
  trackerLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim,
    letterSpacing: 1.2, textTransform: "uppercase",
  },

  submitBtn: { borderRadius: 16, overflow: "hidden", marginTop: 4 },
  submitBtnInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 15,
  },
  submitText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },

  submittedBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 14, borderRadius: 14,
    backgroundColor: T.greenDim, borderWidth: 1, borderColor: T.green + "40",
  },
  submittedText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.green },
});
