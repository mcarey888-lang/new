import {
  ArrowLeft,
  Bookmark,
  CheckCircle,
  Clock,
  ExternalLink,
  Flag,
  Info,
  MapPin,
  Map,
  PenLine,
  Navigation,
  Trash2,
  TrendingUp,
  Wind,
  Package,
} from "lucide-react-native";
import { Image } from "react-native";
import { TrailMapModal } from "@/components/TrailMapModal";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { T } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { SAMPLE_TRAILS } from "@/constants/trailData";
import type { Trail, TrailBenefit } from "@/constants/trailData";
import { LogHikeModal } from "@/components/LogHikeModal";
import { readLiveTrailsFromCache } from "@/utils/liveTrailsCache";
import { openMapPin, openMapDirections } from "@/utils/openMaps";

const DIFF_COLOR: Record<string, string> = {
  Easy: T.green, Moderate: T.blue, Hard: T.orange,
};

const ROUTE_LABEL: Record<string, string> = {
  loop: "🔄 Loop",
  "out-and-back": "↔️ Out & back",
  "point-to-point": "→ Point-to-point",
};

const TERRAIN_EMOJI: Record<string, string> = {
  woodland: "🌲", hill: "⛰️", mountain: "🏔️",
  coastal: "🌊", road: "🛣️", mixed: "🗺️",
};

const BENEFIT_LABEL: Record<TrailBenefit, string> = {
  cardio: "Good for cardio",
  elevation: "Good for elevation training",
  endurance: "Good for long endurance",
  "pack weight": "Good for pack weight training",
};

const BENEFIT_COLOR: Record<TrailBenefit, string> = {
  cardio: T.green,
  elevation: T.orange,
  endurance: T.purple,
  "pack weight": T.blue,
};

const BEST_FOR_LABEL: Record<string, string> = {
  training: "🏃 Training",
  "family walk": "👨‍👩‍👧 Family",
  "summit prep": "🏔️ Summit prep",
  "scenic walk": "📸 Scenic",
};

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const HERO_H = 290;

function extractLandmarkName(trailName: string): string {
  return trailName
    .replace(/\s+via\s+.+$/i, "")
    .replace(/\s+(Circular|Circuit|Loop)$/i, "")
    .replace(/\s+(Tourist\s+Route|Easy\s+Day|Long\s+Walk|Route|Walk|Path|Section)$/i, "")
    .replace(/\s+(North|South|East|West)\s+Ridge$/i, "")
    .trim();
}

const KIT_CHECKLIST = [
  "Map & compass (or GPS device)",
  "Waterproof jacket & trousers",
  "Warm mid-layer fleece",
  "Water — minimum 1.5L per person",
  "High-energy snacks & lunch",
  "First aid kit",
  "Head torch with spare batteries",
  "Whistle & emergency foil blanket",
  "Sturdy walking boots",
  "Trekking poles (optional but helpful on descents)",
];

interface TrailStartPoint {
  name: string;
  lat: number;
  lng: number;
  directions: string;
  parkingNotes: string;
}

