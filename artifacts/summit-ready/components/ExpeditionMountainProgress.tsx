/**
 * ExpeditionMountainProgress
 *
 * Production expedition progress section matching the mock-up design.
 * Replaces the old elevation chart with the MountainProgress component
 * as the centrepiece, plus stage cards, stat tiles and a CTA row.
 */

import React, { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar, ChevronRight, Flag, Mountain, TrendingUp, Trophy } from "lucide-react-native";

import MountainProgress, { ExpeditionStage } from "@/components/MountainProgress";
import { T } from "@/constants/theme";
import { getPointAtFraction } from "@/utils/mountainPath";
import type { NearbyHill } from "@/context/AppContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  targetElevation: number;       // total metres target (denominator)
  currentElevation: number;      // total metres trained  (numerator)
  stages: NearbyHill[];          // virtualHills[]
  completedRoutes: string[];     // route names that are done
  days: number;                  // expedition day count
  highestPoint: number;          // summit ASL or target elevation
  onStagePress: (name: string) => void;
  onCtaPress: () => void;        // opens route picker or completion screen
  allDone: boolean;              // all routes completed
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtElev(m: number): string {
  if (m <= 0) return "0m";
  return `${Math.round(m).toLocaleString()}m`;
}

const VB_H = 270;
const VB_W = 360;

// ── Component ─────────────────────────────────────────────────────────────────

