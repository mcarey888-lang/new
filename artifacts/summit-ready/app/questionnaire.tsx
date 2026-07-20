import { Check, MapPin, Minus, Plus, ArrowLeft, Zap, ArrowRight, TrendingUp, X } from "lucide-react-native";
import { useAuth } from "@clerk/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PENDING_PAST_HIKES_KEY, type PastHike } from "@/context/AppContext";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
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
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T, STATUS_COLOR, STATUS_LABEL } from "@/constants/theme";
import { logReadinessTestCompleted, useScreenView } from "@/lib/analytics";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

export const QUIZ_KEY = "summitready_questionnaire_data";
const TOTAL_STEPS = 8;

const LOCATIONS = [
  // English cities & large towns
  "London", "Manchester", "Birmingham", "Bristol", "Liverpool", "Leeds", "Sheffield",
  "Newcastle upon Tyne", "Nottingham", "Leicester", "Coventry", "Bradford", "Plymouth",
  "Derby", "Wolverhampton", "Southampton", "Portsmouth", "Oxford", "Cambridge",
  "Brighton", "Reading", "Norwich", "Milton Keynes", "Exeter", "Gloucester",
  "Cheltenham", "Worcester", "Stoke-on-Trent", "Swindon", "Northampton", "Ipswich",
  "York", "Hull", "Middlesbrough", "Sunderland", "Blackpool", "Preston", "Blackburn",
  "Bolton", "Wigan", "Stockport", "Salford", "Huddersfield", "Halifax", "Wakefield",
  "Rotherham", "Barnsley", "Doncaster",
  // Lake District towns
  "Keswick", "Ambleside", "Windermere", "Bowness-on-Windermere", "Kendal",
  "Penrith", "Carlisle", "Coniston", "Grasmere", "Kirkby Stephen",
  // Yorkshire Dales / Peak District
  "Skipton", "Harrogate", "Ilkley", "Settle", "Hawes", "Richmond", "Ripon",
  "Buxton", "Bakewell", "Castleton", "Matlock",
  // North East England
  "Hexham", "Alnwick", "Berwick-upon-Tweed",
  // Scottish cities & towns
  "Edinburgh", "Glasgow", "Aberdeen", "Dundee", "Perth", "Stirling", "Inverness",
  "Fort William", "Aviemore", "Pitlochry", "Callander", "Aberfoyle", "Glencoe",
  "Tyndrum", "Dunkeld", "Balloch", "Crieff",
  // Wales
  "Cardiff", "Swansea", "Newport", "Wrexham", "Bangor", "Caernarfon",
  "Betws-y-Coed", "Llanberis", "Brecon", "Abergavenny", "Hay-on-Wye",
  "Machynlleth", "Dolgellau", "Barmouth",
  // Northern Ireland & Ireland
  "Belfast", "Derry", "Dublin", "Cork", "Galway", "Limerick", "Killarney",
  "Tralee", "Kilkenny", "Waterford",
  // International hiking bases
  "Chamonix, France", "Zermatt, Switzerland", "Grindelwald, Switzerland",
  "Interlaken, Switzerland", "Innsbruck, Austria", "Salzburg, Austria",
  "Courmayeur, Italy", "Aosta, Italy", "Kathmandu, Nepal",
  "Cusco, Peru", "Cape Town, South Africa", "Nairobi, Kenya",
];

