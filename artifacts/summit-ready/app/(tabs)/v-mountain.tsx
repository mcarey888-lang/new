/**
 * Virtual mode — My Mountain screen
 * Full detail view of the user's dream summit: elevation, terrain, difficulty,
 * AI route notes, and a "Why this summit?" motivational section.
 * Reads from summitGoal.targetMountain (cached by v-home's fetch).
 */

import { Mountain, MapPin, ChevronRight, Compass } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ImageBackground,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";
import { useScreenView } from "@/lib/analytics";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

// ── Helpers ────────────────────────────────────────────────────────────────────

function diffColor(diff: string): string {
  if (diff === "Easy")     return T.green;
  if (diff === "Moderate") return T.blue;
  if (diff === "Hard")     return T.orange;
  return "#FF4444";
}

function altitudeColor(exposure: string): string {
  if (exposure === "None")     return T.green;
  if (exposure === "Moderate") return T.blue;
  if (exposure === "High")     return T.orange;
  return "#FF4444";
}

function motivationalBlurb(difficulty: string, mountainName: string): string {
  switch (difficulty) {
    case "Easy":
      return `${mountainName} is the perfect first summit goal — accessible enough to be achievable, rewarding enough to be life-changing. It's the kind of mountain that turns hikers into peak-baggers.`;
    case "Moderate":
      return `${mountainName} sits in that sweet spot: a real challenge, but absolutely achievable with the right preparation. Many hikers describe it as the summit that redefined what they thought was possible.`;
    case "Hard":
      return `${mountainName} demands serious preparation — sustained elevation, long days, and fitness built over months. That's exactly what makes completing it so powerful. The hills near you are your training ground.`;
    case "Alpine":
      return `${mountainName} is a bucket-list objective for a reason. High altitude, technical terrain, and multi-day commitment separate it from ordinary hiking. The journey to the summit starts with your local hills — and it starts now.`;
    default:
      return `Every summit worth having requires preparation. ${mountainName} is waiting for you — the hills near home are where you'll earn it.`;
  }
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function VirtualMountainScreen() {
  useScreenView("virtual_mountain");
  const insets = useSafeAreaInsets();
  const { summitGoal } = useApp();
  const [imageError, setImageError] = useState(false);

  if (!summitGoal) {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <Mountain size={36} color={T.blue} />
        <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: T.white }}>No summit set</Text>
        <TouchableOpacity onPress={() => router.push("/setup")} style={{ paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, backgroundColor: T.blue }}>
          <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>Choose your summit</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  const target = summitGoal.targetMountain;
  const heroUri = imageError
    ? null
    : `${API_BASE}/mountain-image?name=${encodeURIComponent(summitGoal.mountainName)}`;

  const topInset = Platform.OS === "web" ? 20 : insets.top;
  const botPad   = Platform.OS === "web" ? 120 : insets.bottom + 120;

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: botPad }}>

        {/* ── Hero image ─────────────────────────────────────────────────────── */}
        {heroUri ? (
          <ImageBackground
            source={{ uri: heroUri }}
            style={[s.hero, { height: 280 }]}
            resizeMode="cover"
            onError={() => setImageError(true)}
          >
            <LinearGradient
              colors={["rgba(0,0,0,0.5)", "transparent"]}
              style={[StyleSheet.absoluteFill, { height: "50%" }]}
            />
            <LinearGradient
              colors={["transparent", "rgba(6,10,20,0.94)", T.bg]}
              style={[StyleSheet.absoluteFill, { top: "35%" }]}
            />
            <MountainHeroContent summitGoal={summitGoal} topInset={topInset} />
          </ImageBackground>
        ) : (
          <LinearGradient colors={["#0A1E3C", "#071224", T.bg]} style={[s.hero, { height: 280 }]}>
            <View style={[StyleSheet.absoluteFillObject, { alignItems: "center", justifyContent: "center", marginBottom: 60 }]}>
              <Text style={{ fontSize: 68 }}>🏔️</Text>
            </View>
            <MountainHeroContent summitGoal={summitGoal} topInset={topInset} />
          </LinearGradient>
        )}

        <View style={s.content}>
          {/* ── No cached target yet ─────────────────────────────────────────── */}
          {!target ? (
            <Animated.View entering={FadeInDown.delay(0).duration(400)} style={[s.card, { alignItems: "center", gap: 12, paddingVertical: 28 }]}>
              <Compass size={26} color={T.blue} />
              <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.white }}>
                Loading mountain profile…
              </Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 19 }}>
                Visit the Home tab to load your expedition data.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/v-home")}
                style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 11, backgroundColor: T.blue }}
              >
                <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" }}>Go to Home</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <>
              {/* ── Stats grid ─────────────────────────────────────────────── */}
              <Animated.View entering={FadeInDown.delay(0).duration(400)}>
                <View style={s.statsGrid}>
                  <StatBlock value={`${target.summitElevation}m`} label="Summit elevation" accent={T.blue} />
                  <StatBlock value={`${target.totalElevationGain}m`} label="Total gain" accent={T.green} />
                  <StatBlock value={`${target.totalDistance}km`} label="Distance" accent={T.orange} />
                  <StatBlock value={`${target.estimatedDays} day${target.estimatedDays > 1 ? "s" : ""}`} label="Summit days" accent={T.purple} />
                </View>
              </Animated.View>

              {/* ── Difficulty + altitude badges ────────────────────────────── */}
              <Animated.View entering={FadeInDown.delay(40).duration(400)} style={{ flexDirection: "row", gap: 8 }}>
                <View style={[s.badge, { backgroundColor: diffColor(target.difficulty) + "22", borderColor: diffColor(target.difficulty) + "50" }]}>
                  <Text style={[s.badgeText, { color: diffColor(target.difficulty) }]}>
                    🥾 {target.difficulty}
                  </Text>
                </View>
                {target.altitudeExposure !== "None" && (
                  <View style={[s.badge, { backgroundColor: altitudeColor(target.altitudeExposure) + "22", borderColor: altitudeColor(target.altitudeExposure) + "50" }]}>
                    <Text style={[s.badgeText, { color: altitudeColor(target.altitudeExposure) }]}>
                      ⛰ {target.altitudeExposure} Altitude
                    </Text>
                  </View>
                )}
              </Animated.View>

              {/* ── Route notes ────────────────────────────────────────────── */}
              {target.notes && (
                <Animated.View entering={FadeInDown.delay(80).duration(400)}>
                  <View style={s.card}>
                    <LinearGradient colors={[T.blueDim, "transparent"]} style={StyleSheet.absoluteFill} />
                    <Text style={s.sectionLabel}>THE ROUTE</Text>
                    <Text style={s.notesText}>{target.notes}</Text>
                  </View>
                </Animated.View>
              )}

              {/* ── Why this summit ─────────────────────────────────────────── */}
              <Animated.View entering={FadeInDown.delay(120).duration(400)}>
                <View style={s.card}>
                  <LinearGradient colors={["rgba(62,207,117,0.06)", "transparent"]} style={StyleSheet.absoluteFill} />
                  <Text style={s.sectionLabel}>WHY THIS SUMMIT</Text>
                  <Text style={s.blurbText}>{motivationalBlurb(target.difficulty, target.name)}</Text>
                </View>
              </Animated.View>

              {/* ── Multi-day note ──────────────────────────────────────────── */}
              {target.estimatedDays >= 2 && (
                <Animated.View entering={FadeInDown.delay(160).duration(400)}>
                  <View style={[s.card, { flexDirection: "row", gap: 12, alignItems: "flex-start" }]}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: T.orangeDim, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 16 }}>🏕</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.sectionLabel, { marginBottom: 4 }]}>MULTI-DAY OBJECTIVE</Text>
                      <Text style={s.notesText}>
                        {target.name} typically requires {target.estimatedDays} summit days. Your local hills are paired into a Saturday–Sunday weekend format to replicate this back-to-back demand.
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              )}

              {/* ── CTA to local hills ──────────────────────────────────────── */}
              <Animated.View entering={FadeInDown.delay(200).duration(400)}>
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/v-hills")}
                  activeOpacity={0.8}
                  style={s.hillsCta}
                >
                  <LinearGradient colors={[T.greenDim, "transparent"]} style={StyleSheet.absoluteFill} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: T.white }}>
                      See your equivalent hills
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted, marginTop: 2 }}>
                      Hills near {summitGoal.location} that match {target.name}'s demands
                    </Text>
                  </View>
                  <ChevronRight size={18} color={T.green} />
                </TouchableOpacity>
              </Animated.View>
            </>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MountainHeroContent({ summitGoal, topInset }: { summitGoal: import("@/context/AppContext").SummitGoal; topInset: number }) {
  return (
    <View style={[{ flex: 1, paddingHorizontal: 18, justifyContent: "space-between", paddingBottom: 22 }, { paddingTop: topInset + 10 }]}>
      <View />
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: T.blue, letterSpacing: 2, textTransform: "uppercase",
          textShadowColor: "rgba(0,0,0,0.9)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}>
          YOUR DREAM SUMMIT
        </Text>
        <Text style={{ fontSize: 30, fontFamily: "Inter_700Bold", color: "#fff",
          textShadowColor: "rgba(0,0,0,0.95)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10, lineHeight: 36 }}
          numberOfLines={2}
        >
          {summitGoal.mountainName}
        </Text>
      </View>
    </View>
  );
}

function StatBlock({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <View style={[s.statBlock, { borderColor: accent + "30" }]}>
      <LinearGradient colors={[accent + "14", "transparent"]} style={StyleSheet.absoluteFill} />
      <Text style={[s.statValue, { color: accent }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  hero: { width: "100%", overflow: "hidden" },
  content: { paddingHorizontal: 16, marginTop: 16, gap: 12 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statBlock: {
    flex: 1, minWidth: "44%", backgroundColor: T.card,
    borderRadius: 14, borderWidth: 1,
    padding: 14, overflow: "hidden", alignItems: "center", gap: 4,
  },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" },
  badge: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  card: {
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.border,
    padding: 16, overflow: "hidden", gap: 8,
  },
  sectionLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: T.textDim,
    letterSpacing: 1.5, textTransform: "uppercase",
  },
  notesText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, lineHeight: 20 },
  blurbText: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.text, lineHeight: 22 },
  hillsCta: {
    backgroundColor: T.card, borderRadius: 14,
    borderWidth: 1, borderColor: T.green + "40",
    padding: 16, flexDirection: "row", alignItems: "center", gap: 12, overflow: "hidden",
  },
});
