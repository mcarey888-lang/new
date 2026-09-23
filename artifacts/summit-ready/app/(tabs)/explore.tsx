/**
 * EXPLORE — discovery.
 *
 * Rebuilt to the approved Explore prototype: a photographic hero the page
 * scrolls out of, a search field, terrain filters, a Featured rail, a Popular
 * rail and the map entry.
 *
 * ── WHERE EVERY CARD LEADS ────────────────────────────────────────────────
 * Every mountain here opens the SAME decision surface — `app/mountain.tsx` —
 * addressed by name plus region, which that screen resolves against the
 * canonical catalogue. It is the Mountain Detail screen that decides whether
 * a mountain is verified, what routes it has and what may be done with them.
 * Explore makes no claim about verification, because it cannot know one.
 *
 * ── WHAT THE LISTS ARE ────────────────────────────────────────────────────
 * `CURATED_HILLS` is SummitReady's existing curated catalogue of real UK
 * hills. It is production data, not prototype filler, and it carries no
 * canonical identity — which is exactly why a card carries a name and a
 * region rather than an identity it does not have.
 *
 * Nothing here is ranked by engagement, because SummitReady records none.
 * "Popular" is the curated catalogue's own ordering, not a fabricated count.
 */
import React, { useMemo, useState } from "react";
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
  Route as RouteIcon, Search, TrendingUp, X,
} from "lucide-react-native";
import { BASECAMP, EXPLORE, HIT, SP, TYPE } from "@/constants/tokens";
import { SREmptyState, SREyebrow, SRPanel, SRSectionHeader } from "@/components/ui";
import { ModeTogglePill } from "@/components/ModeTogglePill";
import { useScreenView } from "@/lib/analytics";
import { CURATED_HILLS, type Trail } from "@/constants/trailData";

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
  { id: "all", label: "All", icon: MountainIcon, match: () => true },
  { id: "mountains", label: "Mountains", icon: MountainIcon, match: t => t.terrain === "mountain" },
  { id: "hills", label: "Hills", icon: TrendingUp, match: t => t.terrain === "hill" },
  { id: "loops", label: "Loops", icon: RouteIcon, match: t => t.routeType === "loop" },
  { id: "moderate", label: "Moderate", icon: Compass, match: t => t.difficulty === "Moderate" },
  { id: "hard", label: "Hard", icon: Compass, match: t => t.difficulty === "Hard" },
];

/**
 * The mountain a route belongs to.
 *
 * Curated entries name a route ("Snowdon via the Pyg Track"), and the
 * Mountain Detail screen resolves a MOUNTAIN. This strips the route clause so
 * the lookup is asked about the mountain — it is a display-string tidy-up for
 * a query, never an identity, and the lookup still decides what it matches.
 */
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

