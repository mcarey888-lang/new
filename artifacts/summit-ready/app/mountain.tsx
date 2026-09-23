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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { AlertCircle, Info, MapPin, Mountain as MountainIcon, Route as RouteIcon } from "lucide-react-native";
import { BASECAMP, EXPLORE, SP, TYPE } from "@/constants/tokens";
import {
  SREmptyState, SREyebrow, SRHeroFrame, SRPanel, SRScreenHeader, SRSectionHeader, SRSegmented,
} from "@/components/ui";
import { FactList, Footnote, VerificationBadge } from "@/components/mountain/parts";
import { RouteCard } from "@/components/mountain/RouteCard";
import { SelectedRoute } from "@/components/mountain/SelectedRoute";
import { RouteActionBar } from "@/components/mountain/RouteActionBar";
import { useScreenView } from "@/lib/analytics";
import { useApp } from "@/context/AppContext";
import { fetchCanonicalRouteRecord } from "@/utils/canonicalRouteApi";
import { mapExploreRoute, selectCanonicalRoute } from "@/utils/routeIntelligence";
import type { CanonicalRouteRecord, ExploreRoute, RouteIntelligence, RouteReadResult } from "@/utils/routeIntelligence";
import { startRouteHandoff } from "@/utils/routeEligibility";
import {
  ELEVATION_FOOTNOTE, FALLBACK_NOTICE, NO_ROUTES_NOTICE, PRACTICAL_FOOTNOTE,
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
  const { shellMode } = useApp();

  const { name, region, country } = useLocalSearchParams<{
    name?: string; region?: string; country?: string;
  }>();

  const [lookup, setLookup] = useState<MountainLookupResponse | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [heroFailed, setHeroFailed] = useState(false);
  const [sort, setSort] = useState<RouteSort>("Ascent");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [record, setRecord] = useState<CanonicalRouteRecord | null>(null);
  const [recordPending, setRecordPending] = useState(false);

  const load = useCallback(async () => {
    if (!name) { setState("error"); return; }
    setState("loading");
    try {
      const response = await fetch(`${API_BASE}/mountain-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ...(region ? { region } : {}),
          ...(country ? { country } : {}),
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setLookup(await response.json() as MountainLookupResponse);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [name, region, country]);

  useEffect(() => { void load(); }, [load]);

  const mountain = useMemo(() => lookup ? presentMountain(lookup) : null, [lookup]);
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
    if (!identity) { setRecord(null); setRecordPending(false); return; }
    let cancelled = false;
    setRecord(null);
    setRecordPending(true);
    void fetchCanonicalRouteRecord(identity.routeId, identity.mountainId)
      .then(result => {
        if (cancelled) return;
        setRecord(result.record);
        setRecordPending(false);
      });
    return () => { cancelled = true; };
  }, [selected?.selection?.routeId, selected?.selection?.mountainId]);

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

  /* Mountain DNA compares this route with the user's target route. No target
     route identity exists in production today (see the batch report), so the
     panel renders its designed unavailable state rather than a made-up one. */
  const dna = useMemo(() => presentMountainDna(null), []);

  const heroUri = !heroFailed && mountain
    ? `${API_BASE}/mountain-image?name=${encodeURIComponent(mountain.name)}`
      + `&location=${encodeURIComponent(mountain.place ?? "")}&width=960&height=620`
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
  function startRoute() {
    if (!presented) return;
    const handoff = startRouteHandoff(exploreRoute, {
      routeName: presented.route.name,
      mountainName: mountain?.name,
    });
    if (!handoff) return;
    router.push({
      pathname: "/hike-tracking" as any,
      params: {
        trackingMode: "freehike",
        referenceRouteId: handoff.routeId,
        referenceRouteName: handoff.routeName,
        routeIdentityKey: handoff.routeId,
        summitIdentityKey: handoff.mountainId,
        hillName: handoff.mountainName,
      },
    });
  }

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
          onImageError={() => setHeroFailed(true)}
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
              <Text style={styles.heroElevation}>{mountain.summitElevation.value}</Text>
            ) : null}
            {mountain.place ? (
              <View style={styles.heroPlace}>
                <MapPin size={13} color={BASECAMP.textDim} />
                <Text style={styles.heroPlaceText} numberOfLines={2}>{mountain.place}</Text>
              </View>
            ) : null}
            <View style={styles.heroBadges}>
              <VerificationBadge state={mountain.verified ? "verified" : "unidentified"} />
            </View>
          </View>
        </SRHeroFrame>

        {/* ── Not in the verified catalogue ─────────────────────────────── */}
        {mountain.fallback ? (
          <View style={styles.gutter}>
            <SRPanel radius={16} style={styles.fallbackPanel}>
              <View style={styles.fallbackRow}>
                <Info size={16} color={EXPLORE.unverified} />
                <View style={styles.fallbackText}>
                  <Text style={styles.fallbackTitle}>{FALLBACK_NOTICE.title}</Text>
                  <Text style={styles.fallbackBody}>{FALLBACK_NOTICE.body}</Text>
                </View>
              </View>
            </SRPanel>
          </View>
        ) : null}

        {/* ── Overview ──────────────────────────────────────────────────── */}
        <Section
          entering={reducedMotion ? undefined : FadeInDown.delay(60).duration(360)}
          style={styles.gutter}
        >
          <SRPanel radius={16} style={styles.overviewPanel}>
            <View style={styles.overviewRow}>
              {mountain.overview.map(f => (
                <View key={f.key} style={styles.overviewItem}>
                  <Text style={styles.overviewValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {f.value ?? "—"}
                  </Text>
                  <Text style={styles.overviewLabel} numberOfLines={2}>{f.label}</Text>
                </View>
              ))}
            </View>
          </SRPanel>
          <Footnote>{ELEVATION_FOOTNOTE}</Footnote>
        </Section>

        {/* ── Routes, with the selected one expanded in place ───────────── */}
        <Section
          entering={reducedMotion ? undefined : FadeInDown.delay(110).duration(360)}
          style={styles.routesSection}
        >
          <View style={styles.gutter}>
            <SRSectionHeader
              title={`Routes (${routes.length})`}
              icon={<RouteIcon size={13} color={EXPLORE.accent} />}
            />
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
            <SREmptyState
              icon={<MountainIcon size={20} color={BASECAMP.textDim} />}
              title={NO_ROUTES_NOTICE.title}
              body={NO_ROUTES_NOTICE.body}
              style={styles.gutter}
            />
          ) : (
            <View style={[styles.gutter, styles.routeList]}>
              {sorted.map(route => (
                <View key={route.key}>
                  <RouteCard
                    route={route}
                    selected={route.key === selectedKey}
                    onPress={() => choose(route)}
                  />
                  {route.key === selectedKey && presented ? (
                    recordPending ? (
                      <SRPanel radius={16} style={styles.pending}>
                        <ActivityIndicator color={EXPLORE.accent} />
                        <Text style={styles.pendingText}>Reading route detail…</Text>
                      </SRPanel>
                    ) : (
                      <SelectedRoute
                        selected={presented}
                        dna={dna}
                        mountainSummitElevation={mountain.summitElevation}
                      />
                    )
                  ) : null}
                </View>
              ))}
              {!selected ? (
                <Text style={styles.pickerHint}>{routePickerHint(mountain.name)}</Text>
              ) : null}
            </View>
          )}
        </Section>

        {/* ── Practical information ─────────────────────────────────────── */}
        <Section
          entering={reducedMotion ? undefined : FadeInDown.delay(160).duration(360)}
          style={styles.practicalSection}
        >
          <View style={styles.gutter}>
            <SRSectionHeader title="Practical information" />
            <SRPanel radius={16} style={styles.practicalPanel}>
              <FactList facts={mountain.practical} />
            </SRPanel>
            <Footnote>{PRACTICAL_FOOTNOTE}</Footnote>
            {mountain.provenanceVersion ? (
              <Text style={styles.provenance} numberOfLines={2}>
                {`Summit Data Engine · provenance ${mountain.provenanceVersion}`}
              </Text>
            ) : null}
          </View>
        </Section>
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
  heroName: { ...TYPE.hero, fontSize: 34, lineHeight: 37, color: BASECAMP.text },
  heroElevation: { marginTop: 4, fontSize: 22, lineHeight: 26, fontFamily: "Inter_700Bold", color: BASECAMP.text },
  heroPlace: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6 },
  heroPlaceText: { ...TYPE.small, fontSize: 12.5, color: BASECAMP.textMuted, flexShrink: 1 },
  heroBadges: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 6 },

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

  routesSection: { marginTop: 18 },
  sort: { marginTop: 10, alignSelf: "flex-start" },
  routeList: { marginTop: 10, gap: 9 },
  pickerHint: { marginTop: 2, fontSize: 11, lineHeight: 15, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  pending: { marginTop: 9, padding: SP.xl, alignItems: "center", gap: SP.sm },
  pendingText: { ...TYPE.caption, color: BASECAMP.textDim },

  practicalSection: { marginTop: 20 },
  practicalPanel: { marginTop: 10 },
  provenance: { marginTop: 6, fontSize: 9.5, lineHeight: 13, fontFamily: "Inter_400Regular", color: BASECAMP.textFaint },
});
