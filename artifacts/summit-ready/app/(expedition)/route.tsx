/**
 * Route — expedition route sections screen.
 * Matches reference design: mountain photo hero with summit stats,
 * Route Overview / Local Adventure tabs, and a scrollable sections list
 * built from the AI expedition plan or virtual hills as a fallback.
 */

import {
  Mountain, MapPin, ChevronRight, TrendingUp, Clock, Flag,
  Layers, Navigation, CheckCircle,
} from "lucide-react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
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

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const PILL_OFFSET = 52;

type TabKey = "route" | "local";

// ── Helpers ────────────────────────────────────────────────────────────────────

const ROUTE_TYPE_COLOR: Record<string, string> = {
  trek:      T.orange,
  alpine:    T.green,
  technical: "#9B7FD4",
  classic:   "#20CFCF",
};

function routeTypeColor(hill: NearbyHill): string {
  const g = hill.grade?.toLowerCase() ?? "";
  if (g.includes("alpine")) return ROUTE_TYPE_COLOR.alpine;
  if (g.includes("hard"))   return ROUTE_TYPE_COLOR.technical;
  if (g.includes("easy"))   return ROUTE_TYPE_COLOR.trek;
  return ROUTE_TYPE_COLOR.classic;
}

function fmtMetres(m: number) {
  if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
  return `${m}m`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: T.white }}>{value}</Text>
      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

