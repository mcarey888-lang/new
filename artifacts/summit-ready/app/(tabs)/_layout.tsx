import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Home, Calendar, PenLine, Footprints, User, Map, Trophy, Mountain } from "lucide-react-native";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "@/constants/theme";

export default function TabLayout() {
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();

  const tabBarHeight = isWeb ? 80 : 60 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: T.green,
        tabBarInactiveTintColor: T.textDim,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
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
      }}
    >
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
      <Tabs.Screen
        name="explore"
        options={{ href: null }}
      />

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
      <Tabs.Screen
        name="log"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="hikes"
        options={{ href: null }}
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
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 36, height: 26, alignItems: "center", justifyContent: "center" },
  activeIconWrap: {
    width: 44, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 10,
  },
});
