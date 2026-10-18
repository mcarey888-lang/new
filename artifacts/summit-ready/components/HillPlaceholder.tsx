/**
 * The drawn stand-in for a hill with no photograph of its own.
 *
 * Deliberately flat and stylised — see `hillPlaceholder` for why it must not
 * look like a profile of the actual hill. It draws entirely on the device, so
 * a list of twenty obscure tops costs nothing to render and works with no
 * signal at all, which the satellite thumbnails it replaces did not.
 *
 * Callers that have room should also say the image is illustrative, the way
 * the nearby-hills list already does. The accessibility label says so here in
 * every case, because a screen reader user has no other way to tell.
 */
import React from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import {
  hillPlaceholderArt,
  placeholderLabel,
  ridgePath,
} from "@/utils/hillPlaceholder";

const BOX = { width: 220, height: 200 };

export interface HillPlaceholderProps {
  name: string;
  /** The recorded summit height. Omitted or null draws the lowest band. */
  elevationM?: number | null;
  testID?: string;
}

export function HillPlaceholder({ name, elevationM, testID }: HillPlaceholderProps) {
  const art = hillPlaceholderArt(name, elevationM);
  const { band } = art;
  const near = ridgePath(art.ridge, BOX.width, BOX.height);
  const far = ridgePath(art.farRidge, BOX.width, BOX.height);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={placeholderLabel(name, elevationM)}
      testID={testID}
      style={{ flex: 1 }}
    >
      <Svg
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id="srHillSky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={band.sky[0]} />
            <Stop offset="100%" stopColor={band.sky[1]} />
          </LinearGradient>
          {band.cap ? (
            /* Pale at the top of the box and gone by not quite halfway down,
               so it sits on the tops rather than washing the whole hillside.
               Drawn over the ridge path itself, so it can only ever appear
               where there is ground to appear on. */
            <LinearGradient id="srHillCap" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={band.cap} stopOpacity="0.5" />
              <Stop offset="45%" stopColor={band.cap} stopOpacity="0" />
            </LinearGradient>
          ) : null}
        </Defs>

        <Rect x="0" y="0" width={BOX.width} height={BOX.height} fill="url(#srHillSky)" />
        <Path d={far} fill={band.farRidge} />
        <Path d={near} fill={band.ridge} />
        {band.cap ? <Path d={near} fill="url(#srHillCap)" /> : null}
      </Svg>
    </View>
  );
}
