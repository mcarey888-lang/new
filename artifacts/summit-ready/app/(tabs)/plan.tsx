import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NearbyHill, TrainingWeek, useApp } from "@/context/AppContext";
import { T, PHASE_COLOR } from "@/constants/theme";
import { getCurrentWeek } from "@/utils/planGenerator";

// ── Rep Stepper ───────────────────────────────────────────────────────────────
function RepStepper({
  sessionKey,
  defaultReps,
  elevPerRep,
  sessionReps,
  onSet,
}: {
  sessionKey: string;
  defaultReps: number;
  elevPerRep: number;
  sessionReps: Record<string, number>;
  onSet: (key: string, reps: number) => void;
}) {
  const custom = sessionReps[sessionKey];
  const reps = custom ?? defaultReps;
  const isModified = custom !== undefined && custom !== defaultReps;
  const totalElev = elevPerRep > 0 ? reps * elevPerRep : null;

  return (
    <View style={rsStyles.row}>
      <Feather name="repeat" size={11} color={T.textDim} />
      <Text style={rsStyles.label}>Reps:</Text>

      <TouchableOpacity
        onPress={() => onSet(sessionKey, reps - 1)}
        style={[rsStyles.btn, reps <= 1 && rsStyles.btnDisabled]}
        activeOpacity={0.7}
        disabled={reps <= 1}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather name="minus" size={12} color={reps <= 1 ? T.textDim : T.white} />
      </TouchableOpacity>

      <Text style={[rsStyles.count, isModified && rsStyles.countModified]}>{reps}</Text>

      <TouchableOpacity
        onPress={() => onSet(sessionKey, reps + 1)}
        style={rsStyles.btn}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather name="plus" size={12} color={T.white} />
      </TouchableOpacity>

      {totalElev !== null && (
        <Text style={rsStyles.elev}>= {totalElev}m gain</Text>
      )}

      {isModified && (
        <TouchableOpacity
          onPress={() => onSet(sessionKey, defaultReps)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={rsStyles.resetBtn}
        >
          <Text style={rsStyles.resetText}>reset</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const rsStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: T.border,
    flexWrap: "wrap",
  },
  label: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim },
  btn: {
    width: 24, height: 24, borderRadius: 7,
    backgroundColor: T.surface,
    borderWidth: 1, borderColor: T.border,
    alignItems: "center", justifyContent: "center",
  },
  btnDisabled: { opacity: 0.4 },
  count: {
    fontSize: 14, fontFamily: "Inter_700Bold", color: T.white,
    minWidth: 22, textAlign: "center",
  },
  countModified: { color: T.green },
  elev: { fontSize: 11, fontFamily: "Inter_500Medium", color: T.orange, marginLeft: 2 },
  resetBtn: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: T.surface,
    borderWidth: 1, borderColor: T.border,
    marginLeft: 4,
  },
  resetText: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted },
});

const { width } = Dimensions.get("window");

