/**
 * BasecampReadiness — the approved Readiness panel on Training Basecamp.
 *
 * Composition from the prototype: a panel that overlaps the hero, the ring on
 * the left, and on the right the single next action, the projection and the
 * route into Full Readiness.
 *
 * EVERY NUMBER IS THE READINESS ENGINE'S. This component reads
 * `useReadinessV2()` and formats what it finds. It does not score, does not
 * estimate, and does not synthesise a projection: when the engine reports no
 * projected impact the projection lines simply do not render.
 *
 * Locked (not entitled) keeps the same ring, the same panel and the same
 * hierarchy — only the figure is withheld. The previous four-segment
 * multicolour ring is gone: it drew four fixed equal arcs that encoded nothing
 * and read as a score.
 */
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { ChevronRight, Info } from "lucide-react-native";
import { T } from "@/constants/theme";
import { BASECAMP, HIT, MOTION } from "@/constants/tokens";
import { SRReadinessGauge } from "@/components/SRReadinessGauge";
import { SRPanel } from "@/components/ui";
import {
  PILLAR_LABELS, STATUS_COPY, projection, readinessStatus,
} from "@/utils/readinessPresentation";
import type { ReadinessNextAction } from "@/utils/readinessActions";
import type { ReadinessResult } from "@/utils/readinessV2";

const GAUGE_SIZE = 104;
const GAUGE_STROKE = 9;

export interface BasecampReadinessProps {
  result: ReadinessResult | null | undefined;
  nextAction: ReadinessNextAction | null | undefined;
  isSubscribed: boolean;
  onOpen: () => void;
}

export function BasecampReadiness({
  result, nextAction, isSubscribed, onOpen,
}: BasecampReadinessProps) {
  const reduced = useReducedMotion();
  if (!result) return null;

  /* A missing score stays null — never a confident-looking zero. */
  const score = result.overallScore ?? null;
  const status = readinessStatus(result.state, result.overallScore);
  const proj = projection(result.overallScore, nextAction?.projectedImpact?.delta ?? null);

  /* The approved ring is SummitReady green whenever there is a score to draw.
     Status is carried by the label under the figure, not by recolouring the
     arc — the prototype shows BUILDING against the green ring. */
  const ringTone = score === null ? T.textMuted : BASECAMP.accent;

  const actionTitle = isSubscribed
    ? nextAction?.label?.trim() || STATUS_COPY[status].label
    : "Unlock your readiness";
  const actionDetail = isSubscribed
    ? (nextAction ? `Focus · ${PILLAR_LABELS[nextAction.focusDimension]}` : STATUS_COPY[status].detail)
    : "Endurance, elevation, consistency and mountain experience — scored against your objective.";

  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(MOTION.stagger).duration(MOTION.enter)}
      style={styles.wrap}
    >
      <SRPanel
        onPress={onOpen}
        accessibilityLabel={isSubscribed ? "Readiness" : "Unlock readiness with SummitReady Pro"}
        accessibilityHint={isSubscribed ? "Opens your full readiness breakdown" : undefined}
        testID="basecamp-readiness"
      >
        <View style={styles.inner}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerLabel}>READINESS</Text>
              <Info size={12} color={BASECAMP.textFaint} />
            </View>
            <ChevronRight size={15} color={BASECAMP.textDim} />
          </View>

          <View style={styles.body}>
            <SRReadinessGauge
              score={score}
              projected={proj ? proj.projected : null}
              size={GAUGE_SIZE}
              strokeWidth={GAUGE_STROKE}
              statusLabel={isSubscribed ? STATUS_COPY[status].label : undefined}
              tone={ringTone}
              locked={!isSubscribed}
              /* the compact panel has no room for an anchored callout —
                 the projection is stated in words beneath instead */
              showProjectedCallout={false}
            />

            <View style={styles.meta}>
              <Text style={styles.actionTitle} numberOfLines={2}>{actionTitle}</Text>
              <Text style={styles.actionDetail} numberOfLines={3}>{actionDetail}</Text>

              <View style={styles.footerRow}>
                {isSubscribed && proj ? (
                  <Text style={styles.projected} numberOfLines={1}>
                    Projected <Text style={styles.projectedValue}>+{Math.round(proj.delta)}%</Text>
                  </Text>
                ) : null}

                <TouchableOpacity
                  onPress={onOpen}
                  style={styles.cta}
                  activeOpacity={0.85}
                  hitSlop={HIT.slop}
                  accessibilityRole="button"
                  accessibilityLabel={isSubscribed ? "View readiness" : "Unlock readiness"}
                >
                  <Text style={styles.ctaText}>{isSubscribed ? "VIEW READINESS" : "UNLOCK"}</Text>
                  <ChevronRight size={12} color={BASECAMP.textStrong} />
                </TouchableOpacity>
              </View>

              {isSubscribed && proj ? (
                <Text style={styles.projectionLine} numberOfLines={1}>
                  {Math.round(proj.current)}% → {Math.round(proj.projected)}% after your next session
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </SRPanel>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /* pulled up so the panel breaks the hero's lower edge, as the approved
     composition does — the screen reads as one object, not two stacked ones */
  wrap: { marginTop: -16, paddingHorizontal: BASECAMP.gutter },
  inner: { padding: 15 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 5 },
  headerLabel: {
    fontSize: 10.5, lineHeight: 13, fontFamily: "Inter_600SemiBold",
    letterSpacing: 2, color: BASECAMP.textMuted,
  },
  body: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginTop: 11 },
  meta: { flex: 1, minWidth: 0, paddingTop: 2 },
  actionTitle: {
    fontSize: 16, lineHeight: 20, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: -0.2,
  },
  actionDetail: {
    fontSize: 12, lineHeight: 16, fontFamily: "Inter_400Regular",
    color: BASECAMP.textDim, marginTop: 5,
  },
  /* The prototype was drawn at 430pt, where the projection and the CTA sit on
     one line. Below that they wrap instead of crushing each other — the
     approved arrangement where there is room for it, never a clipped one. */
  footerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    flexWrap: "wrap", columnGap: 8, rowGap: 8, marginTop: 12,
  },
  projected: {
    flexShrink: 0,
    fontSize: 14, lineHeight: 17, fontFamily: "Inter_600SemiBold", color: BASECAMP.text,
  },
  projectedValue: { color: BASECAMP.accent },
  cta: {
    flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 5,
    height: 34, paddingHorizontal: 11, borderRadius: 10,
    backgroundColor: BASECAMP.panelSub,
    borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },
  ctaText: {
    fontSize: 9.5, lineHeight: 12, fontFamily: "Inter_700Bold",
    letterSpacing: 0.6, color: BASECAMP.textStrong,
  },
  projectionLine: {
    fontSize: 10.5, lineHeight: 14, fontFamily: "Inter_400Regular",
    color: BASECAMP.textDim, marginTop: 6,
  },
});
