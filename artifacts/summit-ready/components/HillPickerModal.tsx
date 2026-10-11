import React from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { AlertCircle, Globe, MapPin, Search, X } from "lucide-react-native";
import { router } from "expo-router";

import { NearbyHill } from "@/context/AppContext";
import { T } from "@/constants/theme";
import { isMappedTrainingHill } from "@/utils/hillDetailNavigation";
import { normalizeUkPostcode, looksLikeUkPostcode } from "@/utils/explorePostcode";
import { searchTrainingHills } from "@/utils/trainingHillSearch";

export function HillPickerModal({
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
  const [searchResults, setSearchResults] = React.useState<NearbyHill[]>([]);
  const [resultKind, setResultKind] = React.useState<"area" | "name" | null>(null);
  const [resultQuery, setResultQuery] = React.useState("");
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const requestId = React.useRef(0);
  const abortRef = React.useRef<AbortController | null>(null);

  function clearSearch() {
    abortRef.current?.abort();
    requestId.current += 1;
    setSearchResults([]);
    setResultKind(null);
    setSearchError(null);
    setSearching(false);
  }

  const filtered = React.useMemo(() => {
    // Old saved AI suggestions must not be offered as mapped training hills.
    const mapped = hills.filter(isMappedTrainingHill);
    if (!query.trim()) return mapped;
    const q = query.toLowerCase();
    return mapped.filter(h => h.name.toLowerCase().includes(q));
  }, [query, hills]);

  async function searchOnline(kind: "area" | "name" = "area", searchQuery = query) {
    const q = normalizeUkPostcode(searchQuery) ?? searchQuery.trim();
    if (q.length < 2) return;
    const currentRequest = ++requestId.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    setSearchResults([]);
    setResultKind(null);
    setSearchError(null);
    try {
      const usable = await searchTrainingHills(kind, q, location, controller.signal);
      if (currentRequest !== requestId.current) return;
      setSearchResults(usable);
      setResultKind(kind);
      setResultQuery(q);
      if (usable.length === 0) setSearchError(kind === "area"
        ? `No hills found near "${q}". Try another area or search by hill name.`
        : `No hill found named "${q}". Try another name or search an area.`);
    } catch (error) {
      if (currentRequest === requestId.current) {
        if ((error as Error)?.name !== "AbortError") {
          setSearchError(error instanceof Error ? error.message : "Hill search is unavailable. Please retry.");
        }
      }
    } finally {
      if (currentRequest === requestId.current) setSearching(false);
    }
  }

  React.useEffect(() => {
    if (!visible) return;
    const postcode = normalizeUkPostcode(query);
    const term = postcode ?? (!query.trim() ? location : "");
    if (!term || term.trim().length < 2) return;
    const timer = setTimeout(() => { void searchOnline("area", term); }, postcode ? 450 : 0);
    return () => {
      clearTimeout(timer);
      requestId.current += 1;
      abortRef.current?.abort();
    };
  }, [visible, location, query]);

  function handleSelect(hill: NearbyHill) {
    if (searchResults.includes(hill)) {
      onSearchAdd(hill);
    }
    onSelect(hill);
    setQuery("");
    clearSearch();
  }

  function handleClose() {
    setQuery("");
    clearSearch();
    onClose();
  }

  const showOnlineBtn = query.trim().length >= 2 && !searching;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={handleClose} />
      <View style={st.sheet}>
        <View style={st.handle} />
        <Text style={st.title}>Choose a Hill</Text>
        <Text style={st.hint}>Ascent per climb shown below. Your plan calculates the climbs needed.</Text>

        <View style={st.searchRow}>
          <Search size={15} color={T.textMuted} style={{ marginLeft: 12 }} />
          <TextInput
            style={st.searchInput}
            value={query}
            onChangeText={v => { setQuery(v); clearSearch(); }}
            placeholder="Hill name, town or postcode…"
            placeholderTextColor={T.textDim}
            onSubmitEditing={() => searchOnline("area")}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(""); clearSearch(); }} style={{ paddingRight: 12 }}>
              <X size={14} color={T.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">

          {searchResults.length > 0 && (
            <View style={st.searchResultCard}>
              <View style={st.searchResultHeader}>
                <Globe size={12} color={T.blue} />
                <Text style={st.searchResultLabel}>{resultKind === "area" ? `Hills near ${resultQuery}` : "Online hill"}</Text>
              </View>
              {searchResults.map((hill, index) => (
                <TouchableOpacity
                  key={`${hill.routeIdentityKey ?? hill.name}-${index}`}
                  style={[st.hillRow, index === searchResults.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => handleSelect(hill)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${hill.name}, ${hill.elevation} metres ascent per climb`}
                >
                  <Text style={st.hillEmoji}>{hill.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={st.hillName}>{hill.name}</Text>
                    <Text style={st.hillSub}>{hill.distance} km away · {hill.surface}</Text>
                  </View>
                  <Text style={st.hillElev}>{hill.routeDataStatus === "terrain_calculated" ? "~" : ""}{hill.elevation}m</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {searchError && (
            <View style={st.searchErrorRow}>
              <AlertCircle size={14} color={T.orange} />
              <Text style={st.searchErrorText}>{searchError}</Text>
            </View>
          )}

          {showOnlineBtn && (
            <TouchableOpacity style={st.onlineSearchBtn} onPress={() => searchOnline("area")} activeOpacity={0.8}>
              <Globe size={14} color={T.blue} />
              <Text style={st.onlineSearchText}>Find hills near "{query.trim()}"</Text>
            </TouchableOpacity>
          )}
          {showOnlineBtn && !looksLikeUkPostcode(query) && (
            <TouchableOpacity style={st.nameSearchBtn} onPress={() => searchOnline("name")} activeOpacity={0.8}>
              <Search size={14} color={T.textMuted} />
              <Text style={st.nameSearchText}>Search by exact hill name</Text>
            </TouchableOpacity>
          )}

          {searching && (
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <ActivityIndicator size="small" color={T.blue} />
              <Text style={[st.hillSub, { marginTop: 8 }]}>Looking up hill data…</Text>
            </View>
          )}

          {filtered.length === 0 && !query.trim() && !searching && !searchError && searchResults.length === 0 ? (
            <View style={st.empty}>
              <MapPin size={28} color={T.textDim} />
              <Text style={st.emptyText}>No nearby hills found</Text>
              <Text style={st.emptyHint}>
                Visit Explore to discover hills near your location, then come back to assign one here.
                {"\n\n"}You can also type any hill name in the search box above to find it directly.
              </Text>
              <TouchableOpacity
                style={st.emptyBtn}
                onPress={() => { handleClose(); router.push("/(tabs)/explore"); }}
                activeOpacity={0.8}
              >
                <Text style={st.emptyBtnText}>Find hills in Explore →</Text>
              </TouchableOpacity>
            </View>
          ) : filtered.length === 0 && query.trim() ? null : (
            <>
              {!query.trim() && (
                <Text style={st.sectionLabel}>Your hills</Text>
              )}
              {filtered.map((hill, i) => (
                <TouchableOpacity
                  key={i}
                  style={st.hillRow}
                  onPress={() => handleSelect(hill)}
                  activeOpacity={0.7}
                >
                  <Text style={st.hillEmoji}>{hill.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={st.hillName}>{hill.name}</Text>
                    <Text style={st.hillSub}>{hill.surface} · {hill.distance}km away</Text>
                  </View>
                  <Text style={st.hillElev}>{hill.routeDataStatus === "terrain_calculated" ? "~" : ""}{hill.elevation}m</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>

        <TouchableOpacity style={st.cancelBtn} onPress={handleClose} activeOpacity={0.7}>
          <Text style={st.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    borderWidth: 1, borderColor: T.border,
    padding: 20, paddingBottom: 36,
  },
  handle: { width: 36, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: "center", marginBottom: 18 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 4 },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginBottom: 12 },
  empty: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  emptyHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center", lineHeight: 18 },
  emptyBtn: {
    marginTop: 4, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 5, backgroundColor: T.greenDim,
    borderWidth: 1, borderColor: T.green + "50",
  },
  emptyBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.green },
  hillRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  hillEmoji: { fontSize: 24 },
  hillName: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.white },
  hillSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },
  hillElev: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.orange },
  cancelBtn: {
    marginTop: 16, paddingVertical: 14, borderRadius: 7,
    borderWidth: 1, borderColor: T.border, alignItems: "center",
  },
  cancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  searchRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface, borderRadius: 13,
    borderWidth: 1, borderColor: T.blue + "40",
    height: 46, marginBottom: 12, gap: 8,
  },
  searchInput: {
    flex: 1, height: 46, fontSize: 14,
    fontFamily: "Inter_400Regular", color: T.white, paddingRight: 4,
  },
  sectionLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textMuted,
    letterSpacing: 0.4, textTransform: "uppercase",
    paddingVertical: 8, paddingHorizontal: 4,
  },
  onlineSearchBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: T.blue + "12", borderRadius: 6,
    borderWidth: 1, borderColor: T.blue + "30",
    paddingHorizontal: 14, paddingVertical: 12, marginVertical: 6,
  },
  onlineSearchText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.blue },
  nameSearchBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 9 },
  nameSearchText: { fontSize: 12, fontFamily: "Inter_500Medium", color: T.textMuted },
  searchResultCard: {
    backgroundColor: T.blue + "0C", borderRadius: 7,
    borderWidth: 1, borderColor: T.blue + "30",
    marginBottom: 8, overflow: "hidden", paddingHorizontal: 8,
  },
  searchResultHeader: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingTop: 10, paddingHorizontal: 4, paddingBottom: 4,
  },
  searchResultLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.blue, letterSpacing: 0.3 },
  searchErrorRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 10, paddingHorizontal: 4,
  },
  searchErrorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.orange, flex: 1 },
});
