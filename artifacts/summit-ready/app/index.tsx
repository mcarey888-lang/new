import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const { summitGoal, isLoading } = useApp();

  useEffect(() => {
    if (!isLoading && summitGoal) {
      router.replace("/(tabs)/dashboard");
    }
  }, [isLoading, summitGoal]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center" }}>
        <Feather name="loader" size={28} color={T.green} />
      </View>
    );
  }

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      {/* Mountain silhouette decoration */}
      <View style={styles.mountainDeco} pointerEvents="none">
        <LinearGradient
          colors={["transparent", T.green + "08"]}
          style={styles.mountainGlow}
        />
      </View>

      <View
        style={[
          styles.inner,
          {
            paddingTop: Platform.OS === "web" ? 80 : insets.top + 32,
            paddingBottom: Platform.OS === "web" ? 50 : insets.bottom + 32,
          },
        ]}
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.delay(80).duration(700)} style={styles.hero}>
          <Image
            source={require("@/assets/images/logo.gif")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>
            Train for any mountain{"\n"}using hills near you
          </Text>
        </Animated.View>

        {/* Feature pills */}
        <Animated.View entering={FadeInUp.delay(250).duration(600)} style={styles.features}>
          {[
            { icon: "map-pin" as const, text: "Plans built around your summit date" },
            { icon: "trending-up" as const, text: "Progressive elevation targets each week" },
            { icon: "activity" as const, text: "Track sessions & watch readiness grow" },
          ].map((item, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Feather name={item.icon} size={16} color={T.green} />
              </View>
              <Text style={styles.featureText}>{item.text}</Text>
            </View>
          ))}
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={FadeInUp.delay(420).duration(600)} style={styles.cta}>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => router.push("/questionnaire")}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#3ECF75", "#2AB860"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaBtnGrad}
            >
              <Feather name="compass" size={19} color="#fff" />
              <Text style={styles.ctaBtnText}>Create my training plan</Text>
              <Feather name="arrow-right" size={17} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.demoNote}>
            Free to start · No account needed
          </Text>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  mountainDeco: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
    overflow: "hidden",
  },
  mountainGlow: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  hero: {
    alignItems: "center",
    gap: 12,
  },
  logo: { width: 390, height: 156 },
  tagline: {
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    textAlign: "center",
    lineHeight: 26,
  },
  features: { gap: 10 },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: T.greenDim,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: T.text,
    lineHeight: 20,
  },
  cta: { alignItems: "center", gap: 12 },
  ctaBtn: {
    width: "100%",
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: T.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  ctaBtnGrad: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ctaBtnText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  demoNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: T.textDim,
  },
});
