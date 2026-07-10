import type { LucideIcon } from "lucide-react-native";
import { ArrowLeft, Zap, Search, AlertCircle, Check, Calendar, ChevronDown, CheckCircle, Clock, AlertTriangle, XCircle, SlidersHorizontal, Info, TrendingUp, Heart, Flag, ChevronLeft, ChevronRight, Activity, Link, MapPin, Wrench, Map, Navigation, Repeat } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
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
import Slider from "@react-native-community/slider";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SummitGoal, NearbyHill, useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";
import { logMountainSelected, useScreenView } from "@/lib/analytics";
import {
  assessTime, TimeAssessment,
  deriveFitnessFromSliders,
  walkDistLabel, freqLabel,
  fitnessLevelLabel,
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
const DIFF_DESC: Record<Difficulty, string> = {
  Easy: "Gentle paths, low altitude",
  Moderate: "Moorland & fell walking",
  Hard: "Long days, rough terrain",
  Alpine: "Glaciers & technical skills",
};


const EQUIPMENT_OPTIONS: { value: Equipment; icon: LucideIcon; label: string; desc: string }[] = [
  { value: "gym",     icon: Activity,   label: "Gym membership",    desc: "Treadmill, step machine, weights" },
  { value: "weights", icon: TrendingUp, label: "Home weights",      desc: "Dumbbells, barbell, or kettlebell" },
  { value: "bands",   icon: Link,       label: "Resistance bands",  desc: "Bands or bodyweight equipment" },
  { value: "none",    icon: MapPin,     label: "No equipment",      desc: "Walks, runs, stairs only" },
];

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const LOCATIONS = [
  "London", "Manchester", "Birmingham", "Bristol", "Liverpool", "Leeds", "Sheffield",
  "Newcastle upon Tyne", "Nottingham", "Leicester", "Coventry", "Bradford", "Plymouth",
  "Derby", "Wolverhampton", "Southampton", "Portsmouth", "Oxford", "Cambridge",
  "Brighton", "Reading", "Norwich", "Milton Keynes", "Exeter", "Gloucester",
  "Cheltenham", "Worcester", "Stoke-on-Trent", "Swindon", "Northampton", "Ipswich",
  "York", "Hull", "Middlesbrough", "Sunderland", "Blackpool", "Preston", "Blackburn",
  "Bolton", "Wigan", "Stockport", "Salford", "Huddersfield", "Halifax", "Wakefield",
  "Rotherham", "Barnsley", "Doncaster",
  "Keswick", "Ambleside", "Windermere", "Bowness-on-Windermere", "Kendal",
  "Penrith", "Carlisle", "Coniston", "Grasmere", "Kirkby Stephen",
  "Skipton", "Harrogate", "Ilkley", "Settle", "Hawes", "Richmond", "Ripon",
  "Buxton", "Bakewell", "Castleton", "Matlock",
  "Hexham", "Alnwick", "Berwick-upon-Tweed",
  "Edinburgh", "Glasgow", "Aberdeen", "Dundee", "Perth", "Stirling", "Inverness",
  "Fort William", "Aviemore", "Pitlochry", "Callander", "Aberfoyle", "Glencoe",
  "Tyndrum", "Dunkeld", "Balloch", "Crieff",
  "Cardiff", "Swansea", "Newport", "Wrexham", "Bangor", "Caernarfon",
  "Betws-y-Coed", "Llanberis", "Brecon", "Abergavenny", "Hay-on-Wye",
  "Machynlleth", "Dolgellau", "Barmouth",
  "Belfast", "Derry", "Dublin", "Cork", "Galway", "Limerick", "Killarney",
  "Tralee", "Kilkenny", "Waterford",
  "Chamonix, France", "Zermatt, Switzerland", "Grindelwald, Switzerland",
  "Interlaken, Switzerland", "Innsbruck, Austria", "Salzburg, Austria",
  "Courmayeur, Italy", "Aosta, Italy", "Kathmandu, Nepal",
  "Cusco, Peru", "Cape Town, South Africa", "Nairobi, Kenya",
];

export default function SetupScreen() {
  useScreenView("setup");
  const insets = useSafeAreaInsets();
  const { setSummitGoal, changeSummit, summitGoal } = useApp();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isChangeMode = mode === "change";

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
  const [readiness, setReadiness] = useState(50);
  const [walkSlider, setWalkSlider] = useState(50);
  const [freqSlider, setFreqSlider] = useState(50);
  const [fit, setFit] = useState<Fitness>("Average");
  const [equipment, setEquipment] = useState<Equipment[]>(["none"]);
  const [trainingDays, setTrainingDays] = useState(4);
  const [hillDays, setHillDays] = useState(2);
  const [loc, setLoc] = useState("");
  const [showLocSuggestions, setShowLocSuggestions] = useState(false);
  const [radius, setRadius] = useState("25");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [lookupState, setLookupState] = useState<"idle" | "loading" | "results" | "error">("idle");
  const [mountainResult, setMountainResult] = useState<MountainResult | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [timeAssessment, setTimeAssessment] = useState<TimeAssessment | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipLookupRef = useRef(false);

  const [hillSearchState, setHillSearchState] = useState<"idle" | "loading" | "results" | "error">("idle");
  const [setupHills, setSetupHills] = useState<NearbyHill[]>([]);
  const [preferredHills, setPreferredHills] = useState<NearbyHill[]>([]);

  // Experience baseline questions (0 = not answered, 1-N = option index)
  const [expElevation, setExpElevation] = useState(0);
  const [expRunning, setExpRunning]     = useState(0);
  const [expUphill, setExpUphill]       = useState(0);

  // Specific hill search
  const [specificSearch, setSpecificSearch] = useState("");
  const [specificSearching, setSpecificSearching] = useState(false);
  const [specificSearchErr, setSpecificSearchErr] = useState<string | null>(null);

  // Questionnaire pre-fill baseline (overrides chip-derived value if set)
  const [prefillBaseline, setPrefillBaseline] = useState<number | null>(null);
  const [planStartMode, setPlanStartMode] = useState<"optimal" | "full">("optimal");

  // Ensure hillDays never exceeds trainingDays - 1
  useEffect(() => {
    if (hillDays >= trainingDays) setHillDays(Math.max(1, trainingDays - 1));
  }, [trainingDays]);

  // Read questionnaire answers and pre-fill fields
  useEffect(() => {
    AsyncStorage.getItem("summitready_questionnaire_data").then(raw => {
      if (!raw) return;
      try {
        const data = JSON.parse(raw) as {
          mountainName?: string;
          fitnessBaseline?: number;
          fitnessLevel?: "Beginner" | "Average" | "Strong";
          trainingDays?: number;
          hillDays?: number;
          equipment?: Equipment[];
          location?: string;
          rawFitnessLevel?: number;
          rawExerciseFreq?: number;
          rawElevation?: number;
          rawRunning?: number;
          rawUphillFreq?: number;
        };
        if (data.mountainName) {
          skipLookupRef.current = true;
          setName(data.mountainName);
          // Auto-trigger route search so the user doesn't have to press Search manually
          lookupMountain(data.mountainName);
        }
        if (data.trainingDays) setTrainingDays(data.trainingDays);
        if (data.hillDays) setHillDays(data.hillDays);
        if (data.equipment?.length) setEquipment(data.equipment);
        if (data.location) setLoc(data.location);
        if (typeof data.fitnessBaseline === "number") setPrefillBaseline(data.fitnessBaseline);

        // Map raw questionnaire answers to fitness sliders so the
        // slider-derivation effect produces the correct fitness level.
        if (typeof data.rawFitnessLevel === "number") {
          const readinessMap: Record<number, number> = { 1: 12, 2: 38, 3: 65, 4: 88 };
          const mapped = readinessMap[data.rawFitnessLevel];
          if (mapped !== undefined) setReadiness(mapped);
        }
        if (typeof data.rawExerciseFreq === "number") {
          const freqMap: Record<number, number> = { 1: 10, 2: 30, 3: 62, 4: 85 };
          const mapped = freqMap[data.rawExerciseFreq];
          if (mapped !== undefined) setFreqSlider(mapped);
        }

        // Pre-fill experience chips — questionnaire indices map 1-to-1
        if (typeof data.rawElevation === "number" && data.rawElevation > 0)
          setExpElevation(data.rawElevation);
        if (typeof data.rawRunning === "number" && data.rawRunning > 0)
          setExpRunning(data.rawRunning);
        // Questionnaire uphillFreq has 4 options; setup chips have 3 (rarely / monthly / weekly+)
        if (typeof data.rawUphillFreq === "number" && data.rawUphillFreq > 0)
          setExpUphill(Math.min(data.rawUphillFreq, 3));
      } catch {}
    });
  }, []);

  // When arriving in change-summit mode, pre-populate every field from the current goal
  useEffect(() => {
    if (!isChangeMode || !summitGoal) return;
    skipLookupRef.current = true;
    setName(summitGoal.mountainName);
    setDate(summitGoal.summitDate);
    setDist(String(summitGoal.distance));
    setElev(String(summitGoal.elevationGain));
    setAlt(String(summitGoal.highestAltitude));
    setDiff(summitGoal.difficulty);
    setFit(summitGoal.fitnessLevel);
    setEquipment(summitGoal.equipment);
    setTrainingDays(summitGoal.trainingDaysPerWeek);
    setHillDays(summitGoal.hillDaysPerWeek);
    setLoc(summitGoal.location);
    setRadius(String(summitGoal.maxRadius));
    if (summitGoal.preferredHills?.length) setPreferredHills(summitGoal.preferredHills);
    if (summitGoal.planStartMode) setPlanStartMode(summitGoal.planStartMode);
    if (typeof summitGoal.fitnessBaseline === "number") setPrefillBaseline(summitGoal.fitnessBaseline);
  // Only run once on mount when isChangeMode is true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChangeMode]);

  // Derive fitness level from the three sliders
  useEffect(() => {
    setFit(deriveFitnessFromSliders(readiness, walkSlider, freqSlider));
  }, [readiness, walkSlider, freqSlider]);

  // Recompute time assessment whenever anything that affects it changes
  useEffect(() => {
    setTimeAssessment(date ? assessTime(date, diff, fit, trainingDays) : null);
  }, [date, diff, fit, trainingDays]);

  useEffect(() => {
    if (skipLookupRef.current) {
      skipLookupRef.current = false;
      return;
    }
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
    if (mountainResult?.mountainName) {
      skipLookupRef.current = true;
      setName(mountainResult.mountainName);
    }
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

  async function searchSpecificHill() {
    const query = specificSearch.trim();
    if (query.length < 2) return;
    setSpecificSearching(true);
    setSpecificSearchErr(null);
    try {
      const res = await fetch(`${API_BASE}/hills-unified`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hillName: query, location: loc.trim() }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json() as { hill: NearbyHill };
      const hill = data.hill;
      // Add to setupHills if not already present
      setSetupHills(prev => {
        const exists = prev.some(h => h.name.toLowerCase() === hill.name.toLowerCase());
        return exists ? prev : [hill, ...prev];
      });
      // Auto-select it
      setPreferredHills(prev => {
        const exists = prev.some(h => h.name.toLowerCase() === hill.name.toLowerCase());
        return exists ? prev : [...prev, hill];
      });
      // Move to results state so the list appears
      setHillSearchState("results");
      setSpecificSearch("");
    } catch {
      setSpecificSearchErr("Couldn't find that hill — try a different name.");
    } finally {
      setSpecificSearching(false);
    }
  }

  async function fetchSetupHills() {
    const location = loc.trim();
    if (location.length < 2) return;
    setHillSearchState("loading");
    try {
      const res = await fetch(`${API_BASE}/hills-unified`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, radius: +radius || 25 }),
      });
      if (!res.ok) throw new Error("Hills lookup failed");
      const data: { hills: NearbyHill[] } = await res.json();
      setSetupHills(data.hills);
      setHillSearchState("results");
    } catch {
      setHillSearchState("error");
    }
  }

  // Scoring: index 0 = unanswered, then option 1-N maps to pts
  // Elevation: Under200=0, 200-500=15, 500-1000=32, 1000+=45 → max 45
  // Running:   No=0, WithEffort=7, Easily=14                 → max 14
  // Uphill:    Rarely=0, Monthly=3, Weekly+=6                → max 6  (total max 65)
  const EXP_ELEV_PTS   = [0, 0, 15, 32, 45];
  const EXP_RUN_PTS    = [0, 0, 7, 14];
  const EXP_UPHILL_PTS = [0, 0, 3, 6];
  // Questionnaire baseline takes priority over the in-setup chips when available
  const chipBaseline =
    (EXP_ELEV_PTS[expElevation] ?? 0) +
    (EXP_RUN_PTS[expRunning]    ?? 0) +
    (EXP_UPHILL_PTS[expUphill]  ?? 0);
  const fitnessBaseline = prefillBaseline !== null ? prefillBaseline : chipBaseline;

  async function submit() {
    if (!validate()) return;
    setSaving(true);
    const newGoal: SummitGoal = {
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
      preferredHills: preferredHills.length > 0 ? preferredHills : undefined,
      fitnessBaseline,
      planStartMode,
    };
    if (isChangeMode) {
      await changeSummit(newGoal);
    } else {
      await setSummitGoal(newGoal);
    }
    void logMountainSelected({ mountain_name: newGoal.mountainName, difficulty: newGoal.difficulty });
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
              <ArrowLeft size={20} color={T.white} />
            </TouchableOpacity>
            <View>
              <Text style={styles.title}>{isChangeMode ? "Change Summit" : "Your Summit"}</Text>
              <Text style={styles.subtitle}>{isChangeMode ? "Your training sessions are kept" : "Build a plan tailored to you"}</Text>
            </View>
          </View>

          {/* Change-mode notice */}
          {isChangeMode && (
            <View style={styles.changeBanner}>
              <CheckCircle size={14} color={T.green} />
              <Text style={styles.changeBannerText}>
                Your logged training sessions will carry over to the new summit. Only the training plan is regenerated.
              </Text>
            </View>
          )}

          {/* Fitness Assessment — slider quiz */}
          {!isChangeMode && <Section label="Your Fitness" icon={Zap}>
            <Text style={styles.sectionDesc}>
              Slide each to where you honestly sit — this shapes your entire plan.
            </Text>

            <FitnessSlider
              label="How ready do you feel?"
              displayValue={`${readiness}%`}
              subLabel={
                readiness < 20 ? "Just getting started" :
                readiness < 40 ? "Some base fitness" :
                readiness < 60 ? "Moderately active" :
                readiness < 80 ? "Fairly fit" : "Peak condition"
              }
              value={readiness}
              onValueChange={setReadiness}
              color={readiness < 34 ? T.red : readiness < 67 ? T.orange : T.green}
            />

            <FitnessSlider
              label="Comfortable walking distance"
              displayValue={walkDistLabel(walkSlider)}
              subLabel="without stopping"
              value={walkSlider}
              onValueChange={setWalkSlider}
              color={T.blue}
            />

            <FitnessSlider
              label="How often do you exercise?"
              displayValue={freqLabel(freqSlider)}
              subLabel="per week on average"
              value={freqSlider}
              onValueChange={setFreqSlider}
              color={T.purple}
            />

            {/* Derived result pill */}
            <View style={styles.fitnessResult}>
              <View style={[styles.fitnessResultPill, {
                backgroundColor:
                  fit === "Strong" ? T.greenDim : fit === "Average" ? T.orangeDim : T.blueDim,
                borderColor:
                  fit === "Strong" ? T.green + "40" : fit === "Average" ? T.orange + "40" : T.blue + "40",
              }]}>
                <Zap size={13} color={fit === "Strong" ? T.green : fit === "Average" ? T.orange : T.blue} />
                <Text style={styles.fitnessResultText}>
                  Assessed as:{" "}
                  <Text style={{
                    fontFamily: "Inter_700Bold",
                    color: fit === "Strong" ? T.green : fit === "Average" ? T.orange : T.blue,
                  }}>
                    {fitnessLevelLabel(fit)}
                  </Text>
                </Text>
              </View>
              <Text style={styles.fitnessResultHint}>
                {fit === "Beginner" && "A structured plan will build you up safely."}
                {fit === "Average"  && "You have a solid foundation to build from."}
                {fit === "Strong"   && "You can handle higher intensity sessions right away."}
              </Text>
            </View>

            {/* Experience baseline questions */}
            <View style={styles.expDivider} />
            <Text style={styles.expHeading}>Your recent experience</Text>
            <Text style={styles.expSub}>Helps us set the right starting point for your readiness score.</Text>

            <Text style={styles.expQ}>Biggest single-day elevation gain in the last 3 months?</Text>
            <View style={styles.expRow}>
              {["Under 200m", "200–500m", "500–1000m", "1000m+"].map((label, i) => {
                const idx = i + 1;
                const active = expElevation === idx;
                return (
                  <TouchableOpacity
                    key={label}
                    style={[styles.expChip, active && { backgroundColor: T.greenDim, borderColor: T.green + "60" }]}
                    onPress={() => setExpElevation(active ? 0 : idx)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.expChipText, active && { color: T.green }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.expQ}>Can you run 5km without stopping?</Text>
            <View style={styles.expRow}>
              {["No", "Yes, with effort", "Yes, easily"].map((label, i) => {
                const idx = i + 1;
                const active = expRunning === idx;
                return (
                  <TouchableOpacity
                    key={label}
                    style={[styles.expChip, active && { backgroundColor: T.blueDim, borderColor: T.blue + "60" }]}
                    onPress={() => setExpRunning(active ? 0 : idx)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.expChipText, active && { color: T.blue }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.expQ}>How often do you train with significant uphill?</Text>
            <View style={styles.expRow}>
              {["Rarely", "Monthly", "Weekly+"].map((label, i) => {
                const idx = i + 1;
                const active = expUphill === idx;
                return (
                  <TouchableOpacity
                    key={label}
                    style={[styles.expChip, active && { backgroundColor: T.purpleDim, borderColor: T.purple + "60" }]}
                    onPress={() => setExpUphill(active ? 0 : idx)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.expChipText, active && { color: T.purple }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>}

          <Section label="Choose your route" icon={MapPin}>
            <View style={styles.fieldWrap}>
              <Text style={styles.fLabel}>Mountain or hike name</Text>
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
                    <Search size={16} color={T.green} />
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
                <AlertCircle size={14} color={T.orange} />
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
                            <Check size={12} color="#fff" />
                          </View>
                        )}
                      </View>
                      <Text style={styles.routeDesc} numberOfLines={2}>{route.description}</Text>
                      <View style={styles.routeStats}>
                        <RouteStatPill icon={Map} val={`${route.distance}km`} color={T.blue} />
                        <RouteStatPill icon={TrendingUp} val={`${route.elevationGain}m`} color={T.orange} />
                        <RouteStatPill icon={Navigation} val={`${route.highestAltitude}m asl`} color={T.purple} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </Animated.View>
            )}
          </Section>

          {/* Summit date */}
          <Section label="Summit Date" icon={Calendar}>
            <View style={styles.fieldWrap}>
              <Text style={styles.fLabel}>Target Date</Text>
              <TouchableOpacity onPress={() => setCalOpen(true)} activeOpacity={0.8}
                style={[styles.datePicker, errors.date ? { borderColor: T.red + "80" } : null]}
              >
                <Calendar size={16} color={date ? T.green : T.textDim} />
                <Text style={[styles.datePickerText, !date && { color: T.textDim }]}>
                  {date
                    ? new Date(date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                    : "Pick a date"}
                </Text>
                <ChevronDown size={14} color={T.textDim} />
              </TouchableOpacity>
              {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
            </View>

            {/* Time assessment banner — updates live as date/difficulty/fitness change */}
            {timeAssessment && !errors.date && (() => {
              const ta = timeAssessment;
              const cfg = {
                good:        { icon: CheckCircle,   bg: T.greenDim,   border: T.green + "40",  text: T.green,   title: ta.message },
                tight:       { icon: Clock,         bg: T.orangeDim,  border: T.orange + "40", text: T.orange,  title: ta.message },
                insufficient:{ icon: AlertTriangle, bg: T.redDim ?? "rgba(255,68,68,0.12)", border: T.red + "40", text: T.red, title: ta.message },
                impossible:  { icon: XCircle,       bg: T.redDim ?? "rgba(255,68,68,0.12)",   border: T.red + "60", text: T.red,   title: ta.message },
              }[ta.status];
              const CfgIcon = cfg.icon;
              return (
                <Animated.View entering={FadeInDown.duration(350)}>
                  <View style={[styles.timeCard, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                    <View style={styles.timeCardRow}>
                      <CfgIcon size={15} color={cfg.text} />
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

            {/* Plan duration choice — shown when user has significantly more time than needed */}
            {timeAssessment && !errors.date && timeAssessment.status === "good" && timeAssessment.weeksAvailable > timeAssessment.recommendedWeeks + 2 && (() => {
              const ta = timeAssessment;
              const summitMs = new Date(date + "T12:00:00").getTime();
              const optimalStartMs = summitMs - ta.recommendedWeeks * 7 * 24 * 60 * 60 * 1000;
              const todayMs = Date.now();
              const planStartMs = optimalStartMs > todayMs ? optimalStartMs : todayMs;
              const planStartStr = new Date(planStartMs).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
              return (
                <Animated.View entering={FadeInDown.duration(400)}>
                  <View style={styles.planDurCard}>
                    <View style={styles.planDurHeader}>
                      <SlidersHorizontal size={14} color={T.blue} />
                      <Text style={styles.planDurTitle}>When should your plan start?</Text>
                    </View>
                    <Text style={styles.planDurSub}>
                      You need {ta.recommendedWeeks} weeks to prepare — you have {ta.weeksAvailable}. Start focused or begin building now.
                    </Text>
                    <View style={styles.planDurRow}>
                      <TouchableOpacity
                        style={[styles.planDurOpt, planStartMode === "optimal" && styles.planDurOptActive]}
                        onPress={() => setPlanStartMode("optimal")}
                        activeOpacity={0.8}
                      >
                        {planStartMode === "optimal" && (
                          <View style={styles.planDurCheck}><Check size={10} color="#fff" /></View>
                        )}
                        <Text style={[styles.planDurOptIcon]}>🎯</Text>
                        <Text style={[styles.planDurOptLabel, planStartMode === "optimal" && { color: T.green }]}>Focused plan</Text>
                        <Text style={[styles.planDurOptWeeks, planStartMode === "optimal" && { color: T.green }]}>{ta.recommendedWeeks} weeks</Text>
                        <Text style={styles.planDurOptDate}>Starts {planStartStr}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.planDurOpt, planStartMode === "full" && styles.planDurOptActive]}
                        onPress={() => setPlanStartMode("full")}
                        activeOpacity={0.8}
                      >
                        {planStartMode === "full" && (
                          <View style={styles.planDurCheck}><Check size={10} color="#fff" /></View>
                        )}
                        <Text style={styles.planDurOptIcon}>📅</Text>
                        <Text style={[styles.planDurOptLabel, planStartMode === "full" && { color: T.green }]}>Full duration</Text>
                        <Text style={[styles.planDurOptWeeks, planStartMode === "full" && { color: T.green }]}>{ta.weeksAvailable} weeks</Text>
                        <Text style={styles.planDurOptDate}>Starts today</Text>
                      </TouchableOpacity>
                    </View>
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
          <Section label="Route Details" icon={TrendingUp}>
            {selectedRoute && (
              <Animated.View entering={FadeInDown.duration(300)}>
                <View style={styles.autofillBanner}>
                  <Zap size={13} color={T.green} />
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
                    <Text style={styles.diffDesc}>{DIFF_DESC[d]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          {/* Equipment */}
          <Section label="Available Equipment" icon={Wrench}>
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
                      {(() => { const EqIcon = opt.icon; return <EqIcon size={18} color={active ? (isNoneOpt ? T.blue : T.green) : T.textMuted} />; })()}
                    </View>
                    <Text style={[styles.equipLabel, active && { color: isNoneOpt ? T.blue : T.green }]}>{opt.label}</Text>
                    <Text style={styles.equipDesc}>{opt.desc}</Text>
                    {active && (
                      <View style={[styles.equipCheck, { backgroundColor: isNoneOpt ? T.blue : T.green }]}>
                        <Check size={10} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          {/* Training Schedule */}
          <Section label="Training Schedule" icon={Calendar}>
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
              <Info size={12} color={T.textMuted} />
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
                <TrendingUp size={13} color={T.green} />
                <Text style={styles.summaryText}>{hillDays} hill session{hillDays !== 1 ? "s" : ""} — repeats on local hills</Text>
              </View>
              {trainingDays - hillDays - 1 > 0 && (
                <View style={styles.summaryRow}>
                  <Heart size={13} color={T.blue} />
                  <Text style={styles.summaryText}>
                    {trainingDays - hillDays - 1} cardio session{trainingDays - hillDays - 1 !== 1 ? "s" : ""} —{" "}
                    {equipment.includes("gym") ? "treadmill / step machine" : equipment.includes("none") || equipment.length === 0 ? "runs, walks, stairs" : "runs + resistance work"}
                  </Text>
                </View>
              )}
              {trainingDays >= 3 && (
                <View style={styles.summaryRow}>
                  <Flag size={13} color={T.orange} />
                  <Text style={styles.summaryText}>1 big day — long hike or extended hill session</Text>
                </View>
              )}
            </View>
          </Section>

          {/* Location + Hill Picker */}
          <Section label="Your Location" icon={Map}>
            <View style={styles.fieldWrap}>
              <Text style={styles.fLabel}>Training location</Text>
              <Text style={styles.fieldHint}>Town, city, or postcode — used to find your local training hills</Text>
              <TextInput
                style={inp("loc")} value={loc}
                onChangeText={v => { setLoc(v); setShowLocSuggestions(true); setHillSearchState("idle"); setSetupHills([]); setPreferredHills([]); }}
                onFocus={() => setShowLocSuggestions(true)}
                onBlur={() => setTimeout(() => setShowLocSuggestions(false), 200)}
                placeholder="e.g. Leeds, UK or LS1 1AA"
                placeholderTextColor={T.textDim}
                returnKeyType="search"
                onSubmitEditing={fetchSetupHills}
              />
              {showLocSuggestions && loc.trim().length >= 2 && (
                LOCATIONS.filter(l => l.toLowerCase().includes(loc.toLowerCase())).slice(0, 6).length > 0
              ) && (
                <View style={styles.locSuggestionsCard}>
                  {LOCATIONS.filter(l => l.toLowerCase().includes(loc.toLowerCase())).slice(0, 6).map((name, i, arr) => (
                    <TouchableOpacity
                      key={name}
                      style={[styles.locSuggestionRow, i < arr.length - 1 && styles.locSuggestionBorder]}
                      onPress={() => {
                        setLoc(name);
                        setShowLocSuggestions(false);
                        setHillSearchState("idle");
                        setSetupHills([]);
                        setPreferredHills([]);
                      }}
                      activeOpacity={0.7}
                    >
                      <MapPin size={13} color={T.textMuted} />
                      <Text style={styles.locSuggestionText}>{name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {errors.loc && <Text style={styles.errorText}>{errors.loc}</Text>}
            </View>

            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
              <View style={[styles.fieldWrap, { flex: 1 }]}>
                <Text style={styles.fLabel}>Search radius (km)</Text>
                <TextInput style={inp("radius")} value={radius} onChangeText={setRadius}
                  placeholder="25" placeholderTextColor={T.textDim} keyboardType="number-pad" />
              </View>
              <TouchableOpacity
                onPress={fetchSetupHills}
                disabled={hillSearchState === "loading" || loc.trim().length < 2}
                activeOpacity={0.8}
                style={[hillStyles.findBtn, (hillSearchState === "loading" || loc.trim().length < 2) && { opacity: 0.5 }]}
              >
                {hillSearchState === "loading"
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Search size={15} color="#fff" />
                }
                <Text style={hillStyles.findBtnText}>
                  {hillSearchState === "loading" ? "Searching…" : "Find hills"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Specific hill search */}
            <View style={hillStyles.specificSearchCard}>
              <View style={hillStyles.specificSearchHeader}>
                <Search size={13} color={T.purple} />
                <Text style={hillStyles.specificSearchTitle}>Search a specific hill</Text>
              </View>
              <View style={hillStyles.specificSearchRow}>
                <TextInput
                  style={hillStyles.specificSearchInput}
                  value={specificSearch}
                  onChangeText={v => { setSpecificSearch(v); setSpecificSearchErr(null); }}
                  placeholder="e.g. Pendle Hill, Kinder Scout…"
                  placeholderTextColor={T.textDim}
                  returnKeyType="search"
                  onSubmitEditing={searchSpecificHill}
                />
                <TouchableOpacity
                  onPress={searchSpecificHill}
                  disabled={specificSearching || specificSearch.trim().length < 2}
                  activeOpacity={0.8}
                  style={[hillStyles.specificSearchBtn, (specificSearching || specificSearch.trim().length < 2) && { opacity: 0.45 }]}
                >
                  {specificSearching
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Search size={15} color="#fff" />
                  }
                </TouchableOpacity>
              </View>
              {specificSearchErr && (
                <Text style={hillStyles.specificSearchErr}>{specificSearchErr}</Text>
              )}
            </View>

            {/* Hill picker results */}
            {hillSearchState === "error" && (
              <Animated.View entering={FadeInDown.duration(300)} style={hillStyles.errorBanner}>
                <AlertCircle size={13} color={T.orange} />
                <Text style={hillStyles.errorText}>Could not fetch hills — check your location and try again.</Text>
              </Animated.View>
            )}

            {hillSearchState === "results" && setupHills.length > 0 && (
              <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={hillStyles.pickerLabel}>Select your training hills</Text>
                  {preferredHills.length > 0 && (
                    <View style={{ backgroundColor: T.greenDim, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: T.green + "40" }}>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: T.green }}>
                        {preferredHills.length} selected
                      </Text>
                    </View>
                  )}
                </View>
                {setupHills.map(hill => {
                  const selected = preferredHills.some(h => h.name === hill.name);
                  const gradeColor =
                    hill.grade === "Easy" ? T.green :
                    hill.grade === "Easy–Mod" ? T.green :
                    hill.grade === "Moderate" ? T.blue :
                    hill.grade === "Hard" ? T.orange : "#FF4444";
                  return (
                    <TouchableOpacity
                      key={hill.name}
                      onPress={() => setPreferredHills(prev =>
                        selected ? prev.filter(h => h.name !== hill.name) : [...prev, hill]
                      )}
                      activeOpacity={0.8}
                      style={[hillStyles.hillCard, selected && { borderColor: T.green, borderWidth: 1.5 }]}
                    >
                      {selected && (
                        <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
                      )}
                      <View style={hillStyles.hillCardTop}>
                        <Text style={hillStyles.hillEmoji}>{hill.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={hillStyles.hillName}>{hill.name}</Text>
                          <Text style={hillStyles.hillSurface}>{hill.surface}</Text>
                        </View>
                        <View style={[hillStyles.gradeBadge, { backgroundColor: gradeColor + "20" }]}>
                          <Text style={[hillStyles.gradeText, { color: gradeColor }]}>{hill.grade}</Text>
                        </View>
                        {selected && (
                          <View style={hillStyles.checkCircle}>
                              <Check size={12} color="#fff" />
                          </View>
                        )}
                      </View>
                      <View style={hillStyles.hillStats}>
                        <HillStatChip icon={TrendingUp} val={`${hill.elevation}m`} color={T.orange} />
                        <HillStatChip icon={MapPin} val={`${hill.distance}km away`} color={T.blue} />
                        <HillStatChip icon={Repeat} val={`×${hill.repeats} reps`} color={T.purple} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {preferredHills.length === 0 && (
                  <Text style={hillStyles.skipHint}>
                    Tap any hill to select it — pick as many as you like. You can also change these later from the Hills tab.
                  </Text>
                )}
              </Animated.View>
            )}
          </Section>

          <Text style={{ color: T.textDim, fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 12, lineHeight: 16, paddingHorizontal: 8 }}>
            SummitReady generates AI training guidance only. It is not a substitute for medical advice. Consult a doctor before starting any new exercise programme, especially if you have any health conditions.
          </Text>

          <TouchableOpacity onPress={submit} disabled={saving}
            style={[styles.submitBtn, { opacity: saving ? 0.7 : 1 }]} activeOpacity={0.85}
          >
            <LinearGradient colors={["#3ECF75", "#2AB860"]} style={styles.submitGrad}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <CheckCircle size={20} color="#fff" />}
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
              <ChevronLeft size={20} color={T.white} />
            </TouchableOpacity>
            <Text style={calStyles.monthLabel}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={() => changeMonth(1)} style={calStyles.navBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <ChevronRight size={20} color={T.white} />
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

function FitnessSlider({
  label, displayValue, subLabel, value, onValueChange, color,
}: {
  label: string;
  displayValue: string;
  subLabel: string;
  value: number;
  onValueChange: (v: number) => void;
  color: string;
}) {
  return (
    <View style={sliderStyles.wrap}>
      <View style={sliderStyles.header}>
        <Text style={styles.fLabel}>{label}</Text>
        <View style={[sliderStyles.badge, { backgroundColor: color + "20", borderColor: color + "50" }]}>
          <Text style={[sliderStyles.badgeText, { color }]}>{displayValue}</Text>
        </View>
      </View>
      <Text style={sliderStyles.subLabel}>{subLabel}</Text>
      <Slider
        value={value}
        onValueChange={onValueChange}
        minimumValue={0}
        maximumValue={100}
        step={1}
        minimumTrackTintColor={color}
        maximumTrackTintColor={T.border}
        thumbTintColor={color}
        style={sliderStyles.slider}
      />
      <View style={sliderStyles.endLabels}>
        <Text style={sliderStyles.endText}>Low</Text>
        <Text style={sliderStyles.endText}>High</Text>
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  wrap: { gap: 4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  subLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: -2 },
  slider: { height: 38, marginHorizontal: -4 },
  endLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: -6 },
  endText: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim },
});

function RouteStatPill({ icon: IconComp, val, color }: { icon: LucideIcon; val: string; color: string }) {
  return (
    <View style={[statStyles.pill, { backgroundColor: color + "15" }]}>
      <IconComp size={11} color={color} />
      <Text style={[statStyles.text, { color }]}>{val}</Text>
    </View>
  );
}

function HillStatChip({ icon: IconComp, val, color }: { icon: LucideIcon; val: string; color: string }) {
  return (
    <View style={[hillStyles.statChip, { backgroundColor: color + "15" }]}>
      <IconComp size={10} color={color} />
      <Text style={[hillStyles.statChipText, { color }]}>{val}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  text: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});

const hillStyles = StyleSheet.create({
  findBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: T.green, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, height: 46,
  },
  findBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: T.orangeDim, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: T.orange + "30",
  },
  errorText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: T.orange },
  pickerLabel: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5,
  },
  hillCard: {
    backgroundColor: T.surface, borderRadius: 14,
    borderWidth: 1, borderColor: T.border,
    padding: 14, gap: 10, overflow: "hidden",
  },
  hillCardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  hillEmoji: { fontSize: 22 },
  hillName: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white },
  hillSurface: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  gradeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  gradeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: T.green, alignItems: "center", justifyContent: "center",
  },
  hillStats: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  statChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  statChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  skipHint: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: T.textDim, textAlign: "center", marginTop: 4,
  },
  specificSearchCard: {
    backgroundColor: T.purpleDim,
    borderRadius: 12, borderWidth: 1, borderColor: T.purple + "30",
    padding: 12, gap: 10,
  },
  specificSearchHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  specificSearchTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.purple },
  specificSearchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  specificSearchInput: {
    flex: 1, backgroundColor: T.surface, borderRadius: 10,
    borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, fontFamily: "Inter_400Regular", color: T.white,
    height: 42,
  },
  specificSearchBtn: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: T.purple, alignItems: "center", justifyContent: "center",
  },
  specificSearchErr: {
    fontSize: 11, fontFamily: "Inter_400Regular", color: T.orange, marginTop: -4,
  },
});

function Section({ label, icon: IconComp, children }: { label: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <View style={secStyles.wrap}>
      <View style={secStyles.head}>
        <View style={secStyles.iconBox}>
          <IconComp size={15} color={T.green} />
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
  locSuggestionsCard: {
    backgroundColor: T.card, borderRadius: 12,
    borderWidth: 1, borderColor: T.border,
    overflow: "hidden", marginTop: 2,
  },
  locSuggestionRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  locSuggestionBorder: { borderBottomWidth: 1, borderBottomColor: T.border },
  locSuggestionText: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.white },

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

  changeBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: T.greenDim, borderRadius: 12, borderWidth: 1,
    borderColor: T.green + "40", paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 4,
  },
  changeBannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: T.green, lineHeight: 18 },

  diffRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  diffBtn: { flex: 1, minWidth: 70, borderRadius: 12, borderWidth: 1, borderColor: T.border, backgroundColor: T.surface, alignItems: "center", paddingVertical: 10, gap: 4, paddingHorizontal: 4 },
  diffEmoji: { fontSize: 18 },
  diffLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  diffDesc: { fontSize: 9, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center", lineHeight: 12 },

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

  expDivider: { height: 1, backgroundColor: T.border, marginVertical: 4 },
  expHeading: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.white, marginTop: 2 },
  expSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: -4, marginBottom: 2 },
  expQ: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: -4 },
  expRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  expChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: T.border, backgroundColor: T.surface,
  },
  expChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: T.textMuted },

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

  planDurCard: {
    backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.blue + "35",
    padding: 14, gap: 10, marginTop: 8,
  },
  planDurHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  planDurTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.white },
  planDurSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 17 },
  planDurRow: { flexDirection: "row", gap: 10 },
  planDurOpt: {
    flex: 1, backgroundColor: T.surface, borderRadius: 12, borderWidth: 1.5,
    borderColor: T.border, padding: 12, gap: 3, alignItems: "center", position: "relative" as const,
  },
  planDurOptActive: { borderColor: T.green + "70", backgroundColor: T.greenDim },
  planDurOptIcon: { fontSize: 22, marginBottom: 2 },
  planDurOptLabel: { fontSize: 12, fontFamily: "Inter_700Bold", color: T.white, textAlign: "center" as const },
  planDurOptWeeks: { fontSize: 18, fontFamily: "Inter_700Bold", color: T.textMuted, textAlign: "center" as const },
  planDurOptDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center" as const },
  planDurCheck: {
    position: "absolute" as const, top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9, backgroundColor: T.green,
    alignItems: "center", justifyContent: "center",
  },

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
