import React, { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { useApp, type ExploreHike } from "@/context/AppContext";
import { BASECAMP, TYPE } from "@/constants/tokens";
import { SRPanel, SRSectionHeader } from "@/components/ui";
import { applyRecordedAltitudeReview, privateRecordedHikeBackup, reviewRecordedAltitude } from "@/utils/recordedHikeRecovery";
import { enqueueSyncPending, privateHikeBackupStatus, retrySyncOutbox } from "@/utils/syncOutbox";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api` : "/api";
const actionStyle = { padding: 14, borderRadius: 8, backgroundColor: BASECAMP.accent, marginTop: 10 };

export function RecordedHikeRecoveryPanel({ hike }: { hike: ExploreHike }) {
  const { userId, getToken } = useAuth();
  const { updateExploreHike } = useApp();
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
    const payload = privateRecordedHikeBackup(recording);
    await updateExploreHike(recording.id, { backupRevision: payload.revision, syncState: "queued" });
    if (owner.current !== originalOwner) throw new Error("Your account changed. Reopen the recording.");
    await enqueueSyncPending(originalOwner, {
      id: `private-hike:${recording.id}`, kind: "private-hike",
      url: `${API_BASE}/recorded-hikes`, method: "PUT", body: payload,
    });
    await retrySyncOutbox(originalOwner, () => getToken({ skipCache: true }));
    if (owner.current !== originalOwner) return;
    const status = await privateHikeBackupStatus(originalOwner, recording.id, payload.revision);
    if (status.state !== "synced") throw new Error(status.error ?? "Backup is queued. Your phone copy is safe; retry when connected.");
    await updateExploreHike(recording.id, { backedUpRevision: payload.revision, syncState: "synced" });
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
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel elevation correction" style={actionStyle} onPress={() => setConfirmOpen(false)}><Text style={{ ...TYPE.body, color: BASECAMP.ink }}>Cancel</Text></Pressable>
            <Pressable testID="confirm-altitude-review" accessibilityRole="button" accessibilityLabel="Apply elevation estimate and preserve original recording" style={actionStyle} onPress={() => { setConfirmOpen(false); void run(correct); }}><Text style={{ ...TYPE.body, color: BASECAMP.ink }}>Apply estimate</Text></Pressable>
          </SRPanel>
        </View>
      </Modal>
      <SRSectionHeader title="Private backup" />
      <SRPanel radius={8} style={{ marginTop: 10 }}>
        <Text style={{ ...TYPE.body, color: BASECAMP.text }}>{confirmed ? "This version is backed up privately to your account." : "Saved on this phone. A server backup has not been confirmed for this version."}</Text>
        <Text style={{ ...TYPE.caption, color: BASECAMP.textMuted, marginTop: 6 }}>Backing up does not share your route with other members.</Text>
        {error && <Text accessibilityRole="alert" style={{ ...TYPE.body, color: BASECAMP.textMuted, marginTop: 8 }}>{error}</Text>}
        <Pressable testID="backup-recorded-hike" disabled={busy} accessibilityRole="button" accessibilityLabel="Back up recorded hike privately" onPress={() => { void run(() => backup(hike)); }} style={actionStyle}>
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
