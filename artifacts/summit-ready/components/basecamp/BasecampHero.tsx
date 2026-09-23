/**
 * BasecampHero — the approved Training Basecamp header.
 *
 * Composition comes from `summitready-training-basecamp-mockup.html`:
 * an edge-to-edge mountain photograph, a restrained brand lockup and the
 * screen's two real actions, then the objective stated in large type with its
 * own metrics and a glass target-date pill.
 *
 * DATA is entirely production's. The mountain name, date and figures are the
 * user's summit goal; the photograph comes from the existing artwork resolver
 * with the existing fallback chain (approved artwork → mountain-image →
 * gradient), unchanged. No figure is fabricated: a metric the goal does not
 * carry is omitted rather than shown as zero.
 *
 * The hero sizes itself from its content with a floor, so a long mountain name
 * or a large altitude pushes it taller instead of being clipped at a fixed
 * height copied from a screenshot.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ImageBackground, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Calendar, Lock, Mountain, Pencil } from "lucide-react-native";
import { BASECAMP, HIT } from "@/constants/tokens";
import { ModeTogglePill } from "@/components/ModeTogglePill";
import { resolveTrainingBasecampArtwork } from "@/utils/artworkResolver";
import {
  objectiveMetrics, targetDateDisplay,
  type ObjectiveMetricsInput,
} from "@/utils/basecampPresentation";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

type HeroSource =
  | { kind: "resolving" }
  | { kind: "approved"; uri: string; assetId: string; version: number; placement: string }
  | { kind: "mountain-image"; uri: string; reason: string }
  | { kind: "gradient"; reason: string };

export interface BasecampHeroProps {
  mountainName: string;
  summitDate: string;
  goal: ObjectiveMetricsInput;
  topInset: number;
  isSubscribed: boolean;
  onEditObjective: () => void;
  onChangeMountain: () => void;
  onPressSubscription: () => void;
}

export function BasecampHero({
  mountainName, summitDate, goal, topInset,
  isSubscribed, onEditObjective, onChangeMountain, onPressSubscription,
}: BasecampHeroProps) {
  const mountainFallbackUri = `${API_BASE}/mountain-image?name=${encodeURIComponent(mountainName)}`;
  const [heroSource, setHeroSource] = useState<HeroSource>({ kind: "resolving" });

  /* The existing resolver, fallback chain and dev logging, unchanged. */
  const logSource = useCallback((source: HeroSource) => {
    if (!__DEV__ || source.kind === "resolving") return;
    const details = source.kind === "approved"
      ? {
          source: source.kind,
          assetId: source.assetId,
          version: source.version,
          placement: source.placement,
          uri: source.uri,
        }
      : { source: source.kind, reason: source.reason, uri: "uri" in source ? source.uri : null };
    console.info("[Basecamp hero source]", details);
  }, []);

  useEffect(() => {
    let active = true;
    setHeroSource({ kind: "resolving" });

    async function loadArtwork() {
      const devProfileId = await AsyncStorage.getItem("summitready_dev_profile_id");
      const approved = await resolveTrainingBasecampArtwork({ devProfileId, mountainName });
      if (!active) return;
      const next: HeroSource = approved
        ? {
            kind: "approved",
            uri: approved.uri,
            assetId: approved.assetId,
            version: approved.version,
            placement: approved.placement,
          }
        : {
            kind: "mountain-image",
            uri: mountainFallbackUri,
            reason: "approved artwork unavailable or identity mismatch",
          };
      logSource(next);
      setHeroSource(next);
    }
    void loadArtwork();
    return () => { active = false; };
  }, [logSource, mountainFallbackUri, mountainName]);

  const heroImageUri = heroSource.kind === "approved" || heroSource.kind === "mountain-image"
    ? heroSource.uri
    : null;

  const onImageError = () => {
    if (heroSource.kind === "approved") {
      const fallback: HeroSource = {
        kind: "mountain-image",
        uri: mountainFallbackUri,
        reason: `approved artwork image failed to render: ${heroSource.assetId} v${heroSource.version} ${heroSource.placement}`,
      };
      logSource(fallback);
      setHeroSource(fallback);
      return;
    }
    const gradient: HeroSource = { kind: "gradient", reason: "mountain-image fallback failed to render" };
    logSource(gradient);
    setHeroSource(gradient);
  };

  const date = targetDateDisplay(summitDate);
  const metrics = objectiveMetrics(goal);

  /* The header carries the lockup, the mode toggle and two actions. Below
     roughly 400pt those cannot all state themselves in full, and the mode
     toggle is the one the user acts on — so the wordmark reduces to its mark
     rather than being pushed under the pill. */
  const { width } = useWindowDimensions();
  const showWordmark = width >= 400;

  const content = (
    <View style={[styles.overlay, { paddingTop: topInset }]}>
      {/* the photograph is bright at the top and resolves into the page
          background at the bottom, so the panel below it has nothing to
          sit against — the prototype's edge-to-edge treatment */}
      <LinearGradient
        colors={["rgba(5,9,11,0.66)", "rgba(5,9,11,0.10)", "rgba(5,9,11,0.40)", "rgba(5,9,11,0.94)", BASECAMP.ink]}
        locations={[0, 0.22, 0.56, 0.88, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(5,9,11,0.88)", "rgba(5,9,11,0.34)", "rgba(5,9,11,0)"]}
        locations={[0, 0.48, 0.84]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.topRow}>
        <View
          style={styles.lockup}
          accessible
          accessibilityRole="header"
          accessibilityLabel="SummitReady"
        >
          <Mountain size={20} color={BASECAMP.text} strokeWidth={1.6} />
          {showWordmark && (
            <View style={{ marginLeft: 8, flexShrink: 1, minWidth: 0 }}>
              <Text style={styles.wordmark} numberOfLines={1}>SUMMITREADY</Text>
              <Text style={styles.tagline} numberOfLines={1}>TRAIN MORE · GO FURTHER.</Text>
            </View>
          )}
        </View>

        <ModeTogglePill embedded />

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onPressSubscription}
            style={styles.glassButton}
            activeOpacity={0.8}
            hitSlop={HIT.slop}
            accessibilityRole="button"
            accessibilityLabel={isSubscribed ? "Manage subscription" : "View SummitReady Pro"}
          >
            <Lock size={13} color={BASECAMP.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onEditObjective}
            style={styles.glassButton}
            activeOpacity={0.8}
            hitSlop={HIT.slop}
            accessibilityRole="button"
            accessibilityLabel="Edit training objective"
          >
            <Pencil size={13} color={BASECAMP.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.objective}>
        <Text style={styles.kicker}>TRAINING BASECAMP</Text>

        <View style={styles.nameRow}>
          <Text style={styles.mountainName} numberOfLines={3}>{mountainName}</Text>
          <TouchableOpacity
            onPress={onChangeMountain}
            style={styles.namePencil}
            activeOpacity={0.7}
            hitSlop={HIT.slop}
            accessibilityRole="button"
            accessibilityLabel="Change mountain objective"
          >
            <Pencil size={14} color={BASECAMP.textDim} />
          </TouchableOpacity>
        </View>

        {metrics.length > 0 && (
          <View style={styles.metricRow}>
            {metrics.map((m, i) => (
              <React.Fragment key={m.key}>
                {i > 0 && <View style={styles.metricDivider} />}
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue} numberOfLines={1}>{m.value}</Text>
                  <Text style={styles.metricLabel} numberOfLines={1}>{m.label.toUpperCase()}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        )}

        {date && (
          <View style={styles.datePill}>
            <Calendar size={18} color={BASECAMP.textMuted} />
            <View>
              <Text style={styles.dateLabel}>Target date</Text>
              <Text style={styles.dateValue}>{date.label}</Text>
            </View>
            <View style={styles.dateDivider} />
            <View>
              <Text style={styles.dateCount}>
                {date.daysRemaining === null ? "—" : date.daysRemaining.toLocaleString()}
              </Text>
              <Text style={styles.dateLabel}>{date.past ? "date passed" : "days to go"}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );

  if (!heroImageUri) {
    /* The designed fallback — still the approved composition, never an
       error state or an empty box. */
    return (
      <LinearGradient colors={["#1B2C2A", "#0C1417", BASECAMP.ink]} style={styles.container}>
        {content}
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: heroImageUri }}
        style={styles.image}
        imageStyle={styles.imageInner}
        resizeMode="cover"
        onError={onImageError}
      >
        {content}
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", backgroundColor: BASECAMP.ink },
  image: { width: "100%" },
  imageInner: { resizeMode: "cover" },
  overlay: {
    minHeight: 292,
    paddingHorizontal: BASECAMP.gutter,
    paddingBottom: 26,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  lockup: { flexDirection: "row", alignItems: "center", flexShrink: 1, minWidth: 0 },
  wordmark: {
    fontSize: 11, lineHeight: 14, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: 2,
  },
  tagline: {
    fontSize: 7, lineHeight: 9, fontFamily: "Inter_600SemiBold",
    color: BASECAMP.textMuted, letterSpacing: 1.2, marginTop: 1,
  },
  actions: { flexDirection: "row", gap: 8, flexShrink: 0 },
  glassButton: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    backgroundColor: BASECAMP.glass,
    borderWidth: 1, borderColor: BASECAMP.glassBorder,
  },

  objective: { marginTop: 28 },
  kicker: {
    fontSize: 10, lineHeight: 13, fontFamily: "Inter_600SemiBold",
    letterSpacing: 3, color: BASECAMP.textMuted,
  },
  nameRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 6 },
  mountainName: {
    flexShrink: 1,
    fontSize: 36, lineHeight: 39, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: -1,
  },
  namePencil: { marginTop: 10 },

  metricRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 13 },
  metricItem: { flexShrink: 1, minWidth: 0 },
  metricDivider: {
    width: 1, height: 26, marginHorizontal: 13,
    backgroundColor: BASECAMP.hairline, marginTop: 1,
  },
  metricValue: {
    fontSize: 15, lineHeight: 18, fontFamily: "Inter_600SemiBold",
    color: BASECAMP.textStrong,
  },
  metricLabel: {
    fontSize: 9.5, lineHeight: 12, fontFamily: "Inter_500Medium",
    letterSpacing: 1.1, color: BASECAMP.textDim,
    marginTop: 3,
  },

  datePill: {
    marginTop: 16,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingLeft: 14, paddingRight: 18, paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: BASECAMP.glass,
    borderWidth: 1, borderColor: BASECAMP.glassBorder,
  },
  dateLabel: { fontSize: 10.5, lineHeight: 13, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  dateValue: { fontSize: 13.5, lineHeight: 17, fontFamily: "Inter_600SemiBold", color: BASECAMP.text },
  dateDivider: { width: 1, height: 30, backgroundColor: BASECAMP.hairline },
  dateCount: { fontSize: 19, lineHeight: 22, fontFamily: "Inter_700Bold", color: BASECAMP.text, letterSpacing: -0.4 },
});
