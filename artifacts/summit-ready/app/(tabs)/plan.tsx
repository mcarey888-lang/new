import type { LucideIcon } from "lucide-react-native";
import { Flag, Minus, Plus, Check, Search, X, Globe, AlertCircle, MapPin, ChevronDown, ChevronUp, ChevronLeft, TrendingUp, Zap, Heart, Pencil, CheckCircle, RefreshCw, ChevronRight, Calendar, Cpu, Lock, Layers, Activity, Square, Package, Anchor, Droplet, Wind, Mountain, Play } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageBackground,
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
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NearbyHill, TrainingWeek, useApp } from "@/context/AppContext";
import { T, PHASE_COLOR } from "@/constants/theme";
import { useScreenView } from "@/lib/analytics";
import { getCurrentWeek, parseDurationMidpoint } from "@/utils/planGenerator";
import { useSubscription } from "@/lib/revenuecat";
import { assignSessionsToDays, DAY_SHORT, DAY_FULL } from "@/utils/dayAssignment";

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

  async function handleMarkComplete() {
    if (!isDone) {
      onMarkComplete();
      // Fire-and-forget: save estimated completion to backend
      try {
        await fetch(`${PLAN_API_BASE}/hill-session/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plannedHillName: hillName ?? sessionKey,
            trainingSessionId: sessionKey,
            targetReps,
            estimatedGainPerRepM: elevPerRep,
            estimatedTotalGainM: Math.round(estimatedTotalGain),
          }),
        });
      } catch { /* best-effort — local state already updated */ }
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
      const res = await fetch(`${API_BASE}/hills-unified`, {
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
          <Search size={15} color={T.textMuted} style={{ marginLeft: 12 }} />
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
              <X size={14} color={T.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">

          {/* Online search result */}
          {searchResult && (
            <View style={mpStyles.searchResultCard}>
              <View style={mpStyles.searchResultHeader}>
                <Globe size={12} color={T.blue} />
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
              <AlertCircle size={14} color={T.orange} />
              <Text style={mpStyles.searchErrorText}>{searchError}</Text>
            </View>
          )}

          {/* "Search online" prompt when no local match */}
          {showOnlineBtn && (
            <TouchableOpacity style={mpStyles.onlineSearchBtn} onPress={searchOnline} activeOpacity={0.8}>
              {searching ? (
                <ActivityIndicator size="small" color={T.blue} />
              ) : (
                <Globe size={14} color={T.blue} />
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
              <MapPin size={28} color={T.textDim} />
              <Text style={mpStyles.emptyText}>No nearby hills found</Text>
              <Text style={mpStyles.emptyHint}>
                Visit the Hills tab to discover hills near your location, then come back to assign one here.
                {"\n\n"}You can also type any hill name in the search box above to find it directly.
              </Text>
              <TouchableOpacity
                style={mpStyles.emptyBtn}
                onPress={() => { onClose(); router.push("/(tabs)/hills"); }}
                activeOpacity={0.8}
              >
                <Text style={mpStyles.emptyBtnText}>Go to Hills tab →</Text>
              </TouchableOpacity>
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
  onToggleSession,
  onSubmitWeek,
  onEditSession,
  onSwapExercise,
  onChangeHill,
  onSessionPress,
}: {
  week: TrainingWeek;
  isExpanded: boolean;
  onToggle: () => void;
  index: number;
  completedPlanSessions: Record<string, boolean>;
  submittedPlanSessions: Record<string, boolean>;
  onToggleSession: (weekNum: number, sessionIdx: number) => void;
  onSubmitWeek: (weekNum: number) => void;
  onEditSession: (weekNum: number, sessionIdx: number) => void;
  onSwapExercise: (weekNum: number, sessionIdx: number, label: string) => void;
  onChangeHill: (weekNum: number, sessionIdx: number) => void;
  onSessionPress: (sessionIdx: number) => void;
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
              const sessionKey = `${week.weekNumber}-${i}`;
              const isDone = !!completedPlanSessions[sessionKey];
              const isSubmitted = !!submittedPlanSessions[sessionKey];
              const tc = s.type === "bigDay" ? T.orange : s.type === "cardio" ? T.blue : T.green;
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
                      </View>
                    </View>
                    {s.targetElevation > 0 && (
                      <Text style={[styles.sessionElev, { color: T.orange }]}>↑{s.targetElevation}m</Text>
                    )}
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
    readinessScore,
    sessions,
    exploreHikes,
    sessionDayOverrides,
    setSessionDayOverride,
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

  // Mission dashboard navigation state
  const [viewedWeekNum, setViewedWeekNum] = useState<number>(currentWeek?.weekNumber ?? 1);
  const [selectedDow, setSelectedDow] = useState<number>(new Date().getDay());
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
      assignHillToSession(activeSession.weekNum, activeSession.sessionIdx, hill);
      // Sync the session label and elevation to match the newly chosen hill
      const newTargetElevation = hill.elevation * hill.repeats;
      updatePlanSession(activeSession.weekNum, activeSession.sessionIdx, {
        label: `Hill Repeats — ${hill.name}`,
        targetElevation: newTargetElevation,
      });
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

  if (!summitGoal || trainingPlan.length === 0) {
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
  const readinessColor = readinessScore >= 70 ? T.green : readinessScore >= 40 ? T.orange : "#EF4444";
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
  const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const; // Mon → Sun
  const viewedWeek = trainingPlan.find(w => w.weekNumber === viewedWeekNum) ?? trainingPlan[0];
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
  const missionImageSubject = selectedHill?.name ?? (selectedSession?.type !== "cardio" ? selectedSession?.label : null) ?? summitGoal.mountainName;
  const missionImageUri = `${PLAN_API_BASE}/mountain-image?name=${encodeURIComponent(missionImageSubject)}&width=200&height=200`;

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

  // Keep swipe callback fresh
  missionSwipeRef.current = (dir: 1 | -1) => {
    const currentDowIdx = DISPLAY_ORDER.indexOf(selectedDow as typeof DISPLAY_ORDER[number]);
    if (currentDowIdx === -1) return;
    const nextDowIdx = currentDowIdx + dir;
    if (nextDowIdx >= 0 && nextDowIdx < DISPLAY_ORDER.length) {
      setSelectedDow(DISPLAY_ORDER[nextDowIdx]);
    } else if (nextDowIdx >= DISPLAY_ORDER.length) {
      const nextW = trainingPlan.find(w => w.weekNumber === viewedWeekNum + 1);
      if (nextW) { setViewedWeekNum(viewedWeekNum + 1); setSelectedDow(DISPLAY_ORDER[0]); }
    } else {
      const prevW = trainingPlan.find(w => w.weekNumber === viewedWeekNum - 1);
      if (prevW) { setViewedWeekNum(viewedWeekNum - 1); setSelectedDow(DISPLAY_ORDER[DISPLAY_ORDER.length - 1]); }
    }
  };

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: 0,
            paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── EXPEDITION DASHBOARD ──────────────────────────────────── */}
        {heroImageUri ? (
          <ImageBackground
            source={{ uri: heroImageUri }}
            style={dashStyles.hero}
            resizeMode="cover"
            onError={() => setHeroImageError(true)}
          >
            <LinearGradient colors={["transparent", "rgba(6,13,27,0.75)", T.bg]} style={StyleSheet.absoluteFill} />
            <View style={[dashStyles.heroContent, { paddingTop: Platform.OS === "web" ? 56 : insets.top + 12 }]}>
              <View style={[dashStyles.phaseChip, { borderColor: pc + "60" }]}>
                <Text style={[dashStyles.phaseText, { color: pc }]}>
                  {currentWeek ? `${currentWeek.phase} Phase · Wk ${currentWeek.weekNumber}/${totalWeeks}` : "Training Plan"}
                </Text>
              </View>
              <Text style={dashStyles.summitName}>{summitGoal.mountainName}</Text>
              <View style={dashStyles.progressTrack}>
                <View style={[dashStyles.progressFill, { width: `${progressPct}%` as any }]} />
              </View>
              <Text style={dashStyles.progressLabel}>{weeksCompleted} of {totalWeeks} weeks complete</Text>
            </View>
          </ImageBackground>
        ) : (
          <LinearGradient colors={[pc + "28", "transparent"]} style={dashStyles.heroFallback}>
            <View style={[dashStyles.phaseChip, { borderColor: pc + "60", backgroundColor: "transparent" }]}>
              <Text style={[dashStyles.phaseText, { color: pc }]}>
                {currentWeek ? `${currentWeek.phase} Phase · Wk ${currentWeek.weekNumber}/${totalWeeks}` : "Training Plan"}
              </Text>
            </View>
            <Text style={dashStyles.summitName}>{summitGoal.mountainName}</Text>
            <View style={dashStyles.progressTrack}>
              <View style={[dashStyles.progressFill, { width: `${progressPct}%` as any }]} />
            </View>
            <Text style={dashStyles.progressLabel}>{weeksCompleted} of {totalWeeks} weeks complete</Text>
          </LinearGradient>
        )}

        {/* ── 2-CELL STATS ROW: Readiness + Elevation Bank ─────────── */}
        <View style={dashStyles.statsRow}>
          {/* Left: Readiness */}
          <View style={[dashStyles.statCell, { paddingVertical: 16 }]}>
            <Text style={[dashStyles.statVal, { color: readinessColor, fontSize: 32 }]}>{readinessScore}%</Text>
            <Text style={dashStyles.statLbl}>YOUR PROGRESS</Text>
            <Text style={[dashStyles.statLbl, { color: readinessColor, fontFamily: "Inter_600SemiBold", marginTop: 1 }]}>Ready</Text>
          </View>
          {/* Right: Elevation Bank */}
          <View style={[dashStyles.statCell, { borderLeftWidth: 1, borderColor: T.border, paddingVertical: 16 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Mountain size={16} color={T.orange} />
              <Text style={[dashStyles.statVal, { color: T.white, fontSize: 26 }]}>{elevBankLabel}</Text>
            </View>
            <Text style={dashStyles.statLbl}>ELEVATION BANK</Text>
          </View>
        </View>

        {/* ── WEEK CALENDAR STRIP ──────────────────────────────────────── */}
        <View style={dashStyles.calCard}>
          {/* Calendar header: ← Week N · Phase → [edit] */}
          <View style={dashStyles.calHeader}>
            <TouchableOpacity
              onPress={() => {
                const prev = trainingPlan.find(w => w.weekNumber === viewedWeekNum - 1);
                if (prev) { setViewedWeekNum(viewedWeekNum - 1); setSelectedDow(new Date().getDay()); }
              }}
              style={[dashStyles.calNavBtn, viewedWeekNum <= 1 && { opacity: 0.25 }]}
              disabled={viewedWeekNum <= 1}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft size={16} color={T.white} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={dashStyles.calWeekLabel}>
                Week {viewedWeekNum}
                {viewedWeek?.isCurrentWeek ? " · Current" : ""}
              </Text>
              <Text style={dashStyles.calPhaseLabel}>{viewedWeek?.phase ?? ""} Phase</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (selectedSessionIdx !== undefined && viewedWeek) {
                  openEditSession(viewedWeek.weekNumber, selectedSessionIdx);
                }
              }}
              style={[dashStyles.calNavBtn, selectedSessionIdx === undefined && { opacity: 0.3 }]}
              disabled={selectedSessionIdx === undefined}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Pencil size={13} color={T.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                const next = trainingPlan.find(w => w.weekNumber === viewedWeekNum + 1);
                if (next) { setViewedWeekNum(viewedWeekNum + 1); setSelectedDow(new Date().getDay()); }
              }}
              style={[dashStyles.calNavBtn, viewedWeekNum >= trainingPlan.length && { opacity: 0.25 }]}
              disabled={viewedWeekNum >= trainingPlan.length}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronRight size={16} color={T.white} />
            </TouchableOpacity>
          </View>

          {/* Day columns Mon → Sun */}
          <View style={dashStyles.calDays}>
            {DISPLAY_ORDER.map(dow => {
              const sIdx = viewedDowToSession[dow];
              const session = sIdx !== undefined ? viewedWeek?.sessions[sIdx] : undefined;
              const isDone = sIdx !== undefined && !!completedPlanSessions[`${viewedWeek?.weekNumber}-${sIdx}`];
              const isSelected = dow === selectedDow;
              const isToday = viewedWeek?.isCurrentWeek && dow === new Date().getDay();
              const tc = session?.type === "bigDay" ? T.orange : session?.type === "cardio" ? T.blue : T.green;
              const shortTypeLabel = session
                ? (session.type === "hill" ? "Hill" : session.type === "bigDay" ? "Big Day" : "Cardio")
                : "Rest";
              return (
                <TouchableOpacity
                  key={dow}
                  style={dashStyles.calDayCol}
                  onPress={() => setSelectedDow(dow)}
                  activeOpacity={0.75}
                >
                  <Text style={[dashStyles.calDayLabel, isToday && { color: T.green }]}>
                    {DAY_SHORT[dow]}
                  </Text>
                  <View style={[
                    dashStyles.calDayPill,
                    session && { backgroundColor: tc + "18" },
                    isDone && { backgroundColor: T.greenDim },
                    isSelected && { borderColor: T.green, borderWidth: 2 },
                    isToday && !isSelected && { borderColor: T.green + "60", borderWidth: 1 },
                  ]}>
                    {session ? (
                      isDone
                        ? <Check size={13} color={T.green} strokeWidth={3} />
                        : session.type === "hill"   ? <TrendingUp size={13} color={tc} />
                        : session.type === "bigDay" ? <Flag size={13} color={tc} />
                        : <Activity size={13} color={tc} />
                    ) : (
                      <View style={dashStyles.calRestDot} />
                    )}
                  </View>
                  <Text style={[dashStyles.calDayType, session && { color: tc }, isDone && { color: T.green }]} numberOfLines={1}>
                    {shortTypeLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── TODAY'S MISSION card (swipeable) ──────────────────────────── */}
        <View {...missionPanResponder.panHandlers}>
          {selectedSession ? (
            <View style={[dashStyles.missionCard, selectedIsDone && dashStyles.missionCardDone]}>
              <LinearGradient
                colors={selectedIsDone ? [T.greenDim, "transparent"] : [pc + "0C", "transparent"]}
                style={StyleSheet.absoluteFill}
              />

              {/* Header row */}
              <View style={dashStyles.missionHeaderRow}>
                <Text style={[dashStyles.missionLabel, selectedIsDone && { color: T.green }]}>
                  {selectedIsDone ? "✓ COMPLETED" : "TODAY'S MISSION"}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {viewedWeek?.isCurrentWeek && selectedDow === new Date().getDay() && (
                    <View style={dashStyles.missionSuggestedBadge}>
                      <Zap size={10} color={T.orange} />
                      <Text style={dashStyles.missionSuggestedText}>Suggested</Text>
                    </View>
                  )}
                  {(selectedSession.type === "hill" || selectedSession.type === "bigDay") && viewedWeek && selectedSessionIdx !== undefined && (
                    <TouchableOpacity
                      onPress={() => openHillPicker(viewedWeek.weekNumber, selectedSessionIdx)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={dashStyles.missionSwapBtn}
                    >
                      <Mountain size={14} color={T.textMuted} />
                      <Text style={dashStyles.missionSwapText}>Change hill</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Content row: thumbnail + info */}
              <View style={dashStyles.missionContent}>
                <Image
                  source={{ uri: missionImageUri }}
                  style={dashStyles.missionThumb}
                  resizeMode="cover"
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={dashStyles.missionTitle} numberOfLines={2}>{selectedSession.label}</Text>
                  {selectedHill ? (
                    <Text style={dashStyles.missionSub} numberOfLines={1}>
                      {selectedHill.emoji} {selectedHill.name}
                    </Text>
                  ) : (
                    <Text style={dashStyles.missionSub} numberOfLines={1}>
                      {selectedSession.type === "hill" ? "Hill session" : selectedSession.type === "bigDay" ? "Big day" : "Cardio"}
                    </Text>
                  )}
                  {/* Stats chips */}
                  <View style={dashStyles.missionChips}>
                    {selectedSession.targetElevation > 0 && (
                      <View style={dashStyles.missionChip}>
                        <TrendingUp size={11} color={T.orange} />
                        <Text style={[dashStyles.missionChipVal, { color: T.orange }]}>{selectedSession.targetElevation}m</Text>
                        <Text style={dashStyles.missionChipLbl}>GAIN</Text>
                      </View>
                    )}
                    {(selectedSession.type === "hill" || selectedSession.type === "bigDay") && viewedWeek?.hills[0]?.repeats && (
                      <View style={dashStyles.missionChip}>
                        <RefreshCw size={11} color={T.blue} />
                        <Text style={[dashStyles.missionChipVal, { color: T.blue }]}>{viewedWeek.hills[0].repeats}</Text>
                        <Text style={dashStyles.missionChipLbl}>REPS</Text>
                      </View>
                    )}
                    <View style={dashStyles.missionChip}>
                      <Calendar size={11} color={T.textMuted} />
                      <Text style={[dashStyles.missionChipVal, { color: T.white }]}>{selectedSession.duration}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Description */}
              {selectedSession.description ? (
                <Text style={dashStyles.missionDesc} numberOfLines={3}>{selectedSession.description}</Text>
              ) : null}

              {/* Action buttons */}
              <View style={dashStyles.missionBtns}>
                <TouchableOpacity
                  style={dashStyles.missionStartBtn}
                  activeOpacity={0.85}
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
                >
                  <LinearGradient colors={["#3ECF75", "#2AB860"]} style={dashStyles.missionStartInner}>
                    <Play size={14} color="#fff" fill="#fff" />
                    <Text style={dashStyles.missionStartText}>Start Mission</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={dashStyles.missionViewBtn}
                  activeOpacity={0.8}
                  onPress={() => viewedWeek && router.push({
                    pathname: "/session-detail",
                    params: { weekNum: String(viewedWeek.weekNumber), sessionIdx: String(selectedSessionIdx) },
                  })}
                >
                  <Text style={dashStyles.missionViewText}>View Details</Text>
                  <ChevronRight size={14} color={T.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Swipe hint */}
              <Text style={dashStyles.missionSwipeHint}>← swipe to change day →</Text>
            </View>
          ) : (
            <View style={dashStyles.missionCard}>
              <View style={{ alignItems: "center", paddingVertical: 20, gap: 8 }}>
                <Heart size={28} color={T.textMuted} />
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: T.white }}>Rest Day</Text>
                <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" }}>
                  Recovery is training. Let your body adapt.
                </Text>
              </View>
              <Text style={dashStyles.missionSwipeHint}>← swipe to change day →</Text>
            </View>
          )}
        </View>

        {/* ── UPCOMING THIS WEEK ────────────────────────────────────────── */}
        {upcomingSessions.length > 0 && (
          <View style={dashStyles.upcomingSection}>
            <Text style={dashStyles.upcomingLabel}>UPCOMING THIS WEEK</Text>
            {upcomingSessions.map(({ session, sessionIdx, dow }) => {
              const isDone = !!completedPlanSessions[`${viewedWeek?.weekNumber}-${sessionIdx}`];
              const tc = session.type === "bigDay" ? T.orange : session.type === "cardio" ? T.blue : T.green;
              const hillForSession = viewedWeek ? assignedHills[`${viewedWeek.weekNumber}-${sessionIdx}`] : undefined;
              const subtitle = hillForSession
                ? `${hillForSession.name} · ${session.duration}`
                : session.duration;
              const dayLabel = dow !== null ? DAY_FULL[dow] : "Unscheduled";
              return (
                <TouchableOpacity
                  key={sessionIdx}
                  style={[dashStyles.upcomingRow, isDone && dashStyles.upcomingRowDone]}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (viewedWeek) {
                      setSelectedDow(dow ?? selectedDow);
                      router.push({
                        pathname: "/session-detail",
                        params: { weekNum: String(viewedWeek.weekNumber), sessionIdx: String(sessionIdx) },
                      });
                    }
                  }}
                >
                  <View style={[dashStyles.upcomingIcon, { backgroundColor: tc + "20" }]}>
                    {isDone ? <Check size={14} color={T.green} strokeWidth={3} /> :
                     session.type === "hill"   ? <TrendingUp size={14} color={tc} /> :
                     session.type === "bigDay" ? <Flag size={14} color={tc} /> :
                                                 <Activity size={14} color={tc} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[dashStyles.upcomingName, isDone && { color: T.textMuted, textDecorationLine: "line-through" }]} numberOfLines={1}>
                      {session.label}
                    </Text>
                    <Text style={dashStyles.upcomingSub} numberOfLines={1}>{subtitle}</Text>
                  </View>
                  <Text style={[dashStyles.upcomingDay, isDone && { color: T.green }]}>{dayLabel}</Text>
                  <ChevronRight size={14} color={T.textDim} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── FULL PLAN ────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(0).duration(500)} style={styles.header}>
          <View>
            <Text style={styles.title}>Full Plan</Text>
            <Text style={styles.subtitle}>{totalWeeks} weeks · {weeksLeft} remaining</Text>
          </View>
        </Animated.View>

        {planAdjustNote && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <View style={styles.adjustNoteCard}>
              <LinearGradient colors={[T.blueDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <View style={styles.adjustNoteInner}>
                <View style={styles.adjustNoteIcon}>
                  <Cpu size={14} color={T.blue} />
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
                    <Lock size={22} color={T.green} />
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
                        <Check size={11} color={T.green} />
                        <Text style={planLockStyles.featureText}>{f}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={planLockStyles.btn}>
                    <Zap size={13} color={T.bg} />
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
              submittedPlanSessions={submittedPlanSessions}
              onToggleSession={togglePlanSession}
              onSubmitWeek={handleSubmitWeek}
              onEditSession={openEditSession}
              onSwapExercise={openSwapExercise}
              onChangeHill={openHillPicker}
              onSessionPress={(sessionIdx) => router.push({
                pathname: "/session-detail",
                params: { weekNum: String(week.weekNumber), sessionIdx: String(sessionIdx) },
              })}
            />
          );
        })}
      </ScrollView>


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
  emptyHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center", lineHeight: 18 },
  emptyBtn: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: T.greenDim,
    borderWidth: 1,
    borderColor: T.green + "50",
  },
  emptyBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.green },
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
  directionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: T.blueDim,
    borderWidth: 1,
    borderColor: T.blue + "30",
  },
  directionsBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.blue },
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

const dashStyles = StyleSheet.create({
  hero: {
    height: 340, width: "100%", justifyContent: "flex-end",
    marginBottom: 12,
  },
  heroFallback: {
    borderRadius: 20, padding: 20, paddingBottom: 18,
    justifyContent: "flex-end", marginBottom: 12,
  },
  heroContent: { padding: 16, paddingTop: 16 },
  phaseChip: {
    alignSelf: "flex-start", flexDirection: "row",
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12, borderWidth: 1,
    backgroundColor: "rgba(6,13,27,0.55)",
    marginBottom: 8,
  },
  phaseText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  summitName: {
    fontSize: 26, fontFamily: "Inter_700Bold", color: T.white,
    marginBottom: 12, lineHeight: 30,
  },
  progressTrack: {
    height: 4, backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 2, overflow: "hidden", marginBottom: 5,
  },
  progressFill: { height: "100%", backgroundColor: T.green, borderRadius: 2 },
  progressLabel: {
    fontSize: 11, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
  },

  statsRow: {
    flexDirection: "row",
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.border,
    marginBottom: 12, overflow: "hidden",
  },
  statCell: { flex: 1, paddingVertical: 14, alignItems: "center", gap: 4 },
  statMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: T.border },
  statVal: { fontSize: 20, fontFamily: "Inter_700Bold", color: T.white },
  statLbl: {
    fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted,
    textTransform: "uppercase", letterSpacing: 0.4, textAlign: "center",
  },

  nextCard: {
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.border,
    padding: 16, marginBottom: 12, overflow: "hidden",
  },
  focusTag: {
    alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1, marginBottom: 8,
  },
  focusTagText: {
    fontSize: 10, fontFamily: "Inter_700Bold",
    letterSpacing: 1.2, textTransform: "uppercase",
  },
  nextTitle: {
    fontSize: 17, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 6,
  },
  nextMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  nextDur: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  nextDot: { fontSize: 12, color: T.textDim },
  nextElev: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // ── Week Calendar Strip ───────────────────────────────────────────────────
  calCard: {
    backgroundColor: T.card, borderRadius: 18,
    borderWidth: 1, borderColor: T.border,
    padding: 14, marginBottom: 12,
  },
  calHeader: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14,
  },
  calNavBtn: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    alignItems: "center", justifyContent: "center",
  },
  calWeekLabel: {
    fontSize: 14, fontFamily: "Inter_700Bold", color: T.white,
  },
  calPhaseLabel: {
    fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1,
  },
  calDays: {
    flexDirection: "row", justifyContent: "space-between",
  },
  calDayCol: {
    flex: 1, alignItems: "center", gap: 4,
  },
  calDayLabel: {
    fontSize: 9, fontFamily: "Inter_700Bold",
    color: T.textDim, textTransform: "uppercase", letterSpacing: 0.3,
  },
  calDayPill: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
  },
  calRestDot: {
    width: 5, height: 5, borderRadius: 2.5, backgroundColor: T.border,
  },
  calDayType: {
    fontSize: 8, fontFamily: "Inter_500Medium",
    color: T.textDim, textAlign: "center",
  },

  // ── Mission Card ─────────────────────────────────────────────────────────
  missionCard: {
    backgroundColor: T.card, borderRadius: 18,
    borderWidth: 1, borderColor: T.border,
    padding: 16, marginBottom: 12, overflow: "hidden", gap: 12,
  },
  missionCardDone: { borderColor: T.green + "40" },
  missionHeaderRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  missionLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold",
    color: T.green, letterSpacing: 1.3, textTransform: "uppercase",
  },
  missionSuggestedBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, backgroundColor: T.orangeDim,
    borderWidth: 1, borderColor: T.orange + "40",
  },
  missionSuggestedText: {
    fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.orange,
  },
  missionContent: {
    flexDirection: "row", gap: 12, alignItems: "flex-start",
  },
  missionThumb: {
    width: 96, height: 96, borderRadius: 12,
    backgroundColor: T.surface,
  },
  missionTitle: {
    fontSize: 18, fontFamily: "Inter_700Bold", color: T.white, lineHeight: 22,
  },
  missionSub: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted,
  },
  missionChips: {
    flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 2,
  },
  missionChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: T.surface, borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 4,
    borderWidth: 1, borderColor: T.border,
  },
  missionChipVal: {
    fontSize: 12, fontFamily: "Inter_700Bold", color: T.white,
  },
  missionChipLbl: {
    fontSize: 9, fontFamily: "Inter_400Regular", color: T.textDim,
    textTransform: "uppercase", letterSpacing: 0.4,
  },
  missionDesc: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 19,
  },
  missionBtns: {
    flexDirection: "row", gap: 10,
  },
  missionStartBtn: {
    flex: 1.4, borderRadius: 14, overflow: "hidden",
  },
  missionStartInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, paddingVertical: 13,
  },
  missionStartText: {
    fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff",
  },
  missionViewBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: 13, borderRadius: 14,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
  },
  missionViewText: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.textMuted,
  },
  missionSwipeHint: {
    fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim,
    textAlign: "center", letterSpacing: 0.3,
  },
  missionSwapBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 9, backgroundColor: T.surface,
    borderWidth: 1, borderColor: T.border,
  },
  missionSwapText: {
    fontSize: 11, fontFamily: "Inter_500Medium", color: T.textMuted,
  },

  // ── Upcoming This Week ───────────────────────────────────────────────────
  upcomingSection: {
    marginBottom: 16, gap: 6,
  },
  upcomingLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim,
    letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 4,
  },
  upcomingRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.card, borderRadius: 14,
    borderWidth: 1, borderColor: T.border,
    paddingVertical: 12, paddingHorizontal: 14,
  },
  upcomingRowDone: { backgroundColor: T.greenDim, borderColor: T.green + "25" },
  upcomingIcon: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
  },
  upcomingName: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.white,
  },
  upcomingSub: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1,
  },
  upcomingDay: {
    fontSize: 12, fontFamily: "Inter_500Medium", color: T.textMuted,
  },
});