function SectionRow({
  index, name, sub, why, color, isLast,
}: { index: number; name: string; sub: string; why?: string; color: string; isLast: boolean }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(350)} style={[s.sectionRow, isLast && { borderBottomWidth: 0 }]}>
      {/* Timeline dot + line */}
      <View style={{ alignItems: "center", width: 28 }}>
        <View style={[s.timelineDot, { backgroundColor: color + "22", borderColor: color + "60" }]}>
          <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color }}>{index + 1}</Text>
        </View>
        {!isLast && <View style={s.timelineLine} />}
      </View>

      {/* Content */}
      <View style={{ flex: 1, paddingBottom: 18 }}>
        <Text style={s.rowName}>{name}</Text>
        <Text style={s.rowSub}>{sub}</Text>
        {why && (
          <Text style={s.rowWhy} numberOfLines={2}>{why}</Text>
        )}
      </View>

      <ChevronRight size={14} color={T.textDim} style={{ marginTop: 2 }} />
    </Animated.View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function RouteScreen() {
  useScreenView("expedition_route");
  const insets = useSafeAreaInsets();
  const { summitGoal, activeExpedition } = useApp();
  const [activeTab,    setActiveTab]    = useState<TabKey>("route");
  const [artworkError,  setArtworkError]  = useState(false);
  const [fallbackError, setFallbackError] = useState(false);
  const [challengeHeroUri, setChallengeHeroUri] = useState<string | null>(null);

  const target  = summitGoal?.targetMountain;
  const hills   = summitGoal?.virtualHills ?? [];
  const plan    = (summitGoal as any)?.expeditionPlan as { title?: string; concept?: string; days?: any[] } | null | undefined;
  const topInset = Platform.OS === "web" ? 20 : insets.top;

  // Fetch approved AI artwork for the active challenge
  React.useEffect(() => {
    const cid = activeExpedition?.challengeId;
    if (!cid) return;
    fetch(`${API_BASE}/sx/challenges/${encodeURIComponent(cid)}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: any) => {
        if (!d) return;
        const ch   = d.challenge ?? d;
        const path = ch.heroImage ?? ch.cardImage ?? null;
        if (path && ch.approved) {
          const base = API_BASE.replace(/\/api$/, "");
          setChallengeHeroUri(base + path);
        }
      })
      .catch(() => {});
  }, [activeExpedition?.challengeId]); // eslint-disable-line

  const heroUri = !summitGoal
    ? null
    : (challengeHeroUri && !artworkError)
      ? challengeHeroUri
      : fallbackError
        ? null
        : `${API_BASE}/mountain-image?name=${encodeURIComponent(summitGoal.mountainName)}&width=800&height=400`;

  // Build section list — prefer AI expedition plan, fall back to virtual hills
  const routeSections = (() => {
    if (activeTab === "route" && plan?.days && plan.days.length > 0) {
      const sections: Array<{ name: string; sub: string; why?: string; color: string }> = [];
      plan.days.forEach((day: any) => {
        (day.routes ?? []).forEach((r: any) => {
          sections.push({
            name:  r.name ?? "Route section",
            sub:   day.label ? `${day.label} · ${day.focus ?? ""}` : day.focus ?? "",
            why:   r.why,
            color: T.green,
          });
        });
      });
      return sections;
    }
    // Local adventure or no plan — use virtual hills
    return hills.map((h, i) => ({
      name:  h.name,
      sub:   `${h.elevation}m gain · ${h.distance}km · ×${h.repeats} reps`,
      why:   undefined,
      color: routeTypeColor(h),
    }));
  })();

  const totalSections = routeSections.length;
  const totalDistKm   = hills.reduce((s, h) => s + h.distance * h.repeats, 0).toFixed(1);
  const totalGain     = hills.reduce((s, h) => s + h.elevation * h.repeats, 0);
  const estimatedDays = target?.estimatedDays ?? 1;

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!summitGoal || !target) {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 32, marginTop: PILL_OFFSET }}>
          <View style={{ width: 66, height: 66, borderRadius: 18, backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center" }}>
            <Navigation size={30} color={T.blue} />
          </View>
          <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: T.white, textAlign: "center" }}>
            No route yet
          </Text>
          <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 21 }}>
            Choose a virtual mountain to see your equivalent training route.
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

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120 }}
      >
        {/* ── Mountain hero ───────────────────────────────────────────────── */}
        <View style={s.heroWrap}>
          {heroUri ? (
            <ExpoImage
              source={{ uri: heroUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              onError={() => {
                if (challengeHeroUri && !artworkError) {
                  setArtworkError(true);
                } else {
                  setFallbackError(true);
                }
              }}
            />
          ) : (
            <LinearGradient colors={["#0E2240", "#071428", T.bg]} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.50)", "transparent"]}
            style={[StyleSheet.absoluteFill, { height: "50%" }]}
          />
          <LinearGradient
            colors={["transparent", "rgba(6,10,20,0.92)", T.bg]}
            style={[StyleSheet.absoluteFill, { top: "45%" }]}
          />

          {/* Top nav */}
          <View style={[s.heroTopRow, { paddingTop: topInset + PILL_OFFSET + 6 }]}>
            <Text style={s.heroTitle}>{summitGoal.mountainName}</Text>
          </View>

          {/* Route overlay showing on mountain */}
          <View style={s.routeOverlay}>
            <View style={s.routeLineDot} />
            <View style={s.routeLineTrack} />
            <View style={[s.routeLineDot, { backgroundColor: T.orange }]} />
          </View>
        </View>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <View style={s.tabRow}>
          {([
            { key: "route", label: "Route Overview"   },
            { key: "local", label: "Local Adventure"  },
          ] as const).map(tab => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[s.tab, activeTab === tab.key && s.tabActive]}
              activeOpacity={0.75}
            >
              <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Stats row ───────────────────────────────────────────────────── */}
        <View style={s.statsCard}>
          <StatChip label="Summit" value={`${target.summitElevation.toLocaleString()}m`} />
          <View style={s.statDiv} />
          <StatChip label="Sections" value={`${totalSections}`} />
          <View style={s.statDiv} />
          <StatChip label="Total Dist." value={`${totalDistKm}km`} />
          <View style={s.statDiv} />
          <StatChip label="Duration" value={`${estimatedDays}–${estimatedDays + 1} days`} />
        </View>

        {/* ── Expedition concept ───────────────────────────────────────────── */}
        {activeTab === "route" && plan?.concept && (
          <Animated.View entering={FadeInDown.delay(60).duration(350)} style={s.conceptCard}>
            <LinearGradient colors={["rgba(255,255,255,0.04)", "transparent"]} style={StyleSheet.absoluteFill} />
            {plan.title && <Text style={s.conceptTitle}>{plan.title}</Text>}
            <Text style={s.conceptText}>{plan.concept}</Text>
          </Animated.View>
        )}

        {/* ── Section label ────────────────────────────────────────────────── */}
        <View style={{ marginHorizontal: 14, marginTop: 12, marginBottom: 6 }}>
          <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 1.2 }}>
            {activeTab === "route" ? "ROUTE SECTIONS" : "LOCAL TRAINING HILLS"}  ·  {totalSections}
          </Text>
        </View>

        {/* ── Sections list ───────────────────────────────────────────────── */}
        <View style={s.sectionsCard}>
          {routeSections.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
              <Layers size={24} color={T.textDim} />
              <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.textMuted, textAlign: "center" }}>
                No route sections yet
              </Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center" }}>
                Regenerate your expedition to see route sections.
              </Text>
            </View>
          ) : (
            routeSections.map((sec, i) => (
              <SectionRow
                key={i}
                index={i}
                name={sec.name}
                sub={sec.sub}
                why={sec.why}
                color={sec.color}
                isLast={i === routeSections.length - 1}
              />
            ))
          )}
        </View>

        {/* ── Footer stats ─────────────────────────────────────────────────── */}
        <View style={s.footerStats}>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <TrendingUp size={13} color={T.textDim} />
            <Text style={s.footerStatText}>Highest point</Text>
            <Text style={s.footerStatValue}>{target.summitElevation.toLocaleString()}m</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <Flag size={13} color={T.textDim} />
            <Text style={s.footerStatText}>Total ascent</Text>
            <Text style={s.footerStatValue}>{totalGain.toLocaleString()}m</Text>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  heroWrap: { height: 280, overflow: "hidden" },
  heroTopRow: { paddingHorizontal: 16, paddingBottom: 8 },
  heroTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#fff" },

  routeOverlay: {
    position: "absolute", bottom: 40, left: "30%", right: "20%",
    flexDirection: "row", alignItems: "center", gap: 2,
  },
  routeLineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.green, borderWidth: 2, borderColor: "#fff" },
  routeLineTrack: { flex: 1, height: 2, backgroundColor: T.green, opacity: 0.7 },

  tabRow: {
    flexDirection: "row", marginHorizontal: 14, marginTop: -8, marginBottom: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12, padding: 3,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  tabActive: { backgroundColor: T.blue },
  tabText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textDim },
  tabTextActive: { color: "#fff" },

  statsCard: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 14, marginBottom: 12, padding: 14,
    borderRadius: 16, backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  statDiv: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.07)" },

  conceptCard: {
    marginHorizontal: 14, marginBottom: 8, padding: 14,
    borderRadius: 16, overflow: "hidden",
    borderWidth: 1, borderColor: T.blue + "20",
  },
  conceptTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.blue, marginBottom: 4 },
  conceptText:  { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 18 },

  sectionsCard: {
    marginHorizontal: 14, marginBottom: 12, padding: 14,
    borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },

  sectionRow: {
    flexDirection: "row", gap: 12, alignItems: "flex-start",
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
    paddingTop: 4,
  },
  timelineDot: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, flexShrink: 0,
  },
  timelineLine: { width: 1.5, flex: 1, backgroundColor: "rgba(255,255,255,0.08)", marginTop: 3 },
  rowName: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.white },
  rowSub:  { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 },
  rowWhy:  { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, marginTop: 3, fontStyle: "italic", lineHeight: 15 },

  footerStats: {
    marginHorizontal: 14, marginBottom: 8, padding: 12,
    borderRadius: 14, backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    flexDirection: "row", justifyContent: "space-around",
  },
  footerStatText:  { fontSize: 11, fontFamily: "Inter_500Medium", color: T.textMuted },
  footerStatValue: { fontSize: 11, fontFamily: "Inter_700Bold", color: T.white },
});
