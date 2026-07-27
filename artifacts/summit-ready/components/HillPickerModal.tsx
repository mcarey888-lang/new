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

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

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

  const showOnlineBtn = query.trim().length >= 2 && !searching && !searchResult;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={handleClose} />
      <View style={st.sheet}>
        <View style={st.handle} />
        <Text style={st.title}>Choose a Hill</Text>

        <View style={st.searchRow}>
          <Search size={15} color={T.textMuted} style={{ marginLeft: 12 }} />
          <TextInput
            style={st.searchInput}
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

          {searchResult && (
            <View style={st.searchResultCard}>
              <View style={st.searchResultHeader}>
                <Globe size={12} color={T.blue} />
                <Text style={st.searchResultLabel}>Online result</Text>
              </View>
              <TouchableOpacity
                style={[st.hillRow, { borderBottomWidth: 0 }]}
                onPress={() => handleSelect(searchResult)}
                activeOpacity={0.7}
              >
                <Text style={st.hillEmoji}>{searchResult.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.hillName}>{searchResult.name}</Text>
                  <Text style={st.hillSub}>{searchResult.surface} · {searchResult.grade} grade</Text>
                </View>
                <View style={st.hillStats}>
                  <Text style={st.hillElev}>{searchResult.elevation}m</Text>
                  <Text style={st.hillReps}>×{searchResult.repeats}</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {searchError && (
            <View style={st.searchErrorRow}>
              <AlertCircle size={14} color={T.orange} />
              <Text style={st.searchErrorText}>{searchError}</Text>
            </View>
          )}

          {showOnlineBtn && (
            <TouchableOpacity style={st.onlineSearchBtn} onPress={searchOnline} activeOpacity={0.8}>
              {searching ? (
                <ActivityIndicator size="small" color={T.blue} />
              ) : (
                <Globe size={14} color={T.blue} />
              )}
              <Text style={st.onlineSearchText}>
                {searching ? "Searching…" : `Search online for "${query.trim()}"`}
              </Text>
            </TouchableOpacity>
          )}

          {searching && (
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <ActivityIndicator size="small" color={T.blue} />
              <Text style={[st.hillSub, { marginTop: 8 }]}>Looking up hill data…</Text>
            </View>
          )}

          {filtered.length === 0 && !query.trim() ? (
            <View style={st.empty}>
              <MapPin size={28} color={T.textDim} />
              <Text style={st.emptyText}>No nearby hills found</Text>
              <Text style={st.emptyHint}>
                Visit the Hills tab to discover hills near your location, then come back to assign one here.
                {"\n\n"}You can also type any hill name in the search box above to find it directly.
              </Text>
              <TouchableOpacity
                style={st.emptyBtn}
                onPress={() => { onClose(); router.push("/(tabs)/hills"); }}
                activeOpacity={0.8}
              >
                <Text style={st.emptyBtnText}>Go to Hills tab →</Text>
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
                  <View style={st.hillStats}>
                    <Text style={st.hillElev}>{hill.elevation}m</Text>
                    <Text style={st.hillReps}>×{hill.repeats}</Text>
                  </View>
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
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: T.border,
    padding: 20, paddingBottom: 36,
  },
  handle: { width: 36, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: "center", marginBottom: 18 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 4 },
  empty: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  emptyHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center", lineHeight: 18 },
  emptyBtn: {
    marginTop: 4, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10, backgroundColor: T.greenDim,
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
  hillStats: { alignItems: "flex-end" },
  hillElev: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.orange },
  hillReps: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  cancelBtn: {
    marginTop: 16, paddingVertical: 14, borderRadius: 14,
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
    backgroundColor: T.blue + "12", borderRadius: 12,
    borderWidth: 1, borderColor: T.blue + "30",
    paddingHorizontal: 14, paddingVertical: 12, marginVertical: 6,
  },
  onlineSearchText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.blue },
  searchResultCard: {
    backgroundColor: T.blue + "0C", borderRadius: 14,
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
