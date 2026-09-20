import React from "react";
import { View, Text, TouchableOpacity, Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Compass, Footprints, Mountain, User } from "lucide-react-native";
import { router, useSegments } from "expo-router";
import { BlurView } from "expo-blur";
import { T } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { primaryTabTarget, type PrimaryTab } from "@/utils/navigationTargets";

export function SharedTabBar() {
  const insets = useSafeAreaInsets();
  const { shellMode, activeExpeditionId } = useApp();
  const segments = useSegments();

  const currentRoute = segments[segments.length - 1] || "";

  let activeTab = "";
  if (["dashboard", "base-camp", "v-home"].includes(currentRoute)) activeTab = "home";
  else if (["explore", "hills", "plan"].includes(currentRoute)) activeTab = "explore";
  else if (["track", "trails", "route", "progress", "v-progress"].includes(currentRoute)) activeTab = "track";
  else if (["mountains", "virtual", "v-mountain", "v-hills"].includes(currentRoute)) activeTab = "expeditions";
  else if (["account", "profile"].includes(currentRoute)) activeTab = "you";

  const tabBarHeight = Platform.OS === "web" ? 80 : 60 + insets.bottom;
  const isIOS = Platform.OS === "ios";

  const handlePress = (tab: PrimaryTab) => {
    router.navigate(primaryTabTarget(tab, shellMode, activeExpeditionId) as any);
  };

  const tabs: { id: PrimaryTab; label: string; icon: typeof Home }[] = [
    { id: "home", label: "Basecamp", icon: Home },
    { id: "explore", label: "Explore", icon: Compass },
    { id: "track", label: "Track", icon: Footprints },
    { id: "expeditions", label: "Expeditions", icon: Mountain },
    { id: "you", label: "You", icon: User },
  ];

  return (
    <View style={[styles.container, { height: tabBarHeight, paddingBottom: Platform.OS === "web" ? 12 : insets.bottom }]}>
      {isIOS && <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />}
      {!isIOS && <View style={[StyleSheet.absoluteFill, { backgroundColor: T.bg }]} />}

      <View style={styles.tabsRow}>
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          const isTrack = t.id === "track";
          const Icon = t.icon;
          const activeColor = shellMode === "training" ? T.green : T.blue;
          const activeBg = shellMode === "training" ? T.greenDim : T.blueDim;

          const color = isActive ? activeColor : T.textDim;
          const bgColor = isActive ? activeBg : "transparent";

          return (
            <TouchableOpacity
              key={t.id}
              activeOpacity={0.7}
              onPress={() => handlePress(t.id)}
              style={styles.tabButton}
              accessibilityLabel={`${t.label} tab`}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              {isTrack ? (
                <View style={[styles.trackWrap, { backgroundColor: activeColor }]}>
                  <Icon size={24} color={T.bg} />
                </View>
              ) : (
                <>
                  <View style={[styles.iconWrap, { backgroundColor: bgColor }]}>
                    <Icon size={20} color={color} />
                  </View>
                  <Text style={[styles.label, { color }]}>{t.label}</Text>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    elevation: 0,
  },
  tabsRow: {
    flex: 1,
    flexDirection: "row",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
  },
  trackWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  iconWrap: {
    width: 44,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  }
});
