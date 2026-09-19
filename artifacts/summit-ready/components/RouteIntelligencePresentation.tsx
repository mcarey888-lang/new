import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Shield, Fingerprint, Dna, Info, Compass, Star, Map, TrendingUp, Clock, Navigation, AlertTriangle } from "lucide-react-native";
import { T } from "@/constants/theme";
import type {
  TrainingTargetRoute,
  ExpeditionLocalStageRoute,
  ExploreRoute
} from "@/utils/routeIntelligence";

export interface PresentationRoute {
  name: string;
  distance: number;
  elevationGain: number;
  difficulty: string;
  description: string;
  estimatedTime: string;
  isRecommended: boolean;
}

export interface RouteIntelligencePresentationProps {
  routes: PresentationRoute[];
  objectiveType?: string;
  trainingTarget?: TrainingTargetRoute | null;
  expeditionStage?: ExpeditionLocalStageRoute | null;
  exploreRoute?: ExploreRoute | null;
  onNavigateToStart: (routeIndex: number) => void;
}

const DIFF_COLOR: Record<string, string> = {
  Easy: T.green,
  Moderate: T.blue,
  Hard: T.orange,
  Alpine: "#FF4444",
};

export function RouteIntelligencePresentation({
  routes,
  objectiveType,
  trainingTarget,
  expeditionStage,
  exploreRoute,
  onNavigateToStart,
}: RouteIntelligencePresentationProps) {

  // Decide the overall SDE state based on objective
  let isAvailable = false;
  let isDegraded = false;
  let trust = null;
  let attribution = null;

  if (objectiveType === "training" && trainingTarget) {
    isAvailable = trainingTarget.demandStatus === "supported";
    isDegraded = trainingTarget.demandStatus === "degraded";
    trust = trainingTarget.trust;
  } else if (objectiveType === "expedition" && expeditionStage) {
    isAvailable = expeditionStage.routeFacts.availability === "available";
    isDegraded = expeditionStage.routeFacts.availability === "degraded";
  } else if (exploreRoute) {
    isAvailable = exploreRoute.trackAvailability === "can_track";
    isDegraded = exploreRoute.trackAvailability === "identity_only";
    trust = exploreRoute.trust;
    attribution = exploreRoute.attribution;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Compass size={15} color={T.blue} />
        <Text style={styles.title}>Route Intelligence</Text>
      </View>

      {/* SDE Trust & Identity Banner */}
      <View style={styles.trustBanner}>
        <View style={styles.trustRow}>
          <Fingerprint size={14} color={isAvailable ? T.green : isDegraded ? T.orange : T.textMuted} />
          <Text style={styles.trustText}>
            Identity: {isAvailable ? "Canonical" : isDegraded ? "Degraded" : "Unavailable"}
          </Text>
        </View>
        <View style={styles.trustRow}>
          <Shield size={14} color={trust?.engineStatus === "verified" ? T.green : T.textMuted} />
          <Text style={styles.trustText}>
            Verification: {trust?.engineStatus === "verified" ? "Verified" : "Unverified"}
          </Text>
        </View>

        {attribution && (
          <View style={styles.trustRow}>
            <Info size={14} color={T.blue} />
            <Text style={styles.trustText}>
              Source: {attribution.provider} {attribution.rightsClassification === "unclear" ? "(Rights unclear)" : ""}
            </Text>
          </View>
        )}

        {objectiveType === "training" && (
          <View style={styles.trustRow}>
            <Dna size={14} color={T.textMuted} />
            <Text style={styles.trustText}>
              Mountain DNA: Unavailable until both records cross verified boundary.
            </Text>
          </View>
        )}
      </View>

      {/* Route Options */}
      {routes.map((route, i) => {
        const dc = DIFF_COLOR[route.difficulty] ?? T.blue;
        return (
          <View key={i} style={[styles.routeCard, route.isRecommended && styles.routeCardRecommended]}>
            {route.isRecommended && (
              <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
            )}

            <View style={styles.routeHeaderRow}>
              <View style={{ flex: 1, gap: 2 }}>
                {route.isRecommended && (
                  <View style={styles.recommendedBadge}>
                    <Star size={9} color={T.green} />
                    <Text style={styles.recommendedText}>Best for {objectiveType === "expedition" ? "simulation" : "training"}</Text>
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

            <View style={styles.whyBox}>
               <Text style={styles.whyTitle}>Why this route?</Text>
               <Text style={styles.routeDescription}>{route.description}</Text>
            </View>

            <TouchableOpacity
              style={styles.routeMapBtn}
              onPress={() => onNavigateToStart(i)}
              activeOpacity={0.8}
            >
              <Navigation size={12} color={T.blue} />
              <Text style={styles.routeMapBtnText}>Navigate to start</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: T.text,
  },
  trustBanner: {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    padding: 12,
    gap: 8,
    marginBottom: 8,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  trustText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    lineHeight: 18,
    flex: 1,
  },
  routeCard: {
    backgroundColor: T.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    overflow: "hidden",
  },
  routeCardRecommended: {
    borderColor: T.green + "40",
  },
  routeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  recommendedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: T.green + "20",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  recommendedText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: T.green,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  routeName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: T.text,
  },
  diffBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  diffText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  routeStats: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  routeStat: {
    gap: 2,
  },
  routeStatVal: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: T.text,
  },
  routeStatLbl: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
  },
  whyBox: {
    backgroundColor: "rgba(0,0,0,0.15)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
    borderLeftWidth: 2,
    borderLeftColor: T.blue + "50",
  },
  whyTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: T.textDim,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
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
    paddingVertical: 10,
    backgroundColor: T.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
  },
  routeMapBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: T.text,
  },
});
