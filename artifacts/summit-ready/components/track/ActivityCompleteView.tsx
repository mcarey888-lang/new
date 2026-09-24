/**
 * ActivityCompleteView — the finished state of a recorded activity.
 *
 * EXTRACTED, NOT REDESIGNED. The markup is exactly what `app/hike-tracking.tsx`
 * rendered; pulling it into its own component makes the screen renderable and
 * guardable on its own, and changes nothing about the recorder, the canonical
 * activity, the save path or the sync path — all of those stay in the screen
 * and arrive here as props and callbacks.
 *
 * EVERY CONSEQUENCE COMES FROM `CompletionPresentation`. This component owns no
 * data source: it does not query the Elevation Bank, does not evaluate
 * Readiness, does not read expedition state and does not decide what counts.
 * It renders the rows the presentation already decided, and where a system
 * reported nothing it says so rather than filling the gap. Readiness in
 * particular is always PENDING here, because the engine re-evaluates from the
 * saved activity rather than at the moment of finishing.
 */
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  Activity, Check, CheckCircle, Mountain, TrendingUp, Trophy, WifiOff,
} from "lucide-react-native";
import { T } from "@/constants/theme";
import { BASECAMP, HIT } from "@/constants/tokens";
import { SRButton, SRPanel, SRSectionHeader, SRSubPanel } from "@/components/ui";
import { ACTIVITY_DETAILS_COPY } from "@/utils/trackPresentation";
import { STATUS_COPY, readinessStatus } from "@/utils/readinessPresentation";
import type { CompletionPresentation } from "@/utils/activityCompletionPresentation";

