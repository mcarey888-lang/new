/**
 * Progress — Expedition progress screen.
 * Redesigned to match reference: header with %, SVG elevation line chart,
 * stage status cards, elevation summary stats, and an insight row.
 */

import { Flag, TrendingUp, Trophy, Play } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  Dimensions, Platform, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import Svg, {
  Path, Circle, Rect, Line,
  Text as SvgText,
  Defs, LinearGradient as SvgGrad, Stop, G,
} from "react-native-svg";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";
import { useScreenView } from "@/lib/analytics";
import type { NearbyHill } from "@/context/AppContext";

// ── Layout constants ──────────────────────────────────────────────────────────

const PILL_OFFSET  = 52;
const SCREEN_W     = Math.min(Dimensions.get("window").width, 430);
const CARD_MX      = 16;
const CARD_W       = SCREEN_W - CARD_MX * 2;
const CHART_H      = 216;
/** Padding inside the SVG plot area */
const P = { top: 62, right: 72, bottom: 10, left: 46 };
const PW = CARD_W - P.left - P.right;   // plot width
const PH = CHART_H - P.top - P.bottom;  // plot height

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtM(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}k` : `${Math.round(m)}`;
}
function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
function insightMsg(done: number, total: number, remainM: number) {
  if (total === 0)      return { title: "No stages yet", body: "Start an expedition to track your route progress." };
  if (done === 0)       return { title: "Ready to climb!", body: `${total} route${total !== 1 ? "s" : ""} to complete. Log your first hike to get started.` };
  if (done >= total)    return { title: "All routes complete! 🎉", body: "Head to Base Camp to finish your expedition." };
  return {
    title: "Excellent progress!",
    body: `You've completed ${done} stage${done !== 1 ? "s" : ""}. Just ${Math.round(remainM).toLocaleString()}m to your simulated summit.`,
  };
}

// ── SVG elevation line chart ──────────────────────────────────────────────────

interface ChartProps {
  stages:          NearbyHill[];
  completedRoutes: string[];
  totalElev:       number;   // elevation target
  totalTrained:    number;   // elevation gained so far
}

