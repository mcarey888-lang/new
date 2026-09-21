import {
  MapPin,
  Search,
  X,
  Compass,
  Mountain,
  Map as MapIcon,
  SlidersHorizontal,
  ChevronRight,
  Navigation,
  Route as RouteIcon,
  Activity,
  TrendingUp
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Image
} from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "@/constants/theme";
import { useScreenView } from "@/lib/analytics";
import { CURATED_HILLS, type Trail } from "@/constants/trailData";
import { ModeTogglePill } from "@/components/ModeTogglePill";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const DIFF_COLOR: Record<string, string> = {
  Easy: T.green,
  Moderate: T.blue,
  Hard: T.orange,
};

const FILTERS = ["All", "Mountains", "Hills", "Hard"];
const FILTER_CONFIG: Record<string, { icon: React.ElementType, subtitle: string }> = {
  All: { icon: Mountain, subtitle: `${CURATED_HILLS.length}+` },
  Mountains: { icon: Mountain, subtitle: `${CURATED_HILLS.filter(h => h.terrain === "mountain").length}` },
  Hills: { icon: RouteIcon, subtitle: `${CURATED_HILLS.filter(h => h.terrain === "hill").length}` },
  Hard: { icon: Activity, subtitle: `${CURATED_HILLS.filter(h => h.difficulty === "Hard").length}` },
};

function mountainSubject(name: string) {
  return name
    .replace(/\s+via\s+.+$/i, "")
    .replace(/\s+(North|South)\s+Ridge$/i, "")
    .replace(/\s+Circular$/i, "")
    .replace(/\s+&\s+Great\s+Ridge$/i, "")
    .replace(/^Sca Fell & Scafell Pike Loop$/i, "Scafell Pike")
    .trim();
}

function FallbackImage() {
  return (
    <LinearGradient
      colors={[T.card, T.basecampBg]}
      style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}
    >
      <View style={s.fallbackMark}>
        <Mountain size={26} color={T.green} strokeWidth={1.6} />
        <Text style={s.fallbackBrand}>SUMMITREADY</Text>
        <Text style={s.fallbackLabel}>MOUNTAIN IMAGE UNAVAILABLE</Text>
      </View>
    </LinearGradient>
  );
}

function FeaturedCard({ trail }: { trail: Trail }) {
  const [imgError, setImgError] = useState(false);
  const mountainName = mountainSubject(trail.name);
  const imageUrl = `${API_BASE}/mountain-image?name=${encodeURIComponent(mountainName)}&width=800&height=500`;
  const routeType = trail.routeType === "out-and-back"
    ? "Out & back"
    : trail.routeType === "point-to-point"
      ? "Point-to-point"
      : "Loop";
  const trainingFocus = trail.bestFor[0]
    ? trail.bestFor[0].replace(/\b\w/g, character => character.toUpperCase())
    : null;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={s.featuredCard}
      onPress={() => router.push(`/trail-detail?id=${trail.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Featured route: ${trail.name}, ${trail.location}.`}
    >
      {imgError ? <FallbackImage /> : <Image source={{uri: imageUrl}} style={StyleSheet.absoluteFillObject} onError={() => setImgError(true)} />}
      <LinearGradient colors={['transparent', 'rgba(11,13,17,0.12)', 'rgba(11,13,17,0.78)']} style={StyleSheet.absoluteFillObject} />

      <View style={s.featuredTop}>
         <View style={s.featuredBadge}><Text style={s.featuredBadgeText}>FEATURED</Text></View>
      </View>

      <View style={s.featuredBottom}>
         <View style={s.featuredInfo}>
            <Text style={s.featuredTitle}>{trail.name}</Text>
            <Text style={s.featuredSubtitle}>{trail.elevationGain}m gain • {trail.location}</Text>

            <View style={s.featuredTags}>
              <View style={s.tag}><Activity size={12} color={DIFF_COLOR[trail.difficulty] || T.basecampTextMuted}/><Text style={s.tagText}>{trail.difficulty}</Text></View>
              <View style={s.tag}><RouteIcon size={12} color={T.basecampTextMuted}/><Text style={s.tagText}>{routeType}</Text></View>
              {trainingFocus ? <View style={s.tag}><TrendingUp size={12} color={T.basecampTextMuted}/><Text style={s.tagText}>{trainingFocus}</Text></View> : null}
            </View>
         </View>
         <View style={s.goButton}>
            <ChevronRight size={18} color={T.green} />
         </View>
      </View>
    </TouchableOpacity>
  );
}

