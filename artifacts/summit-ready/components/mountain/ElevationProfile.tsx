/**
 * A route's elevation profile: ALTITUDE against distance.
 *
 * The curve is altitude above sea level. Its high point is an altitude. The
 * route's TOTAL ASCENT — how much you climb — is a different number, shown
 * beside the chart and never read off this curve, because a route that drops
 * and re-climbs accumulates ascent the peak of the curve cannot show.
 *
 * It draws only samples the engine recorded. A sample with no elevation was
 * already dropped upstream rather than interpolated, so a gap in the source
 * data appears as a straight run between the readings either side of it and
 * never as invented terrain.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import { BASECAMP, EXPLORE } from "@/constants/tokens";
import { SREmptyState } from "@/components/ui";
import type { ElevationProfilePoint } from "@/utils/mountainDetailPresentation";

const GEO = { width: 362, height: 168, padLeft: 38, padRight: 14, padTop: 18, padBottom: 24 };

/** Axis ticks that end on a round number at or above the highest sample. */
export function axisTicks(maxElevationM: number): number[] {
  const step = maxElevationM > 2000 ? 500 : maxElevationM > 800 ? 250 : 100;
  const top = Math.max(step, Math.ceil(maxElevationM / step) * step);
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return ticks;
}

export function ElevationProfile({
  points, routeName,
}: { points: readonly ElevationProfilePoint[] | null; routeName: string }) {
  if (!points || points.length < 2) {
    return (
      <SREmptyState
        compact
        testID="route-profile-empty"
        title="No elevation profile yet"
        body="SummitReady draws a profile once the engine holds elevation readings along this route."
      />
    );
  }

  const elevations = points.map(p => p.elevationM);
  const high = Math.max(...elevations);
  const low = Math.min(...elevations);
  const ticks = axisTicks(high);
  const top = ticks[ticks.length - 1];
  const totalM = points[points.length - 1].distanceM - points[0].distanceM;

  const innerW = GEO.width - GEO.padLeft - GEO.padRight;
  const innerH = GEO.height - GEO.padTop - GEO.padBottom;
  const x = (distanceM: number) =>
    GEO.padLeft + (totalM <= 0 ? 0 : ((distanceM - points[0].distanceM) / totalM) * innerW);
  const y = (elevationM: number) => GEO.padTop + innerH * (1 - elevationM / top);

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.distanceM).toFixed(1)} ${y(p.elevationM).toFixed(1)}`)
    .join(" ");
  const baseline = (GEO.height - GEO.padBottom).toFixed(1);
  const area = `${line} L${x(points[points.length - 1].distanceM).toFixed(1)} ${baseline} `
    + `L${x(points[0].distanceM).toFixed(1)} ${baseline} Z`;

  const highPoint = points[elevations.indexOf(high)];
  const km = (m: number) => (m / 1000);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        `Altitude along ${routeName}. Lowest ${Math.round(low)} metres, `
        + `highest ${Math.round(high)} metres, over ${km(totalM).toFixed(1)} kilometres.`
      }
    >
      <Svg viewBox={`0 0 ${GEO.width} ${GEO.height}`} width="100%" height={GEO.height}>
        <Defs>
          <LinearGradient id="srProfileFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={EXPLORE.accent} stopOpacity="0.5" />
            <Stop offset="100%" stopColor={EXPLORE.accent} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {ticks.map(v => (
          <G key={v}>
            <Line
              x1={GEO.padLeft} y1={y(v)} x2={GEO.width - GEO.padRight} y2={y(v)}
              stroke="rgba(255,255,255,0.09)" strokeWidth={1}
            />
            <SvgText
              x={GEO.padLeft - 6} y={y(v) + 3.4}
              textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.42)"
            >
              {v === 0 ? "0 m" : String(v)}
            </SvgText>
          </G>
        ))}

        <Path d={area} fill="url(#srProfileFill)" />
        <Path
          d={line} fill="none" stroke={EXPLORE.accent} strokeWidth={2.4}
          strokeLinecap="round" strokeLinejoin="round"
        />
        <SvgText
          x={x(highPoint.distanceM)} y={Math.max(10, y(high) - 8)}
          textAnchor="middle" fontSize={10} fontWeight="700" fill={BASECAMP.text}
        >
          {`${Math.round(high).toLocaleString()} m`}
        </SvgText>

        {[0, 0.5, 1].map(f => {
          const d = points[0].distanceM + totalM * f;
          return (
            <SvgText
              key={f} x={x(d)} y={GEO.height - 6}
              textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"}
              fontSize={9} fill="rgba(255,255,255,0.42)"
            >
              {f === 1 ? `${km(d).toFixed(1)} km` : km(d).toFixed(f === 0 ? 0 : 1)}
            </SvgText>
          );
        })}
      </Svg>
      <Text style={styles.caption}>
        Altitude along the route. Total ascent is listed separately — it is not the high point.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: {
    marginTop: 2, fontSize: 10, lineHeight: 14,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },
});
