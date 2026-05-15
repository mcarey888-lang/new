import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight, Compass, Map, Mountain } from "lucide-react-native";
import React from "react";
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { T } from "@/constants/theme";

export default function ModeSelectScreen() {
  const insets = useSafeAreaInsets();
  const { setAppMode } = useApp();

  async function handleExplore() {
    await setAppMode("explore");
    router.replace("/(tabs)/explore");
  }

  async function handleSummit() {
    await setAppMode("summit");
    router.replace("/questionnaire");
  }

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <View
        style={[
          styles.container,
          {
            paddingTop: Platform.OS === "web" ? 60 : insets.top + 24,
            paddingBottom: Platform.OS === "web" ? 40 : insets.bottom + 28,
          },
        ]}
      >
        <Animated.View entering={FadeInDown.delay(80).duration(700)} style={styles.header}>
          <Image
            source={require("@/assets/images/logo.gif")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.subtitle}>How do you want to use SummitReady?</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(240).duration(700)} style={styles.cards}>
          <TouchableOpacity
            style={[styles.card, { borderColor: "rgba(62,207,117,0.25)" }]}
            onPress={handleExplore}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["rgba(62,207,117,0.10)", "rgba(62,207,117,0.02)"]}
              style={styles.cardGrad}
            >
              <View style={[styles.iconWrap, { backgroundColor: T.greenDim }]}>
                <Map size={26} color={T.green} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>I want to explore</Text>
                <Text style={styles.cardDesc}>
                  Discover local hikes, log your hills, build fitness, and choose a summit goal when you feel ready.
                </Text>
                <View style={styles.pills}>
                  <View style={styles.pill}><Text style={styles.pillText}>🥾  Log hikes</Text></View>
                  <View style={styles.pill}><Text style={styles.pillText}>🏅  Earn badges</Text></View>
                  <View style={styles.pill}><Text style={styles.pillText}>📍  Nearby trails</Text></View>
                </View>
              </View>
              <ChevronRight size={20} color={T.green} style={{ alignSelf: "center", flexShrink: 0 }} />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, { borderColor: "rgba(74,159,245,0.25)" }]}
            onPress={handleSummit}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["rgba(74,159,245,0.10)", "rgba(74,159,245,0.02)"]}
              style={styles.cardGrad}
            >
              <View style={[styles.iconWrap, { backgroundColor: T.blueDim }]}>
                <Compass size={26} color={T.blue} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>I have a summit goal</Text>
                <Text style={styles.cardDesc}>
                  Train with a personalised plan built around your target mountain and summit date.
                </Text>
                <View style={styles.pills}>
                  <View style={styles.pill}><Text style={styles.pillText}>📅  Structured plan</Text></View>
                  <View style={styles.pill}><Text style={styles.pillText}>📈  Readiness score</Text></View>
                  <View style={styles.pill}><Text style={styles.pillText}>⛰️  Hill targets</Text></View>
                </View>
              </View>
              <ChevronRight size={20} color={T.blue} style={{ alignSelf: "center", flexShrink: 0 }} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(480).duration(600)} style={styles.footer}>
          <Mountain size={14} color={T.textDim} />
          <Text style={styles.footerText}>
            You can switch between modes any time from your account.
          </Text>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "space-between",
  },
  header: { alignItems: "center", gap: 10 },
  logo: { width: 300, height: 120 },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  cards: { gap: 14 },
  card: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
  },
  cardGrad: {
    padding: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardBody: { flex: 1, gap: 10 },
  cardTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.text },
  cardDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    lineHeight: 19,
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: T.border,
  },
  pillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  footerText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: T.textDim,
    textAlign: "center",
  },
});
