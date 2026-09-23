/**
 * The selected route, expanded IN PLACE beneath its card.
 *
 * This is the whole route detail: standing, headline figures, elevation
 * profile, description, facts and Mountain DNA. There is no separate Route
 * Detail screen — choosing a route never leaves the mountain.
 *
 * It renders what it is handed. Every decision about what a route may be used
 * for was already made by `routeEligibility()` and arrives in
 * `selected.eligibility`; this component neither re-derives nor softens it.
 */
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown, ChevronUp, Clock, Download, Route as RouteIcon, TrendingUp } from "lucide-react-native";
import { BASECAMP, EXPLORE, RADIUS, SP, TYPE } from "@/constants/tokens";
import { SREyebrow, SRPanel, SRSubPanel } from "@/components/ui";
import { CAPABILITIES } from "@/constants/capabilities";
import { FactList, VerificationBadge, VerificationNotice } from "./parts";
import { ElevationProfile } from "./ElevationProfile";
import { MountainDnaPanel } from "./MountainDnaPanel";
import type { PresentedDna, PresentedFact, PresentedSelectedRoute } from "@/utils/mountainDetailPresentation";

const SUMMARY_LINES = 3;

const HEADLINE_ICON: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  distance: RouteIcon, ascent: TrendingUp, time: Clock,
};

