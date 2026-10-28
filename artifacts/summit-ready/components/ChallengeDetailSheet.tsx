/**
 * ChallengeDetailSheet — full-screen modal showing a Signature Expedition's
 * route plan, day-by-day stages, why-selected reasoning, and limitations.
 */

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Linking, Modal, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { ExpoMountainArtworkImage as ExpoImage } from "@/components/MountainArtworkImage";
import { LinearGradient } from "expo-linear-gradient";
import {
  X, Mountain, MapPin, Clock, TrendingUp,
  ChevronDown, ChevronUp, Star, AlertTriangle,
} from "lucide-react-native";
import { router } from "expo-router";
import { useSubscription } from "@/lib/revenuecat";
import { logAnalyticsEvent } from "@/lib/analytics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "@/constants/theme";
import type { ReadinessInput } from "@/utils/readinessV2";
import {
  projectExpeditionReadiness,
  type ExpeditionReadinessRoute,
} from "@/utils/expeditionReadinessProjection";
import { mountainImageUri } from "@/utils/mountainImage";
import { approvedExpeditionArtwork } from "@/utils/expeditionArtwork";
import { signatureChallengeTarget } from "@/utils/signatureExpedition";
import { ExpeditionDetailError, requestExpeditionDetail } from "@/utils/expeditionDetailRequest";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

/** Strip common suffixes added to DB names that clutter the UI */
export function stripSuffix(name: string) {
  return name.replace(/\s+Challenge$/i, "");
}

function diffColor(d: string | null) {
  if (d === "Easy")     return T.green;
  if (d === "Moderate") return T.blue;
  if (d === "Hard")     return T.orange;
  return "#FF4444";
}

interface SigStage {
  approachDistanceKm?: number | null;
  distanceBasis?: "one_way_approach";
  completionPolicy?: "selected_stages";
  approachStart?: string;
  safetyWarning?: string | null;
  evidenceNote?: string | null;
  sources?: string[];
  reference?: { target: string; route: string; ascentM: number; approachDistanceKm: number; comparison: string; sources: string[] };
  stageOrder: number;
  routeKey: string | null;
  routeName: string;
  catalogueMountain?: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    elevationM?: number | null;
  } | null;
  routeIdentityKey?: string | null;
  routeDataStatus?: string | null;
  dataSource?: string | null;
  confidence?: string | null;
  region: string | null;
  distanceKm: number | null;
  ascentM: number | null;
  estimatedHours: number | null;
  difficulty: string | null;
  dnaContribution: string | null;
  whySelected: string | null;
}

export interface SigChallenge {
  selfPaced?: boolean;
  completionPolicy?: "selected_stages";
  reference?: SigStage["reference"];
  challengeId: string;
  challengeName: string;
  targetMountainName: string;
  targetRoute: string | null;
  recommendedDays: number;
  dnaMatchScore: number | null;
  adventureScore: number | null;
  totalAscentM: number | null;
  totalDistanceKm: number | null;
  estimatedHours: number | null;
  difficulty: string | null;
  routeDnaFocus: string | null;
  summary: string | null;
  regions: string | null;
  stages: SigStage[];
  limitations: string[];
  /** AI-generated artwork — present when approved === true */
  heroImage?:      string | null;
  cardImage?:      string | null;
  thumbnailImage?: string | null;
  approved?:       boolean;
}

interface Props {
  challengeId: string | null;
  onClose: () => void;
  /** Called when the user taps "Start this Expedition". Receives the full challenge object. */
  onStart?: (challenge: SigChallenge) => void;
  readinessInput?: ReadinessInput | null;
  readinessEnabled?: boolean;
}

