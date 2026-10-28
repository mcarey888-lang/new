import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "@/constants/theme";
import type { SigChallenge } from "@/components/ChallengeDetailSheet";
import { approvedExpeditionArtwork } from "@/utils/expeditionArtwork";
import { signatureChallengeTarget } from "@/utils/signatureExpedition";

const IDS = ["SIG024-SUMMITS-1", "SIG054-SUMMITS-1", "SIG055-SUMMITS-1"];
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api` : "/api";

/** Public read-only review of public catalogue data. No account, writes or GPS. */
export default function ExpeditionBatchPreview() {
  const insets = useSafeAreaInsets();
  const [challenges, setChallenges] = useState<SigChallenge[]>([]);
  const [selected, setSelected] = useState(IDS[0]);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    Promise.all(IDS.map(async id => {
      const response = await fetch(`${API_BASE}/sx/challenges/${id}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Catalogue request failed (${response.status})`);
      return (await response.json()).challenge as SigChallenge;
    })).then(setChallenges).catch(err => {
      if (!controller.signal.aborted) setError(err.message);
    });
    return () => controller.abort();
  }, [attempt]);
  const challenge = challenges.find(item => item.challengeId === selected);
  const totals = signatureChallengeTarget(challenge?.stages ?? []);
  const stage = challenge?.stages[stageIndex];
  const card = { backgroundColor: T.card, padding: 16, borderRadius: 12, gap: 10, marginBottom: 14 } as const;
  const body = { color: T.textMuted, fontSize: 14, lineHeight: 21 } as const;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={{ padding: 18, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }}>
      <Text style={{ color: T.text, fontSize: 24, fontWeight: "700", marginBottom: 8 }}>New summit challenges</Text>
      <Text style={[body, { marginBottom: 18 }]}>Read-only preview · live catalogue data. No saved plans or activities are changed here. Start and record stages in the signed-in app.</Text>
      {!challenges.length && !error && <ActivityIndicator color={T.green} />}
      {!!error && <View style={card}><Text style={body}>{error}</Text><TouchableOpacity onPress={() => setAttempt(value => value + 1)}><Text style={{ color: T.green }}>Retry catalogue</Text></TouchableOpacity></View>}
      <View style={{ gap: 8, marginBottom: 16 }}>
        {challenges.map(item => (
          <TouchableOpacity key={item.challengeId} accessibilityRole="button" onPress={() => { setSelected(item.challengeId); setStageIndex(0); }}
            style={{ padding: 13, borderRadius: 9, borderWidth: 1, borderColor: selected === item.challengeId ? T.green : T.border, backgroundColor: T.card }}>
            <Text style={{ color: selected === item.challengeId ? T.green : T.text, fontWeight: "600" }}>{item.challengeName} · {item.stages.length} stages</Text>
          </TouchableOpacity>
        ))}
      </View>
      {challenge && <>
        <Image source={{ uri: approvedExpeditionArtwork(challenge, "hero", API_BASE)! }} accessibilityLabel={`Approved artwork for ${challenge.challengeName}`} style={{ width: "100%", height: 220, borderRadius: 12, marginBottom: 14 }} resizeMode="cover" />
        <View style={card}>
          <Text style={{ color: T.text, fontSize: 22, fontWeight: "700" }}>{challenge.challengeName}</Text>
          <Text style={{ color: T.green }}>Self-paced · {challenge.stages.length} stages · any order</Text>
          <Text style={body}>Local planning totals{"\n"}Approx. ascent: {totals?.ascentM.toLocaleString()} m{"\n"}Approach distance: {Number(totals?.distanceKm.toFixed(1))} km</Text>
          <Text style={body}>International reference: {challenge.reference?.target}{"\n"}{challenge.reference?.route}{"\n"}Approx. ascent: {challenge.reference?.ascentM.toLocaleString()} m{"\n"}Approach distance: {challenge.reference?.approachDistanceKm} km</Text>
          <Text style={body}>{challenge.reference?.comparison}</Text>
          <Text style={body}>Approach distance includes pre-summit undulations, not the post-summit return. Return walking is additional. Actual GPS and manually reported outing totals remain separate.</Text>
          <Text style={body}>Complete all selected stages under the existing verification rules. There is no extra international-ascent threshold.</Text>
        </View>
        <View style={card}>
          <Text style={{ color: T.text, fontSize: 18, fontWeight: "700" }}>Inspect any stage</Text>
          <Text style={body}>Select a summit below. This preview selection does not start or complete a stage.</Text>
          {challenge.stages.map((item, index) => (
            <TouchableOpacity key={item.catalogueMountain?.id ?? item.stageOrder} accessibilityRole="button" onPress={() => setStageIndex(index)}
              style={{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: index === stageIndex ? T.green : T.border }}>
              <Text style={{ color: index === stageIndex ? T.green : T.text }}>{index + 1}. {item.catalogueMountain?.name} · {item.ascentM} m · {item.approachDistanceKm} km</Text>
            </TouchableOpacity>
          ))}
        </View>
        {stage && <View style={card}>
          <Text style={{ color: T.text, fontSize: 20, fontWeight: "700" }}>{stage.catalogueMountain?.name}</Text>
          <Text style={body}>{stage.routeName}{"\n"}Start: {stage.approachStart}</Text>
          <Text style={body}>Approx. ascent: {stage.ascentM} m{"\n"}Approach distance: {stage.approachDistanceKm} km</Text>
          {!!stage.safetyWarning && <Text style={{ color: T.orange, lineHeight: 21 }}>{stage.safetyWarning}</Text>}
          {!!stage.evidenceNote && <Text style={body}>{stage.evidenceNote}</Text>}
          <Text style={[body, { fontSize: 11 }]}>Trusted catalogue ID: {stage.catalogueMountain?.id}{"\n"}Summit coordinates: {stage.catalogueMountain?.latitude}, {stage.catalogueMountain?.longitude}</Text>
        </View>}
        <View style={card}>
          <Text style={{ color: T.text, fontWeight: "700" }}>Planning and safety</Text>
          {challenge.limitations.map((limitation, index) => <Text key={index} style={body}>{limitation}</Text>)}
          {challenge.reference?.sources.map(url => <TouchableOpacity key={url} accessibilityRole="link" onPress={() => void Linking.openURL(url)}><Text style={{ color: T.green, fontSize: 12 }}>{url}</Text></TouchableOpacity>)}
        </View>
      </>}
    </ScrollView>
  );
}
