/**
 * The small altitude line in the recording sheet.
 *
 * A sparkline, deliberately: no axes, no gridlines, no numbers on it. The
 * figures that matter while you are walking are the ones printed beside it,
 * which come from the recorder. This only shows the shape of the ground so
 * far — whether you are still climbing, and roughly how much of the day has
 * been up.
 *
 * It renders nothing at all until there are enough readings to draw a shape,
 * so the sheet stays short at the start of a walk instead of showing an empty
 * box. See `buildRecordingProfile` for what "enough" means and why flat ground
 * is drawn flat.
 */
import React from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { BASECAMP } from "@/constants/tokens";
import {
  buildRecordingProfile,
  profileAreaPath,
  profileLabel,
  profileLinePath,
  type ProfileSample,
} from "@/utils/elevationProfile";

const BOX = { width: 320, height: 40 };

/** Keeps the stroke and the "you are here" dot off the edges of the box. The
 *  dot sits at the far right of the line, so this has to clear its radius and
 *  its stroke or the newest reading is drawn half clipped. */
const PAD = 5;

export interface RecordingElevationSparkProps {
  samples: readonly ProfileSample[];
  /** Dimmed while paused, so a stopped recording looks stopped. */
  paused?: boolean;
  testID?: string;
}

export function RecordingElevationSpark({
  samples, paused = false, testID,
}: RecordingElevationSparkProps) {
  const profile = buildRecordingProfile(samples);
  if (!profile) return null;

  const innerW = BOX.width - PAD * 2;
  const innerH = BOX.height - PAD * 2;

  const line = profileLinePath(profile.points, innerW, innerH);
  const area = profileAreaPath(profile.points, innerW, innerH);
  const head = profile.points[profile.points.length - 1];
  const stroke = paused ? "rgba(255,255,255,0.40)" : BASECAMP.accent;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={profileLabel(profile)}
      testID={testID}
    >
      <Svg
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        width="100%"
        height={BOX.height}
      >
        <Defs>
          <LinearGradient id="srTrackSpark" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={stroke} stopOpacity={paused ? "0.14" : "0.30"} />
            <Stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#srTrackSpark)" transform={`translate(${PAD} ${PAD})`} />
        <Path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          transform={`translate(${PAD} ${PAD})`}
        />
        {/* Where the last reading put you, so the line has a near end. */}
        <Circle
          cx={PAD + head.x * innerW}
          cy={PAD + head.y * innerH}
          r={3}
          fill={BASECAMP.ink}
          stroke={stroke}
          strokeWidth={2}
        />
      </Svg>
    </View>
  );
}
