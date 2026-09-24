/**
 * ONBOARDING — the locked six-screen flow.
 *
 * Five screens are a photograph, a headline and one decision. Only screen
 * five asks the user for anything, and it asks after the product has been
 * explained rather than before. The step list lives in
 * `utils/onboardingSteps.ts` and is exactly six long; this screen renders
 * that list and has no way to render a seventh.
 *
 * ── NOTHING HERE IS A NUMBER ──────────────────────────────────────────────
 * Onboarding happens before the user has recorded anything, so any figure on
 * these screens would be either zero or an invention. The Elevation Bank
 * screen explains what the bank is and says yours starts at zero; it does not
 * demonstrate somebody else's total.
 *
 * ── THE COACH ─────────────────────────────────────────────────────────────
 * Screen four states the division of labour in the user's words:
 * SummitReady's deterministic engines calculate; the Coach interprets and
 * communicates. It uses the EXISTING mascot asset — nothing new is drawn —
 * and names what the Coach will never invent.
 *
 * ── ENTITLEMENTS ──────────────────────────────────────────────────────────
 * This flow sells nothing and unlocks nothing. Pro is reached through the
 * existing paywall, with the existing subscription architecture untouched.
 */
import React, { useMemo, useState } from "react";
import {
  Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, useReducedMotion } from "react-native-reanimated";
import {
  Check, ChevronLeft, ChevronRight, Compass, Flag, Mountain as MountainIcon,
  Sparkles, Target, TrendingUp,
} from "lucide-react-native";
import { BASECAMP, HIT, SP, TYPE } from "@/constants/tokens";
import { SREyebrow, SRPanel, SRSubPanel } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { useScreenView } from "@/lib/analytics";
import {
  BANK_NOTE, BANK_POINTS, COACH_BOUNDARY, COACH_DISCLAIMER, COACH_POINTS,
  INTENT_FOOTNOTE, ONBOARDING_INTENTS, ONBOARDING_PATHS, ONBOARDING_STEPS,
  PATHS_FOOTNOTE, READY_POINTS, destinationFor,
  type OnboardingIntent, type OnboardingStepId,
} from "@/utils/onboardingSteps";
import { continueFromOnboarding } from "@/utils/onboardingContinuation";
import { useAuth } from "@clerk/expo";

const MASCOT = require("@/assets/mascot.webp");
const HERO = require("@/assets/images/hero-base-camp.png");

/** Remembers that the flow has been seen. Local only — no schema, no sync. */
export const ONBOARDING_SEEN_KEY = "summitready:onboarding-seen";