function ElevationLineChart({ stages, completedRoutes, totalElev, totalTrained }: ChartProps) {
  const n = stages.length;
  if (n === 0 || totalElev === 0) return null;

  // Cumulative elevation per stage checkpoint (index 0 = start at 0m)
  const cum: number[] = [0];
  for (const st of stages) {
    cum.push(cum[cum.length - 1] + st.elevation * st.repeats);
  }
  const maxE = Math.max(totalElev, cum[n]);

  const toX = (i: number) => P.left + (i / n) * PW;
  const toY = (e: number) => P.top + PH - (Math.min(e, maxE) / maxE) * PH;

  // Chart points: index 0 = start, 1..n = stages
  const pts = cum.map((e, i) => ({ x: toX(i), y: toY(e), e }));

  // SVG paths
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fillPath = linePath + ` L${pts[n].x.toFixed(1)},${toY(0).toFixed(1)} L${pts[0].x.toFixed(1)},${toY(0).toFixed(1)} Z`;

  // Current progress interpolated on the line
  const clamped = Math.min(totalTrained, maxE);
  let progX = pts[0].x, progY = pts[0].y;
  if (clamped > 0) {
    for (let i = 1; i <= n; i++) {
      if (clamped <= cum[i] || i === n) {
        const t = cum[i] > cum[i - 1]
          ? (clamped - cum[i - 1]) / (cum[i] - cum[i - 1])
          : 1;
        progX = pts[i - 1].x + t * (pts[i].x - pts[i - 1].x);
        progY = pts[i - 1].y + t * (pts[i].y - pts[i - 1].y);
        break;
      }
    }
  }
  const pct = Math.round(clamped / maxE * 100);

  // Dashed "remaining" segment after the progress point
  const afterPts = pts.filter((_, i) => i > 0 && cum[i] > clamped);
  const dashPath = afterPts.length > 0
    ? `M${progX.toFixed(1)},${progY.toFixed(1)} ` + afterPts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
    : null;

  // Y-axis grid ticks
  const yTicks = [0, Math.round(maxE * 0.34), Math.round(maxE * 0.68), maxE];

  // Mountain silhouette (decorative background shape)
  const bY = P.top + PH;
  const mtn = [
    `M${P.left},${bY}`,
    `L${P.left + PW * 0.08},${bY - PH * 0.12}`,
    `L${P.left + PW * 0.22},${bY - PH * 0.08}`,
    `L${P.left + PW * 0.40},${bY - PH * 0.30}`,
    `L${P.left + PW * 0.52},${bY - PH * 0.18}`,
    `L${P.left + PW * 0.63},${bY - PH * 0.24}`,
    `L${P.left + PW * 0.76},${bY - PH * 0.60}`,
    `L${P.left + PW * 0.85},${bY - PH * 0.44}`,
    `L${P.left + PW * 0.92},${bY - PH * 0.68}`,
    `L${P.left + PW},${bY - PH * 0.54}`,
    `L${P.left + PW},${bY} Z`,
  ].join(" ");

  const summitPt = pts[n];

  // Determine if progress callout fits above or needs to go below
  const progCalloutAbove = progY > P.top + PH * 0.45;

  return (
    <Svg width={CARD_W} height={CHART_H}>
      <Defs>
        <SvgGrad id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0"   stopColor="#4A9FF5" stopOpacity="0.38" />
          <Stop offset="0.6" stopColor="#4A9FF5" stopOpacity="0.08" />
          <Stop offset="1"   stopColor="#4A9FF5" stopOpacity="0.00" />
        </SvgGrad>
        <SvgGrad id="mtnBg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1E3048" stopOpacity="0.9" />
          <Stop offset="1" stopColor="#0B1724" stopOpacity="0.5" />
        </SvgGrad>
      </Defs>

      {/* Mountain silhouette */}
      <Path d={mtn} fill="url(#mtnBg)" />

      {/* Y-axis grid + labels */}
      {yTicks.map((e, i) => {
        const y = toY(e);
        return (
          <G key={i}>
            <Line
              x1={P.left} y1={y} x2={P.left + PW} y2={y}
              stroke="rgba(255,255,255,0.07)" strokeWidth={1}
              strokeDasharray={e === 0 ? undefined : "4,5"}
            />
            <SvgText
              x={P.left - 5} y={y + 3.5}
              fontSize={9} fill="rgba(255,255,255,0.32)"
              textAnchor="end" fontFamily="Inter_400Regular"
            >{fmtM(e)}m</SvgText>
          </G>
        );
      })}

      {/* Gradient fill under the line */}
      <Path d={fillPath} fill="url(#lineFill)" />

      {/* Solid elevation line */}
      <Path
        d={linePath}
        stroke="#4A9FF5" strokeWidth={2.5}
        fill="none" strokeLinejoin="round" strokeLinecap="round"
      />

      {/* Dashed remaining path */}
      {dashPath && (
        <Path
          d={dashPath}
          stroke="rgba(255,255,255,0.28)" strokeWidth={2}
          fill="none" strokeDasharray="5,4" strokeLinecap="round"
        />
      )}

      {/* Stage markers + callouts */}
      {stages.map((st, i) => {
        const pt   = pts[i + 1];
        const done = completedRoutes.includes(st.name);
        // Above when the marker is in the lower half (high y = low on screen)
        const above = pt.y >= P.top + PH * 0.48;
        const elev  = Math.round(st.elevation * st.repeats);
        const name  = clip(st.name, 15);

        return (
          <G key={st.name}>
            {/* Connector */}
            {above ? (
              <Line x1={pt.x} y1={pt.y - 12} x2={pt.x} y2={pt.y - 34}
                stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
            ) : (
              <Line x1={pt.x} y1={pt.y + 12} x2={pt.x} y2={pt.y + 30}
                stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
            )}
            {/* Callout text */}
            {above ? (
              <G>
                <SvgText x={pt.x} y={pt.y - 38} fontSize={8} fill="#fff"
                  textAnchor="middle" fontFamily="Inter_600SemiBold"
                >{name}</SvgText>
                <SvgText x={pt.x} y={pt.y - 29} fontSize={7} fill="#4A9FF5"
                  textAnchor="middle" fontFamily="Inter_400Regular"
                >▲ {elev}m gain</SvgText>
              </G>
            ) : (
              <G>
                <SvgText x={pt.x} y={pt.y + 41} fontSize={8} fill="#fff"
                  textAnchor="middle" fontFamily="Inter_600SemiBold"
                >{name}</SvgText>
                <SvgText x={pt.x} y={pt.y + 51} fontSize={7} fill="#4A9FF5"
                  textAnchor="middle" fontFamily="Inter_400Regular"
                >▲ {elev}m gain</SvgText>
              </G>
            )}
            {/* Stage circle */}
            <Circle
              cx={pt.x} cy={pt.y} r={11}
              fill={done ? "#4A9FF5" : "#1A2C42"}
              stroke={done ? "#4A9FF5" : "rgba(255,255,255,0.22)"}
              strokeWidth={2}
            />
            {done ? (
              <SvgText x={pt.x} y={pt.y + 4} fontSize={11} fill="#fff"
                textAnchor="middle" fontFamily="Inter_700Bold"
              >✓</SvgText>
            ) : (
              <SvgText x={pt.x} y={pt.y + 4} fontSize={9} fill="rgba(255,255,255,0.65)"
                textAnchor="middle" fontFamily="Inter_700Bold"
              >{i + 1}</SvgText>
            )}
          </G>
        );
      })}

      {/* Current progress callout + dot */}
      {clamped > 0 && clamped < maxE && (
        <G>
          {/* Vertical tick line */}
          {progCalloutAbove ? (
            <Line x1={progX} y1={progY - 12} x2={progX} y2={progY - 48}
              stroke="#4A9FF5" strokeWidth={1} strokeOpacity={0.45} />
          ) : (
            <Line x1={progX} y1={progY + 12} x2={progX} y2={progY + 44}
              stroke="#4A9FF5" strokeWidth={1} strokeOpacity={0.45} />
          )}
          {/* Callout box */}
          {progCalloutAbove ? (
            <G>
              <Rect x={progX - 27} y={progY - 68} width={54} height={32}
                rx={6} fill="#163352" stroke="#4A9FF5" strokeWidth={1.5} />
              <SvgText x={progX} y={progY - 52} fontSize={12} fill="#4A9FF5"
                textAnchor="middle" fontFamily="Inter_700Bold"
              >{fmtM(clamped)}m</SvgText>
              <SvgText x={progX} y={progY - 40} fontSize={8} fill="rgba(255,255,255,0.5)"
                textAnchor="middle" fontFamily="Inter_400Regular"
              >{pct}%</SvgText>
            </G>
          ) : (
            <G>
              <Rect x={progX - 27} y={progY + 46} width={54} height={32}
                rx={6} fill="#163352" stroke="#4A9FF5" strokeWidth={1.5} />
              <SvgText x={progX} y={progY + 62} fontSize={12} fill="#4A9FF5"
                textAnchor="middle" fontFamily="Inter_700Bold"
              >{fmtM(clamped)}m</SvgText>
              <SvgText x={progX} y={progY + 74} fontSize={8} fill="rgba(255,255,255,0.5)"
                textAnchor="middle" fontFamily="Inter_400Regular"
              >{pct}%</SvgText>
            </G>
          )}
          {/* White dot */}
          <Circle cx={progX} cy={progY} r={6}
            fill="#fff" stroke="#4A9FF5" strokeWidth={2.5} />
        </G>
      )}

      {/* Summit marker */}
      <G>
        <Circle cx={summitPt.x} cy={summitPt.y} r={12}
          fill="#fff" stroke="#fff" strokeWidth={1} />
        <SvgText x={summitPt.x} y={summitPt.y + 5} fontSize={11}
          fill="#0B1724" textAnchor="middle" fontFamily="Inter_700Bold"
        >▲</SvgText>
        {/* Right-side label — fits in right padding area */}
        <SvgText x={summitPt.x + 16} y={summitPt.y - 3} fontSize={10}
          fill="#fff" textAnchor="start" fontFamily="Inter_700Bold"
        >{fmtM(maxE)}m</SvgText>
        <SvgText x={summitPt.x + 16} y={summitPt.y + 9} fontSize={7.5}
          fill="rgba(255,255,255,0.45)" textAnchor="start" fontFamily="Inter_400Regular"
        >Simulated</SvgText>
        <SvgText x={summitPt.x + 16} y={summitPt.y + 19} fontSize={7.5}
          fill="rgba(255,255,255,0.45)" textAnchor="start" fontFamily="Inter_400Regular"
        >Summit</SvgText>
      </G>
    </Svg>
  );
}

