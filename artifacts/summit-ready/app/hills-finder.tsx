import {
  AlertCircle,
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Clock,
  Info,
  MapPin,
  Minus,
  Plus,
  Radio,
  RefreshCw,
  Repeat,
  Route,
  Search,
  TrendingUp,
  X,
  Zap,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { router } from "expo-router";
import { T } from "@/constants/theme";
import type { NearbyHill } from "@/context/AppContext";
import { LogHikeModal } from "@/components/LogHikeModal";

const LOCATION_KEY = "summitready_hikes_location";
const RADIUS_KEY   = "summitready_hikes_radius";
const HILLS_KEY    = "summitready_hikes_results";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const RADIUS_STEPS = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

const ELEV_STEPS = [0, 50, 100, 150, 200, 300, 400, 500, 600, 800];
const ELEV_LABELS = ["Any", "50m", "100m", "150m", "200m", "300m", "400m", "500m", "600m", "800m"];

const GRADE_COLOR: Record<string, string> = {
  Easy: T.green, "Easy–Mod": T.green, Moderate: T.blue, Hard: T.orange, Alpine: "#FF4444",
};

function stepRadius(current: number, dir: 1 | -1): number {
  const idx = RADIUS_STEPS.indexOf(current);
  if (idx === -1) return RADIUS_STEPS.reduce((p, c) => Math.abs(c - current) < Math.abs(p - current) ? c : p);
  const next = idx + dir;
  if (next < 0) return RADIUS_STEPS[0];
  if (next >= RADIUS_STEPS.length) return RADIUS_STEPS[RADIUS_STEPS.length - 1];
  return RADIUS_STEPS[next];
}

function Stepper({ value, onChange, min = 0, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; step?: number }) {
  return (
    <View style={st.row}>
      <TouchableOpacity onPress={() => onChange(Math.max(min, value - step))} style={st.btn}>
        <Minus size={14} color={T.text} />
      </TouchableOpacity>
      <Text style={st.val}>{value}</Text>
      <TouchableOpacity onPress={() => onChange(value + step)} style={st.btn}>
        <Plus size={14} color={T.text} />
      </TouchableOpacity>
    </View>
  );
}

function HillCard({
  hill,
  location,
  onLog,
}: {
  hill: NearbyHill;
  location: string;
  onLog: (name: string) => void;
}) {
  const gc = GRADE_COLOR[hill.grade] ?? T.blue;
  const isRoute = hill.routeType === "circular" || hill.routeType === "out-and-back";
  const routeLabel = hill.routeType === "circular" ? "Circular" : hill.routeType === "out-and-back" ? "Out & back" : null;

  function openDetails() {
    router.push({
      pathname: "/hill-detail",
      params: {
        name: hill.name,
        location,
        lat:       hill.lat?.toString()       ?? "",
        lng:       hill.lng?.toString()       ?? "",
        elevation: hill.elevation.toString(),
        distance:  hill.distance.toString(),
        grade:     hill.grade,
        surface:   hill.surface,
        emoji:     hill.emoji,
      },
    });
  }

  return (
    <View style={hc.card}>
      <LinearGradient colors={[gc + "08", "transparent"]} style={StyleSheet.absoluteFill} />
      <View style={hc.top}>
        <View style={[hc.iconBox, { backgroundColor: gc + "18" }]}>
          <Text style={hc.emoji}>{hill.emoji}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={hc.name}>{hill.name}</Text>
          <Text style={hc.surface}>{hill.surface}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <View style={[hc.gradeBadge, { backgroundColor: gc + "20" }]}>
            <Text style={[hc.gradeText, { color: gc }]}>{hill.grade}</Text>
          </View>
          {routeLabel && (
            <View style={hc.routeBadge}>
              <Route size={9} color={T.blue} />
              <Text style={hc.routeBadgeText}>{routeLabel}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={hc.stats}>
        <View style={hc.stat}>
          <MapPin size={12} color={T.green} />
          <Text style={hc.statVal}>{hill.distance}km</Text>
          <Text style={hc.statLbl}>away</Text>
        </View>
        <View style={hc.stat}>
          <TrendingUp size={12} color={T.orange} />
          <Text style={hc.statVal}>{hill.elevation}m</Text>
          <Text style={hc.statLbl}>gain</Text>
        </View>
        {isRoute ? (
          <>
            {hill.routeDistance != null && (
              <View style={hc.stat}>
                <Route size={12} color={T.blue} />
                <Text style={hc.statVal}>{hill.routeDistance}km</Text>
                <Text style={hc.statLbl}>route</Text>
              </View>
            )}
            {hill.estimatedTime && (
              <View style={hc.stat}>
                <Clock size={12} color={T.purple} />
                <Text style={hc.statVal}>{hill.estimatedTime}</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <View style={hc.stat}>
              <Repeat size={12} color={T.textMuted} />
              <Text style={hc.statVal}>1×</Text>
              <Text style={hc.statLbl}>reps</Text>
            </View>
            <View style={hc.stat}>
              <BarChart2 size={12} color={T.purple} />
              <Text style={hc.statVal}>{hill.elevation}m</Text>
              <Text style={hc.statLbl}>total</Text>
            </View>
          </>
        )}
      </View>

      {/* Action row */}
      <View style={hc.actionRow}>
        <TouchableOpacity style={hc.detailsBtn} onPress={openDetails} activeOpacity={0.8}>
          <Info size={13} color={T.purple} />
          <Text style={hc.detailsBtnText}>Details</Text>
        </TouchableOpacity>
        <TouchableOpacity style={hc.logBtn} onPress={() => onLog(hill.name)} activeOpacity={0.8}>
          <Text style={hc.logBtnText}>Log a session here</Text>
          <ChevronRight size={13} color={T.green} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function HillsFinderScreen() {
  const insets = useSafeAreaInsets();
  const [location, setLocation] = useState("");
  const [radius, setRadius] = useState(25);
  const [minElevIdx, setMinElevIdx] = useState(0);
  const locInputRef = useRef<TextInput>(null);
  const [hills, setHills] = useState<NearbyHill[]>([]);
  const [hillsLoading, setHillsLoading] = useState(false);
  const [hillsError, setHillsError] = useState<string | null>(null);
  const [outsideRadius, setOutsideRadius] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<NearbyHill | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchAdded, setSearchAdded] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const [logVisible, setLogVisible] = useState(false);
  const [prefillName, setPrefillName] = useState<string | undefined>(undefined);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(LOCATION_KEY),
      AsyncStorage.getItem(RADIUS_KEY),
      AsyncStorage.getItem(HILLS_KEY),
    ]).then(([loc, rad, saved]) => {
      if (loc) setLocation(loc);
      if (rad) setRadius(Number(rad));
      if (saved) {
        try { setHills(JSON.parse(saved) as NearbyHill[]); } catch {}
      }
    });
  }, []);

  const fetchHills = useCallback(async (loc?: string, rad?: number, minElev?: number) => {
    const useLoc = (loc ?? location).trim();
    const useRad = rad ?? radius;
    const useMinElev = minElev ?? ELEV_STEPS[minElevIdx];
    if (!useLoc) { locInputRef.current?.focus(); return; }
    setHillsLoading(true);
    setHillsError(null);
    setOutsideRadius(false);
    try {
      const body: Record<string, unknown> = { location: useLoc, radius: useRad };
      if (useMinElev > 0) body.minElevation = useMinElev;
      const res = await fetch(`${API_BASE}/hills-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Lookup failed");
      const data = await res.json() as { hills: NearbyHill[]; outsideRadius?: boolean };
      setHills(data.hills);
      setOutsideRadius(data.outsideRadius ?? false);
      await AsyncStorage.setItem(HILLS_KEY, JSON.stringify(data.hills));
    } catch {
      setHillsError("Couldn't load hills — check your connection and try again.");
    } finally {
      setHillsLoading(false);
    }
  }, [location, radius, minElevIdx]);

  async function handleHillSearch() {
    const query = searchText.trim();
    if (query.length < 2) return;
    setSearchLoading(true);
    setSearchResult(null);
    setSearchError(null);
    setSearchAdded(false);
    try {
      const res = await fetch(`${API_BASE}/hills-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hillName: query, location: location.trim() }),
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

  function handleAddSearchResult() {
    if (!searchResult) return;
    setHills(prev => {
      const next = prev.some(h => h.name === searchResult.name) ? prev : [searchResult, ...prev];
      AsyncStorage.setItem(HILLS_KEY, JSON.stringify(next));
      return next;
    });
    setSearchAdded(true);
  }

  function handleLocationChange(v: string) {
    setLocation(v);
    AsyncStorage.setItem(LOCATION_KEY, v);
  }

  function handleRadiusChange(dir: 1 | -1) {
    const next = stepRadius(radius, dir);
    setRadius(next);
    AsyncStorage.setItem(RADIUS_KEY, String(next));
  }

  function stepMinElev(dir: 1 | -1) {
    setMinElevIdx(i => {
      const next = i + dir;
      if (next < 0) return 0;
      if (next >= ELEV_STEPS.length) return ELEV_STEPS.length - 1;
      return next;
    });
  }

  function openLog(name?: string) {
    setPrefillName(name);
    setLogVisible(true);
  }

  const hasFetched = hills.length > 0;

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          p.scroll,
          { paddingTop: Platform.OS === "web" ? 60 : insets.top + 16, paddingBottom: 120 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(40).duration(600)} style={p.header}>
          <TouchableOpacity onPress={() => router.back()} style={p.backBtn}>
            <ArrowLeft size={20} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={p.eyebrow}>EXPLORE TRAILS</Text>
            <Text style={p.title}>Training Hills</Text>
          </View>
          <TouchableOpacity style={p.logFab} onPress={() => openLog()} activeOpacity={0.85}>
            <Text style={p.logFabText}>Log session</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Controls card */}
        <Animated.View entering={FadeInDown.delay(80).duration(600)}>
          <View style={p.controlCard}>
            <View style={p.controlRow}>
              <View style={p.controlLabelRow}>
                <MapPin size={13} color={T.green} />
                <Text style={p.controlLabel}>Your location</Text>
              </View>
              <View style={p.locInputWrap}>
                <TextInput
                  ref={locInputRef}
                  style={p.locInput}
                  value={location}
                  onChangeText={handleLocationChange}
                  placeholder="e.g. Manchester, Sheffield…"
                  placeholderTextColor={T.textDim}
                  returnKeyType="search"
                  onSubmitEditing={() => fetchHills()}
                  autoCorrect={false}
                  autoCapitalize="words"
                />
                {location.length > 0 && (
                  <TouchableOpacity onPress={() => { handleLocationChange(""); setHills([]); setHillsError(null); }} hitSlop={8} style={p.clearBtn}>
                    <X size={12} color={T.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={p.controlDivider} />

            <View style={p.controlRow}>
              <View style={p.controlLabelRow}>
                <Radio size={13} color={T.blue} />
                <Text style={p.controlLabel}>Search radius</Text>
              </View>
              <View style={p.radiusStepper}>
                <TouchableOpacity onPress={() => handleRadiusChange(-1)} disabled={radius <= RADIUS_STEPS[0]} style={[p.stepBtn, radius <= RADIUS_STEPS[0] && { opacity: 0.3 }]}>
                  <Minus size={13} color={T.text} />
                </TouchableOpacity>
                <Text style={p.radiusVal}>{radius}km</Text>
                <TouchableOpacity onPress={() => handleRadiusChange(1)} disabled={radius >= RADIUS_STEPS[RADIUS_STEPS.length - 1]} style={[p.stepBtn, radius >= RADIUS_STEPS[RADIUS_STEPS.length - 1] && { opacity: 0.3 }]}>
                  <Plus size={13} color={T.text} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={p.controlDivider} />

            <View style={p.controlRow}>
              <View style={p.controlLabelRow}>
                <TrendingUp size={13} color={T.orange} />
                <Text style={p.controlLabel}>Min elevation</Text>
              </View>
              <View style={p.radiusStepper}>
                <TouchableOpacity onPress={() => stepMinElev(-1)} disabled={minElevIdx <= 0} style={[p.stepBtn, minElevIdx <= 0 && { opacity: 0.3 }]}>
                  <Minus size={13} color={T.text} />
                </TouchableOpacity>
                <Text style={p.radiusVal}>{ELEV_LABELS[minElevIdx]}</Text>
                <TouchableOpacity onPress={() => stepMinElev(1)} disabled={minElevIdx >= ELEV_STEPS.length - 1} style={[p.stepBtn, minElevIdx >= ELEV_STEPS.length - 1 && { opacity: 0.3 }]}>
                  <Plus size={13} color={T.text} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Search hill */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={p.searchCard}>
          <Text style={p.searchCardTitle}>Search for a specific hill</Text>
          <View style={p.searchRow}>
            <View style={p.searchInputWrap}>
              <Search size={14} color={T.textMuted} />
              <TextInput
                ref={searchInputRef}
                style={p.searchInput}
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Hill or mountain name…"
                placeholderTextColor={T.textDim}
                returnKeyType="search"
                onSubmitEditing={handleHillSearch}
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity
              style={[p.searchBtn, (searchText.trim().length < 2 || searchLoading) && { opacity: 0.4 }]}
              onPress={handleHillSearch}
              disabled={searchText.trim().length < 2 || searchLoading}
              activeOpacity={0.85}
            >
              {searchLoading ? <ActivityIndicator size="small" color="#fff" /> : <Search size={16} color="#fff" />}
            </TouchableOpacity>
          </View>
          {searchError && (
            <View style={p.searchError}>
              <AlertCircle size={13} color={T.red} />
              <Text style={p.searchErrorText}>{searchError}</Text>
            </View>
          )}
          {searchResult && (
            <View style={p.searchResultCard}>
              <View style={{ flex: 1 }}>
                <Text style={p.searchResultName}>{searchResult.name}</Text>
                <Text style={p.searchResultSub}>{searchResult.elevation}m · {searchResult.surface} · {searchResult.grade}</Text>
              </View>
              {searchAdded ? (
                <View style={p.addedBadge}><Text style={p.addedText}>Added ✓</Text></View>
              ) : (
                <TouchableOpacity style={p.addBtn} onPress={handleAddSearchResult} activeOpacity={0.85}>
                  <Text style={p.addBtnText}>+ Add</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </Animated.View>

        {/* Refresh button */}
        <Animated.View entering={FadeInDown.delay(120).duration(600)}>
          <TouchableOpacity
            style={[p.refreshBtn, (!location.trim() || hillsLoading) && { opacity: 0.5 }]}
            onPress={() => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); fetchHills(); }}
            disabled={!location.trim() || hillsLoading}
            activeOpacity={0.85}
          >
            <LinearGradient colors={["#3ECF75", "#2AB860"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={p.refreshBtnGrad}>
              {hillsLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <RefreshCw size={15} color="#fff" />
                  <Text style={p.refreshBtnText}>{hasFetched ? "Refresh with AI" : "Find hills with AI"}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Error */}
        {hillsError && (
          <Animated.View entering={FadeInDown.duration(400)} style={p.errorCard}>
            <AlertCircle size={15} color={T.red} />
            <Text style={p.errorText}>{hillsError}</Text>
          </Animated.View>
        )}

        {/* Outside radius banner */}
        {outsideRadius && hills.length > 0 && (
          <View style={p.outsideBanner}>
            <Zap size={13} color={T.orange} />
            <Text style={p.outsideBannerText}>
              No hills matching your filters within {radius}km — showing the nearest qualifying results.
            </Text>
          </View>
        )}

        {/* Results */}
        {hasFetched && !hillsError && (
          <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 10 }}>
            <Text style={p.sectionLabel}>HILLS & ROUTES NEAR {location.toUpperCase()}</Text>
            {hills.map((hill, i) => (
              <Animated.View key={hill.name + i} entering={FadeInDown.delay(i * 50).duration(500)}>
                <HillCard hill={hill} location={location} onLog={openLog} />
              </Animated.View>
            ))}
          </Animated.View>
        )}
      </ScrollView>

      <LogHikeModal visible={logVisible} prefillName={prefillName} onClose={() => setLogVisible(false)} />
    </LinearGradient>
  );
}

const hc = StyleSheet.create({
  card: { backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border, padding: 16, gap: 12, overflow: "hidden" },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  emoji: { fontSize: 18 },
  name: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.text },
  surface: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  gradeBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, flexShrink: 0 },
  gradeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  routeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: T.blueDim, borderWidth: 1, borderColor: T.blue + "40" },
  routeBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.blue },
  stats: { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  stat: { flexDirection: "row", alignItems: "center", gap: 3 },
  statVal: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text },
  statLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  actionRow: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: T.border, paddingTop: 10, marginTop: 2, gap: 8 },
  detailsBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: T.purpleDim, borderRadius: 10, borderWidth: 1, borderColor: T.purple + "30", paddingHorizontal: 12, paddingVertical: 8 },
  detailsBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.purple },
  logBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 3 },
  logBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.green },
});

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  btn: { width: 36, height: 36, backgroundColor: T.surface, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  val: { width: 50, textAlign: "center", fontSize: 16, fontFamily: "Inter_700Bold", color: T.text },
});