/** The designed gradient a card falls back to. Never a broken-image box. */
function Fallback({ compact = false }: { compact?: boolean }) {
  return (
    <LinearGradient
      colors={["#1B2C2A", "#0F1A1D", BASECAMP.ink]}
      style={[StyleSheet.absoluteFill, styles.fallback]}
    >
      <MountainIcon size={compact ? 18 : 24} color={BASECAMP.textDim} strokeWidth={1.5} />
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
        : <Image source={{ uri: imageUri(trail, 800, 460) }} style={StyleSheet.absoluteFill}
                 onError={() => setFailed(true)} accessible={false} />}
      <LinearGradient
        colors={["rgba(5,9,11,0.05)", "rgba(5,9,11,0.62)", "rgba(5,9,11,0.94)"]}
        locations={[0.32, 0.66, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.featuredBody}>
        <Text style={styles.featuredName} numberOfLines={2}>{trail.name}</Text>
        <Text style={styles.featuredMeta} numberOfLines={1}>
          {`${trail.elevationGain.toLocaleString()} m ascent · ${trail.location}`}
        </Text>
        <View style={styles.featuredTags}>
          <Tag icon={<TrendingUp size={11} color={DIFF_TONE[trail.difficulty] ?? BASECAMP.textDim} />}
               label={trail.difficulty} />
          <Tag icon={<RouteIcon size={11} color={BASECAMP.textDim} />}
               label={`${trail.distance} km`} />
        </View>
      </View>
      <View style={styles.featuredGo}>
        <ChevronRight size={14} color={EXPLORE.accent} />
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
          ? <Fallback compact />
          : <Image source={{ uri: imageUri(trail, 360, 320) }} style={StyleSheet.absoluteFill}
                   onError={() => setFailed(true)} accessible={false} />}
        <LinearGradient
          colors={["rgba(5,9,11,0)", "rgba(5,9,11,0.5)"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>
      <Text style={styles.popularName} numberOfLines={2}>{trail.name}</Text>
      <Text style={styles.popularMeta} numberOfLines={1}>
        {`${trail.elevationGain.toLocaleString()} m`}
      </Text>
      <Text style={[styles.popularDiff, { color: DIFF_TONE[trail.difficulty] ?? BASECAMP.textDim }]} numberOfLines={1}>
        {trail.difficulty}
      </Text>
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
            ? <Fallback compact />
            : <Image source={{ uri: imageUri(trail, 220, 200) }} style={StyleSheet.absoluteFill}
                     onError={() => setFailed(true)} accessible={false} />}
        </View>
        <View style={styles.resultBody}>
          <Text style={styles.resultName} numberOfLines={2}>{trail.name}</Text>
          <Text style={styles.resultPlace} numberOfLines={1}>{trail.location}</Text>
          <View style={styles.resultStats}>
            <Tag icon={<TrendingUp size={11} color={BASECAMP.textDim} />}
                 label={`${trail.elevationGain.toLocaleString()} m`} />
            <Tag icon={<RouteIcon size={11} color={BASECAMP.textDim} />}
                 label={`${trail.distance} km`} />
            <Tag icon={<Compass size={11} color={DIFF_TONE[trail.difficulty] ?? BASECAMP.textDim} />}
                 label={trail.difficulty} />
          </View>
        </View>
        <ChevronRight size={15} color={BASECAMP.textFaint} />
      </View>
    </SRPanel>
  );
}