export default function TrailDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const { savedTrailIds, completedTrailIds, saveTrail, unsaveTrail, completeTrail, uncompleteTrail, customRoutes, deleteCustomRoute, trainingPlan } = useApp();
  const scrollRef = useRef<ScrollView>(null);

  const [logVisible, setLogVisible] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [liveTrails, setLiveTrails] = useState<Trail[]>([]);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [mapImageError, setMapImageError] = useState(false);
  const [startPoint, setStartPoint] = useState<TrailStartPoint | null>(null);
  const [startPointLoading, setStartPointLoading] = useState(false);
  const [startPointError, setStartPointError] = useState(false);

  React.useEffect(() => {
    readLiveTrailsFromCache().then((trails) => {
      setLiveTrails(trails);
      setCacheLoaded(true);
    });
  }, []);

  const trail: Trail | null = useMemo(() => {
    const all = [...customRoutes, ...liveTrails, ...SAMPLE_TRAILS];
    return all.find((t) => t.id === params.id) ?? null;
  }, [params.id, customRoutes, liveTrails]);

  // Reset error states when trail changes
  React.useEffect(() => {
    setImageError(false);
    setMapImageError(false);
    setStartPoint(null);
    setStartPointError(false);
  }, [trail?.id]);

  // Fetch start point + parking info
  React.useEffect(() => {
    if (!trail) return;
    setStartPointLoading(true);
    fetch(`${API_BASE}/trail-start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trailName: trail.name, location: trail.location }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { startPoint: TrailStartPoint }) => setStartPoint(data.startPoint))
      .catch(() => setStartPointError(true))
      .finally(() => setStartPointLoading(false));
  }, [trail?.id]);

  const currentWeek = useMemo(() => trainingPlan.find((w) => w.isCurrentWeek) ?? null, [trainingPlan]);

  const isGoodForWeek = useMemo(() => {
    if (!currentWeek || !trail) return false;
    const target = currentWeek.targetElevation;
    if (target <= 0) return false;
    return trail.elevationGain >= target * 0.5 && trail.elevationGain <= target * 2.5;
  }, [currentWeek, trail]);

  if (!cacheLoaded) {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={T.green} />
        </View>
      </LinearGradient>
    );
  }

  if (!trail) {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: T.textMuted, fontFamily: "Inter_400Regular" }}>Trail not found.</Text>
        </View>
      </LinearGradient>
    );
  }

  const isSaved = savedTrailIds.includes(trail.id);
  const isCompleted = completedTrailIds.includes(trail.id);
  const dc = DIFF_COLOR[trail.difficulty] ?? T.blue;

  // Build the image URL — server proxies a Mapbox satellite tile so the token stays server-side
  const heroImageUri = imageError
    ? null
    : `${API_BASE}/mountain-image?name=${encodeURIComponent(extractLandmarkName(trail.name))}&width=800&height=400`;

  async function handleSaveToggle() {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isSaved) {
      await unsaveTrail(trail!.id);
    } else {
      await saveTrail(trail!.id);
    }
  }

  async function handleDelete() {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (Platform.OS === "web") {
      if (!window.confirm("Delete this route?\n\nThis will permanently remove your custom route. This can't be undone.")) return;
      await deleteCustomRoute(trail!.id);
      router.back();
    } else {
      Alert.alert(
        "Delete route?",
        "This will permanently remove your custom route. This can't be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await deleteCustomRoute(trail!.id);
              router.back();
            },
          },
        ],
      );
    }
  }

  async function handleCompleteToggle() {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (isCompleted) {
      if (Platform.OS === "web") {
        await uncompleteTrail(trail!.id);
      } else {
        Alert.alert("Remove completion?", "This will remove this route from your completed list.", [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: () => uncompleteTrail(trail!.id) },
        ]);
      }
    } else {
      await completeTrail(trail!.id);
      setLogVisible(true);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >

        {/* ── Hero Image ──────────────────────────────── */}
        <View style={[s.heroContainer, { height: HERO_H }]}>
          {heroImageUri ? (
            <ImageBackground
              source={{ uri: heroImageUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onError={() => { setImageError(true); }}
            >
              <LinearGradient
                colors={["rgba(0,0,0,0.6)", "transparent"]}
                style={[StyleSheet.absoluteFill, { bottom: "40%" }]}
              />
              <LinearGradient
                colors={["transparent", "rgba(8,10,14,0.92)", T.bg]}
                style={[StyleSheet.absoluteFill, { top: "38%" }]}
              />
            </ImageBackground>
          ) : (
            <LinearGradient
              colors={[dc + "55", "#0E1810", T.bg]}
              style={StyleSheet.absoluteFill}
            >
              <Text style={s.heroFallbackEmoji}>{trail.emoji}</Text>
            </LinearGradient>
          )}

          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={[s.backBtn, { top: Platform.OS === "web" ? 16 : insets.top + 10 }]}
          >
            <ArrowLeft size={20} color="#fff" />
          </TouchableOpacity>

          {/* Trail name + location pinned to bottom */}
          <View style={s.heroTextBlock}>
            <Text style={s.heroName}>{trail.name}</Text>
            <View style={s.heroMeta}>
              <MapPin size={13} color="rgba(255,255,255,0.7)" />
              <Text style={s.heroLocation}>{trail.location}</Text>
            </View>
          </View>
        </View>

        {/* ── Content ─────────────────────────────────── */}
        <View style={s.content}>

        {/* Stats row */}
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={s.statsCard}>
          <View style={s.statItem}>
            <MapPin size={16} color={T.green} />
            <Text style={s.statVal}>{trail.distance}km</Text>
            <Text style={s.statLbl}>Distance</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <TrendingUp size={16} color={T.orange} />
            <Text style={s.statVal}>{trail.elevationGain}m</Text>
            <Text style={s.statLbl}>Elevation gain</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Clock size={16} color={T.purple} />
            <Text style={s.statVal}>{trail.estimatedTime}</Text>
            <Text style={s.statLbl}>Est. time</Text>
          </View>
        </Animated.View>

        {/* Good for this week banner */}
        {isGoodForWeek && currentWeek && (
          <Animated.View entering={FadeInDown.delay(70).duration(400)} style={s.weekBanner}>
            <Text style={s.weekBannerText}>⭐ Good for Week {currentWeek.weekNumber} — matches your {currentWeek.targetElevation}m elevation target</Text>
          </Animated.View>
        )}

        {/* Tags */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={s.tagsRow}>
          <View style={[s.tag, { backgroundColor: dc + "20" }]}>
            <Text style={[s.tagText, { color: dc }]}>{trail.difficulty}</Text>
          </View>
          <View style={s.tag}>
            <Text style={s.tagText}>{TERRAIN_EMOJI[trail.terrain]} {trail.terrain}</Text>
          </View>
          <View style={s.tag}>
            <Text style={s.tagText}>{ROUTE_LABEL[trail.routeType]}</Text>
          </View>
        </Animated.View>

        {/* Best for */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={s.tagsRow}>
          {trail.bestFor.map((b) => (
            <View key={b} style={[s.tag, s.tagBlue]}>
              <Text style={[s.tagText, { color: T.blue }]}>{BEST_FOR_LABEL[b]}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Description */}
        <Animated.View entering={FadeInDown.delay(110).duration(400)} style={s.section}>
          <Text style={s.sectionTitle}>About this route</Text>
          <Text style={s.description}>{trail.description}</Text>
        </Animated.View>

        {/* Start point & parking */}
        <Animated.View entering={FadeInDown.delay(125).duration(400)} style={s.section}>
          <View style={s.sectionHeader}>
            <Flag size={14} color={T.green} />
            <Text style={s.sectionTitle}>Start point & parking</Text>
          </View>

          {startPointLoading && (
            <View style={s.startLoadingCard}>
              <ActivityIndicator color={T.green} size="small" />
              <Text style={s.startLoadingText}>Looking up access info…</Text>
            </View>
          )}

          {startPointError && !startPointLoading && (
            <View style={s.startErrorCard}>
              <Info size={14} color={T.textMuted} />
              <Text style={s.startErrorText}>Couldn't load access info for this trail.</Text>
            </View>
          )}

          {startPoint && (
            <View style={s.startCard}>
              <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <View style={s.startNameRow}>
                <View style={s.startIconBox}>
                  <Flag size={16} color={T.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.startName}>{startPoint.name}</Text>
                  <Text style={s.startCoords}>
                    {startPoint.lat.toFixed(5)}, {startPoint.lng.toFixed(5)}
                  </Text>
                </View>
              </View>

              <View style={s.startDivider} />

              <Text style={s.startDirections}>{startPoint.directions}</Text>

              {!!startPoint.parkingNotes && (
                <View style={s.parkingRow}>
                  <Info size={12} color={T.textMuted} />
                  <Text style={s.parkingText}>{startPoint.parkingNotes}</Text>
                </View>
              )}

              <View style={s.startActionsRow}>
                <TouchableOpacity
                  style={s.startMapBtn}
                  onPress={() => openMapPin(startPoint.lat, startPoint.lng, startPoint.name)}
                  activeOpacity={0.8}
                >
                  <Map size={13} color={T.green} />
                  <Text style={s.startMapBtnText}>View on map</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.startMapBtn, { borderColor: T.blue + "50" }]}
                  onPress={() => openMapDirections(startPoint.lat, startPoint.lng, startPoint.name)}
                  activeOpacity={0.8}
                >
                  <Navigation size={13} color={T.blue} />
                  <Text style={[s.startMapBtnText, { color: T.blue }]}>Drive there</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Training benefits */}
        <Animated.View entering={FadeInDown.delay(130).duration(400)} style={s.section}>
          <Text style={s.sectionTitle}>Training benefits</Text>
          <View style={s.benefitsGrid}>
            {trail.trainingBenefits.map((b) => (
              <View key={b} style={[s.benefitBadge, { backgroundColor: BENEFIT_COLOR[b] + "18", borderColor: BENEFIT_COLOR[b] + "30" }]}>
                <View style={[s.benefitDot, { backgroundColor: BENEFIT_COLOR[b] }]} />
                <Text style={[s.benefitText, { color: BENEFIT_COLOR[b] }]}>{BENEFIT_LABEL[b]}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Route map */}
        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={s.section}>
          <Text style={s.sectionTitle}>Route map</Text>
          <TouchableOpacity
            style={s.mapContainer}
            activeOpacity={0.88}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setMapModalOpen(true);
            }}
          >
            {!mapImageError ? (
              <Image
                source={{ uri: `${API_BASE}/trail-map-image?name=${encodeURIComponent(trail.name)}&location=${encodeURIComponent(trail.location)}&color=${dc.replace("#", "")}&width=800&height=400&distance=${trail.distance}` }}
                style={s.mapImage}
                resizeMode="cover"
                onError={() => setMapImageError(true)}
              />
            ) : (
              <View style={[s.mapImage, s.mapFallback]}>
                <Text style={{ fontSize: 32, opacity: 0.4 }}>{trail.emoji}</Text>
                <Text style={s.mapFallbackText}>Route map unavailable</Text>
              </View>
            )}
            <View style={s.mapOpenHint}>
              <ExternalLink size={11} color="rgba(255,255,255,0.8)" />
              <Text style={s.mapOpenHintText}>Tap for interactive map</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Weather */}
        <Animated.View entering={FadeInDown.delay(160).duration(400)} style={s.section}>
          <Text style={s.sectionTitle}>Weather & conditions</Text>
          <View style={s.infoCard}>
            <Wind size={18} color={T.blue} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.infoTitle}>Check before you go</Text>
              <Text style={s.infoBody}>Mountain weather can change rapidly. Always check a reliable forecast (Met Office, Mountain Weather) before setting out, and be prepared to turn back if conditions deteriorate.</Text>
            </View>
          </View>
        </Animated.View>

        {/* Kit checklist */}
        <Animated.View entering={FadeInDown.delay(170).duration(400)} style={s.section}>
          <View style={s.sectionHeader}>
            <Package size={14} color={T.orange} />
            <Text style={s.sectionTitle}>Suggested kit</Text>
          </View>
          <View style={s.kitCard}>
            {KIT_CHECKLIST.map((item) => (
              <View key={item} style={s.kitItem}>
                <View style={s.kitDot} />
                <Text style={s.kitText}>{item}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Notes (custom routes only) */}
        {trail.notes && (
          <Animated.View entering={FadeInDown.delay(180).duration(400)} style={s.section}>
            <Text style={s.sectionTitle}>Your notes</Text>
            <View style={s.notesCard}>
              <Text style={s.notesText}>{trail.notes}</Text>
            </View>
          </Animated.View>
        )}

        {/* Action buttons */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={s.actions}>
          <TouchableOpacity
            style={s.actionPrimary}
            activeOpacity={0.85}
            onPress={() => router.push({
              pathname: "/hike-tracking",
              params: { name: trail.name, location: trail.location },
            })}
          >
            <LinearGradient colors={["#3ECF75", "#2AB860"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.actionGrad}>
              <Navigation size={18} color="#fff" />
              <Text style={s.actionPrimaryText}>Start route</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={s.actionRow}>
            <TouchableOpacity style={[s.actionSecondary, isSaved && s.actionSecondaryActive]} onPress={handleSaveToggle} activeOpacity={0.8}>
              <Bookmark size={16} color={isSaved ? T.blue : T.textMuted} fill={isSaved ? T.blue : "transparent"} />
              <Text style={[s.actionSecondaryText, isSaved && { color: T.blue }]}>
                {isSaved ? "Saved" : "Save route"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[s.actionSecondary, isCompleted && s.actionSecondaryGreen]} onPress={handleCompleteToggle} activeOpacity={0.8}>
              <CheckCircle size={16} color={isCompleted ? T.green : T.textMuted} />
              <Text style={[s.actionSecondaryText, isCompleted && { color: T.green }]}>
                {isCompleted ? "Completed ✓" : "Mark complete"}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.actionStart} onPress={() => setLogVisible(true)} activeOpacity={0.85}>
            <PenLine size={16} color={T.textMuted} />
            <Text style={s.actionStartText}>Log a session</Text>
          </TouchableOpacity>

          {trail.isCustom && (
            <TouchableOpacity style={s.actionDelete} onPress={handleDelete} activeOpacity={0.8}>
              <Trash2 size={15} color={T.red ?? "#FF4D4F"} />
              <Text style={s.actionDeleteText}>Delete this route</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        </View>{/* end content */}
      </ScrollView>

      <LogHikeModal
        visible={logVisible}
        prefillName={trail.name}
        prefillDistance={trail.distance}
        prefillElevation={trail.elevationGain}
        onClose={() => setLogVisible(false)}
      />

      <TrailMapModal
        visible={mapModalOpen}
        url={`${API_BASE}/trail-map-web?name=${encodeURIComponent(trail.name)}&location=${encodeURIComponent(trail.location)}&color=${dc.replace("#", "")}&distance=${trail.distance}${trail.lat != null ? `&trailLat=${trail.lat}&trailLng=${trail.lng}` : ""}`}
        onClose={() => setMapModalOpen(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  heroContainer: { position: "relative", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  heroFallbackEmoji: { fontSize: 56, opacity: 0.7, marginBottom: 40 },
  backBtn: {
    position: "absolute", left: 16, width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center",
  },
  heroTextBlock: { position: "absolute", bottom: 0, left: 20, right: 20, paddingBottom: 18, gap: 5 },
  heroName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroLocation: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" },
  content: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  statsCard: {
    flexDirection: "row", backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.border, padding: 16, justifyContent: "space-around",
  },
  statItem: { alignItems: "center", gap: 6 },
  statVal: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.text },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted },
  statDivider: { width: 1, backgroundColor: T.border },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border },
  tagBlue: { backgroundColor: T.blueDim, borderColor: T.blue + "30" },
  tagText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, textTransform: "capitalize" },
  section: { gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.text },
  description: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 22 },
  benefitsGrid: { gap: 8 },
  benefitBadge: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1,
  },
  benefitDot: { width: 8, height: 8, borderRadius: 4 },
  benefitText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  mapContainer: { borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: T.border },
  mapImage: { width: "100%", height: 220 },
  mapFallback: { backgroundColor: T.surface, alignItems: "center", justifyContent: "center", gap: 8 },
  mapFallbackText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim },
  mapOpenHint: {
    position: "absolute", bottom: 8, right: 10,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  mapOpenHintText: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)" },
  infoCard: {
    flexDirection: "row", gap: 12, alignItems: "flex-start",
    backgroundColor: T.blueDim, borderRadius: 14, borderWidth: 1, borderColor: T.blue + "25", padding: 14,
  },
  infoTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text },
  infoBody: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18 },
  kitCard: { backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 14, gap: 10 },
  kitItem: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  kitDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: T.orange, marginTop: 7, flexShrink: 0 },
  kitText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, flex: 1, lineHeight: 20 },
  notesCard: { backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border, padding: 14 },
  notesText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 20, fontStyle: "italic" },
  startLoadingCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.cardBorder, padding: 16,
  },
  startLoadingText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },
  startErrorCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.cardBorder, padding: 14,
  },
  startErrorText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },
  startCard: {
    backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.green + "30",
    padding: 16, gap: 10, overflow: "hidden",
  },
  startNameRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  startIconBox: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: T.greenDim,
    alignItems: "center", justifyContent: "center",
  },
  startName: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.text },
  startCoords: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },
  startDivider: { height: 1, backgroundColor: T.border },
  startDirections: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 20 },
  parkingRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 7,
    backgroundColor: T.surface, borderRadius: 10, padding: 10,
  },
  parkingText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18 },
  startActionsRow: { flexDirection: "row", gap: 8 },
  startMapBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: T.green + "50", backgroundColor: T.surface,
  },
  startMapBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.green },
  weekBanner: {
    backgroundColor: T.greenDim, borderRadius: 12, borderWidth: 1, borderColor: T.green + "50",
    paddingHorizontal: 14, paddingVertical: 10,
  },
  weekBannerText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.green },
  actions: { gap: 10 },
  actionPrimary: { borderRadius: 16, overflow: "hidden" },
  actionGrad: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  actionPrimaryText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  actionRow: { flexDirection: "row", gap: 10 },
  actionSecondary: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border, paddingVertical: 13,
  },
  actionSecondaryActive: { backgroundColor: T.blueDim, borderColor: T.blue + "40" },
  actionSecondaryGreen: { backgroundColor: T.greenDim, borderColor: T.green + "40" },
  actionSecondaryText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  actionStart: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border, paddingVertical: 13,
  },
  actionStartText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.text },
  comingSoon: { backgroundColor: T.orangeDim, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  comingSoonText: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: T.orange },
  actionDelete: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: T.redDim, borderRadius: 14, borderWidth: 1, borderColor: T.red + "30",
    paddingVertical: 13,
  },
  actionDeleteText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.red },
});