// ── Stage status card ─────────────────────────────────────────────────────────

function StageCard({ stage, index, total, done, onPress }: {
  stage: NearbyHill; index: number; total: number; done: boolean; onPress?: () => void;
}) {
  const isNext = !done && index === total; // 1-based: index = count of completed
  return (
    <TouchableOpacity
      onPress={done ? undefined : onPress}
      disabled={done}
      activeOpacity={0.75}
      style={[
        sc.stageCard,
        done && sc.stageCardDone,
        isNext && sc.stageCardNext,
      ]}
    >
      {/* Number badge */}
      <View style={[sc.stageBadge, done && sc.stageBadgeDone]}>
        <Text style={[sc.stageBadgeText, done && { color: "#fff" }]}>
          {done ? "✓" : index + 1}
        </Text>
      </View>
      <Text style={sc.stageLabel}>STAGE {index + 1}</Text>
      <Text style={sc.stageName} numberOfLines={2}>{stage.name}</Text>
      <Text style={[sc.stageElev, done && { color: T.blue }]}>
        {Math.round(stage.elevation * stage.repeats)}m
      </Text>
      <View style={[
        sc.stageBadgePill,
        done ? sc.stageBadgePillDone : isNext ? sc.stageBadgePillNext : sc.stageBadgePillUpcoming,
      ]}>
        <Text style={[
          sc.stageBadgePillText,
          done ? { color: T.blue } : isNext ? { color: T.orange } : { color: "rgba(255,255,255,0.35)" },
        ]}>
          {done ? "COMPLETED" : isNext ? "NEXT UP" : "UPCOMING"}
        </Text>
      </View>
      {/* Tap-to-start indicator on available routes */}
      {!done && (
        <View style={sc.startRow}>
          <Play size={9} color={T.blue} fill={T.blue} />
          <Text style={sc.startText}>Tap to start</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Summary stat cell ─────────────────────────────────────────────────────────

function SummaryStat({
  icon, value, unit, label, sub, color = T.white,
}: {
  icon: React.ReactNode;
  value: string;
  unit?: string;
  label: string;
  sub?: string;
  color?: string;
}) {
  return (
    <View style={ss.statCell}>
      <View style={ss.statIcon}>{icon}</View>
      <Text style={ss.statLabel}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 1 }}>
        <Text style={[ss.statValue, { color }]}>{value}</Text>
        {!!unit && <Text style={ss.statUnit}>{unit}</Text>}
      </View>
      {!!sub && <Text style={ss.statSub}>{sub}</Text>}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ExpeditionProgressScreen() {
  useScreenView("expedition_progress");
  const insets = useSafeAreaInsets();
  const { summitGoal, sessions, activeExpedition } = useApp();

  const target  = summitGoal?.targetMountain;
  const stages  = summitGoal?.virtualHills ?? [];
  const completedRoutes: string[] = activeExpedition?.completedRoutes
    ?? summitGoal?.completedRoutes ?? [];

  // ── Derived ──────────────────────────────────────────────────────────────────
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

  const expName = (summitGoal as any)?.expeditionPlan?.title
    ?? target?.name ?? summitGoal?.mountainName ?? "Your Expedition";
  const daysText = target?.estimatedDays
    ? `${target.estimatedDays} Day${target.estimatedDays !== 1 ? "s" : ""} Expedition`
    : null;
  const regionText = summitGoal?.location ?? null;

  const sc_insight = insightMsg(completedCount, stages.length, remaining);

  const topInset = Platform.OS === "web" ? 20 : insets.top;

  // ── Empty state ─────────────────────────────────────────────────────────────
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

        {/* ── Elevation chart card ────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={s.chartCard}>
          <LinearGradient
            colors={["rgba(255,255,255,0.04)", "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          {/* Chart sub-header */}
          <View style={s.chartHeader}>
            <View>
              <Text style={s.chartHeaderLabel}>TOTAL ELEVATION TARGET</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                <Text style={{ fontSize: 13, color: T.blue }}>▲</Text>
                <Text style={s.chartHeaderValue}>{fmtM(totalElevGoal)}m</Text>
              </View>
              <Text style={s.chartHeaderSub}>Simulated elevation gain</Text>
            </View>
          </View>
          {/* SVG chart */}
          <ElevationLineChart
            stages={stages}
            completedRoutes={completedRoutes}
            totalElev={totalElevGoal}
            totalTrained={totalTrained}
          />
          {stages.length === 0 && (
            <View style={{ padding: 20, alignItems: "center" }}>
              <Text style={{ color: T.textMuted, fontSize: 13, fontFamily: "Inter_400Regular" }}>
                No route data yet — start an expedition to see your chart.
              </Text>
            </View>
          )}
        </Animated.View>

        {/* ── Stage cards ─────────────────────────────────────────────────────── */}
        {stages.length > 0 && (
          <Animated.View entering={FadeInDown.delay(160).duration(400)}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 4 }}
              style={{ marginBottom: 12 }}
            >
              {stages.map((st, i) => (
                <StageCard
                  key={st.name + i}
                  stage={st}
                  index={i}
                  total={completedCount}
                  done={completedRoutes.includes(st.name)}
                  onPress={() => router.push({
                    pathname: "/hike-tracking" as any,
                    params: { hillName: st.name },
                  })}
                />
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* ── Elevation summary ───────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(240).duration(400)} style={s.summaryCard}>
          <LinearGradient
            colors={["rgba(255,255,255,0.04)", "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          <Text style={s.summaryLabel}>ELEVATION SUMMARY</Text>
          <View style={ss.grid}>
            <SummaryStat
              icon={<Text style={{ fontSize: 18 }}>🏔️</Text>}
              value={fmtM(totalTrained)} unit="m"
              label="ELEVATION GAINED"
              sub={`${pct}% of ${fmtM(totalElevGoal)}m`}
              color={T.blue}
            />
            <SummaryStat
              icon={<Text style={{ fontSize: 18 }}>⛰️</Text>}
              value={fmtM(remaining)} unit="m"
              label="REMAINING"
              sub="To the summit"
              color={T.white}
            />
            <SummaryStat
              icon={<Text style={{ fontSize: 18 }}>📈</Text>}
              value={fmtM(totalTrained)} unit="m"
              label="HIGHEST POINT"
              sub="Current progress"
              color={T.green}
            />
            <SummaryStat
              icon={<Text style={{ fontSize: 18 }}>🚩</Text>}
              value={String(Math.max(0, stages.length - completedCount))}
              label="ROUTES LEFT"
              sub={`of ${stages.length} stage${stages.length !== 1 ? "s" : ""}`}
              color="#F5A623"
            />
          </View>
        </Animated.View>

        {/* ── Insight row ─────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(320).duration(400)}>
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
              <Text style={s.insightTitle}>{sc_insight.title}</Text>
              <Text style={s.insightBody}>{sc_insight.body}</Text>
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
  // Header
  header: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: CARD_MX, marginBottom: 14, gap: 12,
  },
  headerLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold",
    color: T.blue, letterSpacing: 1.4, marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22, fontFamily: "Inter_700Bold", color: T.white, lineHeight: 26,
  },
  headerSub: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: T.textMuted, marginTop: 4,
  },
  headerRight: { alignItems: "flex-end", minWidth: 100 },
  headerRightLabel: {
    fontSize: 9, fontFamily: "Inter_700Bold",
    color: T.textDim, letterSpacing: 1.2, marginBottom: 2,
  },
  headerPct: {
    fontSize: 36, fontFamily: "Inter_700Bold", lineHeight: 38,
  },
  headerRightSub: {
    fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2,
  },

  // Chart card
  chartCard: {
    marginHorizontal: CARD_MX, marginBottom: 12,
    borderRadius: 20, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  chartHeader: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  chartHeaderLabel: {
    fontSize: 9, fontFamily: "Inter_700Bold",
    color: T.textDim, letterSpacing: 1.2,
  },
  chartHeaderValue: {
    fontSize: 22, fontFamily: "Inter_700Bold", color: T.white,
  },
  chartHeaderSub: {
    fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1,
  },

  // Summary card
  summaryCard: {
    marginHorizontal: CARD_MX, marginBottom: 12,
    borderRadius: 20, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    padding: 16,
  },
  summaryLabel: {
    fontSize: 9, fontFamily: "Inter_700Bold",
    color: T.textDim, letterSpacing: 1.2, marginBottom: 14,
  },

  // Insight row
  insightRow: {
    marginHorizontal: CARD_MX, marginBottom: 8,
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
  insightTitle: {
    fontSize: 15, fontFamily: "Inter_700Bold", color: T.white, marginBottom: 3,
  },
  insightBody: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 17,
  },
});

// Stage card styles
const sc = StyleSheet.create({
  stageCard: {
    width: 130, padding: 12, borderRadius: 16, gap: 5,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  startRow: {
    flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2,
  },
  startText: {
    fontSize: 9, fontFamily: "Inter_500Medium", color: T.blue,
  },
  stageCardDone: {
    backgroundColor: "rgba(74,159,245,0.08)",
    borderColor: "rgba(74,159,245,0.22)",
  },
  stageCardNext: {
    borderColor: "rgba(251,146,60,0.3)",
    backgroundColor: "rgba(251,146,60,0.06)",
  },
  stageBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  stageBadgeDone: {
    backgroundColor: "#4A9FF5",
    borderColor: "#4A9FF5",
  },
  stageBadgeText: {
    fontSize: 11, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.6)",
  },
  stageLabel: {
    fontSize: 8, fontFamily: "Inter_700Bold",
    color: T.textDim, letterSpacing: 1,
  },
  stageName: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    color: T.white, lineHeight: 16,
  },
  stageElev: {
    fontSize: 12, fontFamily: "Inter_500Medium", color: T.textMuted,
  },
  stageBadgePill: {
    alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6, marginTop: 2,
  },
  stageBadgePillDone: { backgroundColor: "rgba(74,159,245,0.15)" },
  stageBadgePillNext: { backgroundColor: "rgba(251,146,60,0.15)" },
  stageBadgePillUpcoming: { backgroundColor: "rgba(255,255,255,0.06)" },
  stageBadgePillText: {
    fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.6,
  },
});

// Summary stat styles
const ss = StyleSheet.create({
  grid: {
    flexDirection: "row", flexWrap: "wrap", gap: 1,
  },
  statCell: {
    width: "50%", paddingVertical: 12, paddingHorizontal: 4, gap: 3,
  },
  statIcon: { marginBottom: 2 },
  statLabel: {
    fontSize: 8.5, fontFamily: "Inter_700Bold",
    color: T.textDim, letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 24, fontFamily: "Inter_700Bold", lineHeight: 28,
  },
  statUnit: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: T.textMuted, marginBottom: 2, lineHeight: 28,
  },
  statSub: {
    fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted,
  },
});
