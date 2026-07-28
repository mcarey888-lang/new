import {
  Mountain, MapPin, TrendingUp, Repeat, Map, Trash2,
  PlusCircle, CheckCircle, Minus, Plus, X, BarChart2, Info,
  Clock, Activity, Footprints, Search, AlertCircle,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { openMapsForHill } from "@/utils/openMaps";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp, NearbyHill, ExploreHike, Session } from "@/context/AppContext";
import { useChallenges } from "@/context/ChallengesContext";
import { AddToChallengeSheet } from "@/components/AddToChallengeSheet";
import { T } from "@/constants/theme";
import { useScreenView } from "@/lib/analytics";

const GRADE_COLOR: Record<string, string> = {
  "Easy": T.green,
  "Easy–Mod": T.green,
  "Moderate": T.blue,
  "Hard": T.orange,
  "Alpine": "#FF4444",
};

function fmtDuration(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function HikeDetailSheet({ hike, onClose }: { hike: ExploreHike; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.hdOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.hdSheet, { paddingBottom: insets.bottom + 24 }]}>
          <LinearGradient colors={["#142236", "#0C1828"]} style={StyleSheet.absoluteFill} />
          <View style={styles.hdHandle} />
          <View style={styles.hdHeader}>
            <View style={[styles.hdIconBox, { backgroundColor: T.green + "18" }]}>
              <Footprints size={20} color={T.green} />
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

export default function MyHillsScreen() {
  useScreenView("hills");
  const insets = useSafeAreaInsets();
  const { myHills, removeFromMyHills, addSession, summitGoal, sessions, exploreHikes, deleteExploreHike, addToMyHills, addToNearbyHills } = useApp();
  const { activeChallenges } = useChallenges();
  const location = summitGoal?.location ?? "";

  const hillSessions = sessions.filter((s: Session) => s.type === "hill");

  const [logTarget, setLogTarget] = useState<NearbyHill | null>(null);
  const [reps, setReps] = useState(1);
  const [logging, setLogging] = useState(false);
  const [loggedHill, setLoggedHill] = useState<string | null>(null);
  const [selectedHike, setSelectedHike] = useState<ExploreHike | null>(null);
  const [pendingChallenge, setPendingChallenge] = useState<{
    hillName: string; elevationGain: number; distance: number; date: string;
  } | null>(null);

  // Search hills state
  const [searchText, setSearchText] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<NearbyHill | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchAdded, setSearchAdded] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  async function handleHillSearch() {
    const query = searchText.trim();
    if (query.length < 2) return;
    setSearchLoading(true);
    setSearchResult(null);
    setSearchError(null);
    setSearchAdded(false);
    try {
      const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
        : "/api";
      const res = await fetch(`${API_BASE}/hills-unified`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hillName: query, location: summitGoal?.location ?? "" }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json() as { hill: NearbyHill };
      setSearchResult(data.hill);
    } catch {
      setSearchError("Couldn't find that hill — try a different name or spelling.");
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleAddSearchResult() {
    if (!searchResult) return;
    await addToMyHills(searchResult);
    await addToNearbyHills(searchResult);
    setSearchAdded(true);
  }

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
      const dateStr = now.toISOString().split("T")[0];
      const elevGain = logTarget.elevation * reps;
      const dist = Math.round(logTarget.distance * reps * 2 * 10) / 10;
      await addSession({
        date: now.toISOString(),
        type: "hill",
        distance: dist,
        elevationGain: elevGain,
        duration: 0,
        effort: 3,
        notes: `${logTarget.name} — ${reps} rep${reps !== 1 ? "s" : ""}`,
        completed: true,
        weekNumber: 0,
        hillName: logTarget.name,
        reps,
      });
      const hillName = logTarget.name;
      setLoggedHill(hillName);
      closeLogModal();
      setTimeout(() => setLoggedHill(null), 3000);
      const hasActive = activeChallenges.some(ac => !ac.completed);
      if (hasActive) {
        setPendingChallenge({ hillName, elevationGain: elevGain, distance: dist, date: dateStr });
      }
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

        {/* Search Hills card */}
        <Animated.View entering={FadeInDown.delay(40).duration(400)}>
          <View style={styles.searchCard}>
            <View style={styles.searchHeader}>
              <Search size={14} color={T.purple} />
              <Text style={styles.searchTitle}>Search Hills</Text>
            </View>
            <Text style={styles.searchHint}>Know a hill you want to train on? Search by name.</Text>
            <View style={styles.searchRow}>
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                value={searchText}
                onChangeText={t => { setSearchText(t); setSearchResult(null); setSearchError(null); setSearchAdded(false); }}
                placeholder="e.g. Pendle Hill, Ben Nevis…"
                placeholderTextColor={T.textDim}
                returnKeyType="search"
                onSubmitEditing={handleHillSearch}
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={handleHillSearch}
                disabled={searchLoading || searchText.trim().length < 2}
                style={[styles.searchBtn, (searchLoading || searchText.trim().length < 2) && { opacity: 0.45 }]}
                activeOpacity={0.75}
              >
                {searchLoading
                  ? <ActivityIndicator size="small" color={T.white} />
                  : <Search size={16} color={T.white} />}
              </TouchableOpacity>
            </View>

            {searchError && (
              <View style={styles.searchErrRow}>
                <AlertCircle size={13} color={T.red} />
                <Text style={styles.searchErrText}>{searchError}</Text>
              </View>
            )}

            {searchResult && (
              <View style={styles.searchResultCard}>
                <LinearGradient colors={[T.purpleDim, "transparent"]} style={StyleSheet.absoluteFill} />
                <View style={styles.searchResultTop}>
                  <Text style={styles.searchResultEmoji}>{searchResult.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultName}>{searchResult.name}</Text>
                    <Text style={styles.searchResultSub}>{searchResult.surface}</Text>
                  </View>
                  <View style={[styles.searchGradeBadge, { backgroundColor: (GRADE_COLOR[searchResult.grade] ?? T.blue) + "25" }]}>
                    <Text style={[styles.searchGradeText, { color: GRADE_COLOR[searchResult.grade] ?? T.blue }]}>{searchResult.grade}</Text>
                  </View>
                </View>
                <View style={styles.searchResultStats}>
                  <View style={styles.searchStat}><TrendingUp size={11} color={T.orange} /><Text style={styles.searchStatVal}>{searchResult.elevation}m</Text><Text style={styles.searchStatLbl}>per rep</Text></View>
                  <View style={styles.searchStat}><MapPin size={11} color={T.green} /><Text style={styles.searchStatVal}>{searchResult.distance}km</Text><Text style={styles.searchStatLbl}>away</Text></View>
                  <View style={styles.searchStat}><Repeat size={11} color={T.textMuted} /><Text style={styles.searchStatVal}>{searchResult.repeats}×</Text><Text style={styles.searchStatLbl}>recs</Text></View>
                  <View style={styles.searchStat}><BarChart2 size={11} color={T.purple} /><Text style={styles.searchStatVal}>{searchResult.totalElevation}m</Text><Text style={styles.searchStatLbl}>total</Text></View>
                </View>
                <TouchableOpacity
                  onPress={handleAddSearchResult}
                  disabled={searchAdded}
                  style={[styles.searchAddBtn, searchAdded && { backgroundColor: T.greenDim, borderColor: T.green + "50" }]}
                  activeOpacity={0.75}
                >
                  {searchAdded ? <CheckCircle size={14} color={T.green} /> : <PlusCircle size={14} color={T.purple} />}
                  <Text style={[styles.searchAddText, searchAdded && { color: T.green }]}>
                    {searchAdded ? "Added to your hills!" : "Add to my hills"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
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

        {/* GPS Tracked Hikes */}
        {exploreHikes.length > 0 && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <Text style={styles.sectionHeading}>GPS Tracked Hikes</Text>
            {exploreHikes.map((hike, i) => (
              <TouchableOpacity
                key={hike.id}
                style={styles.hikeCard}
                activeOpacity={0.85}
                onPress={() => setSelectedHike(hike)}
              >
                <View style={[styles.hikeIconBox, { backgroundColor: T.green + "18" }]}>
                  <Footprints size={20} color={T.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hikeName}>{hike.name}</Text>
                  <Text style={styles.hikeDate}>
                    {new Date(hike.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </Text>
                </View>
                <View style={styles.hikeStats}>
                  <View style={styles.hikeStat}>
                    <TrendingUp size={11} color={T.orange} />
                    <Text style={styles.hikeStatVal}>{hike.elevationGain}m</Text>
                  </View>
                  <View style={styles.hikeStat}>
                    <Map size={11} color={T.blue} />
                    <Text style={styles.hikeStatVal}>{hike.distance.toFixed(1)}km</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}

        {/* Hill Sessions */}
        {hillSessions.length > 0 && (
          <Animated.View entering={FadeInDown.delay(130).duration(400)}>
            <Text style={styles.sectionHeading}>Hill Sessions</Text>
            {hillSessions.map((session: Session, i: number) => (
              <View key={session.id} style={styles.hillSessionCard}>
                <View style={[styles.hikeIconBox, { backgroundColor: T.purple + "18" }]}>
                  <Activity size={18} color={T.purple} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hikeName}>{session.hillName ?? "Hill session"}</Text>
                  <Text style={styles.hikeDate}>
                    {new Date(session.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </Text>
                </View>
                <View style={styles.hikeStats}>
                  {!!session.reps && (
                    <View style={styles.hikeStat}>
                      <Repeat size={11} color={T.textMuted} />
                      <Text style={styles.hikeStatVal}>{session.reps}×</Text>
                    </View>
                  )}
                  <View style={styles.hikeStat}>
                    <TrendingUp size={11} color={T.orange} />
                    <Text style={styles.hikeStatVal}>{session.elevationGain}m</Text>
                  </View>
                </View>
              </View>
            ))}
          </Animated.View>
        )}

        {/* My Hills heading */}
        {myHills.length > 0 && (
          <Text style={styles.sectionHeading}>My Hills</Text>
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
                    onPress={() => openMapsForHill(hill.lat, hill.lng, hill.name, false, summitGoal?.location)}
                  >
                    <Map size={14} color={T.blue} />
                    <Text style={styles.mapBtnText}>Map</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.detailsBtn}
                    activeOpacity={0.7}
                    onPress={() =>
                      router.push({
                        pathname: "/hill-detail",
                        params: {
                          name:      hill.name,
                          location,
                          lat:       hill.lat?.toString()       ?? "",
                          lng:       hill.lng?.toString()       ?? "",
                          elevation: hill.elevation.toString(),
                          distance:  hill.distance.toString(),
                          grade:     hill.grade,
                          surface:   hill.surface,
                          emoji:     hill.emoji,
                        },
                      })
                    }
                  >
                    <Info size={14} color={T.purple} />
                    <Text style={styles.detailsBtnText}>Details</Text>
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

      {selectedHike && <HikeDetailSheet hike={selectedHike} onClose={() => setSelectedHike(null)} />}

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

      <AddToChallengeSheet
        visible={!!pendingChallenge}
        onClose={() => setPendingChallenge(null)}
        hillName={pendingChallenge?.hillName ?? ""}
        elevationGain={pendingChallenge?.elevationGain ?? 0}
        distance={pendingChallenge?.distance ?? 0}
        date={pendingChallenge?.date ?? ""}
      />
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
  detailsBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: T.purple + "40", backgroundColor: T.purple + "15" },
  detailsBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.purple },
  removeBtn: { width: 42, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: T.red + "40", backgroundColor: T.red + "12" },

  searchCard: { backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.purple + "35", overflow: "hidden", marginBottom: 16, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  searchHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  searchTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text, letterSpacing: 0.5 },
  searchHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 17 },
  searchRow: { flexDirection: "row", gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: T.white, backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border, paddingHorizontal: 14, paddingVertical: 10 },
  searchBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: T.purple, alignItems: "center", justifyContent: "center" },
  searchErrRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  searchErrText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.red, flex: 1 },
  searchResultCard: { borderRadius: 14, borderWidth: 1, borderColor: T.purple + "35", overflow: "hidden", padding: 12, gap: 10 },
  searchResultTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchResultEmoji: { fontSize: 22 },
  searchResultName: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white },
  searchResultSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  searchGradeBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  searchGradeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  searchResultStats: { flexDirection: "row", gap: 16 },
  searchStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  searchStatVal: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.white },
  searchStatLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  searchAddBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: T.purple + "50", backgroundColor: T.purpleDim },
  searchAddText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.purple },

  sectionHeading: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.textMuted, letterSpacing: 0.5, marginBottom: 10, marginTop: 6 },

  hikeCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.cardBorder,
    paddingVertical: 14, paddingHorizontal: 14, marginBottom: 10,
  },
  hillSessionCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.cardBorder,
    paddingVertical: 14, paddingHorizontal: 14, marginBottom: 10,
  },
  hikeIconBox: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  hikeName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.white },
  hikeDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },
  hikeStats: { alignItems: "flex-end", gap: 4 },
  hikeStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  hikeStatVal: { fontSize: 12, fontFamily: "Inter_700Bold", color: T.white },

  hdOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  hdSheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 22, paddingTop: 16, gap: 16,
    overflow: "hidden", borderWidth: 1, borderColor: T.cardBorder,
  },
  hdHandle: { width: 36, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  hdHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  hdIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  hdTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.white },
  hdDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },
  hdCloseBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  hdStatRow: { flexDirection: "row", backgroundColor: T.surface, borderRadius: 16, borderWidth: 1, borderColor: T.border, paddingVertical: 16 },
  hdStatCell: { flex: 1, alignItems: "center", gap: 4 },
  hdStatDivider: { width: 1, backgroundColor: T.border, marginVertical: 4 },
  hdStatVal: { fontSize: 20, fontFamily: "Inter_700Bold", color: T.white },
  hdStatLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  hdNotesBox: { backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 14 },
  hdNotesText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 20 },

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