export interface ActivityCompleteViewProps {
  /** The only source of consequences. Built by the screen, never here. */
  completionPresentation: CompletionPresentation;
  /** The recorded figures, as the recorder measured them. */
  elevGainM: number;
  elevLossM: number;
  distanceKm: number;
  elapsedSecs: number;
  currentAltM: number | null;
  /** The screen's own formatters, passed in so both states format alike. */
  fmtM: (m: number) => string;
  fmtKm: (km: number) => string;
  formatTime: (secs: number) => string;
  /** Training plan weeks, for the add-to-plan toggle. */
  trainingPlan?: { isCurrentWeek?: boolean }[] | null;
  addToPlan: boolean;
  setAddToPlan: (fn: (v: boolean) => boolean) => void;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

/* One recorded figure. A value the recorder did not capture is an em dash,
   never a zero. */
function RecordStat({ value, label }: { value: string | null; label: string }) {
  return (
    <View style={s.recordCell}>
      <Text
        style={[s.recordValue, value === null && { color: BASECAMP.textDim }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value ?? "\u2014"}
      </Text>
      <Text style={s.recordLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

export function ActivityCompleteView({
  completionPresentation, elevGainM, elevLossM, distanceKm, elapsedSecs, currentAltM,
  fmtM, fmtKm, formatTime, trainingPlan, addToPlan, setAddToPlan, saving, onSave, onDiscard,
}: ActivityCompleteViewProps) {
  return (
          <Animated.View entering={FadeInDown.duration(400)}>
            {/* ── The result ────────────────────────────────────────────
                The headline figure is the one the day actually earned. */}
            <View style={s.doneHead}>
              <View style={s.doneCheck}>
                <CheckCircle size={22} color={BASECAMP.accentInk} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.doneTitle} numberOfLines={2}>Activity complete</Text>
                <Text style={s.doneSub} numberOfLines={2}>{completionPresentation.title}</Text>
              </View>
            </View>
    
            <SRPanel radius={18} style={{ marginTop: 16 }}>
              {/* The moment: what was climbed, on its own lit band, before any
                  of the record. The figure is the recorded ascent — nothing
                  here is rounded up or projected. */}
              <LinearGradient
                colors={["rgba(36,239,164,0.13)", "rgba(36,239,164,0.02)", "transparent"]}
                style={s.rewardGlow}
                pointerEvents="none"
              />
              <View style={s.rewardBlock}>
                <Text
                  style={s.rewardValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {fmtM(elevGainM)}
                </Text>
                <Text style={s.rewardLabel}>ELEVATION GAINED</Text>
                <View style={s.rewardRule} />
              </View>
    
              <View style={s.recordGrid}>
                <RecordStat value={formatTime(elapsedSecs)} label="Duration" />
                <RecordStat value={fmtKm(distanceKm)} label="Distance" />
                <RecordStat value={fmtM(elevLossM)} label="Descended" />
                <RecordStat
                  value={elapsedSecs > 0 && distanceKm > 0
                    ? `${(distanceKm / (elapsedSecs / 3600)).toFixed(1)} km/h`
                    : null}
                  label="Average speed"
                />
                <RecordStat
                  value={currentAltM != null ? fmtM(currentAltM) : null}
                  label="Final altitude"
                />
              </View>
            </SRPanel>
    
            {/* ── What this changed ─────────────────────────────────────
                The SummitReady difference: the real consequences of the
                activity, each one stating only what the owning system has
                actually confirmed. Nothing is anticipated. */}
            <View style={s.consequenceSection}>
              <SRSectionHeader title="What this changed" />
              <SRPanel radius={16} style={{ marginTop: 10 }}>
                {completionPresentation.elevationBank.status !== "not_eligible" && (
                  <View style={s.consequenceRow} testID="completion-elevation-bank">
                    <TrendingUp size={17} color={BASECAMP.accent} />
                    <View style={s.consequenceCopy}>
                      <Text style={s.consequenceEyebrow}>ELEVATION BANK</Text>
                      {completionPresentation.elevationBank.status === "credited" ? (
                        <>
                          <Text style={s.consequenceHead}>
                            +{fmtM(completionPresentation.elevationBank.creditedAscentM)} credited
                          </Text>
                          <Text style={s.consequenceSub}>
                            Lifetime {fmtM(completionPresentation.elevationBank.lifetimeAscentM)}
                            {" · "}
                            {completionPresentation.elevationBank.everestEquivalent.toFixed(1)} Everest equivalent
                          </Text>
                        </>
                      ) : (
                        <Text style={s.consequenceHead}>
                          {completionPresentation.elevationBank.status === "unavailable"
                            ? "Unavailable — your activity is still saved."
                            : "Pending — this activity will be checked when sync is available."}
                        </Text>
                      )}
                      <Text style={s.consequenceNote}>
                        Recorded ascent only — simulated Expedition elevation is separate.
                      </Text>
                    </View>
                  </View>
                )}
    
                {/* Readiness. The completion presentation supplies no readiness
                    result, because Readiness 2.0 re-evaluates from the saved
                    activity rather than at the moment of finishing. So this row
                    states PENDING truthfully — it never shows an increase. */}
                <View style={[s.consequenceRow, s.consequenceDivider]} testID="completion-readiness">
                  <Activity size={17} color={BASECAMP.textMuted} />
                  <View style={s.consequenceCopy}>
                    <Text style={s.consequenceEyebrow}>READINESS</Text>
                    <Text style={s.consequenceHead}>
                      {STATUS_COPY[readinessStatus("available", 0, { processing: true })].label}
                    </Text>
                    <Text style={s.consequenceSub}>
                      Your readiness updates once this activity has been processed.
                    </Text>
                  </View>
                </View>
    
                {completionPresentation.training.status === "linked" && (
                  <View style={[s.consequenceRow, s.consequenceDivider]} testID="completion-training">
                    <CheckCircle size={17} color={BASECAMP.accent} />
                    <View style={s.consequenceCopy}>
                      <Text style={s.consequenceEyebrow}>TRAINING PLAN</Text>
                      <Text style={s.consequenceHead}>Training session linked</Text>
                      <Text style={s.consequenceSub}>
                        Your GPS activity is ready to save to the planned session.
                      </Text>
                    </View>
                  </View>
                )}
    
                {completionPresentation.expedition.status === "simulated" && (
                  <View style={[s.consequenceRow, s.consequenceDivider]} testID="completion-expedition">
                    <Mountain size={17} color={T.blue} />
                    <View style={s.consequenceCopy}>
                      <Text style={s.consequenceEyebrow}>EXPEDITION PROGRESS</Text>
                      <Text style={s.consequenceHead}>
                        {completionPresentation.expedition.stageName}
                      </Text>
                      <Text style={s.consequenceSub}>
                        Simulated stage progress only ·{" "}
                        {Math.round(completionPresentation.expedition.simulatedPercent * 100)}% ·{" "}
                        {completionPresentation.expedition.completedStageCount}/
                        {completionPresentation.expedition.totalStageCount} stages complete
                      </Text>
                      <Text style={s.consequenceSub}>
                        {completionPresentation.expedition.isComplete
                          ? "Summit reached — no next stage."
                          : completionPresentation.expedition.nextStageName
                            ? `Next stage: ${completionPresentation.expedition.nextStageName}`
                            : "Next stage will appear after this activity is confirmed."}
                      </Text>
                    </View>
                  </View>
                )}
    
                {completionPresentation.challengeAchievement.status !== "not_linked" && (
                  <View style={[s.consequenceRow, s.consequenceDivider]} testID="completion-challenge-achievement">
                    <Trophy size={17} color={T.orange} />
                    <View style={s.consequenceCopy}>
                      <Text style={s.consequenceEyebrow}>CHALLENGES &amp; ACHIEVEMENTS</Text>
                      {completionPresentation.challengeAchievement.status === "confirmed" ? (
                        <>
                          {completionPresentation.challengeAchievement.challengeTitles.map((title) => (
                            <Text key={`challenge-${title}`} style={s.consequenceHead}>{title}</Text>
                          ))}
                          {completionPresentation.challengeAchievement.achievementTitles.map((title) => (
                            <Text key={`achievement-${title}`} style={s.consequenceHead}>{title}</Text>
                          ))}
                          {completionPresentation.challengeAchievement.challengeTitles.length === 0 &&
                            completionPresentation.challengeAchievement.achievementTitles.length === 0 && (
                              <Text style={s.consequenceSub}>No new confirmed consequences.</Text>
                            )}
                        </>
                      ) : (
                        <Text style={s.consequenceSub}>
                          {completionPresentation.challengeAchievement.reason}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </SRPanel>
            </View>
    
            {completionPresentation.sync === "saved_locally" && (
              <SRSubPanel style={s.offlineRow} testID="completion-offline">
                <WifiOff size={14} color={T.orange} />
                <Text style={s.offlineText}>
                  Saved on this device — consequences will sync when you are back online.
                </Text>
              </SRSubPanel>
            )}
    
            {trainingPlan && trainingPlan.length > 0 && (
              <SRSubPanel
                style={s.planToggleWrap}
                onPress={() => setAddToPlan(v => !v)}
                accessibilityLabel="Add this activity to your training plan"
              >
                <View style={s.planToggleRow}>
                  <View style={[s.planToggleCheck, addToPlan && s.planToggleCheckOn]}>
                    {addToPlan && <Check size={13} color={BASECAMP.accentInk} strokeWidth={3} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.planToggleTitle}>Add to training plan</Text>
                    <Text style={s.planToggleSub}>
                      {(() => {
                        const wi = trainingPlan.findIndex(w => w.isCurrentWeek);
                        const wn = wi >= 0 ? wi : 0;
                        return `Log as a session for week ${wn + 1}`;
                      })()}
                    </Text>
                  </View>
                </View>
              </SRSubPanel>
            )}
    
            {/* Activity Details — approved wording. The canonical activity was
                minted at Start and already persisted; this step only adds
                photos, notes and detail to it. It never creates a second one. */}
            <View style={s.detailsIntro}>
              <Text style={s.detailsTitle}>{ACTIVITY_DETAILS_COPY.title}</Text>
              <Text style={s.detailsSubtitle}>{ACTIVITY_DETAILS_COPY.subtitle}</Text>
              <Text style={s.detailsReassurance}>{ACTIVITY_DETAILS_COPY.reassurance}</Text>
            </View>
    
            <SRButton
              label={saving ? "Saving\u2026" : ACTIVITY_DETAILS_COPY.cta}
              onPress={onSave}
              disabled={saving}
              style={{ marginTop: 14 }}
              accessibilityHint="Saves this activity's details to the activity already recorded"
            />
    
            <TouchableOpacity
              style={s.discardBtn}
              onPress={onDiscard}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Discard"
            >
              <Text style={s.discardBtnText}>Discard</Text>
            </TouchableOpacity>
          </Animated.View>
  );
}

const s = StyleSheet.create({
  doneHead: { flexDirection: "row", alignItems: "center", gap: 13, marginTop: 26 },
  doneCheck: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center", backgroundColor: BASECAMP.accent,
  },
  doneTitle: {
    fontSize: 23, lineHeight: 27, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: -0.6,
  },
  doneSub: {
    marginTop: 3, fontSize: 12.5, lineHeight: 17,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },
  rewardGlow: { position: "absolute", left: 0, right: 0, top: 0, height: 150 },
  rewardBlock: { alignItems: "center", paddingTop: 24, paddingHorizontal: 14 },
  rewardRule: {
    marginTop: 18, width: 34, height: 2, borderRadius: 1,
    backgroundColor: "rgba(36,239,164,0.45)",
  },
  rewardValue: {
    fontSize: 46, lineHeight: 52, fontFamily: "Inter_700Bold",
    color: BASECAMP.accent, letterSpacing: -1.6,
  },
  rewardLabel: {
    marginTop: 4, fontSize: 9.5, lineHeight: 12, fontFamily: "Inter_600SemiBold",
    letterSpacing: 2, color: BASECAMP.textMuted,
  },
  recordGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 14, paddingTop: 18, paddingBottom: 16, rowGap: 14,
  },
  recordCell: { flexGrow: 1, flexBasis: "33%", minWidth: 92, paddingRight: 8 },
  recordValue: {
    fontSize: 18, lineHeight: 22, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: -0.4,
  },
  recordLabel: {
    marginTop: 3, fontSize: 10, lineHeight: 13,
    fontFamily: "Inter_500Medium", color: BASECAMP.textDim,
  },
  consequenceSection: { marginTop: 22 },
  consequenceRow: { flexDirection: "row", alignItems: "flex-start", gap: 11, padding: 13 },
  consequenceDivider: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.055)" },
  consequenceCopy: { flex: 1, minWidth: 0 },
  consequenceEyebrow: {
    fontSize: 9, lineHeight: 12, fontFamily: "Inter_700Bold",
    letterSpacing: 1.6, color: BASECAMP.textDim,
  },
  consequenceHead: {
    marginTop: 4, fontSize: 14.5, lineHeight: 19,
    fontFamily: "Inter_700Bold", color: BASECAMP.text,
  },
  consequenceSub: {
    marginTop: 4, fontSize: 11.5, lineHeight: 16,
    fontFamily: "Inter_400Regular", color: BASECAMP.textMuted,
  },
  consequenceNote: {
    marginTop: 5, fontSize: 10.5, lineHeight: 14,
    fontFamily: "Inter_400Regular", color: BASECAMP.textFaint,
  },
  offlineRow: { flexDirection: "row", alignItems: "center", gap: 9, padding: 12, marginTop: 14 },
  offlineText: { flex: 1, fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular", color: T.orange },
  planToggleWrap: { marginTop: 14 },
  planToggleRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, minHeight: HIT.minTarget },
  planToggleCheck: {
    width: 22, height: 22, borderRadius: 7,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: BASECAMP.textFaint,
  },
  planToggleCheckOn: { backgroundColor: BASECAMP.accent, borderColor: BASECAMP.accent },
  planToggleTitle: { fontSize: 13.5, lineHeight: 18, fontFamily: "Inter_600SemiBold", color: BASECAMP.text },
  planToggleSub: {
    marginTop: 2, fontSize: 11, lineHeight: 15,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },
  detailsIntro: { marginTop: 24, gap: 5 },
  detailsTitle: { fontSize: 18, lineHeight: 23, fontFamily: "Inter_700Bold", color: BASECAMP.text },
  detailsSubtitle: { fontSize: 12.5, lineHeight: 18, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },
  detailsReassurance: { fontSize: 11, lineHeight: 15, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  discardBtn: { paddingVertical: 15, alignItems: "center", minHeight: HIT.minTarget },
  discardBtnText: { fontSize: 13.5, lineHeight: 18, fontFamily: "Inter_500Medium", color: BASECAMP.textDim },
});
