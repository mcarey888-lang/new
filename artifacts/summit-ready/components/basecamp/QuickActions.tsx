/**
 * The editorial band and the quick-action grid that close Training Basecamp.
 *
 * Both come from the approved prototype. Every action routes to a screen that
 * already exists — this introduces no new destination and no new behaviour.
 *
 * The band uses a size-bounded image of the current mountain when available,
 * with a gradient fallback. It states a brand line, not data.
 */
import React from "react";
import { ImageBackground, PanResponder, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import type { LucideIcon } from "lucide-react-native";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react-native";
import { BASECAMP, HIT, MOTION } from "@/constants/tokens";
import { SRSectionHeader } from "@/components/ui";

export interface QuickAction {
  id: string;
  label: string;
  Icon: LucideIcon;
  onPress: () => void;
}

export function EditorialBand({ onPress, imageUri }: { onPress: () => void; imageUri?: string | null }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(MOTION.stagger * 4).duration(MOTION.enter)}
      style={styles.bandWrap}
    >
      <View style={styles.band}>
        {imageUri ? (
          <ImageBackground
            source={{ uri: imageUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : null}
        <LinearGradient
          colors={["rgba(8,20,20,0.84)", "rgba(9,16,18,0.34)", "rgba(6,11,13,0.32)"]}
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

export function QuickActionsGrid({ actions, inDrawer = false }: { actions: QuickAction[]; inDrawer?: boolean }) {
  const reduced = useReducedMotion();
  if (actions.length === 0) return null;
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(MOTION.stagger * 5).duration(MOTION.enter)}
      style={[styles.gridWrap, inDrawer && styles.drawerGridWrap]}
    >
      {!inDrawer && <SRSectionHeader title="Quick actions" />}
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

/** A small anchored handle always remains above the tabs. Drag or tap it to
 * reveal the screen's existing destinations; no navigation is duplicated. */
export function QuickActionsDrawer({ actions }: { actions: QuickAction[] }) {
  const [open, setOpen] = React.useState(false);
  const responder = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 10,
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy < -25) setOpen(true);
      else if (gesture.dy > 25) setOpen(false);
    },
  }), []);
  return (
    <View style={styles.drawer} testID="basecamp-quick-actions-drawer" {...responder.panHandlers}>
      <View>
        <TouchableOpacity
          style={styles.drawerHandle}
          onPress={() => setOpen(value => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={open ? "Close quick actions" : "Open quick actions"}
          testID="basecamp-quick-actions-toggle"
        >
          <View style={styles.drawerGrip} />
          <Text style={styles.drawerTitle}>QUICK ACTIONS</Text>
          {open ? <ChevronDown size={15} color={BASECAMP.textMuted} /> : <ChevronUp size={15} color={BASECAMP.textMuted} />}
        </TouchableOpacity>
      </View>
      {open && <QuickActionsGrid actions={actions} inDrawer />}
    </View>
  );
}

const styles = StyleSheet.create({
  drawer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: BASECAMP.ink,
    borderTopWidth: 1, borderTopColor: BASECAMP.panelBorder,
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
    overflow: "hidden",
  },
  drawerHandle: {
    minHeight: 43, flexDirection: "row", alignItems: "center",
    paddingHorizontal: BASECAMP.gutter, gap: 10,
  },
  drawerGrip: { width: 24, height: 3, borderRadius: 2, backgroundColor: BASECAMP.textDim },
  drawerTitle: {
    flex: 1, fontSize: 9, lineHeight: 12,
    fontFamily: "Inter_600SemiBold", letterSpacing: 2, color: BASECAMP.textMuted,
  },
  drawerGridWrap: { marginTop: 0, paddingBottom: 13 },
  bandWrap: { paddingHorizontal: BASECAMP.gutter, marginTop: 13 },
  band: {
    minHeight: 94,
    borderRadius: 8,
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
    height: 38, paddingLeft: 15, paddingRight: 11, borderRadius: 9.5,
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
    borderRadius: 7,
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