const MOUNTAINS = [
  // Scottish Munros & Corbetts
  "Ben Nevis", "Ben Macdui", "Braeriach", "Cairn Toul", "Cairn Gorm",
  "Aonach Beag", "Aonach Mòr", "Carn Mòr Dearg", "Ben Lawers", "Creag Meagaidh",
  "Ben Lomond", "Schiehallion", "Ben Vorlich", "The Cobbler", "Ben More",
  "Ben Cruachan", "Buachaille Etive Mòr", "Glencoe Pap", "Beinn Alligin",
  "An Teallach", "Liathach", "Torridon", "Cul Mor", "Stac Pollaidh",
  "Ben Hope", "Ben Wyvis", "Lochnagar", "Balmoral", "Beinn Eighe",
  // Lake District
  "Helvellyn", "Scafell Pike", "Scafell", "Great Gable", "Blencathra",
  "Skiddaw", "Cross Fell", "Pillar", "High Street", "Fairfield",
  "Bowfell", "Crinkle Crags", "Langdale Pikes", "Red Pike", "Dale Head",
  "Haystacks", "Kirk Fell", "Coniston Old Man",
  // Yorkshire Dales
  "Whernside", "Ingleborough", "Pen-y-ghent", "Great Whernside",
  // Peak District
  "Kinder Scout", "Mam Tor", "Bleaklow", "Black Hill", "Lose Hill",
  // Wales
  "Snowdon", "Pen y Fan", "Cadair Idris", "Tryfan", "Glyder Fawr",
  "Glyder Fach", "Y Garn", "Carnedd Llewelyn", "Carnedd Dafydd",
  "Pen Pumlumon Fawr", "Brecon Beacons",
  // Ireland
  "Carrauntoohil", "Brandon Mountain", "Lugnaquilla", "Slieve Donard",
  // Alps
  "Mont Blanc", "Matterhorn", "Monte Rosa", "Dufourspitze", "Dom",
  "Weisshorn", "Liskamm", "Grandes Jorasses", "Aiguille Verte",
  "Eiger", "Jungfrau", "Mönch", "Gran Paradiso", "Ortler",
  "Grossglockner", "Zugspitze", "Dolomites", "Tre Cime di Lavaredo",
  // North America
  "Denali", "Mount Rainier", "Mount Whitney", "Mount Shasta", "Mount Hood",
  "Grand Teton", "Longs Peak", "Mount Elbert", "Pikes Peak",
  "Mount Washington", "Humphreys Peak",
  // Africa
  "Kilimanjaro", "Mount Kenya", "Ras Dashen",
  // South America
  "Aconcagua", "Huascarán", "Chimborazo", "Cotopaxi",
  // High Asia
  "Everest", "K2", "Kangchenjunga", "Lhotse", "Makalu",
  "Cho Oyu", "Dhaulagiri", "Manaslu", "Annapurna", "Nanga Parbat",
  "Ama Dablam", "Island Peak", "Mera Peak", "Lobuche East",
  // Other Europe
  "Vesuvius", "Etna", "Olympus", "Triglav", "Rysy",
];
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
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = mountainName.trim().length >= 2
    ? MOUNTAINS.filter(m => m.toLowerCase().includes(mountainName.toLowerCase())).slice(0, 6)
    : [];

  function selectMountain(name: string) {
    setMountainName(name);
    setShowSuggestions(false);
  }

  return (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>What's your summit goal?</Text>
      <Text style={s.stepSub}>We'll build your entire readiness assessment around this mountain.</Text>
      <View style={s.mountainInputWrap}>
        <MapPin size={18} color={T.green} style={s.mountainIcon} />
        <TextInput
          style={s.mountainInput}
          value={mountainName}
          onChangeText={(v) => { setMountainName(v); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="e.g. Helvellyn, Ben Nevis, Snowdon…"
          placeholderTextColor={T.textDim}
          autoCorrect={false}
          autoFocus
          returnKeyType="next"
        />
      </View>
      {showSuggestions && suggestions.length > 0 && (
        <View style={s.suggestionsCard}>
          {suggestions.map((name, i) => (
            <TouchableOpacity
              key={name}
              style={[s.suggestionRow, i < suggestions.length - 1 && s.suggestionBorder]}
              onPress={() => selectMountain(name)}
              activeOpacity={0.7}
            >
              <MapPin size={13} color={T.green} />
              <Text style={s.suggestionText}>{name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
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
  const [showLocSuggestions, setShowLocSuggestions] = useState(false);

  const locSuggestions = location.trim().length >= 2
    ? LOCATIONS.filter(l => l.toLowerCase().includes(location.toLowerCase())).slice(0, 6)
    : [];

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
          onChangeText={v => { setLocation(v); setShowLocSuggestions(true); }}
          onFocus={() => setShowLocSuggestions(true)}
          onBlur={() => setTimeout(() => setShowLocSuggestions(false), 200)}
          placeholder="City, town or postcode"
          placeholderTextColor={T.textDim}
          autoCorrect={false}
          returnKeyType="done"
        />
        {showLocSuggestions && locSuggestions.length > 0 && (
          <View style={s.suggestionsCard}>
            {locSuggestions.map((name, i) => (
              <TouchableOpacity
                key={name}
                style={[s.suggestionRow, i < locSuggestions.length - 1 && s.suggestionBorder]}
                onPress={() => { setLocation(name); setShowLocSuggestions(false); }}
                activeOpacity={0.7}
              >
                <MapPin size={13} color={T.textMuted} />
                <Text style={s.suggestionText}>{name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <Text style={s.fieldHint}>Used to find local hills for your training sessions.</Text>
      </QGroup>
    </View>
  );
}

// ─── Step 7: Catch me up ─────────────────────────────────────────────────────

const POPULAR_PEAKS_Q = [
  { id: "h001", name: "Ben Nevis",    location: "Scotland",        elevationGain: 1340, distance: 17.4, emoji: "🏔️" },
  { id: "h002", name: "Snowdon",      location: "Wales",           elevationGain: 900,  distance: 11.5, emoji: "🏔️" },
  { id: "h003", name: "Scafell Pike", location: "Lake District",   elevationGain: 950,  distance: 13.8, emoji: "🏔️" },
  { id: "h004", name: "Helvellyn",    location: "Lake District",   elevationGain: 760,  distance: 14.4, emoji: "⛰️" },
  { id: "h006", name: "Pen y Fan",    location: "Brecon Beacons",  elevationGain: 420,  distance: 9.8,  emoji: "🏔️" },
  { id: "h007", name: "Kinder Scout", location: "Peak District",   elevationGain: 490,  distance: 14.2, emoji: "🌫️" },
  { id: "h009", name: "Ingleborough", location: "Yorkshire Dales", elevationGain: 460,  distance: 12.6, emoji: "⛰️" },
  { id: "h010", name: "Whernside",    location: "Yorkshire Dales", elevationGain: 455,  distance: 12.4, emoji: "🌾" },
  { id: "h012", name: "Ben Lomond",   location: "Scotland",        elevationGain: 1010, distance: 12.0, emoji: "🏔️" },
] as const;

function getCatchMonthChips() {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i, 1);
    return {
      monthsAgo: i,
      label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
    };
  });
}

type SelectedQHike = PastHike & { key: string };

function StepCatchMeUp({ setPastHikes }: { pastHikes: PastHike[]; setPastHikes: (hikes: PastHike[]) => void }) {
  const [selected, setSelected] = React.useState<SelectedQHike[]>([]);
  const [showCustom, setShowCustom] = React.useState(false);
  const [customName, setCustomName] = React.useState("");
  const [customElev, setCustomElev] = React.useState("");
  const [lookupLoading, setLookupLoading] = React.useState(false);
  const [lookupFound, setLookupFound] = React.useState(false);
  const lookupDebounce = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const monthChips = React.useMemo(() => getCatchMonthChips(), []);

  React.useEffect(() => { setPastHikes(selected); }, [selected, setPastHikes]);

  React.useEffect(() => {
    if (lookupDebounce.current) clearTimeout(lookupDebounce.current);
    setLookupFound(false);
    const trimmed = customName.trim();
    if (trimmed.length < 3) { setLookupLoading(false); return; }
    setLookupLoading(true);
    lookupDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/mountain-lookup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!res.ok) throw new Error("lookup failed");
        const data = await res.json();
        const firstRoute = data.routes?.[0];
        if (firstRoute?.elevationGain) {
          setCustomElev(String(firstRoute.elevationGain));
          setLookupFound(true);
        }
      } catch {
        // silent — user fills in manually
      } finally {
        setLookupLoading(false);
      }
    }, 800);
    return () => { if (lookupDebounce.current) clearTimeout(lookupDebounce.current); };
  }, [customName]);

  function togglePeak(peak: typeof POPULAR_PEAKS_Q[number]) {
    setSelected(prev => {
      const exists = prev.find(s => s.key === peak.id);
      if (exists) return prev.filter(s => s.key !== peak.id);
      return [...prev, {
        key: peak.id, trailId: peak.id, name: peak.name,
        elevationGain: peak.elevationGain, distance: peak.distance,
        monthsAgo: 1, emoji: peak.emoji,
      }];
    });
  }

  function setMonth(key: string, monthsAgo: number) {
    setSelected(prev => prev.map(s => s.key === key ? { ...s, monthsAgo } : s));
  }

  function addCustom() {
    const name = customName.trim();
    const elev = parseInt(customElev.trim(), 10);
    if (!name || !elev || isNaN(elev) || elev <= 0) return;
    const key = `custom_${Date.now()}`;
    setSelected(prev => [...prev, {
      key, name, elevationGain: elev,
      distance: Math.round(elev / 80), monthsAgo: 1, emoji: "⛰️",
    }]);
    setCustomName(""); setCustomElev(""); setShowCustom(false);
    setLookupFound(false);
  }

  return (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>Already been training?</Text>
      <Text style={s.stepSub}>
        Tick any hills you've done in the last 6 months — they'll boost your readiness score. This step is optional.
      </Text>

      {selected.length > 0 && (
        <View style={s.catchSelectedBox}>
          <Text style={s.catchSectionLabel}>YOUR RECENT SUMMITS</Text>
          {selected.map(item => (
            <View key={item.key} style={s.catchSelectedItem}>
              <View style={s.catchSelectedTop}>
                <Text style={{ fontSize: 18 }}>{item.emoji ?? "⛰️"}</Text>
                <Text style={s.catchSelectedName}>{item.name}</Text>
                <TouchableOpacity onPress={() => setSelected(p => p.filter(x => x.key !== item.key))} hitSlop={10} style={{ marginLeft: "auto" }}>
                  <X size={15} color={T.textMuted} />
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.catchMonthRow}>
                  {monthChips.map(chip => {
                    const active = item.monthsAgo === chip.monthsAgo;
                    return (
                      <TouchableOpacity
                        key={chip.monthsAgo}
                        onPress={() => setMonth(item.key, chip.monthsAgo)}
                        style={[s.catchChip, active && s.catchChipActive]}
                        activeOpacity={0.75}
                      >
                        <Text style={[s.catchChipText, active && { color: T.green }]}>{chip.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          ))}
        </View>
      )}

      <Text style={s.catchSectionLabel}>POPULAR UK PEAKS</Text>
      {POPULAR_PEAKS_Q.map(peak => {
        const isSel = selected.some(x => x.key === peak.id);
        return (
          <TouchableOpacity
            key={peak.id}
            onPress={() => togglePeak(peak)}
            style={[s.catchPeakCard, isSel && s.catchPeakCardSel]}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 22 }}>{peak.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.catchPeakName, isSel && { color: T.green }]}>{peak.name}</Text>
              <Text style={s.catchPeakMeta}>{peak.location} · {peak.elevationGain}m gain</Text>
            </View>
            <View style={[s.catchPeakCheck, isSel && s.catchPeakCheckSel]}>
              {isSel && <Check size={11} color="#fff" />}
            </View>
          </TouchableOpacity>
        );
      })}

      {!showCustom ? (
        <TouchableOpacity onPress={() => setShowCustom(true)} style={s.catchCustomBtn} activeOpacity={0.75}>
          <Plus size={14} color={T.green} />
          <Text style={s.catchCustomBtnText}>Add custom hill</Text>
        </TouchableOpacity>
      ) : (
        <View style={s.catchCustomForm}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={s.catchPeakName}>Custom hill</Text>
            <TouchableOpacity onPress={() => { setShowCustom(false); setCustomName(""); setCustomElev(""); setLookupFound(false); }} hitSlop={8}>
              <X size={16} color={T.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Name input with AI lookup indicator */}
          <View style={s.catchCustomNameWrap}>
            <TextInput
              style={[s.locationInput, { flex: 1 }]}
              placeholder="Hill or mountain name"
              placeholderTextColor={T.textDim}
              value={customName}
              onChangeText={v => { setCustomName(v); setLookupFound(false); }}
              autoFocus
              returnKeyType="next"
            />
            {lookupLoading && (
              <ActivityIndicator size="small" color={T.green} style={s.catchLookupIcon} />
            )}
            {!lookupLoading && lookupFound && (
              <View style={s.catchLookupBadge}>
                <Check size={11} color={T.green} />
              </View>
            )}
          </View>

          {lookupFound && (
            <Text style={s.catchLookupHint}>Elevation auto-filled — edit if needed</Text>
          )}
          {!lookupFound && lookupLoading && (
            <Text style={s.catchLookupHint}>Looking up elevation…</Text>
          )}

          <TextInput
            style={[s.locationInput, { marginTop: 8 }]}
            placeholder="Elevation gain in metres"
            placeholderTextColor={T.textDim}
            value={customElev}
            onChangeText={setCustomElev}
            keyboardType="number-pad"
            returnKeyType="done"
          />
          <TouchableOpacity onPress={addCustom} style={[s.catchCustomBtn, { marginTop: 8, justifyContent: "center" }]} activeOpacity={0.8}>
            <Plus size={14} color={T.green} />
            <Text style={s.catchCustomBtnText}>Add hill</Text>
          </TouchableOpacity>
        </View>
      )}
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
  return Math.min(65, score);
}

function deriveFitnessLevel(level: number): "Beginner" | "Average" | "Strong" {
  if (level <= 1) return "Beginner";
  if (level === 2) return "Average";
  return "Strong";
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function QuestionnaireScreen() {
  useScreenView("questionnaire");
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();

  const [step, setStep] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [showBaselineModal, setShowBaselineModal] = useState(false);
  const pendingParams = useRef<{ score: number; mountain: string } | null>(null);

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
  const [pastHikes, setPastHikes] = useState<PastHike[]>([]);

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
      case 7: return true;
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

    const _quizKey = userId ? `${QUIZ_KEY}_${userId}` : QUIZ_KEY;
    const _pendingKey = userId ? `${PENDING_PAST_HIKES_KEY}_${userId}` : PENDING_PAST_HIKES_KEY;
    await AsyncStorage.setItem(_quizKey, JSON.stringify({
      mountainName: mountainName.trim(),
      fitnessBaseline: score,
      fitnessLevel: fitnessLevelStr,
      trainingDays,
      hillDays,
      equipment,
      location: location.trim(),
      rawFitnessLevel: fitnessLevel,
      rawExerciseFreq: exerciseFreq,
      rawElevation: elevation,
      rawRunning: running,
      rawUphillFreq: uphillFreq,
    }));

    if (pastHikes.length > 0) {
      await AsyncStorage.setItem(_pendingKey, JSON.stringify(pastHikes));
    } else {
      await AsyncStorage.removeItem(_pendingKey);
    }
    pendingParams.current = { score, mountain: mountainName.trim() };
    void logReadinessTestCompleted({ readiness_score: score, fitness_level: fitnessLevelStr });
    setShowBaselineModal(true);
  }

  function navigateToPaywall() {
    setShowBaselineModal(false);
    const p = pendingParams.current;
    if (p) {
      router.push({
        pathname: "/paywall",
        params: {
          score: String(p.score),
          mountain: p.mountain,
          fromQuestionnaire: "true",
        },
      });
    }
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
            {step === 7 && <StepCatchMeUp pastHikes={pastHikes} setPastHikes={setPastHikes} />}
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

      <Modal
        visible={showBaselineModal}
        transparent
        animationType="fade"
        onRequestClose={navigateToPaywall}
      >
        <View style={s.baselineOverlay}>
          <View style={s.baselineSheet}>
            <View style={s.baselineIconWrap}>
              <TrendingUp size={28} color={T.green} />
            </View>
            <Text style={s.baselineTitle}>This is your baseline</Text>
            <Text style={s.baselineBody}>
              Your starting score is built from your questionnaire — it reflects where you are right now, not where you'll be.{"\n\n"}The more training sessions you log, the more accurately it reflects your real fitness. Keep training and watch it grow.
            </Text>
            <TouchableOpacity onPress={navigateToPaywall} activeOpacity={0.85} style={s.baselineBtn}>
              <Text style={s.baselineBtnText}>Got it, show me my score</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  suggestionsCard: {
    backgroundColor: T.card, borderRadius: 14,
    borderWidth: 1.5, borderColor: T.green + "40",
    overflow: "hidden", marginTop: -8,
  },
  suggestionRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  suggestionBorder: {
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  suggestionText: {
    fontSize: 15, fontFamily: "Inter_500Medium", color: T.white,
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

  baselineOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  baselineSheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: T.border,
    padding: 28,
    paddingBottom: 48,
    gap: 14,
  },
  baselineIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: T.greenDim,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 4,
  },
  baselineTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: T.text,
    textAlign: "center",
  },
  baselineBody: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    textAlign: "center",
    lineHeight: 23,
  },
  baselineBtn: {
    backgroundColor: T.green,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 6,
  },
  baselineBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },

  catchSectionLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textDim,
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8,
  },
  catchSelectedBox: {
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1.5, borderColor: T.green + "40",
    padding: 12, gap: 8, marginBottom: 4,
  },
  catchSelectedItem: { gap: 8 },
  catchSelectedTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  catchSelectedName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.green },
  catchMonthRow: { flexDirection: "row", gap: 6, paddingBottom: 2 },
  catchChip: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1.5, borderColor: T.border, backgroundColor: T.surface,
  },
  catchChipActive: { borderColor: T.green + "80", backgroundColor: T.green + "18" },
  catchChipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: T.textMuted },
  catchPeakCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.card, borderRadius: 14,
    borderWidth: 1, borderColor: T.border,
    padding: 12, marginBottom: 6,
  },
  catchPeakCardSel: { borderColor: T.green + "60", borderWidth: 1.5 },
  catchPeakName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.white },
  catchPeakMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  catchPeakCheck: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: T.border,
    alignItems: "center", justifyContent: "center",
  },
  catchPeakCheckSel: { backgroundColor: T.green, borderColor: T.green },
  catchCustomBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 12, paddingHorizontal: 4,
  },
  catchCustomBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: T.green },
  catchCustomForm: {
    backgroundColor: T.card, borderRadius: 14,
    borderWidth: 1, borderColor: T.border, padding: 12,
  },
  catchCustomNameWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  catchLookupIcon: {
    marginLeft: 4,
  },
  catchLookupBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: T.greenDim, borderWidth: 1.5, borderColor: T.green + "60",
    alignItems: "center", justifyContent: "center",
    marginLeft: 4,
  },
  catchLookupHint: {
    fontSize: 11, fontFamily: "Inter_400Regular",
    color: T.green, marginTop: 4, marginBottom: 2,
  },
});
