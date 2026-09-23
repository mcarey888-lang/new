/**
 * EXPEDITION PROGRESS — the expanded view of the journey.
 *
 * Rebuilt to the approved premium presentation: the shared expedition
 * header, the stage rail, then the existing ExpeditionProgressCard with its
 * chart and stage cards, then the insight row back to Basecamp.
 *
 * Every figure still comes from `selectExpeditionPresentation()`, which is
 * the one place that decides what simulated expedition progress is. This
 * screen derives nothing of its own and the recovery pass below — which
 * relinks a session logged outside the expedition to the stage it matches —
 * is untouched.
 */

import { TrendingUp } from "lucide-react-native";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Platform, ScrollView, StyleSheet, Text, View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import {
  addUniqueCompletedRoute,
  expeditionRouteIdentityMatches,
  routeCompletionKey,
} from "@/utils/stateReliability";
import { BASECAMP, EXPLORE, SP, TYPE } from "@/constants/tokens";
import { SREmptyState, SRPanel, SRSectionHeader } from "@/components/ui";
import { ExpeditionHeader } from "@/components/expedition/ExpeditionHeader";
import { StageRail } from "@/components/expedition/StageRail";
import { useScreenView } from "@/lib/analytics";
import { ExpeditionProgressCard } from "@/components/ExpeditionProgressCard";
import { selectExpeditionPresentation } from "@/utils/expeditionProgress";
import { buildExpeditionStageLaunchContext } from "@/utils/trackingLaunchContext";

// ── Layout constants ──────────────────────────────────────────────────────────

const PILL_OFFSET = 52;

// ── Helpers ───────────────────────────────────────────────────────────────────

