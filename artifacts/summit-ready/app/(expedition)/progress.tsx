/**
 * Progress — Expedition progress screen.
 * Header with name + overall %, shared ExpeditionProgressCard,
 * and a progress insight row at the bottom.
 */

import { TrendingUp } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  Dimensions, Platform, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";
import { useScreenView } from "@/lib/analytics";
import {
  ExpeditionProgressCard,
  fmtM,
} from "@/components/ExpeditionProgressCard";

// ── Layout constants ──────────────────────────────────────────────────────────

const PILL_OFFSET = 52;
const CARD_MX = 16;

// ── Helpers ───────────────────────────────────────────────────────────────────

function insightMsg(done: number, total: number, remainM: number) {
  if (total === 0)   return { title: "No stages yet",      body: "Start an expedition to track your route progress." };
  if (done === 0)    return { title: "Ready to climb!",    body: `${total} route${total !== 1 ? "s" : ""} to complete. Log your first hike to get started.` };
  if (done >= total) return { title: "All routes complete! 🎉", body: "Head to Base Camp to finish your expedition." };
  return {
    title: "Excellent progress!",
    body: `You've completed ${done} stage${done !== 1 ? "s" : ""}. Just ${Math.round(remainM).toLocaleString()}m to your simulated summit.`,
  };
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ExpeditionProgressScreen() {
  useScreenView("expedition_progress");
  const insets = useSafeAreaInsets();
  const { summitGoal, sessions, activeExpedition } = useApp();

  const target  = summitGoal?.targetMountain;
  const stages  = summitGoal?.virtualHills ?? [];
  const completedRoutes: string[] = activeExpedition?.completedRoutes
    ?? summitGoal?.completedRoutes ?? [];

  // ── Derived ─────────────────────────────────────────────────────────────────
  const totalElevGoal = useMemo(
    () => target?.totalElevationGain
      ?? stages.reduce((s, h) => s + h.elevation * h.repeats, 0),
    [target, stages],
  );
  const totalTrained = useMemo(
    () => sessions.reduce((s, sess) => s + (sess.elevationGain ?? 0), 0),
    [sessions],
  );
  const pct = totalElevGoal > 0
    ? Math.min(100, Math.round(totalTrained / totalElevGoal * 100))
    : 0;

  const completedCount = useMemo(
    () => completedRoutes.filter(r => stages.some(s => s.name === r)).length,
    [completedRoutes, stages],
  );
  const remaining = Math.max(0, totalElevGoal - totalTrained);

  const expName   = (summitGoal as any)?.expeditionPlan?.title
    ?? target?.name ?? summitGoal?.mountainName ?? "Your Expedition";
  const daysText  = target?.estimatedDays
    ? `${target.estimatedDays} Day${target.estimatedDays !== 1 ? "s" : ""} Expedition`
    : null;
  const regionText = summitGoal?.location ?? null;

  const insight = insightMsg(completedCount, stages.length, remaining);

  const topInset = Platform.OS === "web" ? 20 : insets.top;

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!summitGoal) {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 32, marginTop: PILL_OFFSET }}>
          <View style={{ width: 66, height: 66, borderRadius: 18, backgroundColor: T.blueDim, alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={30} color={T.blue} />
          </View>
          <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: T.white, textAlign: "center" }}>
            No expedition yet
          </Text>
          <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 21 }}>
            Start a virtual expedition to track your progress toward a summit.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(expedition)/mountains" as any)}
            style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, backgroundColor: T.blue }}
          >
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>Choose Mountain</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // ── Filled state ─────────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop:    topInset + PILL_OFFSET + 16,
          paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120,
          gap: 12,
        }}
      >

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerLabel}>EXPEDITION PROGRESS</Text>
            <Text style={s.headerTitle} numberOfLines={2}>{expName}</Text>
            {(daysText || regionText) && (
              <Text style={s.headerSub}>
                {[daysText, regionText].filter(Boolean).join(" • ")}
              </Text>
            )}
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerRightLabel}>OVERALL PROGRESS</Text>
            <Text style={[s.headerPct, { color: pct >= 80 ? T.green : pct >= 40 ? T.blue : T.orange }]}>
              {pct}%
            </Text>
            <Text style={s.headerRightSub}>
              {fmtM(totalTrained)}m of {fmtM(totalElevGoal)}m
            </Text>
          </View>
        </Animated.View>

        {/* ── Chart + stage cards + summary (shared) ──────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <ExpeditionProgressCard
            stages={stages}
            completedRoutes={completedRoutes}
            totalElev={totalElevGoal}
            totalTrained={totalTrained}
            onStagePress={(hillName) =>
              router.push({ pathname: "/hike-tracking" as any, params: { hillName } })
            }
          />
        </Animated.View>

        {/* ── Insight row ─────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <TouchableOpacity
            style={s.insightRow}
            activeOpacity={0.8}
            onPress={() => router.push("/(expedition)/base-camp" as any)}
          >
            <LinearGradient
              colors={["rgba(255,255,255,0.04)", "transparent"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.insightIcon}>
              <Text style={{ fontSize: 22 }}>🏆</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.insightTitle}>{insight.title}</Text>
              <Text style={s.insightBody}>{insight.body}</Text>
            </View>
            <Text style={{ fontSize: 18, color: "rgba(255,255,255,0.2)", marginLeft: 8 }}>›</Text>
          </TouchableOpacity>
        </Animated.View>

      </ScrollView>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: CARD_MX, gap: 12,
  },
  headerLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold",
    color: T.blue, letterSpacing: 1.4, marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22, fontFamily: "Inter_700Bold", color: T.white, lineHeight: 26,
  },
  headerSub: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 4,
  },
  headerRight:      { alignItems: "flex-end", minWidth: 100 },
  headerRightLabel: {
    fontSize: 9, fontFamily: "Inter_700Bold",
    color: T.textDim, letterSpacing: 1.2, marginBottom: 2,
  },
  headerPct: { fontSize: 36, fontFamily: "Inter_700Bold", lineHeight: 38 },
  headerRightSub: {
    fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2,
  },

  insightRow: {
    marginHorizontal: CARD_MX,
    borderRadius: 18, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  insightIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "rgba(74,159,245,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  insightTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 3 },
  insightBody:  { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 17 },
});
