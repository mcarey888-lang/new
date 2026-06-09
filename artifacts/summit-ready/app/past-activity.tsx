import { ArrowLeft, Check, Plus, X } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
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
import { useApp, type PastHike } from "@/context/AppContext";

const POPULAR_PEAKS = [
  { id: "h001", name: "Ben Nevis",      location: "Scotland",        elevationGain: 1340, distance: 17.4, emoji: "🏔️" },
  { id: "h002", name: "Snowdon",        location: "Wales",           elevationGain: 900,  distance: 11.5, emoji: "🏔️" },
  { id: "h003", name: "Scafell Pike",   location: "Lake District",   elevationGain: 950,  distance: 13.8, emoji: "🏔️" },
  { id: "h004", name: "Helvellyn",      location: "Lake District",   elevationGain: 760,  distance: 14.4, emoji: "⛰️" },
  { id: "h006", name: "Pen y Fan",      location: "Brecon Beacons",  elevationGain: 420,  distance: 9.8,  emoji: "🏔️" },
  { id: "h007", name: "Kinder Scout",   location: "Peak District",   elevationGain: 490,  distance: 14.2, emoji: "🌫️" },
  { id: "h009", name: "Ingleborough",   location: "Yorkshire Dales", elevationGain: 460,  distance: 12.6, emoji: "⛰️" },
  { id: "h010", name: "Whernside",      location: "Yorkshire Dales", elevationGain: 455,  distance: 12.4, emoji: "🌾" },
  { id: "h012", name: "Ben Lomond",     location: "Scotland",        elevationGain: 1010, distance: 12.0, emoji: "🏔️" },
] as const;

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
  const { seedPastActivity } = useApp();

  const [selected, setSelected] = useState<SelectedHike[]>([]);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customElev, setCustomElev] = useState("");
  const [saving, setSaving] = useState(false);

  const monthChips = getMonthChips();

  function togglePeak(peak: typeof POPULAR_PEAKS[number]) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
              Add any recent summits — they'll show in your completed log and give your readiness score a head start.
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

          {/* Popular peaks */}
          <Animated.View entering={FadeInDown.delay(80).duration(300)}>
            <Text style={[s.sectionLabel, { marginTop: selected.length > 0 ? 4 : 0 }]}>POPULAR UK PEAKS</Text>
            {POPULAR_PEAKS.map((peak, i) => {
              const isSelected = selected.some(s => s.key === peak.id);
              return (
                <Animated.View key={peak.id} entering={FadeInDown.delay(i * 25).duration(220)}>
                  <TouchableOpacity
                    onPress={() => togglePeak(peak)}
                    style={[s.peakCard, isSelected && s.peakCardSelected]}
                    activeOpacity={0.8}
                  >
                    <Text style={s.peakEmoji}>{peak.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.peakName, isSelected && { color: T.green }]}>{peak.name}</Text>
                      <Text style={s.peakMeta}>{peak.location} · {peak.elevationGain}m</Text>
                    </View>
                    <View style={[s.peakCheck, isSelected && s.peakCheckActive]}>
                      {isSelected && <Check size={11} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </Animated.View>

          {/* Custom hill */}
          <Animated.View entering={FadeInDown.delay(250).duration(300)} style={{ marginTop: 8 }}>
            {!showCustom ? (
              <TouchableOpacity onPress={() => setShowCustom(true)} style={s.customBtn} activeOpacity={0.75}>
                <Plus size={15} color={T.green} />
                <Text style={s.customBtnText}>Add a different hill</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.customForm}>
                <View style={s.customFormHeader}>
                  <Text style={s.customFormTitle}>Custom hill</Text>
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

  peakCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.card, borderRadius: 14,
    borderWidth: 1, borderColor: T.border,
    padding: 12, marginBottom: 6,
  },
  peakCardSelected: { borderColor: T.green + "60", borderWidth: 1.5 },
  peakEmoji: { fontSize: 24 },
  peakName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.white },
  peakMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  peakCheck: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: T.border,
    alignItems: "center", justifyContent: "center",
  },
  peakCheckActive: { backgroundColor: T.green, borderColor: T.green },

  customBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 14, paddingHorizontal: 4,
  },
  customBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: T.green },

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
