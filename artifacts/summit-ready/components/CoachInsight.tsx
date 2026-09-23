/**
 * CoachInsight — the approved visual treatment for SummitReady's EXISTING AI Coach.
 *
 * This is presentation only. It does NOT:
 *   · fetch anything — the screen owns /coach-assessment and /coach-ask,
 *   · retry, cache or gate — the screen owns that too,
 *   · produce any number — every figure arrives as an engine-supplied `fact`.
 *
 * It reuses the existing mascot asset (`assets/mascot.webp`) via the
 * `mascot` prop, so there is one mascot in the product and this component
 * does not introduce a second.
 *
 * Shape comes from `utils/coachInsightPresentation.ts`, which keeps `facts`
 * (engine-owned) structurally apart from `interpretation` (Coach-owned).
 */
import React, { useEffect } from "react";
import {
  ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, ViewStyle,
} from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { ChevronRight, Lock, RefreshCw, WifiOff } from "lucide-react-native";
import { T } from "@/constants/theme";
import { BASECAMP, HIT, MOTION, RADIUS, SP, TYPE } from "@/constants/tokens";
import { SRProgress } from "@/components/ui";
import {
  CoachInsightState, compactCoach, hasProjection,
} from "@/utils/coachInsightPresentation";

const TONE: Record<string, string> = {
  positive: T.green, warning: T.orange, neutral: T.blue,
};

export interface CoachInsightProps {
  state: CoachInsightState;
  /** The existing mascot, passed in so this component never owns the asset. */
  mascot?: React.ReactNode;
  /** How many next-actions to show. Basecamp uses the compact treatment. */
  variant?: "compact" | "full";
  onRetry?: () => void;
  onRefresh?: () => void;
  /** Opens the fuller Coach experience already in the app. */
  onOpen?: () => void;
  onUnlock?: () => void;
  style?: ViewStyle;
  /** Plays the existing wave once on appearance. Never loops. */
  onAppear?: () => void;
}

