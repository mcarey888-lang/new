import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AlertCircle, ArrowLeft, CheckCircle, ChevronRight, Lock,
  Mountain, PlusCircle, TrendingUp, Zap,
} from "lucide-react-native";
import { T } from "@/constants/theme";
import { CHALLENGES, DIFF_COLOR, getChallenge } from "@/constants/challenges";
import { useChallenges, type ChallengeActivity } from "@/context/ChallengesContext";
import { useSubscription } from "@/lib/revenuecat";
import { HillPlannerSection } from "@/components/HillPlannerSection";

function ProgressBar({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) {
  return (
    <View style={[pb.track, { height }]}>
      <View style={[pb.fill, { width: `${Math.min(100, pct)}%` as any, backgroundColor: color, height }]} />
    </View>
  );
}
const pb = StyleSheet.create({
  track: { borderRadius: 4, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  fill:  { borderRadius: 4 },
});

function LogModal({
  challengeId,
  visible,
  onClose,
  onSubmit,
}: {
  challengeId: string;
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<ChallengeActivity, "id" | "createdAt">) => void;
}) {
  const [title, setTitle] = useState("");
  const [elev, setElev] = useState("");
  const [dist, setDist] = useState("");
  const [dur, setDur] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setTitle(""); setElev(""); setDist(""); setDur(""); setNotes("");
  }

  function handleSubmit() {
    const elevNum = parseFloat(elev) || 0;
    const distNum = parseFloat(dist) || 0;
    const durNum = parseInt(dur) || 0;
    if (!title.trim() && elevNum === 0) {
      Alert.alert("Add a title or elevation", "Please fill in at least the activity name or elevation gain.");
      return;
    }
    onSubmit({
      challengeId,
      title: title.trim() || "Training session",
      date: new Date().toISOString().split("T")[0],
      elevationGain: elevNum,
      distance: distNum,
      duration: durNum,
      notes: notes.trim(),
    });
    reset();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={lm.container}>
          <View style={lm.handle} />
          <Text style={lm.title}>Log Activity</Text>
          <Text style={lm.subtitle}>This will count toward your challenge and your training progress.</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={lm.fields}>
            <View style={lm.field}>
              <Text style={lm.label}>Activity name</Text>
              <TextInput
                style={lm.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Local hill repeats"
                placeholderTextColor={T.textDim}
              />
            </View>
            <View style={lm.row}>
              <View style={[lm.field, { flex: 1 }]}>
                <Text style={lm.label}>Elevation gain (m)</Text>
                <TextInput
                  style={lm.input}
                  value={elev}
                  onChangeText={setElev}
                  placeholder="450"
                  placeholderTextColor={T.textDim}
                  keyboardType="numeric"
                />
              </View>
              <View style={[lm.field, { flex: 1 }]}>
                <Text style={lm.label}>Distance (km)</Text>
                <TextInput
                  style={lm.input}
                  value={dist}
                  onChangeText={setDist}
                  placeholder="6"
                  placeholderTextColor={T.textDim}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={lm.field}>
              <Text style={lm.label}>Duration (minutes)</Text>
              <TextInput
                style={lm.input}
                value={dur}
                onChangeText={setDur}
                placeholder="90"
                placeholderTextColor={T.textDim}
                keyboardType="numeric"
              />
            </View>
            <View style={lm.field}>
              <Text style={lm.label}>Notes (optional)</Text>
              <TextInput
                style={[lm.input, { height: 80, textAlignVertical: "top" }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="How did it go?"
                placeholderTextColor={T.textDim}
                multiline
              />
            </View>
          </ScrollView>

          <View style={lm.actions}>
            <TouchableOpacity onPress={onClose} style={lm.cancelBtn} activeOpacity={0.7}>
              <Text style={lm.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSubmit} style={lm.submitBtn} activeOpacity={0.8}>
              <TrendingUp size={15} color={T.bg} />
              <Text style={lm.submitText}>Log Activity</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const lm = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg, padding: 20, paddingTop: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: T.border, alignSelf: "center", marginBottom: 20 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: T.text, marginBottom: 4 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, marginBottom: 20, lineHeight: 18 },
  fields: { gap: 14, paddingBottom: 20 },
  field: { gap: 6 },
  row: { flexDirection: "row", gap: 10 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  input: {
    backgroundColor: T.card, borderRadius: 12, borderWidth: 1, borderColor: T.border,
    color: T.text, fontFamily: "Inter_400Regular", fontSize: 14, padding: 12,
  },
  actions: { flexDirection: "row", gap: 10, paddingTop: 12 },
  cancelBtn: {
    flex: 1, backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border,
    paddingVertical: 14, alignItems: "center",
  },
  cancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  submitBtn: {
    flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: T.green, borderRadius: 12, paddingVertical: 14,
  },
  submitText: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.bg },
});

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { activeChallenges, startChallenge, abandonChallenge, logActivity, getProgress, getActiveChallenge } = useChallenges();
  const { isSubscribed } = useSubscription();
  const [logVisible, setLogVisible] = useState(false);

  const c = getChallenge(id ?? "");
  const ac = getActiveChallenge(id ?? "");
  const progress = getProgress(id ?? "");

  const pct = useMemo(() => {
    if (!c) return 0;
    return Math.min(100, Math.round((progress / c.targetValue) * 100));
  }, [c, progress]);

  const milestoneReached = useMemo(() => {
    if (!c) return [];
    return c.milestones.filter(m => pct >= m.pct);
  }, [c, pct]);

  const nextMilestone = useMemo(() => {
    if (!c) return undefined;
    return c.milestones.find(m => pct < m.pct);
  }, [c, pct]);

  if (!c) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: T.textMuted }}>Challenge not found</Text>
      </View>
    );
  }

  const color = c.color;
  const diffColor = DIFF_COLOR[c.difficulty];
  const locked = c.isPremium && !isSubscribed;
  const isActive = ac && !ac.completed;
  const isCompleted = ac?.completed === true;

  function handleStart() {
    if (locked) { router.push("/paywall"); return; }
    startChallenge(c!.id);
  }

  async function handleLog(data: Omit<ChallengeActivity, "id" | "createdAt">) {
    await logActivity(data);
    const newProgress = progress + (data.elevationGain || (c!.metric === "hikes" ? 1 : 0));
    if (newProgress >= c!.targetValue && !isCompleted) {
      router.replace({ pathname: "/challenge-complete", params: { id: c!.id } });
    }
  }

  async function handleAbandon() {
    if (Platform.OS === "web") {
      abandonChallenge(c!.id);
      return;
    }
    Alert.alert("Abandon challenge?", "Your logged activities will still count toward your training.", [
      { text: "Cancel", style: "cancel" },
      { text: "Abandon", style: "destructive", onPress: () => abandonChallenge(c!.id) },
    ]);
  }

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: Platform.OS === "web" ? 60 : insets.top + 16, paddingBottom: 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={12} activeOpacity={0.7}>
          <ArrowLeft size={18} color={T.textMuted} />
          <Text style={s.backText}>Challenges</Text>
        </TouchableOpacity>

        {/* Hero */}
        <Animated.View entering={FadeInDown.delay(40).duration(600)} style={s.hero}>
          <LinearGradient colors={[color + "18", "transparent"]} style={StyleSheet.absoluteFill} />
          <View style={s.heroTop}>
            <View style={[s.heroEmoji, { backgroundColor: color + "22" }]}>
              <Text style={s.heroEmojiText}>{c.emoji}</Text>
            </View>
            <View style={s.heroBadges}>
              <View style={[s.badge, { backgroundColor: diffColor + "22" }]}>
                <Text style={[s.badgeText, { color: diffColor }]}>{c.difficulty}</Text>
              </View>
              {c.isPremium && (
                <View style={[s.badge, { backgroundColor: T.purpleDim }]}>
                  <Zap size={9} color={T.purple} />
                  <Text style={[s.badgeText, { color: T.purple }]}>Pro</Text>
                </View>
              )}
              {isCompleted && (
                <View style={[s.badge, { backgroundColor: T.greenDim }]}>
                  <CheckCircle size={9} color={T.green} />
                  <Text style={[s.badgeText, { color: T.green }]}>Complete</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={s.heroTitle}>{c.title}</Text>
          <Text style={s.heroDesc}>{c.description}</Text>
          <View style={s.heroMeta}>
            <Text style={s.heroMetaText}>
              {c.metric === "elevation" ? `${c.targetValue.toLocaleString()}m total` : `${c.targetValue} sessions`}
            </Text>
            {c.durationDays && <Text style={s.heroMetaDot}>·</Text>}
            {c.durationDays && <Text style={s.heroMetaText}>{c.durationDays} days</Text>}
            <Text style={s.heroMetaDot}>·</Text>
            <Text style={s.heroMetaText}>{c.mountain}</Text>
          </View>
        </Animated.View>

        {/* Progress */}
        {isActive && (
          <Animated.View entering={FadeInDown.delay(80).duration(600)} style={s.progressCard}>
            <LinearGradient colors={[color + "10", "transparent"]} style={StyleSheet.absoluteFill} />
            <View style={s.progressHeader}>
              <Text style={s.progressTitle}>Your progress</Text>
              <Text style={[s.progressPct, { color }]}>{pct}%</Text>
            </View>
            <ProgressBar pct={pct} color={color} height={8} />
            <View style={s.progressStats}>
              <View style={s.progressStat}>
                <Text style={[s.progressStatVal, { color }]}>
                  {c.metric === "elevation" ? `${progress.toLocaleString()}m` : `${ac.activities.length}`}
                </Text>
                <Text style={s.progressStatLbl}>Completed</Text>
              </View>
              <View style={s.progressStatDivider} />
              <View style={s.progressStat}>
                <Text style={s.progressStatVal}>
                  {c.metric === "elevation"
                    ? `${(c.targetValue - progress).toLocaleString()}m`
                    : `${c.targetValue - ac.activities.length}`}
                </Text>
                <Text style={s.progressStatLbl}>Remaining</Text>
              </View>
              <View style={s.progressStatDivider} />
              <View style={s.progressStat}>
                <Text style={s.progressStatVal}>{ac.activities.length}</Text>
                <Text style={s.progressStatLbl}>Activities</Text>
              </View>
              {ac.activities.length > 0 && (
                <>
                  <View style={s.progressStatDivider} />
                  <View style={s.progressStat}>
                    <Text style={s.progressStatVal}>
                      {Math.round(progress / ac.activities.length).toLocaleString()}
                      {c.metric === "elevation" ? "m" : ""}
                    </Text>
                    <Text style={s.progressStatLbl}>Per session</Text>
                  </View>
                </>
              )}
            </View>
            {nextMilestone && (
              <View style={s.nextMilestone}>
                <ChevronRight size={12} color={color} />
                <Text style={[s.nextMilestoneText, { color }]}>
                  Next: {nextMilestone.label} at {nextMilestone.pct}%
                </Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* Hill planner */}
        {!isCompleted && (
          <Animated.View entering={FadeInDown.delay(95).duration(600)}>
            <HillPlannerSection
              targetValue={c.targetValue}
              metric={c.metric}
              color={color}
              currentProgress={progress}
            />
          </Animated.View>
        )}

        {/* Milestones */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={s.card}>
          <Text style={s.cardTitle}>Milestones</Text>
          {c.milestones.map((m) => {
            const reached = pct >= m.pct;
            return (
              <View key={m.pct} style={s.milestoneRow}>
                <View style={[s.milestoneDot, reached && { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.milestoneLabel, reached && { color: T.text }]}>{m.label}</Text>
                </View>
                <Text style={s.milestoneEmoji}>{reached ? m.emoji : "○"}</Text>
                <Text style={[s.milestonePct, reached && { color }]}>{m.pct}%</Text>
              </View>
            );
          })}
        </Animated.View>

        {/* Recent activity */}
        {ac && ac.activities.length > 0 && (
          <Animated.View entering={FadeInDown.delay(120).duration(600)} style={s.card}>
            <Text style={s.cardTitle}>Recent activity</Text>
            {ac.activities.slice(0, 5).map((a) => {
              const dateStr = new Date(a.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
              return (
                <View key={a.id} style={s.activityRow}>
                  <View style={s.activityIcon}>
                    <Mountain size={14} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.activityName}>{a.title}</Text>
                    <View style={s.activityMeta}>
                      <Text style={s.activityDim}>{dateStr}</Text>
                      {a.elevationGain > 0 && <Text style={s.activityDim}>· {a.elevationGain}m gain</Text>}
                      {a.distance > 0 && <Text style={s.activityDim}>· {a.distance}km</Text>}
                      {a.duration > 0 && <Text style={s.activityDim}>· {a.duration}min</Text>}
                    </View>
                    {!!a.notes && <Text style={s.activityNotes}>{a.notes}</Text>}
                  </View>
                </View>
              );
            })}
          </Animated.View>
        )}

        {/* CTA */}
        <Animated.View entering={FadeInDown.delay(140).duration(600)} style={s.ctaArea}>
          {!ac && (
            <TouchableOpacity
              onPress={handleStart}
              style={[s.ctaBtn, locked && s.ctaBtnLocked]}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={locked ? [T.surface, T.surface] : [color, color + "CC"]}
                style={s.ctaBtnInner}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                {locked ? <Lock size={16} color={T.textMuted} /> : <Zap size={16} color={T.bg} />}
                <Text style={[s.ctaBtnText, locked && { color: T.textMuted }]}>
                  {locked ? "Unlock with Pro" : "Start Challenge"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {isActive && (
            <>
              <TouchableOpacity onPress={() => setLogVisible(true)} style={s.ctaBtn} activeOpacity={0.85}>
                <LinearGradient
                  colors={[color, color + "CC"]}
                  style={s.ctaBtnInner}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  <PlusCircle size={16} color={T.bg} />
                  <Text style={s.ctaBtnText}>Log Activity</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAbandon} style={s.abandonBtn} activeOpacity={0.7}>
                <Text style={s.abandonText}>Abandon challenge</Text>
              </TouchableOpacity>
            </>
          )}

          {isCompleted && (
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/challenge-complete", params: { id: c.id } })}
              style={s.ctaBtn}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[T.green, T.green + "CC"]}
                style={s.ctaBtnInner}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <CheckCircle size={16} color={T.bg} />
                <Text style={s.ctaBtnText}>View Results</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScrollView>

      <LogModal
        challengeId={c.id}
        visible={logVisible}
        onClose={() => setLogVisible(false)}
        onSubmit={handleLog}
      />
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 16 },
  back: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted },

  hero: { backgroundColor: T.card, borderRadius: 20, borderWidth: 1, borderColor: T.border, padding: 18, gap: 10, overflow: "hidden" },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroEmoji: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  heroEmojiText: { fontSize: 26 },
  heroBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 4 },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  heroTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.text, lineHeight: 28 },
  heroDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 19 },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  heroMetaText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textDim },
  heroMetaDot: { fontSize: 12, color: T.textDim },

  progressCard: { backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 16, gap: 12, overflow: "hidden" },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },
  progressPct: { fontSize: 20, fontFamily: "Inter_700Bold" },
  progressStats: { flexDirection: "row", justifyContent: "space-around" },
  progressStat: { alignItems: "center", gap: 3 },
  progressStatVal: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.text },
  progressStatLbl: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted },
  progressStatDivider: { width: 1, backgroundColor: T.border },
  nextMilestone: { flexDirection: "row", alignItems: "center", gap: 4 },
  nextMilestoneText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  card: { backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 16, gap: 12 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },

  milestoneRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  milestoneDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.border, flexShrink: 0 },
  milestoneLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },
  milestoneEmoji: { fontSize: 16 },
  milestonePct: { fontSize: 12, fontFamily: "Inter_700Bold", color: T.textDim, minWidth: 32, textAlign: "right" },

  activityRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  activityIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: T.surface, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  activityName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.text },
  activityMeta: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  activityDim: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  activityNotes: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, fontStyle: "italic" },

  ctaArea: { gap: 10 },
  ctaBtn: { borderRadius: 14, overflow: "hidden" },
  ctaBtnLocked: { opacity: 0.8 },
  ctaBtnInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 },
  ctaBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.bg },
  abandonBtn: { alignItems: "center", paddingVertical: 10 },
  abandonText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textDim },
});
