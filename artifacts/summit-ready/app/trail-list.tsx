import {
  ArrowLeft, List, LocateFixed, Map, MapPin, Minus, Plus,
  RefreshCw, Search, SlidersHorizontal, X,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TrailMapView, type MappedTrail } from "@/components/TrailMapView";
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
import { router, useLocalSearchParams } from "expo-router";
import { T } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { SAMPLE_TRAILS } from "@/constants/trailData";
import type { Trail, TrailDifficulty, TrailTerrain, TrailBestFor, TrailRouteType } from "@/constants/trailData";
import { TrailCard } from "@/components/TrailCard";
import { loadSeededTrails } from "@/utils/seededTrailsCache";

const LAST_TRAIL_LOCATION_KEY = "summitready_last_trail_location";

function formatTimeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

type Difficulty = TrailDifficulty | "All";
type Terrain = TrailTerrain | "All";
type BestFor = TrailBestFor | "All";
type RouteType = TrailRouteType | "All";

const DIFFICULTIES: Difficulty[] = ["All", "Easy", "Moderate", "Hard"];
const TERRAINS: Terrain[] = ["All", "woodland", "hill", "mountain", "coastal", "road", "mixed"];
const BEST_FOR: BestFor[] = ["All", "training", "family walk", "summit prep", "scenic walk"];
const ROUTE_TYPES: RouteType[] = ["All", "loop", "out-and-back", "point-to-point"];

const RADIUS_STEPS = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
const ELEVATION_STEPS = [null, 50, 100, 150, 200, 300, 500];
const DURATION_STEPS = [null, 1, 2, 3, 4, 5, 6, 8];
const DISTANCE_STEPS = [null, 5, 10, 15, 20, 30, 40];