function Tag({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.tag}>
      {icon}
      <Text style={styles.tagText} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export default function ExploreScreen() {
  useScreenView("explore");
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion() ?? false;

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [heroFailed, setHeroFailed] = useState(false);
  /* The wordmark, the mode toggle and the finder button do not all fit on a
     narrow phone. Below 400pt the lockup reduces to its mark rather than
     wrapping "SUMMITREADY" across two lines — the same rule Basecamp uses. */
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

  /* The curated catalogue's own ordering. Not an engagement ranking — there
     is no such data in SummitReady and none is invented here. */
  const featured = useMemo(
    () => CURATED_HILLS.filter(t => t.terrain === "mountain").slice(0, 3),
    [],
  );
  const popular = useMemo(() => CURATED_HILLS.slice(0, 6), []);

  const topPad = Platform.OS === "web" ? 18 : insets.top + 8;
  const Section = reducedMotion ? View : Animated.View;

  return (
    <View style={styles.screen}>
      {/* The hero photograph stays anchored while the page scrolls out of it. */}
      <View style={styles.heroBg} pointerEvents="none">
        {!heroFailed ? (
          <Image
            source={require("../../assets/images/hero-base-camp.png")}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setHeroFailed(true)}
            accessible={false}
          />
        ) : null}
        <LinearGradient
          colors={["rgba(5,9,11,0.55)", "rgba(5,9,11,0.22)", "rgba(5,9,11,0.72)", BASECAMP.ink]}
          locations={[0, 0.24, 0.72, 1]}
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

        {/* ── Hero copy and search ─────────────────────────────────────── */}
        <View style={[styles.gutter, styles.heroCopy]}>
          <SREyebrow>EXPLORE</SREyebrow>
          <Text style={styles.heroTitle}>{"Discover\nYour Next Peak"}</Text>
          <Text style={styles.heroSub}>Real mountains. Real routes. Real progress.</Text>

          <View style={styles.search}>
            <Search size={14} color={BASECAMP.textDim} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search mountains, regions or places"
              placeholderTextColor={BASECAMP.textFaint}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              accessibilityLabel="Search mountains, regions or places"
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
                accessibilityLabel={`${f.label}, ${count} in the catalogue`}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Icon size={22} color={on ? EXPLORE.verified : BASECAMP.textStrong} />
                <Text style={[styles.chipLabel, on && { color: EXPLORE.verified }]} numberOfLines={2}>
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
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
                  title="From the catalogue"
                  action="View all"
                  onAction={() => router.push("/trail-list" as any)}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                {popular.map(trail => <PopularCard key={trail.id} trail={trail} />)}
              </ScrollView>
            </Section>

            {/* ── Map ─────────────────────────────────────────────────── */}
            <Section
              entering={reducedMotion ? undefined : FadeInDown.delay(160).duration(360)}
              style={[styles.gutter, styles.mapSection]}
            >
              <SRSectionHeader title="Hills near you" />
              <Text style={styles.mapSub}>Find real hills and routes around your training base.</Text>
              <SRPanel
                radius={15}
                onPress={() => router.push("/hills-finder" as any)}
                accessibilityLabel="Find hills near you"
                style={styles.mapCard}
              >
                <LinearGradient
                  colors={["#12303F", "#0D2029", BASECAMP.ink]}
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
                  <Text style={styles.mapPillText}>Open finder</Text>
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
  gutter: { paddingHorizontal: BASECAMP.gutter },
  heroBg: { position: "absolute", left: 0, right: 0, top: 0, height: 300 },

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

  heroCopy: { marginTop: 46 },
  heroTitle: { marginTop: 7, ...TYPE.hero, fontSize: 28, lineHeight: 30, color: BASECAMP.text },
  heroSub: { marginTop: 7, ...TYPE.small, fontSize: 12.5, color: BASECAMP.textMuted },
  search: {
    marginTop: 10, minHeight: 40, borderRadius: 999,
    flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14,
    backgroundColor: BASECAMP.glass, borderWidth: 1, borderColor: BASECAMP.glassBorder,
  },
  searchInput: { flex: 1, minWidth: 0, ...TYPE.small, color: BASECAMP.text, paddingVertical: SP.sm },

  chipRow: { paddingHorizontal: BASECAMP.gutter, gap: 6, paddingTop: 14 },
  chip: {
    width: 64, minHeight: 74, borderRadius: 13, alignItems: "center",
    paddingTop: 10, paddingHorizontal: 3, paddingBottom: 6,
    backgroundColor: "rgba(255,255,255,0.035)", borderWidth: 1, borderColor: "rgba(255,255,255,0.085)",
  },
  chipOn: { backgroundColor: BASECAMP.accentDim, borderColor: BASECAMP.accentLine },
  chipLabel: { marginTop: 4, fontSize: 9.5, lineHeight: 11, fontFamily: "Inter_600SemiBold", color: BASECAMP.textStrong, textAlign: "center" },
  chipCount: { marginTop: 1, fontSize: 10, lineHeight: 11, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },

  railSection: { marginTop: 16 },
  rail: { paddingHorizontal: BASECAMP.gutter, gap: 8, paddingTop: 8 },

  featured: {
    width: 272, height: 164, borderRadius: 16, overflow: "hidden",
    borderWidth: 1, borderColor: BASECAMP.panelBorder, backgroundColor: "#12202A",
  },
  featuredBody: { position: "absolute", left: 14, right: 14, bottom: 13 },
  featuredName: { fontSize: 20, lineHeight: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.4, color: BASECAMP.text },
  featuredMeta: { marginTop: 3, ...TYPE.caption, fontSize: 11.5, color: BASECAMP.textMuted },
  featuredTags: { marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  featuredGo: {
    position: "absolute", right: 13, top: 13,
    width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: EXPLORE.accentDim, borderWidth: 1, borderColor: EXPLORE.accentLine,
  },

  popular: { width: 100 },
  popularImage: {
    width: 100, height: 84, borderRadius: 13, overflow: "hidden",
    borderWidth: 1, borderColor: BASECAMP.panelBorder, backgroundColor: "#12202A",
  },
  popularName: { marginTop: 5, fontSize: 11, lineHeight: 13, fontFamily: "Inter_700Bold", color: BASECAMP.text },
  popularMeta: { marginTop: 3, fontSize: 10.5, lineHeight: 12, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },
  popularDiff: { marginTop: 1, fontSize: 9.5, lineHeight: 11, fontFamily: "Inter_600SemiBold" },

  resultsSection: { marginTop: 18 },
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

  tag: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1, minWidth: 0 },
  tagText: { ...TYPE.caption, fontSize: 10.5, color: BASECAMP.textMuted, flexShrink: 1 },

  mapSection: { marginTop: 18 },
  mapSub: { marginTop: 2, ...TYPE.caption, fontSize: 11.5, color: BASECAMP.textDim },
  mapCard: { marginTop: 8, height: 78, justifyContent: "center" },
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
