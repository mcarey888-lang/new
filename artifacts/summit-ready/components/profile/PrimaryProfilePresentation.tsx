import { Settings, UserRound } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { SRUnderlineTabs } from "@/components/ui";
import { BASECAMP, HIT, SP, TYPE } from "@/constants/tokens";
import { resolveApprovedTabHeroArtwork } from "@/utils/artworkResolver";

export type PrimaryProfileTab = "profile" | "achievements" | "activity" | "photos" | "stats";

export const PRIMARY_PROFILE_TABS: { value: PrimaryProfileTab; label: string }[] = [
  { value: "profile", label: "Profile" },
  { value: "achievements", label: "Achievements" },
  { value: "activity", label: "Activity" },
  { value: "photos", label: "Photos" },
  { value: "stats", label: "Stats" },
];

type Metric = { value: string; label: string };

type Props = {
  displayName: string;
  displayEmail?: string | null;
  avatarInitial: string;
  avatarImageUrl?: string | null;
  isSignedIn: boolean;
  rankName: string;
  metrics: [Metric, Metric, Metric];
  selectedTab: PrimaryProfileTab;
  onTabChange: (tab: PrimaryProfileTab) => void;
  onOpenSettings: () => void;
  topInset: number;
};

/** The shared editorial identity and local navigation for both primary shells. */
export function PrimaryProfilePresentation({
  displayName,
  displayEmail,
  avatarInitial,
  avatarImageUrl,
  isSignedIn,
  rankName,
  metrics,
  selectedTab,
  onTabChange,
  onOpenSettings,
  topInset,
}: Props) {
  const [approvedCoverUri, setApprovedCoverUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveApprovedTabHeroArtwork("profile")
      .then((artwork) => {
        if (!cancelled) setApprovedCoverUri(artwork?.uri ?? null);
      })
      .catch(() => {
        if (!cancelled) setApprovedCoverUri(null);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <View style={styles.hero}>
        <View style={styles.cover}>
          {approvedCoverUri ? (
            <ImageBackground
              source={{ uri: approvedCoverUri }}
              onError={() => setApprovedCoverUri(null)}
              resizeMode="cover"
              style={StyleSheet.absoluteFill}
              accessibilityLabel="Approved SummitReady profile cover artwork"
            />
          ) : (
            <View style={StyleSheet.absoluteFill}>
              <LinearGradient colors={BASECAMP.panelGradient} style={StyleSheet.absoluteFill} />
              <View style={styles.coverGlow} />
              <View style={styles.ridgeFar} />
              <View style={styles.ridgeNear} />
            </View>
          )}
          <LinearGradient
            colors={["rgba(5,9,11,0.44)", "rgba(5,9,11,0.25)", BASECAMP.ink]}
            locations={[0, 0.44, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.topBar, { paddingTop: topInset + SP.sm }]}>
            <View>
              <Text style={styles.brand}>SUMMITREADY</Text>
              <Text style={styles.coverKicker}>YOUR MOUNTAIN STORY</Text>
            </View>
            <TouchableOpacity
              onPress={onOpenSettings}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Open account settings"
              testID="profile-settings"
              hitSlop={HIT.slop}
              style={styles.settingsButton}
            >
              <Settings size={18} color={BASECAMP.text} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.identity}>
          <View style={styles.identityRow}>
            <View style={styles.avatar}>
              {avatarImageUrl ? (
                <Image source={{ uri: avatarImageUrl }} style={styles.avatarImage} />
              ) : isSignedIn ? (
                <Text style={styles.avatarInitial}>{avatarInitial}</Text>
              ) : (
                <UserRound size={25} color={BASECAMP.textMuted} />
              )}
            </View>
            <View style={styles.nameBlock}>
              <Text style={styles.rank} numberOfLines={1}>{rankName.toUpperCase()}</Text>
              <Text style={styles.name} numberOfLines={2}>{displayName}</Text>
              {displayEmail && displayEmail !== displayName ? (
                <Text style={styles.email} numberOfLines={1}>{displayEmail}</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.metrics}>
            {metrics.map((metric, index) => (
              <View key={metric.label} style={[styles.metric, index > 0 && styles.metricDivider]}>
                <Text
                  style={styles.metricValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
                  {metric.value}
                </Text>
                <Text style={styles.metricLabel} numberOfLines={2}>{metric.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <SRUnderlineTabs
        options={PRIMARY_PROFILE_TABS}
        value={selectedTab}
        onChange={onTabChange}
        style={styles.tabs}
      />
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: -18,
    marginBottom: SP.md,
  },
  cover: {
    height: 226,
    justifyContent: "flex-start",
    backgroundColor: BASECAMP.ink,
    overflow: "hidden",
  },
  coverGlow: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    right: -35,
    top: -82,
    backgroundColor: BASECAMP.accentDim,
  },
  ridgeFar: {
    position: "absolute",
    width: 310,
    height: 310,
    left: "18%",
    bottom: -244,
    borderRadius: 36,
    transform: [{ rotate: "45deg" }],
    backgroundColor: BASECAMP.panelSubBorder,
  },
  ridgeNear: {
    position: "absolute",
    width: 280,
    height: 280,
    left: "-17%",
    bottom: -239,
    borderRadius: 34,
    transform: [{ rotate: "45deg" }],
    backgroundColor: BASECAMP.accentDim,
  },
  topBar: {
    paddingHorizontal: BASECAMP.gutter,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brand: {
    ...TYPE.eyebrow,
    color: BASECAMP.text,
    letterSpacing: 2,
  },
  coverKicker: {
    marginTop: 4,
    ...TYPE.caption,
    color: BASECAMP.textMuted,
    letterSpacing: 1.4,
  },
  settingsButton: {
    width: HIT.minTarget,
    height: HIT.minTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: BASECAMP.glass,
    borderWidth: 1,
    borderColor: BASECAMP.glassBorder,
  },
  identity: {
    paddingHorizontal: BASECAMP.gutter,
    marginTop: -42,
    paddingBottom: SP.md,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BASECAMP.panelSub,
    borderWidth: 3,
    borderColor: BASECAMP.ink,
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarInitial: {
    fontSize: 31,
    lineHeight: 37,
    fontFamily: "Inter_700Bold",
    color: BASECAMP.accent,
  },
  nameBlock: { flex: 1, minWidth: 0, paddingTop: 37 },
  rank: {
    ...TYPE.eyebrow,
    color: BASECAMP.accent,
  },
  name: {
    marginTop: 3,
    fontSize: 23,
    lineHeight: 27,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.35,
    color: BASECAMP.text,
  },
  email: {
    marginTop: 2,
    ...TYPE.caption,
    color: BASECAMP.textDim,
  },
  metrics: {
    flexDirection: "row",
    marginTop: SP.lg,
    paddingTop: SP.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BASECAMP.hairline,
  },
  metric: { flex: 1, minWidth: 0, paddingHorizontal: SP.sm },
  metricDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: BASECAMP.hairline },
  metricValue: {
    fontSize: 19,
    lineHeight: 23,
    fontFamily: "Inter_700Bold",
    color: BASECAMP.text,
  },
  metricLabel: {
    marginTop: 2,
    ...TYPE.caption,
    color: BASECAMP.textDim,
  },
  tabs: { marginHorizontal: -18, marginBottom: SP.xs },
});