const p = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  eyebrow: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.textDim, letterSpacing: 1.2 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.text },
  logFab: { backgroundColor: T.greenDim, borderRadius: 12, borderWidth: 1, borderColor: T.green + "40", paddingHorizontal: 14, paddingVertical: 9 },
  logFabText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.green },
  controlCard: { backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border, padding: 16, gap: 12 },
  controlRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  controlLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  controlLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  controlDivider: { height: 1, backgroundColor: T.border },
  locInputWrap: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: T.surface, borderRadius: 10, borderWidth: 1, borderColor: T.border, paddingHorizontal: 10, marginLeft: 12 },
  locInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: T.text, paddingVertical: 8 },
  clearBtn: { padding: 4 },
  radiusStepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepBtn: { width: 30, height: 30, backgroundColor: T.surface, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  radiusVal: { width: 46, textAlign: "center", fontSize: 13, fontFamily: "Inter_700Bold", color: T.text },
  searchCard: { backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border, padding: 14, gap: 10 },
  searchCardTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.text },
  searchRow: { flexDirection: "row", gap: 8 },
  searchInputWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: T.surface, borderRadius: 10, borderWidth: 1, borderColor: T.border, paddingHorizontal: 10 },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: T.text, paddingVertical: 9 },
  searchBtn: { width: 42, height: 42, backgroundColor: T.green, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  searchError: { flexDirection: "row", alignItems: "center", gap: 6 },
  searchErrorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.red },
  searchResultCard: { flexDirection: "row", alignItems: "center", backgroundColor: T.surface, borderRadius: 12, padding: 12, gap: 10 },
  searchResultName: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },
  searchResultSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  addBtn: { backgroundColor: T.greenDim, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: T.green + "40" },
  addBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.green },
  addedBadge: { backgroundColor: T.greenDim, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  addedText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.green },
  refreshBtn: { borderRadius: 14, overflow: "hidden" },
  refreshBtnGrad: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  refreshBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  errorCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: T.redDim, borderRadius: 12, borderWidth: 1, borderColor: T.red + "30", padding: 12 },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.red, flex: 1 },
  outsideBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: T.orangeDim, borderRadius: 12, borderWidth: 1, borderColor: T.orange + "30", padding: 12 },
  outsideBannerText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.orange, flex: 1 },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.textDim, letterSpacing: 1 },
});
