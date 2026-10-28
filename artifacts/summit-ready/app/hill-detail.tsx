import { ArrowLeft, TrendingUp, MapPin, Map, Navigation, AlertCircle, Flag, Info, Compass, Star, Clock, Pencil, RotateCcw, CheckCircle, Play, PlusCircle } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
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
import { T } from "@/constants/theme";
import { useApp, type NearbyHill } from "@/context/AppContext";
import { BASECAMP, EXPLORE, TYPE } from "@/constants/tokens";
import { SRHeroFrame, SRScreenHeader } from "@/components/ui";
import { loadOverride, saveOverride, clearOverride, type StartPointOverride } from "@/utils/startPointOverrides";
import { appendApprovedImageRevision } from "@/utils/mountainImage";
import { expeditionStageArtwork } from "@/utils/expeditionStageArtwork";
import { refreshedMountainArtworkUri, watchMountainArtwork } from "@/utils/mountainArtworkSlots";
import {
  clearPersonalHillCover, personalHillCoverKey, readJourneyPhotos, readPersonalHillCover,
  savePersonalHillCover, type JourneyPhoto,
} from "@/utils/personalHillCover";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const DIFF_COLOR: Record<string, string> = {
  Easy: T.green,
  Moderate: T.blue,
  Hard: T.orange,
  Alpine: "#FF4444",
};

interface HillRoute {
  name: string;
  distance: number;
  elevationGain: number;
  difficulty: string;
  description: string;
  estimatedTime: string;
  isRecommended: boolean;
}

interface HillDetail {
  description: string;
  startPoint: {
    name: string;
    lat: number | null;
    lng: number | null;
    postcode?: string;
    directions: string;
    parkingNotes: string;
  };
  routes: HillRoute[];
  summitLat: number | null;
  summitLng: number | null;
  mapSearchContext?: string;
  provenance?: {
    mapCoordinates?: "verified" | "unverified_route_location" | "unavailable";
    startPoint?: "verified" | "unverified";
  };
}

import { openMapDirections } from "@/utils/openMaps";
import { hillMapTarget, hillMapNavigation } from "@/utils/hillMapTarget";
import { chooseNextExpeditionStage, findExpeditionStage } from "@/utils/expeditionStageOrder";
import { isRouteCompleted, routeCompletionKey } from "@/utils/stateReliability";
import { MountainWeatherCard } from "@/components/weather/MountainWeatherCard";
import { RouteIntelligencePresentation } from "@/components/RouteIntelligencePresentation";
import { mapTrainingTarget, mapExploreRoute, mapExpeditionStage, selectCanonicalRoute, type RouteReadResult, type RouteIntelligence } from "@/utils/routeIntelligence";
import { fetchCanonicalRouteRecord } from "@/utils/canonicalRouteApi";
import { buildExpeditionStageLaunchContext, buildFreeHikeLaunchContext } from "@/utils/trackingLaunchContext";
import type { CanonicalRouteRecord } from "@/utils/routeIntelligence";

