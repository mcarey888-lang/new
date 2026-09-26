/**
 * The four stat icons on the Elevation Bank card.
 *
 * Drawn rather than taken from the icon set, because the approved mockup uses
 * four marks the set does not contain: a hiker carrying a pack and a pole, a
 * filled twin peak with a snow cap, a flag with a dot finial, and a clock.
 * Substituting the nearest available glyph — footprints for a hiker, an
 * outline mountain for a filled one, an arrow for a clock — changed what each
 * stat appeared to mean, which is why these are drawn to the mockup instead.
 *
 * Each is a 24×24 viewBox so it drops into the same slot as any icon from the
 * set, and each takes `size` and `color` for the same reason.
 *
 * The hiker and the flag are built from round-capped strokes rather than one
 * filled outline: at 20pt a stroked figure reads as solid, and a stroke stays
 * legible when the icon is scaled down, where a hand-fitted fill would not.
 */

import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

export interface BankIconProps {
  size?: number;
  color?: string;
  /** The snow cap and the secondary peak. Defaults derive from `color`. */
  accent?: string;
}

const DEFAULT_SIZE = 20;

/** Hikes — a walker with a pack and a pole, mid-stride, facing right. */
export function HikerIcon({ size = DEFAULT_SIZE, color = "#167DF7" }: BankIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* head */}
      <Circle cx={13.1} cy={3.4} r={2.2} fill={color} />
      {/* pack, clear of the torso so both shapes stay legible */}
      <Path
        d="M6.4 6.6h2.1a1.6 1.6 0 0 1 1.6 1.6v3.5a1.6 1.6 0 0 1-1.6 1.6H6.4a1.6 1.6 0 0 1-1.6-1.6V8.2a1.6 1.6 0 0 1 1.6-1.6Z"
        fill={color}
      />
      {/* torso, leaning into the slope */}
      <Path d="M12.8 6.4 10.9 13.2" stroke={color} strokeWidth={2.9} strokeLinecap="round" />
      {/* leading arm, down to the grip */}
      <Path d="M12.5 8 16.2 10.6" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      {/* forward leg, then the trailing leg pushing off */}
      <Path
        d="M11 13 13.4 16.7 12.9 21"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M11 13.2 7.9 16.4 6.4 20.9"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* the pole, planted well ahead of the stride */}
      <Path d="M16.8 9.6 18.6 21.2" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

/** Mountains — a filled summit with a snow cap and a lower peak in front. */
export function SummitIcon({ size = DEFAULT_SIZE, color = "#167DF7", accent }: BankIconProps) {
  /* The snow cap is the one light element; everything else is the accent. */
  const snow = accent ?? "#DCEBFB";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* main summit */}
      <Path d="M14.2 3 23 20.2H5.4L14.2 3Z" fill={color} />
      {/* snow cap, on the sunlit flank */}
      <Path d="M14.2 3 18.4 11.2 16.3 9.9 14.7 11.8 12.7 8.2 14.2 3Z" fill={snow} />
      {/* the lower peak, overlapping in front */}
      <Path d="M7.6 9.2 14.4 20.2H0.8L7.6 9.2Z" fill={color} opacity={0.88} />
    </Svg>
  );
}

/** Expeditions — a pennant on a pole, with a dot at the finial and the foot. */
export function ExpeditionFlagIcon({ size = DEFAULT_SIZE, color = "#167DF7" }: BankIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={5.8} cy={2.9} r={1.45} fill={color} />
      <Circle cx={5.8} cy={21} r={1.45} fill={color} />
      <Path d="M5.8 3.5V20.4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path
        d="M5.8 4.9c4.4-2 8.8 1.9 13.2 0v8c-4.4 1.9-8.8-2-13.2 0V4.9Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Moving Time — a clock. The mockup's mark, and what the stat is actually about. */
export function MovingTimeIcon({ size = DEFAULT_SIZE, color = "#167DF7" }: BankIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} />
      <Path
        d="M12 6.6V12l4 2.1"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
