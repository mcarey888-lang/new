import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import {
  Home, Calendar, User, Trophy, Mountain,
  Footprints,
} from "lucide-react-native";
import React, { useEffect } from "react";
import { Alert, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { ModeTogglePill } from "@/components/ModeTogglePill";

// ── Single unified tab layout for ALL users ───────────────────────────────────
// Virtual mode no longer swaps out the entire nav — it adds one "Virtual" tab
// alongside the existing expedition tabs.  The old v-home / v-mountain /
// v-hills / v-progress screens are kept as files but hidden via href:null.

export default function TabLayout() {
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();
  const { scoreStagnation, clearScoreStagnation } = useApp();

  // Show "why didn't my score improve?" popup whenever a session or hike
  // is logged and the readiness score stays the same or drops.
  useEffect(() => {
    if (!scoreStagnation) return;
    Alert.alert(
      scoreStagnation.title,
      `${scoreStagnation.body}\n\n💡 ${scoreStagnation.tip}`,
      [{ text: "Got it", onPress: clearScoreStagnation, style: "default" }],
      { cancelable: true, onDismiss: clearScoreStagnation },
    );
  }, [scoreStagnation, clearScoreStagnation]);

  const tabBarHeight = isWeb ? 80 : 60 + insets.bottom;

  const sharedScreenOptions = {
    tabBarActiveTintColor: T.green,
    tabBarInactiveTintColor: T.textDim,
    headerShown: false,
    tabBarStyle: {
      position: "absolute" as const,
      backgroundColor: isIOS ? "transparent" : T.bg,
      borderTopWidth: 1,
      borderTopColor: "rgba(255,255,255,0.06)",
      elevation: 0,
      height: tabBarHeight,
      paddingBottom: isWeb ? 12 : insets.bottom,
    },
    tabBarBackground: () =>
      isIOS ? (
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: T.bg }]} />
      ),
    tabBarLabelStyle: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      marginBottom: isWeb ? 0 : 2,
    },
  };

  return (
    <>
    <Tabs screenOptions={sharedScreenOptions}>
      {/* ── Expedition / core tabs ───────────────────────────────────────── */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIconWrap, { backgroundColor: T.greenDim }] : styles.iconWrap}>
              <Home size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: "Plan",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIconWrap, { backgroundColor: T.greenDim }] : styles.iconWrap}>
              <Calendar size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="challenges"
        options={{
          title: "Challenges",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIconWrap, { backgroundColor: T.orangeDim }] : styles.iconWrap}>
              <Trophy size={20} color={color} />
            </View>
          ),
          tabBarActiveTintColor: T.orange,
        }}
      />
      <Tabs.Screen
        name="trails"
        options={{
          title: "Track",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIconWrap, { backgroundColor: T.greenDim }] : styles.iconWrap}>
              <Footprints size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="hills"
        options={{
          title: "My Hills",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIconWrap, { backgroundColor: T.greenDim }] : styles.iconWrap}>
              <Mountain size={20} color={color} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="account"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIconWrap, { backgroundColor: T.blueDim }] : styles.iconWrap}>
              <User size={20} color={color} />
            </View>
          ),
          tabBarActiveTintColor: T.blue,
        }}
      />

      {/* ── Always-hidden utility screens ───────────────────────────────── */}
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="log"     options={{ href: null }} />
      <Tabs.Screen name="hikes"   options={{ href: null }} />

      {/* ── Virtual tab moved to Expedition shell — kept for deep links ──── */}
      <Tabs.Screen name="virtual"    options={{ href: null }} />

      {/* ── Old virtual-mode-specific screens (kept, hidden from nav) ────── */}
      <Tabs.Screen name="v-home"     options={{ href: null }} />
      <Tabs.Screen name="v-mountain" options={{ href: null }} />
      <Tabs.Screen name="v-hills"    options={{ href: null }} />
      <Tabs.Screen name="v-progress" options={{ href: null }} />
    </Tabs>

    {/* Persistent shell toggle — sits in the safe-area zone above all tabs */}
    <ModeTogglePill />
    </>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 36, height: 26, alignItems: "center", justifyContent: "center" },
  activeIconWrap: {
    width: 44, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 10,
  },
});
