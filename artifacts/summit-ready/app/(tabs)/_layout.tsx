import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { T } from "@/constants/theme";

export default function TabLayout() {
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

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
          height: isWeb ? 80 : 60,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isWeb ? T.bg : T.bg }]} />
          ),
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: "Inter_600SemiBold",
          marginBottom: isWeb ? 12 : 2,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIconWrap, { backgroundColor: T.greenDim }] : styles.iconWrap}>
              <Feather name="home" size={20} color={color} />
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
              <Feather name="calendar" size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: "Log",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIconWrap, { backgroundColor: T.greenDim }] : styles.iconWrap}>
              <Feather name="edit-3" size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="hills"
        options={{
          title: "Hills",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIconWrap, { backgroundColor: T.greenDim }] : styles.iconWrap}>
              <Feather name="triangle" size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIconWrap, { backgroundColor: T.blueDim }] : styles.iconWrap}>
              <Feather name="user" size={20} color={color} />
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
    width: 44,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
});