export default function HillDetailScreen() {
  const insets = useSafeAreaInsets();
  const { userId, getToken } = useAuth();
  const { activeExpedition, patchExpedition } = useApp();
  const { name, location, lat, lng, elevation, elevationEstimated, distance, routeDistance, estimatedTime, routeType, grade, surface, emoji, expeditionMode, expeditionId, routeIdentityKey, summitIdentityKey, objectiveType, stageCompletionKey } =
    useLocalSearchParams<{
      name: string;
      location: string;
      elevationEstimated?: string;
      lat?: string;
      lng?: string;
      elevation?: string;
      distance?: string;
      routeDistance?: string;
      estimatedTime?: string;
      routeType?: string;
      grade?: string;
      surface?: string;
      emoji?: string;
      expeditionMode?: string;
      expeditionId?: string;
      routeIdentityKey?: string;
      summitIdentityKey?: string;
      objectiveType?: string;
      stageCompletionKey?: string;
    }>();
  const savedStage = activeExpedition?.virtualHills.find(hill =>
    !!routeIdentityKey && hill.routeIdentityKey === routeIdentityKey);
  const approachStage = savedStage?.distanceBasis === "one_way_approach" ? savedStage : null;

  const isExpeditionMode = expeditionMode === "true";
  const [stageSaving, setStageSaving] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);
  const stageExpedition = isExpeditionMode && expeditionId === activeExpedition?.id
    ? activeExpedition : null;
  const selectedStage = stageExpedition && stageCompletionKey
    ? findExpeditionStage(stageExpedition.virtualHills ?? [], stageCompletionKey) : null;
  const stageCompleted = !!selectedStage && isRouteCompleted(stageExpedition?.completedRoutes ?? [], selectedStage);
  const currentStage = stageExpedition?.virtualHills?.find(hill => !isRouteCompleted(stageExpedition.completedRoutes ?? [], hill));
  const stageIsNext = !!selectedStage && !!currentStage &&
    routeCompletionKey(selectedStage) === routeCompletionKey(currentStage);

  async function chooseThisStageNext() {
    if (stageSaving || !stageExpedition || !stageCompletionKey ||
        stageExpedition.expeditionStatus === "complete") return;
    const hills = chooseNextExpeditionStage(
      stageExpedition.virtualHills ?? [], stageExpedition.completedRoutes ?? [], stageCompletionKey,
    );
    if (!hills) {
      setStageError("This stage is no longer available to choose. Return to Basecamp and try again.");
      return;
    }
    setStageSaving(true);
    setStageError(null);
    try {
      // Field-only update: never reset the expedition, activity, or training goal.
      await patchExpedition(stageExpedition.id, { virtualHills: hills });
    } catch {
      setStageError("Could not save your stage order. Please try again before leaving this page.");
    } finally {
      setStageSaving(false);
    }
  }

  const [detail, setDetail] = useState<HillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState(false);
  const [directionsBusy, setDirectionsBusy] = useState(false);
  const [mapActionError, setMapActionError] = useState<string | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [directionResult, setDirectionResult] = useState<{
    status: "internet_lookup" | "gps_confirmed";
    name: string;
    address?: string;
    placeId?: string;
    lat: number;
    lng: number;
  } | null>(null);
  const [canonicalRecord, setCanonicalRecord] = useState<CanonicalRouteRecord | null>(null);

  const [imageError, setImageError] = useState(false);
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const [stageArtwork, setStageArtwork] = useState<{
    key: string; uri: string;
  } | null>(null);
  const stageArtworkKey = JSON.stringify([userId, name, lat, lng, isExpeditionMode]);
  useEffect(() => {
    if (!isExpeditionMode || !userId || !name) return;
    const controller = new AbortController();
    let stop: (() => void) | undefined;
    void expeditionStageArtwork({
      name, latitude: lat?.trim() ? Number(lat) : NaN,
      longitude: lng?.trim() ? Number(lng) : NaN,
    }, API_BASE, controller.signal).then(uri => {
      if (!uri || controller.signal.aborted) return;
      // Keep the stage's existing identity-bound image until shared artwork is
      // ready. Status-first polling preserves approvals and server rate limits.
      stop = watchMountainArtwork(uri, userId, () => tokenRef.current(),
        (revision, mountainId) => {
          if (controller.signal.aborted) return;
          setImageError(false);
          setStageArtwork({ key: stageArtworkKey,
            uri: refreshedMountainArtworkUri(uri, revision, mountainId) });
        });
    }).catch(error => {
      if (!controller.signal.aborted) console.warn("Stage mountain artwork unavailable", error);
    });
    return () => { controller.abort(); stop?.(); };
  }, [stageArtworkKey, isExpeditionMode, userId, name, lat, lng]);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [coverFailed, setCoverFailed] = useState(false);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [coverPhotos, setCoverPhotos] = useState<JourneyPhoto[]>([]);
  const [coverSaving, setCoverSaving] = useState(false);

  const [override, setOverride] = useState<StartPointOverride | null>(null);
  const [editingStart, setEditingStart] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftPostcode, setDraftPostcode] = useState("");
  const [draftDirections, setDraftDirections] = useState("");
  const [draftParking, setDraftParking] = useState("");

  const hillLat = lat ? parseFloat(lat) : null;
  const hillLng = lng ? parseFloat(lng) : null;
  const coverIdentity = {
    name: name ?? "",
    latitude: hillLat,
    longitude: hillLng,
    routeIdentityKey,
    summitIdentityKey,
  };
  const canSetCover = !!personalHillCoverKey(userId, coverIdentity);
  const showPersonalCover = !isExpeditionMode && !!coverUri && !coverFailed;

  useEffect(() => {
    let current = true;
    setCoverUri(null);
    setCoverFailed(false);
    void readPersonalHillCover(userId, coverIdentity).then(uri => {
      if (current) setCoverUri(uri);
    });
    return () => { current = false; };
  }, [userId, name, lat, lng, routeIdentityKey, summitIdentityKey]);

  async function openCoverPicker() {
    if (!userId || !activeExpedition?.id || !canSetCover) {
      Alert.alert("Journey photo unavailable", "Sign in and start an expedition to choose one of your journey photos for this hill.");
      return;
    }
    const photos = await readJourneyPhotos(userId, activeExpedition.id);
    if (!photos.length) {
      Alert.alert("No journey photos yet", "Add photos in your Expedition Journal, then return here to choose a personal cover.");
      return;
    }
    setCoverPhotos(photos);
    setCoverPickerOpen(true);
  }

  async function chooseCover(photo: JourneyPhoto) {
    if (!userId || !activeExpedition?.id || coverSaving) return;
    setCoverSaving(true);
    try {
      const saved = await savePersonalHillCover(userId, coverIdentity, activeExpedition.id, photo.id);
      if (!saved) throw new Error("Photo no longer exists in the journal");
      setCoverUri(photo.uri);
      setCoverFailed(false);
      setCoverPickerOpen(false);
    } catch {
      Alert.alert("Cover not saved", "This journey photo is no longer available. Please choose another.");
    } finally {
      setCoverSaving(false);
    }
  }

  async function resetCover() {
    if (!userId) return;
    try {
      await clearPersonalHillCover(userId, coverIdentity);
      setCoverUri(null);
      setCoverFailed(false);
    } catch {
      Alert.alert("Could not remove cover", "Please try again.");
    }
  }

  const heroImageUri = name && !imageError
    ? appendApprovedImageRevision(
        `${API_BASE}/mountain-image?name=${encodeURIComponent(name)}&location=${encodeURIComponent(location ?? "")}&width=960&height=520${routeIdentityKey ? `&routeIdentityKey=${encodeURIComponent(routeIdentityKey)}` : ""}${summitIdentityKey ? `&summitIdentityKey=${encodeURIComponent(summitIdentityKey)}` : ""}${Number.isFinite(hillLat) ? `&lat=${hillLat}` : ""}${Number.isFinite(hillLng) ? `&lng=${hillLng}` : ""}`,
        name,
      )
    : null;

  useEffect(() => {
    if (!name) return;
    setImageError(false);
    if (approachStage) {
      // Owner-reviewed approach facts need no new generated route research.
      // Summit coordinates are not parking coordinates or a descent track.
      setDetail({
        description: "Owner-reviewed approximate summit approach. Plan and assess the full outing separately.",
        startPoint: {
          name: approachStage.approachStart ?? "Named start; coordinates not verified",
          lat: null, lng: null,
          directions: "Start location is named for planning only. Check access and parking locally.",
          parkingNotes: "Parking coordinates and availability have not been verified.",
        },
        routes: [],
        summitLat: approachStage.lat ?? null,
        summitLng: approachStage.lng ?? null,
        provenance: { mapCoordinates: "verified", startPoint: "unverified" },
      });
      setDetailError(false);
      setDetailLoading(false);
      return;
    }

    async function fetchDetail() {
      try {
        const res = await fetch(`${API_BASE}/hill-detail`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hillName: name,
            routeIdentityKey: routeIdentityKey || undefined,
            summitIdentityKey: summitIdentityKey || undefined,
            location: location ?? "",
            summitLat: Number.isFinite(hillLat) ? hillLat : undefined,
            summitLng: Number.isFinite(hillLng) ? hillLng : undefined,
            elevation: elevation ? parseFloat(elevation) : undefined,
            routeDistance: routeDistance ? parseFloat(routeDistance) : undefined,
            estimatedTime: estimatedTime || undefined,
            routeType: routeType || undefined,
            grade: grade ?? undefined,
            surface: surface ?? undefined,
          }),
        });
        if (!res.ok) throw new Error("Failed");
        const data: HillDetail = await res.json();
        setDetail(data);
      } catch {
        setDetailError(true);
      } finally {
        setDetailLoading(false);
      }
    }

    fetchDetail();
  }, [name, location, lat, lng, elevation, routeDistance, estimatedTime, routeType, grade, surface, routeIdentityKey, summitIdentityKey, approachStage]);

  useEffect(() => {
    if (!routeIdentityKey?.startsWith("sde:route:") || !summitIdentityKey?.startsWith("sde:mountain:")) {
      setCanonicalRecord(null);
      return;
    }
    void fetchCanonicalRouteRecord(routeIdentityKey, summitIdentityKey)
      .then(result => {
        setCanonicalRecord(result.record);
      });
  }, [routeIdentityKey, summitIdentityKey]);

  // Load any saved user correction for this hill's start point
  useEffect(() => {
    if (!name) return;
    loadOverride(name).then(setOverride);
  }, [name]);

  // Merged start point: server data + any user correction on top
  const startPoint = detail
    ? { ...detail.startPoint, ...(override ?? {}) }
    : null;

  function openEditSheet() {
    if (!detail) return;
    const sp = { ...detail.startPoint, ...(override ?? {}) };
    setDraftName(sp.name);
    setDraftPostcode(sp.postcode ?? "");
    setDraftDirections(sp.directions);
    setDraftParking(sp.parkingNotes ?? "");
    setEditingStart(true);
  }

  async function handleSaveEdit() {
    if (!name || !detail) return;
    const next: StartPointOverride = {
      name: draftName.trim() || detail.startPoint.name,
      postcode: draftPostcode.trim(),
      directions: draftDirections.trim() || detail.startPoint.directions,
      parkingNotes: draftParking.trim(),
    };
    await saveOverride(name, next);
    setOverride(next);
    setEditingStart(false);
  }

  async function handleResetToOriginal() {
    if (!name) return;
    await clearOverride(name);
    setOverride(null);
    setEditingStart(false);
  }

  const gradeColor = DIFF_COLOR[grade ?? ""] ?? T.blue;
  const topInset = Platform.OS === "web" ? 20 : insets.top;
  const mapSearchContext = detail?.mapSearchContext ?? location;
  const hasVerifiedStartPoint = detail?.provenance?.startPoint === "verified" &&
    Number.isFinite(startPoint?.lat) && Number.isFinite(startPoint?.lng);
  const mapTarget = hillMapTarget({ lat: hillLat, lng: hillLng, routeIdentityKey, detail });

  const directionTarget = {
    hillName: name ?? "",
    location: mapSearchContext ?? "",
    routeIdentityKey: routeIdentityKey || undefined,
    summitIdentityKey: summitIdentityKey || undefined,
    summitLat: mapTarget?.lat,
    summitLng: mapTarget?.lng,
  };
  const candidateKey = `directions:candidate:${routeIdentityKey || summitIdentityKey || name}:${mapTarget?.lat}:${mapTarget?.lng}`;

  async function openStartPointDirections() {
    if (directionsBusy) return;
    setMapActionError(null);
    if (!mapTarget) {
      setMapActionError("This hill has no mapped location. Search for it again in Explore to refresh its location before getting directions.");
      return;
    }
    setDirectionsBusy(true);
    try {
      let result = directionResult;
      if (!result) {
        try {
          const cached = await AsyncStorage.getItem(candidateKey);
          if (cached) {
            const record = JSON.parse(cached) as { result: NonNullable<typeof directionResult>; expires: number };
            if (record.expires > Date.now() && record.result?.status === "internet_lookup" &&
                Number.isFinite(record.result.lat) && Number.isFinite(record.result.lng) && record.result.placeId) {
              result = record.result;
            }
          }
        } catch { /* An unavailable or corrupt optional cache requires a fresh lookup. */ }
      }
      if (!result) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        let body;
        try {
          const response = await fetch(`${API_BASE}/directions/lookup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(directionTarget),
            signal: controller.signal,
          });
          body = await response.json();
          if (!response.ok) throw new Error(body.error || "No suitable parking place was found.");
        } finally {
          clearTimeout(timeout);
        }
        result = body;
        if (result?.status === "internet_lookup") {
          await AsyncStorage.setItem(candidateKey, JSON.stringify({
            result, expires: Date.now() + 24 * 60 * 60 * 1000,
          })).catch(() => {}); // An optional cache failure must not prevent directions.
        }
      }
      if (!result || !Number.isFinite(result.lat) || !Number.isFinite(result.lng) ||
          Math.abs(result.lat) > 90 || Math.abs(result.lng) > 180 ||
          typeof result.name !== "string" || !result.name.trim()) {
        throw new Error("No mapped destination was returned.");
      }
      setDirectionResult(result);
      // Web browsers may block a new tab after an asynchronous lookup. Render
      // an explicit link below so opening it has a fresh user gesture instead.
      if (Platform.OS !== "web") {
        const opened = await openMapDirections(result.lat, result.lng, result.name);
        if (!opened) setMapActionError("Could not open your maps app. Tap Open parking directions below to retry.");
      }
    } catch (error) {
      setMapActionError(error instanceof Error && error.name === "AbortError"
        ? "Parking lookup took too long. Check your connection and try again."
        : error instanceof Error ? error.message : "Directions are unavailable. Please try again later.");
    } finally {
      setDirectionsBusy(false);
    }
  }

  async function confirmDirectionsWithGps() {
    if (gpsBusy || !directionResult?.placeId || !userId) {
      if (!userId) Alert.alert("Sign in required", "Sign in to confirm this destination.");
      return;
    }
    setGpsBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Location permission is needed to confirm your arrival.");
      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const token = await getToken();
      if (!token) throw new Error("Sign in to confirm this destination.");
      const response = await fetch(`${API_BASE}/directions/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...directionTarget,
          placeId: directionResult.placeId,
          fix: {
            lat: fix.coords.latitude, lng: fix.coords.longitude,
            accuracy: fix.coords.accuracy, timestamp: fix.timestamp,
          },
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not confirm your arrival.");
      setDirectionResult(body);
      await AsyncStorage.removeItem(candidateKey);
      Alert.alert("Location confirmed", "This parking pin is saved for future users. Your exact GPS position is not saved. Check local parking and access signs.");
    } catch (error) {
      Alert.alert("Location not confirmed", error instanceof Error ? error.message : "Try again when you arrive.");
    } finally {
      setGpsBusy(false);
    }
  }

  const sdeResult: RouteReadResult<RouteIntelligence> = canonicalRecord
    ? selectCanonicalRoute({
        routeId: routeIdentityKey,
        mountainId: summitIdentityKey,
        candidates: [canonicalRecord],
      })
    : {
        availability: "unavailable",
        value: null,
        reasons: [routeIdentityKey ? "stale_compatibility_record" : "missing_identity"],
      };

  const trainingTarget = objectiveType === "training" ? mapTrainingTarget(sdeResult) : null;
  const exploreTarget = (!objectiveType && !isExpeditionMode) ? mapExploreRoute(sdeResult) : null;
  const expeditionTarget = isExpeditionMode ? mapExpeditionStage({
    name: name ?? "",
    simulatedElevationGainM: elevation ? parseFloat(elevation) : 0,
    routeIdentityKey: routeIdentityKey ?? undefined,
    summitIdentityKey: summitIdentityKey ?? undefined,
  }, sdeResult) : null;

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: isExpeditionMode
            ? (Platform.OS === "web" ? 120 : insets.bottom + 110)
            : (Platform.OS === "web" ? 60  : insets.bottom + 40),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Expedition routes keep their identity-bound artwork. Training hills
            use a clearly illustrative local asset or the owner's chosen journal photo. */}
        <SRHeroFrame
          uri={isExpeditionMode
            ? !imageError && stageArtwork?.key === stageArtworkKey ? stageArtwork.uri : heroImageUri
            : showPersonalCover ? coverUri : null}
          source={!isExpeditionMode && !showPersonalCover
            ? require("../assets/images/local-hill-illustration.png")
            : undefined}
          onImageError={() => {
            if (showPersonalCover) setCoverFailed(true);
            else setImageError(true);
          }}
          minHeight={300}
          dim={0.95}
          style={{ justifyContent: "space-between" }}
        >
          <View style={{ paddingTop: topInset + 8 }}>
            <SRScreenHeader title="" onBack={() => router.back()} />
          </View>
          {!isExpeditionMode ? (
            <Text style={styles.coverLabel}>
              {showPersonalCover ? "YOUR JOURNEY PHOTO" : "ILLUSTRATIVE IMAGE"}
            </Text>
          ) : stageArtwork?.key === stageArtworkKey && !imageError ? (
            <Text style={styles.coverLabel}>AI MOUNTAIN ILLUSTRATION</Text>
          ) : null}

          <View style={{ paddingHorizontal: BASECAMP.gutter, paddingBottom: 16 }}>
            <View style={styles.heroMeta}>
              {grade ? (
                <View style={[styles.gradeBadge, { backgroundColor: gradeColor + "25" }]}>
                  <Text style={[styles.gradeText, { color: gradeColor }]}>{grade}</Text>
                </View>
              ) : null}
              {elevation ? (
                <View style={styles.elevBadge}>
                  <TrendingUp size={11} color={EXPLORE.accent} />
                  <Text style={styles.elevText}>{approachStage ? `${elevation} m · Approx. ascent` : `${elevationEstimated === "true" ? "~" : ""}${elevation} m ${elevationEstimated === "true" ? "estimated climb" : "per climb"}`}</Text>
                </View>
              ) : null}
              {distance ? (
                <View style={styles.elevBadge}>
                  <MapPin size={11} color={EXPLORE.verified} />
                  <Text style={styles.elevText}>
                    {approachStage ? `${approachStage.approachDistanceKm} km · Approach distance` : `${Number.isFinite(Number(distance)) ? Number(distance).toFixed(1) : distance} km away`}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.heroName} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.62}>
              {name}
            </Text>
            {surface ? <Text style={styles.heroSurface} numberOfLines={2}>{surface}</Text> : null}
          </View>
        </SRHeroFrame>

        {!isExpeditionMode && canSetCover ? (
          <View style={styles.coverActions}>
            <TouchableOpacity onPress={() => void openCoverPicker()} accessibilityRole="button" style={styles.coverAction}>
              <Text style={styles.coverActionText}>Choose a journey photo as my cover</Text>
            </TouchableOpacity>
            {coverUri ? (
              <TouchableOpacity onPress={() => void resetCover()} accessibilityRole="button" style={styles.coverAction}>
                <Text style={styles.coverActionText}>Use illustration</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.coverPrivacy}>Only you see your chosen cover on this device.</Text>
          </View>
        ) : null}

        <View style={styles.body}>
          {selectedStage ? (
            <View style={{ marginHorizontal: 18, marginBottom: 16 }}>
              <Text style={{ color: T.textMuted, fontSize: 13, marginBottom: 8 }}>
                {stageCompleted ? "You have completed this expedition stage."
                  : stageIsNext ? "This is your next expedition stage."
                  : "You can do the unfinished stages in the order that suits you."}
              </Text>
              {!stageCompleted && stageExpedition?.expeditionStatus !== "complete" ? (
                <TouchableOpacity
                  testID="expedition-choose-stage-next"
                  accessibilityRole="button"
                  accessibilityLabel={`Do ${selectedStage.name} next`}
                  disabled={stageSaving || (stageIsNext && !stageError)}
                  onPress={() => void chooseThisStageNext()}
                  style={{
                    backgroundColor: T.greenDim, borderWidth: 1, borderColor: T.green,
                    borderRadius: 12, padding: 16, alignItems: "center",
                    opacity: stageSaving ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: T.green, fontWeight: "700" }}>
                    {stageSaving ? "Saving stage order…" : stageIsNext && !stageError ? "Selected as your next stage" : "Do this stage next"}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {stageError ? (
                <Text accessibilityRole="alert" style={{ color: T.orange, marginTop: 8 }}>{stageError}</Text>
              ) : null}
            </View>
          ) : null}
          <View style={{ marginHorizontal: -16 }}><MountainWeatherCard latitude={hillLat} longitude={hillLng} subjectName={name} /></View>
          {/* Quick map actions */}
          <Animated.View entering={FadeInDown.delay(60).duration(400)}>
            <View style={styles.mapActionsRow}>
              <TouchableOpacity
                style={styles.mapActionBtn}
                onPress={() => {
                  setMapActionError(null);
                  if (mapTarget) router.push(hillMapNavigation(mapTarget));
                  else setMapActionError("Map location unavailable. Search for this hill again in Explore to refresh its location. We won't guess an address from its name.");
                }}
                accessibilityRole="button"
                activeOpacity={0.8}
              >
                <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
                <Map size={15} color={T.green} />
                <Text style={styles.mapActionText}>View on map</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mapActionBtn}
                onPress={() => void openStartPointDirections()}
                disabled={directionsBusy}
                accessibilityRole="button"
                activeOpacity={0.8}
              >
                <LinearGradient colors={[T.blueDim, "transparent"]} style={StyleSheet.absoluteFill} />
                {directionsBusy ? <ActivityIndicator size="small" color={T.blue} /> : <Navigation size={15} color={T.blue} />}
                <Text style={[styles.mapActionText, { color: T.blue }]}>{directionsBusy ? "Finding parking…" : "Get directions"}</Text>
              </TouchableOpacity>
            </View>
            {mapTarget && !mapTarget.verified ? (
              <Text style={{ color: T.textMuted, fontSize: 12, paddingHorizontal: 18, paddingBottom: 10 }}>
                Map shows the selected route location, not a verified summit or route start.
              </Text>
            ) : null}
            {mapActionError ? (
              <Text accessibilityRole="alert" style={{ color: T.orange, fontSize: 13, paddingHorizontal: 18, paddingBottom: 12 }}>
                {mapActionError}
              </Text>
            ) : null}
            {directionResult && (
              <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
                <TouchableOpacity
                  accessibilityRole="link"
                  onPress={() => void openMapDirections(directionResult.lat, directionResult.lng, directionResult.name).then(opened => {
                    setMapActionError(opened ? null : "Could not open directions. Check that your browser allows map links and try again.");
                  })}
                  style={{ paddingVertical: 12 }}
                >
                  <Text style={{ color: T.blue, fontWeight: "600" }}>Open parking directions ↗</Text>
                </TouchableOpacity>
                <Text style={{ color: T.textMuted, fontSize: 12 }}>
                  {directionResult.status === "gps_confirmed" ? "GPS-confirmed arrival" : "OpenStreetMap parking pin — not yet GPS-confirmed"}
                  {" · "}{directionResult.name}
                  {directionResult.address ? `, ${directionResult.address}` : ""}
                  {" · "}Not a confirmed route start or parking permission. © OpenStreetMap contributors.
                </Text>
                {directionResult.status === "internet_lookup" && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={gpsBusy}
                    onPress={() => void confirmDirectionsWithGps()}
                    style={{ marginTop: 8, paddingVertical: 7 }}
                  >
                    <Text style={{ color: T.blue, fontSize: 13 }}>
                      {gpsBusy ? "Checking your GPS…" : "I’m here — confirm & share parking pin"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Animated.View>

          {detailLoading && (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={T.green} />
              <Text style={styles.loadingText}>Loading hill info…</Text>
            </View>
          )}

          {detailError && (
            <View style={styles.errorCard}>
              <AlertCircle size={18} color={T.orange} />
              <Text style={styles.errorText}>
                Couldn't load detailed info for this hill. Check your connection and try again.
              </Text>
            </View>
          )}

          {detail && (
            <>
              {/* Description */}
              <Animated.View entering={FadeInDown.delay(80).duration(400)}>
                <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this summit</Text>
              {approachStage && (
                <View style={{ paddingVertical: 12, gap: 8 }}>
                  <Text style={{ color: T.text, lineHeight: 20 }}>{approachStage.routeName}{"\n"}Start: {approachStage.approachStart}</Text>
                  <Text style={{ color: T.textMuted, lineHeight: 20 }}>Approximate one-way approach, including pre-summit undulations. Return walking is additional. No navigable track is supplied. The summit credit endpoint does not define a safe descent.</Text>
                  {!!approachStage.safetyWarning && <Text style={{ color: T.orange, lineHeight: 20 }}>{approachStage.safetyWarning}</Text>}
                  {!!approachStage.evidenceNote && <Text style={{ color: T.textMuted, lineHeight: 20 }}>{approachStage.evidenceNote}</Text>}
                </View>
              )}
                  <Text style={styles.descriptionText}>{detail.description}</Text>
                </View>
              </Animated.View>

              {/* Start Point */}
              <Animated.View entering={FadeInDown.delay(120).duration(400)}>
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Flag size={15} color={T.green} />
                    <Text style={styles.sectionTitle}>Start point</Text>
                  </View>

                  <View style={styles.startPointCard}>
                    <LinearGradient
                      colors={[T.greenDim, "transparent"]}
                      style={StyleSheet.absoluteFill}
                    />

                    {/* Name row + edit button */}
                    <View style={styles.startNameRow}>
                      <View style={styles.startIconBox}>
                        <Flag size={16} color={T.green} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.startName}>{startPoint!.name}</Text>
                        {startPoint!.postcode ? (
                          <Text style={styles.startCoords}>{startPoint!.postcode}</Text>
                        ) : hasVerifiedStartPoint ? (
                          <Text style={styles.startCoords}>
                            {startPoint!.lat!.toFixed(5)}, {startPoint!.lng!.toFixed(5)}
                          </Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        style={styles.editStartBtn}
                        onPress={openEditSheet}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Pencil size={13} color={T.textMuted} />
                      </TouchableOpacity>
                    </View>

                    {/* "Corrected by you" badge */}
                    {override && (
                      <View style={styles.correctedBadge}>
                        <CheckCircle size={11} color={T.green} />
                        <Text style={styles.correctedBadgeText}>Corrected by you</Text>
                      </View>
                    )}

                    <View style={styles.startDivider} />

                    <Text style={styles.startDetail}>{startPoint!.directions}</Text>

                    {startPoint!.parkingNotes ? (
                      <View style={styles.parkingRow}>
                        <Info size={12} color={T.textMuted} />
                        <Text style={styles.parkingText}>{startPoint!.parkingNotes}</Text>
                      </View>
                    ) : null}

                    <View style={styles.startActionsRow}>
                      <TouchableOpacity
                        style={[styles.startMapBtn, { borderColor: T.blue + "50", flex: 1 }]}
                        onPress={openStartPointDirections}
                        activeOpacity={0.8}
                      >
                        <Navigation size={13} color={T.blue} />
                        <Text style={[styles.startMapBtnText, { color: T.blue }]}>Drive there</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Animated.View>

              {/* Routes */}
              <Animated.View entering={FadeInDown.delay(160).duration(400)}>
                <RouteIntelligencePresentation
                  routes={detail.routes}
                  objectiveType={objectiveType}
                  trainingTarget={trainingTarget}
                  expeditionStage={expeditionTarget}
                  exploreRoute={exploreTarget}
                  onNavigateToStart={() => void openStartPointDirections()}
                />
              </Animated.View>
            </>
          )}
        </View>
      </ScrollView>

      {/* ── Expedition mode — tracking and manual completion CTAs ── */}
      {isExpeditionMode && (
        <View style={[styles.expeditionCtaBar, { paddingBottom: Platform.OS === "web" ? 20 : insets.bottom + 8 }]}>
          <TouchableOpacity
            style={styles.manualLogBtn}
            activeOpacity={0.8}
            onPress={() =>
              router.push({
                pathname: "/log-hill" as any,
                params: {
                  manualHillName: name,
                  returnTo: "expedition-basecamp",
                  location: location ?? "",
                  elevation: elevation ?? "",
                  distance: distance ?? "",
                  routeDistance: routeDistance ?? "",
                  estimatedTime: estimatedTime ?? "",
                  routeType: routeType ?? "",
                  grade: grade ?? "",
                  surface: surface ?? "",
                  emoji: emoji ?? "",
                  routeIdentityKey: routeIdentityKey ?? "",
                  summitIdentityKey: summitIdentityKey ?? "",
                  objectiveType: objectiveType ?? "",
                  expeditionId: expeditionId ?? "",
                },
              })
            }
          >
            <PlusCircle size={16} color={BASECAMP.textMuted} />
            <Text style={styles.manualLogText}>Log manually</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.expeditionStartBtn}
            activeOpacity={0.85}
            onPress={() => {
              const hill: NearbyHill = {
                name: name ?? "",
                routeIdentityKey: routeIdentityKey || undefined,
                routeId: routeIdentityKey || undefined,
                summitIdentityKey: summitIdentityKey || undefined,
                summitId: summitIdentityKey || undefined,
                summitName: name ?? "",
                routeName: routeType || undefined,
                objectiveType: objectiveType === "manual_summit" ? "manual_summit" : undefined,
                elevation: Number(elevation) || 0,
                distance: Number(distance) || Number(routeDistance) || 0,
                repeats: 1,
                totalElevation: Number(elevation) || 0,
                surface: surface || "unknown",
                grade: grade || "Moderate",
                emoji: emoji || "⛰️",
                routeDistance: Number(routeDistance) || undefined,
                estimatedTime: estimatedTime || undefined,
                routeType: routeType === "circular" || routeType === "out-and-back" ? routeType : "hill",
              };
              const launch = isExpeditionMode
                ? buildExpeditionStageLaunchContext(hill, expeditionId ?? "", activeExpedition?.virtualHikeProgress
                  ? {
                      ...activeExpedition.virtualHikeProgress,
                      completedRoutes: activeExpedition.completedRoutes,
                      expeditionStatus: activeExpedition.expeditionStatus,
                    }
                  : undefined, {
                    location: location ?? "",
                    lat: hillLat,
                    lng: hillLng,
                    detail,
                    startPoint,
                    routeDistance: routeDistance ? Number(routeDistance) : undefined,
                    estimatedTime,
                  })
                : buildFreeHikeLaunchContext("training", expeditionId);
              router.push({ pathname: "/hike-tracking" as any, params: launch as any });
            }}
          >
            <LinearGradient
              colors={[EXPLORE.accent, "#0E63C8"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.expeditionStartGrad}
            >
              <Play size={15} color={EXPLORE.accentInk} fill={EXPLORE.accentInk} />
              <Text style={styles.expeditionStartText}>Start stage</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={coverPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCoverPickerOpen(false)}
      >
        <View style={styles.coverModalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setCoverPickerOpen(false)} accessibilityLabel="Close cover picker" />
          <View style={[styles.coverModal, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.coverModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.coverModalTitle}>Choose your hill cover</Text>
                <Text style={styles.coverPrivacy}>Photos from your current expedition journal. Only you can see this cover.</Text>
              </View>
              <TouchableOpacity onPress={() => setCoverPickerOpen(false)} accessibilityRole="button" accessibilityLabel="Close cover picker">
                <Text style={styles.coverActionText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.coverPhotoGrid}>
              {coverPhotos.map((photo, index) => (
                <TouchableOpacity
                  key={photo.id}
                  onPress={() => void chooseCover(photo)}
                  disabled={coverSaving}
                  accessibilityRole="button"
                  accessibilityLabel={`Use journey photo ${index + 1} as my cover`}
                  style={styles.coverPhoto}
                >
                  <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Edit start point sheet ── */}
      <Modal
        visible={editingStart}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingStart(false)}
      >
        <KeyboardAvoidingView
          style={styles.sheetBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setEditingStart(false)}
          />
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Correct start point</Text>
                <Text style={styles.sheetSubtitle}>Your changes are saved on this device only</Text>
              </View>
              <TouchableOpacity
                onPress={() => setEditingStart(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.sheetCancelX}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.sheetScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.fieldLabel}>Car park / trailhead name</Text>
              <TextInput
                style={styles.fieldInput}
                value={draftName}
                onChangeText={setDraftName}
                placeholder="e.g. Musbury Rocks Car Park"
                placeholderTextColor={T.textMuted}
                returnKeyType="next"
              />

              <Text style={styles.fieldLabel}>Postcode</Text>
              <TextInput
                style={styles.fieldInput}
                value={draftPostcode}
                onChangeText={setDraftPostcode}
                placeholder="e.g. BB4 7LZ"
                placeholderTextColor={T.textMuted}
                autoCapitalize="characters"
                returnKeyType="next"
              />

              <Text style={styles.fieldLabel}>Directions</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMulti]}
                value={draftDirections}
                onChangeText={setDraftDirections}
                placeholder="How to get there by road or public transport…"
                placeholderTextColor={T.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text style={styles.fieldLabel}>Parking notes (optional)</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMulti]}
                value={draftParking}
                onChangeText={setDraftParking}
                placeholder="Free / paid, spaces, any access notes…"
                placeholderTextColor={T.textMuted}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={styles.sheetSaveBtn}
                  onPress={handleSaveEdit}
                  activeOpacity={0.8}
                >
                  <CheckCircle size={15} color="#fff" />
                  <Text style={styles.sheetSaveBtnText}>Save correction</Text>
                </TouchableOpacity>

                {override && (
                  <TouchableOpacity
                    style={styles.sheetResetBtn}
                    onPress={handleResetToOriginal}
                    activeOpacity={0.8}
                  >
                    <RotateCcw size={14} color={T.textMuted} />
                    <Text style={styles.sheetResetBtnText}>Reset to original</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  coverLabel: {
    position: "absolute", top: 62, right: BASECAMP.gutter,
    ...TYPE.eyebrow, color: BASECAMP.textStrong,
    backgroundColor: BASECAMP.glass, paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 5, overflow: "hidden",
  },
  coverActions: { paddingHorizontal: BASECAMP.gutter, paddingVertical: 10, gap: 3, backgroundColor: BASECAMP.ink },
  coverAction: { alignSelf: "flex-start", minHeight: 38, justifyContent: "center" },
  coverActionText: { ...TYPE.smallBold, color: EXPLORE.accent },
  coverPrivacy: { ...TYPE.caption, color: BASECAMP.textDim },
  coverModalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "flex-end" },
  coverModal: {
    maxHeight: "70%", padding: BASECAMP.gutter, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    backgroundColor: BASECAMP.ink, borderWidth: 1, borderColor: BASECAMP.glassBorder,
  },
  coverModalHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  coverModalTitle: { ...TYPE.bodyBold, color: BASECAMP.text, marginBottom: 4 },
  coverPhotoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: 20 },
  coverPhoto: { width: "47%", height: 120, borderRadius: 8, overflow: "hidden", backgroundColor: BASECAMP.glass },
  heroContainer: { position: "relative" },
  heroImage: { width: "100%", height: 300 },
  fallbackEmoji: { fontSize: 64, textAlign: "center" },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  heroOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    gap: 6,
  },
  heroMeta: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  gradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gradeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  elevBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  elevText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#fff" },
  /* The scrim already carries the contrast, so the title no longer needs a
     text shadow to be readable — the shadow was fighting the hero treatment. */
  heroName: { ...TYPE.hero, fontSize: 32, lineHeight: 35, color: BASECAMP.text },
  heroSurface: { marginTop: 4, ...TYPE.small, fontSize: 13, color: BASECAMP.textMuted },

  body: { paddingHorizontal: 18, paddingTop: 16, gap: 4 },

  mapActionsRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  mapActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: T.green + "40",
    backgroundColor: T.card,
    overflow: "hidden",
  },
  mapActionText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: T.green,
  },

  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: T.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.cardBorder,
    padding: 20,
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: T.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.orange + "30",
    padding: 16,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    lineHeight: 20,
  },

  section: { marginBottom: 20 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.text },
  descriptionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    lineHeight: 22,
    backgroundColor: T.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.cardBorder,
    padding: 16,
  },

  startPointCard: {
    backgroundColor: T.card,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: T.green + "30",
    padding: 16,
    gap: 10,
    overflow: "hidden",
  },
  startNameRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  startIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: T.greenDim,
    alignItems: "center",
    justifyContent: "center",
  },
  startName: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.text },
  startCoords: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  startDivider: { height: 1, backgroundColor: T.border },
  startDetail: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    lineHeight: 20,
  },
  parkingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: T.surface,
    borderRadius: 5,
    padding: 10,
  },
  parkingText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    lineHeight: 18,
  },
  startActionsRow: { flexDirection: "row", gap: 8 },
  startMapBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: T.green + "50",
    backgroundColor: T.surface,
  },
  startMapBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: T.green,
  },

  routeCard: {
    backgroundColor: T.card,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: T.cardBorder,
    padding: 16,
    marginBottom: 10,
    gap: 10,
    overflow: "hidden",
  },
  routeCardRecommended: { borderColor: T.green + "40" },
  routeHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  recommendedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: T.greenDim,
  },
  recommendedText: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.green },
  routeName: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.text },
  diffBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  diffText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  routeStats: { flexDirection: "row", gap: 16 },
  routeStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  routeStatVal: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text },
  routeStatLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  routeDescription: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    lineHeight: 20,
  },
  routeMapBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: T.blue + "40",
    backgroundColor: T.surface,
  },
  routeMapBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: T.blue,
  },

  editStartBtn: {
    width: 30,
    height: 30,
    borderRadius: 5,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
  },
  correctedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: T.greenDim,
  },
  correctedBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: T.green,
  },

  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheetContainer: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderColor: T.cardBorder,
    paddingHorizontal: 20,
    paddingBottom: 36,
    maxHeight: "85%",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.border,
    alignSelf: "center",
    marginVertical: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: T.text,
  },
  sheetSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    marginTop: 2,
  },
  sheetCancelX: {
    fontSize: 16,
    color: T.textMuted,
    paddingTop: 2,
  },
  sheetScroll: { flexGrow: 0 },

  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: T.textMuted,
    marginBottom: 6,
    marginTop: 14,
  },
  fieldInput: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: T.text,
  },
  fieldInputMulti: {
    minHeight: 72,
    paddingTop: 11,
  },

  sheetActions: { gap: 10, marginTop: 22 },
  sheetSaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: T.green,
    borderRadius: 7,
    paddingVertical: 14,
  },
  sheetSaveBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  sheetResetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: T.border,
  },
  sheetResetBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: T.textMuted,
  },

  // ── Expedition mode sticky CTA ─────────────────────────────────────────────
  /* Stage actions: the same sticky bar the rest of the app uses, so Start
     Stage reads identically to Start Route on a mountain page. */
  expeditionCtaBar: {
    position:        "absolute",
    bottom:          0,
    left:            0,
    right:           0,
    paddingHorizontal: BASECAMP.gutter,
    paddingTop:      12,
    backgroundColor: BASECAMP.navGlass,
    borderTopWidth:  1,
    borderTopColor:  BASECAMP.navBorder,
  },
  expeditionStartBtn: { borderRadius: 7, overflow: "hidden" },
  manualLogBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 46,
    marginBottom: 8,
    borderRadius: 6.5,
    borderWidth: 1,
    borderColor: BASECAMP.panelSubBorder,
    backgroundColor: BASECAMP.panelSub,
  },
  manualLogText: { ...TYPE.bodyBold, fontSize: 14, color: BASECAMP.textStrong },
  expeditionStartGrad: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:             9,
    minHeight:       50,
    borderRadius:    7,
  },
  expeditionStartText: { ...TYPE.bodyBold, fontSize: 15, color: EXPLORE.accentInk },
});
