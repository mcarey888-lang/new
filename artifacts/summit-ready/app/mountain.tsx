/**
 * MOUNTAIN DETAIL — the decision surface.
 *
 * One mountain, one page. Choosing a route expands its detail IN PLACE below
 * its card; there is no separate Route Detail screen and selecting a route
 * never navigates away. From here a route goes into your plan, or — when the
 * engine has verified it — straight into the existing Track journey.
 *
 * ── WHERE THE DATA COMES FROM ─────────────────────────────────────────────
 * POST /api/mountain-lookup is the only production endpoint that returns a
 * canonical mountain together with its canonical route list. A canonical hit
 * carries the mountain's uuid and, per route, an identity key and a VERSION.
 * When it misses it falls back to a cached or AI answer, which carries no
 * identity at all — that is surfaced as a state, not smoothed over.
 *
 * Selecting a route then asks GET /api/canonical-routes for that exact
 * route@version. `mapExploreRoute()` turns the record into the engine's own
 * verdict, and `routeEligibility()` reads that verdict to decide what the
 * route may be used for. This screen never makes that decision itself.
 *
 * ── WHAT THIS SCREEN WILL NOT DO ──────────────────────────────────────────
 * It does not identify anything by display name. It does not fill in a fact
 * the engine does not hold. It does not offer a capability this build does
 * not have. It does not start navigation on an unverified route, and hiding
 * the button is not how it stops you — `startRouteHandoff()` refuses.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, RefreshControl, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { AlertCircle, Info, MapPin, Mountain as MountainIcon, Route as RouteIcon } from "lucide-react-native";
import { BASECAMP, EXPLORE, SP, TYPE } from "@/constants/tokens";
import {
  SREmptyState, SREyebrow, SRHeroFrame, SRPanel, SRScreenHeader, SRSectionHeader, SRSegmented,
} from "@/components/ui";
import { Footnote, VerificationBadge } from "@/components/mountain/parts";
import { RouteCard } from "@/components/mountain/RouteCard";
import { SelectedRoute } from "@/components/mountain/SelectedRoute";
import { RouteActionBar } from "@/components/mountain/RouteActionBar";
import { useScreenView } from "@/lib/analytics";
import { useApp } from "@/context/AppContext";
import { fetchCanonicalRouteRecord } from "@/utils/canonicalRouteApi";
import {
  canonicalMountainImageUrl, fetchMountainHeroStatus, generatedMountainHeroUrl, MountainHeroRequestError,
} from "@/utils/mountainHero";
import { appendApprovedImageRevision } from "@/utils/mountainImage";
import { mapExploreRoute, selectCanonicalRoute } from "@/utils/routeIntelligence";
import type { CanonicalRouteRecord, ExploreRoute, RouteIntelligence, RouteReadResult } from "@/utils/routeIntelligence";
import { startRouteHandoff, verifiedRouteStart } from "@/utils/routeEligibility";
import { saveCanonicalRouteHandoff } from "@/utils/canonicalRouteHandoff";
import { openRouteStartDirections } from "@/utils/openMaps";
import { ActionGrid, ActionTile, TrackChoices } from "@/components/mountain/HubActions";
import { ParkingSection } from "@/components/mountain/ParkingSection";
import type { AccessState } from "@/components/mountain/ParkingSection";
import {
  AboutSection, CorrectionRow, KeyFacts, OfflineSection, ProvenanceNote, SafetySection, SourcesSection, known,
} from "@/components/mountain/InfoSections";
import type { HazardItem } from "@/components/mountain/InfoSections";
import { useRoutePackage, useTrackLauncher } from "@/hooks/useMountainHub";
import { readMountainPageCache, writeMountainPageCache, readMountainRoutePackage } from "@/utils/mountainHubStorage";
import { lookupMountainAccess } from "@/utils/mountainAccess";
import { mountainHazardNotes } from "@/utils/mountainSafety";
import type { MountainAccessPoint } from "@/utils/mountainAccess";
import { sourcedParkingOptionsForMountain } from "@/utils/mountainParkingOptions";
import {
  CATALOGUE_UNAVAILABLE_NOTICE, ELEVATION_FOOTNOTE, FALLBACK_NOTICE,
  DISCOVERY_CANDIDATE_NOTICE,
  ROUTE_SORTS, presentMountain, presentMountainDna, presentRoutes, presentSelectedRoute,
  routePickerHint, sortRoutes,
  type MountainLookupResponse, type PresentedRoute, type RouteSort,
} from "@/utils/mountainDetailPresentation";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

/** Height of the shared tab bar the action bar must clear. */
const TAB_BAR_HEIGHT = 64;

type LoadState = "loading" | "ready" | "error";

