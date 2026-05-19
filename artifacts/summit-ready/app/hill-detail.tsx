import { ArrowLeft, TrendingUp, MapPin, Map, Navigation, AlertCircle, Flag, Info, Compass, Star, Clock } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { T } from "@/constants/theme";

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
    lat: number;
    lng: number;
    postcode?: string;
    directions: string;
    parkingNotes: string;
  };
  routes: HillRoute[];
  summitLat?: number;
  summitLng?: number;
}

import { openMapPin, openMapDirections, openDirectionsToPostcode, openMapSearch } from "@/utils/openMaps";

export default function HillDetailScreen() {
  const insets = useSafeAreaInsets();
  const { name, location, lat, lng, elevation, distance, grade, surface, emoji } =
    useLocalSearchParams<{
      name: string;
      location: string;
      lat?: string;
      lng?: string;
      elevation?: string;
      distance?: string;
      grade?: string;
      surface?: string;
      emoji?: string;
    }>();

  const [detail, setDetail] = useState<HillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState(false);

  const [imageError, setImageError] = useState(false);

  const hillLat = lat ? parseFloat(lat) : null;
  const hillLng = lng ? parseFloat(lng) : null;

  const heroImageUri = name && !imageError
    ? `${API_BASE}/mountain-image?name=${encodeURIComponent(name)}`
    : null;

  useEffect(() => {
    if (!name) return;
    setImageError(false);

    async function fetchDetail() {
      try {
        const res = await fetch(`${API_BASE}/hill-detail`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hillName: name, location: location ?? "" }),
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
  }, [name, location]);

  const gradeColor = DIFF_COLOR[grade ?? ""] ?? T.blue;
  const topInset = Platform.OS === "web" ? 20 : insets.top;

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 60 : insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image */}
        <View style={styles.heroContainer}>
          {heroImageUri ? (
            <ImageBackground
              source={{ uri: heroImageUri }}
              style={styles.heroImage}
              resizeMode="cover"
              onError={() => setImageError(true)}
            >
              <LinearGradient
                colors={["rgba(0,0,0,0.55)", "transparent"]}
                style={[StyleSheet.absoluteFill, { height: "50%" }]}
              />
              <LinearGradient
                colors={["transparent", "rgba(6,13,27,0.9)", T.bg]}
                style={[StyleSheet.absoluteFill, { top: "40%" }]}
              />
            </ImageBackground>
          ) : (
            <LinearGradient colors={["#1C3A2A", "#0F1E14", T.bg]} style={styles.heroImage}>
              <Text style={[styles.fallbackEmoji, { marginTop: topInset + 40 }]}>
                {emoji ?? "⛰️"}
              </Text>
            </LinearGradient>
          )}

          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { top: topInset + 12 }]}
            activeOpacity={0.8}
          >
            <ArrowLeft size={18} color="#fff" />
          </TouchableOpacity>

          {/* Hill name overlay */}
          <View style={[styles.heroOverlay, { paddingBottom: 20 }]}>
            <View style={styles.heroMeta}>
              <View style={[styles.gradeBadge, { backgroundColor: gradeColor + "25" }]}>
                <Text style={[styles.gradeText, { color: gradeColor }]}>{grade}</Text>
              </View>
              {elevation && (
                <View style={styles.elevBadge}>
                  <TrendingUp size={11} color={T.orange} />
                  <Text style={styles.elevText}>{elevation}m per climb</Text>
                </View>
              )}
              {distance && (
                <View style={styles.elevBadge}>
                  <MapPin size={11} color={T.green} />
                  <Text style={styles.elevText}>{distance}km away</Text>
                </View>
              )}
            </View>
            <Text style={styles.heroName}>{name}</Text>
            {surface && <Text style={styles.heroSurface}>{surface}</Text>}
          </View>
        </View>

        <View style={styles.body}>
          {/* Quick map actions */}
          <Animated.View entering={FadeInDown.delay(60).duration(400)}>
            <View style={styles.mapActionsRow}>
              <TouchableOpacity
                style={styles.mapActionBtn}
                onPress={() => {
                  if (detail?.summitLat && detail?.summitLng) {
                    openMapPin(detail.summitLat, detail.summitLng, name ?? "");
                  } else if (hillLat && hillLng) {
                    openMapPin(hillLat, hillLng, name ?? "");
                  } else {
                    openMapSearch(name ?? "");
                  }
                }}
                activeOpacity={0.8}
              >
                <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
                <Map size={15} color={T.green} />
                <Text style={styles.mapActionText}>View on map</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mapActionBtn}
                onPress={() => {
                  if (detail?.startPoint.postcode) {
                    openDirectionsToPostcode(detail.startPoint.postcode, detail.startPoint.name);
                  } else if (detail) {
                    openMapDirections(detail.startPoint.lat, detail.startPoint.lng, detail.startPoint.name);
                  } else if (hillLat && hillLng) {
                    openMapDirections(hillLat, hillLng, name ?? "");
                  } else {
                    openMapSearch((name ?? "") + " car park");
                  }
                }}
                activeOpacity={0.8}
              >
                <LinearGradient colors={[T.blueDim, "transparent"]} style={StyleSheet.absoluteFill} />
                <Navigation size={15} color={T.blue} />
                <Text style={[styles.mapActionText, { color: T.blue }]}>Get directions</Text>
              </TouchableOpacity>
            </View>
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
                  <Text style={styles.sectionTitle}>About this hill</Text>
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

                    <View style={styles.startNameRow}>
                      <View style={styles.startIconBox}>
                        <Flag size={16} color={T.green} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.startName}>{detail.startPoint.name}</Text>
                        {detail.startPoint.postcode ? (
                          <Text style={styles.startCoords}>{detail.startPoint.postcode}</Text>
                        ) : (
                          <Text style={styles.startCoords}>
                            {detail.startPoint.lat.toFixed(5)}, {detail.startPoint.lng.toFixed(5)}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.startDivider} />

                    <Text style={styles.startDetail}>{detail.startPoint.directions}</Text>

                    {detail.startPoint.parkingNotes ? (
                      <View style={styles.parkingRow}>
                        <Info size={12} color={T.textMuted} />
                        <Text style={styles.parkingText}>{detail.startPoint.parkingNotes}</Text>
                      </View>
                    ) : null}

                    <View style={styles.startActionsRow}>
                      <TouchableOpacity
                        style={styles.startMapBtn}
                        onPress={() => openMapPin(detail.startPoint.lat, detail.startPoint.lng, detail.startPoint.name)}
                        activeOpacity={0.8}
                      >
                        <MapPin size={13} color={T.green} />
                        <Text style={styles.startMapBtnText}>View start on map</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.startMapBtn, { borderColor: T.blue + "50" }]}
                        onPress={() => {
                          if (detail.startPoint.postcode) {
                            openDirectionsToPostcode(detail.startPoint.postcode, detail.startPoint.name);
                          } else {
                            openMapDirections(detail.startPoint.lat, detail.startPoint.lng, detail.startPoint.name);
                          }
                        }}
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
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Compass size={15} color={T.blue} />
                    <Text style={styles.sectionTitle}>Route options</Text>
                  </View>

                  {detail.routes.map((route, i) => {
                    const dc = DIFF_COLOR[route.difficulty] ?? T.blue;
                    return (
                      <View
                        key={i}
                        style={[
                          styles.routeCard,
                          route.isRecommended && styles.routeCardRecommended,
                        ]}
                      >
                        {route.isRecommended && (
                          <LinearGradient
                            colors={[T.greenDim, "transparent"]}
                            style={StyleSheet.absoluteFill}
                          />
                        )}
                        <View style={styles.routeHeaderRow}>
                          <View style={{ flex: 1, gap: 2 }}>
                            {route.isRecommended && (
                              <View style={styles.recommendedBadge}>
                                <Star size={9} color={T.green} />
                                <Text style={styles.recommendedText}>Best for training</Text>
                              </View>
                            )}
                            <Text style={styles.routeName}>{route.name}</Text>
                          </View>
                          <View style={[styles.diffBadge, { backgroundColor: dc + "20" }]}>
                            <Text style={[styles.diffText, { color: dc }]}>{route.difficulty}</Text>
                          </View>
                        </View>

                        <View style={styles.routeStats}>
                          <View style={styles.routeStat}>
                            <Map size={11} color={T.textMuted} />
                            <Text style={styles.routeStatVal}>{route.distance}km</Text>
                            <Text style={styles.routeStatLbl}>round trip</Text>
                          </View>
                          <View style={styles.routeStat}>
                            <TrendingUp size={11} color={T.orange} />
                            <Text style={styles.routeStatVal}>{route.elevationGain}m</Text>
                            <Text style={styles.routeStatLbl}>ascent</Text>
                          </View>
                          <View style={styles.routeStat}>
                            <Clock size={11} color={T.blue} />
                            <Text style={styles.routeStatVal}>{route.estimatedTime}</Text>
                          </View>
                        </View>

                        <Text style={styles.routeDescription}>{route.description}</Text>

                        <TouchableOpacity
                          style={styles.routeMapBtn}
                          onPress={() => {
                            const lat = detail.startPoint.lat;
                            const lng = detail.startPoint.lng;
                            openMapDirections(lat, lng, detail.startPoint.name);
                          }}
                          activeOpacity={0.8}
                        >
                          <Navigation size={12} color={T.blue} />
                          <Text style={styles.routeMapBtnText}>Navigate to start</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </Animated.View>
            </>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  heroContainer: { position: "relative" },
  heroImage: { width: "100%", height: 300 },
  fallbackEmoji: { fontSize: 64, textAlign: "center" },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 12,
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
  heroName: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    lineHeight: 32,
  },
  heroSurface: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
  },

  body: { paddingHorizontal: 18, paddingTop: 16, gap: 4 },

  mapActionsRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  mapActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: 14,
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
    borderRadius: 16,
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
    borderRadius: 16,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.cardBorder,
    padding: 16,
  },

  startPointCard: {
    backgroundColor: T.card,
    borderRadius: 18,
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
    borderRadius: 10,
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
    borderRadius: 12,
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
    borderRadius: 18,
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.blue + "40",
    backgroundColor: T.surface,
  },
  routeMapBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: T.blue,
  },
});
