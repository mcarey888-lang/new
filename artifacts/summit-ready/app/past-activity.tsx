import { ArrowLeft, Check, Plus, X, Search, AlertCircle, TrendingUp } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { T } from "@/constants/theme";
import { useApp, type PastHike, type NearbyHill } from "@/context/AppContext";

type SelectedHike = PastHike & { key: string };

function getMonthChips() {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i, 1);
    return {
      monthsAgo: i,
      label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
    };
  });
}

export default function PastActivityScreen() {
  const insets = useSafeAreaInsets();
  const { seedPastActivity, summitGoal } = useApp();

  const [selected, setSelected] = useState<SelectedHike[]>([]);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customElev, setCustomElev] = useState("");
  const [saving, setSaving] = useState(false);

  // Search state
  const [searchText, setSearchText] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<NearbyHill | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchInputRef = useRef<TextInput>(null);

  const monthChips = getMonthChips();

  async function handleHillSearch() {
    const query = searchText.trim();
    if (query.length < 2) return;
    setSearchLoading(true);
    setSearchResult(null);
    setSearchError(null);
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

  function addSearchResult() {
    if (!searchResult) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const key = `search_${searchResult.name}_${Date.now()}`;
    const alreadyAdded = selected.some(s => s.key.startsWith(`search_${searchResult.name}`));
    if (alreadyAdded) return;
    const elevGain = searchResult.elevation;
    setSelected(prev => [...prev, {
      key,
      name: searchResult.name,
      elevationGain: elevGain,
      distance: Math.round(elevGain / 80),
      monthsAgo: 1,
      emoji: searchResult.emoji ?? "⛰️",
    }]);
    // Clear search so user can search another
    setSearchText("");
    setSearchResult(null);
    setSearchError(null);
  }

  function setMonth(key: string, monthsAgo: number) {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelected(prev => prev.map(s => s.key === key ? { ...s, monthsAgo } : s));
  }

  function addCustom() {
    const name = customName.trim();
    const elev = parseInt(customElev.trim(), 10);
    if (!name || !elev || isNaN(elev) || elev <= 0) {
      Alert.alert("Missing info", "Enter a hill name and a valid elevation gain.");
      return;
    }
    const key = `custom_${Date.now()}`;
    setSelected(prev => [...prev, {
      key, name, elevationGain: elev,
      distance: Math.round(elev / 80),
      monthsAgo: 1, emoji: "⛰️",
    }]);
    setCustomName(""); setCustomElev(""); setShowCustom(false);
  }

  async function handleSave() {
    if (selected.length === 0) { router.back(); return; }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(true);
    try { await seedPastActivity(selected); } finally { setSaving(false); }
    router.back();
  }

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>

        <View style={[s.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color={T.white} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Past Summits</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.8}>
            <Text style={[s.saveBtnText, selected.length === 0 && { color: T.textMuted }]}>
              {saving ? "Saving…" : selected.length > 0 ? `Save (${selected.length})` : "Skip"}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 60 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(300)} style={s.intro}>
            <Text style={s.title}>Already been training?</Text>
            <Text style={s.subtitle}>
              Search for any hills or mountains you've already done — they'll show in your completed log and give your readiness score a head start.
            </Text>
          </Animated.View>

          {/* Selected summits with month pickers */}
          {selected.length > 0 && (
            <Animated.View entering={FadeInDown.duration(250)} style={s.selectedSection}>
              <Text style={s.sectionLabel}>YOUR PAST SUMMITS</Text>
              {selected.map(item => (
                <View key={item.key} style={s.selectedCard}>
                  <View style={s.selectedTop}>
                    <Text style={s.selectedEmoji}>{item.emoji ?? "⛰️"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.selectedName}>{item.name}</Text>
                      <Text style={s.selectedMeta}>{item.elevationGain}m gain</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelected(p => p.filter(x => x.key !== item.key))} hitSlop={8}>
                      <X size={16} color={T.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <View style={s.monthRowWrap}>
                    <Text style={s.monthLabel}>When?</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={s.monthChipsRow}>
                        {monthChips.map(chip => {
                          const active = item.monthsAgo === chip.monthsAgo;
                          return (
                            <TouchableOpacity
                              key={chip.monthsAgo}
                              onPress={() => setMonth(item.key, chip.monthsAgo)}
                              style={[s.monthChip, active && s.monthChipActive]}
                              activeOpacity={0.75}
                            >
                              <Text style={[s.monthChipText, active && s.monthChipTextActive]}>{chip.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                </View>
              ))}
            </Animated.View>
          )}

          {/* Search hills */}
          <Animated.View entering={FadeInDown.delay(80).duration(300)}>
            <Text style={[s.sectionLabel, { marginTop: selected.length > 0 ? 4 : 0 }]}>SEARCH HILLS</Text>
            <View style={s.searchCard}>
              <View style={s.searchRow}>
                <TextInput
                  ref={searchInputRef}
                  style={s.searchInput}
                  value={searchText}
                  onChangeText={t => { setSearchText(t); setSearchResult(null); setSearchError(null); }}
                  placeholder="e.g. Ben Nevis, Snowdon, Scafell Pike…"
                  placeholderTextColor={T.textDim}
                  returnKeyType="search"
                  onSubmitEditing={handleHillSearch}
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={handleHillSearch}
                  disabled={searchLoading || searchText.trim().length < 2}
                  style={[s.searchBtn, (searchLoading || searchText.trim().length < 2) && { opacity: 0.45 }]}
                  activeOpacity={0.75}
                >
                  {searchLoading
                    ? <ActivityIndicator size="small" color={T.white} />
                    : <Search size={16} color={T.white} />}
                </TouchableOpacity>
              </View>

              {searchError && (
                <View style={s.searchErrRow}>
                  <AlertCircle size={13} color={T.red} />
                  <Text style={s.searchErrText}>{searchError}</Text>
                </View>
              )}

              {searchResult && (() => {
                const alreadyAdded = selected.some(sel => sel.key.startsWith(`search_${searchResult.name}`));
                return (
                  <Animated.View entering={FadeInDown.duration(200)} style={s.resultCard}>
                    <LinearGradient colors={[T.green + "10", "transparent"]} style={StyleSheet.absoluteFill} />
                    <View style={s.resultTop}>
                      <Text style={s.resultEmoji}>{searchResult.emoji ?? "⛰️"}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.resultName}>{searchResult.name}</Text>
                        <Text style={s.resultSub}>{searchResult.surface}</Text>
                      </View>
                    </View>
                    <View style={s.resultStats}>
                      <View style={s.resultStat}>
                        <TrendingUp size={12} color={T.orange} />
                        <Text style={s.resultStatVal}>{searchResult.elevation}m</Text>
                        <Text style={s.resultStatLbl}>gain</Text>
                      </View>
                      <View style={s.resultStat}>
                        <Text style={s.resultStatLbl}>Grade:</Text>
                        <Text style={s.resultStatVal}>{searchResult.grade}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={addSearchResult}
                      disabled={alreadyAdded}
                      style={[s.addResultBtn, alreadyAdded && s.addResultBtnDone]}
                      activeOpacity={0.75}
                    >
                      {alreadyAdded
                        ? <Check size={14} color={T.green} />
                        : <Plus size={14} color={T.green} />}
                      <Text style={[s.addResultBtnText, alreadyAdded && { color: T.green }]}>
                        {alreadyAdded ? "Added!" : "Add as past summit"}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })()}
            </View>
          </Animated.View>

          {/* Can't find it — custom entry */}
          <Animated.View entering={FadeInDown.delay(140).duration(300)} style={{ marginTop: 8 }}>
            {!showCustom ? (
              <TouchableOpacity onPress={() => setShowCustom(true)} style={s.customBtn} activeOpacity={0.75}>
                <Plus size={15} color={T.textMuted} />
                <Text style={s.customBtnText}>Can't find it? Add manually</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.customForm}>
                <View style={s.customFormHeader}>
                  <Text style={s.customFormTitle}>Add manually</Text>
                  <TouchableOpacity onPress={() => setShowCustom(false)} hitSlop={8}>
                    <X size={18} color={T.textMuted} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={s.customInput}
                  placeholder="Hill or mountain name"
                  placeholderTextColor={T.textDim}
                  value={customName}
                  onChangeText={setCustomName}
                  autoFocus
                  returnKeyType="next"
                />
                <TextInput
                  style={[s.customInput, { marginTop: 8 }]}
                  placeholder="Elevation gain in metres (e.g. 950)"
                  placeholderTextColor={T.textDim}
                  value={customElev}
                  onChangeText={setCustomElev}
                  keyboardType="number-pad"
                  returnKeyType="done"
                />
                <TouchableOpacity onPress={addCustom} style={s.customAddBtn} activeOpacity={0.8}>
                  <Text style={s.customAddBtnText}>Add hill</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {/* Save bar */}
        <View style={[s.saveBar, { paddingBottom: Platform.OS === "web" ? 24 : insets.bottom + 16 }]}>
          <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.85} style={s.saveBarBtn}>
            <LinearGradient
              colors={selected.length > 0 ? ["#3ECF75", "#2AB860"] : [T.surface, T.surface]}
              style={s.saveBarGrad}
            >
              <Text style={[s.saveBarBtnText, selected.length === 0 && { color: T.textMuted }]}>
                {saving ? "Saving…" : selected.length > 0 ? `Add ${selected.length} summit${selected.length !== 1 ? "s" : ""}` : "Skip — nothing to add"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingBottom: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: T.white },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.green },

  scroll: { paddingHorizontal: 18, paddingTop: 4 },

  intro: { gap: 8, marginBottom: 20 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", color: T.white, lineHeight: 32, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 21 },

  sectionLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textDim,
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10,
  },

  selectedSection: { marginBottom: 20, gap: 8 },
  selectedCard: {
    backgroundColor: T.card, borderRadius: 14,
    borderWidth: 1.5, borderColor: T.green + "50",
    padding: 12, gap: 10,
  },
  selectedTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  selectedEmoji: { fontSize: 24 },
  selectedName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.green },
  selectedMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },

  monthRowWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  monthLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted, flexShrink: 0 },
  monthChipsRow: { flexDirection: "row", gap: 6 },
  monthChip: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1.5, borderColor: T.border, backgroundColor: T.surface,
  },
  monthChipActive: { borderColor: T.green + "80", backgroundColor: T.green + "18" },
  monthChipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: T.textMuted },
  monthChipTextActive: { color: T.green },

  // Search
  searchCard: {
    backgroundColor: T.card, borderRadius: 18, borderWidth: 1,
    borderColor: T.border, overflow: "hidden", marginBottom: 8,
    paddingHorizontal: 14, paddingVertical: 14, gap: 10,
  },
  searchRow: { flexDirection: "row", gap: 8 },
  searchInput: {
    flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: T.white,
    backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: T.green, alignItems: "center", justifyContent: "center",
  },
  searchErrRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  searchErrText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.red, flex: 1 },

  // Result card
  resultCard: {
    borderRadius: 14, borderWidth: 1, borderColor: T.green + "40",
    overflow: "hidden", padding: 12, gap: 10,
  },
  resultTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  resultEmoji: { fontSize: 26 },
  resultName: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.white },
  resultSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  resultStats: { flexDirection: "row", gap: 18 },
  resultStat: { flexDirection: "row", alignItems: "center", gap: 5 },
  resultStatVal: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white },
  resultStatLbl: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  addResultBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: T.green + "50", backgroundColor: T.greenDim,
  },
  addResultBtnDone: { backgroundColor: T.green + "10", borderColor: T.green + "30" },
  addResultBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.green },

  // Custom
  customBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 14, paddingHorizontal: 4,
  },
  customBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: T.textMuted },

  customForm: {
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.border, padding: 14, gap: 4,
  },
  customFormHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  customFormTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.white },
  customInput: {
    backgroundColor: T.surface, borderRadius: 10,
    borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 15, fontFamily: "Inter_400Regular", color: T.white,
  },
  customAddBtn: {
    backgroundColor: T.green + "20", borderRadius: 10,
    borderWidth: 1, borderColor: T.green + "50",
    paddingVertical: 11, alignItems: "center", marginTop: 8,
  },
  customAddBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.green },

  saveBar: {
    paddingHorizontal: 18, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: T.border,
  },
  saveBarBtn: { borderRadius: 16, overflow: "hidden" },
  saveBarGrad: { paddingVertical: 15, alignItems: "center", borderRadius: 16 },
  saveBarBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
});
