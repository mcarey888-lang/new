import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import {
  Home, Calendar, User, Map, Trophy, Mountain,
  Footprints, Compass, TrendingUp, MapPin,
} from "lucide-react-native";
import React, { useEffect } from "react";
import { Alert, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "@/constants/theme";
import { useApp } from "@/context/AppContext";

// ── All tab-screen names in the (tabs) directory ─────────────────────────────
// Every file must be listed in BOTH tab sets (visible or hidden via href:null)
// so Expo Router doesn't emit "unmatched route" warnings.

const EXPEDITION_ONLY = ["plan", "challenges", "trails", "hills"] as const;
const VIRTUAL_ONLY    = ["v-home", "v-mountain", "v-hills", "v-progress"] as const;
const SHARED          = ["dashboard", "account", "explore", "log", "hikes"] as const;

export default function TabLayout() {
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();
  const { scoreStagnation, clearScoreStagnation, summitGoal } = useApp();
  const isVirtual = summitGoal?.mode === "virtual";

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

  // ── Virtual mode tabs ──────────────────────────────────────────────────────
  if (isVirtual) {
    return (
      <Tabs key="virtual" screenOptions={sharedScreenOptions}>
        {/* ── Virtual-specific tabs ── */}
        <Tabs.Screen
          name="v-home"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? [styles.activeIconWrap, { backgroundColor: T.blueDim }] : styles.iconWrap}>
                <Home size={20} color={color} />
              </View>
            ),
            tabBarActiveTintColor: T.blue,
          }}
        />
        <Tabs.Screen
          name="v-mountain"
          options={{
            title: "My Mountain",
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? [styles.activeIconWrap, { backgroundColor: T.blueDim }] : styles.iconWrap}>
                <Mountain size={20} color={color} />
              </View>
            ),
            tabBarActiveTintColor: T.blue,
          }}
        />
        <Tabs.Screen
          name="v-hills"
          options={{
            title: "Local Hills",
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? [styles.activeIconWrap, { backgroundColor: T.greenDim }] : styles.iconWrap}>
                <Compass size={20} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="v-progress"
          options={{
            title: "My Journey",
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? [styles.activeIconWrap, { backgroundColor: T.purpleDim }] : styles.iconWrap}>
                <TrendingUp size={20} color={color} />
              </View>
            ),
            tabBarActiveTintColor: T.purple,
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

        {/* ── Expedition-only screens hidden in Virtual mode ── */}
        <Tabs.Screen name="dashboard"   options={{ href: null }} />
        <Tabs.Screen name="plan"        options={{ href: null }} />
        <Tabs.Screen name="challenges"  options={{ href: null }} />
        <Tabs.Screen name="trails"      options={{ href: null }} />
        <Tabs.Screen name="hills"       options={{ href: null }} />

        {/* ── Always-hidden screens ── */}
        <Tabs.Screen name="explore"     options={{ href: null }} />
        <Tabs.Screen name="log"         options={{ href: null }} />
        <Tabs.Screen name="hikes"       options={{ href: null }} />
      </Tabs>
    );
  }

  // ── Expedition / Training mode tabs (default) ──────────────────────────────
  return (
    <Tabs key="expedition" screenOptions={sharedScreenOptions}>
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

      {/* Explore tab hidden — its content lives in Home and Hills */}
      <Tabs.Screen name="explore" options={{ href: null }} />

      {/* ── Shared tabs ── */}
      <Tabs.Screen
        name="challenges"
        options={{
          title: "Challenges",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIconWrap, { backgroundColor: T.orangeDim ?? "rgba(245,158,11,0.15)" }] : styles.iconWrap}>
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
      <Tabs.Screen name="log"   options={{ href: null }} />
      <Tabs.Screen name="hikes" options={{ href: null }} />
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

      {/* ── Virtual-only screens hidden in Expedition mode ── */}
      <Tabs.Screen name="v-home"     options={{ href: null }} />
      <Tabs.Screen name="v-mountain" options={{ href: null }} />
      <Tabs.Screen name="v-hills"    options={{ href: null }} />
      <Tabs.Screen name="v-progress" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 36, height: 26, alignItems: "center", justifyContent: "center" },
  activeIconWrap: {
    width: 44, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 10,
  },
});