export function CoachInsight({
  state, mascot, variant = "compact", onRetry, onRefresh, onOpen, onUnlock, style, onAppear,
}: CoachInsightProps) {
  const reduced = useReducedMotion();
  useEffect(() => { if (state.kind === "ready") onAppear?.(); }, [state.kind, onAppear]);

  if (state.kind === "hidden") return null;

  if (state.kind === "locked") {
    return (
      <View style={[styles.card, style]}>
        <View style={styles.header}>
          {mascot}
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>AI COACH</Text>
            <Text style={styles.title} numberOfLines={1}>Your mountain coach</Text>
          </View>
          <Lock size={15} color={T.basecampTextMuted} />
        </View>
        <Text style={styles.body}>
          Your coach reads your goal, training and readiness, then tells you what matters next.
        </Text>
        <TouchableOpacity
          onPress={onUnlock}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel="Unlock your AI coach"
        >
          <Text style={styles.actionText}>Meet your coach</Text>
          <ChevronRight size={14} color={BASECAMP.accent} />
        </TouchableOpacity>
      </View>
    );
  }

  const compact = compactCoach(state, variant === "compact" ? 1 : 3);

  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(MOTION.enter)}
      style={[styles.card, style]}
      accessibilityLabel="AI coach insight"
    >
      <View style={styles.header}>
        {mascot}
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>AI COACH</Text>
          <Text style={styles.title} numberOfLines={1}>
            {state.kind === "ready" && state.facts.mountainName
              ? state.facts.mountainName
              : "Your coach assessment"}
          </Text>
        </View>
        {onRefresh ? (
          <TouchableOpacity
            onPress={onRefresh}
            disabled={state.kind === "loading"}
            hitSlop={HIT.slop}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Refresh coach assessment"
          >
            <RefreshCw size={14} color={T.basecampTextMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {state.kind === "error" ? (
        <TouchableOpacity
          onPress={onRetry}
          style={styles.inlineRow}
          accessibilityRole="button"
          accessibilityLabel="Retry coach assessment"
        >
          <WifiOff size={15} color={T.basecampTextMuted} />
          <Text style={styles.body}>Couldn&rsquo;t reach your coach — tap to retry</Text>
        </TouchableOpacity>
      ) : state.kind === "loading" ? (
        <View style={styles.inlineRow}>
          <ActivityIndicator size="small" color={T.green} />
          <Text style={styles.body}>Analysing your training…</Text>
        </View>
      ) : compact ? (
        <>
          <Text style={styles.summary}>{compact.summary}</Text>

          {compact.nextActions.length > 0 ? (
            <View style={styles.actions}>
              {compact.nextActions.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <View style={[styles.tipDot, { backgroundColor: TONE[compact.tone] ?? T.blue }]} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* The priority session and the readiness figures are drawn ONLY when
              the engines supplied them. The assessment prose is never enough. */}
          {compact.facts.nextSessionTitle ? (
            <View style={styles.priority}>
              <Text style={styles.priorityLabel}>
                {compact.facts.nextSessionDay
                  ? `${compact.facts.nextSessionDay.toUpperCase()}’S PRIORITY`
                  : "NEXT PRIORITY"}
              </Text>
              <Text style={styles.priorityTitle} numberOfLines={1}>
                {compact.facts.nextSessionTitle}
              </Text>
              {(compact.facts.nextSessionElevationM !== null || compact.facts.nextSessionDuration) ? (
                <Text style={styles.priorityMeta} numberOfLines={1}>
                  {[
                    compact.facts.nextSessionElevationM !== null
                      ? `${Math.round(compact.facts.nextSessionElevationM)} m` : null,
                    compact.facts.nextSessionDuration,
                  ].filter(Boolean).join(" · ")}
                </Text>
              ) : null}
            </View>
          ) : null}

          {hasProjection(compact.facts) ? (
            <View style={styles.projection}>
              <Text style={styles.projectionCopy}>Completing it could move your projected readiness:</Text>
              <View style={styles.projectionRow}>
                <View style={styles.projectionEnd}>
                  <Text style={styles.projectionCurrent}>{compact.facts.currentReadiness}%</Text>
                  <Text style={styles.projectionCap}>CURRENT</Text>
                </View>
                <SRProgress
                  value={compact.facts.currentReadiness!}
                  projected={compact.facts.projectedReadiness}
                  /* the same two-tone treatment as the Readiness ring: earned
                     is solid, projected is the same hue softened */
                  tone={BASECAMP.accent}
                  projectedTone={BASECAMP.accent}
                  style={{ flex: 1 }}
                  accessibilityLabel={`Readiness ${compact.facts.currentReadiness} percent, projected ${compact.facts.projectedReadiness} percent`}
                />
                <View style={styles.projectionEnd}>
                  <Text style={styles.projectionProjected}>{compact.facts.projectedReadiness}%</Text>
                  <Text style={[styles.projectionCap, { color: BASECAMP.accent }]}>PROJECTED</Text>
                </View>
              </View>
            </View>
          ) : null}

          {onOpen ? (
            <TouchableOpacity
              onPress={onOpen}
              style={styles.action}
              accessibilityRole="button"
              accessibilityLabel="Open your coach"
            >
              <Text style={styles.actionText}>
                {compact.hasMore ? "See all guidance" : "Ask your coach"}
              </Text>
              <ChevronRight size={14} color={BASECAMP.accent} />
            </TouchableOpacity>
          ) : null}

          <Text style={styles.disclaimer}>{compact.disclaimer}</Text>
        </>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /* The surface is the caller's: Training Basecamp wraps this in the approved
     panel so the Coach sits inside the composition rather than on a card of
     its own. Left as a self-contained surface for any other host. */
  card: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: RADIUS.xl, padding: SP.md, gap: SP.sm,
  },
  header: { flexDirection: "row", alignItems: "center", gap: SP.sm },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: { ...TYPE.eyebrow, color: BASECAMP.accent },
  title: { ...TYPE.heading, color: BASECAMP.text, marginTop: 2 },
  iconBtn: {
    minWidth: HIT.minTarget, minHeight: HIT.minTarget,
    alignItems: "center", justifyContent: "center", marginRight: -SP.sm,
  },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: SP.sm, minHeight: HIT.minTarget },
  body: { ...TYPE.body, color: T.basecampTextMuted, flexShrink: 1 },
  summary: { ...TYPE.bodyBold, color: T.basecampText, lineHeight: 20 },
  actions: { gap: 6 },
  tipRow: { flexDirection: "row", gap: SP.sm, alignItems: "flex-start" },
  tipDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  tipText: { ...TYPE.small, color: T.basecampTextMuted, flex: 1, lineHeight: 17 },
  priority: {
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)", borderRadius: RADIUS.md, padding: SP.md,
  },
  priorityLabel: { ...TYPE.eyebrow, color: T.basecampTextDim },
  priorityTitle: { ...TYPE.bodyBold, color: T.basecampText, marginTop: 5, fontSize: 15 },
  priorityMeta: { ...TYPE.small, color: T.basecampTextMuted, marginTop: 2 },
  projection: { gap: 7 },
  projectionCopy: { ...TYPE.caption, color: T.basecampTextMuted },
  projectionRow: { flexDirection: "row", alignItems: "center", gap: SP.md },
  /* 54, not 52: the fixture guard forbids a bare 52 in production source,
     and a layout constant that happens to collide with the readiness
     example is not worth weakening that check for. */
  projectionEnd: { alignItems: "center", minWidth: 54 },
  projectionCurrent: { ...TYPE.metric, fontSize: 22, color: T.basecampText },
  projectionProjected: { ...TYPE.metric, fontSize: 22, color: BASECAMP.accent },
  projectionCap: { ...TYPE.eyebrow, fontSize: 8.5, color: T.basecampTextDim, marginTop: 3 },
  action: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    minHeight: HIT.minTarget, borderRadius: RADIUS.md,
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: T.basecampBorder,
  },
  actionText: { ...TYPE.smallBold, color: BASECAMP.accent },
  disclaimer: { fontSize: 10, lineHeight: 13, fontFamily: "Inter_400Regular", color: T.basecampTextDim },
});
