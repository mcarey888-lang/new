import React, { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Polyline, Circle } from "react-native-svg";
import { BASECAMP } from "@/constants/tokens";
/** No CDN, tiles, credentials or browser needed to view the saved evidence. */
export function RecordedTracePreview({ points }: { points: Array<{ lat: number; lon: number }> }) {
  const projected = useMemo(() => {
    const all = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    const stride=Math.max(1,Math.ceil(all.length/4000));
    const valid=all.filter((_,i)=>i%stride===0||i===all.length-1);
    if (!valid.length) return [];
    const mid = valid.reduce((s,p) => s+p.lat,0)/valid.length;
    const coords = valid.map(p => ({ x: p.lon*Math.cos(mid*Math.PI/180), y: -p.lat }));
    const minX=Math.min(...coords.map(p=>p.x)), maxX=Math.max(...coords.map(p=>p.x));
    const minY=Math.min(...coords.map(p=>p.y)), maxY=Math.max(...coords.map(p=>p.y));
    const scale=Math.min(260/Math.max(maxX-minX,0.00001),180/Math.max(maxY-minY,0.00001));
    return coords.map(p=>({x:20+(p.x-minX)*scale,y:20+(p.y-minY)*scale}));
  }, [points]);
  return <View style={{ backgroundColor: BASECAMP.ink, padding: 8 }} accessibilityLabel="Recorded GPS trace, available offline">
    <Svg width="100%" height={230} viewBox="0 0 300 230">
      <Polyline points={projected.map(p=>`${p.x},${p.y}`).join(" ")} stroke={BASECAMP.accent} strokeWidth={3} fill="none" />
      {projected.length>0 ? <><Circle cx={projected[0].x} cy={projected[0].y} r={5} fill={BASECAMP.accent} />
        <Circle cx={projected[projected.length-1].x} cy={projected[projected.length-1].y} r={5} fill="#ff6666" /></> : null}
    </Svg>
    <Text style={{ color: BASECAMP.textMuted }}>Recorded trace · green start, red finish. Offline overview, not a navigation map.</Text>
  </View>;
}
