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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NearbyHill, TrainingWeek, useApp } from "@/context/AppContext";
import { T, PHASE_COLOR } from "@/constants/theme";
import { getCurrentWeek } from "@/utils/planGenerator";
import { useSubscription } from "@/lib/revenuecat";

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
  targetReps: number;          // auto-calculated summit-equivalent
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
    <View style={rsStyles.container}>
      {/* Target badge */}
      <View style={rsStyles.targetRow}>
        <Feather name="flag" size={11} color={T.orange} />
        <Text style={rsStyles.targetLabel}>
          Today's target:{" "}
          <Text style={rsStyles.targetNum}>{targetReps} reps</Text>
        </Text>
        {targetElev !== null && (
          <Text style={rsStyles.targetElev}>= {targetElev}m total</Text>
        )}
      </View>

      {/* Log actuals row */}
      <View style={rsStyles.logRow}>
        <Text style={rsStyles.logLabel}>Today I did:</Text>

        <TouchableOpacity
          onPress={() => onSet(sessionKey, Math.max(0, displayReps - 1))}
          style={[rsStyles.btn, displayReps <= 0 && rsStyles.btnDisabled]}
          activeOpacity={0.7}
          disabled={displayReps <= 0}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="minus" size={12} color={displayReps <= 0 ? T.textDim : T.white} />
        </TouchableOpacity>

        <Text style={[rsStyles.count, hitTarget && rsStyles.countHit, hasLogged && !hitTarget && rsStyles.countPartial]}>
          {hasLogged ? displayReps : "–"}
        </Text>

        <TouchableOpacity
          onPress={() => onSet(sessionKey, displayReps + 1)}
          style={rsStyles.btn}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="plus" size={12} color={T.white} />
        </TouchableOpacity>

        {loggedElev !== null && (
          <Text style={[rsStyles.logElev, hitTarget && { color: T.green }]}>
            = {loggedElev}m
          </Text>
        )}

        {hitTarget && (
          <View style={rsStyles.hitBadge}>
            <Feather name="check" size={10} color={T.green} />
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

const rsStyles = StyleSheet.create({
  container: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: T.border,
    gap: 8,
  },
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

function HillPickerModal({
  visible,
  hills,
  location,
  onSelect,
  onSearchAdd,
  onClose,
}: {
  visible: boolean;
  hills: NearbyHill[];
  location: string;
  onSelect: (hill: NearbyHill) => void;
  onSearchAdd: (hill: NearbyHill) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [searchResult, setSearchResult] = React.useState<NearbyHill | null>(null);
  const [searchError, setSearchError] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return hills;
    const q = query.toLowerCase();
    return hills.filter(h => h.name.toLowerCase().includes(q));
  }, [query, hills]);

  async function searchOnline() {
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    setSearchResult(null);
    setSearchError(null);
    try {
      const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
        : "/api";
      const res = await fetch(`${API_BASE}/hills-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hillName: q, location }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json() as { hill: NearbyHill };
      setSearchResult(data.hill);
    } catch {
      setSearchError("Couldn't find that hill — try a different name.");
    } finally {
      setSearching(false);
    }
  }

  function handleSelect(hill: NearbyHill) {
    if (searchResult && hill.name === searchResult.name) {
      onSearchAdd(hill);
    }
    onSelect(hill);
    setQuery("");
    setSearchResult(null);
    setSearchError(null);
  }

  function handleClose() {
    setQuery("");
    setSearchResult(null);
    setSearchError(null);
    onClose();
  }

  const showOnlineSearch = query.trim().length >= 2 && filtered.length === 0 && !searchResult;
  const showOnlineBtn = query.trim().length >= 2 && !searching && !searchResult;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={mpStyles.overlay} activeOpacity={1} onPress={handleClose} />
      <View style={mpStyles.sheet}>
        <View style={mpStyles.handle} />
        <Text style={mpStyles.title}>Choose a Hill</Text>

        {/* Search bar */}
        <View style={mpStyles.searchRow}>
          <Feather name="search" size={15} color={T.textMuted} style={{ marginLeft: 12 }} />
          <TextInput
            style={mpStyles.searchInput}
            value={query}
            onChangeText={v => { setQuery(v); setSearchResult(null); setSearchError(null); }}
            placeholder="Search your hills or find a new one…"
            placeholderTextColor={T.textDim}
            onSubmitEditing={searchOnline}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(""); setSearchResult(null); setSearchError(null); }} style={{ paddingRight: 12 }}>
              <Feather name="x" size={14} color={T.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">

          {/* Online search result */}
          {searchResult && (
            <View style={mpStyles.searchResultCard}>
              <View style={mpStyles.searchResultHeader}>
                <Feather name="globe" size={12} color={T.blue} />
                <Text style={mpStyles.searchResultLabel}>Online result</Text>
              </View>
              <TouchableOpacity
                style={[mpStyles.hillRow, { borderBottomWidth: 0 }]}
                onPress={() => handleSelect(searchResult)}
                activeOpacity={0.7}
              >
                <Text style={mpStyles.hillEmoji}>{searchResult.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={mpStyles.hillName}>{searchResult.name}</Text>
                  <Text style={mpStyles.hillSub}>{searchResult.surface} · {searchResult.grade} grade</Text>
                </View>
                <View style={mpStyles.hillStats}>
                  <Text style={mpStyles.hillElev}>{searchResult.elevation}m</Text>
                  <Text style={mpStyles.hillReps}>×{searchResult.repeats}</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Search error */}
          {searchError && (
            <View style={mpStyles.searchErrorRow}>
              <Feather name="alert-circle" size={14} color={T.orange} />
              <Text style={mpStyles.searchErrorText}>{searchError}</Text>
            </View>
          )}

          {/* "Search online" prompt when no local match */}
          {showOnlineBtn && (
            <TouchableOpacity style={mpStyles.onlineSearchBtn} onPress={searchOnline} activeOpacity={0.8}>
              {searching ? (
                <ActivityIndicator size="small" color={T.blue} />
              ) : (
                <Feather name="globe" size={14} color={T.blue} />
              )}
              <Text style={mpStyles.onlineSearchText}>
                {searching ? "Searching…" : `Search online for "${query.trim()}"`}
              </Text>
            </TouchableOpacity>
          )}

          {searching && (
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <ActivityIndicator size="small" color={T.blue} />
              <Text style={[mpStyles.hillSub, { marginTop: 8 }]}>Looking up hill data…</Text>
            </View>
          )}

          {/* Local hills list */}
          {filtered.length === 0 && !query.trim() ? (
            <View style={mpStyles.empty}>
              <Feather name="map-pin" size={28} color={T.textDim} />
              <Text style={mpStyles.emptyText}>No hills loaded yet</Text>
              <Text style={mpStyles.emptyHint}>Go to the Hills tab to load nearby hills, or search by name above</Text>
            </View>
          ) : filtered.length === 0 && query.trim() ? null : (
            <>
              {query.trim() ? null : (
                <Text style={mpStyles.sectionLabel}>Your hills</Text>
              )}
              {filtered.map((hill, i) => (
                <TouchableOpacity
                  key={i}
                  style={mpStyles.hillRow}
                  onPress={() => handleSelect(hill)}
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
            </>
          )}
        </ScrollView>

        <TouchableOpacity style={mpStyles.cancelBtn} onPress={handleClose} activeOpacity={0.7}>
          <Text style={mpStyles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function getExerciseAlternatives(label: string): { name: string; icon: string; desc: string }[] {
  const l = label.toLowerCase();
  const isStairs = l.includes("stair") || l.includes("step") || l.includes("climb");
  const isRun = l.includes("run") || l.includes("jog") || l.includes("walk");

  const stairAlts = [
    { name: "Incline Treadmill", icon: "trending-up", desc: "10–15% incline, brisk hike pace" },
    { name: "StairMaster", icon: "layers", desc: "Continuous stair climbing machine" },
    { name: "Stepper Machine", icon: "activity", desc: "Step machine for leg drive and cardio" },
    { name: "Box Step-Ups", icon: "square", desc: "Weighted step-ups onto a box or bench" },
    { name: "Weighted Stairs", icon: "package", desc: "Stairs with a loaded pack or weight vest" },
    { name: "Elliptical (high resistance)", icon: "refresh-cw", desc: "High resistance, simulate climbing effort" },
  ];
  const cardioAlts = [
    { name: "Incline Treadmill", icon: "trending-up", desc: "10–15% incline, brisk hike pace" },
    { name: "Indoor Cycling", icon: "wind", desc: "High cadence cycling for aerobic base" },
    { name: "Rowing Machine", icon: "anchor", desc: "Full body cardio with strong leg drive" },
    { name: "Elliptical", icon: "refresh-cw", desc: "Sustained aerobic effort, moderate resistance" },
    { name: "StairMaster", icon: "layers", desc: "Continuous stair climbing machine" },
    { name: "Swimming", icon: "droplet", desc: "Low impact aerobic conditioning" },
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
  assignedHills,
  nearbyHills,
  submittedPlanSessions,
  sessionReps,
  summitGoal,
  onToggleSession,
  onAssignHill,
  onSubmitWeek,
  onSetReps,
  onEditSession,
  onSwapExercise,
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
  summitGoal: import("@/context/AppContext").SummitGoal | null;
  onToggleSession: (weekNum: number, sessionIdx: number) => void;
  onAssignHill: (weekNum: number, sessionIdx: number) => void;
  onSubmitWeek: (weekNum: number) => void;
  onSetReps: (key: string, reps: number) => void;
  onEditSession: (weekNum: number, sessionIdx: number) => void;
  onSwapExercise: (weekNum: number, sessionIdx: number, label: string) => void;
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
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={styles.sessionDur}>{s.duration}</Text>
                        <TouchableOpacity
                          onPress={() => onEditSession(week.weekNumber, i)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.7}
                        >
                          <Feather name="edit-2" size={13} color={T.textMuted} />
                        </TouchableOpacity>
                      </View>
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
                      {canPickHill ? (
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
                      ) : (
                        <TouchableOpacity
                          onPress={() => onSwapExercise(week.weekNumber, i, s.label)}
                          style={styles.swapBtn}
                          activeOpacity={0.7}
                        >
                          <Feather name="refresh-cw" size={11} color={T.blue} />
                          <Text style={styles.swapBtnText}>Swap exercise</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {canPickHill && (() => {
                      const hill = assignedHill ?? week.hills[0] ?? null;
                      // elevPerRep: height gained per single rep on this hill
                      const elevPerRep = hill ? hill.elevation : Math.max(50, Math.round(s.targetElevation / 4));
                      // targetReps: how many reps of this hill to hit this session's elevation target
                      const targetReps = Math.max(1, Math.ceil(s.targetElevation / elevPerRep));
                      return (
                        <RepStepper
                          sessionKey={sessionKey}
                          targetReps={targetReps}
                          elevPerRep={elevPerRep}
                          sessionReps={sessionReps}
                          isDone={isDone}
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
    sessionEfforts,
    togglePlanSession,
    assignHillToSession,
    adjustPlanWithAI,
    planAdjusting,
    planAdjustNote,
    submitWeekSessions,
    setSessionReps,
    setSessionEffort,
    updatePlanSession,
    addToNearbyHills,
  } = useApp();

  async function handleSubmitWeek(weekNum: number) {
    await submitWeekSessions(weekNum);
  }

  const { isSubscribed } = useSubscription();
  const currentWeek = getCurrentWeek(trainingPlan);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(
    new Set(currentWeek ? [currentWeek.weekNumber] : [])
  );
  const [hillPickerOpen, setHillPickerOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<{ weekNum: number; sessionIdx: number } | null>(null);

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
      assignHillToSession(activeSession.weekNum, activeSession.sessionIdx, hill);
    }
    setHillPickerOpen(false);
    setActiveSession(null);
  }

  function openEditSession(weekNum: number, sessionIdx: number) {
    const week = trainingPlan.find(w => w.weekNumber === weekNum);
    const session = week?.sessions[sessionIdx];
    if (!session) return;
    const key = `${weekNum}-${sessionIdx}`;
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
    await updatePlanSession(swapTarget.weekNum, swapTarget.sessionIdx, { label: newLabel, description: newDescription });
    setSwapModalOpen(false);
    setSwapTarget(null);
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

        {trainingPlan.map((week, i) => {
          const isPlanLocked = !isSubscribed && week.weekNumber > 1;
          if (isPlanLocked && week.weekNumber === 2) {
            return (
              <Animated.View key={week.weekNumber} entering={FadeInDown.delay(i * 40).duration(400)}>
                <TouchableOpacity onPress={() => router.push("/paywall")} activeOpacity={0.85} style={planLockStyles.card}>
                  <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
                  <View style={planLockStyles.iconWrap}>
                    <Feather name="lock" size={22} color={T.green} />
                  </View>
                  <Text style={planLockStyles.title}>
                    {trainingPlan.length - 1} more weeks in your plan
                  </Text>
                  <Text style={planLockStyles.sub}>
                    Upgrade to unlock your full {trainingPlan.length}-week plan, AI-powered adaptation, and week-by-week guidance all the way to your summit.
                  </Text>
                  <View style={planLockStyles.featureRow}>
                    {["Adaptive AI plan", "All weeks unlocked", "Progress tracking"].map(f => (
                      <View key={f} style={planLockStyles.featureChip}>
                        <Feather name="check" size={11} color={T.green} />
                        <Text style={planLockStyles.featureText}>{f}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={planLockStyles.btn}>
                    <Feather name="zap" size={13} color={T.bg} />
                    <Text style={planLockStyles.btnText}>Unlock full plan</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
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
              assignedHills={assignedHills}
              nearbyHills={nearbyHills}
              submittedPlanSessions={submittedPlanSessions}
              sessionReps={sessionReps}
              summitGoal={summitGoal}
              onToggleSession={togglePlanSession}
              onAssignHill={openHillPicker}
              onSubmitWeek={handleSubmitWeek}
              onSetReps={setSessionReps}
              onEditSession={openEditSession}
              onSwapExercise={openSwapExercise}
            />
          );
        })}
      </ScrollView>

      {completedCount > 0 && isSubscribed && (
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
        location={summitGoal?.location ?? ""}
        onSelect={handleHillSelect}
        onSearchAdd={addToNearbyHills}
        onClose={() => { setHillPickerOpen(false); setActiveSession(null); }}
      />

      {/* Edit Session Modal */}
      <Modal visible={editModalOpen} transparent animationType="fade" onRequestClose={() => setEditModalOpen(false)}>
        <TouchableOpacity style={editStyles.backdrop} activeOpacity={1} onPress={() => setEditModalOpen(false)} />
        <View style={editStyles.sheet}>
          <View style={editStyles.handle} />
          <View style={editStyles.titleRow}>
            <Feather name="edit-2" size={16} color={T.blue} />
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
                <Feather name="check" size={15} color="#fff" />
                <Text style={editStyles.saveText}>Save changes</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Swap Exercise Modal */}
      <Modal visible={swapModalOpen} transparent animationType="fade" onRequestClose={() => setSwapModalOpen(false)}>
        <TouchableOpacity style={editStyles.backdrop} activeOpacity={1} onPress={() => setSwapModalOpen(false)} />
        <View style={editStyles.sheet}>
          <View style={editStyles.handle} />
          <View style={editStyles.titleRow}>
            <Feather name="refresh-cw" size={16} color={T.blue} />
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
                <Feather name={opt.icon as any} size={15} color={T.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={editStyles.swapName}>{opt.name}</Text>
                <Text style={editStyles.swapDesc}>{opt.desc}</Text>
              </View>
              <Feather name="chevron-right" size={14} color={T.textMuted} />
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
    </LinearGradient>
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
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.surface,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: T.blue + "40",
    height: 46,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 46,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: T.white,
    paddingRight: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: T.textMuted,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  onlineSearchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: T.blue + "12",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.blue + "30",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginVertical: 6,
  },
  onlineSearchText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: T.blue,
  },
  searchResultCard: {
    backgroundColor: T.blue + "0C",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.blue + "30",
    marginBottom: 8,
    overflow: "hidden",
    paddingHorizontal: 8,
  },
  searchResultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 10,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  searchResultLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: T.blue,
    letterSpacing: 0.3,
  },
  searchErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  searchErrorText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: T.orange,
    flex: 1,
  },
});

const planLockStyles = StyleSheet.create({
  card: {
    borderRadius: 18, borderWidth: 1, borderColor: T.green + "40",
    backgroundColor: T.card, overflow: "hidden",
    alignItems: "center", padding: 24, gap: 10, marginBottom: 10,
  },
  iconWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: T.greenDim, borderWidth: 1, borderColor: T.green + "50",
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.white, textAlign: "center" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 19 },
  featureRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 2 },
  featureChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, backgroundColor: T.greenDim,
    borderWidth: 1, borderColor: T.green + "30",
  },
  featureText: { fontSize: 12, fontFamily: "Inter_500Medium", color: T.green },
  btn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: T.green, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 10, marginTop: 4,
  },
  btnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.bg },
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
  swapBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1,
    borderColor: T.blue + "50", backgroundColor: T.blueDim,
  },
  swapBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.blue },
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