export function ExpeditionMountainProgress({
  targetElevation,
  currentElevation,
  stages,
  completedRoutes,
  days,
  highestPoint,
  onStagePress,
  onCtaPress,
  allDone,
}: Props) {

  // ── Derive MountainProgress stages ────────────────────────────────────────
  const mpStages: ExpeditionStage[] = useMemo(() => {
    let foundActive = false;
    return stages.map(h => {
      const done = completedRoutes.includes(h.name);
      const gain = h.totalElevation ?? h.elevation ?? 0;
      if (done) return { name: h.name, elevationGain: gain, status: "completed" as const };
      if (!foundActive) {
        foundActive = true;
        return { name: h.name, elevationGain: gain, status: "active" as const };
      }
      return { name: h.name, elevationGain: gain, status: "upcoming" as const };
    });
  }, [stages, completedRoutes]);

  // ── Stage status label ─────────────────────────────────────────────────────
  function statusLabel(h: NearbyHill, idx: number): "COMPLETE" | "NEXT UP" | "ACTIVE" | "UPCOMING" {
    if (completedRoutes.includes(h.name)) return "COMPLETE";
    const firstIdx = stages.findIndex(s => !completedRoutes.includes(s.name));
    if (idx === firstIdx) return completedRoutes.length === 0 ? "NEXT UP" : "ACTIVE";
    return "UPCOMING";
  }

  // ── Y-axis labels ─────────────────────────────────────────────────────────
  // Positions are derived from actual SVG path y-coordinates so labels sit
  // exactly at the summit, two thirds, one third, and base of the mountain.
  const yLabels = useMemo(() => {
    const fracs  = [1.0, 0.66, 0.33, 0.0] as const;
    const elevs  = [targetElevation, targetElevation * 0.66, targetElevation * 0.33, 0];
    return fracs.map((t, i) => ({
      label: fmtElev(elevs[i]),
      pct:   getPointAtFraction(t).y / VB_H,
    }));
  }, [targetElevation]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const hp = highestPoint > 0 ? highestPoint : targetElevation;
  const estCompletion = useMemo(() => {
    if (currentElevation <= 0 || targetElevation <= 0) return { value: "—", sub: "Not started" };
    const remaining = targetElevation - currentElevation;
    if (remaining <= 0) return { value: "Done", sub: "Expedition complete" };
    // Rough estimate: ~200m/session, ~3 sessions/week
    const sessionsLeft = Math.ceil(remaining / 200);
    const weeksLeft    = Math.ceil(sessionsLeft / 3);
    if (weeksLeft <= 1) return { value: "< 1 wk", sub: "Almost there!" };
    return { value: `${weeksLeft} wks`, sub: "Estimated" };
  }, [currentElevation, targetElevation]);

  const stats = [
    {
      icon:  <Mountain   size={16} color={T.blue}   />,
      value: fmtElev(targetElevation),
      label: "TOTAL ELEVATION",
      sub:   "Simulated gain",
    },
    {
      icon:  <TrendingUp size={16} color={T.green}  />,
      value: fmtElev(hp),
      label: "HIGHEST POINT",
      sub:   "Simulated summit",
    },
    {
      icon:  <Flag       size={16} color={T.orange} />,
      value: String(days),
      label: "DAYS",
      sub:   `${days === 1 ? "Day" : "Days"} expedition`,
    },
    {
      icon:  <Calendar   size={16} color={T.purple} />,
      value: estCompletion.value,
      label: "EST. COMPLETION",
      sub:   estCompletion.sub,
    },
  ];

  // ── CTA copy ──────────────────────────────────────────────────────────────
  const ctaTitle = allDone
    ? "Expedition Complete 🎉"
    : completedRoutes.length === 0
      ? "Your journey starts here"
      : "Continue Expedition";

  const ctaSub = allDone
    ? "View your achievement"
    : completedRoutes.length === 0
      ? `Begin Stage 1 and start your ascent.`
      : `${completedRoutes.length} of ${stages.length} stages complete`;

  return (
    <View>

      {/* ── Main progress card ───────────────────────────────────────────── */}
      <View style={s.card}>

        {/* Card header */}
        <View style={s.cardHeader}>
          <Text style={s.cardHeaderLabel}>TOTAL ELEVATION TARGET</Text>
          <Text style={s.cardHeaderElev}>▲ {fmtElev(targetElevation)}</Text>
          <Text style={s.cardHeaderSub}>Simulated elevation gain</Text>
        </View>

        {/* Mountain graphic — MountainProgress fills full card width */}
        <View>
          <MountainProgress
            targetElevationGain={targetElevation}
            currentElevationGain={currentElevation}
            stages={mpStages}
            style={s.mountainInCard}
          />

          {/* Y-axis labels overlay */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {yLabels.map(l => (
              <Text
                key={l.label}
                style={[s.yLabel, { top: `${Math.round(l.pct * 100)}%` as any }]}
              >
                {l.label}
              </Text>
            ))}
          </View>
        </View>
      </View>

      {/* ── Stage cards (horizontal scroll) ──────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.stageScroll}
        style={{ marginTop: 14 }}
      >
        {stages.map((h, i) => {
          const status = statusLabel(h, i);
          const done   = status === "COMPLETE";
          const isNext = status === "NEXT UP" || status === "ACTIVE";
          const gain   = h.totalElevation ?? h.elevation ?? 0;

          return (
            <TouchableOpacity
              key={h.name + i}
              style={[s.stageCard, done && s.stageCardDone]}
              activeOpacity={0.8}
              onPress={() => !done && onStagePress(h.name)}
            >
              {/* Number badge */}
              <View style={[
                s.stageNum,
                isNext && s.stageNumActive,
                done  && s.stageNumDone,
              ]}>
                <Text style={[s.stageNumText, (isNext || done) && s.stageNumTextActive]}>
                  {done ? "✓" : i + 1}
                </Text>
              </View>

              <Text style={s.stageCat}>STAGE {i + 1}</Text>
              <Text style={s.stageName} numberOfLines={2}>{h.name}</Text>
              <Text style={s.stageElev}>
                ▲ {Math.round(gain).toLocaleString()}m gain
              </Text>

              {/* Status badge */}
              <View style={[
                s.stageBadge,
                status === "NEXT UP"   && s.stageBadgeNext,
                status === "ACTIVE"    && s.stageBadgeActive,
                status === "COMPLETE"  && s.stageBadgeDone,
                status === "UPCOMING"  && s.stageBadgeUpcoming,
              ]}>
                <Text style={[
                  s.stageBadgeText,
                  status === "NEXT UP"   && { color: T.blue },
                  status === "ACTIVE"    && { color: T.green },
                  status === "COMPLETE"  && { color: T.green },
                  status === "UPCOMING"  && { color: T.textDim },
                ]}>
                  {status}
                </Text>
              </View>

              {!done && (
                <Text style={s.stageTap}>▶ Tap to start</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── 4-stat tiles ─────────────────────────────────────────────────── */}
      <View style={s.statsRow}>
        {stats.map((st, i) => (
          <View key={st.label} style={[s.statTile, i > 0 && s.statTileDivider]}>
            {st.icon}
            <Text style={s.statValue}>{st.value}</Text>
            <Text style={s.statLabel}>{st.label}</Text>
            <Text style={s.statSub}>{st.sub}</Text>
          </View>
        ))}
      </View>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={s.ctaCard}
        activeOpacity={0.85}
        onPress={onCtaPress}
      >
        <View style={s.ctaIcon}>
          <Trophy size={20} color={allDone ? "#FFD700" : T.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.ctaTitle}>{ctaTitle}</Text>
          <Text style={s.ctaSub}>{ctaSub}</Text>
        </View>
        <ChevronRight size={18} color={T.blue} />
      </TouchableOpacity>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({

  // ── Card ──
  card: {
    marginHorizontal: 14,
    borderRadius:     18,
    backgroundColor:  "#080F20",
    borderWidth:      1,
    borderColor:      "rgba(255,255,255,0.08)",
    overflow:         "hidden",
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingTop:        16,
    paddingBottom:     12,
  },
  cardHeaderLabel: {
    fontSize:    10,
    fontFamily:  "Inter_600SemiBold",
    color:       "rgba(255,255,255,0.45)",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  cardHeaderElev: {
    fontSize:   28,
    fontFamily: "Inter_700Bold",
    color:      "#fff",
    lineHeight: 33,
  },
  cardHeaderSub: {
    fontSize:   12,
    fontFamily: "Inter_400Regular",
    color:      "rgba(255,255,255,0.40)",
    marginTop:  2,
  },
  mountainInCard: {
    borderRadius: 0,
  },

  // ── Y-axis labels ──
  yLabel: {
    position:   "absolute",
    left:        7,
    fontSize:    9,
    fontFamily: "Inter_500Medium",
    color:      "rgba(255,255,255,0.40)",
  },

  // ── Stage cards ──
  stageScroll: {
    paddingHorizontal: 14,
    gap:               10,
    paddingBottom:      4,
  },
  stageCard: {
    width:            160,
    backgroundColor:  "#0D1729",
    borderRadius:     14,
    borderWidth:       1,
    borderColor:      "rgba(255,255,255,0.08)",
    padding:          14,
  },
  stageCardDone: {
    borderColor: "rgba(62,207,117,0.22)",
    backgroundColor: "rgba(62,207,117,0.04)",
  },

  stageNum: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth:      1,
    borderColor:     "rgba(255,255,255,0.16)",
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:     10,
  },
  stageNumActive: {
    backgroundColor: T.blue + "28",
    borderColor:     T.blue,
  },
  stageNumDone: {
    backgroundColor: "rgba(62,207,117,0.22)",
    borderColor:     "#3ECF75",
  },
  stageNumText: {
    fontSize:   12,
    fontFamily: "Inter_700Bold",
    color:      "rgba(255,255,255,0.55)",
  },
  stageNumTextActive: {
    color: "#fff",
  },
  stageCat: {
    fontSize:    9,
    fontFamily:  "Inter_600SemiBold",
    color:       T.blue,
    letterSpacing: 0.7,
    marginBottom:  4,
  },
  stageName: {
    fontSize:    13,
    fontFamily:  "Inter_700Bold",
    color:       "#fff",
    lineHeight:  17,
    marginBottom: 5,
  },
  stageElev: {
    fontSize:    11,
    fontFamily:  "Inter_500Medium",
    color:       T.blue,
    marginBottom: 10,
  },
  stageBadge: {
    alignSelf:        "flex-start",
    borderRadius:      6,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderWidth:       1,
    borderColor:      "rgba(255,255,255,0.12)",
    backgroundColor:  "rgba(255,255,255,0.05)",
    marginBottom:      8,
  },
  stageBadgeNext: {
    borderColor:     T.blue + "66",
    backgroundColor: T.blue + "18",
  },
  stageBadgeActive: {
    borderColor:     "#3ECF75" + "66",
    backgroundColor: "#3ECF75" + "18",
  },
  stageBadgeDone: {
    borderColor:     "#3ECF75" + "55",
    backgroundColor: "#3ECF75" + "14",
  },
  stageBadgeUpcoming: {
    borderColor:     "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  stageBadgeText: {
    fontSize:    9,
    fontFamily:  "Inter_700Bold",
    letterSpacing: 0.5,
  },
  stageTap: {
    fontSize:   10,
    fontFamily: "Inter_500Medium",
    color:      "rgba(255,255,255,0.30)",
  },

  // ── Stats ──
  statsRow: {
    flexDirection:   "row",
    marginHorizontal: 14,
    marginTop:        14,
    backgroundColor:  "#080F20",
    borderRadius:     16,
    borderWidth:       1,
    borderColor:      "rgba(255,255,255,0.08)",
    overflow:         "hidden",
  },
  statTile: {
    flex:            1,
    alignItems:      "center",
    paddingVertical:  14,
    paddingHorizontal: 4,
    gap:              4,
  },
  statTileDivider: {
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.07)",
  },
  statValue: {
    fontSize:   15,
    fontFamily: "Inter_700Bold",
    color:      "#fff",
    marginTop:   4,
  },
  statLabel: {
    fontSize:    8,
    fontFamily:  "Inter_600SemiBold",
    color:       "rgba(255,255,255,0.38)",
    letterSpacing: 0.5,
    textAlign:   "center",
  },
  statSub: {
    fontSize:   9,
    fontFamily: "Inter_400Regular",
    color:      "rgba(255,255,255,0.30)",
    textAlign:  "center",
  },

  // ── CTA ──
  ctaCard: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:              12,
    marginHorizontal: 14,
    marginTop:        14,
    backgroundColor:  "#080F20",
    borderRadius:     16,
    borderWidth:       1,
    borderColor:      "rgba(255,255,255,0.09)",
    padding:          16,
  },
  ctaIcon: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: "rgba(62,207,117,0.10)",
    borderWidth:      1,
    borderColor:     "rgba(62,207,117,0.25)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  ctaTitle: {
    fontSize:    15,
    fontFamily:  "Inter_700Bold",
    color:       "#fff",
    marginBottom: 2,
  },
  ctaSub: {
    fontSize:   12,
    fontFamily: "Inter_400Regular",
    color:      "rgba(255,255,255,0.45)",
  },
});
