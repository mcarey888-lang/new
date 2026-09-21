import {
  MapPin,
  Search,
  X,
  Compass
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image
} from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "@/constants/theme";
import { useScreenView } from "@/lib/analytics";
import { CURATED_HILLS, type Trail } from "@/constants/trailData";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const DIFF_COLOR: Record<string, string> = {
  Easy: T.green,
  Moderate: T.blue,
  Hard: T.orange,
};

const FILTERS = ["All", "Mountains", "Hills", "Hard"];

function FallbackImage() {
  return (
    <LinearGradient
      colors={[T.basecampSurfaceHover, T.basecampBg]}
      style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}
    >
      <Compass size={40} color={T.basecampTextDim} opacity={0.3} />
    </LinearGradient>
  );
}

function CompactMountainRow({ trail, index, reducedMotion }: { trail: Trail, index: number, reducedMotion: boolean }) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = `${API_BASE}/mountain-image?name=${encodeURIComponent(trail.name)}&width=300&height=300&routeIdentityKey=${encodeURIComponent(trail.id)}${trail.lat != null ? `&lat=${trail.lat}` : ""}${trail.lng != null ? `&lng=${trail.lng}` : ""}`;

  const routeCharacter = [
    trail.terrain ? trail.terrain.charAt(0).toUpperCase() + trail.terrain.slice(1) : null,
    trail.routeType === "out-and-back" ? "Out & back" : trail.routeType === "loop" ? "Loop" : trail.routeType === "point-to-point" ? "Point-to-point" : null
  ].filter(Boolean).join(" • ");

  const Content = (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push(`/trail-detail?id=${trail.id}`)}
      style={s.rowCard}
      accessibilityRole="button"
      accessibilityLabel={`${trail.name}, ${trail.location}. Difficulty: ${trail.difficulty}.`}
    >
      <View style={s.rowImageContainer}>
        {imgError ? (
          <FallbackImage />
        ) : (
          <Image source={{ uri: imageUrl }} style={s.rowImage} onError={() => setImgError(true)} accessible={false} />
        )}
      </View>
      <View style={s.rowContent}>
        <Text style={s.rowName} numberOfLines={1}>{trail.name}</Text>
        <Text style={s.rowLocation} numberOfLines={1}>{trail.location}</Text>

        <View style={s.rowMetrics}>
          <Text style={[s.rowDiff, { color: DIFF_COLOR[trail.difficulty] || T.basecampTextMuted }]}>
            {trail.difficulty}
          </Text>
          <Text style={s.metricDot}>·</Text>
          <Text style={s.rowMetricText}>{trail.distance}km</Text>
          <Text style={s.metricDot}>·</Text>
          <Text style={s.rowMetricText}>{trail.elevationGain}m</Text>
        </View>

        {routeCharacter ? (
          <Text style={s.rowCharacter} numberOfLines={1}>{routeCharacter}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  if (reducedMotion) {
    return Content;
  }

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 30, 300)).duration(400)}>
      {Content}
    </Animated.View>
  );
}

