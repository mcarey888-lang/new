/**
 * The sticky actions for the selected route.
 *
 * It appears only once a route is chosen, and sits directly above the shared
 * tab bar rather than replacing it.
 *
 * Start Route is not merely hidden for an ineligible route. `onStart` is only
 * called when the caller's guard produced a handoff, and the guard runs again
 * inside `startRouteHandoff()` — hiding a control is presentation, and
 * presentation is not a safety boundary.
 */
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarPlus, Check, Play, ShieldAlert } from "lucide-react-native";
import { BASECAMP, EXPLORE, HIT, SP, TYPE } from "@/constants/tokens";
import { VERIFICATION_NOTICE, type RouteEligibility } from "@/utils/routeEligibility";

export function RouteActionBar({
  mountainName, routeName, eligibility, planned, onAddToPlan, onStart, bottomOffset = 0,
}: {
  mountainName: string;
  routeName: string;
  eligibility: RouteEligibility;
  planned: boolean;
  onAddToPlan?: () => void;
  onStart?: () => void;
  /** Height of whatever sits below, so the bar clears the tab bar. */
  bottomOffset?: number;
}) {
  const insets = useSafeAreaInsets();
  const canPlan = eligibility.canAddToPlan && !!onAddToPlan;

  return (
    <View
      style={[styles.bar, { bottom: bottomOffset, paddingBottom: Platform.OS === "web" ? SP.sm : Math.max(SP.sm, insets.bottom / 2) }]}
      testID="route-action-bar"
    >
      <Text style={styles.context} numberOfLines={1}>{`${mountainName} · ${routeName}`}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={onAddToPlan}
          disabled={!canPlan}
          accessibilityRole="button"
          accessibilityLabel={planned ? "Added to plan" : "Add to plan"}
          accessibilityState={{ disabled: !canPlan, selected: planned }}
          hitSlop={HIT.slop}
          style={[styles.action, planned ? styles.planned : styles.secondary, !canPlan && styles.disabled]}
        >
          {planned ? <Check size={15} color={EXPLORE.verified} /> : <CalendarPlus size={15} color={BASECAMP.text} />}
          <Text style={[styles.actionText, planned && { color: EXPLORE.verified }]} numberOfLines={1}>
            {planned ? "Added to Plan" : "Add to Plan"}
          </Text>
        </Pressable>

        {eligibility.isNavigable ? (
          <Pressable
            onPress={onStart}
            accessibilityRole="button"
            accessibilityLabel="Start this route"
            accessibilityHint="Opens Track with this route attached"
            hitSlop={HIT.slop}
            style={[styles.action, styles.primary]}
          >
            <Play size={13} color={EXPLORE.accentInk} fill={EXPLORE.accentInk} />
            <Text style={[styles.actionText, { color: EXPLORE.accentInk }]} numberOfLines={1}>
              Start This Route
            </Text>
          </Pressable>
        ) : (
          <View
            accessible
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            accessibilityLabel={VERIFICATION_NOTICE.blockedAction}
            accessibilityHint={VERIFICATION_NOTICE.body}
            style={[styles.action, styles.secondary, styles.disabled]}
          >
            <ShieldAlert size={13} color={BASECAMP.textDim} />
            <Text style={[styles.actionText, styles.blockedText]} numberOfLines={2}>
              {VERIFICATION_NOTICE.blockedAction}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute", left: 0, right: 0,
    paddingHorizontal: BASECAMP.gutter, paddingTop: 10,
    backgroundColor: BASECAMP.navGlass,
    borderTopWidth: 1, borderTopColor: BASECAMP.navBorder,
  },
  context: { ...TYPE.caption, fontSize: 9.5, color: BASECAMP.textDim },
  row: { marginTop: 7, flexDirection: "row", gap: 9 },
  action: {
    flex: 1, minWidth: 0, minHeight: 50, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingHorizontal: SP.sm, borderWidth: 1,
  },
  secondary: { backgroundColor: BASECAMP.panelSub, borderColor: BASECAMP.panelSubBorder },
  primary: { backgroundColor: EXPLORE.accent, borderColor: "transparent" },
  planned: { backgroundColor: EXPLORE.verifiedDim, borderColor: EXPLORE.verifiedLine },
  disabled: { opacity: 0.55 },
  actionText: { ...TYPE.bodyBold, fontSize: 12.5, color: BASECAMP.text, flexShrink: 1 },
  blockedText: { fontSize: 11, color: BASECAMP.textDim },
});
