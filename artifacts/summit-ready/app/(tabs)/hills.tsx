import {
  Mountain, MapPin, TrendingUp, Repeat, Map, Trash2,
  PlusCircle, CheckCircle, Minus, Plus, X, BarChart2,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import { openMapsForHill } from "@/utils/openMaps";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp, NearbyHill } from "@/context/AppContext";
import { T } from "@/constants/theme";

const GRADE_COLOR: Record<string, string> = {
  "Easy": T.green,
  "Easy–Mod": T.green,
  "Moderate": T.blue,
  "Hard": T.orange,
  "Alpine": "#FF4444",
};

export default function MyHillsScreen() {
  const insets = useSafeAreaInsets();
  const { myHills, removeFromMyHills, addSession, summitGoal } = useApp();

  const [logTarget, setLogTarget] = useState<NearbyHill | null>(null);
  const [reps, setReps] = useState(1);
  const [logging, setLogging] = useState(false);
  const [loggedHill, setLoggedHill] = useState<string | null>(null);

  function openLogModal(hill: NearbyHill) {
    setLogTarget(hill);
    setReps(hill.repeats > 0 ? hill.repeats : 1);
  }

  function closeLogModal() {
    setLogTarget(null);
    setReps(1);
  }

  async function handleLogSession() {
    if (!logTarget) return;
    setLogging(true);
    try {
      const now = new Date();
      await addSession({
        date: now.toISOString(),
        type: "hill",
        distance: Math.round(logTarget.distance * reps * 2 * 10) / 10,
        elevationGain: logTarget.elevation * reps,
        duration: 0,
        effort: 3,
        notes: `${logTarget.name} — ${reps} rep${reps !== 1 ? "s" : ""}`,
        completed: true,
        weekNumber: 0,
        hillName: logTarget.name,
        reps,
      });
      setLoggedHill(logTarget.name);
      closeLogModal();
      setTimeout(() => setLoggedHill(null), 3000);
    } finally {
      setLogging(false);
    }
  }

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Platform.OS === "web" ? 56 : insets.top + 16,
            paddingBottom: Platform.OS === "web" ? 110 : insets.bottom + 130,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <Text style={styles.title}>My Hills</Text>
          {myHills.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{myHills.length}</Text>
            </View>
          )}
        </Animated.View>

        {/* Success flash */}
        {loggedHill && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <View style={styles.successBanner}>
              <CheckCircle size={14} color={T.green} />
              <Text style={styles.successText}>Session logged for {loggedHill}!</Text>
            </View>
          </Animated.View>
        )}

        {/* Empty state */}
        {myHills.length === 0 && (
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>⛰️</Text>
              <Text style={styles.emptyTitle}>No hills saved yet</Text>
              <Text style={styles.emptyText}>
                Head to the Track tab, find hills nearby, and tap "Add to my hills" to save them here.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                activeOpacity={0.8}
                onPress={() => router.push("/(tabs)/trails")}
              >
                <Mountain size={14} color={T.bg} />
                <Text style={styles.emptyBtnText}>Find hills</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Hill cards */}
        {myHills.map((hill, i) => {
          const gc = GRADE_COLOR[hill.grade] ?? T.blue;
          const wasJustLogged = loggedHill === hill.name;

          return (
            <Animated.View key={hill.name + i} entering={FadeInDown.delay(60 + i * 50).duration(400)}>
              <View style={styles.hillCard}>
                <LinearGradient colors={[gc + "08", "transparent"]} style={StyleSheet.absoluteFill} />

                {/* Top row */}
                <View style={styles.hillTop}>
                  <View style={[styles.hillIconBox, { backgroundColor: gc + "18" }]}>
                    <Text style={styles.hillEmoji}>{hill.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hillName}>{hill.name}</Text>
                    <Text style={styles.hillSurface}>{hill.surface}</Text>
                  </View>
                  <View style={[styles.gradeBadge, { backgroundColor: gc + "20" }]}>
                    <Text style={[styles.gradeText, { color: gc }]}>{hill.grade}</Text>
                  </View>
                </View>

                {/* Stats row */}
                <View style={styles.hillStats}>
                  <View style={styles.hillStat}>
                    <MapPin size={12} color={T.green} />
                    <Text style={styles.hillStatVal}>{hill.distance}km</Text>
                    <Text style={styles.hillStatLbl}>away</Text>
                  </View>
                  <View style={styles.hillStat}>
                    <TrendingUp size={12} color={T.orange} />
                    <Text style={styles.hillStatVal}>{hill.elevation}m</Text>
                    <Text style={styles.hillStatLbl}>per climb</Text>
                  </View>
                  <View style={styles.hillStat}>
                    <Repeat size={12} color={T.textMuted} />
                    <Text style={styles.hillStatVal}>{hill.repeats}×</Text>
                    <Text style={styles.hillStatLbl}>suggested</Text>
                  </View>
                  <View style={styles.hillStat}>
                    <BarChart2 size={12} color={T.purple} />
                    <Text style={styles.hillStatVal}>{hill.totalElevation}m</Text>
                    <Text style={styles.hillStatLbl}>total</Text>
                  </View>
                </View>

                {/* Action buttons */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.logBtn, wasJustLogged && { backgroundColor: T.greenDim, borderColor: T.green + "50" }]}
                    activeOpacity={0.75}
                    onPress={() => openLogModal(hill)}
                  >
                    {wasJustLogged
                      ? <CheckCircle size={14} color={T.green} />
                      : <PlusCircle size={14} color={T.green} />}
                    <Text style={[styles.logBtnText, wasJustLogged && { color: T.green }]}>
                      {wasJustLogged ? "Logged!" : "Log session"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.mapBtn}
                    activeOpacity={0.7}
                    onPress={() => openMapsForHill(hill.lat, hill.lng, hill.name)}
                  >
                    <Map size={14} color={T.blue} />
                    <Text style={styles.mapBtnText}>Map</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    activeOpacity={0.7}
                    onPress={() => removeFromMyHills(hill.name)}
                  >
                    <Trash2 size={14} color={T.red} />
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* Log session modal */}
      <Modal
        visible={!!logTarget}
        transparent
        animationType="slide"
        onRequestClose={closeLogModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeLogModal}>
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <LinearGradient
              colors={["#142236", "#0C1828"]}
              style={StyleSheet.absoluteFill}
            />

            {/* Handle */}
            <View style={styles.sheetHandle} />

            {/* Close button */}
            <TouchableOpacity style={styles.closeBtn} onPress={closeLogModal} activeOpacity={0.7}>
              <X size={18} color={T.textMuted} />
            </TouchableOpacity>

            {logTarget && (
              <>
                <Text style={styles.modalTitle}>Log session</Text>
                <Text style={styles.modalHillName}>{logTarget.emoji} {logTarget.name}</Text>

                {/* Reps stepper */}
                <View style={styles.repSection}>
                  <Text style={styles.repLabel}>Reps completed</Text>
                  <View style={styles.repStepper}>
                    <TouchableOpacity
                      onPress={() => setReps(r => Math.max(1, r - 1))}
                      disabled={reps <= 1}
                      style={[styles.stepBtn, reps <= 1 && { opacity: 0.3 }]}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Minus size={16} color={T.white} />
                    </TouchableOpacity>
                    <View style={styles.repValueBox}>
                      <Text style={styles.repValue}>{reps}</Text>
                      <Text style={styles.repUnit}>rep{reps !== 1 ? "s" : ""}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setReps(r => r + 1)}
                      style={styles.stepBtn}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Plus size={16} color={T.white} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Session summary */}
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <TrendingUp size={14} color={T.orange} />
                    <Text style={styles.summaryVal}>{logTarget.elevation * reps}m</Text>
                    <Text style={styles.summaryLbl}>elevation</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <MapPin size={14} color={T.green} />
                    <Text style={styles.summaryVal}>{Math.round(logTarget.distance * reps * 2 * 10) / 10}km</Text>
                    <Text style={styles.summaryLbl}>distance</Text>
                  </View>
                </View>

                {/* Log button */}
                <TouchableOpacity
                  style={[styles.confirmBtn, logging && { opacity: 0.7 }]}
                  activeOpacity={0.85}
                  onPress={handleLogSession}
                  disabled={logging}
                >
                  <LinearGradient colors={["#1E8C4E", "#14703D"]} style={StyleSheet.absoluteFill} />
                  <CheckCircle size={16} color="#fff" />
                  <Text style={styles.confirmBtnText}>{logging ? "Logging…" : "Log session"}</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18 },

  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.white },
  countBadge: { backgroundColor: T.greenDim, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: T.green + "40" },
  countText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.green },

  successBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: T.greenDim, borderRadius: 12, borderWidth: 1, borderColor: T.green + "40", paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14 },
  successText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.green, flex: 1 },

  emptyCard: { backgroundColor: T.card, borderRadius: 24, borderWidth: 1, borderColor: T.cardBorder, padding: 32, alignItems: "center", gap: 12, marginTop: 16 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: T.white },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 20 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: T.green, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 11, marginTop: 4, overflow: "hidden" },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.bg },

  hillCard: { backgroundColor: T.card, borderRadius: 20, borderWidth: 1, borderColor: T.cardBorder, padding: 16, marginBottom: 12, overflow: "hidden", gap: 12 },
  hillTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  hillIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  hillEmoji: { fontSize: 22 },
  hillName: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 2 },
  hillSurface: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  gradeBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 },
  gradeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  hillStats: { flexDirection: "row", gap: 14 },
  hillStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  hillStatVal: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.white },
  hillStatLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },

  actionRow: { flexDirection: "row", gap: 8 },
  logBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: T.green + "50", backgroundColor: T.greenDim },
  logBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.green },
  mapBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: T.blue + "40", backgroundColor: T.blueDim },
  mapBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.blue },
  removeBtn: { width: 42, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: T.red + "40", backgroundColor: T.red + "12" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16,
    overflow: "hidden", borderWidth: 1, borderColor: T.cardBorder,
    gap: 20,
  },
  sheetHandle: { width: 36, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  closeBtn: { position: "absolute", top: 16, right: 20, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: T.white, textAlign: "center" },
  modalHillName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.textMuted, textAlign: "center", marginTop: -12 },

  repSection: { alignItems: "center", gap: 12 },
  repLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.textMuted, letterSpacing: 0.4 },
  repStepper: { flexDirection: "row", alignItems: "center", gap: 20 },
  stepBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center" },
  repValueBox: { alignItems: "center", minWidth: 70 },
  repValue: { fontSize: 40, fontFamily: "Inter_700Bold", color: T.white, lineHeight: 46 },
  repUnit: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: -2 },

  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: T.surface, borderRadius: 16, borderWidth: 1, borderColor: T.border, paddingVertical: 14, paddingHorizontal: 24, gap: 0 },
  summaryItem: { flex: 1, alignItems: "center", gap: 4 },
  summaryDivider: { width: 1, height: 36, backgroundColor: T.border },
  summaryVal: { fontSize: 20, fontFamily: "Inter_700Bold", color: T.white },
  summaryLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },

  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 16, paddingVertical: 15, overflow: "hidden" },
  confirmBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
});