function insightMsg(done: number, total: number, remainM: number) {
  if (total === 0)   return { title: "No stages yet",      body: "Start an expedition to track your route progress." };
  if (done === 0)    return { title: "Ready to climb!",    body: `${total} route${total !== 1 ? "s" : ""} to complete. Log your first hike to get started.` };
  if (done >= total) return { title: "All routes complete! 🎉", body: "Head to Base Camp to finish your expedition." };
  return {
    title: "Excellent progress!",
    body: `You've completed ${done} stage${done !== 1 ? "s" : ""}. Just ${Math.round(remainM).toLocaleString()}m to your simulated summit.`,
  };
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ExpeditionProgressScreen() {
  useScreenView("expedition_progress");
  const insets = useSafeAreaInsets();
  const { sessions, activeExpedition, patchExpedition, updateSession } = useApp();
  const recoveredSessionIds = useRef(new Set<string>());

  const presentation = useMemo(
    () => selectExpeditionPresentation(activeExpedition),
    [activeExpedition],
  );
  const target  = activeExpedition?.targetMountain;
  const stages  = activeExpedition?.virtualHills ?? [];
  const completedRoutes: string[] = activeExpedition?.completedRoutes ?? [];

  useEffect(() => {
    if (!activeExpedition) return;
    const expeditionStartedAt = Date.parse(activeExpedition.startedAt ?? activeExpedition.savedAt);
    const recoverable = sessions.flatMap(session => {
      if (
        session.expeditionId ||
        session.type !== "hill" ||
        !session.hillName ||
        recoveredSessionIds.current.has(session.id) ||
        (Number.isFinite(expeditionStartedAt) && Date.parse(session.date) < expeditionStartedAt)
      ) return [];
      const route = activeExpedition.virtualHills.find(candidate =>
        expeditionRouteIdentityMatches(candidate, {
          name: session.hillName!,
          routeIdentityKey: session.routeIdentityKey,
          summitIdentityKey: session.summitIdentityKey,
          objectiveType: session.objectiveType,
        })
      );
      return route ? [{ session, route }] : [];
    });
    if (recoverable.length === 0) return;

    recoverable.forEach(({ session }) => recoveredSessionIds.current.add(session.id));
    void (async () => {
      await Promise.all(recoverable.map(({ session, route }) =>
        updateSession(session.id, {
          expeditionId: activeExpedition.id,
          routeIdentityKey: route.routeIdentityKey,
          summitIdentityKey: route.summitIdentityKey,
          objectiveType: route.objectiveType,
        })
      ));
      const recoveredCompleted = recoverable.reduce(
        (completed, { route }) => addUniqueCompletedRoute(completed, routeCompletionKey(route)),
        activeExpedition.completedRoutes ?? [],
      );
      await patchExpedition(activeExpedition.id, { completedRoutes: recoveredCompleted });
    })();
  }, [activeExpedition, patchExpedition, sessions, updateSession]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  // Both Basecamp's compact mountain and this expanded destination read the
  // same persisted simulated presentation state. Linked activity facts remain
  // available for recovery/linking above, but never become simulated progress.
  const totalElevGoal = presentation.progress.targetSimulatedElevationM;
  const totalTrained = presentation.progress.currentSimulatedElevationM;
  const pct = Math.round(presentation.progress.simulatedPercent * 100);
  const completedCount = presentation.progress.completedStageCount;
  const remaining = Math.max(0, totalElevGoal - totalTrained);

  const expName   = activeExpedition?.expeditionPlan?.title
    ?? target?.name ?? activeExpedition?.challengeName ?? "Your Expedition";
  const daysText  = target?.estimatedDays
    ? `${target.estimatedDays} Day${target.estimatedDays !== 1 ? "s" : ""} Expedition`
    : null;
  const regionText = activeExpedition?.location ?? null;

  const insight = insightMsg(completedCount, presentation.progress.totalStageCount, remaining);

  const topInset = Platform.OS === "web" ? 20 : insets.top;

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!activeExpedition) {
    return (
      <View style={s.screen}>
        <SREmptyState
          icon={<TrendingUp size={22} color={EXPLORE.accent} />}
          title="No expedition yet"
          body="Start an expedition to climb a real objective using the hills around you. Every stage you complete moves you higher."
          action="Choose a mountain"
          onAction={() => router.push("/(expedition)/mountains" as any)}
          style={{ marginTop: topInset + PILL_OFFSET + 40, marginHorizontal: BASECAMP.gutter }}
        />
      </View>
    );
  }

  // ── Filled state ─────────────────────────────────────────────────────────────
  return (
    <View style={s.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop:    topInset + PILL_OFFSET + 16,
          paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120,
          gap: 14,
        }}
      >

        {/* ── Header: what you are climbing and how far up you are ───────── */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <ExpeditionHeader
            presentation={presentation}
            title={expName}
            tagline={[daysText, regionText].filter(Boolean).join(" · ") || null}
          />
        </Animated.View>

        {/* ── Every stage at a glance ────────────────────────────────────── */}
        {presentation.stages.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(50).duration(400)}>
            <View style={s.railHead}>
              <SRSectionHeader title="Stages" />
            </View>
            <StageRail stages={presentation.stages} />
          </Animated.View>
        ) : null}

        {/* ── Chart + stage cards + summary (shared) ──────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <ExpeditionProgressCard
            stages={stages}
            completedRoutes={completedRoutes}
            stagePresentation={presentation.stages}
            totalElev={totalElevGoal}
            totalTrained={totalTrained}
            onStagePress={(hill) => {
              const launch = buildExpeditionStageLaunchContext(
                hill,
                activeExpedition.id,
                activeExpedition.virtualHikeProgress,
              );
              router.push({
                pathname: "/hike-tracking" as any,
                params: launch as any,
              });
            }}
          />
        </Animated.View>

        {/* ── Insight row ─────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <SRPanel
            radius={18}
            onPress={() => router.push("/(expedition)/base-camp" as any)}
            accessibilityLabel={`${insight.title}. ${insight.body}`}
            accessibilityHint="Opens Expedition Basecamp"
            style={s.insightPanel}
          >
            <View style={s.insightRow}>
              <View style={s.insightIcon}>
                <TrendingUp size={20} color={EXPLORE.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.insightTitle} numberOfLines={2}>{insight.title}</Text>
                <Text style={s.insightBody}>{insight.body}</Text>
              </View>
            </View>
          </SRPanel>
        </Animated.View>

      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BASECAMP.ink },
  railHead: { paddingHorizontal: BASECAMP.gutter, marginBottom: SP.sm },

  insightPanel: { marginHorizontal: BASECAMP.gutter },
  insightRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  insightIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: EXPLORE.accentDim,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  insightTitle: { ...TYPE.bodyBold, fontSize: 14, color: BASECAMP.text },
  insightBody: { marginTop: 3, ...TYPE.caption, fontSize: 11.5, lineHeight: 16, color: BASECAMP.textMuted },
});
