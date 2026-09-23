/**
 * FULL READINESS — rebuilt to `summitready-readiness-mockup.html`.
 *
 * Composition from the prototype: a hero carrying the gauge over the goal's
 * photograph, the target-mountain summary, the four pillars, the next best
 * action with its projection, the history chart, the evidence behind the score,
 * and the route into the plan.
 *
 * EVERY NUMBER IS READINESS 2.0's. This screen reads `useReadinessV2()` and
 * formats what it finds:
 *   · the ring draws `result.overallScore`;
 *   · the projected arc is drawn ONLY from `nextAction.projectedImpact.delta`,
 *     and not at all when the engine reported none;
 *   · the pillars are `result.dimensions`, with gaps taken from `result.gaps`
 *     rather than from a threshold invented here;
 *   · the history is the same engine replayed at past dates;
 *   · the evidence list is exactly `result.includedEvidenceIds`.
 *
 * Nothing on this screen is computed, estimated or defaulted. A value the
 * engine did not produce renders as a designed missing state.
 */
import React, { useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import {
  Calendar, ChevronRight, Clock, Info, Mountain, Route, Settings, TrendingUp, Zap,
} from "lucide-react-native";
import { BASECAMP, HIT, MOTION } from "@/constants/tokens";
import { T } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { useReadinessV2 } from "@/hooks/useReadinessV2";
import { useReadinessHistory } from "@/hooks/useReadinessHistory";
import { SRReadinessGauge } from "@/components/SRReadinessGauge";
import {
  SRButton, SREmptyState, SRHeroFrame, SRPanel, SRScreenHeader, SRSectionHeader,
  SRStatusPill, SRSubPanel,
} from "@/components/ui";
import { PillarGrid, PillarSheet } from "@/components/readiness/PillarGrid";
import { ReadinessHistoryChart } from "@/components/readiness/ReadinessHistoryChart";
import {
  PILLAR_LABELS, STATUS_COPY, formatScore, pillarDetails, projection, readinessStatus,
  type PillarDetail,
} from "@/utils/readinessPresentation";
import { evidenceRows } from "@/utils/readinessEvidencePresentation";
import { mountainImageUri } from "@/utils/mountainImage";
import { missionQueue } from "@/utils/basecampPresentation";
import type { HistoryPeriod } from "@/utils/readinessHistory";

const STATUS_TONE: Record<string, string> = {
  ready: BASECAMP.accent,
  nearly: BASECAMP.accent,
  building: BASECAMP.accent,
  pending: BASECAMP.textDim,
  unavailable: BASECAMP.textDim,
};

export default function ReadinessDetailScreen() {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const v2 = useReadinessV2();
  const { summitGoal, sessions, exploreHikes, trainingPlan, completedPlanSessions } = useApp();

  const { result, nextAction, trend } = v2 ?? {};

  const [period, setPeriod] = useState<HistoryPeriod>("4W");
  const history = useReadinessHistory(period);

  const [openPillar, setOpenPillar] = useState<PillarDetail | null>(null);
  const [heroFailed, setHeroFailed] = useState(false);

  const status = readinessStatus(result?.state, result?.overallScore);
  const tone = STATUS_TONE[status] ?? BASECAMP.accent;
  const proj = projection(result?.overallScore, nextAction?.projectedImpact?.delta ?? null);
  const pillars = pillarDetails(result, nextAction?.focusDimension ?? null);

  /* Only the activities the engine actually counted. */
  const evidence = useMemo(() => evidenceRows({
    sessions,
    hikes: exploreHikes,
    includedEvidenceIds: result?.includedEvidenceIds ?? [],
    limit: 4,
  }), [sessions, exploreHikes, result?.includedEvidenceIds]);

  /* "Start session" opens the plan's own next session — the readiness action
     names a focus, the plan owns what to actually do. */
  const { mission } = missionQueue(trainingPlan, completedPlanSessions);

  const heroUri = !heroFailed && summitGoal?.mountainName
    ? mountainImageUri(summitGoal.mountainName)
    : null;

  const goalDate = summitGoal?.summitDate
    ? new Date(`${summitGoal.summitDate}T12:00:00`).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
      })
    : null;

  if (!summitGoal || !result) {
    return (
      <View style={styles.root}>
        <View style={{ paddingTop: Platform.OS === "web" ? 18 : insets.top + 8 }}>
          <SRScreenHeader title="Readiness" onBack={() => router.back()} />
        </View>
        <View style={styles.emptyWrap}>
          <SREmptyState
            testID="readiness-unavailable"
            icon={<Info size={20} color={BASECAMP.textDim} />}
            title={summitGoal ? "Readiness is not available yet" : "Set a summit goal first"}
            body={
              summitGoal
                ? "Readiness needs a goal and some recorded activity before it can score you."
                : "Readiness scores you against a specific mountain. Choose one and it starts working."
            }
            action={summitGoal ? undefined : "Set a summit goal"}
            onAction={summitGoal ? undefined : () => router.push("/questionnaire")}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 40 : insets.bottom) + 44 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero: the score, over the objective ───────────────────── */}
        <SRHeroFrame
          uri={heroUri}
          onImageError={() => setHeroFailed(true)}
          minHeight={352}
          dim={0.94}
          style={{ justifyContent: "space-between" }}
        >
          <View style={{ paddingTop: Platform.OS === "web" ? 18 : insets.top + 8 }}>
            <SRScreenHeader
              title="Readiness"
              onBack={() => router.back()}
              right={
                <TouchableOpacity
                  onPress={() => router.push("/setup")}
                  hitSlop={HIT.slop}
                  accessibilityRole="button"
                  accessibilityLabel="Training settings"
                >
                  <Settings size={18} color={BASECAMP.textStrong} />
                </TouchableOpacity>
              }
            />
          </View>

          <View style={styles.heroBody}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>YOUR READINESS</Text>
              <Text style={styles.heroTitle}>Build for{"\n"}Bigger Mountains</Text>
              <Text style={styles.heroBlurb} numberOfLines={4}>
                {result.explanations?.[0]
                  ?? "Your score across the four pillars, measured against this objective."}
              </Text>
            </View>

            <View style={styles.heroGauge}>
              <SRReadinessGauge
                score={result.overallScore}
                projected={proj ? proj.projected : null}
                size={168}
                strokeWidth={13}
                statusLabel={STATUS_COPY[status].label}
                tone={tone}
                showProjectedCallout={false}
              />
            </View>
          </View>

          <View style={styles.heroFoot}>
            {proj ? (
              <View style={styles.projPill}>
                <TrendingUp size={13} color={BASECAMP.accent} />
                <View>
                  <Text style={styles.projPillValue}>{Math.round(proj.projected)}%</Text>
                  <Text style={styles.projPillLabel}>after next session</Text>
                </View>
              </View>
            ) : <View />}
            {typeof trend === "number" ? (
              <SRStatusPill
                label={trend > 0 ? `+${trend} this week` : trend < 0 ? `${trend} this week` : "No change"}
                tone={trend > 0 ? BASECAMP.accent : trend < 0 ? T.orange : BASECAMP.textDim}
              />
            ) : null}
          </View>
        </SRHeroFrame>

        {/* ── Target mountain ──────────────────────────────────────── */}
        <Animated.View
          entering={reduced ? undefined : FadeInDown.delay(MOTION.stagger).duration(MOTION.enter)}
          style={styles.targetWrap}
        >
          <SRPanel radius={16} onPress={() => router.push("/setup?mode=change")} accessibilityLabel="Change your goal">
            <View style={styles.targetRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.targetLabel}>Target mountain</Text>
                <Text style={styles.targetName} numberOfLines={2}>{summitGoal.mountainName}</Text>
                <View style={styles.targetFacts}>
                  {summitGoal.highestAltitude > 0 && (
                    <View style={styles.targetFact}>
                      <Mountain size={12} color={BASECAMP.textDim} />
                      <Text style={styles.targetFactText}>
                        {Math.round(summitGoal.highestAltitude).toLocaleString()} m
                      </Text>
                    </View>
                  )}
                  {goalDate && (
                    <View style={styles.targetFact}>
                      <Calendar size={12} color={BASECAMP.textDim} />
                      <Text style={styles.targetFactText}>{goalDate}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.targetChange}>
                <Text style={styles.targetChangeText}>Change</Text>
                <ChevronRight size={12} color={BASECAMP.textDim} />
              </View>
            </View>
          </SRPanel>
        </Animated.View>

        {/* ── The four pillars ─────────────────────────────────────── */}
        <PillarGrid pillars={pillars} onOpen={setOpenPillar} />

        {/* ── Next best action ─────────────────────────────────────── */}
        <View style={styles.section}>
          <SRSectionHeader
            title="Next best action"
            icon={<Zap size={13} color={BASECAMP.accent} />}
            action="View plan"
            onAction={() => router.push("/(tabs)/plan")}
          />
          {nextAction ? (
            <SRPanel radius={18} style={{ marginTop: 10 }}>
              <View style={styles.actionBody}>
                <SRStatusPill
                  label={PILLAR_LABELS[nextAction.focusDimension] ?? "Focus"}
                  tone={BASECAMP.accent}
                />
                <Text style={styles.actionTitle} numberOfLines={2}>{nextAction.label}</Text>
                <Text style={styles.actionWhy}>
                  Readiness picked this because {PILLAR_LABELS[nextAction.focusDimension]?.toLowerCase()} is
                  where your score has the most room to move.
                </Text>
              </View>

              <View style={styles.actionFoot}>
                {proj ? (
                  <View style={styles.deltaRow}>
                    <View>
                      <Text style={styles.deltaLabel}>Now</Text>
                      <Text style={styles.deltaValue}>{formatScore(proj.current)}%</Text>
                    </View>
                    <ChevronRight size={14} color={BASECAMP.textFaint} />
                    <View>
                      <Text style={styles.deltaLabel}>After</Text>
                      <Text style={[styles.deltaValue, { color: BASECAMP.accent }]}>
                        {formatScore(proj.projected)}%
                      </Text>
                    </View>
                    <SRStatusPill label={`+${Math.round(proj.delta)}%`} tone={BASECAMP.accent} />
                  </View>
                ) : (
                  <Text style={styles.noProjection} numberOfLines={2}>
                    No projection available for this action yet.
                  </Text>
                )}

                {mission ? (
                  <SRButton
                    compact
                    label="Start session"
                    style={styles.startBtn}
                    onPress={() => router.push({
                      pathname: "/session-detail",
                      params: {
                        weekNum: String(mission.weekNumber),
                        sessionIdx: String(mission.sessionIndex),
                      },
                    })}
                  />
                ) : null}
              </View>
            </SRPanel>
          ) : (
            <SRPanel radius={18} style={{ marginTop: 10 }}>
              <View style={{ padding: 14 }}>
                <SREmptyState
                  compact
                  testID="readiness-no-action"
                  title="No recommendation right now"
                  body="Readiness suggests an action once it has enough evidence to choose between the pillars."
                />
              </View>
            </SRPanel>
          )}
        </View>

        {/* ── Projected readiness ──────────────────────────────────── */}
        {proj ? (
          <View style={styles.section}>
            <SRSubPanel style={styles.projPanel}>
              <View style={styles.projHead}>
                <Text style={styles.projTitle}>PROJECTED READINESS</Text>
                <Text style={styles.projNote}>Not yet earned</Text>
              </View>
              <View style={styles.projRow}>
                <Text style={styles.projFrom}>{formatScore(proj.current)}%</Text>
                <View style={styles.projTrack}>
                  <View style={[styles.projFillSoft, { width: `${proj.projected}%` }]} />
                  <View style={[styles.projFill, { width: `${proj.current}%` }]} />
                </View>
                <Text style={styles.projTo}>{formatScore(proj.projected)}%</Text>
              </View>
              <Text style={styles.projBody}>
                This assumes you complete the recommended session. It is not added to your score
                until the activity is logged.
              </Text>
            </SRSubPanel>
          </View>
        ) : null}

        {/* ── History ──────────────────────────────────────────────── */}
        <ReadinessHistoryChart series={history} period={period} onPeriodChange={setPeriod} />

        {/* ── Recent evidence ──────────────────────────────────────── */}
        <View style={styles.section}>
          <SRSectionHeader
            title="Recent evidence"
            icon={<Clock size={13} color={BASECAMP.accent} />}
            action={evidence.length > 0 ? "View all" : undefined}
            onAction={evidence.length > 0 ? () => router.push("/(tabs)/log") : undefined}
          />
          <Text style={styles.evidenceIntro}>
            The activities Readiness used to calculate your score.
          </Text>
          <SRPanel radius={16} style={{ marginTop: 10 }}>
            {evidence.length === 0 ? (
              <View style={{ padding: 14 }}>
                <SREmptyState
                  compact
                  testID="readiness-no-evidence"
                  title="No qualifying activity yet"
                  body="Recorded activities appear here once Readiness counts them towards your score."
                  action="Record an activity"
                  onAction={() => router.push("/hike-tracking")}
                />
              </View>
            ) : evidence.map((row, i) => (
              <TouchableOpacity
                key={row.id}
                style={[styles.evidenceRow, i > 0 && styles.evidenceDivider]}
                activeOpacity={0.8}
                onPress={() => router.push("/(tabs)/log")}
                accessibilityRole="button"
                accessibilityLabel={`${row.name}${row.date ? `, ${row.date}` : ""}`}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.evidenceTop}>
                    <Text style={styles.evidenceName} numberOfLines={1}>{row.name}</Text>
                    {row.date ? <Text style={styles.evidenceDate}>{row.date}</Text> : null}
                  </View>
                  <View style={styles.evidenceStats}>
                    {row.stats.map(s => (
                      <View key={s.kind} style={styles.evidenceStat}>
                        {s.kind === "ascent" && <Mountain size={11} color={BASECAMP.textFaint} />}
                        {s.kind === "distance" && <Route size={11} color={BASECAMP.textFaint} />}
                        {s.kind === "duration" && <Clock size={11} color={BASECAMP.textFaint} />}
                        <Text style={styles.evidenceStatText}>{s.text}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <ChevronRight size={13} color={BASECAMP.textFaint} />
              </TouchableOpacity>
            ))}
          </SRPanel>
        </View>

        {/* ── What the engine could not use ────────────────────────── */}
        {(result.missing.length > 0 || result.limitations.length > 0) && (
          <View style={styles.section}>
            <SRSectionHeader title="What this score cannot see" />
            <SRSubPanel style={{ marginTop: 10 }}>
              <View style={styles.limitWrap}>
                {result.missing.map(m => (
                  <Text key={m} style={styles.limitText}>• Missing: {m.replace(/_/g, " ")}</Text>
                ))}
                {result.limitations.map(l => (
                  <Text key={l} style={styles.limitText}>• {l}</Text>
                ))}
              </View>
            </SRSubPanel>
          </View>
        )}

        {/* ── Into the plan ────────────────────────────────────────── */}
        <View style={styles.section}>
          <SRPanel
            radius={16}
            onPress={() => router.push("/(tabs)/plan")}
            accessibilityLabel="View your training plan"
          >
            <View style={styles.planBanner}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.planTitle}>Small steps. Bigger summits.</Text>
                <View style={styles.planCta}>
                  <Text style={styles.planCtaText}>VIEW TRAINING PLAN</Text>
                  <ChevronRight size={12} color={BASECAMP.accent} />
                </View>
              </View>
              <ChevronRight size={16} color={BASECAMP.textDim} />
            </View>
          </SRPanel>
        </View>
      </ScrollView>

      <PillarSheet
        pillar={openPillar}
        visible={openPillar !== null}
        onClose={() => setOpenPillar(null)}
        onViewPlan={() => { setOpenPillar(null); router.push("/(tabs)/plan"); }}
        nextActionLabel={nextAction?.label ?? null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BASECAMP.ink },
  emptyWrap: { paddingHorizontal: BASECAMP.gutter, paddingTop: 30 },
  section: { marginTop: 20, paddingHorizontal: BASECAMP.gutter },

  heroBody: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: BASECAMP.gutter, marginTop: 18, gap: 8 },
  heroCopy: { flex: 1, minWidth: 0, paddingTop: 4 },
  heroKicker: {
    fontSize: 9.5, lineHeight: 12, fontFamily: "Inter_600SemiBold",
    letterSpacing: 2.6, color: BASECAMP.textMuted,
  },
  heroTitle: {
    marginTop: 7, fontSize: 24, lineHeight: 28, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: -0.7,
  },
  heroBlurb: {
    marginTop: 9, fontSize: 11.5, lineHeight: 16,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },
  heroGauge: { flexShrink: 0, marginTop: -6, marginRight: -10 },
  heroFoot: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: 10, flexWrap: "wrap", paddingHorizontal: BASECAMP.gutter, marginTop: 14, paddingBottom: 18,
  },
  projPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingLeft: 11, paddingRight: 13, paddingVertical: 7, borderRadius: 999,
    backgroundColor: BASECAMP.glass, borderWidth: 1, borderColor: BASECAMP.glassBorder,
  },
  projPillValue: { fontSize: 13, lineHeight: 16, fontFamily: "Inter_700Bold", color: BASECAMP.text },
  projPillLabel: { fontSize: 9, lineHeight: 12, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },

  targetWrap: { marginTop: -8, paddingHorizontal: BASECAMP.gutter },
  targetRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  targetLabel: { fontSize: 10, lineHeight: 13, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  targetName: {
    marginTop: 2, fontSize: 17, lineHeight: 21, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: -0.4,
  },
  targetFacts: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 5, flexWrap: "wrap" },
  targetFact: { flexDirection: "row", alignItems: "center", gap: 5 },
  targetFactText: { fontSize: 11, lineHeight: 14, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },
  targetChange: {
    flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 4,
    height: 32, paddingLeft: 12, paddingRight: 9, borderRadius: 999,
    backgroundColor: BASECAMP.panelSub, borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },
  targetChangeText: { fontSize: 11, lineHeight: 14, fontFamily: "Inter_600SemiBold", color: BASECAMP.textStrong },

  actionBody: { padding: 14, gap: 7 },
  actionTitle: {
    fontSize: 20, lineHeight: 24, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: -0.5,
  },
  actionWhy: { fontSize: 11.5, lineHeight: 16, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  actionFoot: {
    paddingHorizontal: 14, paddingBottom: 14,
    flexDirection: "row", alignItems: "center", gap: 11, flexWrap: "wrap", rowGap: 10,
  },
  deltaRow: { flexDirection: "row", alignItems: "center", gap: 9, flexShrink: 0 },
  deltaLabel: { fontSize: 9, lineHeight: 12, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  deltaValue: { fontSize: 17, lineHeight: 21, fontFamily: "Inter_700Bold", color: BASECAMP.text },
  noProjection: { flex: 1, minWidth: 140, fontSize: 11, lineHeight: 15, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  startBtn: { flexGrow: 1, flexBasis: 140 },

  projPanel: { padding: 13 },
  projHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  projTitle: {
    fontSize: 10, lineHeight: 13, fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.8, color: BASECAMP.textMuted,
  },
  projNote: { fontSize: 9.5, lineHeight: 12, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  projRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 9 },
  projFrom: { fontSize: 15, lineHeight: 18, fontFamily: "Inter_700Bold", color: BASECAMP.text },
  projTo: { fontSize: 15, lineHeight: 18, fontFamily: "Inter_700Bold", color: BASECAMP.accent },
  projTrack: {
    flex: 1, height: 6, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.10)", overflow: "hidden",
  },
  projFillSoft: {
    position: "absolute", left: 0, top: 0, bottom: 0,
    backgroundColor: "rgba(36,239,164,0.35)", borderRadius: 3,
  },
  projFill: {
    position: "absolute", left: 0, top: 0, bottom: 0,
    backgroundColor: BASECAMP.accent, borderRadius: 3,
  },
  projBody: {
    marginTop: 9, fontSize: 10.5, lineHeight: 14,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },

  evidenceIntro: {
    marginTop: 6, fontSize: 10.5, lineHeight: 14,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },
  evidenceRow: { flexDirection: "row", alignItems: "center", gap: 11, padding: 12, minHeight: HIT.minTarget },
  evidenceDivider: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  evidenceTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  evidenceName: {
    flexShrink: 1, fontSize: 13.5, lineHeight: 17,
    fontFamily: "Inter_700Bold", color: BASECAMP.text, letterSpacing: -0.2,
  },
  evidenceDate: { flexShrink: 0, fontSize: 10, lineHeight: 13, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  evidenceStats: { flexDirection: "row", flexWrap: "wrap", gap: 11, marginTop: 4 },
  evidenceStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  evidenceStatText: { fontSize: 10.5, lineHeight: 14, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },

  limitWrap: { padding: 12, gap: 6 },
  limitText: { fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },

  planBanner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15, minHeight: 84 },
  planTitle: { fontSize: 14.5, lineHeight: 19, fontFamily: "Inter_700Bold", color: BASECAMP.text, letterSpacing: -0.3 },
  planCta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 },
  planCtaText: { fontSize: 11, lineHeight: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 1, color: BASECAMP.accent },
});
