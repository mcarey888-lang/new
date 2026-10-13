import React, { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { useApp, type ExploreHike } from "@/context/AppContext";
import { BASECAMP, TYPE } from "@/constants/tokens";
import { SRPanel, SRSectionHeader } from "@/components/ui";
import { applyRecordedAltitudeReview, reviewRecordedAltitude } from "@/utils/recordedHikeRecovery";
import { privateHikeBackupStatus } from "@/utils/syncOutbox";

const actionStyle = { padding: 14, borderRadius: 8, backgroundColor: BASECAMP.accent, marginTop: 10 };

export function RecordedHikeRecoveryPanel({ hike }: { hike: ExploreHike }) {
  const { userId } = useAuth();
  const { updateExploreHike, backUpExploreHike } = useApp();
  const owner = useRef(userId);
  owner.current = userId;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const review = reviewRecordedAltitude(hike);

  useEffect(() => {
    let live = true;
    setConfirmed(false);
    setError(null);
    if (userId && hike.backupRevision) {
      void privateHikeBackupStatus(userId, hike.id, hike.backupRevision).then(status => {
        if (live) { setConfirmed(status.state === "synced"); setError(status.error ?? null); }
      }).catch(() => { if (live) setError("Backup status could not be read. Your recording is still on this device."); });
    }
    return () => { live = false; };
  }, [userId, hike.id, hike.backupRevision]);

  async function backup(recording: ExploreHike) {
    const originalOwner = userId;
    if (!originalOwner) throw new Error("Sign in to back up your recording.");
    setConfirmed(false);
    const acknowledged = await backUpExploreHike(recording.id);
    if (owner.current !== originalOwner) return;
    if (!acknowledged) throw new Error("Backup has not been confirmed for the current version. Your phone copy is safe; retry when connected.");
    setConfirmed(true);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await action(); } catch (caught) {
      if (owner.current === userId) setError(caught instanceof Error ? caught.message : "Your phone copy is unchanged. Please retry.");
    } finally { if (owner.current === userId) setBusy(false); }
  }

  async function correct() {
    const reviewed = applyRecordedAltitudeReview(hike, new Date().toISOString());
    const revision = new Date().toISOString();
    await updateExploreHike(hike.id, {
      elevationGain: reviewed.elevationGain, elevationLoss: reviewed.elevationLoss,
      notes: reviewed.notes, elevationCorrection: reviewed.elevationCorrection,
      backupRevision: revision, backedUpRevision: undefined, syncState: "local_only",
    });
    setConfirmed(false);
    // A failed backup does not undo the explicit, durable local review.
    setError("Correction saved on this phone. Back up this version when ready.");
  }

  function confirmCorrection() {
    if (!review.available || busy) return;
    setConfirmOpen(true);
  }

  return (
    <View style={{ marginTop: 18, paddingHorizontal: BASECAMP.gutter }} testID="recorded-hike-recovery">
      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: BASECAMP.ink }}>
          <SRPanel radius={12}>
            <Text accessibilityRole="header" style={{ ...TYPE.title, color: BASECAMP.text }}>Apply filtered GPS estimate?</Text>
            <Text style={{ ...TYPE.body, color: BASECAMP.textMuted, marginTop: 12 }}>Change ascent from {Math.round(hike.elevationGain)} m to {review.available ? review.gain : "—"} m? This is an estimate from saved GPS altitude, not verified elevation. Your original figures and GPS points will be preserved.</Text>
            <Text style={{ ...TYPE.caption, color: BASECAMP.textMuted, marginTop: 10 }}>This reviews the saved device recording and its backup only. Qualified elevation credits and canonical expedition records are not recalculated by this action.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel elevation correction" style={actionStyle} onPress={() => setConfirmOpen(false)}><Text style={{ ...TYPE.body, color: BASECAMP.ink }}>Cancel</Text></Pressable>
            <Pressable testID="confirm-altitude-review" accessibilityRole="button" accessibilityLabel="Apply elevation estimate and preserve original recording" style={actionStyle} onPress={() => { setConfirmOpen(false); void run(correct); }}><Text style={{ ...TYPE.body, color: BASECAMP.ink }}>Apply estimate</Text></Pressable>
          </SRPanel>
        </View>
      </Modal>
      <SRSectionHeader title="Account backup" />
      <SRPanel radius={8} style={{ marginTop: 10 }}>
        <Text style={{ ...TYPE.body, color: BASECAMP.text }}>{confirmed ? "This version is backed up to your account." : "Saved on this phone. A server backup has not been confirmed for this version."}</Text>
        <Text style={{ ...TYPE.caption, color: BASECAMP.textMuted, marginTop: 6 }}>Community access follows this activity’s selected audience. Only me stays private; Public and Followers only become available to that audience after sync.</Text>
        {error && <Text accessibilityRole="alert" style={{ ...TYPE.body, color: BASECAMP.textMuted, marginTop: 8 }}>{error}</Text>}
        <Pressable testID="backup-recorded-hike" disabled={busy} accessibilityRole="button" accessibilityLabel="Back up recorded hike to your account" onPress={() => { void run(() => backup(hike)); }} style={actionStyle}>
          <Text style={{ ...TYPE.body, color: BASECAMP.ink }}>{busy ? "Working…" : confirmed ? "Check backup again" : "Back up / retry"}</Text>
        </Pressable>
      </SRPanel>
      <View style={{ marginTop: 18 }}><SRSectionHeader title="Review recorded elevation" /></View>
      <SRPanel radius={8} style={{ marginTop: 10 }}>
        {hike.elevationCorrection ? <>
          <Text style={{ ...TYPE.body, color: BASECAMP.text }}>Filtered GPS estimate applied: {hike.elevationCorrection.filteredGainM} m ascent · {hike.elevationCorrection.filteredLossM} m descent.</Text>
          <Text style={{ ...TYPE.caption, color: BASECAMP.textMuted, marginTop: 8 }}>Original ascent: {hike.elevationCorrection.originalGainM} m. Original figures and raw GPS points are retained. This is not verified elevation.</Text>
        </> : review.available ? <>
          <Text style={{ ...TYPE.body, color: BASECAMP.text }}>Original: {Math.round(hike.elevationGain)} m ascent{"\n"}Filtered GPS estimate: {review.gain} m ascent · {review.loss} m descent.</Text>
          <Text style={{ ...TYPE.caption, color: BASECAMP.textMuted, marginTop: 8 }}>{review.usableFixes} of {review.totalFixes} GPS altitude fixes used. {review.accuracyMissing ? "Older readings do not include vertical accuracy. " : ""}This reduces noise; it is not a verified terrain measurement. Nothing changes until you confirm.</Text>
          <Pressable testID="apply-altitude-review" disabled={busy} accessibilityRole="button" accessibilityLabel="Review and apply filtered GPS elevation estimate" onPress={confirmCorrection} style={actionStyle}>
            <Text style={{ ...TYPE.body, color: BASECAMP.ink }}>Review correction</Text>
          </Pressable>
        </> : <Text style={{ ...TYPE.body, color: BASECAMP.textMuted }}>{review.reason}</Text>}
      </SRPanel>
    </View>
  );
}
