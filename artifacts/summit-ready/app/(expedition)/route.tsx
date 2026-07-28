/**
 * Route — expedition hills breakdown screen.
 * Shows the recommended local hills and how they simulate the target mountain:
 * elevation contribution, distance, and cumulative progress toward the goal.
 */

import { Mountain, MapPin, ChevronRight, TrendingUp } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  Platform, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";
import { useScreenView } from "@/lib/analytics";
import type { NearbyHill } from "@/context/AppContext";

// Extra top padding for the ModeTogglePill overlay
const PILL_OFFSET = 52;

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

function elevationColor(pct: number) {
  if (pct >= 70) return T.green;
  if (pct >= 40) return T.blue;
  if (pct >= 20) return T.orange;
  return T.red;
}

function HillCard({ hill, totalGain, index }: { hill: NearbyHill; totalGain: number; index: number }) {
  const contribution = totalGain > 0 ? Math.round((hill.elevation * hill.repeats) / totalGain * 100) : 0;
  const color        = elevationColor(contribution);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 55).duration(400)}
      style={s.hillCard}
    >
      {/* Rank badge */}
      <View style={[s.rankBadge, { backgroundColor: T.blueDim }]}>
        <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: T.blue }}>{index + 1}</Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.hillName}>{hill.name}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Chip label={`${hill.elevation}m gain`} />
          <Chip label={`${hill.distance}km`} />
          <Chip label={`×${hill.repeats} reps`} />
        </View>
        {/* Elevation contribution bar */}
        <View style={s.barTrack}>
          <View style={[s.barFill, { width: `${Math.min(100, contribution)}%` as any, backgroundColor: color }]} />
        </View>
        <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim }}>
          {contribution}% of target elevation gain
        </Text>
      </View>
    </Animated.View>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View style={s.chip}>
      <Text style={s.chipText}>{label}</Text>
    </View>
  );
}

export default function RouteScreen() {
  useScreenView("expedition_route");
  const insets     = useSafeAreaInsets();
  const { summitGoal } = useApp();

  const topPad = (Platform.OS === "web" ? 16 : insets.top) + PILL_OFFSET + 8;
  const botPad = Platform.OS === "web" ? 120 : insets.bottom + 120;

  // ── No goal ───────────────────────────────────────────────────────────────
  if (!summitGoal) {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 32, marginTop: PILL_OFFSET }}>
          <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center" }}>
            <Mountain size={30} color={T.blue} />
          </View>
          <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: T.white, textAlign: "center" }}>
            No expedition active
          </Text>
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 20 }}>
            Browse mountains to start your virtual expedition.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(expedition)/mountains" as any)}
            style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, backgroundColor: T.blue }}
          >
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>Browse Mountains</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  const hills      = summitGoal.virtualHills ?? [];
  const totalGain  = summitGoal.elevationGain;
  const hikeProgress = summitGoal.virtualHikeProgress;
  const elevGained = hikeProgress?.elevationGained ?? 0;
  const overallPct = totalGain > 0 ? Math.round(Math.min(100, (elevGained / totalGain) * 100)) : 0;
  const target     = summitGoal.targetMountain;

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: topPad, paddingBottom: botPad, gap: 14 }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={{ gap: 2 }}>
          <Text style={s.pageTitle}>Your Route</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <MapPin size={11} color={T.blue} />
            <Text style={s.pageSub}>
              Simulating {summitGoal.mountainName}
              {target?.country ? ` · ${target.country}` : ""}
            </Text>
          </View>
        </View>

        {/* ── Overall progress ────────────────────────────────────────────── */}
        <View style={s.progressCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <TrendingUp size={16} color={T.blue} />
            <Text style={s.cardTitle}>ELEVATION PROGRESS</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={s.elevGained}>{elevGained.toLocaleString()}m gained</Text>
            <Text style={s.elevGoal}>/ {totalGain.toLocaleString()}m goal</Text>
          </View>
          <View style={s.barTrack}>
            <Animated.View
              style={[s.barFill, {
                width: `${overallPct}%` as any,
                backgroundColor: elevationColor(overallPct),
                height: 6,
                borderRadius: 3,
              }]}
            />
          </View>
          <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 6 }}>
            {overallPct}% of total expedition elevation complete
          </Text>
        </View>

        {/* ── Hills list ──────────────────────────────────────────────────── */}
        {hills.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text style={s.sectionTitle}>
              RECOMMENDED HILLS · {hills.length} locations
            </Text>
            {hills.map((h, i) => (
              <HillCard key={h.name + i} hill={h} totalGain={totalGain} index={i} />
            ))}
          </View>
        ) : (
          <View style={s.emptyState}>
            <Mountain size={28} color={T.textDim} />
            <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" }}>
              Head to Base Camp to load your recommended hills.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(expedition)/base-camp" as any)}
              style={s.emptyBtn}
            >
              <Text style={{ color: T.blue, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Go to Base Camp</Text>
              <ChevronRight size={14} color={T.blue} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Target summary ──────────────────────────────────────────────── */}
        {target && (
          <View style={s.targetCard}>
            <Text style={s.sectionTitle}>TARGET SUMMIT</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
              <View style={s.mountainIcon}>
                <Mountain size={20} color={T.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: T.white }}>{summitGoal.mountainName}</Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted }}>
                  {target.summitElevation.toLocaleString()}m  ·  {target.difficulty}
                </Text>
              </View>
            </View>
            {target.notes && (
              <Text style={s.targetDesc}>{target.notes}</Text>
            )}
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  pageTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.white },
  pageSub:   { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },

  sectionTitle: {
    fontSize: 9, fontFamily: "Inter_700Bold",
    color: T.textDim, letterSpacing: 1,
  },

  progressCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(74,159,245,0.15)",
  },
  cardTitle: { fontSize: 9, fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 1 },
  elevGained: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.white },
  elevGoal:   { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textDim },

  barTrack: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" },
  barFill:  { height: 6, borderRadius: 3 },

  hillCard: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    alignItems: "flex-start",
  },
  rankBadge: {
    width: 28, height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  hillName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.white },

  chip: {
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  chipText: { fontSize: 10, fontFamily: "Inter_500Medium", color: T.textMuted },

  emptyState: {
    alignItems: "center", gap: 12, padding: 28,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1,
    borderColor: T.blue + "40",
  },

  targetCard: {
    padding: 14, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(74,159,245,0.12)",
    gap: 4,
  },
  mountainIcon: {
    width: 40, height: 40,
    borderRadius: 12,
    backgroundColor: T.blueDim,
    alignItems: "center",
    justifyContent: "center",
  },
  targetDesc: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: T.textMuted, lineHeight: 18, marginTop: 6,
  },
});
