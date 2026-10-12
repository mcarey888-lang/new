import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, Footprints } from "lucide-react-native";
import { useApp, type ExploreHike } from "@/context/AppContext";
import { useAuth } from "@clerk/expo";
import { listRecordedHikeBackups } from "@workspace/api-client-react";
import { authenticatedJsonHeaders } from "@/utils/authRequest";
import { BASECAMP, TYPE } from "@/constants/tokens";

/** Local completed activities must remain accessible while server sync is down. */
export function CompletedHikesSection() {
  const { exploreHikes, isLoading, logExploreHike } = useApp();
  const { userId, getToken } = useAuth();
  const owner = useRef(userId);
  owner.current = userId;
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  async function restoreBackups() {
    if (!userId) { setRestoreMessage("Sign in to restore your private backups."); return; }
    const originalOwner = userId;
    setRestoring(true); setRestoreMessage(null);
    try {
      const backups: Array<{hikeId:string;snapshot:unknown}> = [];
      let cursor:string|null=null;
      for(let page=0;page<200;page++){
        const response=await fetch(`${process.env.EXPO_PUBLIC_MAP_BASE ?? `https://${process.env.EXPO_PUBLIC_DOMAIN ?? "summitready.uk"}/api`}/recorded-hikes${cursor?`?cursor=${encodeURIComponent(cursor)}`:""}`,
          {headers:authenticatedJsonHeaders(await getToken({skipCache:true}))});
        if(!response.ok)throw new Error("Private backup page could not load");
        const result=await response.json() as {backups:Array<{hikeId:string;snapshot:unknown}>;nextCursor?:string|null};
        if(owner.current!==originalOwner)return;
        backups.push(...result.backups);
        if(!result.nextCursor){cursor=null;break;}
        if(result.nextCursor===cursor)throw new Error("Private backup pagination did not advance");
        cursor=result.nextCursor;
      }
      if(cursor)throw new Error("More than 20,000 hikes require another restore batch");
      let restored = 0;
      for (const item of backups) {
        if (owner.current !== originalOwner) return;
        if (exploreHikes.some(h => h.id === item.hikeId)) continue;
        const snapshot = item.snapshot as unknown as ExploreHike;
        const { id, ...recording } = snapshot;
        await logExploreHike({ ...recording, activityId: recording.activityId ?? id });
        restored++;
      }
      if (owner.current === originalOwner) setRestoreMessage(restored
        ? `${restored} private hike${restored === 1 ? "" : "s"} restored. Existing phone recordings were not replaced.`
        : "No missing hikes among your recent private backups. Existing phone recordings are unchanged.");
    } catch (error) {
      if (owner.current === originalOwner) setRestoreMessage("Private backups could not be loaded. Check your sign-in and connection; your phone recordings are unchanged.");
    } finally { if (owner.current === originalOwner) setRestoring(false); }
  }
  const hikes = useMemo(() => [...exploreHikes].sort((a, b) =>
    b.date.localeCompare(a.date)), [exploreHikes]);
  return (
    <View style={styles.section} testID="you-completed-hikes">
      <Text style={styles.kicker}>YOUR RECORDED ACTIVITIES</Text>
      <Text style={styles.title}>Completed hikes</Text>
      <Text style={styles.message}>Your saved recordings, including hikes waiting to sync. These are private.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Restore missing recorded hikes from private backups" disabled={restoring}
        onPress={() => { void restoreBackups(); }} style={{ paddingVertical: 12 }}>
        <Text style={{ ...TYPE.body, color: BASECAMP.accent }}>{restoring ? "Restoring…" : "Restore missing hikes from backup"}</Text>
      </Pressable>
      {restoreMessage && <Text accessibilityRole="alert" style={styles.message}>{restoreMessage}</Text>}
      {isLoading ? <ActivityIndicator color={BASECAMP.accent} accessibilityLabel="Loading completed hikes" />
        : hikes.length === 0 ? <Text style={styles.message}>Your completed hikes will appear here after you save them.</Text>
        : hikes.map(hike => (
          <Pressable key={hike.id} style={styles.row}
            testID={`you-completed-hike-${hike.id}`}
            accessibilityRole="button" accessibilityLabel={`Open completed hike: ${hike.name}`}
            onPress={() => router.push({ pathname: "/hike-detail", params: { id: hike.id } })}>
            <Footprints size={20} color={BASECAMP.accent} />
            <View style={styles.copy}>
              <Text style={styles.name}>{hike.name}</Text>
              <Text style={styles.meta}>{new Date(hike.date).toLocaleDateString("en-GB")} · {hike.distance.toFixed(2)} km · {Math.round(hike.elevationGain)} m ascent · {hike.timeTaken} min</Text>
              <Text style={styles.meta}>{hike.backupRevision && hike.backedUpRevision === hike.backupRevision ? "Private backup confirmed" : "Saved on this device"}</Text>
            </View>
            <ChevronRight size={18} color={BASECAMP.textMuted} />
          </Pressable>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 20, backgroundColor: BASECAMP.glass, padding: 14, borderRadius: 16 },
  kicker: { ...TYPE.eyebrow, color: BASECAMP.textDim, marginBottom: 7 },
  title: { ...TYPE.title, color: BASECAMP.text, fontSize: 21 },
  message: { ...TYPE.body, color: BASECAMP.textMuted, paddingVertical: 8 },
  row: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderColor: BASECAMP.hairline },
  copy: { flex: 1, minWidth: 0 },
  name: { ...TYPE.body, color: BASECAMP.textStrong, fontFamily: "Inter_600SemiBold" },
  meta: { ...TYPE.caption, color: BASECAMP.textMuted, marginTop: 4 },
});
