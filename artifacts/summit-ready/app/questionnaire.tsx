import { Check, MapPin, Minus, Plus, ArrowLeft, Zap, ArrowRight } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
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
import { T, STATUS_COLOR, STATUS_LABEL } from "@/constants/theme";

export const QUIZ_KEY = "summitready_questionnaire_data";
const TOTAL_STEPS = 7;
type Equipment = "gym" | "weights" | "bands" | "none";

// ─── Shared sub-components ────────────────────────────────────────────────────

function OptionCard({
  icon, label, sub, selected, onPress, color = T.green,
}: {
  icon: string; label: string; sub: string;
  selected: boolean; onPress: () => void; color?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[s.optionCard, selected && { borderColor: color, borderWidth: 1.5 }]}
    >
      {selected && (
        <LinearGradient
          colors={[color + "18", "transparent"]}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={[s.optionIconBox, { backgroundColor: selected ? color + "25" : T.surface }]}>
        <Text style={s.optionEmoji}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.optionLabel, selected && { color }]}>{label}</Text>
        <Text style={s.optionSub}>{sub}</Text>
      </View>
      {selected && (
        <View style={[s.optionCheck, { backgroundColor: color }]}>
          <Check size={12} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

function ChipSelect({
  options, selected, onSelect, color = T.green,
}: {
  options: string[]; selected: number; onSelect: (i: number) => void; color?: string;
}) {
  return (
    <View style={s.chipRow}>
      {options.map((label, i) => {
        const idx = i + 1;
        const active = selected === idx;
        return (
          <TouchableOpacity
            key={label}
            onPress={() => onSelect(active ? 0 : idx)}
            activeOpacity={0.75}
            style={[s.chip, active && { backgroundColor: color + "20", borderColor: color + "70" }]}
          >
            <Text style={[s.chipText, active && { color }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function QGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.qGroup}>
      <Text style={s.qGroupLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ─── Step screens ─────────────────────────────────────────────────────────────

function StepMountain({ mountainName, setMountainName }: { mountainName: string; setMountainName: (v: string) => void }) {
  return (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>What's your summit goal?</Text>
      <Text style={s.stepSub}>We'll build your entire readiness assessment around this mountain.</Text>
      <View style={s.mountainInputWrap}>
        <MapPin size={18} color={T.green} style={s.mountainIcon} />
        <TextInput
          style={s.mountainInput}
          value={mountainName}
          onChangeText={setMountainName}
          placeholder="e.g. Helvellyn, Ben Nevis, Snowdon…"
          placeholderTextColor={T.textDim}
          autoCorrect={false}
          autoFocus
          returnKeyType="next"
        />
      </View>
      <Text style={s.fieldHint}>You'll choose your exact route and summit date in the next step.</Text>
    </View>
  );
}

function StepFitness({ value, setValue }: { value: number; setValue: (v: number) => void }) {
  const opts = [
    { icon: "🌱", label: "Just starting out", sub: "New to regular exercise or returning after a long break" },
    { icon: "⚡", label: "Generally active", sub: "I exercise regularly but not intensely — walks, gym, occasional runs" },
    { icon: "🔥", label: "Fit and active", sub: "I train consistently, feel strong, and recover well" },
    { icon: "🏆", label: "Athlete level", sub: "High-performance fitness — serious sport, adventure racing or similar" },
  ];
  return (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>How would you describe your fitness right now?</Text>
      <Text style={s.stepSub}>Be honest — this shapes your entire starting point.</Text>
      <View style={s.optionList}>
        {opts.map((o, i) => (
          <OptionCard
            key={o.label}
            icon={o.icon} label={o.label} sub={o.sub}
            selected={value === i + 1}
            onPress={() => setValue(value === i + 1 ? 0 : i + 1)}
          />
        ))}
      </View>
    </View>
  );
}

function StepExercise({ freq, setFreq }: { freq: number; setFreq: (v: number) => void }) {
  return (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>How often do you currently exercise?</Text>
      <Text style={s.stepSub}>Include any physical activity — gym, runs, walks, sport, cycling.</Text>
      <QGroup label="Days per week on average">
        <ChipSelect
          options={["Rarely", "1–2 days", "3–4 days", "5+ days"]}
          selected={freq}
          onSelect={setFreq}
        />
      </QGroup>
    </View>
  );
}

function StepHiking({
  elevation, setElevation, hikeDuration, setHikeDuration,
}: {
  elevation: number; setElevation: (v: number) => void;
  hikeDuration: number; setHikeDuration: (v: number) => void;
}) {
  return (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>Tell us about your hiking experience</Text>
      <Text style={s.stepSub}>This is the most important indicator of mountain readiness.</Text>
      <QGroup label="Biggest single-day elevation gain in the last 3 months">
        <ChipSelect
          options={["Under 200m", "200–500m", "500–1000m", "1000m+"]}
          selected={elevation}
          onSelect={setElevation}
          color={T.orange}
        />
      </QGroup>
      <QGroup label="Longest single hike you've completed">
        <ChipSelect
          options={["Under 2 hrs", "2–4 hrs", "4–6 hrs", "6+ hrs"]}
          selected={hikeDuration}
          onSelect={setHikeDuration}
          color={T.orange}
        />
      </QGroup>
    </View>
  );
}

function StepUphill({
  uphillFreq, setUphillFreq, summitHistory, setSummitHistory,
}: {
  uphillFreq: number; setUphillFreq: (v: number) => void;
  summitHistory: number; setSummitHistory: (v: number) => void;
}) {
  return (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>Uphill training & summit history</Text>
      <Text style={s.stepSub}>Specific uphill experience is the strongest predictor of summit readiness.</Text>
      <QGroup label="How often do you train specifically uphill?">
        <ChipSelect
          options={["Rarely", "Monthly", "Weekly", "Several times/week"]}
          selected={uphillFreq}
          onSelect={setUphillFreq}
          color={T.blue}
        />
      </QGroup>
      <QGroup label="Have you completed a mountain summit before?">
        <ChipSelect
          options={["Never", "A smaller one", "Yes, similar", "Yes, harder"]}
          selected={summitHistory}
          onSelect={setSummitHistory}
          color={T.blue}
        />
      </QGroup>
    </View>
  );
}

function StepCardio({
  running, setRunning, strength, setStrength,
}: {
  running: number; setRunning: (v: number) => void;
  strength: number; setStrength: (v: number) => void;
}) {
  return (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>Cardio & strength</Text>
      <Text style={s.stepSub}>Both contribute to how quickly you'll build summit fitness.</Text>
      <QGroup label="Can you run 5km without stopping?">
        <ChipSelect
          options={["No", "Yes, with effort", "Yes, comfortably"]}
          selected={running}
          onSelect={setRunning}
          color={T.purple}
        />
      </QGroup>
      <QGroup label="How often do you strength or resistance train?">
        <ChipSelect
          options={["Never", "Occasionally", "1–2x per week", "3+ per week"]}
          selected={strength}
          onSelect={setStrength}
          color={T.purple}
        />
      </QGroup>
    </View>
  );
}

function StepPlan({
  trainingDays, setTrainingDays, equipment, toggleEquipment, location, setLocation,
}: {
  trainingDays: number; setTrainingDays: (v: number) => void;
  equipment: Equipment[]; toggleEquipment: (v: Equipment) => void;
  location: string; setLocation: (v: string) => void;
}) {
  const EQUIP_OPTS: { value: Equipment; label: string; icon: string }[] = [
    { value: "gym",     label: "Gym membership",   icon: "🏋️" },
    { value: "weights", label: "Home weights",      icon: "💪" },
    { value: "bands",   label: "Resistance bands",  icon: "🔗" },
    { value: "none",    label: "No equipment",      icon: "🥾" },
  ];
  return (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>Last step — your training preferences</Text>
      <Text style={s.stepSub}>We'll tailor your plan to fit your schedule and what you have available.</Text>

      <QGroup label="Training days per week you can commit to">
        <View style={s.stepperRow}>
          <TouchableOpacity
            onPress={() => setTrainingDays(Math.max(2, trainingDays - 1))}
            style={s.stepperBtn} activeOpacity={0.7}
          >
            <Minus size={18} color={T.white} />
          </TouchableOpacity>
          <View style={s.stepperVal}>
            <Text style={s.stepperNum}>{trainingDays}</Text>
            <Text style={s.stepperLbl}>days / week</Text>
          </View>
          <TouchableOpacity
            onPress={() => setTrainingDays(Math.min(6, trainingDays + 1))}
            style={s.stepperBtn} activeOpacity={0.7}
          >
            <Plus size={18} color={T.white} />
          </TouchableOpacity>
        </View>
      </QGroup>

      <QGroup label="What equipment do you have access to?">
        <View style={s.chipRow}>
          {EQUIP_OPTS.map(opt => {
            const active = equipment.includes(opt.value);
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => toggleEquipment(opt.value)}
                activeOpacity={0.75}
                style={[s.chip, active && { backgroundColor: T.green + "20", borderColor: T.green + "70" }]}
              >
                <Text style={s.chipEmoji}>{opt.icon}</Text>
                <Text style={[s.chipText, active && { color: T.green }]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </QGroup>

      <QGroup label="Where are you based?">
        <TextInput
          style={s.locationInput}
          value={location}
          onChangeText={setLocation}
          placeholder="City, town or postcode"
          placeholderTextColor={T.textDim}
          autoCorrect={false}
          returnKeyType="done"
        />
        <Text style={s.fieldHint}>Used to find local hills for your training sessions.</Text>
      </QGroup>
    </View>
  );
}

// ─── Score calculation ────────────────────────────────────────────────────────

function calcScore(
  fitnessLevel: number, exerciseFreq: number, elevation: number,
  hikeDuration: number, uphillFreq: number, summitHistory: number,
  running: number, strength: number,
): number {
  const pts = (arr: number[], idx: number) => arr[idx] ?? 0;
  let score = 0;
  score += pts([0, 6, 14, 22], fitnessLevel - 1);
  score += pts([0, 1, 2, 3], exerciseFreq - 1);
  score += pts([0, 0, 5, 12, 18], elevation);
  score += pts([0, 0, 1, 2, 3], hikeDuration);
  score += pts([0, 0, 2, 4, 6], uphillFreq);
  score += pts([0, 0, 2, 5, 8], summitHistory);
  score += pts([0, 0, 2, 4], running);
  score += pts([0, 0, 0, 1, 2], strength);
  return Math.min(50, score);
}

function deriveFitnessLevel(level: number): "Beginner" | "Average" | "Strong" {
  if (level <= 1) return "Beginner";
  if (level === 2) return "Average";
  return "Strong";
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function QuestionnaireScreen() {
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  const [mountainName, setMountainName] = useState("");
  const [fitnessLevel, setFitnessLevel] = useState(0);
  const [exerciseFreq, setExerciseFreq] = useState(0);
  const [elevation, setElevation] = useState(0);
  const [hikeDuration, setHikeDuration] = useState(0);
  const [uphillFreq, setUphillFreq] = useState(0);
  const [summitHistory, setSummitHistory] = useState(0);
  const [running, setRunning] = useState(0);
  const [strength, setStrength] = useState(0);
  const [trainingDays, setTrainingDays] = useState(4);
  const [equipment, setEquipment] = useState<Equipment[]>(["none"]);
  const [location, setLocation] = useState("");

  function toggleEquipment(val: Equipment) {
    if (val === "none") {
      setEquipment(["none"]);
    } else {
      setEquipment(prev => {
        const withoutNone = prev.filter(e => e !== "none");
        if (withoutNone.includes(val)) {
          const removed = withoutNone.filter(e => e !== val);
          return removed.length === 0 ? ["none"] : removed;
        }
        return [...withoutNone, val];
      });
    }
  }

  const canAdvance = (): boolean => {
    switch (step) {
      case 0: return mountainName.trim().length >= 2;
      case 1: return fitnessLevel > 0;
      case 2: return exerciseFreq > 0;
      case 3: return elevation > 0 && hikeDuration > 0;
      case 4: return uphillFreq > 0 && summitHistory > 0;
      case 5: return running > 0 && strength > 0;
      case 6: return location.trim().length >= 2;
      default: return false;
    }
  };

  function advance() {
    if (step < TOTAL_STEPS - 1) {
      setAnimKey(k => k + 1);
      setStep(s => s + 1);
    } else {
      handleComplete();
    }
  }

  function goBack() {
    if (step === 0) {
      router.back();
    } else {
      setAnimKey(k => k + 1);
      setStep(s => s - 1);
    }
  }

  async function handleComplete() {
    const score = calcScore(fitnessLevel, exerciseFreq, elevation, hikeDuration, uphillFreq, summitHistory, running, strength);
    const fitnessLevelStr = deriveFitnessLevel(fitnessLevel);
    const hillDays = Math.max(1, Math.round(trainingDays * 0.4));

    await AsyncStorage.setItem(QUIZ_KEY, JSON.stringify({
      mountainName: mountainName.trim(),
      fitnessBaseline: score,
      fitnessLevel: fitnessLevelStr,
      trainingDays,
      hillDays,
      equipment,
      location: location.trim(),
    }));

    router.push({
      pathname: "/paywall",
      params: {
        score: String(score),
        mountain: mountainName.trim(),
        fromQuestionnaire: "true",
      },
    });
  }

  const progress = (step + 1) / TOTAL_STEPS;
  const isLast = step === TOTAL_STEPS - 1;

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={[s.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 8 }]}>
          <TouchableOpacity onPress={goBack} style={s.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color={T.white} />
          </TouchableOpacity>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>
          <Text style={s.stepCounter}>{step + 1} / {TOTAL_STEPS}</Text>
        </View>

        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View key={animKey} entering={FadeInDown.duration(320)}>
            {step === 0 && <StepMountain mountainName={mountainName} setMountainName={setMountainName} />}
            {step === 1 && <StepFitness value={fitnessLevel} setValue={setFitnessLevel} />}
            {step === 2 && <StepExercise freq={exerciseFreq} setFreq={setExerciseFreq} />}
            {step === 3 && <StepHiking elevation={elevation} setElevation={setElevation} hikeDuration={hikeDuration} setHikeDuration={setHikeDuration} />}
            {step === 4 && <StepUphill uphillFreq={uphillFreq} setUphillFreq={setUphillFreq} summitHistory={summitHistory} setSummitHistory={setSummitHistory} />}
            {step === 5 && <StepCardio running={running} setRunning={setRunning} strength={strength} setStrength={setStrength} />}
            {step === 6 && <StepPlan trainingDays={trainingDays} setTrainingDays={setTrainingDays} equipment={equipment} toggleEquipment={toggleEquipment} location={location} setLocation={setLocation} />}
          </Animated.View>
        </ScrollView>

        {/* Footer / Next button */}
        <View style={[s.footer, { paddingBottom: Platform.OS === "web" ? 24 : insets.bottom + 16 }]}>
          <TouchableOpacity
            onPress={advance}
            disabled={!canAdvance()}
            activeOpacity={0.85}
            style={[s.nextBtn, !canAdvance() && { opacity: 0.38 }]}
          >
            <LinearGradient colors={["#3ECF75", "#2AB860"]} style={s.nextBtnGrad}>
              <Text style={s.nextBtnText}>
                {isLast ? "See my readiness score" : "Next"}
              </Text>
              {isLast ? <Zap size={18} color="#fff" /> : <ArrowRight size={18} color="#fff" />}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 18, paddingBottom: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    alignItems: "center", justifyContent: "center",
  },
  progressTrack: {
    flex: 1, height: 4, backgroundColor: T.surface,
    borderRadius: 2, overflow: "hidden",
  },
  progressFill: {
    height: "100%", backgroundColor: T.green, borderRadius: 2,
  },
  stepCounter: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted, minWidth: 32, textAlign: "right",
  },

  scroll: { paddingHorizontal: 18, paddingTop: 8 },

  stepWrap: { gap: 20 },
  stepTitle: {
    fontSize: 24, fontFamily: "Inter_700Bold", color: T.white,
    lineHeight: 32, letterSpacing: -0.3,
  },
  stepSub: {
    fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted,
    lineHeight: 21, marginTop: -12,
  },

  optionList: { gap: 10 },
  optionCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.cardBorder,
    padding: 14, overflow: "hidden",
  },
  optionIconBox: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: "center", justifyContent: "center",
  },
  optionEmoji: { fontSize: 22 },
  optionLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.white },
  optionSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2, lineHeight: 17 },
  optionCheck: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
  },

  qGroup: { gap: 10 },
  qGroupLabel: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted,
    textTransform: "uppercase", letterSpacing: 0.5,
  },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 22, borderWidth: 1.5, borderColor: T.border,
    backgroundColor: T.surface,
  },
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: T.textMuted },

  mountainInputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1.5, borderColor: T.green + "50",
    paddingHorizontal: 14, paddingVertical: 4,
    gap: 10,
  },
  mountainIcon: { flexShrink: 0 },
  mountainInput: {
    flex: 1, fontSize: 17, fontFamily: "Inter_500Medium", color: T.white,
    paddingVertical: 12,
  },
  fieldHint: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, lineHeight: 18,
  },

  stepperRow: {
    flexDirection: "row", alignItems: "center", gap: 20,
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.cardBorder,
    padding: 16, alignSelf: "flex-start",
  },
  stepperBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.surface, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: T.border,
  },
  stepperVal: { alignItems: "center", minWidth: 60 },
  stepperNum: { fontSize: 28, fontFamily: "Inter_700Bold", color: T.white },
  stepperLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },

  locationInput: {
    backgroundColor: T.card, borderRadius: 14,
    borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, fontFamily: "Inter_400Regular", color: T.white,
  },

  footer: {
    paddingHorizontal: 18, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: T.border,
    backgroundColor: T.bg + "F0",
  },
  nextBtn: { borderRadius: 18, overflow: "hidden" },
  nextBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 17,
  },
  nextBtnText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
});