export function SelectedRoute({
  selected, dna, mountainSummitElevation, onDownloadOffline,
}: {
  selected: PresentedSelectedRoute;
  dna: PresentedDna;
  /** The MOUNTAIN's height. Shown beside the route's ascent, never merged. */
  mountainSummitElevation: PresentedFact;
  onDownloadOffline?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { route, eligibility } = selected;
  /* A one-sentence description is already the summary at the top. Printing
     it again under its own heading reads as a rendering fault. */
  const description = route.description && route.description !== route.summary
    ? route.description
    : null;
  const longDescription = !!description && description.length > 180;

  return (
    <SRPanel radius={16} style={styles.panel} testID="selected-route">
      <View style={styles.head}>
        <View style={styles.headText}>
          <SREyebrow tone={EXPLORE.accent}>SELECTED ROUTE</SREyebrow>
          <Text style={styles.title} numberOfLines={4}>{route.name}</Text>
          {route.summary ? (
            <Text style={styles.summary} numberOfLines={SUMMARY_LINES}>{route.summary}</Text>
          ) : null}
        </View>
        <VerificationBadge state={route.verification} />
      </View>

      {selected.headline.length > 0 ? (
        <View style={styles.metrics}>
          {selected.headline.map(f => <HeadlineTile key={f.key} fact={f} />)}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ELEVATION PROFILE</Text>
        <View style={styles.profile}>
          <ElevationProfile points={selected.profile} routeName={route.name} />
        </View>
        {/* Three ALTITUDES, directly under the curve they belong to. Total
            ascent is deliberately not repeated here — it is a different kind
            of number and already has its own tile above. */}
        <View style={styles.altitudes}>
          <Altitude fact={route.startElevation} />
          <Altitude fact={mountainSummitElevation} overrideLabel="Mountain summit" />
          <Altitude
            fact={selected.facts.find(f => f.key === "routeSummit") ?? route.routeSummitElevation}
            overrideLabel="Route high point"
          />
        </View>
      </View>

      {description ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ROUTE DESCRIPTION</Text>
          <Text style={styles.description} numberOfLines={expanded ? undefined : 4}>
            {description}
          </Text>
          {longDescription ? (
            <Pressable
              onPress={() => setExpanded(v => !v)}
              accessibilityRole="button"
              accessibilityLabel={expanded ? "Show less" : "Show more"}
              hitSlop={8}
              style={styles.more}
            >
              <Text style={styles.moreText}>{expanded ? "Show less" : "Show more"}</Text>
              {expanded
                ? <ChevronUp size={12} color={EXPLORE.accent} />
                : <ChevronDown size={12} color={EXPLORE.accent} />}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.facts}>
        <FactList facts={selected.facts} />
      </View>

      <MountainDnaPanel dna={dna} />

      <View style={styles.footer}>
        {eligibility.isNavigable && eligibility.canDownloadOffline ? (
          <Pressable
            onPress={onDownloadOffline}
            accessibilityRole="button"
            accessibilityLabel="Download for offline use"
            style={styles.download}
          >
            <Download size={16} color={EXPLORE.accent} />
            <Text style={styles.downloadText}>Download for offline use</Text>
          </Pressable>
        ) : eligibility.isNavigable ? (
          /* Verified, but the capability does not exist in this build. Saying
             so is more honest than a button that cannot do anything. */
          <Text style={styles.absent} testID="offline-absent">
            {CAPABILITIES.routeOfflineDownload
              ? "Offline download is unavailable for this route."
              : "Offline route packaging is not part of this version of SummitReady. Your recorded activities already work offline."}
          </Text>
        ) : (
          <VerificationNotice />
        )}
      </View>
    </SRPanel>
  );
}

function HeadlineTile({ fact }: { fact: PresentedFact }) {
  const Icon = HEADLINE_ICON[fact.key];
  return (
    <SRSubPanel radius={12} style={styles.metric}>
      {Icon ? <Icon size={14} color={EXPLORE.accent} /> : null}
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {fact.value}
      </Text>
      <Text style={styles.metricLabel} numberOfLines={2}>{fact.label}</Text>
    </SRSubPanel>
  );
}

function Altitude({ fact, overrideLabel }: { fact: PresentedFact; overrideLabel?: string }) {
  return (
    <View style={styles.altitude}>
      <Text style={styles.altitudeValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {fact.value ?? "—"}
      </Text>
      <Text style={styles.altitudeLabel} numberOfLines={2}>{overrideLabel ?? fact.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 9, borderColor: EXPLORE.accentLine },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 13, paddingBottom: 0 },
  headText: { flex: 1, minWidth: 0 },
  title: { marginTop: 5, ...TYPE.title, fontSize: 19, lineHeight: 23, color: BASECAMP.text },
  summary: { marginTop: 5, ...TYPE.small, color: BASECAMP.textMuted },

  metrics: { flexDirection: "row", gap: SP.sm, paddingHorizontal: 13, marginTop: 12 },
  metric: { flex: 1, minWidth: 0, padding: 10 },
  metricValue: { marginTop: 5, fontSize: 14.5, lineHeight: 18, fontFamily: "Inter_700Bold", color: BASECAMP.text },
  metricLabel: { fontSize: 9, lineHeight: 12, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },

  altitudes: { flexDirection: "row", gap: SP.sm, marginTop: 6 },
  altitude: { flex: 1, minWidth: 0 },
  altitudeValue: { fontSize: 13, lineHeight: 17, fontFamily: "Inter_700Bold", color: BASECAMP.text },
  altitudeLabel: { fontSize: 9, lineHeight: 12, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },

  section: { paddingHorizontal: 13, marginTop: 15 },
  sectionLabel: { ...TYPE.eyebrow, fontSize: 11, letterSpacing: 1.8, color: BASECAMP.textMuted },
  profile: { marginTop: 7 },
  description: { marginTop: 7, fontSize: 12.5, lineHeight: 18, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },
  more: { marginTop: 5, flexDirection: "row", alignItems: "center", gap: 5, minHeight: 28 },
  moreText: { ...TYPE.smallBold, fontSize: 11.5, color: EXPLORE.accent },

  facts: { marginTop: 15, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },

  footer: { padding: 13, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  download: {
    minHeight: 48, borderRadius: 13, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 9,
    backgroundColor: BASECAMP.panelSub, borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },
  downloadText: { ...TYPE.bodyBold, fontSize: 12.5, color: BASECAMP.text },
  absent: { fontSize: 11, lineHeight: 15, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
});

export const SELECTED_ROUTE_RADIUS = RADIUS.xl;
