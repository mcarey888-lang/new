/**
 * ExpeditionProgressCard — shared component.
 * Renders the SVG elevation line chart, tappable stage cards,
 * and 4-stat elevation summary.
 * Used on both the Progress tab and Base Camp home.
 */

import { Play } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Dimensions, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import Svg, {
  Path, Circle, Rect, Line,
  Text as SvgText,
  Defs, LinearGradient as SvgGrad, Stop, G,
} from "react-native-svg";

import { T } from "@/constants/theme";
import type { NearbyHill } from "@/context/AppContext";

// ── Layout constants ──────────────────────────────────────────────────────────

const SCREEN_W = Math.min(Dimensions.get("window").width, 430);
const CARD_MX  = 16;
const CARD_W   = SCREEN_W - CARD_MX * 2;
const CHART_H  = 216;
/** Padding inside the SVG plot area */
const P = { top: 62, right: 72, bottom: 10, left: 46 };
const PW = CARD_W - P.left - P.right;
const PH = CHART_H - P.top - P.bottom;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function fmtM(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}k` : `${Math.round(m)}`;
}
function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ── SVG elevation line chart ──────────────────────────────────────────────────

interface ChartProps {
  stages:          NearbyHill[];
  completedRoutes: string[];
  totalElev:       number;
  totalTrained:    number;
}

function ElevationLineChart({ stages, completedRoutes, totalElev, totalTrained }: ChartProps) {
  const n = stages.length;
  if (n === 0 || totalElev === 0) return null;

  const cum: number[] = [0];
  for (const st of stages) {
    cum.push(cum[cum.length - 1] + st.elevation * st.repeats);
  }
  const maxE = Math.max(totalElev, cum[n]);

  const toX = (i: number) => P.left + (i / n) * PW;
  const toY = (e: number) => P.top + PH - (Math.min(e, maxE) / maxE) * PH;

  const pts = cum.map((e, i) => ({ x: toX(i), y: toY(e), e }));

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fillPath = linePath + ` L${pts[n].x.toFixed(1)},${toY(0).toFixed(1)} L${pts[0].x.toFixed(1)},${toY(0).toFixed(1)} Z`;

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

  const afterPts = pts.filter((_, i) => i > 0 && cum[i] > clamped);
  const dashPath = afterPts.length > 0
    ? `M${progX.toFixed(1)},${progY.toFixed(1)} ` + afterPts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
    : null;

  const yTicks = [0, Math.round(maxE * 0.34), Math.round(maxE * 0.68), maxE];

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
  const progCalloutAbove = progY > P.top + PH * 0.45;

  return (
    <Svg width={CARD_W} height={CHART_H}>
      <Defs>
        <SvgGrad id="epc_lineFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0"   stopColor="#4A9FF5" stopOpacity="0.38" />
          <Stop offset="0.6" stopColor="#4A9FF5" stopOpacity="0.08" />
          <Stop offset="1"   stopColor="#4A9FF5" stopOpacity="0.00" />
        </SvgGrad>
        <SvgGrad id="epc_mtnBg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1E3048" stopOpacity="0.9" />
          <Stop offset="1" stopColor="#0B1724" stopOpacity="0.5" />
        </SvgGrad>
      </Defs>

      {/* Mountain silhouette */}
      <Path d={mtn} fill="url(#epc_mtnBg)" />

      {/* Y-axis grid + labels */}
      {yTicks.map((e, i) => {
        const y = toY(e);
        return (
          <G key={i}>
            <Line x1={P.left} y1={y} x2={P.left + PW} y2={y}
              stroke="rgba(255,255,255,0.07)" strokeWidth={1}
              strokeDasharray={e === 0 ? undefined : "4,5"}
            />
            <SvgText x={P.left - 5} y={y + 3.5}
              fontSize={9} fill="rgba(255,255,255,0.32)"
              textAnchor="end" fontFamily="Inter_400Regular"
            >{fmtM(e)}m</SvgText>
          </G>
        );
      })}

      <Path d={fillPath} fill="url(#epc_lineFill)" />
      <Path d={linePath} stroke="#4A9FF5" strokeWidth={2.5}
        fill="none" strokeLinejoin="round" strokeLinecap="round" />

      {dashPath && (
        <Path d={dashPath}
          stroke="rgba(255,255,255,0.28)" strokeWidth={2}
          fill="none" strokeDasharray="5,4" strokeLinecap="round" />
      )}

      {/* Stage markers + callouts */}
      {stages.map((st, i) => {
        const pt   = pts[i + 1];
        const done = completedRoutes.includes(st.name);
        const above = pt.y >= P.top + PH * 0.48;
        const elev  = Math.round(st.elevation * st.repeats);
        const name  = clip(st.name, 15);
        return (
          <G key={st.name}>
            {above ? (
              <Line x1={pt.x} y1={pt.y - 12} x2={pt.x} y2={pt.y - 34}
                stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
            ) : (
              <Line x1={pt.x} y1={pt.y + 12} x2={pt.x} y2={pt.y + 30}
                stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
            )}
            {above ? (
              <G>
                <SvgText x={pt.x} y={pt.y - 38} fontSize={8} fill="#fff"
                  textAnchor="middle" fontFamily="Inter_600SemiBold">{name}</SvgText>
                <SvgText x={pt.x} y={pt.y - 29} fontSize={7} fill="#4A9FF5"
                  textAnchor="middle" fontFamily="Inter_400Regular">▲ {elev}m gain</SvgText>
              </G>
            ) : (
              <G>
                <SvgText x={pt.x} y={pt.y + 41} fontSize={8} fill="#fff"
                  textAnchor="middle" fontFamily="Inter_600SemiBold">{name}</SvgText>
                <SvgText x={pt.x} y={pt.y + 51} fontSize={7} fill="#4A9FF5"
                  textAnchor="middle" fontFamily="Inter_400Regular">▲ {elev}m gain</SvgText>
              </G>
            )}
            <Circle cx={pt.x} cy={pt.y} r={11}
              fill={done ? "#4A9FF5" : "#1A2C42"}
              stroke={done ? "#4A9FF5" : "rgba(255,255,255,0.22)"}
              strokeWidth={2}
            />
            {done ? (
              <SvgText x={pt.x} y={pt.y + 4} fontSize={11} fill="#fff"
                textAnchor="middle" fontFamily="Inter_700Bold">✓</SvgText>
            ) : (
              <SvgText x={pt.x} y={pt.y + 4} fontSize={9} fill="rgba(255,255,255,0.65)"
                textAnchor="middle" fontFamily="Inter_700Bold">{i + 1}</SvgText>
            )}
          </G>
        );
      })}

      {/* Current progress callout + dot */}
      {clamped > 0 && clamped < maxE && (
        <G>
          {progCalloutAbove ? (
            <Line x1={progX} y1={progY - 12} x2={progX} y2={progY - 48}
              stroke="#4A9FF5" strokeWidth={1} strokeOpacity={0.45} />
          ) : (
            <Line x1={progX} y1={progY + 12} x2={progX} y2={progY + 44}
              stroke="#4A9FF5" strokeWidth={1} strokeOpacity={0.45} />
          )}
          {progCalloutAbove ? (
            <G>
              <Rect x={progX - 27} y={progY - 68} width={54} height={32}
                rx={6} fill="#163352" stroke="#4A9FF5" strokeWidth={1.5} />
              <SvgText x={progX} y={progY - 52} fontSize={12} fill="#4A9FF5"
                textAnchor="middle" fontFamily="Inter_700Bold">{fmtM(clamped)}m</SvgText>
              <SvgText x={progX} y={progY - 40} fontSize={8} fill="rgba(255,255,255,0.5)"
                textAnchor="middle" fontFamily="Inter_400Regular">{pct}%</SvgText>
            </G>
          ) : (
            <G>
              <Rect x={progX - 27} y={progY + 46} width={54} height={32}
                rx={6} fill="#163352" stroke="#4A9FF5" strokeWidth={1.5} />
              <SvgText x={progX} y={progY + 62} fontSize={12} fill="#4A9FF5"
                textAnchor="middle" fontFamily="Inter_700Bold">{fmtM(clamped)}m</SvgText>
              <SvgText x={progX} y={progY + 74} fontSize={8} fill="rgba(255,255,255,0.5)"
                textAnchor="middle" fontFamily="Inter_400Regular">{pct}%</SvgText>
            </G>
          )}
          <Circle cx={progX} cy={progY} r={6}
            fill="#fff" stroke="#4A9FF5" strokeWidth={2.5} />
        </G>
      )}

      {/* Summit marker */}
      <G>
        <Circle cx={summitPt.x} cy={summitPt.y} r={12}
          fill="#fff" stroke="#fff" strokeWidth={1} />
        <SvgText x={summitPt.x} y={summitPt.y + 5} fontSize={11}
          fill="#0B1724" textAnchor="middle" fontFamily="Inter_700Bold">▲</SvgText>
        <SvgText x={summitPt.x + 16} y={summitPt.y - 3} fontSize={10}
          fill="#fff" textAnchor="start" fontFamily="Inter_700Bold">{fmtM(maxE)}m</SvgText>
        <SvgText x={summitPt.x + 16} y={summitPt.y + 9} fontSize={7.5}
          fill="rgba(255,255,255,0.45)" textAnchor="start" fontFamily="Inter_400Regular">Simulated</SvgText>
        <SvgText x={summitPt.x + 16} y={summitPt.y + 19} fontSize={7.5}
          fill="rgba(255,255,255,0.45)" textAnchor="start" fontFamily="Inter_400Regular">Summit</SvgText>
      </G>
    </Svg>
  );
}

// ── Stage card ────────────────────────────────────────────────────────────────

function StageCard({ stage, index, completedCount, done, onPress }: {
  stage: NearbyHill;
  index: number;
  completedCount: number;
  done: boolean;
  onPress?: () => void;
}) {
  const isNext = !done && index === completedCount;
  return (
    <TouchableOpacity
      onPress={done ? undefined : onPress}
      disabled={done}
      activeOpacity={0.75}
      style={[
        sc.card,
        done  && sc.cardDone,
        isNext && sc.cardNext,
      ]}
    >
      <View style={[sc.badge, done && sc.badgeDone]}>
        <Text style={[sc.badgeText, done && { color: "#fff" }]}>
          {done ? "✓" : index + 1}
        </Text>
      </View>
      <Text style={sc.label}>STAGE {index + 1}</Text>
      <Text style={sc.name} numberOfLines={2}>{stage.name}</Text>
      <Text style={[sc.elev, done && { color: T.blue }]}>
        {Math.round(stage.elevation * stage.repeats)}m
      </Text>
      <View style={[sc.pill, done ? sc.pillDone : isNext ? sc.pillNext : sc.pillUpcoming]}>
        <Text style={[sc.pillText,
          done ? { color: T.blue } : isNext ? { color: T.orange } : { color: "rgba(255,255,255,0.35)" }
        ]}>
          {done ? "COMPLETED" : isNext ? "NEXT UP" : "AVAILABLE"}
        </Text>
      </View>
      {!done && (
        <View style={sc.startRow}>
          <Play size={9} color={T.blue} fill={T.blue} />
          <Text style={sc.startText}>Tap to start</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Summary stat ──────────────────────────────────────────────────────────────

function SummaryStat({ icon, value, unit, label, sub, color = T.white }: {
  icon: string; value: string; unit?: string;
  label: string; sub?: string; color?: string;
}) {
  return (
    <View style={ss.cell}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text style={ss.label}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 1 }}>
        <Text style={[ss.value, { color }]}>{value}</Text>
        {!!unit && <Text style={ss.unit}>{unit}</Text>}
      </View>
      {!!sub && <Text style={ss.sub}>{sub}</Text>}
    </View>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export interface ExpeditionProgressCardProps {
  /** NearbyHill[] — the ordered route list from summitGoal.virtualHills */
  stages:          NearbyHill[];
  /** Names of routes already marked complete */
  completedRoutes: string[];
  /** Total elevation target in metres */
  totalElev:       number;
  /** Cumulative elevation trained so far */
  totalTrained:    number;
  /** Called when the user taps a stage card — pass the hill name */
  onStagePress?:   (hillName: string) => void;
}

export function ExpeditionProgressCard({
  stages, completedRoutes, totalElev, totalTrained, onStagePress,
}: ExpeditionProgressCardProps) {
  const completedCount = completedRoutes.filter(r => stages.some(s => s.name === r)).length;
  const remaining      = Math.max(0, totalElev - totalTrained);
  const pct            = totalElev > 0 ? Math.min(100, Math.round(totalTrained / totalElev * 100)) : 0;

  return (
    <View style={{ gap: 0 }}>

      {/* ── Elevation chart card ──────────────────────────────────────────── */}
      <View style={ch.card}>
        <LinearGradient
          colors={["rgba(255,255,255,0.04)", "transparent"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={ch.header}>
          <Text style={ch.headerLabel}>TOTAL ELEVATION TARGET</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
            <Text style={{ fontSize: 13, color: T.blue }}>▲</Text>
            <Text style={ch.headerValue}>{fmtM(totalElev)}m</Text>
          </View>
          <Text style={ch.headerSub}>Simulated elevation gain</Text>
        </View>
        <ElevationLineChart
          stages={stages}
          completedRoutes={completedRoutes}
          totalElev={totalElev}
          totalTrained={totalTrained}
        />
        {stages.length === 0 && (
          <View style={{ padding: 20, alignItems: "center" }}>
            <Text style={{ color: T.textMuted, fontSize: 13, fontFamily: "Inter_400Regular" }}>
              No route data yet — start an expedition to see your chart.
            </Text>
          </View>
        )}
      </View>

      {/* ── Stage cards (horizontal scroll) ──────────────────────────────── */}
      {stages.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: CARD_MX, gap: 10, paddingVertical: 12 }}
        >
          {stages.map((st, i) => (
            <StageCard
              key={st.name + i}
              stage={st}
              index={i}
              completedCount={completedCount}
              done={completedRoutes.includes(st.name)}
              onPress={() => onStagePress?.(st.name)}
            />
          ))}
        </ScrollView>
      )}

      {/* ── Elevation summary ─────────────────────────────────────────────── */}
      <View style={ch.summaryCard}>
        <LinearGradient
          colors={["rgba(255,255,255,0.04)", "transparent"]}
          style={StyleSheet.absoluteFill}
        />
        <Text style={ch.summaryLabel}>ELEVATION SUMMARY</Text>
        <View style={ss.grid}>
          <SummaryStat icon="🏔️" value={fmtM(totalTrained)} unit="m"
            label="ELEVATION GAINED" sub={`${pct}% of ${fmtM(totalElev)}m`} color={T.blue} />
          <SummaryStat icon="⛰️" value={fmtM(remaining)} unit="m"
            label="REMAINING" sub="To the summit" />
          <SummaryStat icon="📈" value={fmtM(totalTrained)} unit="m"
            label="HIGHEST POINT" sub="Current progress" color={T.green} />
          <SummaryStat icon="🚩"
            value={String(Math.max(0, stages.length - completedCount))}
            label="ROUTES LEFT" sub={`of ${stages.length} stage${stages.length !== 1 ? "s" : ""}`}
            color="#F5A623" />
        </View>
      </View>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const ch = StyleSheet.create({
  card: {
    marginHorizontal: CARD_MX,
    borderRadius: 20, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  headerLabel: {
    fontSize: 9, fontFamily: "Inter_700Bold",
    color: T.textDim, letterSpacing: 1.2,
  },
  headerValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.white },
  headerSub:   { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 1 },

  summaryCard: {
    marginHorizontal: CARD_MX, marginTop: 0,
    borderRadius: 20, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    padding: 16,
  },
  summaryLabel: {
    fontSize: 9, fontFamily: "Inter_700Bold",
    color: T.textDim, letterSpacing: 1.2, marginBottom: 14,
  },
});

const sc = StyleSheet.create({
  card: {
    width: 130, padding: 12, borderRadius: 16, gap: 5,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  cardDone: {
    backgroundColor: "rgba(74,159,245,0.08)",
    borderColor: "rgba(74,159,245,0.22)",
  },
  cardNext: {
    borderColor: "rgba(251,146,60,0.3)",
    backgroundColor: "rgba(251,146,60,0.06)",
  },
  badge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  badgeDone: { backgroundColor: "#4A9FF5", borderColor: "#4A9FF5" },
  badgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.6)" },
  label:     { fontSize: 8, fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 1 },
  name:      { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.white, lineHeight: 16 },
  elev:      { fontSize: 12, fontFamily: "Inter_500Medium", color: T.textMuted },
  pill: {
    alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6, marginTop: 2,
  },
  pillDone:     { backgroundColor: "rgba(74,159,245,0.15)" },
  pillNext:     { backgroundColor: "rgba(251,146,60,0.15)" },
  pillUpcoming: { backgroundColor: "rgba(255,255,255,0.06)" },
  pillText:     { fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  startRow:  { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  startText: { fontSize: 9, fontFamily: "Inter_500Medium", color: T.blue },
});

const ss = StyleSheet.create({
  grid:  { flexDirection: "row", flexWrap: "wrap", gap: 1 },
  cell:  { width: "50%", paddingVertical: 12, paddingHorizontal: 4, gap: 3 },
  label: { fontSize: 8.5, fontFamily: "Inter_700Bold", color: T.textDim, letterSpacing: 0.8 },
  value: { fontSize: 24, fontFamily: "Inter_700Bold", lineHeight: 28 },
  unit:  { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, marginBottom: 2, lineHeight: 28 },
  sub:   { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
});