interface LatLng {
  latitude: number;
  longitude: number;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocodeLocationString(place: string): Promise<LatLng | null> {
  if (Platform.OS === "web") {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}&limit=1`,
        { headers: { "User-Agent": "SummitReady/1.0" } },
      );
      const data = await r.json() as Array<{ lat: string; lon: string }>;
      if (data.length > 0) {
        return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
      }
    } catch { /* ignore */ }
    return null;
  }
  try {
    const results = await Location.geocodeAsync(place);
    if (results.length > 0) {
      return { latitude: results[0].latitude, longitude: results[0].longitude };
    }
  } catch { /* ignore */ }
  return null;
}

function parseDurationHours(time: string): number {
  const h = time.match(/(\d+)h/);
  const m = time.match(/(\d+)m/);
  return (h ? parseInt(h[1]) : 0) + (m ? parseInt(m[1]) / 60 : 0);
}

function stepperLabel<T>(val: T, formatter: (v: NonNullable<T>) => string): string {
  return val == null ? "Any" : formatter(val as NonNullable<T>);
}

function Chip<T extends string>({ label, active, onPress }: { label: T; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipActive]} activeOpacity={0.75}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FilterRow<T extends string>({ label, options, value, onChange }: {
  label: string; options: T[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={s.filterRow}>
      <Text style={s.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {options.map((o) => (
          <Chip key={o} label={o} active={value === o} onPress={() => onChange(o)} />
        ))}
      </ScrollView>
    </View>
  );
}

function StepperRow({
  icon, label, value, onDecrement, onIncrement,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View style={s.stepperRow}>
      <View style={s.stepperLabelWrap}>
        {icon}
        <Text style={s.stepperLabel}>{label}</Text>
      </View>
      <View style={s.stepperCtrl}>
        <TouchableOpacity onPress={onDecrement} style={s.stepperBtn} hitSlop={6}>
          <Minus size={13} color={T.text} />
        </TouchableOpacity>
        <Text style={s.stepperVal}>{value}</Text>
        <TouchableOpacity onPress={onIncrement} style={s.stepperBtn} hitSlop={6}>
          <Plus size={13} color={T.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TrailListScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string }>();
  const { savedTrailIds, completedTrailIds, customRoutes, summitGoal, trainingPlan } = useApp();

  const currentWeek = useMemo(
    () => trainingPlan.find((w) => w.isCurrentWeek) ?? null,
    [trainingPlan]
  );

  function isGoodForWeek(trail: Trail): boolean {
    if (!currentWeek) return false;
    const target = currentWeek.targetElevation;
    if (target <= 0) return false;
    return trail.elevationGain >= target * 0.5 && trail.elevationGain <= target * 2.5;
  }

  const [query, setQuery] = useState(params.q ?? "");
  const [locationQuery, setLocationQuery] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [difficulty, setDifficulty] = useState<Difficulty>("All");
  const [terrain, setTerrain] = useState<Terrain>("All");
  const [bestFor, setBestFor] = useState<BestFor>("All");
  const [routeType, setRouteType] = useState<RouteType>("All");

  const [radius, setRadius] = useState(30);
  const [minElevation, setMinElevation] = useState<number | null>(null);
  const [maxDuration, setMaxDuration] = useState<number | null>(null);
  const [maxDistance, setMaxDistance] = useState<number | null>(null);

  const [seededTrails, setSeededTrails] = useState<Trail[]>([]);
  const [trailsLoading, setTrailsLoading] = useState(false);
  const [trailsError, setTrailsError] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locationCoords, setLocationCoords] = useState<LatLng | null>(null);
  const firstMountRef = useRef(true);

  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [mapCenter, setMapCenter] = useState<LatLng | null>(null);

  useEffect(() => {
    if (locationCoords) setMapCenter(locationCoords);
  }, [locationCoords]);

  const applyLocation = useCallback(async (place: string, coords: LatLng) => {
    setLocationCoords(coords);
    setLocationLabel(place);
    setMapCenter(coords);
    setTrailsError(null);
  }, []);

  const detectGPS = useCallback(async () => {
    if (Platform.OS === "web") {
      if (!("geolocation" in navigator)) return;
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const r = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`,
              { headers: { "User-Agent": "SummitReady/1.0" } },
            );
            const d = await r.json() as { address?: { city?: string; town?: string; county?: string; state?: string } };
            const addr = d.address ?? {};
            const place = [addr.city ?? addr.town, addr.county ?? addr.state].filter(Boolean).join(", ");
            if (place) {
              setLocationQuery(place);
              await AsyncStorage.setItem(LAST_TRAIL_LOCATION_KEY, place);
              await applyLocation(place, { latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            }
          } catch { /* ignore */ } finally {
            setGpsLoading(false);
          }
        },
        () => setGpsLoading(false),
        { timeout: 10000 },
      );
      return;
    }

    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setGpsLoading(false); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geo = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (geo.length > 0) {
        const a = geo[0];
        const place = [a.city ?? a.district ?? a.subregion, a.region ?? a.subregion]
          .filter(Boolean)
          .join(", ");
        if (place) {
          setLocationQuery(place);
          await AsyncStorage.setItem(LAST_TRAIL_LOCATION_KEY, place);
          await applyLocation(place, { latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        }
      }
    } catch { /* ignore */ } finally {
      setGpsLoading(false);
    }
  }, [applyLocation]);

  useEffect(() => {
    if (!firstMountRef.current) return;
    firstMountRef.current = false;

    AsyncStorage.getItem(LAST_TRAIL_LOCATION_KEY).then(async (saved) => {
      if (saved) {
        setLocationQuery(saved);
        setTrailsLoading(true);
        const coords = await geocodeLocationString(saved);
        setTrailsLoading(false);
        if (coords) {
          await applyLocation(saved, coords);
        }
      } else {
        detectGPS();
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load seeded trails from DB-backed API (cached 7 days)
  useEffect(() => {
    loadSeededTrails().then(setSeededTrails).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const searchByLocation = useCallback(async () => {
    const trimmed = locationQuery.trim();
    if (!trimmed) {
      setLocationQuery("");
      setLocationCoords(null);
      setLocationLabel(null);
      await AsyncStorage.removeItem(LAST_TRAIL_LOCATION_KEY);
      return;
    }
    setTrailsLoading(true);
    setTrailsError(null);
    await AsyncStorage.setItem(LAST_TRAIL_LOCATION_KEY, trimmed);
    const coords = await geocodeLocationString(trimmed);
    setTrailsLoading(false);
    if (coords) {
      await applyLocation(trimmed, coords);
    } else {
      setTrailsError(`Could not find "${trimmed}" — try a different place name.`);
    }
  }, [locationQuery, applyLocation]);

  const clearLocationSearch = useCallback(() => {
    setLocationQuery("");
    setLocationLabel(null);
    setLocationCoords(null);
    AsyncStorage.removeItem(LAST_TRAIL_LOCATION_KEY);
  }, []);

  function stepRadius(dir: 1 | -1) {
    const idx = RADIUS_STEPS.indexOf(radius);
    const next = idx + dir;
    if (next >= 0 && next < RADIUS_STEPS.length) setRadius(RADIUS_STEPS[next]);
  }

  function stepElevation(dir: 1 | -1) {
    const idx = ELEVATION_STEPS.indexOf(minElevation);
    const next = idx + dir;
    if (next >= 0 && next < ELEVATION_STEPS.length) setMinElevation(ELEVATION_STEPS[next]);
  }

  function stepDuration(dir: 1 | -1) {
    const idx = DURATION_STEPS.indexOf(maxDuration);
    const next = idx + dir;
    if (next >= 0 && next < DURATION_STEPS.length) setMaxDuration(DURATION_STEPS[next]);
  }

  function stepDistance(dir: 1 | -1) {
    const idx = DISTANCE_STEPS.indexOf(maxDistance);
    const next = idx + dir;
    if (next >= 0 && next < DISTANCE_STEPS.length) setMaxDistance(DISTANCE_STEPS[next]);
  }

  const allTrails = useMemo(() => {
    const base = seededTrails.length > 0 ? seededTrails : SAMPLE_TRAILS;
    let nearby = base;
    if (locationCoords) {
      nearby = base.filter((t) => {
        if (t.lat == null || t.lng == null) return false;
        return haversineKm(locationCoords.latitude, locationCoords.longitude, t.lat, t.lng) <= radius;
      });
      if (nearby.length === 0) nearby = base;
    }
    const customIds = new Set(customRoutes.map((t) => t.id));
    return [...customRoutes, ...nearby.filter((t) => !customIds.has(t.id))];
  }, [customRoutes, seededTrails, locationCoords, radius]);

  const filtered = useMemo(() => {
    return allTrails.filter((t) => {
      if (query.trim()) {
        const q = query.toLowerCase();
        const match =
          t.name.toLowerCase().includes(q) ||
          t.location.toLowerCase().includes(q) ||
          t.difficulty.toLowerCase().includes(q) ||
          t.terrain.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (difficulty !== "All" && t.difficulty !== difficulty) return false;
      if (terrain !== "All" && t.terrain !== terrain) return false;
      if (routeType !== "All" && t.routeType !== routeType) return false;
      if (bestFor !== "All" && !t.bestFor.includes(bestFor as TrailBestFor)) return false;
      if (minElevation != null && t.elevationGain < minElevation) return false;
      if (maxDuration != null && parseDurationHours(t.estimatedTime) > maxDuration) return false;
      if (maxDistance != null && t.distance > maxDistance) return false;
      return true;
    });
  }, [allTrails, query, difficulty, terrain, bestFor, routeType, minElevation, maxDuration, maxDistance]);

  function hasCoordsTrail(t: Trail): t is MappedTrail {
    return typeof t.lat === "number" && typeof t.lng === "number";
  }

  const mappableTrails = useMemo(
    () => filtered.filter(hasCoordsTrail),
    [filtered],
  );

  const mapRegion = useMemo(() => {
    if (mapCenter) {
      return {
        latitude: mapCenter.latitude,
        longitude: mapCenter.longitude,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };
    }
    if (mappableTrails.length > 0) {
      const lats = mappableTrails.map((t) => t.lat);
      const lngs = mappableTrails.map((t) => t.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max(maxLat - minLat, 0.1) * 1.3,
        longitudeDelta: Math.max(maxLng - minLng, 0.1) * 1.3,
      };
    }
    return null;
  }, [mapCenter, mappableTrails]);

  const hasActiveChipFilters = difficulty !== "All" || terrain !== "All" || bestFor !== "All" || routeType !== "All";
  const hasSearchFilters = minElevation != null || maxDuration != null || maxDistance != null;

  function clearFilters() {
    setDifficulty("All");
    setTerrain("All");
    setBestFor("All");
    setRouteType("All");
  }

  const headerPaddingTop = Platform.OS === "web" ? 60 : insets.top + 16;

  const renderHeader = () => (
    <Animated.View entering={FadeInDown.duration(400)} style={s.header}>
      <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
        <ArrowLeft size={20} color={T.text} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={s.eyebrow}>EXPLORE TRAILS</Text>
        <Text style={s.title}>All Trails</Text>
      </View>
      <TouchableOpacity
        onPress={searchByLocation}
        style={s.refreshBtn}
        activeOpacity={0.7}
        disabled={trailsLoading}
      >
        {trailsLoading
          ? <ActivityIndicator size="small" color={T.green} />
          : <RefreshCw size={17} color={T.textMuted} />
        }
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          setViewMode((v) => v === "list" ? "map" : "list");
        }}
        style={[s.filterBtn, viewMode === "map" && s.filterBtnActive]}
      >
        {viewMode === "map"
          ? <List size={17} color={T.green} />
          : <Map size={17} color={T.textMuted} />
        }
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setShowFilters((v) => !v)}
        style={[s.filterBtn, showFilters && s.filterBtnActive]}
      >
        <SlidersHorizontal size={17} color={showFilters ? T.green : T.textMuted} />
        {hasActiveChipFilters && <View style={s.filterDot} />}
      </TouchableOpacity>
    </Animated.View>
  );

  if (viewMode === "map") {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <View style={[s.mapModeContainer, { paddingTop: headerPaddingTop }]}>
          <View style={s.mapTopControls}>
            {renderHeader()}

            {/* Compact location row */}
            <Animated.View entering={FadeInDown.delay(50).duration(400)} style={s.mapLocationRow}>
              <MapPin size={13} color={locationLabel ? T.green : T.textMuted} />
              <Text style={s.mapLocationText} numberOfLines={1}>
                {locationLabel
                  ? `${mappableTrails.length} of ${filtered.length} trails mapped near ${locationLabel}`
                  : "Enter a location to find nearby trails"}
              </Text>
            </Animated.View>
          </View>

          {/* Map — show explicit empty state when no region and no mapped trails */}
          {mapRegion === null && locationLabel && mappableTrails.length === 0 ? (
            <View style={s.mapEmptyState}>
              <Text style={s.mapEmptyStateTitle}>No trail coordinates available</Text>
              <Text style={s.mapEmptyStateSubtitle}>
                Try searching again or switch to list view to see results.
              </Text>
            </View>
          ) : (
            <TrailMapView
              trails={mappableTrails}
              region={mapRegion}
              onPressTrail={(trail) =>
                router.push({ pathname: "/trail-detail", params: { id: trail.id } })
              }
            />
          )}
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: headerPaddingTop, paddingBottom: 40 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderHeader()}

        {/* Name search */}
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={s.searchWrap}>
          <Search size={15} color={T.textMuted} />
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, difficulty…"
            placeholderTextColor={T.textDim}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
              <X size={14} color={T.textMuted} />
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Search options card */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={s.searchCard}>

          {/* Location row */}
          <View style={[s.locationWrap, locationQuery.length > 0 && s.locationWrapActive]}>
            <MapPin size={14} color={locationQuery.length > 0 ? T.green : T.textMuted} />
            <TextInput
              style={[s.searchInput, { fontSize: 13 }]}
              value={locationQuery}
              onChangeText={setLocationQuery}
              placeholder="Town, postcode or region…"
              placeholderTextColor={T.textDim}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="search"
              onSubmitEditing={searchByLocation}
              blurOnSubmit={false}
            />
            {locationQuery.length > 0 && !trailsLoading && (
              <TouchableOpacity onPress={clearLocationSearch} hitSlop={8}>
                <X size={13} color={T.textMuted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={detectGPS}
              style={s.gpsBtn}
              activeOpacity={0.7}
              hitSlop={6}
              disabled={gpsLoading}
            >
              {gpsLoading
                ? <ActivityIndicator size="small" color={T.green} />
                : <LocateFixed size={15} color={T.green} />
              }
            </TouchableOpacity>
          </View>

          <View style={s.divider} />

          {/* Steppers */}
          <StepperRow
            icon={<MapPin size={12} color={T.textMuted} />}
            label="Search radius"
            value={`${radius}km`}
            onDecrement={() => stepRadius(-1)}
            onIncrement={() => stepRadius(1)}
          />
          <StepperRow
            icon={<Text style={s.stepperEmoji}>⛰</Text>}
            label="Min elevation"
            value={stepperLabel(minElevation, v => `${v}m+`)}
            onDecrement={() => stepElevation(-1)}
            onIncrement={() => stepElevation(1)}
          />
          <StepperRow
            icon={<Text style={s.stepperEmoji}>⏱</Text>}
            label="Max duration"
            value={stepperLabel(maxDuration, v => `${v}h`)}
            onDecrement={() => stepDuration(-1)}
            onIncrement={() => stepDuration(1)}
          />
          <StepperRow
            icon={<Text style={s.stepperEmoji}>📏</Text>}
            label="Max distance"
            value={stepperLabel(maxDistance, v => `${v}km`)}
            onDecrement={() => stepDistance(-1)}
            onIncrement={() => stepDistance(1)}
          />

          <View style={s.divider} />

          {/* Search button */}
          <TouchableOpacity
            style={[s.searchBtn, (!locationQuery.trim() || trailsLoading) && s.searchBtnDisabled]}
            activeOpacity={0.8}
            disabled={!locationQuery.trim() || trailsLoading}
            onPress={searchByLocation}
          >
            {trailsLoading
              ? <ActivityIndicator size="small" color="#000" />
              : <Search size={14} color="#000" />
            }
            <Text style={s.searchBtnText}>
              {trailsLoading ? "Searching…" : "Search trails"}
            </Text>
          </TouchableOpacity>

        </Animated.View>

        {/* Status banner */}
        {!trailsLoading && (locationLabel || trailsError) && (
          <Animated.View entering={FadeInDown.delay(90).duration(300)} style={[
            s.banner,
            trailsError ? s.bannerError : s.bannerOk,
          ]}>
            {trailsError ? (
              <Text style={[s.bannerText, s.bannerTextError]}>{trailsError}</Text>
            ) : (
              <Text style={[s.bannerText, s.bannerTextOk]} numberOfLines={2}>
                {`Within ${radius}km of ${locationLabel}${hasSearchFilters ? " · filtered" : ""}`}
              </Text>
            )}
          </Animated.View>
        )}

        {/* Loading */}
        {trailsLoading && (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={T.green} />
            <Text style={s.loadingText}>Finding trails near {locationLabel ?? locationQuery ?? "you"}…</Text>
          </View>
        )}

        {/* Chip filters (difficulty, terrain, etc.) */}
        {showFilters && (
          <Animated.View entering={FadeInDown.duration(300)} style={s.filtersCard}>
            <View style={s.filtersHeader}>
              <Text style={s.filtersTitle}>Filters</Text>
              {hasActiveChipFilters && (
                <TouchableOpacity onPress={clearFilters}>
                  <Text style={s.clearText}>Clear all</Text>
                </TouchableOpacity>
              )}
            </View>
            <FilterRow label="Difficulty" options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
            <FilterRow label="Terrain" options={TERRAINS} value={terrain} onChange={setTerrain} />
            <FilterRow label="Route type" options={ROUTE_TYPES} value={routeType} onChange={setRouteType} />
            <FilterRow label="Best for" options={BEST_FOR} value={bestFor} onChange={setBestFor} />
          </Animated.View>
        )}

        {/* Result count */}
        {!trailsLoading && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <Text style={s.resultCount}>
              {filtered.length} trail{filtered.length !== 1 ? "s" : ""}{" "}
              {hasActiveChipFilters || hasSearchFilters || query || locationQuery ? "found" : ""}
            </Text>
          </Animated.View>
        )}

        {/* Trail list */}
        {!trailsLoading && (
          <View style={s.list}>
            {filtered.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyEmoji}>🔍</Text>
                <Text style={s.emptyTitle}>No trails found</Text>
                <Text style={s.emptyBody}>Try adjusting your search or filters.</Text>
              </View>
            ) : (
              filtered.map((trail, i) => (
                <Animated.View key={trail.id} entering={FadeInDown.delay(i * 40).duration(400)}>
                  <TrailCard
                    trail={trail}
                    isSaved={savedTrailIds.includes(trail.id)}
                    isCompleted={completedTrailIds.includes(trail.id)}
                    isGoodForWeek={isGoodForWeek(trail)}
                    onPress={() =>
                      router.push({ pathname: "/trail-detail", params: { id: trail.id } })
                    }
                  />
                </Animated.View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}


const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  eyebrow: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.textDim, letterSpacing: 1.2 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.text },
  refreshBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  filterBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  filterBtnActive: { backgroundColor: T.greenDim },
  filterDot: { position: "absolute", top: 8, right: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: T.green },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: T.text },

  searchCard: {
    backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border,
    paddingVertical: 4, overflow: "hidden",
  },
  locationWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  locationWrapActive: { backgroundColor: T.greenDim + "22" },
  gpsBtn: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: T.greenDim,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  divider: { height: 1, backgroundColor: T.border, marginHorizontal: 14 },

  stepperRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 10,
  },
  stepperLabelWrap: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  stepperLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.text },
  stepperEmoji: { fontSize: 12, width: 12, textAlign: "center" },
  stepperCtrl: { flexDirection: "row", alignItems: "center", gap: 0 },
  stepperBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: T.surface,
    borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center",
  },
  stepperVal: {
    width: 56, textAlign: "center",
    fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.green,
  },

  searchBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    margin: 12, marginTop: 8, borderRadius: 12, paddingVertical: 12,
    backgroundColor: T.green,
  },
  searchBtnDisabled: { opacity: 0.45 },
  searchBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#000" },

  banner: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  bannerOk: { backgroundColor: T.greenDim, borderColor: T.green + "40" },
  bannerWarn: { backgroundColor: T.surface, borderColor: T.border },
  bannerError: { backgroundColor: "#2a1a1a", borderColor: "#c0392b40" },
  bannerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  bannerText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  bannerTextOk: { color: T.green },
  bannerTextWarn: { color: T.textMuted },
  bannerTextError: { color: "#e74c3c" },
  bannerRefresh: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.green, textDecorationLine: "underline", flexShrink: 0 },
  loadingWrap: { alignItems: "center", paddingVertical: 48, gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted },
  filtersCard: { backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border, padding: 16, gap: 14 },
  filtersHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  filtersTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text },
  clearText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.green },
  filterRow: { gap: 8 },
  filterLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border },
  chipActive: { backgroundColor: T.greenDim, borderColor: T.green + "60" },
  chipText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, textTransform: "capitalize" },
  chipTextActive: { fontFamily: "Inter_600SemiBold", color: T.green },
  resultCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim },
  list: { gap: 10 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.text },
  emptyBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" },

  mapModeContainer: { flex: 1 },
  mapTopControls: { paddingHorizontal: 20, paddingBottom: 8, gap: 10 },
  mapLocationRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: T.surface, borderRadius: 10, borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  mapLocationText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },

  mapEmptyState: {
    flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32, gap: 8,
  },
  mapEmptyStateTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: T.text, textAlign: "center" },
  mapEmptyStateSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" },
});
