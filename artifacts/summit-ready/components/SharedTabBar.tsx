/**
 * SharedTabBar — the app shell's bottom navigation.
 *
 * The visual is the approved one from `summitready-training-basecamp-mockup.html`:
 * a near-black glass bar with a hairline top rule, and an active tab marked by a
 * tinted rounded slot holding a filled accent disc. Inactive tabs are a plain
 * outline glyph. This is a SHARED component, so the treatment now appears on
 * Basecamp, Explore, Track, Expeditions and You alike — which is the point of a
 * shell component, and is intended.
 *
 * NOTHING ABOUT NAVIGATION BEHAVIOUR CHANGES. The tab set, the routes, the
 * active-tab resolution, the expedition/training targets, the safe-area
 * handling and the accessibility roles are exactly as they were; only the
 * drawing is new.
 */
import React from "react";
import { View, Text, TouchableOpacity, Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Compass, Footprints, Mountain, User } from "lucide-react-native";
import { router, useSegments } from "expo-router";
import { BlurView } from "expo-blur";
import { T } from "@/constants/theme";
import { BASECAMP } from "@/constants/tokens";
import { useApp } from "@/context/AppContext";
import { activePrimaryTabForSegments, primaryTabTarget, type PrimaryTab } from "@/utils/navigationTargets";

export function SharedTabBar() {
  const insets = useSafeAreaInsets();
  const { shellMode, activeExpeditionId } = useApp();
  const segments = useSegments();

  const activeTab = activePrimaryTabForSegments(segments);

  const tabBarHeight = Platform.OS === "web" ? 80 : 62 + insets.bottom;
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

  /* The accent still follows the shell mode, as it did before: green in
     training, blue in expedition. Only the training green moves to the
     approved value. */
  const accent = shellMode === "training" ? BASECAMP.accent : T.blue;
  const accentSlot = shellMode === "training" ? BASECAMP.accentDim : T.blueDim;

  return (
    <View
      style={[
        styles.container,
        { height: tabBarHeight, paddingBottom: Platform.OS === "web" ? 12 : insets.bottom },
      ]}
    >
      {/* The approved bar is glass. iOS can blur what passes under it, so it
          takes the translucent fill; everywhere else there is no backdrop
          blur, and a translucent bar with nothing behind it just reads muddy —
          so those platforms get the same colour, opaque. */}
      {isIOS && <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />}
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: isIOS ? BASECAMP.navGlass : BASECAMP.ink }]}
        pointerEvents="none"
      />

      <View style={styles.tabsRow}>
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          const Icon = t.icon;

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
              <View style={[styles.iconSlot, isActive && { backgroundColor: accentSlot }]}>
                {isActive ? (
                  <View style={[styles.activeDisc, { backgroundColor: accent }]}>
                    <Icon size={12} color={BASECAMP.accentInk} strokeWidth={2.2} />
                  </View>
                ) : (
                  <Icon size={21} color={BASECAMP.textDim} strokeWidth={1.8} />
                )}
              </View>
              <Text
                style={[styles.label, { color: isActive ? accent : BASECAMP.textDim }]}
                numberOfLines={1}
              >
                {t.label}
              </Text>
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
    borderTopColor: BASECAMP.navBorder,
    elevation: 0,
  },
  tabsRow: {
    flex: 1,
    flexDirection: "row",
  },
  tabButton: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 9,
    paddingHorizontal: 2,
  },
  iconSlot: {
    width: 36,
    height: 30,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  activeDisc: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 9.5,
    lineHeight: 12,
    fontFamily: "Inter_500Medium",
  },
});
