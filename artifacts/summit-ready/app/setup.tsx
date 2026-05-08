import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SummitGoal, useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";
import {
  assessTime, TimeAssessment,
  WALK_DIST_OPTIONS, EXERCISE_FREQ_OPTIONS,
  WalkDistValue, FreqValue,
  deriveFitnessLevel, fitnessLevelLabel,
} from "@/utils/timeValidator";

type Difficulty = "Easy" | "Moderate" | "Hard" | "Alpine";
type Fitness = "Beginner" | "Average" | "Strong";
type Equipment = "gym" | "weights" | "bands" | "none";

interface RouteOption {
  name: string;
  distance: number;
  elevationGain: number;
  highestAltitude: number;
  difficulty: Difficulty;
  description: string;
  startingPoint?: string;
}

interface MountainResult {
  mountainName: string;
  country?: string;
  region?: string;
  routes: RouteOption[];
}

const DIFF_ICONS: Record<Difficulty, string> = {
  Easy: "🌿", Moderate: "🏔️", Hard: "⛰️", Alpine: "🗻",
};
const DIFF_COLORS: Record<Difficulty, string> = {
  Easy: T.green, Moderate: T.blue, Hard: T.orange, Alpine: "#FF4444",
};


const EQUIPMENT_OPTIONS: { value: Equipment; icon: keyof typeof Feather.glyphMap; label: string; desc: string }[] = [
  { value: "gym",     icon: "activity",    label: "Gym membership",    desc: "Treadmill, step machine, weights" },
  { value: "weights", icon: "trending-up", label: "Home weights",      desc: "Dumbbells, barbell, or kettlebell" },
  { value: "bands",   icon: "link",        label: "Resistance bands",  desc: "Bands or bodyweight equipment" },
  { value: "none",    icon: "map-pin",     label: "No equipment",      desc: "Walks, runs, stairs only" },
];

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const { setSummitGoal } = useApp();

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const [dist, setDist] = useState("");
  const [elev, setElev] = useState("");
  const [alt, setAlt] = useState("");
  const [diff, setDiff] = useState<Difficulty>("Moderate");
  const [walkDist, setWalkDist] = useState<WalkDistValue>("3to8");
  const [freq, setFreq] = useState<FreqValue>("1to2");
  const [fit, setFit] = useState<Fitness>("Average");
  const [equipment, setEquipment] = useState<Equipment[]>(["none"]);
  const [trainingDays, setTrainingDays] = useState(4);
  const [hillDays, setHillDays] = useState(2);
  const [loc, setLoc] = useState("");
  const [radius, setRadius] = useState("25");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [lookupState, setLookupState] = useState<"idle" | "loading" | "results" | "error">("idle");
  const [mountainResult, setMountainResult] = useState<MountainResult | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [timeAssessment, setTimeAssessment] = useState<TimeAssessment | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ensure hillDays never exceeds trainingDays - 1
  useEffect(() => {
    if (hillDays >= trainingDays) setHillDays(Math.max(1, trainingDays - 1));
  }, [trainingDays]);

  // Derive fitness level from the quiz answers
  useEffect(() => {
    setFit(deriveFitnessLevel(walkDist, freq));
  }, [walkDist, freq]);

  // Recompute time assessment whenever anything that affects it changes
  useEffect(() => {
    setTimeAssessment(date ? assessTime(date, diff, fit, trainingDays) : null);
  }, [date, diff, fit, trainingDays]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (name.trim().length < 3) {
      if (lookupState !== "idle") { setLookupState("idle"); setMountainResult(null); setSelectedRoute(null); }
      return;
    }
    debounceRef.current = setTimeout(() => lookupMountain(name.trim()), 900);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [name]);

  async function lookupMountain(mountainName: string) {
    setLookupState("loading"); setSelectedRoute(null); setMountainResult(null);
    try {
      const res = await fetch(`${API_BASE}/mountain-lookup`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: mountainName }),
      });
      if (!res.ok) throw new Error("Lookup failed");
      const data: MountainResult = await res.json();
      setMountainResult(data); setLookupState("results");
    } catch {
      setLookupError("Could not look up route data. Fill in manually.");
      setLookupState("error");
    }
  }

  function selectRoute(route: RouteOption) {
    setSelectedRoute(route);
    setDist(String(route.distance));
    setElev(String(route.elevationGain));
    setAlt(String(route.highestAltitude));
    setDiff(route.difficulty);
    if (mountainResult?.mountainName) setName(mountainResult.mountainName);
  }

  function toggleEquipment(value: Equipment) {
    if (value === "none") {
      setEquipment(["none"]);
    } else {
      setEquipment(prev => {
        const withoutNone = prev.filter(e => e !== "none");
        if (withoutNone.includes(value)) {
          const removed = withoutNone.filter(e => e !== value);
          return removed.length === 0 ? ["none"] : removed;
        }
        return [...withoutNone, value];
      });
    }
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Required";
    if (!date) e.date = "Pick a date";
    else if (new Date(date) <= new Date()) e.date = "Must be a future date";
    else {
      const ta = assessTime(date, diff, fit, trainingDays);
      if (ta?.status === "impossible") e.date = ta.message;
    }
    if (!dist || isNaN(+dist) || +dist <= 0) e.dist = "Enter km";
    if (!elev || isNaN(+elev) || +elev <= 0) e.elev = "Enter metres";
    if (!alt || isNaN(+alt)) e.alt = "Enter metres";
    if (!loc.trim()) e.loc = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setSaving(true);
    await setSummitGoal({
      mountainName: name.trim(),
      summitDate: date,
      distance: +dist,
      elevationGain: +elev,
      highestAltitude: +alt,
      difficulty: diff,
      fitnessLevel: fit,
      location: loc.trim(),
      maxRadius: +radius || 25,
      equipment,
      trainingDaysPerWeek: trainingDays,
      hillDaysPerWeek: hillDays,
    });
    setSaving(false);
    router.replace("/(tabs)/dashboard");
  }

  const inp = (field: string) => [styles.input, errors[field] ? { borderColor: T.red + "80" } : null];
  const maxHillDays = Math.max(1, trainingDays - 1);

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: Platform.OS === "web" ? 72 : insets.top + 16,
              paddingBottom: Platform.OS === "web" ? 80 : insets.bottom + 40,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="arrow-left" size={20} color={T.white} />
            </TouchableOpacity>
            <View>
              <Text style={styles.title}>Your Summit</Text>
              <Text style={styles.subtitle}>Build a plan tailored to you</Text>
            </View>
          </View>

          {/* Mountain name + auto-lookup */}
          {/* Fitness Assessment — 2-question quiz */}
          <Section label="Your Fitness" icon="zap">
            <Text style={styles.sectionDesc}>
              Two quick questions — be honest, this shapes your entire plan.
            </Text>

            <Text style={styles.fLabel}>How far can you walk comfortably without stopping?</Text>
            <View style={styles.quizRow}>
              {WALK_DIST_OPTIONS.map(opt => (
                <TouchableOpacity key={opt.value} onPress={() => setWalkDist(opt.value)} activeOpacity={0.7}
                  style={[styles.quizChip, walkDist === opt.value && styles.quizChipActive]}
                >
                  {walkDist === opt.value && (
                    <LinearGradient colors={[T.orangeDim, "transparent"]} style={StyleSheet.absoluteFill} />
                  )}
                  <Text style={[styles.quizChipText, walkDist === opt.value && { color: T.orange }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fLabel, { marginTop: 14 }]}>How often do you exercise?</Text>
            <View style={styles.quizRow}>
              {EXERCISE_FREQ_OPTIONS.map(opt => (
                <TouchableOpacity key={opt.value} onPress={() => setFreq(opt.value)} activeOpacity={0.7}
                  style={[styles.quizChip, freq === opt.value && styles.quizChipActive]}
                >
                  {freq === opt.value && (
                    <LinearGradient colors={[T.orangeDim, "transparent"]} style={StyleSheet.absoluteFill} />
                  )}
                  <Text style={[styles.quizChipText, freq === opt.value && { color: T.orange }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Derived result pill */}
            <View style={styles.fitnessResult}>
              <View style={[styles.fitnessResultPill, { backgroundColor: T.orangeDim, borderColor: T.orange + "40" }]}>
                <Feather name="zap" size={13} color={T.orange} />
                <Text style={styles.fitnessResultText}>Assessed as: <Text style={{ color: T.orange, fontFamily: "Inter_700Bold" }}>{fitnessLevelLabel(fit)}</Text></Text>
              </View>
              <Text style={styles.fitnessResultHint}>
                {fit === "Beginner" && "A structured plan will build you up safely."}
                {fit === "Average"  && "You have a solid foundation to build from."}
                {fit === "Strong"   && "You can handle higher intensity sessions right away."}
              </Text>
            </View>
          </Section>

          <Section label="Mountain / Hike" icon="map-pin">
            <View style={styles.fieldWrap}>
              <Text style={styles.fLabel}>Mountain or Hike Name</Text>
              <View style={styles.mountainInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }, errors.name ? { borderColor: T.red + "80" } : null]}
                  value={name} onChangeText={setName}
                  placeholder="e.g. Ben Nevis, Mont Blanc, Snowdon…"
                  placeholderTextColor={T.textDim} autoCorrect={false}
                />
                {lookupState === "loading" && (
                  <View style={styles.lookupSpinner}><ActivityIndicator size="small" color={T.green} /></View>
                )}
                {lookupState !== "loading" && name.trim().length >= 3 && (
                  <TouchableOpacity style={styles.lookupBtn} onPress={() => lookupMountain(name.trim())} activeOpacity={0.8}>
                    <Feather name="search" size={16} color={T.green} />
                  </TouchableOpacity>
                )}
              </View>
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>

            {lookupState === "loading" && (
              <Animated.View entering={FadeInDown.duration(300)} style={styles.lookupCard}>
                <ActivityIndicator size="small" color={T.green} />
                <Text style={styles.lookupLoadingText}>Looking up routes for "{name}"…</Text>
              </Animated.View>
            )}
            {lookupState === "error" && (
              <Animated.View entering={FadeInDown.duration(300)} style={[styles.lookupCard, styles.lookupError]}>
                <Feather name="alert-circle" size={14} color={T.orange} />
                <Text style={styles.lookupErrorText}>{lookupError}</Text>
              </Animated.View>
            )}
            {lookupState === "results" && mountainResult && (
              <Animated.View entering={FadeInDown.duration(400)}>
                <View style={styles.mountainInfo}>
                  <View style={styles.mountainInfoHeader}>
                    <View>
                      <Text style={styles.mountainInfoName}>{mountainResult.mountainName}</Text>
                      {(mountainResult.region || mountainResult.country) && (
                        <Text style={styles.mountainInfoLocation}>
                          {[mountainResult.region, mountainResult.country].filter(Boolean).join(", ")}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.routeCountBadge, { backgroundColor: T.greenDim }]}>
                      <Text style={[styles.routeCountText, { color: T.green }]}>{mountainResult.routes.length} routes</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.routePickerLabel}>Select a route to auto-fill details:</Text>
                {mountainResult.routes.map((route, i) => {
                  const isSelected = selectedRoute?.name === route.name;
                  const dc = DIFF_COLORS[route.difficulty];
                  return (
                    <TouchableOpacity key={i} onPress={() => selectRoute(route)} activeOpacity={0.8}
                      style={[styles.routeCard, isSelected && { borderColor: dc, borderWidth: 1.5 }]}
                    >
                      <LinearGradient colors={isSelected ? [dc + "12", "transparent"] : ["transparent", "transparent"]} style={StyleSheet.absoluteFill} />
                      <View style={styles.routeCardTop}>
                        <Text style={styles.routeEmoji}>{DIFF_ICONS[route.difficulty]}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.routeName}>{route.name}</Text>
                          {route.startingPoint && <Text style={styles.routeStart}>From {route.startingPoint}</Text>}
                        </View>
                        <View style={[styles.diffBadge, { backgroundColor: dc + "20" }]}>
                          <Text style={[styles.diffBadgeText, { color: dc }]}>{route.difficulty}</Text>
                        </View>
                        {isSelected && (
                          <View style={[styles.checkMark, { backgroundColor: dc }]}>
                            <Feather name="check" size={12} color="#fff" />
                          </View>
                        )}
                      </View>
                      <Text style={styles.routeDesc} numberOfLines={2}>{route.description}</Text>
                      <View style={styles.routeStats}>
                        <RouteStatPill icon="map" val={`${route.distance}km`} color={T.blue} />
                        <RouteStatPill icon="trending-up" val={`${route.elevationGain}m`} color={T.orange} />
                        <RouteStatPill icon="navigation" val={`${route.highestAltitude}m asl`} color={T.purple} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </Animated.View>
            )}
          </Section>

          {/* Summit date */}
          <Section label="Summit Date" icon="calendar">
            <View style={styles.fieldWrap}>
              <Text style={styles.fLabel}>Target Date</Text>
              <TouchableOpacity onPress={() => setCalOpen(true)} activeOpacity={0.8}
                style={[styles.datePicker, errors.date ? { borderColor: T.red + "80" } : null]}
              >
                <Feather name="calendar" size={16} color={date ? T.green : T.textDim} />
                <Text style={[styles.datePickerText, !date && { color: T.textDim }]}>
                  {date
                    ? new Date(date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                    : "Pick a date"}
                </Text>
                <Feather name="chevron-down" size={14} color={T.textDim} />
              </TouchableOpacity>
              {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
            </View>

            {/* Time assessment banner — updates live as date/difficulty/fitness change */}
            {timeAssessment && !errors.date && (() => {
              const ta = timeAssessment;
              const cfg = {
                good:        { icon: "check-circle" as const, bg: T.greenDim,   border: T.green + "40",  text: T.green,   title: ta.message },
                tight:       { icon: "clock"        as const, bg: T.orangeDim,  border: T.orange + "40", text: T.orange,  title: ta.message },
                insufficient:{ icon: "alert-triangle" as const, bg: T.redDim ?? "rgba(255,68,68,0.12)", border: T.red + "40", text: T.red, title: ta.message },
                impossible:  { icon: "x-circle"     as const, bg: T.redDim ?? "rgba(255,68,68,0.12)",   border: T.red + "60", text: T.red,   title: ta.message },
              }[ta.status];
              return (
                <Animated.View entering={FadeInDown.duration(350)}>
                  <View style={[styles.timeCard, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                    <View style={styles.timeCardRow}>
                      <Feather name={cfg.icon} size={15} color={cfg.text} />
                      <Text style={[styles.timeCardTitle, { color: cfg.text }]}>{cfg.title}</Text>
                    </View>
                    <Text style={styles.timeCardDetail}>{ta.detail}</Text>
                    {ta.status !== "good" && (
                      <View style={styles.timeCardMeta}>
                        <View style={styles.timeMetaItem}>
                          <Text style={styles.timeMetaVal}>{ta.weeksAvailable}</Text>
                          <Text style={styles.timeMetaLbl}>weeks you have</Text>
                        </View>
                        <View style={styles.timeMetaDivider} />
                        <View style={styles.timeMetaItem}>
                          <Text style={styles.timeMetaVal}>{ta.minWeeks}</Text>
                          <Text style={styles.timeMetaLbl}>minimum needed</Text>
                        </View>
                        <View style={styles.timeMetaDivider} />
                        <View style={styles.timeMetaItem}>
                          <Text style={styles.timeMetaVal}>{ta.recommendedWeeks}</Text>
                          <Text style={styles.timeMetaLbl}>recommended</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </Animated.View>
              );
            })()}
          </Section>

          <CalendarModal
            visible={calOpen} selected={date} calMonth={calMonth} setCalMonth={setCalMonth}
            onSelect={(d) => { setDate(d); setCalOpen(false); if (errors.date) setErrors(prev => ({ ...prev, date: "" })); }}
            onClose={() => setCalOpen(false)}
          />

          {/* Route details */}
          <Section label="Route Details" icon="trending-up">
            {selectedRoute && (
              <Animated.View entering={FadeInDown.duration(300)}>
                <View style={styles.autofillBanner}>
                  <Feather name="zap" size={13} color={T.green} />
                  <Text style={styles.autofillText}>Auto-filled from "{selectedRoute.name}" — edit if needed</Text>
                </View>
              </Animated.View>
            )}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={styles.fieldWrap}>
                <Text style={styles.fLabel}>Distance (km)</Text>
                <TextInput style={[inp("dist"), { minWidth: 0 }]} value={dist} onChangeText={setDist}
                  placeholder="14" placeholderTextColor={T.textDim} keyboardType="decimal-pad" />
                {errors.dist && <Text style={styles.errorText}>{errors.dist}</Text>}
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.fLabel}>Elev. Gain (m)</Text>
                <TextInput style={[inp("elev"), { minWidth: 0 }]} value={elev} onChangeText={setElev}
                  placeholder="1220" placeholderTextColor={T.textDim} keyboardType="number-pad" />
                {errors.elev && <Text style={styles.errorText}>{errors.elev}</Text>}
              </View>
            </View>
            <View style={styles.fieldWrap}>
              <Text style={styles.fLabel}>Highest Altitude (m asl)</Text>
              <TextInput style={inp("alt")} value={alt} onChangeText={setAlt}
                placeholder="3260" placeholderTextColor={T.textDim} keyboardType="number-pad" />
              {errors.alt && <Text style={styles.errorText}>{errors.alt}</Text>}
            </View>
            <Text style={styles.fLabel}>Difficulty</Text>
            <View style={styles.diffRow}>
              {(["Easy", "Moderate", "Hard", "Alpine"] as Difficulty[]).map(d => {
                const dc = DIFF_COLORS[d];
                return (
                  <TouchableOpacity key={d} onPress={() => setDiff(d)} activeOpacity={0.7}
                    style={[styles.diffBtn, diff === d && { borderColor: dc, backgroundColor: dc + "18" }]}
                  >
                    <Text style={styles.diffEmoji}>{DIFF_ICONS[d]}</Text>
                    <Text style={[styles.diffLabel, diff === d && { color: dc }]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          {/* Equipment */}
          <Section label="Available Equipment" icon="tool">
            <Text style={styles.sectionDesc}>
              Select everything you have access to — your plan will be tailored around what's available.
            </Text>
            <View style={styles.equipGrid}>
              {EQUIPMENT_OPTIONS.map(opt => {
                const active = equipment.includes(opt.value);
                const isNoneOpt = opt.value === "none";
                return (
                  <TouchableOpacity key={opt.value} onPress={() => toggleEquipment(opt.value)} activeOpacity={0.7}
                    style={[styles.equipCard, active && (isNoneOpt ? styles.equipCardNone : styles.equipCardActive)]}
                  >
                    {active && <LinearGradient
                      colors={isNoneOpt ? [T.blueDim, "transparent"] : [T.greenDim, "transparent"]}
                      style={StyleSheet.absoluteFill}
                    />}
                    <View style={[styles.equipIcon, { backgroundColor: active ? (isNoneOpt ? T.blue + "20" : T.green + "20") : T.surface }]}>
                      <Feather name={opt.icon} size={18} color={active ? (isNoneOpt ? T.blue : T.green) : T.textMuted} />
                    </View>
                    <Text style={[styles.equipLabel, active && { color: isNoneOpt ? T.blue : T.green }]}>{opt.label}</Text>
                    <Text style={styles.equipDesc}>{opt.desc}</Text>
                    {active && (
                      <View style={[styles.equipCheck, { backgroundColor: isNoneOpt ? T.blue : T.green }]}>
                        <Feather name="check" size={10} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          {/* Training Schedule */}
          <Section label="Training Schedule" icon="calendar">
            <Text style={styles.sectionDesc}>
              How many days per week can you commit to training? We'll build the plan around your availability.
            </Text>

            <Text style={styles.fLabel}>Training days per week</Text>
            <View style={styles.chipRow}>
              {[2, 3, 4, 5, 6].map(n => (
                <TouchableOpacity key={n} onPress={() => setTrainingDays(n)} activeOpacity={0.7}
                  style={[styles.chip, trainingDays === n && styles.chipActive]}
                >
                  <Text style={[styles.chipText, trainingDays === n && styles.chipTextActive]}>{n}</Text>
                  {trainingDays === n && <Text style={styles.chipSub}>days</Text>}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.scheduleInfo}>
              <Feather name="info" size={12} color={T.textMuted} />
              <Text style={styles.scheduleInfoText}>
                {trainingDays} training days/week · {trainingDays - hillDays} non-hill session{trainingDays - hillDays !== 1 ? "s" : ""}
              </Text>
            </View>

            <Text style={[styles.fLabel, { marginTop: 14 }]}>Hill training days per week</Text>
            <Text style={styles.fieldHint}>Hill sessions are the core of summit preparation — the more the better.</Text>
            <View style={styles.chipRow}>
              {Array.from({ length: maxHillDays }, (_, i) => i + 1).map(n => (
                <TouchableOpacity key={n} onPress={() => setHillDays(n)} activeOpacity={0.7}
                  style={[styles.chip, styles.chipGreen, hillDays === n && styles.chipGreenActive]}
                >
                  <Text style={[styles.chipText, hillDays === n && { color: T.green }]}>{n}</Text>
                  {hillDays === n && <Text style={[styles.chipSub, { color: T.green + "99" }]}>hill{n !== 1 ? "s" : ""}</Text>}
                </TouchableOpacity>
              ))}
            </View>

            {/* Summary card */}
            <View style={styles.summaryCard}>
              <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <Text style={styles.summaryTitle}>Your weekly plan will include:</Text>
              <View style={styles.summaryRow}>
                <Feather name="trending-up" size={13} color={T.green} />
                <Text style={styles.summaryText}>{hillDays} hill session{hillDays !== 1 ? "s" : ""} — repeats on local hills</Text>
              </View>
              {trainingDays - hillDays - 1 > 0 && (
                <View style={styles.summaryRow}>
                  <Feather name="heart" size={13} color={T.blue} />
                  <Text style={styles.summaryText}>
                    {trainingDays - hillDays - 1} cardio session{trainingDays - hillDays - 1 !== 1 ? "s" : ""} —{" "}
                    {equipment.includes("gym") ? "treadmill / step machine" : equipment.includes("none") || equipment.length === 0 ? "runs, walks, stairs" : "runs + resistance work"}
                  </Text>
                </View>
              )}
              {trainingDays >= 3 && (
                <View style={styles.summaryRow}>
                  <Feather name="flag" size={13} color={T.orange} />
                  <Text style={styles.summaryText}>1 big day — long hike or extended hill session</Text>
                </View>
              )}
            </View>
          </Section>

          {/* Location */}
          <Section label="Your Location" icon="map">
            <View style={styles.fieldWrap}>
              <Text style={styles.fLabel}>Training location</Text>
              <Text style={styles.fieldHint}>Used to find hills near you for training sessions</Text>
              <TextInput style={inp("loc")} value={loc} onChangeText={setLoc}
                placeholder="e.g. Leeds, UK" placeholderTextColor={T.textDim} />
              {errors.loc && <Text style={styles.errorText}>{errors.loc}</Text>}
            </View>
            <View style={styles.fieldWrap}>
              <Text style={styles.fLabel}>Max search radius (km)</Text>
              <TextInput style={inp("radius")} value={radius} onChangeText={setRadius}
                placeholder="25" placeholderTextColor={T.textDim} keyboardType="number-pad" />
            </View>
          </Section>

          <TouchableOpacity onPress={submit} disabled={saving}
            style={[styles.submitBtn, { opacity: saving ? 0.7 : 1 }]} activeOpacity={0.85}
          >
            <LinearGradient colors={["#3ECF75", "#2AB860"]} style={styles.submitGrad}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Feather name="check-circle" size={20} color="#fff" />}
              <Text style={styles.submitText}>
                {saving ? "Generating plan…" : "Generate my training plan"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function CalendarModal({ visible, selected, calMonth, setCalMonth, onSelect, onClose }: {
  visible: boolean; selected: string; calMonth: Date;
  setCalMonth: (d: Date) => void; onSelect: (iso: string) => void; onClose: () => void;
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  function changeMonth(delta: number) { setCalMonth(new Date(year, month + delta, 1)); }
  function isoFor(day: number) { return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={calStyles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={calStyles.sheet}>
          <View style={calStyles.header}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={calStyles.navBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="chevron-left" size={20} color={T.white} />
            </TouchableOpacity>
            <Text style={calStyles.monthLabel}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={() => changeMonth(1)} style={calStyles.navBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="chevron-right" size={20} color={T.white} />
            </TouchableOpacity>
          </View>
          <View style={calStyles.weekRow}>
            {WEEKDAYS.map(d => <Text key={d} style={calStyles.weekDay}>{d}</Text>)}
          </View>
          <View style={calStyles.grid}>
            {cells.map((day, idx) => {
              if (!day) return <View key={idx} style={calStyles.dayCell} />;
              const iso = isoFor(day);
              const cellDate = new Date(iso + "T12:00:00");
              const isPast = cellDate <= today;
              const isSelected = iso === selected;
              const isToday = cellDate.toDateString() === today.toDateString();
              return (
                <TouchableOpacity key={idx}
                  style={[calStyles.dayCell, isSelected && calStyles.dayCellSelected, isToday && !isSelected && calStyles.dayCellToday]}
                  onPress={() => !isPast && onSelect(iso)} activeOpacity={isPast ? 1 : 0.7} disabled={isPast}
                >
                  <Text style={[calStyles.dayText, isPast && calStyles.dayTextPast, isSelected && calStyles.dayTextSelected, isToday && !isSelected && calStyles.dayTextToday]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity onPress={onClose} style={calStyles.cancelBtn}>
            <Text style={calStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function RouteStatPill({ icon, val, color }: { icon: keyof typeof Feather.glyphMap; val: string; color: string }) {
  return (
    <View style={[statStyles.pill, { backgroundColor: color + "15" }]}>
      <Feather name={icon} size={11} color={color} />
      <Text style={[statStyles.text, { color }]}>{val}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  text: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});

function Section({ label, icon, children }: { label: string; icon: keyof typeof Feather.glyphMap; children: React.ReactNode }) {
  return (
    <View style={secStyles.wrap}>
      <View style={secStyles.head}>
        <View style={secStyles.iconBox}>
          <Feather name={icon} size={15} color={T.green} />
        </View>
        <Text style={secStyles.label}>{label}</Text>
      </View>
      <View style={secStyles.body}>{children}</View>
    </View>
  );
}

const secStyles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  iconBox: { width: 30, height: 30, borderRadius: 9, backgroundColor: T.greenDim, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.white },
  body: { backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.cardBorder, padding: 16, gap: 12 },
});

const calStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", alignItems: "center" },
  sheet: { backgroundColor: T.card, borderRadius: 22, borderWidth: 1, borderColor: T.cardBorder, padding: 20, width: 320 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  navBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  monthLabel: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.white },
  weekRow: { flexDirection: "row", marginBottom: 8 },
  weekDay: { flex: 1, textAlign: "center", fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%` as any, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  dayCellSelected: { backgroundColor: T.green },
  dayCellToday: { borderWidth: 1, borderColor: T.green + "60" },
  dayText: { fontSize: 13, fontFamily: "Inter_500Medium", color: T.white },
  dayTextPast: { color: T.textDim },
  dayTextSelected: { color: "#fff", fontFamily: "Inter_700Bold" },
  dayTextToday: { color: T.green },
  cancelBtn: { marginTop: 16, alignItems: "center", paddingVertical: 10 },
  cancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.textMuted },
});

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18, gap: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", color: T.white },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  sectionDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 19, marginTop: -4, marginBottom: 4 },
  fieldWrap: { gap: 6 },
  fLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  fieldHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: -2 },
  input: {
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: T.white,
  },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.red, marginTop: 2 },

  mountainInputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  lookupSpinner: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  lookupBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: T.greenDim, borderWidth: 1, borderColor: T.green + "30", alignItems: "center", justifyContent: "center" },
  lookupCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border, padding: 12, marginTop: 4 },
  lookupLoadingText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, flex: 1 },
  lookupError: { borderColor: T.orange + "40" },
  lookupErrorText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.orange, flex: 1 },
  mountainInfo: { backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 14, marginBottom: 10 },
  mountainInfoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  mountainInfoName: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.white },
  mountainInfoLocation: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },
  routeCountBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  routeCountText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  routePickerLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  routeCard: { backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 14, marginBottom: 8, overflow: "hidden", gap: 8 },
  routeCardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeEmoji: { fontSize: 20 },
  routeName: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white },
  routeStart: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  diffBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  checkMark: { width: 22, height: 22, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  routeDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18 },
  routeStats: { flexDirection: "row", gap: 6, flexWrap: "wrap" },

  datePicker: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  datePickerText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: T.white },

  timeCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  timeCardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeCardTitle: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  timeCardDetail: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 17 },
  timeCardMeta: { flexDirection: "row", alignItems: "center", paddingTop: 6, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)", marginTop: 2 },
  timeMetaItem: { flex: 1, alignItems: "center", gap: 2 },
  timeMetaVal: { fontSize: 18, fontFamily: "Inter_700Bold", color: T.white },
  timeMetaLbl: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center" },
  timeMetaDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.08)" },

  autofillBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: T.greenDim, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: T.green + "30" },
  autofillText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: T.green },

  diffRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  diffBtn: { flex: 1, minWidth: 70, borderRadius: 12, borderWidth: 1, borderColor: T.border, backgroundColor: T.surface, alignItems: "center", paddingVertical: 10, gap: 4 },
  diffEmoji: { fontSize: 18 },
  diffLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted },

  quizRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quizChip: {
    flex: 1, minWidth: 70, borderRadius: 12, borderWidth: 1, borderColor: T.border,
    backgroundColor: T.surface, alignItems: "center", justifyContent: "center",
    paddingVertical: 11, paddingHorizontal: 8, overflow: "hidden",
  },
  quizChipActive: { borderColor: T.orange + "60" },
  quizChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.text, textAlign: "center" },
  fitnessResult: { gap: 6, marginTop: 4 },
  fitnessResultPill: {
    flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start",
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
  },
  fitnessResultText: { fontSize: 13, fontFamily: "Inter_500Medium", color: T.text },
  fitnessResultHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, paddingLeft: 4 },

  equipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  equipCard: {
    width: "48%" as any, backgroundColor: T.surface, borderRadius: 14, borderWidth: 1,
    borderColor: T.border, padding: 14, gap: 6, overflow: "hidden",
  },
  equipCardActive: { borderColor: T.green + "60" },
  equipCardNone: { borderColor: T.blue + "60" },
  equipIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  equipLabel: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.white },
  equipDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 15 },
  equipCheck: { position: "absolute" as any, top: 10, right: 10, width: 18, height: 18, borderRadius: 6, alignItems: "center", justifyContent: "center" },

  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
    borderColor: T.border, backgroundColor: T.surface, alignItems: "center",
  },
  chipActive: { borderColor: T.blue + "60", backgroundColor: T.blueDim },
  chipGreen: {},
  chipGreenActive: { borderColor: T.green + "60", backgroundColor: T.greenDim },
  chipText: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.text },
  chipTextActive: { color: T.blue },
  chipSub: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.blue + "99", marginTop: 1 },

  scheduleInfo: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  scheduleInfoText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },

  summaryCard: {
    backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.green + "25",
    padding: 14, gap: 8, overflow: "hidden", marginTop: 4,
  },
  summaryTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  summaryRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  summaryText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: T.text, lineHeight: 18 },

  submitBtn: { borderRadius: 16, overflow: "hidden", marginTop: 8 },
  submitGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
  submitText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
});
