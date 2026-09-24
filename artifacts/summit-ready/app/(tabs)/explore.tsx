/**
 * EXPLORE — discovery.
 *
 * Rebuilt to the approved Explore prototype: a photographic hero the page
 * scrolls out of, a search field, terrain filters, a Featured rail, a Popular
 * rail and the map entry.
 */
import React, { useMemo, useState, useEffect } from "react";
import {
  Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput,
  useWindowDimensions, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronRight, Compass, Map as MapIcon, MapPin, Mountain as MountainIcon,
  Route as RouteIcon, Search, TrendingUp, X, Activity
} from "lucide-react-native";
import { BASECAMP, EXPLORE, HIT, SP, TYPE } from "@/constants/tokens";
import { SREmptyState, SRPanel, SRSectionHeader } from "@/components/ui";
import { ModeTogglePill } from "@/components/ModeTogglePill";
import { useScreenView } from "@/lib/analytics";
import { CURATED_HILLS, type Trail } from "@/constants/trailData";
import { resolveApprovedTabHeroArtwork } from "@/utils/artworkResolver";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const DIFF_TONE: Record<string, string> = {
  Easy: EXPLORE.verified,
  Moderate: EXPLORE.verified,
  Hard: EXPLORE.unverified,
};

type FilterId = "all" | "mountains" | "hills" | "loops" | "moderate" | "hard";

const FILTERS: { id: FilterId; label: string; icon: React.ElementType; match: (t: Trail) => boolean }[] = [
  { id: "all", label: "All peaks", icon: Compass, match: () => true },
  { id: "mountains", label: "Mountains", icon: MountainIcon, match: t => t.terrain === "mountain" },
  { id: "hills", label: "Hills", icon: TrendingUp, match: t => t.terrain === "hill" },
  { id: "loops", label: "Loops", icon: RouteIcon, match: t => t.routeType === "loop" },
  { id: "moderate", label: "Moderate", icon: Activity, match: t => t.difficulty === "Moderate" },
  { id: "hard", label: "Hard", icon: Activity, match: t => t.difficulty === "Hard" },
];

function mountainSubject(name: string): string {
  return name
    .replace(/\s+via\s+.+$/i, "")
    .replace(/\s+(North|South|East|West)\s+Ridge$/i, "")
    .replace(/\s+Circular$/i, "")
    .replace(/\s+&\s+Great\s+Ridge$/i, "")
    .replace(/\s+Loop$/i, "")
    .trim();
}

function openMountain(trail: Trail) {
  router.push({
    pathname: "/mountain" as any,
    params: {
      name: mountainSubject(trail.name),
      ...(trail.region ? { region: trail.region } : {}),
    },
  });
}

function imageUri(trail: Trail, width: number, height: number) {
  return `${API_BASE}/mountain-image?name=${encodeURIComponent(mountainSubject(trail.name))}`
    + `&location=${encodeURIComponent(trail.location)}&width=${width}&height=${height}`;
}

function Fallback() {
  return (
    <LinearGradient
      colors={["#1B2C2A", "#0F1A1D", BASECAMP.ink]}
      style={[StyleSheet.absoluteFill, styles.fallback]}
    >
      <MountainIcon size={24} color={BASECAMP.textDim} strokeWidth={1.5} />
    </LinearGradient>
  );
}

