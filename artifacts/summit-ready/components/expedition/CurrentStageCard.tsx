/**
 * The current stage — the one thing Basecamp wants you to do next.
 *
 * The stage is a real hill and a real route, with its own identity, and the
 * card shows the figures the expedition actually recorded for it. Nothing is
 * estimated to fill the card out: a stage with no recorded gain simply has
 * no gain line.
 *
 * Start Stage hands the existing launch context to the existing Track
 * journey. This card builds no activity and creates no identity.
 */
import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Footprints, Play, TrendingUp, Trophy } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BASECAMP, EXPLORE, HIT, SP, TYPE } from "@/constants/tokens";
import { SRPanel } from "@/components/ui";
import { metres } from "./parts";

export function CurrentStageCard({
  eyebrow, name, routeName, gainM, imageUri, complete,
  primaryLabel, onPrimary, onFreeHike,
}: {
  eyebrow: string;
  name: string;
  routeName?: string | null;
  gainM?: number | null;
  imageUri?: string | null;
  complete: boolean;
  primaryLabel: string;
  onPrimary?: () => void;
  onFreeHike?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const gain = metres(gainM);

  return (
    <SRPanel radius={18} style={styles.panel}>
      <View style={styles.body}>
        <View style={styles.row}>
          <View style={styles.thumb}>
            {imageUri && !failed ? (
              <Image
                source={{ uri: imageUri }}
                style={StyleSheet.absoluteFill}
                onError={() => setFailed(true)}
                accessible={false}
              />
            ) : (
              <LinearGradient colors={["#1B2C2A", "#0D1A1D"]} style={StyleSheet.absoluteFill} />
            )}
          </View>
          <View style={styles.text}>
            <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text>
            <Text style={styles.name} numberOfLines={3}>
              {name}
              {routeName ? <Text style={styles.route}>{`  ·  ${routeName}`}</Text> : null}
            </Text>
            {gain ? (
              <View style={styles.fact}>
                <TrendingUp size={13} color={EXPLORE.accent} />
                <Text style={styles.factText} numberOfLines={1}>{`${gain} elevation gain`}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Pressable
          onPress={onPrimary}
          disabled={!onPrimary}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
          accessibilityState={{ disabled: !onPrimary }}
          hitSlop={HIT.slop}
          style={[styles.primary, !onPrimary && styles.disabled]}
        >
          {complete
            ? <Trophy size={14} color={EXPLORE.accentInk} />
            : <Play size={13} color={EXPLORE.accentInk} fill={EXPLORE.accentInk} />}
          <Text style={styles.primaryText} numberOfLines={1}>{primaryLabel}</Text>
        </Pressable>

        {onFreeHike ? (
          <Pressable
            onPress={onFreeHike}
            accessibilityRole="button"
            accessibilityLabel="Record free hike"
            accessibilityHint="Records an activity that is not one of this expedition's stages"
            hitSlop={HIT.slop}
            style={styles.secondary}
            testID="free-hike-base-camp-cta"
          >
            <Footprints size={14} color={BASECAMP.textMuted} />
            <Text style={styles.secondaryText} numberOfLines={1}>Record free hike</Text>
          </Pressable>
        ) : null}
      </View>
    </SRPanel>
  );
}

const styles = StyleSheet.create({
  panel: { marginHorizontal: BASECAMP.gutter },
  body: { padding: 13 },
  row: { flexDirection: "row", gap: 12 },
  thumb: {
    width: 78, height: 78, borderRadius: 13, overflow: "hidden",
    backgroundColor: "#12202A", flexShrink: 0,
  },
  text: { flex: 1, minWidth: 0 },
  eyebrow: { ...TYPE.eyebrow, fontSize: 9, letterSpacing: 1.7, color: BASECAMP.textMuted },
  name: { marginTop: 5, fontSize: 17, lineHeight: 21, fontFamily: "Inter_700Bold", letterSpacing: -0.4, color: BASECAMP.text },
  route: { fontSize: 13, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  fact: { marginTop: 7, flexDirection: "row", alignItems: "center", gap: 6 },
  factText: { ...TYPE.caption, fontSize: 11.5, color: BASECAMP.textMuted, flexShrink: 1 },

  primary: {
    marginTop: 12, minHeight: 46, borderRadius: 13,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9,
    backgroundColor: EXPLORE.accent, paddingHorizontal: SP.md,
  },
  primaryText: { ...TYPE.bodyBold, fontSize: 14, color: EXPLORE.accentInk, flexShrink: 1 },
  disabled: { opacity: 0.5 },
  secondary: {
    marginTop: 8, minHeight: 44, borderRadius: 13,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: BASECAMP.panelSub, borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },
  secondaryText: { ...TYPE.bodyBold, fontSize: 13, color: BASECAMP.textStrong, flexShrink: 1 },
});