export function ChallengeDetailSheet({
  challengeId,
  onClose,
  onStart,
  readinessInput,
  readinessEnabled = true,
}: Props) {
  const { canAccessExpedition, access } = useSubscription();
  const insets = useSafeAreaInsets();
  const [challenge, setChallenge] = useState<SigChallenge | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [retryIn, setRetryIn] = useState(0);
  useEffect(() => {
    if (retryIn <= 0) return;
    const timer = setTimeout(() => setRetryIn(seconds => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [retryIn]);
  const [stagesExpanded, setStagesExpanded] = useState(true);
  const [limitsExpanded, setLimitsExpanded] = useState(false);
  const [imgError, setImgError]   = useState(false);
  useEffect(() => {
    if (challengeId && !canAccessExpedition(challengeId))
      void logAnalyticsEvent("paid_expedition_preview_viewed", { expedition_id: challengeId, offered_tier: "expeditions" });
  }, [challengeId]);

  useEffect(() => {
    const controller = new AbortController();
    setChallenge(null);
    if (!challengeId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    setRetryIn(0);
    setImgError(false);
    setStagesExpanded(true);
    setLimitsExpanded(false);
    requestExpeditionDetail<SigChallenge>(API_BASE, challengeId, controller.signal)
      .then(detail => { if (!controller.signal.aborted) setChallenge(detail); })
      .catch(e => {
        if (controller.signal.aborted) return;
        setError(e instanceof ExpeditionDetailError ? e.message : "Could not reach the expedition service. Check your connection and try again.");
        setRetryIn(e instanceof ExpeditionDetailError ? e.retryAfterSeconds : 0);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [challengeId, retryAttempt]);

  const dayLabel = (order: number, total: number) => {
    if (total === 1) return "Day 1";
    const days = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    return days[(order - 1) % days.length] ?? `Day ${order}`;
  };

  // Exact approved expedition artwork outranks the inspirational mountain.
  const heroUri = !imgError && challenge
    ? approvedExpeditionArtwork(challenge, "hero", API_BASE)
      || mountainImageUri(challenge.targetMountainName, { width: 800, height: 500 })
    : null;
  const readinessProjection = projectExpeditionReadiness(
    readinessEnabled && access.training ? readinessInput : null,
    challenge?.stages ?? [],
  );
  const localTarget = signatureChallengeTarget(challenge?.stages ?? []);
  const summaryClaimsDifferentTarget = !!challenge && !!localTarget &&
    challenge.totalAscentM != null && Math.round(challenge.totalAscentM) !== Math.round(localTarget.ascentM);

  return (
    <Modal
      visible={!!challengeId}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
    >
      <View style={s.container}>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <View style={s.heroWrap}>
          {heroUri && (
            <ExpoImage
              source={{ uri: heroUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              onError={() => setImgError(true)}
            />
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.25)", "rgba(10,8,20,0.6)", "#0A0814"]}
            style={StyleSheet.absoluteFill}
            locations={[0, 0.6, 1]}
          />

          {/* Close */}
          <TouchableOpacity
            style={[s.closeBtn, { top: (Platform.OS === "ios" ? 16 : insets.top + 8) }]}
            onPress={onClose}
            activeOpacity={0.75}
          >
            <X size={18} color="#fff" />
          </TouchableOpacity>

          {/* Content overlay */}
          <View style={s.heroContent}>
            {challenge && (
              <>
                {/* SIGNATURE badge + difficulty */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <View style={s.sigBadge}>
                    <Text style={s.sigBadgeText}>✦ SIGNATURE EXPEDITION</Text>
                  </View>
                  {challenge.difficulty && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: diffColor(challenge.difficulty) }} />
                      <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.85)" }}>
                        {challenge.difficulty}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Mountain */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 }}>
                  <Mountain size={12} color="rgba(255,255,255,0.5)" />
                  <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)" }}>
                    {challenge.targetMountainName}
                  </Text>
                </View>

                {/* Challenge name */}
                <Text style={s.heroTitle}>{stripSuffix(challenge.challengeName)}</Text>

                {/* Target route */}
                {challenge.targetRoute && (
                  <Text style={s.heroSub}>{challenge.targetRoute}</Text>
                )}
              </>
            )}
          </View>
        </View>

        {/* ── Content ───────────────────────────────────────────────────── */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>

          {loading && (
            <View style={{ paddingVertical: 60, alignItems: "center" }}>
              <ActivityIndicator color={T.purple} size="large" />
            </View>
          )}

          {error && (
            <View style={{ margin: 16, padding: 14, backgroundColor: T.orange + "15", borderRadius: 6, gap: 8 }}>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
              <AlertTriangle size={14} color={T.orange} />
              <Text style={{ flex: 1, fontSize: 13, color: T.textMuted, fontFamily: "Inter_400Regular" }} accessibilityRole="alert">{error}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setRetryAttempt(attempt => attempt + 1)}
                disabled={retryIn > 0}
                accessibilityRole="button"
                accessibilityState={{ disabled: retryIn > 0 }}
                style={{ paddingVertical: 12, paddingHorizontal: 8, opacity: retryIn > 0 ? 0.6 : 1 }}
              >
                <Text style={{ color: T.green, fontWeight: "600" }}>{retryIn > 0 ? `Try again in ${retryIn}s` : "Try again"}</Text>
              </TouchableOpacity>
            </View>
          )}

          {challenge && (
            <>
              {/* ── Stats row ─────────────────────────────────────────────── */}
              <View style={s.statsRow}>
                {challenge.recommendedDays > 0 && (
                  <View style={s.statCell}>
                    <Text style={s.statVal}>{challenge.recommendedDays}</Text>
                    <Text style={s.statLbl}>days</Text>
                  </View>
                )}
                {localTarget && (
                  <View style={s.statCell}>
                    <Text style={s.statVal}>
                      {localTarget.ascentM.toLocaleString()}m
                    </Text>
                    <Text style={s.statLbl}>{challenge.selfPaced ? "Approx. ascent" : "UK ascent"}</Text>
                  </View>
                )}
                {localTarget && (
                  <View style={s.statCell}>
                    <Text style={s.statVal}>{localTarget.distanceKm}km</Text>
                    <Text style={s.statLbl}>{challenge.selfPaced ? "Approach distance" : "UK distance"}</Text>
                  </View>
                )}
                {challenge.adventureScore != null && (
                  <View style={[s.statCell, { borderColor: "rgba(155,127,212,0.3)" }]}>
                    <Text style={[s.statVal, { color: T.purple }]}>{challenge.adventureScore}</Text>
                    <Text style={s.statLbl}>adventure</Text>
                  </View>
                )}
                {challenge.dnaMatchScore != null && (
                  <View style={s.statCell}>
                    <Text style={[s.statVal, { color: T.green }]}>{challenge.dnaMatchScore}</Text>
                    <Text style={s.statLbl}>DNA match</Text>
                  </View>
                )}
              </View>
              <Text style={{ marginHorizontal: 16, marginBottom: 10, fontSize: 12, lineHeight: 18, color: T.textMuted }}>
                {challenge.selfPaced
                  ? "Self-paced · choose stages in any order. Approach distance is one-way to each summit, including pre-summit undulations. Return walking is additional. Your actual GPS/manual activity totals are recorded separately."
                  : `Fixed UK challenge: planned ascent across the listed local stages, based on curated estimates rather than a recorded GPS track. This is not the ascent of ${challenge.targetMountainName}.`}
              </Text>

              {/* Region */}
              {challenge.regions && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 16, marginBottom: 14 }}>
                  <MapPin size={12} color={T.textDim} />
                  <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim }}>{challenge.regions}</Text>
                </View>
              )}

              {/* Summary */}
              {localTarget && (
                <View style={s.card}>
                  <Text style={s.cardLabel}>ABOUT THIS EXPEDITION</Text>
                  <Text style={s.summaryText}>
                    {challenge.selfPaced
                      ? `Complete these ${challenge.stages.length} selected UK summit stages at your own pace. There is no additional international-ascent threshold. Local planning totals: approx. ${localTarget.ascentM.toLocaleString()} m ascent and ${Number(localTarget.distanceKm.toFixed(1))} km approach distance.`
                      : `${challenge.stages.map(stage => stage.routeName).join(" and ")} form this fixed ${challenge.recommendedDays}-day UK challenge. The ${localTarget.ascentM.toLocaleString()} m target is the planned ascent across these stages, not a measurement of the ${challenge.targetMountainName} route.`}
                    {!summaryClaimsDifferentTarget && challenge.summary ? `\n\n${challenge.summary}` : ""}
                  </Text>
                  {challenge.routeDnaFocus && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
                      <Star size={11} color={T.purple} />
                      <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: T.purple }}>{challenge.routeDnaFocus}</Text>
                    </View>
                  )}
                </View>
              )}
              <View style={s.card}>
                <Text style={s.cardLabel}>MOUNTAIN ROUTE INSPIRATION</Text>
                {challenge.reference && (
                  <Text style={s.summaryText}>
                    International reference: approx. {challenge.reference.ascentM.toLocaleString()} m ascent · {challenge.reference.approachDistanceKm} km approach distance.{"\n"}
                    {challenge.reference.comparison}{"\n"}
                    Local walks do not reproduce alpine difficulty, altitude or glaciation. No navigable track is supplied; a summit credit endpoint is not a safe descent plan.
                  </Text>
                )}
                <Text style={s.summaryText}>
                  {challenge.targetMountainName}{challenge.targetRoute ? ` · ${challenge.targetRoute}` : ""}
                </Text>
                {challenge.challengeId === "SIG024" ? (
                  <>
                    <Text style={[s.summaryText, { marginTop: 7 }]}>
                      Example start: Schwarzsee gondola station → Hörnli Hut → Matterhorn summit. The Swiss Alpine Club lists about 700 m of ascent to the hut; the hut (3,260 m) and summit (4,478 m) differ by 1,218 m in altitude. That is roughly 1,900 m before any extra undulations, separate from the UK challenge target. Starting in Zermatt changes the ascent.
                    </Text>
                    <TouchableOpacity accessibilityRole="link" onPress={() => void Linking.openURL("https://www.sac-cas.ch/de/huetten-und-touren/sac-tourenportal/hoernlihuette-2147000136/berg-und-alpinwandern/von-schwarzsee-260")}>
                      <Text style={{ color: T.blue, fontSize: 12, marginTop: 8 }}>Source: Swiss Alpine Club — Schwarzsee to Hörnli Hut ↗</Text>
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityRole="link" onPress={() => void Linking.openURL("https://www.sac-cas.ch/en/huts-and-tours/sac-route-portal/matterhorn-1138/alpinism/from-the-hoernlihuette-via-the-hoernligrat-ne-ridge-1028")}>
                      <Text style={{ color: T.blue, fontSize: 12, marginTop: 6 }}>Source: Swiss Alpine Club — Hörnli Ridge to summit ↗</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={[s.summaryText, { marginTop: 7 }]}>
                    Route ascent is not specified here: the start point and transport choices can change it. No mountain ascent is used as this UK challenge’s target.
                  </Text>
                )}
              </View>

              {/* ── Pre-start readiness impact ─────────────────────────────── */}
              {readinessEnabled && access.training && <View style={s.card}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <TrendingUp size={13} color={T.blue} />
                  <Text style={s.cardLabel}>TRAINING READINESS · PREVIEW</Text>
                </View>
                {readinessProjection.available ? (
                  <>
                    <View style={s.readinessImpactRow}>
                      <Text style={s.readinessImpactValue}>{readinessProjection.before}</Text>
                      <Text style={s.readinessImpactArrow}>→</Text>
                      <Text style={s.readinessImpactValue}>{readinessProjection.after}</Text>
                      <Text style={s.readinessImpactDelta}>
                        {readinessProjection.delta >= 0 ? "+" : ""}{readinessProjection.delta}
                      </Text>
                    </View>
                    <Text style={s.readinessImpactText}>
                      Scenario: complete and record {readinessProjection.routeCount} verified outdoor {readinessProjection.routeCount === 1 ? "route" : "routes"}.
                    </Text>
                    <Text style={s.readinessImpactNote}>{readinessProjection.explanation}</Text>
                  </>
                ) : (
                  <Text style={s.readinessImpactText}>
                    {readinessProjection.reason}
                  </Text>
                )}
              </View>}

              {/* ── Stages ──────────────────────────────────────────────────── */}
              <View style={s.card}>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                  onPress={() => setStagesExpanded(v => !v)}
                  activeOpacity={0.75}
                >
                  <Text style={s.cardLabel}>{challenge.selfPaced ? "SELF-PACED STAGES" : "ROUTE PLAN"} · {challenge.stages.length} {challenge.selfPaced ? "STAGES" : challenge.stages.length === 1 ? "DAY" : "DAYS"}</Text>
                  {stagesExpanded
                    ? <ChevronUp size={14} color={T.textDim} />
                    : <ChevronDown size={14} color={T.textDim} />}
                </TouchableOpacity>

                {stagesExpanded && challenge.stages.map((stage) => (
                  <View key={stage.stageOrder} style={s.stageCard}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                      {/* Day bubble */}
                      <View style={s.dayBubble}>
                        <Text style={s.dayBubbleText} numberOfLines={1}>
                          {challenge.selfPaced ? `${stage.stageOrder}` : dayLabel(stage.stageOrder, challenge.stages.length)}
                        </Text>
                      </View>
                      {/* Info */}
                      <View style={{ flex: 1 }}>
                        <Text style={s.stageName}>
                          {stage.catalogueMountain?.name?.trim() || stage.routeName}
                        </Text>
                        {stage.region && (
                          <Text style={s.stageMeta}>{stage.region}</Text>
                        )}
                        {/* Micro stats */}
                        <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                          {(stage.approachDistanceKm ?? stage.distanceKm) != null && (
                            <View style={s.microStat}>
                              <MapPin size={9} color={T.textDim} />
                              <Text style={s.microStatText}>{stage.approachDistanceKm ?? stage.distanceKm} km{challenge.selfPaced ? " · Approach distance" : ""}</Text>
                            </View>
                          )}
                          {stage.ascentM != null && (
                            <View style={s.microStat}>
                              <TrendingUp size={9} color={T.textDim} />
                              <Text style={s.microStatText}>{stage.ascentM} m{challenge.selfPaced ? " · Approx. ascent" : ""}</Text>
                            </View>
                          )}
                          {stage.estimatedHours != null && (
                            <View style={s.microStat}>
                              <Clock size={9} color={T.textDim} />
                              <Text style={s.microStatText}>{stage.estimatedHours}h</Text>
                            </View>
                          )}
                          {stage.difficulty && (
                            <View style={[s.microStat, { borderColor: diffColor(stage.difficulty) + "50" }]}>
                              <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: diffColor(stage.difficulty) }} />
                              <Text style={[s.microStatText, { color: diffColor(stage.difficulty) }]}>{stage.difficulty}</Text>
                            </View>
                          )}
                        </View>
                        {/* DNA contribution */}
                        {stage.dnaContribution && (
                          <View style={{ flexDirection: "row", gap: 5, marginTop: 6, alignItems: "flex-start" }}>
                            <Star size={10} color={T.purple} style={{ marginTop: 2 }} />
                            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: T.purple, lineHeight: 16, flex: 1 }}>
                              {stage.dnaContribution}
                            </Text>
                          </View>
                        )}
                        {/* Why selected */}
                        {stage.safetyWarning && <Text style={[s.summaryText, { color: T.orange, marginTop: 8 }]}>{stage.safetyWarning}</Text>}
                        {stage.whySelected && (
                          <Text style={s.whyText}>{stage.whySelected}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {/* ── Limitations ─────────────────────────────────────────────── */}
              {challenge.limitations.length > 0 && (
                <View style={s.card}>
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                    onPress={() => setLimitsExpanded(v => !v)}
                    activeOpacity={0.75}
                  >
                    <Text style={s.cardLabel}>IMPORTANT NOTES</Text>
                    {limitsExpanded
                      ? <ChevronUp size={14} color={T.textDim} />
                      : <ChevronDown size={14} color={T.textDim} />}
                  </TouchableOpacity>
                  {limitsExpanded && challenge.limitations.map((lim, i) => (
                    <View key={i} style={{ flexDirection: "row", gap: 8, marginTop: 8, alignItems: "flex-start" }}>
                      <AlertTriangle size={12} color={T.orange} style={{ marginTop: 2 }} />
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 17, flex: 1 }}>{lim}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        {challenge && (
          <View style={[s.ctaBar, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity
              style={s.ctaBtn}
              activeOpacity={0.85}
              onPress={() => {
                if (!canAccessExpedition(challengeId)) {
                  onClose();
                  router.push({ pathname: "/paywall", params: { tier: "expeditions", trigger: "paid_expedition", expeditionId: challengeId ?? "" } });
                  return;
                }
                if (onStart && challenge) {
                  onStart(challenge);
                } else {
                  router.push("/(tabs)/virtual" as any);
                }
                onClose();
              }}
            >
              <Mountain size={16} color="#fff" />
              <Text style={s.ctaBtnText}>{canAccessExpedition(challengeId) ? "Start this Expedition" : "Unlock Expeditions"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0814" },

  // Hero
  heroWrap: { height: 280, overflow: "hidden" },
  closeBtn: {
    position: "absolute", right: 16,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
    zIndex: 10,
  },
  heroContent: {
    position: "absolute", bottom: 20, left: 16, right: 16,
  },
  sigBadge: {
    backgroundColor: "rgba(155,127,212,0.2)", borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: "rgba(155,127,212,0.4)",
    alignSelf: "flex-start",
  },
  sigBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#9B7FD4", letterSpacing: 1.2 },
  heroTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: "#fff", lineHeight: 31 },
  heroSub:   { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", marginTop: 4 },

  // Stats
  statsRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
    marginHorizontal: 16, marginTop: 16, marginBottom: 10,
  },
  statCell: {
    backgroundColor: "#142236", borderRadius: 5,
    paddingHorizontal: 12, paddingVertical: 8, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  statVal: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  statLbl: { fontSize: 9, fontFamily: "Inter_400Regular", color: "#6B7B8D", marginTop: 2 },

  // Cards
  card: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 8, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 14,
  },
  cardLabel: {
    fontSize: 9, fontFamily: "Inter_700Bold", color: "#6B7B8D",
    letterSpacing: 1.2, marginBottom: 10,
  },
  summaryText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#9BA5B0", lineHeight: 20 },
  readinessImpactRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 7 },
  readinessImpactValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  readinessImpactArrow: { fontSize: 17, fontFamily: "Inter_500Medium", color: "#6B7B8D" },
  readinessImpactDelta: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.green, marginLeft: 2 },
  readinessImpactText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9BA5B0", lineHeight: 18 },
  readinessImpactNote: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#6B7B8D", lineHeight: 15, marginTop: 6 },

  // Stage cards
  stageCard: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
  },
  dayBubble: {
    minWidth: 66, paddingHorizontal: 6, height: 30, borderRadius: 8,
    backgroundColor: "rgba(155,127,212,0.15)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(155,127,212,0.3)",
  },
  dayBubbleText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#9B7FD4" },
  stageName: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff", lineHeight: 19 },
  stageMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7B8D", marginTop: 2 },
  microStat: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#142236", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  microStatText: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#6B7B8D" },
  whyText: {
    fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7B8D",
    lineHeight: 16, marginTop: 6, fontStyle: "italic",
  },

  // CTA
  ctaBar: {
    backgroundColor: "#0A0814",
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 16, paddingTop: 12,
  },
  ctaBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#9B7FD4", borderRadius: 7, paddingVertical: 15,
  },
  ctaBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
});
