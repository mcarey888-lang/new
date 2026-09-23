/**
 * The editorial band and the quick-action grid that close Training Basecamp.
 *
 * Both come from the approved prototype. Every action routes to a screen that
 * already exists — this introduces no new destination and no new behaviour.
 *
 * The prototype's band carries a photograph. Production has no such asset and
 * this task does not create artwork, so the band is rendered as the same shape
 * in the screen's own gradient. It states a brand line, not data.
 */
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import type { LucideIcon } from "lucide-react-native";
import { ChevronRight } from "lucide-react-native";
import { BASECAMP, HIT, MOTION } from "@/constants/tokens";
import { BasecampSectionHeader } from "@/components/basecamp/primitives";

export interface QuickAction {
  id: string;
  label: string;
  Icon: LucideIcon;
  onPress: () => void;
}

export function EditorialBand({ onPress }: { onPress: () => void }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(MOTION.stagger * 4).duration(MOTION.enter)}
      style={styles.bandWrap}
    >
      <View style={styles.band}>
        <LinearGradient
          colors={["rgba(20,36,32,0.95)", "rgba(9,16,18,0.92)", "rgba(6,11,13,0.96)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.bandText}>
          <Text style={styles.bandLine} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            SMALL STEPS
          </Text>
          <Text style={styles.bandLine} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            BIG MOUNTAINS
          </Text>
          <View style={styles.bandRule} />
        </View>
        <TouchableOpacity
          onPress={onPress}
          style={styles.bandCta}
          activeOpacity={0.85}
          hitSlop={HIT.slop}
          accessibilityRole="button"
          accessibilityLabel="Explore routes"
        >
          <Text style={styles.bandCtaText}>EXPLORE</Text>
          <ChevronRight size={13} color={BASECAMP.text} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

export function QuickActionsGrid({ actions }: { actions: QuickAction[] }) {
  const reduced = useReducedMotion();
  if (actions.length === 0) return null;
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(MOTION.stagger * 5).duration(MOTION.enter)}
      style={styles.gridWrap}
    >
      <BasecampSectionHeader title="Quick actions" />
      <View style={styles.grid}>
        {actions.map(({ id, label, Icon, onPress }) => (
          <TouchableOpacity
            key={id}
            onPress={onPress}
            style={styles.action}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Icon size={20} color={BASECAMP.textStrong} strokeWidth={1.7} />
            <Text style={styles.actionLabel} numberOfLines={2}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bandWrap: { paddingHorizontal: BASECAMP.gutter, marginTop: 13 },
  band: {
    minHeight: 94,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BASECAMP.panelBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  bandText: { flexShrink: 1, minWidth: 0 },
  bandLine: {
    fontSize: 13.5, lineHeight: 19, fontFamily: "Inter_600SemiBold",
    letterSpacing: 2.2, color: BASECAMP.text,
  },
  bandRule: { width: 46, height: 1, backgroundColor: BASECAMP.textDim, marginTop: 7 },
  bandCta: {
    flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 5,
    height: 38, paddingLeft: 15, paddingRight: 11, borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1, borderColor: BASECAMP.glassBorder,
  },
  bandCtaText: {
    fontSize: 11, lineHeight: 14, fontFamily: "Inter_700Bold",
    letterSpacing: 1, color: BASECAMP.text,
  },

  gridWrap: { paddingHorizontal: BASECAMP.gutter, marginTop: 22 },
  grid: { flexDirection: "row", gap: 8, marginTop: 10 },
  action: {
    flex: 1,
    minWidth: 0,
    minHeight: 76,
    borderRadius: 14,
    backgroundColor: BASECAMP.panelSub,
    borderWidth: 1,
    borderColor: BASECAMP.panelSubBorder,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  actionLabel: {
    fontSize: 9.5, lineHeight: 12, fontFamily: "Inter_500Medium",
    color: BASECAMP.textStrong, textAlign: "center",
  },
});