export default function ExploreScreen() {
  useScreenView("explore");
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion() ?? false;

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [featuredImgError, setFeaturedImgError] = useState(false);

  const featuredTrail = useMemo(() => CURATED_HILLS.find(h => h.id === "h004") || CURATED_HILLS[0], []);

  const filteredHills = useMemo(() => {
    let list = CURATED_HILLS;

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      list = list.filter(h =>
        h.name.toLowerCase().includes(q) ||
        h.location.toLowerCase().includes(q) ||
        (h.region && h.region.toLowerCase().includes(q))
      );
    }

    if (activeFilter !== "All") {
       if (activeFilter === "Mountains") list = list.filter(h => h.terrain === "mountain");
       if (activeFilter === "Hills") list = list.filter(h => h.terrain === "hill");
       if (activeFilter === "Hard") list = list.filter(h => h.difficulty === "Hard");
    }

    if (searchQuery.trim().length === 0 && activeFilter === "All") {
      list = list.filter(h => h.id !== featuredTrail.id);
    }

    return list;
  }, [searchQuery, activeFilter, featuredTrail]);

  const isSearchActive = searchQuery.trim().length > 0 || activeFilter !== "All";
  const featuredMountainName = featuredTrail.name.split(/\s+via\s+/i)[0].trim();
  const featuredImageUrl = `${API_BASE}/mountain-image?name=${encodeURIComponent(featuredMountainName)}&width=1000&height=800`;

  return (
    <View style={{ flex: 1, backgroundColor: T.basecampBg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={[s.leadContainer, { paddingTop: Platform.OS === "web" ? 60 : insets.top + 16 }]}>
          {!isSearchActive && (
            <View style={StyleSheet.absoluteFill}>
              {featuredImgError ? (
                <FallbackImage />
              ) : (
                <Image
                  source={{ uri: featuredImageUrl }}
                  style={StyleSheet.absoluteFill}
                  onError={() => setFeaturedImgError(true)}
                  accessible={false}
                />
              )}
              <LinearGradient
                colors={["rgba(11,13,17,0.7)", "rgba(11,13,17,0.4)", T.basecampBg]}
                style={StyleSheet.absoluteFill}
              />
            </View>
          )}

          <View style={s.leadContent}>
            <Text style={s.headerTitle}>Find your mountain</Text>

            <View style={s.searchContainer}>
              <Search size={18} color={T.basecampTextMuted} />
              <TextInput
                style={s.searchInput}
                placeholder="Search routes or regions..."
                placeholderTextColor={T.basecampTextDim}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                clearButtonMode="while-editing"
                accessibilityLabel="Search routes or regions"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  style={s.clearBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <X size={16} color={T.basecampTextMuted} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
              {FILTERS.map(f => {
                const isActive = activeFilter === f;
                return (
                  <TouchableOpacity
                    key={f}
                    style={[s.filterChip, isActive && s.filterChipActive]}
                    onPress={() => setActiveFilter(f)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={`Filter by ${f}`}
                  >
                    <Text style={[s.filterText, isActive && s.filterTextActive]}>{f}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {!isSearchActive && (
              <TouchableOpacity
                style={s.featuredRouteContent}
                activeOpacity={0.8}
                onPress={() => router.push(`/trail-detail?id=${featuredTrail.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Featured route: ${featuredTrail.name}`}
              >
                <Text style={s.featuredEyebrow}>FEATURED DISCOVERY</Text>
                <Text style={s.featuredName}>{featuredTrail.name}</Text>
                <View style={s.featuredMetrics}>
                  <Text style={s.featuredMetricText}>{featuredTrail.region || featuredTrail.location}</Text>
                  <Text style={s.metricDot}>·</Text>
                  <Text style={s.featuredMetricText}>{featuredTrail.elevationGain}m</Text>
                  <Text style={s.metricDot}>·</Text>
                  <Text style={[s.featuredMetricText, { color: DIFF_COLOR[featuredTrail.difficulty] || T.basecampText }]}>{featuredTrail.difficulty}</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={s.listContainer}>
          <Text style={s.sectionTitle}>
            {isSearchActive ? `${filteredHills.length} Results` : "More Routes"}
          </Text>

          {filteredHills.length === 0 ? (
            <View style={s.emptyState}>
              <MapPin size={32} color={T.basecampTextDim} />
              <Text style={s.emptyStateText}>No routes found.</Text>
            </View>
          ) : (
            <View style={s.resultsGrid}>
              {filteredHills.map((hill, i) => (
                <CompactMountainRow key={hill.id} trail={hill} index={i} reducedMotion={reducedMotion} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  leadContainer: {
    position: 'relative',
  },
  leadContent: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: T.basecampText,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.basecampSurface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: T.basecampBorder,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: 10,
    color: T.basecampText,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  clearBtn: { padding: 4 },
  filterScroll: { gap: 8, paddingBottom: 4 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: T.basecampSurface,
    borderWidth: 1,
    borderColor: T.basecampBorder,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: T.basecampText,
    borderColor: T.basecampText,
  },
  filterText: {
    color: T.basecampTextMuted,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  filterTextActive: {
    color: T.basecampBg,
    fontFamily: "Inter_600SemiBold",
  },
  featuredRouteContent: {
    marginTop: 48,
    marginBottom: 10,
  },
  featuredEyebrow: {
    color: T.green,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  featuredName: {
    color: T.basecampText,
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  featuredMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  featuredMetricText: {
    color: T.basecampText,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  metricDot: {
    fontSize: 14,
    color: T.basecampTextDim,
  },
  listContainer: {
    paddingHorizontal: 18,
    paddingTop: 16,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: T.basecampText,
    marginBottom: 4,
  },
  resultsGrid: {
    gap: 12,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.basecampSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.basecampBorder,
    padding: 10,
    gap: 14,
  },
  rowImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: T.basecampSurfaceHover,
  },
  rowImage: {
    width: '100%',
    height: '100%',
  },
  rowContent: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
  },
  rowName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: T.basecampText,
  },
  rowLocation: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.basecampTextMuted,
  },
  rowMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  rowDiff: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  rowMetricText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: T.basecampTextMuted,
  },
  rowCharacter: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: T.basecampTextDim,
    marginTop: 2,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.basecampSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.basecampBorder,
    gap: 12,
    marginTop: 8,
  },
  emptyStateText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: T.basecampTextMuted,
  },
});