function FeaturedCard({ trail }: { trail: Trail }) {
  const [failed, setFailed] = useState(false);

  return (
    <Pressable
      onPress={() => openMountain(trail)}
      accessibilityRole="button"
      accessibilityLabel={`${trail.name}, ${trail.location}. ${trail.elevationGain} metres of ascent. ${trail.difficulty}.`}
      style={styles.featured}
    >
      {failed
        ? <Fallback />
        : <Image source={{ uri: imageUri(trail, 800, 1070) }} style={StyleSheet.absoluteFill}
                 onError={() => setFailed(true)} accessible={false} />}
      <LinearGradient
        colors={["rgba(5,9,11,0)", "rgba(5,9,11,0)", "rgba(5,9,11,0.88)", "#05090B"]}
        locations={[0, 0.4, 0.85, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.featuredBody}>
        <View style={styles.featuredType}>
          <View style={styles.featuredTypeIcon}>
            <RouteIcon size={10} color={BASECAMP.textStrong} />
          </View>
          <Text style={styles.featuredTypeText}>{trail.terrain}</Text>
        </View>
        <Text style={styles.featuredName} numberOfLines={2}>{trail.name}</Text>
        <Text style={styles.featuredMeta} numberOfLines={1}>{trail.location}</Text>

        <View style={styles.featuredTags}>
          <View style={styles.tagPill}>
            <TrendingUp size={10} color={DIFF_TONE[trail.difficulty] ?? BASECAMP.textDim} />
            <Text style={styles.tagPillText}>{trail.difficulty}</Text>
          </View>
          <View style={styles.tagPill}>
            <Activity size={10} color={BASECAMP.textDim} />
            <Text style={styles.tagPillText}>{trail.elevationGain}m</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function PopularCard({ trail }: { trail: Trail }) {
  const [failed, setFailed] = useState(false);

  return (
    <Pressable
      onPress={() => openMountain(trail)}
      accessibilityRole="button"
      accessibilityLabel={`${trail.name}. ${trail.elevationGain} metres of ascent. ${trail.difficulty}.`}
      style={styles.popular}
    >
      <View style={styles.popularImage}>
        {failed
          ? <Fallback />
          : <Image source={{ uri: imageUri(trail, 360, 440) }} style={StyleSheet.absoluteFill}
                   onError={() => setFailed(true)} accessible={false} />}

      </View>
      <Text style={styles.popularName} numberOfLines={2}>{trail.name}</Text>
      <Text style={styles.popularMeta} numberOfLines={1}>{trail.location}</Text>
      <View style={styles.popularStats}>
        <TrendingUp size={10} color={DIFF_TONE[trail.difficulty] ?? BASECAMP.textDim} />
        <Text style={[styles.popularDiff, { color: DIFF_TONE[trail.difficulty] ?? BASECAMP.textDim }]} numberOfLines={1}>
          {trail.difficulty}
        </Text>
      </View>
    </Pressable>
  );
}

function ResultRow({ trail }: { trail: Trail }) {
  const [failed, setFailed] = useState(false);
  return (
    <SRPanel
      radius={15}
      onPress={() => openMountain(trail)}
      accessibilityLabel={`${trail.name}, ${trail.location}. ${trail.elevationGain} metres of ascent. ${trail.difficulty}.`}
      style={styles.result}
    >
      <View style={styles.resultRow}>
        <View style={styles.resultImage}>
          {failed
            ? <Fallback />
            : <Image source={{ uri: imageUri(trail, 220, 200) }} style={StyleSheet.absoluteFill}
                     onError={() => setFailed(true)} accessible={false} />}
        </View>
        <View style={styles.resultBody}>
          <Text style={styles.resultName} numberOfLines={2}>{trail.name}</Text>
          <Text style={styles.resultPlace} numberOfLines={1}>{trail.location}</Text>
          <View style={styles.resultStats}>
            <View style={styles.resultTag}>
              <TrendingUp size={11} color={BASECAMP.textDim} />
              <Text style={styles.resultTagText}>{trail.elevationGain.toLocaleString()} m</Text>
            </View>
            <View style={styles.resultTag}>
              <RouteIcon size={11} color={BASECAMP.textDim} />
              <Text style={styles.resultTagText}>{trail.distance} km</Text>
            </View>
            <View style={styles.resultTag}>
              <Compass size={11} color={DIFF_TONE[trail.difficulty] ?? BASECAMP.textDim} />
              <Text style={styles.resultTagText}>{trail.difficulty}</Text>
            </View>
          </View>
        </View>
        <ChevronRight size={15} color={BASECAMP.textFaint} />
      </View>
    </SRPanel>
  );
}

export default function ExploreScreen() {
  useScreenView("explore");
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion() ?? false;

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [heroFailed, setHeroFailed] = useState(false);
  const [heroUri, setHeroUri] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    resolveApprovedTabHeroArtwork("explore").then(res => {
      if (mounted && res?.uri) {
        setHeroFailed(false);
        setHeroUri(res.uri);
      }
    });
    return () => { mounted = false; };
  }, []);

  const { width } = useWindowDimensions();
  const compactBrand = width < 400;

  const searching = query.trim().length > 0 || filter !== "all";

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matcher = FILTERS.find(f => f.id === filter)?.match ?? (() => true);
    return CURATED_HILLS.filter(trail =>
      matcher(trail) && (
        q.length === 0 ||
        trail.name.toLowerCase().includes(q) ||
        trail.location.toLowerCase().includes(q) ||
        (trail.region?.toLowerCase().includes(q) ?? false)
      ));
  }, [query, filter]);

  const featured = useMemo(
    () => CURATED_HILLS.filter(t => t.terrain === "mountain").slice(0, 5),
    [],
  );
  const popular = useMemo(() => CURATED_HILLS.slice(0, 8), []);

  const topPad = Platform.OS === "web" ? 67 : Math.max(insets.top, 18);
  const Section = reducedMotion ? View : Animated.View;

  return (
    <View style={styles.screen}>
      <View style={styles.heroBg} pointerEvents="none">
        {!heroFailed ? (
          <Image
            source={heroUri ? { uri: heroUri } : require("../../assets/images/hero-base-camp.png")}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => {
              if (heroUri) setHeroUri(null);
              else setHeroFailed(true);
            }}
            accessible={false}
          />
        ) : <Fallback />}

        <LinearGradient
          colors={["rgba(5,9,11,0.74)", "rgba(5,9,11,0.26)", "rgba(5,9,11,0.48)", "rgba(5,9,11,0.92)", BASECAMP.ink]}
          locations={[0, 0.2, 0.52, 0.84, 1]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["rgba(5,9,11,0.92)", "rgba(5,9,11,0.52)", "rgba(5,9,11,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          locations={[0, 0.4, 0.76]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: 120 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* ── App bar ──────────────────────────────────────────────────── */}
        <View style={[styles.gutter, styles.appBar]}>
          <View style={styles.brand} accessible accessibilityLabel="SummitReady">
            <MountainIcon size={20} color={BASECAMP.text} strokeWidth={2.2} />
            {compactBrand ? null : (
              <View style={styles.brandText}>
                <Text style={styles.brandName} numberOfLines={1}>SUMMITREADY</Text>
                <Text style={styles.brandTag} numberOfLines={1}>TRAIN MORE. GO FURTHER.</Text>
              </View>
            )}
          </View>
          <View style={styles.appBarActions}>
            <ModeTogglePill embedded />
            <Pressable
              onPress={() => router.push("/hills-finder" as any)}
              accessibilityRole="button"
              accessibilityLabel="Find hills near you"
              hitSlop={HIT.slop}
              style={styles.iconButton}
            >
              <MapIcon size={14} color={BASECAMP.textStrong} />
            </Pressable>
          </View>
        </View>

        {/* ── Discovery ─────────────────────────────────────────────────── */}
        <View style={styles.heroCopy}>
          <Text style={styles.heroKicker}>EXPLORE</Text>
          <Text style={styles.heroTitle}>Discover your next peak</Text>
          <Text style={styles.heroSub}>Find a mountain and a route worth the journey.</Text>
          <View style={styles.search}>
            <Search size={13} color={BASECAMP.textDim} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search peaks, regions..."
              placeholderTextColor={BASECAMP.textDim}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              accessibilityLabel="Search peaks, regions"
            />
            {query.length > 0 ? (
              <Pressable
                onPress={() => setQuery("")}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={HIT.slop}
              >
                <X size={14} color={BASECAMP.textDim} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* ── Filter chips ─────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          accessibilityRole="tablist"
        >
          {FILTERS.map(f => {
            const on = f.id === filter;
            const Icon = f.icon;
            const count = CURATED_HILLS.filter(f.match).length;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={f.label}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Icon size={24} color={on ? EXPLORE.accent : "rgba(255,255,255,0.85)"} />
                <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>
                  {f.label}
                </Text>
                <Text style={styles.chipCount}>{count}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {searching ? (
          /* ── Results ───────────────────────────────────────────────── */
          <Section
            entering={reducedMotion ? undefined : FadeInDown.duration(320)}
            style={styles.resultsSection}
          >
            <View style={styles.gutter}>
              <SRSectionHeader title={`${results.length} ${results.length === 1 ? "result" : "results"}`} />
            </View>
            {results.length === 0 ? (
              <SREmptyState
                icon={<MapPin size={20} color={BASECAMP.textDim} />}
                title="Nothing matches that"
                body="Try a mountain name, a region, or clear the filters to browse the catalogue."
                action="Clear filters"
                onAction={() => { setQuery(""); setFilter("all"); }}
                style={styles.gutter}
              />
            ) : (
              <View style={[styles.gutter, styles.resultList]}>
                {results.map(trail => <ResultRow key={trail.id} trail={trail} />)}
              </View>
            )}
          </Section>
        ) : (
          <>
            {/* ── Featured ────────────────────────────────────────────── */}
            <Section
              entering={reducedMotion ? undefined : FadeInDown.delay(60).duration(360)}
              style={styles.railSection}
            >
              <View style={styles.gutter}>
                <SRSectionHeader
                  title="Featured mountains"
                  action="View all"
                  onAction={() => router.push("/trail-list" as any)}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railLarge}>
                {featured.map(trail => <FeaturedCard key={trail.id} trail={trail} />)}
              </ScrollView>
            </Section>

            {/* ── Popular ─────────────────────────────────────────────── */}
            <Section
              entering={reducedMotion ? undefined : FadeInDown.delay(110).duration(360)}
              style={styles.railSection}
            >
              <View style={styles.gutter}>
                <SRSectionHeader
                  title="Popular mountains"
                  action="View all"
                  onAction={() => router.push("/trail-list" as any)}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railSmall}>
                {popular.map(trail => <PopularCard key={trail.id} trail={trail} />)}
              </ScrollView>
            </Section>

            {/* ── Map ─────────────────────────────────────────────────── */}
            <Section
              entering={reducedMotion ? undefined : FadeInDown.delay(160).duration(360)}
              style={[styles.gutter, styles.mapSection]}
            >
              <SRSectionHeader title="Explore by Map" />
              <Text style={styles.mapSub}>Browse mountains and routes on an interactive map.</Text>
              <SRPanel
                radius={15}
                onPress={() => router.push("/hills-finder" as any)}
                accessibilityLabel="Find hills near you"
                style={styles.mapCard}
              >
                <LinearGradient
                  colors={["#123240", "#0E2632", BASECAMP.ink]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.mapPins} pointerEvents="none">
                  <MapPin size={15} color={EXPLORE.verified} style={{ marginLeft: 6 }} />
                  <MapPin size={12} color={EXPLORE.verified} style={{ marginTop: 18, marginLeft: 22 }} />
                  <MapPin size={13} color={EXPLORE.verified} style={{ marginTop: -6, marginLeft: 20 }} />
                </View>
                <View style={styles.mapPill}>
                  <MapIcon size={13} color={BASECAMP.text} />
                  <Text style={styles.mapPillText}>Open Map</Text>
                  <ChevronRight size={12} color={BASECAMP.textDim} />
                </View>
              </SRPanel>
            </Section>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BASECAMP.ink },
  gutter: { paddingHorizontal: 21 },
  heroBg: { position: "absolute", left: 0, right: 0, top: 0, height: 285 },

  appBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SP.sm },
  brand: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1, minWidth: 0 },
  brandText: { flexShrink: 1, minWidth: 0 },
  brandName: { fontSize: 10.5, lineHeight: 13, fontFamily: "Inter_700Bold", letterSpacing: 1.5, color: BASECAMP.text },
  brandTag: { marginTop: 2, fontSize: 6, lineHeight: 8, fontFamily: "Inter_600SemiBold", letterSpacing: 1.9, color: BASECAMP.textDim },
  appBarActions: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  iconButton: {
    width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: BASECAMP.glass, borderWidth: 1, borderColor: BASECAMP.glassBorder,
  },

  heroCopy: { marginTop: 34, paddingHorizontal: BASECAMP.gutter },
  heroKicker: { ...TYPE.eyebrow, color: BASECAMP.accent, marginBottom: 6 },
  heroTitle: { ...TYPE.hero, color: BASECAMP.text, maxWidth: 300 },
  heroSub: { ...TYPE.body, color: BASECAMP.textMuted, marginTop: 9, maxWidth: 280 },

  segmentedControlWrap: { marginTop: 18 },
  segmentedControl: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    padding: 2.5, borderRadius: 999,
    backgroundColor: BASECAMP.glass, borderWidth: 1, borderColor: BASECAMP.glassBorder,
  },
  segBtn: {
    position: "relative", paddingHorizontal: 14, paddingVertical: 6,
    justifyContent: "center", alignItems: "center"
  },
  segActiveBg: {
    position: "absolute", top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 999,
  },
  segText: {
    fontSize: 11, lineHeight: 13, fontFamily: "Inter_500Medium", color: BASECAMP.textDim
  },
  segTextActive: {
    fontFamily: "Inter_600SemiBold", color: BASECAMP.text
  },

  search: {
    marginTop: 15, height: 34, borderRadius: 999,
    flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14,
    backgroundColor: BASECAMP.glass, borderWidth: 1, borderColor: BASECAMP.glassBorder,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 12, lineHeight: 15, fontFamily: "Inter_400Regular", color: BASECAMP.text },

  chipRow: { paddingHorizontal: 21, gap: 8, paddingTop: 20 },
  chip: {
    width: 62, height: 72, borderRadius: 13,
    alignItems: "center", paddingTop: 10, paddingHorizontal: 3,
    backgroundColor: "rgba(255,255,255,0.035)", borderWidth: 1, borderColor: "rgba(255,255,255,0.085)",
  },
  chipOn: {
    backgroundColor: "rgba(36,239,164,0.08)", borderColor: "rgba(36,239,164,0.65)"
  },
  chipLabel: { marginTop: 4, fontSize: 9.5, lineHeight: 11, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.88)", textAlign: "center" },
  chipLabelOn: { color: EXPLORE.accent },
  chipCount: { marginTop: 1, fontSize: 10, lineHeight: 11, color: "rgba(255,255,255,0.42)", textAlign: "center" },

  railSection: { marginTop: 24 },
  railLarge: { paddingHorizontal: 21, gap: 14, paddingTop: 8 },
  railSmall: { paddingHorizontal: 21, gap: 14, paddingTop: 8 },

  featured: {
    width: 254, height: 340, borderRadius: 18, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "#12202A",
  },
  favBtn: {
    position: "absolute", top: 12, right: 12,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: BASECAMP.glass, borderWidth: 1, borderColor: BASECAMP.glassBorder,
    alignItems: "center", justifyContent: "center"
  },
  featuredBody: { position: "absolute", left: 16, right: 16, bottom: 16 },
  featuredType: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  featuredTypeIcon: {
    width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: BASECAMP.glass, borderWidth: 1, borderColor: BASECAMP.glassBorder
  },
  featuredTypeText: { fontSize: 10, lineHeight: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: 0.2 },
  featuredName: { fontSize: 20, lineHeight: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.2, color: BASECAMP.text },
  featuredMeta: { marginTop: 4, fontSize: 12, lineHeight: 15, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },
  featuredTags: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tagPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 7, paddingVertical: 4.5, borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)"
  },
  tagPillText: { fontSize: 10, lineHeight: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)" },

  popular: { width: 114 },
  popularImage: {
    width: 114, height: 142, borderRadius: 14, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "#12202A",
    marginBottom: 8
  },
  favBtnSmall: {
    position: "absolute", top: 8, right: 8,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: BASECAMP.glass, borderWidth: 1, borderColor: BASECAMP.glassBorder,
    alignItems: "center", justifyContent: "center"
  },
  popularName: { marginTop: 2, fontSize: 11, lineHeight: 13, fontFamily: "Inter_700Bold", color: BASECAMP.text, letterSpacing: -0.1 },
  popularMeta: { marginTop: 3, fontSize: 10.5, lineHeight: 12, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },
  popularStats: { marginTop: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  popularDiff: { fontSize: 9.5, lineHeight: 11, fontFamily: "Inter_500Medium" },

  resultsSection: { marginTop: 24 },
  resultList: { marginTop: 10, gap: 9 },
  result: {},
  resultRow: { flexDirection: "row", alignItems: "center", gap: 11, padding: 10 },
  resultImage: {
    width: 68, height: 62, borderRadius: 11, overflow: "hidden",
    backgroundColor: "#12202A", flexShrink: 0,
  },
  resultBody: { flex: 1, minWidth: 0 },
  resultName: { ...TYPE.bodyBold, fontSize: 13.5, lineHeight: 17, color: BASECAMP.text },
  resultPlace: { marginTop: 2, ...TYPE.caption, fontSize: 10.5, color: BASECAMP.textDim },
  resultStats: { marginTop: 5, flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 2 },
  resultTag: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1, minWidth: 0 },
  resultTagText: { ...TYPE.caption, fontSize: 10.5, color: BASECAMP.textMuted, flexShrink: 1 },

  mapSection: { marginTop: 18 },
  mapSub: { marginTop: 2, ...TYPE.caption, fontSize: 11.5, color: BASECAMP.textDim },
  mapCard: { marginTop: 8, height: 76, justifyContent: "center" },
  mapPins: { ...StyleSheet.absoluteFillObject, flexDirection: "row", alignItems: "center", paddingLeft: 12 },
  mapPill: {
    position: "absolute", right: 11, alignSelf: "center",
    minHeight: 32, borderRadius: 999, paddingHorizontal: 12,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.7)", borderWidth: 1, borderColor: BASECAMP.glassBorder,
  },
  mapPillText: { ...TYPE.smallBold, fontSize: 11.5, color: BASECAMP.text },

  fallback: { alignItems: "center", justifyContent: "center" },
});
