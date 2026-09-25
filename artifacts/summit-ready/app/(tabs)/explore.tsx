/**
 * EXPLORE — discovery.
 *
 * Rebuilt to the approved Explore prototype: a photographic hero the page
 * scrolls out of, a search field, terrain filters, a Featured rail, a Popular
 * rail and the map entry.
 */
import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput,
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
import { useScreenView } from "@/lib/analytics";
import { CURATED_HILLS, type Trail } from "@/constants/trailData";
import { resolveApprovedTabHeroArtwork } from "@/utils/artworkResolver";
import { createExploreAiRequestGuard } from "@/utils/exploreRequestGuard";

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
      // Curated display regions are broad labels, not verified catalogue
      // regions. Exact region filtering can hide an otherwise unique match.
    },
  });
}

type DiscoveryItem = {
  id: string;
  name: string;
  country?: string;
  region?: string;
  area?: string;
  elevationM?: number;
  latitude?: number;
  longitude?: number;
  source: "catalogue" | "ai";
  verificationStatus: "verified" | "imported" | "ai_unverified";
};

type DiscoveryResponse = {
  items: DiscoveryItem[];
  hasMore: boolean;
  catalogueStatus: "available";
};

function openDiscoveryMountain(item: DiscoveryItem) {
  router.push({
    pathname: "/mountain" as any,
    params: {
      name: item.name,
      ...(item.region ? { region: item.region } : {}),
      ...(item.country ? { country: item.country } : {}),
      ...(item.source === "ai" ? { discoveryId: item.id } : { catalogueId: item.id }),
    },
  });
}

