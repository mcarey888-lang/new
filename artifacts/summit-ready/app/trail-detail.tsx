import {
  ArrowLeft,
  Bookmark,
  CheckCircle,
  Clock,
  ExternalLink,
  Flag,
  Info,
  Map,
  Navigation,
  Package,
  PenLine,
  Trash2,
  TrendingUp,
  Wind,
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
import { CURATED_HILLS } from "@/constants/trailData";
import type { Trail, TrailBenefit } from "@/constants/trailData";
import { LogHikeModal } from "@/components/LogHikeModal";
import { openMapSearch } from "@/utils/openMaps";

const DIFF_COLOR: Record<string, string> = {
  Easy: T.green,
  Moderate: T.blue,
  Hard: T.orange,
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

const TERRAIN_EXPECT: Record<string, string> = {
  woodland:
    "Sheltered paths through trees with generally good ground cover. Trails are usually well-waymarked but can be muddy after rain — waterproof boots are recommended.",
  hill:
    "Open moorland and hillside with sweeping views. Paths can become less distinct on higher ground — a map and compass helps in low visibility. Wind exposure increases with altitude.",
  mountain:
    "Serious mountain terrain with rocky ridges and open summits. Navigation skills are essential and weather can change very quickly at altitude — always carry an emergency layer and more food than you think you'll need.",
  coastal:
    "Cliff paths and beaches with dramatic sea views. Some sections may be exposed and eroded near cliff edges — keep to the marked path. Wind can be strong and persistent.",
  road:
    "Mostly on tarmac, lanes and hard-packed paths — reliable underfoot in all weathers. Good option when the hills are in cloud or conditions are poor.",
  mixed:
    "A mix of paths, tracks and open ground — conditions vary throughout the route. Be prepared for a full range of underfoot conditions.",
};

const ROUTE_TYPE_NOTE: Record<string, { icon: string; label: string; body: string }> = {
  loop: {
    icon: "🔄",
    label: "Loop route",
    body: "Returns to your start point — no logistics or shuttle required. Park once and head straight out.",
  },
  "out-and-back": {
    icon: "↔️",
    label: "Out & back",
    body: "You retrace your steps on the return leg. The same path both ways, which often reveals views you missed on the way out.",
  },
  "point-to-point": {
    icon: "→",
    label: "Point-to-point",
    body: "Starts and finishes at different locations. You'll need a second car at the end, or a return bus or taxi arranged in advance.",
  },
};

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

function routeEffort(distance: number, elevationGain: number): { label: string; color: string } {
  const score = distance + elevationGain / 80;
  if (score < 12) return { label: "Low", color: T.green };
  if (score < 24) return { label: "Moderate", color: T.orange };
  return { label: "High", color: "#ef4444" };
}

function routeGradient(distance: number, elevationGain: number): string {
  const mPerKm = elevationGain / Math.max(distance, 1);
  if (mPerKm < 15) return "Gentle";
  if (mPerKm < 30) return "Rolling";
  if (mPerKm < 50) return "Hilly";
  return "Steep";
}

function estimatedCalories(distance: number, elevationGain: number): number {
  return Math.round((distance * 58 + elevationGain * 1.5) / 10) * 10;
}

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const HERO_H = 290;

export default function TrailDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const { savedTrailIds, completedTrailIds, saveTrail, unsaveTrail, completeTrail, uncompleteTrail, trainingPlan, customRoutes, deleteCustomRoute } = useApp();
  const scrollRef = useRef<ScrollView>(null);

  const [logVisible, setLogVisible] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [mapImageError, setMapImageError] = useState(false);

  const trail: Trail | null = useMemo(() => {
    return (
      CURATED_HILLS.find((t) => t.id === params.id) ??
      customRoutes.find((t) => t.id === params.id) ??
      null
    );
  }, [params.id, customRoutes]);

  React.useEffect(() => {
    setImageError(false);
    setMapImageError(false);
  }, [trail?.id]);

  const currentWeek = useMemo(() => trainingPlan.find((w) => w.isCurrentWeek) ?? null, [trainingPlan]);

  const isGoodForWeek = useMemo(() => {
    if (!currentWeek || !trail) return false;
    const target = currentWeek.targetElevation;
    if (target <= 0) return false;
    return trail.elevationGain >= target * 0.5 && trail.elevationGain <= target * 2.5;
  }, [currentWeek, trail]);

  if (!trail) {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: T.textMuted, fontFamily: "Inter_400Regular" }}>Hill not found.</Text>
        </View>
      </LinearGradient>
    );
  }

  const isSaved = savedTrailIds.includes(trail.id);
  const isCompleted = completedTrailIds.includes(trail.id);
  const dc = DIFF_COLOR[trail.difficulty] ?? T.blue;

  const heroImageUri = imageError
    ? null
    : `${API_BASE}/mountain-image?name=${encodeURIComponent(trail.name)}&width=800&height=400`;

  const mapImageUri = mapImageError
    ? null
    : `${API_BASE}/trail-map-image?name=${encodeURIComponent(trail.name)}&location=${encodeURIComponent(trail.location)}&color=${dc.replace("#", "")}&width=800&height=400&distance=${trail.distance}&trailLat=${trail.lat}&trailLng=${trail.lng}`;

  async function handleDelete() {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Delete route?",
      "This will permanently remove your custom route. This cannot be undone.",
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
      ]
    );
  }

  async function handleSaveToggle() {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isSaved) {
      await unsaveTrail(trail!.id);
    } else {
      await saveTrail(trail!.id);
    }
  }

  async function handleCompleteToggle() {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (isCompleted) {
      if (Platform.OS === "web") {
        await uncompleteTrail(trail!.id);
      } else {
        Alert.alert("Remove completion?", "This will remove this hill from your completed list.", [
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
        {/* Hero */}
        <View style={[s.heroContainer, { height: HERO_H }]}>
          {heroImageUri ? (
            <ImageBackground
              source={{ uri: heroImageUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onError={() => setImageError(true)}
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

          <TouchableOpacity
            onPress={() => router.back()}
            style={[s.backBtn, { top: Platform.OS === "web" ? 16 : insets.top + 10 }]}
          >
            <ArrowLeft size={20} color="#fff" />
          </TouchableOpacity>

          <View style={s.heroTextBlock}>
            <Text style={s.heroName}>{trail.name}</Text>
            <View style={s.heroMeta}>
              <Text style={s.heroRegion}>{trail.region}</Text>
              <Text style={s.heroDot}>·</Text>
              <Text style={s.heroLocation}>{trail.location}</Text>
            </View>
          </View>
        </View>

        {/* Content */}
        <View style={s.content}>

          {/* Stats */}
          <Animated.View entering={FadeInDown.delay(50).duration(400)} style={s.statsCard}>
            <View style={s.statItem}>
              <Navigation size={16} color={T.green} />
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

          {/* Good for this week */}
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

          {/* Map — Mapbox satellite + route */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={s.section}>
            <Text style={s.sectionTitle}>Route map</Text>
            <TouchableOpacity
              style={s.mapContainer}
              activeOpacity={0.88}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMapModalOpen(true);
              }}
            >
              {mapImageUri ? (
                <Image
                  source={{ uri: mapImageUri }}
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

          {/* About */}
          <Animated.View entering={FadeInDown.delay(110).duration(400)} style={s.section}>
            <Text style={s.sectionTitle}>About this hill</Text>
            <Text style={s.description}>{trail.description}</Text>

            {(() => {
              const effort = routeEffort(trail.distance, trail.elevationGain);
              const gradient = routeGradient(trail.distance, trail.elevationGain);
              const kcal = estimatedCalories(trail.distance, trail.elevationGain);
              return (
                <View style={s.routeDetailsRow}>
                  <View style={s.routeDetailCell}>
                    <Text style={[s.routeDetailVal, { color: effort.color }]}>{effort.label}</Text>
                    <Text style={s.routeDetailKey}>Effort</Text>
                  </View>
                  <View style={s.routeDetailDivider} />
                  <View style={s.routeDetailCell}>
                    <Text style={s.routeDetailVal}>{gradient}</Text>
                    <Text style={s.routeDetailKey}>Gradient</Text>
                  </View>
                  <View style={s.routeDetailDivider} />
                  <View style={s.routeDetailCell}>
                    <Text style={s.routeDetailVal}>~{kcal}</Text>
                    <Text style={s.routeDetailKey}>kcal est.</Text>
                  </View>
                </View>
              );
            })()}

            <View style={s.expectCard}>
              <Text style={s.expectTitle}>{TERRAIN_EMOJI[trail.terrain]} What to expect</Text>
              <Text style={s.expectBody}>{TERRAIN_EXPECT[trail.terrain]}</Text>
            </View>

            {(() => {
              const note = ROUTE_TYPE_NOTE[trail.routeType];
              return note ? (
                <View style={s.routeTypeNote}>
                  <Text style={s.routeTypeNoteIcon}>{note.icon} {note.label}</Text>
                  <Text style={s.routeTypeNoteBody}>{note.body}</Text>
                </View>
              ) : null;
            })()}
          </Animated.View>

          {/* Get there */}
          <Animated.View entering={FadeInDown.delay(125).duration(400)} style={s.section}>
            <View style={s.sectionHeader}>
              <Flag size={14} color={T.green} />
              <Text style={s.sectionTitle}>Getting there</Text>
            </View>
            <TouchableOpacity
              style={s.directionsCard}
              activeOpacity={0.8}
              onPress={() => openMapSearch(`${trail.name}, ${trail.location}`)}
            >
              <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
              <Map size={18} color={T.green} />
              <View style={{ flex: 1 }}>
                <Text style={s.directionsTitle}>{trail.name}</Text>
                <Text style={s.directionsLocation}>{trail.location}</Text>
              </View>
              <Text style={s.directionsArrow}>›</Text>
            </TouchableOpacity>
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

          {/* Weather */}
          <Animated.View entering={FadeInDown.delay(140).duration(400)} style={s.section}>
            <Text style={s.sectionTitle}>Weather & conditions</Text>
            <View style={s.infoCard}>
              <Wind size={18} color={T.blue} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={s.infoTitle}>Check before you go</Text>
                <Text style={s.infoBody}>Mountain weather can change rapidly. Always check a reliable forecast (Met Office, Mountain Weather) before setting out, and be prepared to turn back if conditions deteriorate.</Text>
              </View>
            </View>
          </Animated.View>

          {/* Kit */}
          <Animated.View entering={FadeInDown.delay(150).duration(400)} style={s.section}>
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

          {/* Actions */}
          <Animated.View entering={FadeInDown.delay(170).duration(400)} style={s.actions}>
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
                  {isSaved ? "Saved" : "Save hill"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={[s.actionSecondary, isCompleted && s.actionSecondaryGreen]} onPress={handleCompleteToggle} activeOpacity={0.8}>
                <CheckCircle size={16} color={isCompleted ? T.green : T.textMuted} />
                <Text style={[s.actionSecondaryText, isCompleted && { color: T.green }]}>
                  {isCompleted ? "Completed ✓" : "Mark complete"}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.actionLog} onPress={() => setLogVisible(true)} activeOpacity={0.85}>
              <PenLine size={16} color={T.textMuted} />
              <Text style={s.actionLogText}>Log a session</Text>
            </TouchableOpacity>

            {trail.isCustom && (
              <TouchableOpacity style={s.actionDelete} onPress={handleDelete} activeOpacity={0.8}>
                <Trash2 size={16} color="#ef4444" />
                <Text style={s.actionDeleteText}>Delete route</Text>
              </TouchableOpacity>
            )}
          </Animated.View>

        </View>
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
        url={`${API_BASE}/trail-map-web?name=${encodeURIComponent(trail.name)}&location=${encodeURIComponent(trail.location)}&color=${dc.replace("#", "")}&distance=${trail.distance}&trailLat=${trail.lat}&trailLng=${trail.lng}&trailId=${encodeURIComponent(trail.id)}`}
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
  heroTextBlock: { position: "absolute", bottom: 0, left: 20, right: 20, paddingBottom: 18, gap: 4 },
  heroName: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#fff" },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  heroRegion: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.85)" },
  heroDot: { fontSize: 12, color: "rgba(255,255,255,0.4)" },
  heroLocation: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
  content: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  statsCard: {
    flexDirection: "row", backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.border, padding: 16, justifyContent: "space-around",
  },
  statItem: { alignItems: "center", gap: 6 },
  statVal: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.text },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted },
  statDivider: { width: 1, backgroundColor: T.border },
  weekBanner: {
    backgroundColor: T.greenDim, borderRadius: 12, borderWidth: 1, borderColor: T.green + "50",
    paddingHorizontal: 14, paddingVertical: 10,
  },
  weekBannerText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.green },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border },
  tagText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, textTransform: "capitalize" },
  section: { gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.text },
  description: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 22 },
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
  routeDetailsRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.border,
    paddingVertical: 14,
  },
  routeDetailCell: { flex: 1, alignItems: "center", gap: 4 },
  routeDetailVal: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.text },
  routeDetailKey: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  routeDetailDivider: { width: 1, height: 30, backgroundColor: T.border },
  expectCard: {
    backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border,
    padding: 14, gap: 6,
  },
  expectTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text },
  expectBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 20 },
  routeTypeNote: {
    flexDirection: "row", flexWrap: "wrap", gap: 4,
    backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  routeTypeNoteIcon: { fontSize: 12, fontFamily: "Inter_700Bold", color: T.text, marginRight: 2 },
  routeTypeNoteBody: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18, flexShrink: 1 },
  directionsCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.green + "30",
    paddingHorizontal: 16, paddingVertical: 16, overflow: "hidden",
  },
  directionsTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },
  directionsLocation: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },
  directionsArrow: { fontSize: 22, color: T.green, lineHeight: 26 },
  benefitsGrid: { gap: 8 },
  benefitBadge: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1,
  },
  benefitDot: { width: 8, height: 8, borderRadius: 4 },
  benefitText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
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
  actionLog: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border, paddingVertical: 13,
  },
  actionLogText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.text },
  actionDelete: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#ef444415", borderRadius: 14, borderWidth: 1, borderColor: "#ef444430", paddingVertical: 13,
  },
  actionDeleteText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#ef4444" },
});