function PopularCard({ trail }: { trail: Trail }) {
  const [imgError, setImgError] = useState(false);
  const mountainName = mountainSubject(trail.name);
  const imageUrl = `${API_BASE}/mountain-image?name=${encodeURIComponent(mountainName)}&width=400&height=600`;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={s.popularCard}
      onPress={() => router.push(`/trail-detail?id=${trail.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${trail.name}. Difficulty: ${trail.difficulty}.`}
    >
      {imgError ? <FallbackImage /> : <Image source={{uri: imageUrl}} style={StyleSheet.absoluteFillObject} onError={() => setImgError(true)} />}
      <LinearGradient colors={['rgba(11,13,17,0.04)', 'rgba(11,13,17,0.82)']} style={StyleSheet.absoluteFillObject} />

      <View style={s.popularTop}>
        <View style={s.terrainBadge}><Mountain size={13} color={T.white} /></View>
      </View>

      <View style={s.popularBottom}>
        <Text style={s.popularTitle} numberOfLines={1}>{trail.name}</Text>
        <Text style={s.popularSubtitle}>{trail.elevationGain}m</Text>
        <View style={s.popularTag}>
           <Activity size={12} color={DIFF_COLOR[trail.difficulty] || T.green} />
           <Text style={[s.popularTagText, {color: T.basecampTextMuted}]}>{trail.difficulty}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function LandscapeMountainRow({ trail, index, reducedMotion }: { trail: Trail, index: number, reducedMotion: boolean }) {
  const [imgError, setImgError] = useState(false);
  const mountainName = mountainSubject(trail.name);
  const imageUrl = `${API_BASE}/mountain-image?name=${encodeURIComponent(mountainName)}&width=800&height=500`;
  const routeCharacter = [
    trail.terrain.charAt(0).toUpperCase() + trail.terrain.slice(1),
    trail.routeType === "out-and-back" ? "Out & back" : trail.routeType === "point-to-point" ? "Point-to-point" : "Loop",
  ].join(" • ");

  const Content = (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push(`/trail-detail?id=${trail.id}`)}
      style={s.resultCard}
      accessibilityRole="button"
      accessibilityLabel={`${trail.name}, ${trail.location}. Difficulty: ${trail.difficulty}.`}
    >
      <View style={s.resultImageWrapper}>
         {imgError ? (
           <FallbackImage />
         ) : (
           <Image source={{ uri: imageUrl }} style={s.resultImage} onError={() => setImgError(true)} accessible={false} />
         )}
         <LinearGradient colors={['transparent', 'rgba(11,13,17,0.42)', 'rgba(11,13,17,0.86)']} style={StyleSheet.absoluteFillObject} />

         <View style={s.resultImageContent}>
             <View style={s.resultHeader}>
                <Text style={s.resultTitle} numberOfLines={2}>{trail.name}</Text>
                <View style={s.resultChevron}><ChevronRight size={16} color={T.green}/></View>
             </View>
            <Text style={s.resultLocation} numberOfLines={1}>{trail.location}</Text>

            <View style={s.resultStats}>
               <View style={s.resultStat}><TrendingUp size={14} color={T.basecampTextMuted}/><Text style={s.resultStatText}>{trail.elevationGain}m</Text></View>
               <View style={s.resultStat}><Navigation size={14} color={T.basecampTextMuted}/><Text style={s.resultStatText}>{trail.distance}km</Text></View>
               <View style={s.resultStat}><Activity size={14} color={DIFF_COLOR[trail.difficulty] || T.basecampTextMuted}/><Text style={[s.resultStatText, {color: DIFF_COLOR[trail.difficulty] || T.basecampTextMuted}]}>{trail.difficulty}</Text></View>
            </View>
             <Text style={s.resultCharacter} numberOfLines={1}>{routeCharacter}</Text>
         </View>
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
  const { width: screenWidth } = useWindowDimensions();
  const reducedMotion = useReducedMotion() ?? false;

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [heroImgError, setHeroImgError] = useState(false);

  const isSearchActive = searchQuery.trim().length > 0 || activeFilter !== "All";

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

    return list;
  }, [searchQuery, activeFilter]);

  const featuredTrails = useMemo(() => [
    CURATED_HILLS.find(h => h.id === "h004") || CURATED_HILLS[0],
    CURATED_HILLS.find(h => h.id === "h002") || CURATED_HILLS[1],
  ], []);

  const popularTrails = useMemo(() => [
    CURATED_HILLS.find(h => h.id === "h005") || CURATED_HILLS[2],
    CURATED_HILLS.find(h => h.id === "h016") || CURATED_HILLS[3],
    CURATED_HILLS.find(h => h.id === "h003") || CURATED_HILLS[4],
    CURATED_HILLS.find(h => h.id === "h018") || CURATED_HILLS[5],
  ], []);

  const heroImageUrl = `${API_BASE}/mountain-image?name=Helvellyn&width=1000&height=800`;

  return (
    <View style={{ flex: 1, backgroundColor: T.basecampBg }}>
      {/* Background stays anchored top for parallax effect */}
      <View style={s.heroBgContainer}>
        {heroImgError ? (
          <FallbackImage />
        ) : (
          <Image
            source={{ uri: heroImageUrl }}
            style={StyleSheet.absoluteFillObject}
            onError={() => setHeroImgError(true)}
            accessible={false}
          />
        )}
        <LinearGradient
          colors={['rgba(11,13,17,0.08)', 'rgba(11,13,17,0.58)', T.basecampBg]}
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={s.header}>
          <View style={s.logoContainer}>
            <Mountain color={T.basecampText} size={22} strokeWidth={2.5} />
            {screenWidth >= 430 ? (
              <View style={s.logoTextContainer}>
                <Text style={s.logoTitle}>SUMMITREADY</Text>
                <Text style={s.logoSubtitle}>TRAIN MORE. GO FURTHER.</Text>
              </View>
            ) : null}
          </View>
          <ModeTogglePill embedded />
          <View style={s.headerActions}>
            <TouchableOpacity
              style={s.iconButton}
              onPress={() => router.push("/trail-list")}
              accessibilityRole="button"
              accessibilityLabel="Browse all routes"
            >
              <MapIcon size={18} color={T.basecampText} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.iconButton}
              onPress={() => setActiveFilter(activeFilter === "Hard" ? "All" : "Hard")}
              accessibilityRole="button"
              accessibilityLabel={activeFilter === "Hard" ? "Show all routes" : "Filter hard routes"}
              accessibilityState={{ selected: activeFilter === "Hard" }}
            >
              <SlidersHorizontal size={18} color={activeFilter === "Hard" ? T.green : T.basecampText} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.heroTextContainer}>
          <Text style={s.heroEyebrow}>EXPLORE</Text>
          <Text style={s.heroTitle}>Discover{'\n'}Your Next Peak</Text>
          <Text style={s.heroDesc}>Real mountains. Real routes. Real progress.</Text>
        </View>

        <View style={s.searchContainer}>
          <Search size={18} color={T.basecampTextMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search mountains, regions or countries..."
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
            const config = FILTER_CONFIG[f] || FILTER_CONFIG.All;
            const Icon = config.icon;
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
                <Icon size={24} color={isActive ? T.green : T.basecampTextMuted} style={s.filterIcon} />
                <Text style={[s.filterText, isActive && s.filterTextActive]}>{f}</Text>
                <Text style={s.filterSubtitle}>{config.subtitle}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={s.contentSection}>
          {isSearchActive ? (
            <View style={s.listContainer}>
              <Text style={s.resultsCount}>
                {filteredHills.length} Results
              </Text>

              {filteredHills.length === 0 ? (
                <View style={s.emptyState}>
                  <MapPin size={32} color={T.basecampTextDim} />
                  <Text style={s.emptyStateText}>No routes found.</Text>
                </View>
              ) : (
                <View style={s.resultsGrid}>
                  {filteredHills.map((hill, i) => (
                    <LandscapeMountainRow key={hill.id} trail={hill} index={i} reducedMotion={reducedMotion} />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <>
              <View style={s.sectionHeaderRow}>
                <Text style={s.sectionTitle}>Featured Mountains</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={s.viewAllButton}
                  onPress={() => router.push("/trail-list")}
                  accessibilityRole="button"
                  accessibilityLabel="View all mountain routes"
                >
                  <Text style={s.viewAllBtn}>View all</Text>
                  <ChevronRight size={14} color={T.basecampTextMuted} />
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalListPad}>
                {featuredTrails.map(t => <FeaturedCard key={t.id} trail={t} />)}
              </ScrollView>

              <View style={[s.sectionHeaderRow, { marginTop: 32 }]}>
                <Text style={s.sectionTitle}>Mountain Routes</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={s.viewAllButton}
                  onPress={() => router.push("/trail-list")}
                  accessibilityRole="button"
                  accessibilityLabel="View all mountain routes"
                >
                  <Text style={s.viewAllBtn}>View all</Text>
                  <ChevronRight size={14} color={T.basecampTextMuted} />
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalListPad}>
                {popularTrails.map((t) => <PopularCard key={t.id} trail={t} />)}
              </ScrollView>

              <View style={[s.sectionHeaderRow, { marginTop: 32 }]}>
                <Text style={s.sectionTitle}>Explore by Map</Text>
              </View>
              <Text style={s.sectionSubtitle}>Find nearby hills and routes for your next training day.</Text>

              <View style={{ paddingHorizontal: 18 }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={s.mapPreviewCard}
                  onPress={() => router.push("/hills-finder")}
                  accessibilityRole="button"
                  accessibilityLabel="Open nearby hill finder"
                >
                  <LinearGradient colors={[T.card, T.bg]} style={StyleSheet.absoluteFillObject} />

                  <MapPin size={24} color={T.green} style={{position: 'absolute', left: '20%', top: '30%'}} />
                  <MapPin size={18} color={T.green} style={{position: 'absolute', left: '55%', top: '50%'}} />
                  <MapPin size={20} color={T.green} style={{position: 'absolute', left: '80%', top: '25%'}} />

                  <View style={s.openMapPill}>
                    <MapIcon size={16} color={T.white} />
                    <Text style={s.openMapPillText}>Open Map</Text>
                    <ChevronRight size={16} color={T.white} />
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  fallbackMark: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  fallbackBrand: {
    color: T.basecampText,
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.1,
  },
  fallbackLabel: {
    color: T.basecampTextMuted,
    fontSize: 7,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  heroBgContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 550,
    zIndex: 0,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 32,
    minHeight: 40,
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoTextContainer: { justifyContent: 'center' },
  logoTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.basecampText, letterSpacing: 1 },
  logoSubtitle: { fontSize: 8, fontFamily: "Inter_500Medium", color: T.basecampTextMuted, letterSpacing: 0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center'
  },
  heroTextContainer: {
    paddingHorizontal: 18,
    marginBottom: 20,
  },
  heroEyebrow: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: T.basecampTextMuted,
    letterSpacing: 2,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    color: T.basecampText,
    lineHeight: 38,
    marginBottom: 10,
  },
  heroDesc: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: T.basecampTextMuted,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 52,
    marginHorizontal: 18,
    marginBottom: 24,
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
  filterScroll: {
    paddingHorizontal: 18,
    gap: 8,
    paddingRight: 18
  },
  filterChip: {
    width: 82,
    height: 96,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  filterChipActive: {
    backgroundColor: 'rgba(62,207,117,0.08)',
    borderColor: 'rgba(62,207,117,0.4)',
  },
  filterIcon: { marginBottom: 8 },
  filterText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: T.basecampText,
    marginBottom: 2,
  },
  filterTextActive: {
    color: T.basecampText,
  },
  filterSubtitle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: T.basecampTextDim,
  },
  contentSection: {
    paddingTop: 32,
    paddingBottom: 40,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: T.basecampText,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: T.basecampTextMuted,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 44,
    paddingLeft: 12,
  },
  viewAllBtn: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: T.basecampTextMuted,
  },
  horizontalListPad: {
    paddingHorizontal: 18,
    paddingRight: 36,
  },
  featuredCard: {
    width: 320,
    height: 210,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 16,
    backgroundColor: T.basecampSurfaceHover,
  },
  featuredTop: { padding: 16 },
  featuredBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featuredBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: T.white,
    letterSpacing: 1,
  },
  featuredBottom: {
    position: 'absolute',
    bottom: 16, left: 16, right: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  featuredInfo: { flex: 1, paddingRight: 16 },
  featuredTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 4 },
  featuredSubtitle: { fontSize: 13, fontFamily: "Inter_500Medium", color: 'rgba(255,255,255,0.7)', marginBottom: 12 },
  featuredTags: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  tag: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  tagText: { fontSize: 11, fontFamily: "Inter_500Medium", color: 'rgba(255,255,255,0.6)' },
  goButton: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.5, borderColor: T.green,
    alignItems: 'center', justifyContent: 'center'
  },
  popularCard: {
    width: 140,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: T.basecampSurfaceHover,
  },
  popularTop: { padding: 10, alignItems: 'flex-end' },
  terrainBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  popularBottom: {
    position: 'absolute', bottom: 12, left: 12, right: 12,
  },
  popularTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 2 },
  popularSubtitle: { fontSize: 12, fontFamily: "Inter_500Medium", color: 'rgba(255,255,255,0.7)', marginBottom: 6 },
  popularTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  popularTagText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  mapPreviewCard: {
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 40,
    backgroundColor: T.basecampSurfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openMapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11,13,17,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  openMapPillText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: T.white,
  },
  listContainer: {
    paddingHorizontal: 18,
    gap: 16,
  },
  resultsCount: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: T.basecampTextMuted,
    marginBottom: 4,
  },
  resultsGrid: {
    gap: 12,
  },
  resultCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: T.basecampSurfaceHover,
    height: 220,
    borderWidth: 1,
    borderColor: T.basecampBorder,
  },
  resultImageWrapper: { flex: 1 },
  resultImage: { ...StyleSheet.absoluteFillObject },
  resultImageContent: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
  },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  resultTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.white, flex: 1 },
  resultLocation: { fontSize: 13, fontFamily: "Inter_500Medium", color: 'rgba(255,255,255,0.7)', marginBottom: 12 },
  resultChevron: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(11,13,17,0.72)', alignItems: 'center', justifyContent: 'center' },
  resultStats: { flexDirection: 'row', gap: 16 },
  resultStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultStatText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.basecampTextMuted },
  resultCharacter: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.66)", marginTop: 8 },
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
