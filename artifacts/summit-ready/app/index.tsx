import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const { width, height } = Dimensions.get("window");

export default function LandingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { summitGoal, isLoading } = useApp();

  useEffect(() => {
    if (!isLoading && summitGoal) {
      router.replace("/(tabs)/dashboard");
    }
  }, [isLoading, summitGoal]);

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <Feather name="loader" size={32} color={colors.primary} />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#050C18", "#0B1120", "#0D1A2E"]}
      style={styles.container}
    >
      <View
        style={[
          styles.inner,
          {
            paddingTop: Platform.OS === "web" ? 80 : insets.top + 20,
            paddingBottom: Platform.OS === "web" ? 50 : insets.bottom + 20,
          },
        ]}
      >
        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.topSection}>
          <View style={styles.logoWrap}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.logo}
              resizeMode="cover"
            />
          </View>
          <Text style={[styles.appName, { color: colors.primary }]}>SummitReady</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            Train for any mountain{"\n"}using hills near you
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).duration(600)} style={styles.features}>
          {[
            { icon: "map-pin" as const, text: "Personalised training based on your summit date" },
            { icon: "trending-up" as const, text: "Dynamic plans that adapt from 1 to 52+ weeks" },
            { icon: "activity" as const, text: "Track sessions and watch your readiness grow" },
          ].map((item, i) => (
            <View key={i} style={[styles.featureRow, { borderColor: colors.border }]}>
              <View style={[styles.featureIcon, { backgroundColor: colors.primary + "20" }]}>
                <Feather name={item.icon} size={18} color={colors.primary} />
              </View>
              <Text style={[styles.featureText, { color: colors.secondaryForeground }]}>{item.text}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(500).duration(600)} style={styles.bottom}>
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/setup")}
            activeOpacity={0.85}
          >
            <Feather name="compass" size={20} color="#fff" />
            <Text style={styles.ctaText}>Create my plan</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.demoNote, { color: colors.mutedForeground }]}>
            Demo plan preloaded · No account required
          </Text>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  topSection: {
    alignItems: "center",
    marginTop: 20,
  },
  logoWrap: {
    width: 90,
    height: 90,
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: "#4CAF74",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  logo: {
    width: 90,
    height: 90,
  },
  appName: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 18,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 26,
  },
  features: {
    gap: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "#141E3020",
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  bottom: {
    alignItems: "center",
    gap: 14,
  },
  ctaButton: {
    width: "100%",
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#4CAF74",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  demoNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