function HillPickerModal({
  visible,
  hills,
  onSelect,
  onClose,
}: {
  visible: boolean;
  hills: NearbyHill[];
  onSelect: (hill: NearbyHill) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={mpStyles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={mpStyles.sheet}>
        <View style={mpStyles.handle} />
        <Text style={mpStyles.title}>Choose a Hill</Text>
        <Text style={mpStyles.subtitle}>Select a training hill for this session</Text>

        {hills.length === 0 ? (
          <View style={mpStyles.empty}>
            <Feather name="map-pin" size={28} color={T.textDim} />
            <Text style={mpStyles.emptyText}>No hills loaded yet</Text>
            <Text style={mpStyles.emptyHint}>Go to the Hills tab to load nearby hills first</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
            {hills.map((hill, i) => (
              <TouchableOpacity
                key={i}
                style={mpStyles.hillRow}
                onPress={() => onSelect(hill)}
                activeOpacity={0.7}
              >
                <Text style={mpStyles.hillEmoji}>{hill.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={mpStyles.hillName}>{hill.name}</Text>
                  <Text style={mpStyles.hillSub}>{hill.surface} · {hill.distance}km away</Text>
                </View>
                <View style={mpStyles.hillStats}>
                  <Text style={mpStyles.hillElev}>{hill.elevation}m</Text>
                  <Text style={mpStyles.hillReps}>×{hill.repeats}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <TouchableOpacity style={mpStyles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={mpStyles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function WeekCard({
  week,
  isExpanded,
  onToggle,
  index,
  completedPlanSessions,
  assignedHills,
  nearbyHills,
  submittedPlanSessions,
  sessionReps,
  onToggleSession,
  onAssignHill,
  onSubmitWeek,
  onSetReps,
}: {
  week: TrainingWeek;
  isExpanded: boolean;
  onToggle: () => void;
  index: number;
  completedPlanSessions: Record<string, boolean>;
  assignedHills: Record<string, NearbyHill>;
  nearbyHills: NearbyHill[];
  submittedPlanSessions: Record<string, boolean>;
  sessionReps: Record<string, number>;
  onToggleSession: (weekNum: number, sessionIdx: number) => void;
  onAssignHill: (weekNum: number, sessionIdx: number) => void;
  onSubmitWeek: (weekNum: number) => void;
  onSetReps: (key: string, reps: number) => void;
}) {
  const pc = PHASE_COLOR[week.phase] ?? T.green;
  const totalSessions = week.sessions.length;
  const completedInWeek = week.sessions.filter((_, i) =>
    completedPlanSessions[`${week.weekNumber}-${i}`]
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
            <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={T.textMuted} />
          </View>
        </View>

        <View style={styles.cardMeta}>
          <View style={[styles.elevChip, { backgroundColor: T.orangeDim }]}>
            <Feather name="trending-up" size={12} color={T.orange} />
            <Text style={[styles.elevText, { color: T.orange }]}>{week.targetElevation}m</Text>
          </View>
          <Text style={styles.purposeSnippet} numberOfLines={isExpanded ? undefined : 1}>
            {week.purpose}
          </Text>
        </View>

        {week.adjustNote && (
          <View style={styles.adjustNoteBadge}>
            <Feather name="zap" size={11} color={T.blue} />
            <Text style={styles.adjustNoteText}>{week.adjustNote}</Text>
          </View>
        )}

        {isExpanded && (
          <View style={styles.expanded}>
            <View style={[styles.divider, { backgroundColor: pc + "30" }]} />

            <Text style={styles.sectionHead}>SESSIONS</Text>
            {week.sessions.map((s, i) => {
              const sessionKey = `${week.weekNumber}-${i}`;
              const isDone = !!completedPlanSessions[sessionKey];
              const assignedHill = assignedHills[sessionKey];
              const canPickHill = s.type === "hill" || s.type === "bigDay";

              return (
                <View
                  key={i}
                  style={[
                    styles.sessionRow,
                    isDone && styles.sessionRowDone,
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => onToggleSession(week.weekNumber, i)}
                    style={[styles.checkbox, isDone && styles.checkboxDone]}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {isDone && <Feather name="check" size={12} color="#fff" />}
                  </TouchableOpacity>

                  <View style={[
                    styles.sessionIcon,
                    { backgroundColor: s.type === "bigDay" ? T.orangeDim : T.greenDim },
                    isDone && { opacity: 0.5 },
                  ]}>
                    <Feather
                      name={s.type === "cardio" ? "heart" : s.type === "hill" ? "trending-up" : "flag"}
                      size={14}
                      color={s.type === "bigDay" ? T.orange : T.green}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={[styles.sessionLabel, isDone && styles.sessionLabelDone]}>{s.label}</Text>
                      <Text style={styles.sessionDur}>{s.duration}</Text>
                    </View>

                    {assignedHill ? (
                      <View style={styles.assignedHillRow}>
                        <Text style={styles.assignedHillEmoji}>{assignedHill.emoji}</Text>
                        <Text style={styles.assignedHillName}>{assignedHill.name}</Text>
                        <Text style={styles.assignedHillSub}> · {assignedHill.elevation}m ×{assignedHill.repeats}</Text>
                      </View>
                    ) : (
                      <Text style={[styles.sessionDesc, isDone && { opacity: 0.5 }]}>{s.description}</Text>
                    )}

                    <View style={styles.sessionFooter}>
                      <Text style={[styles.sessionElev, { color: T.orange }]}>~{s.targetElevation}m gain</Text>
                      {canPickHill && (
                        <TouchableOpacity
                          onPress={() => onAssignHill(week.weekNumber, i)}
                          style={styles.pickHillBtn}
                          activeOpacity={0.7}
                        >
                          <Feather name="map-pin" size={11} color={T.green} />
                          <Text style={styles.pickHillText}>
                            {assignedHill ? "Change hill" : "Pick hill"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {canPickHill && (() => {
                      const hill = assignedHill ?? week.hills[0] ?? null;
                      const elevPerRep = hill ? hill.elevation : 0;
                      const defaultReps = hill ? hill.repeats : Math.max(1, Math.ceil(s.targetElevation / 100));
                      return (
                        <RepStepper
                          sessionKey={sessionKey}
                          defaultReps={defaultReps}
                          elevPerRep={elevPerRep}
                          sessionReps={sessionReps}
                          onSet={onSetReps}
                        />
                      );
                    })()}
                  </View>
                </View>
              );
            })}

            {week.hills.slice(0, 2).length > 0 && (
              <>
                <Text style={[styles.sectionHead, { marginTop: 14 }]}>SUGGESTED HILLS</Text>
                {week.hills.slice(0, 2).map((h, i) => (
                  <View key={i} style={styles.hillRow}>
                    <Feather name="map-pin" size={13} color={T.green} />
                    <Text style={styles.hillRowText}>
                      {h.name} – {h.elevation}m × {h.repeats} = ~{h.totalElevation}m total
                    </Text>
                  </View>
                ))}
              </>
            )}

            {/* Submit / confirmation row */}
            {(() => {
              const unsubmitted = week.sessions.filter((_, i) => {
                const key = `${week.weekNumber}-${i}`;
                return completedPlanSessions[key] && !submittedPlanSessions[key];
              }).length;
              const submitted = week.sessions.filter((_, i) =>
                submittedPlanSessions[`${week.weekNumber}-${i}`]
              ).length;

              if (unsubmitted > 0) {
                return (
                  <TouchableOpacity
                    onPress={() => onSubmitWeek(week.weekNumber)}
                    style={styles.submitWeekBtn}
                    activeOpacity={0.8}
                  >
                    <LinearGradient colors={["#3ECF75", "#2AB860"]} style={styles.submitWeekGrad}>
                      <Feather name="check-circle" size={15} color="#fff" />
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
                    <Feather name="check-circle" size={14} color={T.green} />
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

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const {
    summitGoal,
    trainingPlan,
    completedPlanSessions,
    assignedHills,
    nearbyHills,
    submittedPlanSessions,
    sessionReps,
    togglePlanSession,
    assignHillToSession,
    adjustPlanWithAI,
    planAdjusting,
    planAdjustNote,
    submitWeekSessions,
    setSessionReps,
  } = useApp();

  async function handleSubmitWeek(weekNum: number) {
    await submitWeekSessions(weekNum);
  }

  const currentWeek = getCurrentWeek(trainingPlan);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(
    new Set(currentWeek ? [currentWeek.weekNumber] : [])
  );
  const [hillPickerOpen, setHillPickerOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<{ weekNum: number; sessionIdx: number } | null>(null);

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
      assignHillToSession(activeSession.weekNum, activeSession.sessionIdx, hill);
    }
    setHillPickerOpen(false);
    setActiveSession(null);
  }

  const completedCount = Object.values(completedPlanSessions).filter(Boolean).length;

  if (!summitGoal || trainingPlan.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center" }}>
          <Feather name="calendar" size={28} color={T.blue} />
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

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Platform.OS === "web" ? 56 : insets.top + 16,
            paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(0).duration(500)} style={styles.header}>
          <View>
            <Text style={styles.title}>Training Plan</Text>
            <Text style={styles.subtitle}>{totalWeeks} weeks · {weeksLeft} remaining</Text>
          </View>
        </Animated.View>

        {planAdjustNote && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <View style={styles.adjustNoteCard}>
              <LinearGradient colors={[T.blueDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <View style={styles.adjustNoteInner}>
                <View style={styles.adjustNoteIcon}>
                  <Feather name="cpu" size={14} color={T.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adjustNoteTitle}>Plan adjusted by AI</Text>
                  <Text style={styles.adjustNoteBody}>{planAdjustNote}</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(60).duration(400)}>
          <View style={styles.phaseBar}>
            {phases.map(phase => (
              <View key={phase} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: PHASE_COLOR[phase] }]} />
                <Text style={styles.legendText}>{phase}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {trainingPlan.map((week, i) => (
          <WeekCard
            key={week.weekNumber}
            week={week}
            isExpanded={expandedWeeks.has(week.weekNumber)}
            onToggle={() => toggle(week.weekNumber)}
            index={i}
            completedPlanSessions={completedPlanSessions}
            assignedHills={assignedHills}
            nearbyHills={nearbyHills}
            submittedPlanSessions={submittedPlanSessions}
            sessionReps={sessionReps}
            onToggleSession={togglePlanSession}
            onAssignHill={openHillPicker}
            onSubmitWeek={handleSubmitWeek}
            onSetReps={setSessionReps}
          />
        ))}
      </ScrollView>

      {completedCount > 0 && (
        <View style={[styles.adjustBar, { paddingBottom: Platform.OS === "web" ? 16 : insets.bottom + 90 }]}>
          <TouchableOpacity
            onPress={adjustPlanWithAI}
            disabled={planAdjusting}
            style={[styles.adjustBtn, planAdjusting && { opacity: 0.7 }]}
            activeOpacity={0.85}
          >
            <LinearGradient colors={["#4A9FF5", "#2E7FD4"]} style={styles.adjustBtnGrad}>
              {planAdjusting ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.adjustBtnText}>Adjusting plan…</Text>
                </>
              ) : (
                <>
                  <Feather name="cpu" size={16} color="#fff" />
                  <Text style={styles.adjustBtnText}>
                    Adjust plan with AI · {completedCount} done
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      <HillPickerModal
        visible={hillPickerOpen}
        hills={nearbyHills}
        onSelect={handleHillSelect}
        onClose={() => { setHillPickerOpen(false); setActiveSession(null); }}
      />
    </LinearGradient>
  );
}

const mpStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
    paddingBottom: 36,
  },
  handle: { width: 36, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: "center", marginBottom: 18 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 4 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, marginBottom: 16 },
  empty: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  emptyHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center" },
  hillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  hillEmoji: { fontSize: 24 },
  hillName: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white },
  hillSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },
  hillStats: { alignItems: "flex-end" },
  hillElev: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.orange },
  hillReps: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
  },
  cancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.textMuted },
});

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 14,
  },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.white },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },
  adjustNoteCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.blue + "40",
    overflow: "hidden",
    marginBottom: 14,
  },
  adjustNoteInner: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14 },
  adjustNoteIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center" },
  adjustNoteTitle: { fontSize: 12, fontFamily: "Inter_700Bold", color: T.blue, marginBottom: 3 },
  adjustNoteBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.text, lineHeight: 19 },
  phaseBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
    backgroundColor: T.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.cardBorder,
    padding: 12,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontFamily: "Inter_500Medium", color: T.textMuted },
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
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.surface,
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
  sessionDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 15, marginTop: 2 },
  sessionElev: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 3 },
  sessionFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 3 },
  pickHillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: T.greenDim,
    borderWidth: 1,
    borderColor: T.green + "30",
  },
  pickHillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.green },
  assignedHillRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  assignedHillEmoji: { fontSize: 13, marginRight: 4 },
  assignedHillName: { fontSize: 12, fontFamily: "Inter_700Bold", color: T.white },
  assignedHillSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  hillRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 9,
    borderRadius: 10,
    backgroundColor: T.surface,
    marginBottom: 5,
  },
  hillRowText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: T.text, lineHeight: 17 },
  adjustBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  adjustBtn: { borderRadius: 16, overflow: "hidden" },
  adjustBtnGrad: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  adjustBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
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
