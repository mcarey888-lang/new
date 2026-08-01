/**
 * Expedition Complete — celebration screen shown when the user finishes all
 * routes in their active expedition.
 *
 * Navigation flow:
 *   hike-tracking.tsx (final route prompt "Yes") → this screen
 *   base-camp.tsx     (Quick Start when all done) → this screen
 *
 * On mount: calls completeExpedition() to freeze the stats snapshot in the
 * Adventure Library and clear the active expedition pointer.
 */

import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { ConfettiCelebration } from "@/components/ConfettiCelebration";
import { T } from "@/constants/theme";
import { useScreenView } from "@/lib/analytics";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

function artworkUrl(storedPath: string | null | undefined): string | null {
  if (!storedPath) return null;
  const base = API_BASE.replace(/\/api$/, "");
  return base + storedPath;
}

export default function ExpeditionCompleteScreen() {
  useScreenView("ExpeditionComplete");
  const insets    = useSafeAreaInsets();
  const topInset  = Platform.OS === "web" ? 20 : insets.top;

  const {
    activeExpedition,
    activeExpeditionId,
    sessions,
    completeExpedition,
  } = useApp();

  // ── Approved artwork for the hero image ──────────────────────────────────────
  const [heroArtwork, setHeroArtwork] = useState<string | null>(null);
  useEffect(() => {
    const cid = activeExpedition?.challengeId;
    if (!cid) return;
    fetch(`${API_BASE}/sx/challenges/${encodeURIComponent(cid)}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: any) => {
        if (!d) return;
        const path = d.heroImage ?? d.cardImage ?? null;
        const url  = artworkUrl(path);
        if (url && d.approved) setHeroArtwork(url);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Snapshot stats from the session log ──────────────────────────────────────
  const totalElevationM  = Math.round(sessions.reduce((s, h) => s + (h.elevationGain ?? 0), 0));
  const totalDistanceKm  = parseFloat(sessions.reduce((s, h) => s + (h.distance ?? 0), 0).toFixed(1));
  const totalSessions    = sessions.length;

  const startedAt        = activeExpedition?.startedAt;
  const daysToComplete   = startedAt
    ? Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / (1000 * 60 * 60 * 24)))
    : 1;

  const expeditionName   = activeExpedition?.challengeName ?? "Your Expedition";
  const mountainName     = activeExpedition?.targetMountainName ?? expeditionName;
  const routeCount       = activeExpedition?.virtualHills?.length
                           ?? activeExpedition?.completedRoutes?.length ?? 0;

  // ── Mark complete once (idempotent) ──────────────────────────────────────────
  const didComplete = useRef(false);
  useEffect(() => {
    if (!didComplete.current && activeExpeditionId) {
      didComplete.current = true;
      void completeExpedition(activeExpeditionId, {
        totalElevationM,
        totalDistanceKm,
        totalSessions,
        daysToComplete,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Stats grid ───────────────────────────────────────────────────────────────
  const statsGrid = [
    {
      val:   totalElevationM >= 1000
               ? `${(totalElevationM / 1000).toFixed(1)}k`
               : `${totalElevationM}`,
      unit:  "m",
      label: "ELEVATION",
    },
    { val: `${totalDistanceKm}`, unit: "km", label: "DISTANCE"  },
    { val: `${totalSessions}`,   unit: "",   label: "SESSIONS"  },
    { val: `${daysToComplete}`,  unit: "",   label: "DAYS"      },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>

      {/* ── Confetti ── */}
      <ConfettiCelebration />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.container,
          { paddingTop: topInset + 20, paddingBottom: insets.bottom + 48 },
        ]}
      >
        {/* Mountain hero image — prefer approved AI artwork, fall back to Wikimedia */}
        <Animated.View entering={FadeIn.duration(700)} style={s.heroWrap}>
          <ExpoImage
            source={{ uri: heroArtwork ?? `${API_BASE}/mountain-image?name=${encodeURIComponent(mountainName)}&width=640&height=360` }}
            style={s.heroImage}
            contentFit="cover"
          />
          <LinearGradient
            colors={["transparent", T.bg]}
            locations={[0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Badge — floats over the bottom edge of the image */}
        <Animated.View entering={FadeInDown.duration(600).delay(250)} style={s.badge}>
          <Text style={s.badgeEmo}>🏔️</Text>
        </Animated.View>

        {/* Headline */}
        <Animated.View entering={FadeInDown.duration(600).delay(400)} style={s.headlineWrap}>
          <Text style={s.completedLabel}>EXPEDITION COMPLETE</Text>
          <Text style={s.headline}>{expeditionName}</Text>
          <Text style={s.sub}>
            {routeCount > 0
              ? `${routeCount} route${routeCount !== 1 ? "s" : ""} conquered · ${daysToComplete} day${daysToComplete !== 1 ? "s" : ""} of adventure`
              : `${daysToComplete} day${daysToComplete !== 1 ? "s" : ""} of adventure`}
          </Text>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInDown.duration(600).delay(550)} style={s.statsCard}>
          <LinearGradient
            colors={["rgba(62,207,117,0.07)", "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          {statsGrid.map((stat, i) => (
            <React.Fragment key={stat.label}>
              {i > 0 && <View style={s.statDivider} />}
              <View style={s.statCell}>
                <View style={s.statValueRow}>
                  <Text style={s.statValue}>{stat.val}</Text>
                  {!!stat.unit && <Text style={s.statUnit}>{stat.unit}</Text>}
                </View>
                <Text style={s.statLabel}>{stat.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </Animated.View>

        {/* Completed routes list */}
        {(activeExpedition?.completedRoutes?.length ?? 0) > 0 && (
          <Animated.View entering={FadeInDown.duration(600).delay(700)} style={s.routesList}>
            <Text style={s.routesTitle}>Routes Conquered</Text>
            {(activeExpedition!.completedRoutes ?? []).map((name) => (
              <View key={name} style={s.routeRow}>
                <View style={s.routeCheck}>
                  <Text style={s.routeCheckText}>✓</Text>
                </View>
                <Text style={s.routeName}>{name}</Text>
              </View>
            ))}
          </Animated.View>
        )}

        {/* CTAs */}
        <Animated.View entering={FadeInUp.duration(600).delay(850)} style={s.ctaArea}>
          <TouchableOpacity
            style={s.primaryBtn}
            activeOpacity={0.85}
            onPress={() => router.replace("/(expedition)/mountains" as any)}
          >
            <LinearGradient
              colors={[T.green, "#2AB860"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.primaryBtnGrad}
            >
              <Text style={s.primaryBtnText}>Start Your Next Expedition 🧭</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.secondaryBtn}
            activeOpacity={0.7}
            onPress={() => router.replace("/(expedition)/base-camp" as any)}
          >
            <Text style={s.secondaryBtnText}>Back to Base Camp</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 20, alignItems: "center" },

  // Hero image
  heroWrap: {
    width: "100%", height: 220, borderRadius: 24,
    overflow: "hidden", marginBottom: -44,
  },
  heroImage: { width: "100%", height: "100%" },

  // Badge
  badge: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: "rgba(62,207,117,0.13)",
    borderWidth: 2, borderColor: "rgba(62,207,117,0.38)",
    alignItems: "center", justifyContent: "center",
    zIndex: 2, marginBottom: 16,
  },
  badgeEmo: { fontSize: 40 },

  // Headline block
  headlineWrap: { alignItems: "center", gap: 6, marginBottom: 28 },
  completedLabel: {
    fontSize: 11, fontFamily: "Inter_700Bold", color: T.green,
    letterSpacing: 2, textTransform: "uppercase",
  },
  headline: {
    fontSize: 26, fontFamily: "Inter_700Bold", color: T.white,
    textAlign: "center", lineHeight: 32,
  },
  sub: {
    fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted,
    textAlign: "center", lineHeight: 20,
  },

  // Stats card
  statsCard: {
    flexDirection: "row", width: "100%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20, borderWidth: 1, borderColor: "rgba(62,207,117,0.15)",
    paddingVertical: 22, marginBottom: 20, overflow: "hidden",
  },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.07)" },
  statCell: { flex: 1, alignItems: "center", gap: 4 },
  statValueRow: { flexDirection: "row", alignItems: "flex-end", gap: 1 },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.white },
  statUnit: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginBottom: 2,
  },
  statLabel: {
    fontSize: 9, fontFamily: "Inter_400Regular", color: T.textMuted,
    textTransform: "uppercase", letterSpacing: 0.5,
  },

  // Routes list
  routesList: {
    width: "100%", marginBottom: 28,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    padding: 18, gap: 12,
  },
  routesTitle: {
    fontSize: 12, fontFamily: "Inter_700Bold", color: T.textMuted,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4,
  },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  routeCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(62,207,117,0.15)",
    borderWidth: 1, borderColor: "rgba(62,207,117,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  routeCheckText: { fontSize: 11, color: T.green, fontFamily: "Inter_700Bold" },
  routeName: {
    fontSize: 14, fontFamily: "Inter_500Medium", color: T.text, flex: 1,
  },

  // CTAs
  ctaArea: { width: "100%", gap: 12 },
  primaryBtn: { width: "100%", borderRadius: 16, overflow: "hidden" },
  primaryBtnGrad: {
    paddingVertical: 17, alignItems: "center", justifyContent: "center", borderRadius: 16,
  },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  secondaryBtn: { paddingVertical: 14, alignItems: "center" },
  secondaryBtnText: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted },
});
