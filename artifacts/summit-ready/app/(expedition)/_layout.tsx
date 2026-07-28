/**
 * Expedition shell — separate tab navigator for the virtual-expedition experience.
 * Rendered as a full replacement for the Training tabs when the user switches
 * to Expeditions via the persistent ModeTogglePill.
 */

import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import {
  Compass, Mountain, Footprints, Map, TrendingUp, User,
} from "lucide-react-native";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "@/constants/theme";
import { ModeTogglePill } from "@/components/ModeTogglePill";

const ACCENT = T.blue;
const DIM    = T.blueDim;

export default function ExpeditionLayout() {
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();

  const tabBarHeight = isWeb ? 80 : 60 + insets.bottom;

  const sharedScreenOptions = {
    tabBarActiveTintColor: ACCENT,
    tabBarInactiveTintColor: T.textDim,
    headerShown: false,
    tabBarStyle: {
      position: "absolute" as const,
      backgroundColor: isIOS ? "transparent" : T.bg,
      borderTopWidth: 1,
      borderTopColor: "rgba(100,160,255,0.10)",
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
        <Tabs.Screen
          name="base-camp"
          options={{
            title: "Base Camp",
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? [s.activeIconWrap, { backgroundColor: DIM }] : s.iconWrap}>
                <Compass size={20} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="mountains"
          options={{
            title: "Mountains",
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? [s.activeIconWrap, { backgroundColor: DIM }] : s.iconWrap}>
                <Mountain size={20} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="track"
          options={{
            title: "Track",
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? [s.activeIconWrap, { backgroundColor: DIM }] : s.iconWrap}>
                <Footprints size={20} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="route"
          options={{
            title: "Route",
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? [s.activeIconWrap, { backgroundColor: DIM }] : s.iconWrap}>
                <Map size={20} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: "Progress",
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? [s.activeIconWrap, { backgroundColor: DIM }] : s.iconWrap}>
                <TrendingUp size={20} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? [s.activeIconWrap, { backgroundColor: DIM }] : s.iconWrap}>
                <User size={20} color={color} />
              </View>
            ),
          }}
        />
      </Tabs>

      {/* Persistent shell toggle — sits in the safe-area zone above all tabs */}
      <ModeTogglePill />
    </>
  );
}

const s = StyleSheet.create({
  iconWrap: { width: 36, height: 26, alignItems: "center", justifyContent: "center" },
  activeIconWrap: {
    width: 44, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 10,
  },
});