function discoveryImageUri(item: DiscoveryItem, width: number, height: number) {
  const location = [item.region, item.country].filter(Boolean).join(", ");
  return `${API_BASE}/mountain-image?name=${encodeURIComponent(item.name)}`
    + `&location=${encodeURIComponent(location)}&width=${width}&height=${height}`;
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
        : <Image source={{ uri: imageUri(trail, 520, 480) }} style={StyleSheet.absoluteFill}
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
          : <Image source={{ uri: imageUri(trail, 240, 200) }} style={StyleSheet.absoluteFill}
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
      radius={7.5}
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

function DiscoveryResultRow({ item }: { item: DiscoveryItem }) {
  const [failed, setFailed] = useState(false);
  const place = [item.region, item.country].filter(Boolean).join(", ");
  const statusLabel = item.verificationStatus === "verified"
    ? "Verified catalogue"
    : item.verificationStatus === "imported"
      ? "Imported · not verified"
      : "AI suggestion · not verified";
  return (
    <SRPanel
      radius={7.5}
      onPress={() => openDiscoveryMountain(item)}
      accessibilityLabel={`${item.name}${place ? `, ${place}` : ""}. ${statusLabel}.`}
      style={styles.result}
    >
      <View style={styles.resultRow}>
        <View style={styles.resultImage}>
          {failed
            ? <Fallback />
            : <Image source={{ uri: discoveryImageUri(item, 220, 200) }} style={StyleSheet.absoluteFill}
                     onError={() => setFailed(true)} accessible={false} />}
        </View>
        <View style={styles.resultBody}>
          <Text style={styles.resultName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.resultPlace} numberOfLines={1}>{place || item.area || "Location not recorded"}</Text>
          <View style={styles.resultStats}>
            {typeof item.elevationM === "number" && Number.isFinite(item.elevationM) ? (
              <View style={styles.resultTag}>
                <TrendingUp size={11} color={BASECAMP.textDim} />
                <Text style={styles.resultTagText}>{Math.round(item.elevationM).toLocaleString()} m elevation</Text>
              </View>
            ) : null}
            <Text style={[
              styles.discoveryStatus,
              item.verificationStatus === "verified" ? styles.discoveryVerified : styles.discoveryUnverified,
            ]}>{statusLabel}</Text>
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
  const [discoveryItems, setDiscoveryItems] = useState<DiscoveryItem[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [catalogueSearched, setCatalogueSearched] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [catalogueUnavailable, setCatalogueUnavailable] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNoResult, setAiNoResult] = useState(false);
  const requestId = useRef(0);
  const aiRequestGuard = useMemo(() => createExploreAiRequestGuard(), []);
  const abortRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedQueryRef = useRef<string | null>(null);
  const latestQuery = useRef("");
  latestQuery.current = query.trim();
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
  const compactBrand = width < 430;

  const textQuery = query.trim();
  const queryTooShort = Array.from(textQuery).length < 2;
  const searching = textQuery.length > 0 || filter !== "all";

  const fetchCatalogue = async (term: string, append = false, committed = false) => {
    aiRequestGuard.invalidate();
    setAiLoading(false);
    const currentRequest = ++requestId.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setDiscoveryLoading(true);
    setCatalogueSearched(false);
    setDiscoveryError(null);
    setCatalogueUnavailable(false);
    try {
      const offset = append ? discoveryItems.length : 0;
      const response = await fetch(
        `${API_BASE}/mountain-discovery?q=${encodeURIComponent(term)}&limit=20&offset=${offset}`,
        { signal: controller.signal },
      );
      if (currentRequest !== requestId.current) return;
      if (response.status === 503) {
        setCatalogueUnavailable(true);
        setDiscoveryError("The mountain catalogue is temporarily unavailable. Try again shortly.");
        setDiscoveryItems([]);
        setHasMore(false);
        return;
      }
      if (!response.ok) throw new Error(`Search failed (${response.status}).`);
      const data = await response.json() as DiscoveryResponse;
      if (currentRequest !== requestId.current) return;
      setDiscoveryItems(current => append ? [...current, ...data.items] : data.items);
      setHasMore(data.hasMore);
      setCatalogueSearched(true);
      setCatalogueUnavailable(false);
      setDiscoveryError(null);
      setAiError(null);
      setAiNoResult(false);
      if (committed && data.items.length === 0) void requestAiSuggestion(term, true);
    } catch (error) {
      if ((error as Error)?.name === "AbortError" || currentRequest !== requestId.current) return;
      setDiscoveryError(error instanceof Error ? error.message : "Search could not be completed.");
      setDiscoveryItems([]);
      setHasMore(false);
    } finally {
      if (currentRequest === requestId.current) setDiscoveryLoading(false);
    }
  };

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (!textQuery) {
      requestId.current += 1;
      abortRef.current?.abort();
      setDiscoveryItems([]);
      setDiscoveryLoading(false);
      setCatalogueSearched(false);
      setDiscoveryError(null);
      setCatalogueUnavailable(false);
      setHasMore(false);
      setAiError(null);
      setAiNoResult(false);
      return;
    }
    if (queryTooShort) {
      requestId.current += 1;
      abortRef.current?.abort();
      setDiscoveryLoading(false);
      setCatalogueSearched(false);
      setDiscoveryItems([]);
      setHasMore(false);
      return;
    }
    if (committedQueryRef.current === textQuery) return;
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void fetchCatalogue(textQuery);
    }, 300);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [textQuery, queryTooShort]);

  useEffect(() => () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    abortRef.current?.abort();
  }, []);

  const submitSearch = () => {
    const term = query.trim();
    if (Array.from(term).length < 2) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    committedQueryRef.current = term;
    void fetchCatalogue(term, false, true);
  };

  const updateQuery = (value: string) => {
    committedQueryRef.current = null;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setQuery(value);
    aiRequestGuard.invalidate();
    requestId.current += 1;
    abortRef.current?.abort();
    setDiscoveryItems([]);
    setDiscoveryLoading(false);
    setCatalogueSearched(false);
    setHasMore(false);
    setDiscoveryError(null);
    setCatalogueUnavailable(false);
    setAiError(null);
    setAiNoResult(false);
    setAiLoading(false);
  };

  const requestAiSuggestion = async (termOverride?: string, afterSuccessfulEmptySearch = false) => {
    const term = termOverride ?? query.trim();
    if (Array.from(term).length < 2 || (!afterSuccessfulEmptySearch &&
        (!catalogueSearched || catalogueUnavailable || discoveryError || discoveryItems.length > 0))) return;
    const currentAiRequest = aiRequestGuard.begin();
    setAiLoading(true);
    setAiError(null);
    setAiNoResult(false);
    try {
      const response = await fetch(`${API_BASE}/mountain-discovery/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: term }),
      });
      if (!aiRequestGuard.isCurrent(currentAiRequest) || latestQuery.current !== term) return;
      if (response.status === 404) {
        setAiNoResult(true);
        return;
      }
      if (response.status === 503) {
        setCatalogueUnavailable(true);
        setDiscoveryError("The mountain catalogue is temporarily unavailable. AI suggestions are unavailable until it returns.");
        return;
      }
      if (response.status === 409) {
        void fetchCatalogue(term);
        return;
      }
      if (!response.ok) throw new Error(`Suggestion request failed (${response.status}).`);
      const data = await response.json() as { item: DiscoveryItem };
      if (!aiRequestGuard.isCurrent(currentAiRequest) || latestQuery.current !== term) return;
      setDiscoveryItems([data.item]);
    } catch (error) {
      if (!aiRequestGuard.isCurrent(currentAiRequest)) return;
      setAiError(error instanceof Error ? error.message : "An AI suggestion could not be loaded.");
    } finally {
      if (aiRequestGuard.isCurrent(currentAiRequest)) setAiLoading(false);
    }
  };

  const results = useMemo(() => {
    const matcher = FILTERS.find(f => f.id === filter)?.match ?? (() => true);
    return CURATED_HILLS.filter(matcher);
  }, [filter]);

  const featured = useMemo(
    () => CURATED_HILLS.filter(t => t.terrain === "mountain").slice(0, 5),
    [],
  );
  const popular = useMemo(() => CURATED_HILLS.slice(0, 8), []);
  const showingAiSuggestion = discoveryItems.some(item => item.source === "ai");

  const topPad = Platform.OS === "web" ? 20 : insets.top + 12;
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
          <View style={styles.brand} accessible={!compactBrand} accessibilityLabel={compactBrand ? undefined : "SummitReady"}>
            {compactBrand ? null : (
              <View style={styles.brandText}>
                <Text style={styles.brandName} numberOfLines={1}>SUMMITREADY</Text>
                <Text style={styles.brandTag} numberOfLines={1}>TRAIN MORE. GO FURTHER.</Text>
              </View>
            )}
          </View>
          <View style={styles.appBarActions}>
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
              onChangeText={updateQuery}
              returnKeyType="search"
              onSubmitEditing={submitSearch}
              accessibilityLabel="Search peaks, regions"
            />
            {query.length > 0 ? (
              <Pressable
                onPress={() => updateQuery("")}
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
              <SRSectionHeader title={queryTooShort
                ? "Search"
                : textQuery
                ? `${discoveryItems.length} ${showingAiSuggestion
                  ? (discoveryItems.length === 1 ? "search result" : "search results")
                  : (discoveryItems.length === 1 ? "catalogue result" : "catalogue results")}`
                : `${results.length} ${results.length === 1 ? "result" : "results"}`} />
            </View>
            {textQuery ? (
              <View style={[styles.gutter, styles.resultList]}>
                {queryTooShort ? (
                  <View
                    accessible
                    accessibilityLiveRegion="polite"
                    accessibilityLabel="Enter at least two characters to search the mountain catalogue. Terrain filters apply only to the curated browse list."
                  >
                    <Text style={styles.shortQueryHint}>
                      Enter at least two characters to search the mountain catalogue. Terrain filters apply only to the curated browse list.
                    </Text>
                  </View>
                ) : (
                  <>
                <Text style={styles.searchScope}>
                  Searching the mountain catalogue. Terrain filters apply only to the curated browse list, not this catalogue search.
                </Text>
                {(discoveryLoading || !catalogueSearched) && discoveryItems.length === 0 && !discoveryError ? (
                  <View style={styles.searchStatus}>
                    <ActivityIndicator size="small" color={EXPLORE.accent} />
                    <Text style={styles.statusText}>Searching mountains…</Text>
                  </View>
                ) : null}
                {discoveryError ? (
                  <View style={styles.errorPanel}>
                    <Text style={styles.errorText}>{discoveryError}</Text>
                    <Pressable onPress={() => void fetchCatalogue(textQuery)} accessibilityRole="button" style={styles.textAction}>
                      <Text style={styles.actionText}>Retry catalogue search</Text>
                    </Pressable>
                  </View>
                ) : null}
                {!discoveryError ? discoveryItems.map(item => (
                  <DiscoveryResultRow key={`${item.source}:${item.id}`} item={item} />
                )) : null}
                {!discoveryLoading && catalogueSearched && !discoveryError && discoveryItems.length === 0 ? (
                  <View style={styles.emptySearch}>
                    <MapPin size={20} color={BASECAMP.textDim} />
                    <Text style={styles.emptyTitle}>No catalogue matches</Text>
                    <Text style={styles.emptyBody}>
                      {catalogueUnavailable
                        ? "AI suggestions are unavailable while the catalogue is down."
                        : "No matching mountain was found in the catalogue."}
                    </Text>
                    {!catalogueUnavailable ? (
                      <>
                        <Pressable
                          onPress={() => void requestAiSuggestion()}
                          disabled={aiLoading}
                          accessibilityRole="button"
                          accessibilityLabel={`Ask AI for an unverified suggestion for ${textQuery}`}
                          style={styles.aiAction}
                        >
                          {aiLoading
                            ? <ActivityIndicator size="small" color={BASECAMP.ink} />
                            : <Text style={styles.aiActionText}>Ask AI for a suggestion</Text>}
                        </Pressable>
                        {aiError ? <Text style={styles.errorText}>{aiError}</Text> : null}
                        {aiNoResult ? <Text style={styles.statusText}>No AI suggestion was available for this query.</Text> : null}
                      </>
                    ) : null}
                  </View>
                ) : null}
                {hasMore && !discoveryError ? (
                  <Pressable
                    onPress={() => void fetchCatalogue(textQuery, true)}
                    disabled={discoveryLoading}
                    accessibilityRole="button"
                    style={styles.loadMore}
                  >
                    {discoveryLoading
                      ? <ActivityIndicator size="small" color={EXPLORE.accent} />
                      : <Text style={styles.actionText}>Load more mountains</Text>}
                  </Pressable>
                ) : null}
                  </>
                )}
              </View>
            ) : results.length === 0 ? (
              <SREmptyState
                icon={<MapPin size={20} color={BASECAMP.textDim} />}
                title="Nothing matches that filter"
                body="These terrain filters apply to the curated browse list. Search by name or region to explore the wider mountain catalogue."
                action="Clear filters"
                onAction={() => setFilter("all")}
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
                radius={7.5}
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
  gutter: { paddingHorizontal: BASECAMP.gutter },
  heroBg: { position: "absolute", left: 0, right: 0, top: 0, height: 262 },

  appBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SP.sm },
  brand: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1, minWidth: 0 },
  brandText: { flexShrink: 1, minWidth: 0 },
  brandName: { fontSize: 10.5, lineHeight: 13, fontFamily: "Inter_700Bold", letterSpacing: 1.5, color: BASECAMP.text },
  brandTag: { marginTop: 2, fontSize: 6, lineHeight: 8, fontFamily: "Inter_600SemiBold", letterSpacing: 1.9, color: BASECAMP.textDim },
  appBarActions: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  iconButton: {
    width: HIT.minTarget, height: HIT.minTarget, borderRadius: 22, alignItems: "center", justifyContent: "center",
    backgroundColor: BASECAMP.glass, borderWidth: 1, borderColor: BASECAMP.glassBorder,
  },

  heroCopy: { marginTop: 12, paddingHorizontal: BASECAMP.gutter },
  heroKicker: { ...TYPE.eyebrow, color: BASECAMP.accent, marginBottom: 4 },
  heroTitle: { ...TYPE.hero, fontSize: 30, lineHeight: 33, color: BASECAMP.text, maxWidth: 330 },
  heroSub: { ...TYPE.body, fontSize: 12.5, lineHeight: 17, color: BASECAMP.textMuted, marginTop: 5, maxWidth: 330 },

  segmentedControlWrap: { marginTop: 18 },
  segmentedControl: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    padding: 2.5, borderRadius: 15,
    backgroundColor: BASECAMP.glass, borderWidth: 1, borderColor: BASECAMP.glassBorder,
  },
  segBtn: {
    position: "relative", paddingHorizontal: 14, paddingVertical: 6,
    justifyContent: "center", alignItems: "center"
  },
  segActiveBg: {
    position: "absolute", top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12.5,
  },
  segText: {
    fontSize: 11, lineHeight: 13, fontFamily: "Inter_500Medium", color: BASECAMP.textDim
  },
  segTextActive: {
    fontFamily: "Inter_600SemiBold", color: BASECAMP.text
  },

  search: {
    marginTop: 10, height: HIT.minTarget, borderRadius: 999,
    flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14,
    backgroundColor: BASECAMP.glass, borderWidth: 1, borderColor: BASECAMP.glassBorder,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 12, lineHeight: 15, fontFamily: "Inter_400Regular", color: BASECAMP.text },

  chipRow: { paddingHorizontal: BASECAMP.gutter, gap: 8, paddingTop: 12 },
  chip: {
    width: 62, height: 62, borderRadius: 6.5,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 3,
    backgroundColor: "rgba(255,255,255,0.035)", borderWidth: 1, borderColor: "rgba(255,255,255,0.085)",
  },
  chipOn: {
    backgroundColor: "rgba(36,239,164,0.08)", borderColor: "rgba(36,239,164,0.65)"
  },
  chipLabel: { marginTop: 4, fontSize: 9.5, lineHeight: 11, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.88)", textAlign: "center" },
  chipLabelOn: { color: EXPLORE.accent },
  chipCount: { marginTop: 1, fontSize: 10, lineHeight: 11, color: "rgba(255,255,255,0.42)", textAlign: "center" },

  railSection: { marginTop: 16 },
  railLarge: { paddingHorizontal: BASECAMP.gutter, gap: 9, paddingTop: 5, paddingBottom: 2 },
  railSmall: { paddingHorizontal: BASECAMP.gutter, gap: 8, paddingTop: 5, paddingBottom: 2 },

  featured: {
    width: 204, height: 188, borderRadius: 9, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "#12202A",
  },
  favBtn: {
    position: "absolute", top: 12, right: 12,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: BASECAMP.glass, borderWidth: 1, borderColor: BASECAMP.glassBorder,
    alignItems: "center", justifyContent: "center"
  },
  featuredBody: { position: "absolute", left: 12, right: 12, bottom: 11 },
  featuredType: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 5 },
  featuredTypeIcon: {
    width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center",
    backgroundColor: BASECAMP.glass, borderWidth: 1, borderColor: BASECAMP.glassBorder
  },
  featuredTypeText: { fontSize: 10, lineHeight: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: 0.2 },
  featuredName: { fontSize: 16, lineHeight: 19, fontFamily: "Inter_700Bold", letterSpacing: -0.2, color: BASECAMP.text },
  featuredMeta: { marginTop: 2, fontSize: 11, lineHeight: 14, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },
  featuredTags: { marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 5 },
  tagPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)"
  },
  tagPillText: { fontSize: 10, lineHeight: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)" },

  popular: { width: 105, minHeight: 135 },
  popularImage: {
    width: 105, height: 83, borderRadius: 7, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "#12202A",
    marginBottom: 4
  },
  favBtnSmall: {
    position: "absolute", top: 8, right: 8,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: BASECAMP.glass, borderWidth: 1, borderColor: BASECAMP.glassBorder,
    alignItems: "center", justifyContent: "center"
  },
  popularName: { marginTop: 1, fontSize: 10.5, lineHeight: 12, fontFamily: "Inter_700Bold", color: BASECAMP.text, letterSpacing: -0.1 },
  popularMeta: { marginTop: 2, fontSize: 10, lineHeight: 12, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },
  popularStats: { marginTop: 2, flexDirection: "row", alignItems: "center", gap: 4 },
  popularDiff: { fontSize: 9.5, lineHeight: 11, fontFamily: "Inter_500Medium" },

  resultsSection: { marginTop: 16 },
  resultList: { marginTop: 10, gap: 9 },
  result: {},
  resultRow: { flexDirection: "row", alignItems: "center", gap: 11, padding: 10 },
  resultImage: {
    width: 68, height: 62, borderRadius: 5.5, overflow: "hidden",
    backgroundColor: "#12202A", flexShrink: 0,
  },
  resultBody: { flex: 1, minWidth: 0 },
  resultName: { ...TYPE.bodyBold, fontSize: 13.5, lineHeight: 17, color: BASECAMP.text },
  resultPlace: { marginTop: 2, ...TYPE.caption, fontSize: 10.5, color: BASECAMP.textDim },
  resultStats: { marginTop: 5, flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 2 },
  resultTag: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1, minWidth: 0 },
  resultTagText: { ...TYPE.caption, fontSize: 10.5, color: BASECAMP.textMuted, flexShrink: 1 },
  discoveryStatus: { ...TYPE.caption, fontSize: 9.5, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  discoveryVerified: { color: EXPLORE.verified },
  discoveryUnverified: { color: EXPLORE.unverified },
  searchScope: { ...TYPE.caption, color: BASECAMP.textDim, marginBottom: 2 },
  shortQueryHint: { ...TYPE.small, color: BASECAMP.textMuted, paddingVertical: SP.sm },
  searchStatus: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: SP.sm },
  statusText: { ...TYPE.caption, color: BASECAMP.textDim },
  errorPanel: { gap: SP.sm, padding: SP.md, borderRadius: 7, backgroundColor: EXPLORE.unverifiedDim, borderWidth: 1, borderColor: EXPLORE.unverifiedLine },
  errorText: { ...TYPE.caption, color: EXPLORE.unverified },
  textAction: { minHeight: 36, justifyContent: "center", alignSelf: "flex-start" },
  actionText: { ...TYPE.smallBold, color: EXPLORE.accent },
  emptySearch: { alignItems: "flex-start", gap: SP.sm, paddingVertical: SP.md },
  emptyTitle: { ...TYPE.bodyBold, color: BASECAMP.text },
  emptyBody: { ...TYPE.caption, color: BASECAMP.textDim },
  aiAction: {
    minHeight: 42, borderRadius: 7, paddingHorizontal: SP.lg,
    alignItems: "center", justifyContent: "center",
    backgroundColor: BASECAMP.accent, alignSelf: "flex-start",
  },
  aiActionText: { ...TYPE.smallBold, color: BASECAMP.ink },
  loadMore: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center" },

  mapSection: { marginTop: 16 },
  mapSub: { marginTop: 2, ...TYPE.caption, fontSize: 11.5, color: BASECAMP.textDim },
  mapCard: { marginTop: 8, height: 76, justifyContent: "center" },
  mapPins: { ...StyleSheet.absoluteFillObject, flexDirection: "row", alignItems: "center", paddingLeft: 12 },
  mapPill: {
    position: "absolute", right: 11, alignSelf: "center",
    minHeight: 32, borderRadius: 16, paddingHorizontal: 12,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.7)", borderWidth: 1, borderColor: BASECAMP.glassBorder,
  },
  mapPillText: { ...TYPE.smallBold, fontSize: 11.5, color: BASECAMP.text },

  fallback: { alignItems: "center", justifyContent: "center" },
});