export default function MountainDetailScreen() {
  useScreenView("mountain-detail");
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion() ?? false;
  const { shellMode, activeExpeditionId } = useApp();
  const { getToken, userId } = useAuth();
  // The auth hook may provide a new function on render. A new token getter
  // must not restart image generation or refetch route data.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const { name, region, country, catalogueId, discoveryId } = useLocalSearchParams<{
    name?: string; region?: string; country?: string; catalogueId?: string; discoveryId?: string;
  }>();

  const [lookup, setLookup] = useState<MountainLookupResponse | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [heroFailed, setHeroFailed] = useState(false);
  const [generatedHeroUri, setGeneratedHeroUri] = useState<string | null>(null);
  const [generatedHeroFailed, setGeneratedHeroFailed] = useState(false);
  const [heroRevision, setHeroRevision] = useState<string | null>(null);
  const [heroGenerationStatus, setHeroGenerationStatus] = useState<"generating" | "ready" | "failed" | null>(null);
  const [sort, setSort] = useState<RouteSort>("Ascent");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [record, setRecord] = useState<CanonicalRouteRecord | null>(null);
  const [recordPending, setRecordPending] = useState(false);
  const [recordFailure, setRecordFailure] = useState<string | null>(null);
  const [summitDescription, setSummitDescription] = useState<string | null>(null);
  const [descriptionState, setDescriptionState] = useState<LoadState>("loading");

  const [offlineNotice, setOfflineNotice] = useState(false);
  const [searched, setSearched] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);
  const [access, setAccess] = useState<MountainAccessPoint | null>(null);
  const [accessState, setAccessState] = useState<AccessState>("idle");
  const lookupRef = useRef<MountainLookupResponse | null>(null);
  lookupRef.current = lookup;
  const scrollRef = useRef<ScrollView>(null);
  const ys = useRef<Record<string, number>>({});
  const accessAbort = useRef<AbortController | null>(null);
  const loadGeneration = useRef(0);
  const loadAbort = useRef<AbortController | null>(null);
  const cacheRequest = useMemo(
    () => ({ name: name ?? "", region, country, catalogueId, discoveryId }),
    [name, region, country, catalogueId, discoveryId],
  );

  const load = useCallback(async () => {
    if (!name) { setState("error"); return; }
    const generation = ++loadGeneration.current;
    loadAbort.current?.abort();
    const controller = new AbortController();
    loadAbort.current = controller;
    setState("loading");
    let hadCache = !!lookupRef.current;
    if (!hadCache) {
      const cached = await readMountainPageCache(cacheRequest).catch(() => null);
      if (generation !== loadGeneration.current) return;
      if (cached) {
        hadCache = true;
        setLookup(cached.lookup);
        if (cached.description) { setSummitDescription(cached.description); setDescriptionState("ready"); }
        setState("ready");
      }
    }
    try {
      const response = await fetch(`${API_BASE}/mountain-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          name,
          ...(region ? { region } : {}),
          ...(country ? { country } : {}),
          ...(catalogueId ? { catalogueId } : {}),
          ...(discoveryId ? { discoveryId } : {}),
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const fresh = await response.json() as MountainLookupResponse;
      if (generation !== loadGeneration.current) return;
      setLookup(fresh);
      setOfflineNotice(false);
      setState("ready");
      void writeMountainPageCache(cacheRequest, fresh).catch(() => {});
    } catch {
      if (generation !== loadGeneration.current) return;
      if (hadCache) { setOfflineNotice(true); setState("ready"); }
      else setState("error");
    }
  }, [name, region, country, catalogueId, discoveryId, cacheRequest]);

  useEffect(() => {
    lookupRef.current = null;
    setLookup(null);
    setSummitDescription(null);
    setSelectedKey(null);
    setAccess(null);
    setAccessState("idle");
    setOfflineNotice(false);
    setSearched(false);
    void load();
    return () => {
      loadGeneration.current++;
      loadAbort.current?.abort();
      accessAbort.current?.abort();
    };
  }, [load]);

  const descRef = useRef<string | null>(null);
  descRef.current = summitDescription;
  const mountain = useMemo(() => lookup ? presentMountain(lookup) : null, [lookup]);
  const parkingOptions = useMemo(() => sourcedParkingOptionsForMountain(lookup), [lookup]);
  const canonicalMountainId = lookup?.source === "canonical"
    ? lookup.canonicalIdentity?.id
    : null;

  // Reuse the existing summit guide description. It is narrative context,
  // not evidence of a verified route, start point or parking location.
  useEffect(() => {
    if (!mountain) return;
    const controller = new AbortController();
    if (!descRef.current) setDescriptionState("loading");
    void fetch(`${API_BASE}/hill-detail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hillName: mountain.name,
        location: mountain.place ?? undefined,
        summitIdentityKey: mountain.id ?? undefined,
        summitLat: mountain.summitCoordinates?.latitude,
        summitLng: mountain.summitCoordinates?.longitude,
      }),
      signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error(`Summit description failed (${response.status})`);
      const detail = await response.json() as { description?: string };
      if (!controller.signal.aborted) {
        const text = detail.description?.trim() || null;
        setSummitDescription(text);
        setDescriptionState("ready");
        if (text && lookupRef.current) void writeMountainPageCache(cacheRequest, lookupRef.current, text).catch(() => {});
      }
    }).catch(() => {
      if (!controller.signal.aborted) setDescriptionState(descRef.current ? "ready" : "error");
    });
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mountain]);

  // Only the detail screen starts generation, after catalogue identity is resolved.
  // List thumbnails and general image reads never request paid artwork.
  useEffect(() => {
    if (!canonicalMountainId || !userId) return;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    let statusFailures = 0;
    setGeneratedHeroUri(null);
    setGeneratedHeroFailed(false);
    setHeroRevision(null);
    setHeroGenerationStatus(null);

    const check = async (request: boolean) => {
      try {
        const result = await fetchMountainHeroStatus(canonicalMountainId, API_BASE, () => getTokenRef.current(), request);
        if (cancelled) return;
        statusFailures = 0;
        if (result.status === "ready") {
          const url = generatedMountainHeroUrl(result.imageUrl, API_BASE, canonicalMountainId);
          if (url) setGeneratedHeroUri(url);
          setHeroFailed(false);
          setHeroRevision(result.jobId ?? `approved-${Date.now()}`);
          setHeroGenerationStatus("ready");
        } else if (result.status === "generating") {
          setHeroGenerationStatus("generating");
          pollTimer = setTimeout(() => void check(false), 5000);
        } else {
          setHeroGenerationStatus(result.status === "failed" ? "failed" : null);
        }
      } catch (error) {
        if (!cancelled) {
          if (error instanceof MountainHeroRequestError && request &&
              (error.status === 429 || error.status === 503) && error.retryAfterMs &&
              Date.now() - startedAt + error.retryAfterMs < 3 * 60 * 1000) {
            setHeroGenerationStatus("generating");
            pollTimer = setTimeout(() => void check(true), Math.max(error.retryAfterMs, 5000));
            return;
          }
          if (!request && !(error instanceof MountainHeroRequestError && error.status < 500) &&
              ++statusFailures <= 3) {
            pollTimer = setTimeout(() => void check(false), 5000);
            return;
          }
          console.warn("Mountain hero generation unavailable", error);
          setHeroGenerationStatus("failed");
        }
      }
    };
    void check(true);
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [canonicalMountainId, userId]);
  useEffect(() => {
    setSelectedKey(null); setRecord(null); setAccess(null); setAccessState("idle"); setTrackOpen(false);
    accessAbort.current?.abort();
  }, [userId]);
  const routes = useMemo(
    () => (lookup && mountain ? presentRoutes(lookup, mountain) : []),
    [lookup, mountain],
  );
  const sorted = useMemo(() => sortRoutes(routes, sort), [routes, sort]);
  const selected = useMemo(
    () => sorted.find(r => r.key === selectedKey) ?? null,
    [sorted, selectedKey],
  );

  /* Fetch the engine's record for the SELECTED route only. The list carries
     identity and facts; navigability needs geometry, which lives here. */
  useEffect(() => {
    const identity = selected?.selection;
    if (!identity) {
      setRecord(null);
      setRecordFailure("missing_identity");
      setRecordPending(false);
      return;
    }
    let cancelled = false;
    setRecord(null);
    setRecordFailure(null);
    setRecordPending(true);
    void fetchCanonicalRouteRecord(identity.routeId, identity.mountainId, () => getTokenRef.current())
      .then(result => {
        if (cancelled) return;
        if (result.record || !userId) {
          setRecord(result.record);
          setRecordFailure(result.record ? null : result.reasons.join(", ") || result.status);
          setRecordPending(false);
          return;
        }
        void readMountainRoutePackage(userId, identity.routeId, identity.mountainId, identity.routeVersion)
          .catch(() => null)
          .then(pkg => {
            if (cancelled) return;
            setRecord(pkg?.record ?? null);
            setRecordFailure(pkg ? null : result.reasons.join(", ") || result.status);
            setRecordPending(false);
          });
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.selection?.routeId, selected?.selection?.mountainId, userId]);

  /* The engine's own verdict for the selected route. */
  const exploreRoute: ExploreRoute | null = useMemo(() => {
    const identity = selected?.selection;
    if (!identity || !record) return null;
    const result: RouteReadResult<RouteIntelligence> = selectCanonicalRoute({
      routeId: identity.routeId,
      mountainId: identity.mountainId,
      candidates: [record],
    });
    return mapExploreRoute(result);
  }, [record, selected?.selection?.routeId, selected?.selection?.mountainId]);

  const presented = useMemo(
    () => selected ? presentSelectedRoute(selected, exploreRoute, record?.elevationProfile) : null,
    [selected, exploreRoute, record],
  );
  const osMapPoints = useMemo(() =>
    record?.geometry?.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
  [record]);
  const routeStart = useMemo(() => verifiedRouteStart(exploreRoute), [exploreRoute]);
  const routeStartLabel = record?.definition?.startLabel?.trim() || "Mapped route start";

  function getDirectionsToRouteStart(mode: "walking" | "driving") {
    if (!routeStart) return;
    openRouteStartDirections(routeStart.latitude, routeStart.longitude, mode);
  }

  /* Mountain DNA compares this route with the user's target route. No target
     route identity exists in production today (see the batch report), so the
     panel renders its designed unavailable state rather than a made-up one. */
  const dna = useMemo(() => presentMountainDna(null), []);

  const heroUri = generatedHeroUri && !generatedHeroFailed
    ? generatedHeroUri
    : !heroFailed && mountain
      ? canonicalMountainId
        ? appendApprovedImageRevision(
            canonicalMountainImageUrl(API_BASE, canonicalMountainId, mountain.name, mountain.place ?? "", heroRevision),
            mountain.name,
          )
        : appendApprovedImageRevision(
            `${API_BASE}/mountain-image?name=${encodeURIComponent(mountain.name)}`
              + `&location=${encodeURIComponent(mountain.place ?? "")}&width=960&height=620`,
            mountain.name,
          )
      : null;

  function choose(route: PresentedRoute) {
    setSelectedKey(current => current === route.key ? null : route.key);
  }

  /**
   * Hand a verified route to the existing Track journey.
   *
   * The guard runs here, not in the button's visibility. A null handoff means
   * this route may not be navigated, whatever the screen was showing.
   */
  async function startRouteInner() {
    if (!presented) return;
    const handoff = startRouteHandoff(exploreRoute, {
      routeName: presented.route.name,
      mountainName: mountain?.name,
    });
    const geometry = exploreRoute?.geometry.availability === "available"
      ? exploreRoute.geometry.value
      : null;
    if (!handoff || !geometry) return;
    if (!record ||
        record.route.version.routeId !== handoff.routeId ||
        record.route.version.identityKey !== handoff.routeIdentityKey ||
        record.route.version.version !== handoff.routeVersion ||
        record.route.version.mountainId !== handoff.mountainId ||
        record.mountain.id !== handoff.mountainId) return;
    if (!userId) {
      Alert.alert("Sign in required", "Sign in before starting a canonical route handoff.");
      return;
    }
    const handoffId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      await saveCanonicalRouteHandoff({
        ownerUserId: userId,
        handoffId,
        mountainId: handoff.mountainId,
        routeId: handoff.routeId,
        routeIdentityKey: handoff.routeIdentityKey,
        routeVersion: handoff.routeVersion,
        routeName: handoff.routeName,
        mountainName: handoff.mountainName,
        ...(typeof record.definition?.startLabel === "string" &&
            record.definition.startLabel.trim().length > 0 &&
            record.definition.startLabel.trim().length <= 200
          ? { startLabel: record.definition.startLabel.trim() }
          : {}),
        ...(typeof record.facts?.startElevationM === "number" &&
            Number.isFinite(record.facts.startElevationM) && record.facts.startElevationM >= 0
          ? { startElevationM: record.facts.startElevationM }
          : {}),
        geometry,
        savedAt: Date.now(),
      });
    } catch {
      Alert.alert("Route handoff unavailable", "The verified route could not be saved on this device, so tracking was not started.");
      return;
    }
    router.push({
      pathname: "/hike-tracking" as any,
      params: {
        trackingMode: "freehike",
        routeHandoffId: handoffId,
        canonicalRouteId: handoff.routeId,
        canonicalRouteIdentityKey: handoff.routeIdentityKey,
        canonicalRouteVersion: handoff.routeVersion,
        canonicalMountainId: handoff.mountainId,
        canonicalRouteName: handoff.routeName,
        hillName: handoff.mountainName,
      },
    });
  }

  const { launch, resume, launching, resumable } = useTrackLauncher(userId);
  const startRoute = () => { void launch(startRouteInner); };
  const rawMountainId = lookup?.source === "canonical" ? lookup.canonicalIdentity?.id : undefined;
  const pkgState = useRoutePackage(userId, record, parkingOptions);
  async function viewRouteMap() {
    if (!userId) {
      Alert.alert("Sign in required", "Sign in to save and view an exact route snapshot on this device.");
      return;
    }
    const saved = await pkgState.save();
    if (!saved) return;
    router.push({
      pathname: "/route-planner" as any,
      params: {
        canonicalPackageRouteId: saved.record.route.version.routeId,
        canonicalPackageMountainId: saved.record.mountain.id,
        canonicalPackageVersion: saved.record.route.version.version,
      },
    });
  }

  // recordingMountainId is the raw canonical id; canonicalMountainId is
  // deliberately NOT passed because it would trigger route handoff intent.
  function trackFreeHike() {
    if (!mountain) return;
    void launch(() => {
      router.push({
        pathname: "/hike-tracking" as any,
        params: {
          trackingMode: "freehike",
          hillName: mountain.name,
          ...(rawMountainId ? { recordingMountainId: rawMountainId } : {}),
          ...(shellMode === "expedition" && activeExpeditionId ? { expeditionId: activeExpeditionId } : {}),
        },
      });
    });
  }

  function planRoute(focus?: { latitude: number; longitude: number; label?: string }) {
    const c = focus ?? mountain?.summitCoordinates;
    router.push({
      pathname: "/route-planner" as any,
      params: c ? {
        focusLat: String(c.latitude), focusLng: String(c.longitude),
        ...(focus?.label ? { startLabel: focus.label } : {}),
      } : {},
    });
  }

  function scrollTo(key: string) {
    scrollRef.current?.scrollTo({ y: Math.max(0, (ys.current[key] ?? 0) - 8), animated: !reducedMotion });
  }
  const mark = (key: string) => (e: { nativeEvent: { layout: { y: number } } }) => { ys.current[key] = e.nativeEvent.layout.y; };

  async function findRoutes() {
    setSearched(false);
    await load();
    setSearched(true);
  }

  async function findParking() {
    if (!lookup) return;
    accessAbort.current?.abort();
    const controller = new AbortController();
    accessAbort.current = controller;
    setAccessState("loading");
    try {
      const found = await lookupMountainAccess(lookup, controller.signal);
      if (controller.signal.aborted) return;
      setAccess(found);
      setAccessState("done");
    } catch {
      if (!controller.signal.aborted) setAccessState("error");
    }
  }

  const hazards = useMemo<HazardItem[]>(() => mountainHazardNotes(record), [record]);

  const sources = useMemo(() => {
    const out = new Set<string>();
    if (mountain?.provenanceVersion) out.add(`Summit Data Engine, provenance ${mountain.provenanceVersion}`);
    for (const r of routes) if (r.attribution) out.add(r.attribution);
    for (const o of parkingOptions) out.add(`${o.sourceName}, car park listing`);
    return [...out];
  }, [mountain, routes, parkingOptions]);

  const topPad = Platform.OS === "web" ? 18 : insets.top + 8;
  const bottomPad = (presented ? 132 : 24) + TAB_BAR_HEIGHT
    + (Platform.OS === "web" ? 0 : insets.bottom);

  if (state === "loading" && !lookup) {
    return (
      <View style={styles.screen}>
        <View style={[styles.centred, { paddingTop: topPad + 80 }]}>
          <ActivityIndicator color={EXPLORE.accent} />
          <Text style={styles.loadingText}>{name ? `Looking up ${name}…` : "Loading…"}</Text>
        </View>
      </View>
    );
  }

  if (state === "error" || !mountain) {
    return (
      <View style={styles.screen}>
        <View style={{ paddingTop: topPad }}>
          <SRScreenHeader title="Mountain" onBack={() => router.back()} />
        </View>
        <SREmptyState
          icon={<AlertCircle size={20} color={EXPLORE.unverified} />}
          title="Could not load this mountain"
          body="Check your connection and try again. Nothing has been saved or changed."
          action="Try again"
          onAction={() => void load()}
          style={styles.errorState}
        />
      </View>
    );
  }

  const Section = reducedMotion ? View : Animated.View;

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={state === "loading"}
            onRefresh={() => void load()}
            tintColor={EXPLORE.accent}
          />
        }
      >
        {/* ── Hero: the mountain, its height and where it is ───────────── */}
        <SRHeroFrame
          uri={heroUri}
          onImageError={() => {
            if (generatedHeroUri && !generatedHeroFailed) setGeneratedHeroFailed(true);
            else setHeroFailed(true);
          }}
          minHeight={334}
          dim={0.95}
          style={{ justifyContent: "space-between" }}
        >
          <View style={{ paddingTop: topPad }}>
            <SRScreenHeader title="" onBack={() => router.back()} />
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.heroName} numberOfLines={3}>{mountain.name}</Text>
            {/* The mountain's height. A route's ascent is a different number
                and is never shown here. */}
            {mountain.summitElevation.value ? (
              <Text style={styles.heroElevation}>
                {mountain.discoveryCandidate
                  ? `${mountain.summitElevation.value} · CANDIDATE`
                  : mountain.summitElevation.value}
              </Text>
            ) : null}
            {mountain.place ? (
              <View style={styles.heroPlace}>
                <MapPin size={13} color={BASECAMP.textDim} />
                <Text style={styles.heroPlaceText} numberOfLines={2}>{mountain.place}</Text>
              </View>
            ) : null}
            <View style={styles.heroBadges}>
              {lookup?.catalogueStatus === "unavailable"
                ? <Text style={styles.catalogueUnavailableBadge}>CATALOGUE UNAVAILABLE</Text>
              : mountain.discoveryCandidate
                ? <Text style={styles.candidateBadge}>
                    {mountain.candidateStatus === "imported"
                      ? "IMPORTED · NOT VERIFIED"
                      : mountain.candidateStatus === "ai_unverified"
                        ? "AI CANDIDATE · NOT VERIFIED"
                        : "CANDIDATE · NOT VERIFIED"}
                  </Text>
                : mountain.verified
                  ? <VerificationBadge state="verified" />
                  : <Text style={styles.candidateBadge}>GUIDE INFORMATION · NOT VERIFIED</Text>}
            </View>
          </View>
        </SRHeroFrame>
        {canonicalMountainId && userId ? (
          <View style={styles.heroStatusSlot}>
            <Text style={styles.heroStatusText} numberOfLines={1}>
              {heroGenerationStatus === "generating"
                ? "Creating a mountain-specific hero image…"
                : generatedHeroUri && !generatedHeroFailed
                  ? "AI-generated mountain depiction"
                  : heroGenerationStatus === "failed"
                    ? "New hero unavailable — showing the existing image"
                    : ""}
            </Text>
          </View>
        ) : null}

        {offlineNotice ? (
          <View style={styles.gutter}>
            <Text style={styles.offlineNotice} testID="mountain-offline-notice">
              Live information could not be refreshed. Showing data saved on this device.
            </Text>
          </View>
        ) : null}

        {known(mountain.overview).length ? (
          <Section entering={reducedMotion ? undefined : FadeInDown.delay(60).duration(360)} style={styles.gutter}>
            <SRPanel radius={8} style={styles.overviewPanel}>
              <View style={styles.overviewRow}>
                {known(mountain.overview).map(f => (
                  <View key={f.key} style={styles.overviewItem}>
                    <Text style={styles.overviewValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{f.value}</Text>
                    <Text style={styles.overviewLabel} numberOfLines={2}>{f.label}</Text>
                  </View>
                ))}
              </View>
            </SRPanel>
            <Footnote>{ELEVATION_FOOTNOTE}</Footnote>
          </Section>
        ) : null}

        <ActionGrid
          resumable={resumable}
          busy={launching}
          onRoutes={() => scrollTo("routes")}
          onParking={() => scrollTo("parking")}
          onTrack={() => setTrackOpen(v => !v)}
          onResume={resume}
          onOffline={() => scrollTo("offline")}
        />
        {trackOpen && !resumable ? (
          <TrackChoices
            busy={launching}
            onFollow={() => { setTrackOpen(false); scrollTo("routes"); }}
            onFreeHike={() => { setTrackOpen(false); trackFreeHike(); }}
            onPlan={() => planRoute()}
            onSaved={() => router.push("/trails-saved" as any)}
            onClose={() => setTrackOpen(false)}
          />
        ) : null}

        <View onLayout={mark("routes")} style={styles.routesSection}>
          <View style={styles.gutter}>
            <SRSectionHeader title="Routes" icon={<RouteIcon size={13} color={EXPLORE.accent} />} />
            {routes.length > 1 ? (
              <SRSegmented
                compact
                options={ROUTE_SORTS.map(s => ({ value: s, label: s }))}
                value={sort}
                onChange={setSort}
                style={styles.sort}
              />
            ) : null}
          </View>

          {routes.length === 0 ? (
            <View style={styles.gutter}>
              <SREmptyState
                icon={<MountainIcon size={20} color={BASECAMP.textDim} />}
                title="No mapped routes yet"
                body={searched
                  ? "The route library was refreshed and holds no routes for this mountain. Route discovery is not available yet, so nothing was built."
                  : "Routes appear here once they are stored for this mountain. You can refresh the library, plan your own route or record a free hike."}
                action="Find routes for this mountain"
                onAction={() => void findRoutes()}
                style={styles.emptyRoutes}
                testID="mountain-find-routes"
              />
              <View style={styles.emptyActions}>
                <ActionTileRow onPlan={() => planRoute()} onFree={trackFreeHike} busy={launching} />
              </View>
            </View>
          ) : (
            <View style={[styles.gutter, styles.routeList]}>
              {sorted.map(route => (
                <View key={route.key}>
                  <RouteCard
                    route={route}
                    selected={route.key === selectedKey}
                    onPress={() => choose(route)}
                    mapping={route.key === selectedKey && !recordPending
                      ? (presented?.eligibility.isNavigable ? "mapped" : "guide")
                      : null}
                  />
                  {route.key === selectedKey ? (
                    recordPending ? (
                      <SRPanel radius={8} style={styles.pending}>
                        <ActivityIndicator color={EXPLORE.accent} />
                        <Text style={styles.pendingText}>Reading route detail…</Text>
                      </SRPanel>
                    ) : presented ? (
                      <SelectedRoute
                        mapPoints={osMapPoints}
                        selected={presented}
                        dna={dna}
                        mountainSummitElevation={mountain.summitElevation}
                        mountainName={mountain.name}
                        startPointLabel={routeStart ? routeStartLabel : undefined}
                        onWalkToStart={routeStart ? () => getDirectionsToRouteStart("walking") : undefined}
                        onSaveDataPackage={userId ? () => void pkgState.save() : undefined}
                        onViewMap={() => void viewRouteMap()}
                        dataPackageSaved={!!pkgState.pkg}
                      />
                    ) : (
                      <SRPanel radius={8} style={styles.pending}>
                        <Text style={styles.pendingText}>
                          Route guide only — mapping not available. No route geometry is being used.
                        </Text>
                      </SRPanel>
                    )
                  ) : null}
                </View>
              ))}
              {!selected ? <Text style={styles.pickerHint}>{routePickerHint(mountain.name)}</Text> : null}
            </View>
          )}
        </View>

        <View onLayout={mark("parking")}>
          <ParkingSection
            mountainName={mountain.name}
            place={mountain.place}
            options={parkingOptions}
            access={access}
            accessState={accessState}
            onFind={() => void findParking()}
            onUseAsStart={p => planRoute({ latitude: p.latitude, longitude: p.longitude, label: p.name })}
            routeStart={routeStart ? { label: routeStartLabel } : null}
            onWalkToRouteStart={routeStart ? () => getDirectionsToRouteStart("walking") : undefined}
          />
        </View>

        <SafetySection hazards={hazards} />
        <AboutSection text={summitDescription} state={descriptionState} />
        <KeyFacts facts={mountain.practical} />

        <View onLayout={mark("offline")}>
          <OfflineSection
            routeName={presented?.route.name ?? null}
            canPackage={!!presented?.eligibility.isNavigable && !!userId}
            pkg={pkgState.pkg}
            saving={pkgState.status === "saving"}
            onSave={() => void pkgState.save()}
            onRemove={() => void pkgState.remove()}
          />
        </View>

        <SourcesSection sources={sources} />
        <CorrectionRow />
        {/* Unavailable catalogue/contribution guidance is secondary, never the primary action. */}
        {mountain.fallback ? (
          <ProvenanceNote text={mountain.discoveryCandidate
            ? `${DISCOVERY_CANDIDATE_NOTICE.title}. ${DISCOVERY_CANDIDATE_NOTICE.body}`
            : lookup?.catalogueStatus === "unavailable"
              ? `${CATALOGUE_UNAVAILABLE_NOTICE.title}. ${CATALOGUE_UNAVAILABLE_NOTICE.body}`
              : FALLBACK_NOTICE.body} />
        ) : null}
        {mountain.provenanceVersion ? (
          <ProvenanceNote text={`Summit Data Engine, provenance ${mountain.provenanceVersion}. Static information, not live conditions.`} />
        ) : null}
      </ScrollView>

      {presented && !recordPending ? (
        <RouteActionBar
          mountainName={mountain.name}
          routeName={presented.route.name}
          eligibility={presented.eligibility}
          planned={false}
          onAddToPlan={presented.eligibility.canAddToPlan
            ? () => router.push("/setup?mode=change" as any)
            : undefined}
          onStart={startRoute}
          onTrackHike={trackFreeHike}
          bottomOffset={TAB_BAR_HEIGHT + (Platform.OS === "web" ? 0 : insets.bottom)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BASECAMP.ink },
  centred: { alignItems: "center", gap: SP.md },
  loadingText: { ...TYPE.small, color: BASECAMP.textDim },
  errorState: { marginHorizontal: BASECAMP.gutter, marginTop: SP.xl },
  gutter: { paddingHorizontal: BASECAMP.gutter },

  heroBody: { paddingHorizontal: BASECAMP.gutter, paddingBottom: 14 },
  heroStatusSlot: { height: 16, marginHorizontal: BASECAMP.gutter, justifyContent: "center" },
  heroStatusText: { fontSize: 10, color: BASECAMP.textDim },
  heroName: { ...TYPE.hero, fontSize: 34, lineHeight: 37, color: BASECAMP.text },
  heroElevation: { marginTop: 4, fontSize: 22, lineHeight: 26, fontFamily: "Inter_700Bold", color: BASECAMP.text },
  heroPlace: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6 },
  heroPlaceText: { ...TYPE.small, fontSize: 12.5, color: BASECAMP.textMuted, flexShrink: 1 },
  heroBadges: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catalogueUnavailableBadge: {
    color: EXPLORE.unverified, backgroundColor: EXPLORE.unverifiedDim,
    borderColor: EXPLORE.unverifiedLine, borderWidth: 1, borderRadius: 5,
    paddingHorizontal: 8, paddingVertical: 4,
    fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1,
    overflow: "hidden",
  },
  candidateBadge: {
    color: EXPLORE.unverified, backgroundColor: EXPLORE.unverifiedDim,
    borderColor: EXPLORE.unverifiedLine, borderWidth: 1, borderRadius: 5,
    paddingHorizontal: 8, paddingVertical: 4,
    fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.7,
    overflow: "hidden",
  },

  fallbackPanel: { marginTop: 14, padding: 12, borderColor: EXPLORE.unverifiedLine },
  fallbackRow: { flexDirection: "row", gap: 10 },
  fallbackText: { flex: 1, minWidth: 0 },
  fallbackTitle: { ...TYPE.smallBold, fontSize: 12.5, color: EXPLORE.unverified },
  fallbackBody: { marginTop: 4, fontSize: 11, lineHeight: 15, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },

  overviewPanel: { marginTop: 14, padding: 12 },
  overviewRow: { flexDirection: "row", gap: SP.sm },
  overviewItem: { flex: 1, minWidth: 0, alignItems: "center" },
  overviewValue: { fontSize: 13, lineHeight: 17, fontFamily: "Inter_700Bold", color: BASECAMP.text, textAlign: "center" },
  overviewLabel: { marginTop: 1, fontSize: 9.5, lineHeight: 12, fontFamily: "Inter_400Regular", color: BASECAMP.textDim, textAlign: "center" },
  gettingThereSection: { marginTop: 18 },
  detailsSection: { marginTop: 18 },
  description: { marginTop: 9, ...TYPE.body, color: BASECAMP.textMuted },
  descriptionNote: { marginTop: 5, ...TYPE.caption, color: BASECAMP.textDim },
  accessHeading: { marginTop: 20 },
  accessPanel: { marginTop: 10, padding: 14 },
  accessLabel: { ...TYPE.eyebrow, color: BASECAMP.textDim },
  accessValue: { marginTop: 5, ...TYPE.body, color: BASECAMP.text },
  accessAction: { flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start", minHeight: 44 },
  accessActionText: { ...TYPE.smallBold, color: EXPLORE.accent },
  accessDivider: { height: 1, backgroundColor: BASECAMP.glassBorder, marginVertical: 12 },
  parkingOption: {
    marginTop: 12, padding: 12, borderRadius: 8,
    borderWidth: 1, borderColor: BASECAMP.glassBorder, backgroundColor: BASECAMP.panelSub,
  },
  parkingName: { ...TYPE.bodyBold, color: BASECAMP.text },
  parkingApproach: { ...TYPE.caption, color: EXPLORE.accent, marginTop: 3 },
  parkingGrid: { ...TYPE.caption, color: BASECAMP.textStrong, marginTop: 6 },
  parkingNote: { ...TYPE.caption, color: BASECAMP.textMuted, marginTop: 6 },
  parkingActions: { flexDirection: "row", flexWrap: "wrap", columnGap: 18, marginTop: 6 },
  directionsRow: { flexDirection: "row", flexWrap: "wrap", gap: SP.sm, marginTop: 10 },
  directionsButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    minHeight: 44, paddingHorizontal: 12, borderRadius: 7,
    backgroundColor: BASECAMP.panelSub, borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },
  directionsNote: { ...TYPE.caption, color: BASECAMP.textMuted, marginTop: 7 },

  routesSection: { marginTop: 20 },
  offlineNotice: { marginTop: 10, fontSize: 11, lineHeight: 15, fontFamily: "Inter_400Regular", color: EXPLORE.unverified },
  emptyRoutes: { marginTop: 4 },
  emptyActions: { marginTop: 8 },
  sort: { marginTop: 10, alignSelf: "flex-start" },
  routeList: { marginTop: 10, gap: 9 },
  pickerHint: { marginTop: 2, fontSize: 11, lineHeight: 15, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  pending: { marginTop: 9, padding: SP.xl, alignItems: "center", gap: SP.sm },
  pendingText: { ...TYPE.caption, color: BASECAMP.textDim },

  practicalSection: { marginTop: 20 },
  practicalPanel: { marginTop: 10 },
  provenance: { marginTop: 6, fontSize: 9.5, lineHeight: 13, fontFamily: "Inter_400Regular", color: BASECAMP.textFaint },
});

function ActionTileRow({ onPlan, onFree, busy }: { onPlan: () => void; onFree: () => void; busy: boolean }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SP.sm }}>
      <ActionTile testID="mountain-empty-plan" label="Plan my own route" onPress={onPlan} icon={<RouteIcon size={17} color={EXPLORE.accent} />} />
      <ActionTile testID="mountain-empty-free" label="Record free hike" onPress={onFree} disabled={busy} icon={<MapPin size={17} color={EXPLORE.accent} />} />
    </View>
  );
}