export default function OnboardingScreen() {
  useScreenView("onboarding");
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion() ?? false;
  const { setShellMode } = useApp();
  const { isSignedIn } = useAuth();

  const [index, setIndex] = useState(0);
  const [intent, setIntent] = useState<OnboardingIntent["id"] | null>(null);

  const step = ONBOARDING_STEPS[index];
  const total = ONBOARDING_STEPS.length;
  const first = index === 0;
  const last = index === total - 1;
  const destination = useMemo(() => destinationFor(intent), [intent]);

  function back() {
    if (first) { router.back(); return; }
    setIndex(i => Math.max(0, i - 1));
  }

  async function finish(action: "finish" | "skip" = "finish") {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, "1").catch(() => {});
    try {
      await continueFromOnboarding(action, isSignedIn === true, intent, {
        storage: AsyncStorage,
        setShellMode,
        navigateToAuth: route => router.replace(route as any),
        navigateToDestination: route => router.replace(route as any),
      });
    } catch {
      Alert.alert("Unable to continue", "Please try again. Your selected starting point could not be saved.");
    }
  }

  function next() {
    if (last) { void finish("finish"); return; }
    setIndex(i => Math.min(total - 1, i + 1));
  }

  const topPad = Platform.OS === "web" ? 18 : insets.top + 10;
  const Section = reducedMotion ? View : Animated.View;
  const enter = (delay: number) =>
    reducedMotion ? undefined : FadeInDown.delay(delay).duration(380);

  return (
    <View style={styles.screen}>
      {/* A full-bleed backdrop rather than a hero frame: it sits behind the
          whole flow, and the scrim is heavy enough that the headline and the
          controls never fight the photograph. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image source={HERO} style={StyleSheet.absoluteFill} resizeMode="cover" accessible={false} />
        <LinearGradient
          colors={["rgba(5,9,11,0.58)", "rgba(5,9,11,0.86)", BASECAMP.ink]}
          locations={[0, 0.46, 0.92]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* ── Progress ─────────────────────────────────────────────────── */}
      <View style={[styles.progress, { paddingTop: topPad }]}>
        {ONBOARDING_STEPS.map((s, i) => (
          <View
            key={s.id}
            style={[styles.tick, i <= index && styles.tickOn]}
            accessible={i === index}
            accessibilityLabel={i === index ? `Step ${i + 1} of ${total}` : undefined}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: SP.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <Section key={step.id} entering={reducedMotion ? undefined : FadeIn.duration(280)}>
          <Text style={styles.headline} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.6}>
            {step.headline}
          </Text>
          {step.lede ? <Text style={styles.lede}>{step.lede}</Text> : null}
        </Section>

        {step.id === "paths" ? (
          <Section entering={enter(80)} style={styles.stack}>
            {ONBOARDING_PATHS.map(path => (
              <SRPanel key={path.id} radius={18} style={styles.pathCard}>
                <View style={styles.pathBody}>
                  <View style={styles.pathIcon}>
                    {path.id === "training"
                      ? <MountainIcon size={19} color={BASECAMP.accentInk} />
                      : <Flag size={18} color={BASECAMP.accentInk} />}
                  </View>
                  <View style={styles.pathText}>
                    <Text style={styles.pathTitle}>{path.title}</Text>
                    <Text style={styles.pathCopy}>{path.body}</Text>
                  </View>
                </View>
              </SRPanel>
            ))}
            <Text style={styles.footnote}>{PATHS_FOOTNOTE}</Text>
          </Section>
        ) : null}

        {step.id === "bank" ? (
          <Section entering={enter(80)} style={styles.stack}>
            <SRPanel radius={20} style={styles.bankPanel}>
              <View style={styles.bankBody}>
                <View style={styles.bankHead}>
                  <View style={styles.bankMark}>
                    <TrendingUp size={20} color={BASECAMP.accentInk} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <SREyebrow tone={BASECAMP.accent}>ELEVATION BANK</SREyebrow>
                    <Text style={styles.bankLine}>
                      Every metre you climb, banked for life.
                    </Text>
                  </View>
                </View>
                <View style={styles.bankPoints}>
                  {BANK_POINTS.map(point => (
                    <View key={point.key} style={styles.bankPoint}>
                      <View style={styles.bankPointMark}>
                        <Check size={13} color={BASECAMP.accent} strokeWidth={3} />
                      </View>
                      <Text style={styles.bankPointText}>{point.label}</Text>
                    </View>
                  ))}
                </View>
                {/* Said plainly. A new account has banked nothing, and this
                    screen never shows a figure that implies otherwise. */}
                <Text style={styles.bankNote}>{BANK_NOTE}</Text>
              </View>
            </SRPanel>
          </Section>
        ) : null}

        {step.id === "coach" ? (
          <Section entering={enter(80)} style={styles.stack}>
            <View style={styles.mascotRow}>
              {/* The existing mascot asset, shown the way Basecamp shows it
                  (expo-image, contain). It is never redrawn or approximated. */}
              <ExpoImage
                source={MASCOT}
                style={styles.mascot}
                contentFit="contain"
                accessibilityLabel="Your SummitReady AI mountain coach"
              />
            </View>
            {COACH_POINTS.map(point => (
              <SRSubPanel key={point.key} radius={14} style={styles.coachCard}>
                <View style={styles.coachRow}>
                  <Sparkles size={15} color={BASECAMP.accent} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.coachTitle}>{point.title}</Text>
                    <Text style={styles.coachCopy}>{point.body}</Text>
                  </View>
                </View>
              </SRSubPanel>
            ))}
            {/* The division of labour, in the user's words. */}
            <Text style={styles.coachBoundary}>{COACH_BOUNDARY}</Text>
            <Text style={styles.footnote}>{COACH_DISCLAIMER}</Text>
          </Section>
        ) : null}

        {step.id === "intent" ? (
          <Section entering={enter(80)} style={styles.stack}>
            {ONBOARDING_INTENTS.map(option => {
              const on = intent === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setIntent(on ? null : option.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${option.title}. ${option.why}`}
                  style={[styles.intentCard, on && styles.intentCardOn]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.intentTitle}>{option.title}</Text>
                    <Text style={styles.intentWhy}>{option.why}</Text>
                  </View>
                  <View style={[styles.intentMark, on && styles.intentMarkOn]}>
                    {on
                      ? <Check size={13} color={BASECAMP.accentInk} strokeWidth={3} />
                      : <ChevronRight size={14} color={BASECAMP.textDim} />}
                  </View>
                </Pressable>
              );
            })}
            <Text style={styles.footnote}>{INTENT_FOOTNOTE}</Text>
          </Section>
        ) : null}

        {step.id === "ready" ? (
          <Section entering={enter(80)} style={styles.stack}>
            {READY_POINTS.map((point, i) => (
              <View key={point} style={styles.readyRow}>
                <View style={styles.readyMark}>
                  <Check size={12} color={BASECAMP.accent} strokeWidth={3} />
                </View>
                <Text style={styles.readyText}>{point}</Text>
              </View>
            ))}
            {destination ? (
              <SRSubPanel radius={13} style={styles.destination}>
                <View style={styles.destinationRow}>
                  <Target size={14} color={BASECAMP.accent} />
                  <Text style={styles.destinationText}>
                    {"We'll start you in "}
                    <Text style={styles.destinationName}>{destination.destination}</Text>
                    {"."}
                  </Text>
                  <Pressable
                    onPress={() => setIndex(ONBOARDING_STEPS.findIndex(s => s.id === "intent"))}
                    hitSlop={HIT.slop}
                    accessibilityRole="button"
                    accessibilityLabel="Change where you start"
                    style={styles.change}
                  >
                    <Text style={styles.changeText}>Change</Text>
                  </Pressable>
                </View>
              </SRSubPanel>
            ) : null}
          </Section>
        ) : null}
      </ScrollView>

      {/* ── One footer, on every screen ──────────────────────────────── */}
      <View style={[styles.footer, { paddingBottom: Platform.OS === "web" ? 20 : insets.bottom + 12 }]}>
        <View style={styles.footerRow}>
          <Pressable
            onPress={back}
            hitSlop={HIT.slop}
            accessibilityRole="button"
            accessibilityLabel={first ? "Back" : "Previous step"}
            style={styles.backBtn}
          >
            <ChevronLeft size={18} color={BASECAMP.textMuted} />
          </Pressable>

          <Pressable
            onPress={next}
            accessibilityRole="button"
            accessibilityLabel={step.cta ?? "Next"}
            style={styles.nextBtn}
            testID="onboarding-next"
          >
            <Text style={styles.nextText} numberOfLines={1}>{step.cta ?? "Next"}</Text>
            <ChevronRight size={17} color={BASECAMP.accentInk} />
          </Pressable>
        </View>

        {/* Skip has nothing to skip on the first screen (Get started is the
            skip) or the last (Continue already finishes). */}
        {first ? (
          <Text style={styles.signIn}>
            {"Already have an account? "}
            <Text
              style={styles.signInLink}
              onPress={() => router.push("/(auth)/sign-in" as any)}
              accessibilityRole="link"
            >
              Sign in
            </Text>
          </Text>
        ) : last ? null : (
          <Pressable
            onPress={() => void finish("skip")}
            hitSlop={HIT.slop}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            style={styles.skip}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BASECAMP.ink },
  progress: {
    flexDirection: "row", gap: 5,
    paddingHorizontal: BASECAMP.gutter, paddingBottom: SP.md,
  },
  tick: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.16)" },
  tickOn: { backgroundColor: BASECAMP.accent },

  body: { paddingHorizontal: BASECAMP.gutter, paddingTop: SP.lg },
  headline: {
    ...TYPE.hero, fontSize: 40, lineHeight: 42, letterSpacing: -1.2,
    color: BASECAMP.text,
  },
  lede: { marginTop: 12, fontSize: 14, lineHeight: 21, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },
  stack: { marginTop: SP.xl, gap: SP.md },
  footnote: {
    marginTop: SP.xs, fontSize: 11.5, lineHeight: 16,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim, textAlign: "center",
  },

  pathCard: {},
  pathBody: { padding: 14, flexDirection: "row", gap: 12 },
  pathIcon: {
    width: 38, height: 38, borderRadius: 13, flexShrink: 0,
    alignItems: "center", justifyContent: "center", backgroundColor: BASECAMP.accent,
  },
  pathText: { flex: 1, minWidth: 0 },
  pathTitle: { ...TYPE.bodyBold, fontSize: 15.5, lineHeight: 19, color: BASECAMP.text },
  pathCopy: { marginTop: 6, fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },

  bankPanel: { borderColor: BASECAMP.accentLine },
  bankBody: { padding: 16 },
  bankHead: { flexDirection: "row", alignItems: "center", gap: 11 },
  bankMark: {
    width: 42, height: 42, borderRadius: 14, flexShrink: 0,
    alignItems: "center", justifyContent: "center", backgroundColor: BASECAMP.accent,
  },
  bankLine: { marginTop: 4, ...TYPE.bodyBold, fontSize: 14, lineHeight: 19, color: BASECAMP.text },
  bankPoints: { marginTop: 14, gap: 9 },
  bankPoint: { flexDirection: "row", alignItems: "center", gap: 10 },
  bankPointMark: {
    width: 22, height: 22, borderRadius: 11, flexShrink: 0,
    alignItems: "center", justifyContent: "center",
    backgroundColor: BASECAMP.accentDim, borderWidth: 1, borderColor: BASECAMP.accentLine,
  },
  bankPointText: { ...TYPE.small, fontSize: 13, color: BASECAMP.textStrong, flexShrink: 1 },
  bankNote: {
    marginTop: 14, fontSize: 11, lineHeight: 15,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },

  mascotRow: { alignItems: "center" },
  mascot: { width: 140, height: 140 },
  coachCard: {},
  coachRow: { padding: 13, flexDirection: "row", gap: 11 },
  coachTitle: { ...TYPE.bodyBold, fontSize: 14, color: BASECAMP.text },
  coachCopy: { marginTop: 3, fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },
  coachBoundary: {
    marginTop: SP.xs, fontSize: 12, lineHeight: 17,
    fontFamily: "Inter_400Regular", color: BASECAMP.textMuted,
  },

  intentCard: {
    minHeight: 68, borderRadius: 16, padding: 13,
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: BASECAMP.panelSub, borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },
  intentCardOn: { borderColor: BASECAMP.accentLine, backgroundColor: BASECAMP.accentDim },
  intentTitle: { ...TYPE.bodyBold, fontSize: 14, lineHeight: 18, color: BASECAMP.text },
  intentWhy: { marginTop: 3, fontSize: 11.5, lineHeight: 15, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  intentMark: {
    width: 28, height: 28, borderRadius: 14, flexShrink: 0,
    alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.09)",
  },
  intentMarkOn: { backgroundColor: BASECAMP.accent },

  readyRow: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  readyMark: {
    width: 23, height: 23, borderRadius: 12, flexShrink: 0, marginTop: 1,
    alignItems: "center", justifyContent: "center",
    backgroundColor: BASECAMP.accentDim, borderWidth: 1, borderColor: BASECAMP.accentLine,
  },
  readyText: { flex: 1, ...TYPE.bodyBold, fontSize: 14, lineHeight: 20, color: BASECAMP.textStrong },
  destination: { marginTop: SP.sm },
  destinationRow: { padding: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  destinationText: { flex: 1, minWidth: 0, fontSize: 11.5, lineHeight: 16, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },
  destinationName: { fontFamily: "Inter_700Bold", color: BASECAMP.text },
  change: { minHeight: HIT.minTarget, justifyContent: "center", flexShrink: 0 },
  changeText: { ...TYPE.smallBold, color: BASECAMP.accent },

  footer: {
    paddingHorizontal: BASECAMP.gutter, paddingTop: SP.md,
    borderTopWidth: 1, borderTopColor: BASECAMP.navBorder,
    backgroundColor: BASECAMP.navGlass,
  },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: {
    width: 52, minHeight: 52, borderRadius: 16, flexShrink: 0,
    alignItems: "center", justifyContent: "center",
    backgroundColor: BASECAMP.panelSub, borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },
  nextBtn: {
    flex: 1, minHeight: 52, borderRadius: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingHorizontal: SP.md, backgroundColor: BASECAMP.accent,
  },
  nextText: { ...TYPE.bodyBold, fontSize: 16, color: BASECAMP.accentInk, flexShrink: 1 },
  signIn: {
    marginTop: SP.md, textAlign: "center",
    fontSize: 12.5, lineHeight: 17, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted,
  },
  signInLink: { fontFamily: "Inter_700Bold", color: BASECAMP.accent },
  skip: { marginTop: SP.xs, minHeight: HIT.minTarget, alignItems: "center", justifyContent: "center" },
  skipText: { ...TYPE.smallBold, color: BASECAMP.textDim },
});
