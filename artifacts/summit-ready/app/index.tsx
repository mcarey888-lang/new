import { useAuth } from "@clerk/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Compass, MapPin, TrendingUp, Activity, Loader } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";
import { DevToolsModal } from "@/components/DevToolsModal";
import { DEV_PROFILES, loadDevProfile } from "@/utils/devProfiles";

const DEV_TAPS_REQUIRED = 5;
const DEV_TAP_WINDOW_MS = 2000;

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const { isLoading, reloadApp } = useApp();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();

  const [devModalVisible, setDevModalVisible] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!__DEV__) return;
    if (Platform.OS !== "web") return;
    const params = new URLSearchParams(window.location.search);
    const demoId = params.get("demo");
    if (!demoId) return;
    const profile = DEV_PROFILES.find((p) => p.id === demoId);
    if (!profile) return;
    setDemoLoading(true);
    loadDevProfile(profile).then(() => reloadApp()).catch(() => setDemoLoading(false));
  }, []);

  function handleLogoPress() {
    if (!__DEV__) return;
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);

    if (tapCount.current >= DEV_TAPS_REQUIRED) {
      tapCount.current = 0;
      setDevModalVisible(true);
      return;
    }

    tapTimer.current = setTimeout(() => {
      tapCount.current = 0;
    }, DEV_TAP_WINDOW_MS);
  }

  useEffect(() => {
    if (!authLoaded || isLoading) return;
    if (!isSignedIn) return;
    // Check whether the user was mid-hike when the app was killed.
    // If so, route back to the tracking screen instead of the dashboard.
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("summitready_active_hike_session");
        if (raw) {
          const session = JSON.parse(raw);
          const ageMs = Date.now() - (session.savedAt ?? 0);
          if (ageMs < 24 * 60 * 60 * 1000) {
            // Recent session — send the user back to the hike screen to restore it
            router.replace({
              pathname: "/hike-tracking",
              params: {
                restore: "1",
                ...(session.hillMeta?.sessionKey    && { hillSessionKey:        session.hillMeta.sessionKey }),
                ...(session.hillMeta?.hillName      && { hillName:              session.hillMeta.hillName }),
                ...(session.hillMeta?.targetReps    != null && { targetReps:         String(session.hillMeta.targetReps) }),
                ...(session.hillMeta?.estimatedGainPerRep != null && { estimatedGainPerRep: String(session.hillMeta.estimatedGainPerRep) }),
                ...(session.hillMeta?.estimatedTotalGain  != null && { estimatedTotalGain:  String(session.hillMeta.estimatedTotalGain) }),
              },
            } as any);
            return;
          }
          // Stale session (> 24 h old) — discard and go to dashboard
          await AsyncStorage.removeItem("summitready_active_hike_session");
        }
      } catch { /* ignore — fall through to dashboard */ }
      router.replace("/(tabs)/dashboard");
    })();
  }, [authLoaded, isSignedIn, isLoading]);

  if (isLoading || demoLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center" }}>
        <Loader size={28} color={T.green} />
      </View>
    );
  }

  const features: { icon: LucideIcon; text: string }[] = [
    { icon: MapPin,    text: "Train for any mountain using hills near you" },
    { icon: TrendingUp, text: "Structured plans or freestyle explore mode" },
    { icon: Activity,  text: "Log sessions, earn badges, track progress" },
  ];

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <View style={[styles.mountainDeco, { pointerEvents: "none" }]}>
        <LinearGradient colors={["transparent", T.green + "08"]} style={styles.mountainGlow} />
      </View>

      <View
        style={[
          styles.inner,
          {
            paddingTop: Platform.OS === "web" ? 60 : insets.top + 24,
            paddingBottom: Platform.OS === "web" ? 50 : insets.bottom + 32,
          },
        ]}
      >
        {/* Logo */}
        <Animated.View entering={FadeInDown.delay(80).duration(700)} style={styles.hero}>
          <TouchableOpacity onPress={handleLogoPress} activeOpacity={1}>
            <Image
              source={require("@/assets/images/logo.gif")}
              style={styles.logo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.tagline}>
            Train for any mountain{"\n"}using hills near you
          </Text>
        </Animated.View>

        {/* CTA — sits directly below logo so it's always above the fold */}
        <Animated.View entering={FadeInUp.delay(200).duration(600)} style={styles.cta}>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => router.push("/(auth)/sign-up" as any)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#3ECF75", "#2AB860"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaBtnGrad}
            >
              <Compass size={19} color="#fff" />
              <Text style={styles.ctaBtnText}>Get started — it's free</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/(auth)/sign-in" as any)}
            activeOpacity={0.7}
            style={styles.signInBtn}
          >
            <Text style={styles.signInBtnText}>Sign in</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Feature highlights below CTA */}
        <Animated.View entering={FadeInUp.delay(380).duration(600)} style={styles.features}>
          {features.map((item, i) => {
            const FIcon = item.icon;
            return (
              <View key={i} style={styles.featureRow}>
                <View style={styles.featureIconWrap}>
                  <FIcon size={16} color={T.green} />
                </View>
                <Text style={styles.featureText}>{item.text}</Text>
              </View>
            );
          })}
        </Animated.View>
      </View>

      {__DEV__ && (
        <DevToolsModal
          visible={devModalVisible}
          onClose={() => setDevModalVisible(false)}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  mountainDeco: { position: "absolute", bottom: 0, left: 0, right: 0, height: 300, overflow: "hidden" },
  mountainGlow: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 28, justifyContent: "space-evenly" },
  hero: { alignItems: "center", gap: 12 },
  logo: { width: 390, height: 156 },
  tagline: {
    fontSize: 17, fontFamily: "Inter_400Regular", color: T.textMuted,
    textAlign: "center", lineHeight: 26,
  },
  features: { gap: 10 },
  featureRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 16,
    borderWidth: 1, borderColor: T.border, paddingVertical: 14, paddingHorizontal: 16,
  },
  featureIconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: T.greenDim,
    alignItems: "center", justifyContent: "center",
  },
  featureText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: T.text, lineHeight: 20 },
  cta: { alignItems: "center", gap: 12 },
  ctaBtn: {
    width: "100%", borderRadius: 18, overflow: "hidden",
    shadowColor: T.green, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 10,
  },
  ctaBtnGrad: { height: 58, width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center" },
  ctaBtnText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff", marginLeft: 10, flexShrink: 0 },
  signInLink: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },
  signInBtn: {
    width: "100%", height: 50, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center",
  },
  signInBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: T.text },
});
