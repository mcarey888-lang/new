/**
 * Mountain Detail — the small shared pieces.
 *
 * Verification marks, fact rows and the unverified notice. They are here
 * rather than inline so the route card, the expanded route, the action bar
 * and the 3D surface cannot drift into saying different things about the same
 * route.
 *
 * None of these read app state or decide anything. The verification words
 * come from `utils/routeEligibility.ts`; the fact states come from
 * `utils/mountainDetailPresentation.ts`. A component here only draws them.
 */
import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { ShieldCheck, ShieldAlert } from "lucide-react-native";
import { BASECAMP, EXPLORE, RADIUS, SP, TYPE } from "@/constants/tokens";
import { VERIFICATION_NOTICE, type RouteVerificationState } from "@/utils/routeEligibility";
import { NOT_RECORDED, type PresentedFact } from "@/utils/mountainDetailPresentation";

/** The colour and word for a verification state. One mapping, used everywhere. */
export function verificationTone(state: RouteVerificationState) {
  if (state === "verified") {
    return { tone: EXPLORE.verified, dim: EXPLORE.verifiedDim, line: EXPLORE.verifiedLine, label: "VERIFIED" };
  }
  if (state === "candidate") {
    return { tone: EXPLORE.unverified, dim: EXPLORE.unverifiedDim, line: EXPLORE.unverifiedLine, label: "UNVERIFIED" };
  }
  return { tone: BASECAMP.textDim, dim: "rgba(255,255,255,0.04)", line: BASECAMP.hairline, label: "NOT IDENTIFIED" };
}

export function VerificationBadge({
  state, compact = false, style,
}: { state: RouteVerificationState; compact?: boolean; style?: ViewStyle }) {
  const { tone, dim, line, label } = verificationTone(state);
  const Icon = state === "verified" ? ShieldCheck : ShieldAlert;
  return (
    <View
      style={[styles.badge, { backgroundColor: dim, borderColor: line }, style]}
      accessible
      accessibilityLabel={`Route status: ${label.toLowerCase()}`}
    >
      <Icon size={compact ? 9 : 11} color={tone} />
      <Text style={[styles.badgeText, compact && { fontSize: 8.5 }, { color: tone }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * One fact row.
 *
 * A fact we do not hold reads "Not recorded" in a quieter, italic voice — it
 * is deliberately not a dash, which the eye reads as a value of zero, and
 * deliberately not omitted, because knowing the field is empty is itself
 * useful. A `candidate` value is shown with its own marker rather than
 * silently presented as verified.
 */
export function FactRow({ fact, icon }: { fact: PresentedFact; icon?: React.ReactNode }) {
  const missing = fact.state === "missing";
  return (
    <View style={styles.factRow}>
      <View style={styles.factLabelWrap}>
        {icon}
        <Text style={styles.factLabel} numberOfLines={2}>{fact.label}</Text>
      </View>
      {missing ? (
        <Text style={styles.factMissing}>{NOT_RECORDED}</Text>
      ) : (
        <Text style={styles.factValue} numberOfLines={3}>
          {fact.value}
          {fact.state === "candidate" ? (
            <Text style={styles.factCandidate}>{"  UNVERIFIED"}</Text>
          ) : null}
        </Text>
      )}
    </View>
  );
}

export function FactList({ facts, style }: { facts: readonly PresentedFact[]; style?: ViewStyle }) {
  return (
    <View style={style}>
      {facts.map((f, i) => (
        <View key={f.key} style={i > 0 ? styles.factDivider : undefined}>
          <FactRow fact={f} />
        </View>
      ))}
    </View>
  );
}

/**
 * Shown in place of the navigation and offline controls while a route is not
 * verified. It says what is missing and what still works, rather than leaving
 * a disabled button to explain itself.
 */
export function VerificationNotice({ style }: { style?: ViewStyle }) {
  return (
    <View
      style={[styles.notice, style]}
      accessible
      accessibilityLabel={`${VERIFICATION_NOTICE.title}. ${VERIFICATION_NOTICE.body}`}
    >
      <ShieldAlert size={16} color={EXPLORE.unverified} style={styles.noticeIcon} />
      <View style={styles.noticeBody}>
        <Text style={styles.noticeTitle}>{VERIFICATION_NOTICE.title}</Text>
        <Text style={styles.noticeText}>{VERIFICATION_NOTICE.body}</Text>
      </View>
    </View>
  );
}

/** A quiet explanatory line under a section. */
export function Footnote({ children }: { children: React.ReactNode }) {
  return <Text style={styles.footnote}>{children}</Text>;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: RADIUS.sm, borderWidth: 1, alignSelf: "flex-start",
  },
  badgeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.9 },

  factRow: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    gap: SP.md, paddingHorizontal: 13, paddingVertical: 10,
  },
  factLabelWrap: { flexDirection: "row", alignItems: "center", gap: 9, flexShrink: 1, minWidth: 0 },
  factLabel: { ...TYPE.caption, fontSize: 11.5, color: BASECAMP.textMuted, flexShrink: 1 },
  factValue: {
    ...TYPE.caption, fontSize: 11.5, color: BASECAMP.textStrong,
    textAlign: "right", flexShrink: 1, flexGrow: 1, marginLeft: SP.sm,
  },
  factCandidate: { fontSize: 9, fontFamily: "Inter_700Bold", color: EXPLORE.unverified },
  factMissing: {
    ...TYPE.caption, fontSize: 11.5, fontStyle: "italic",
    color: BASECAMP.textFaint, textAlign: "right", flexShrink: 1, marginLeft: SP.sm,
  },
  factDivider: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.055)" },

  notice: {
    flexDirection: "row", gap: 10, padding: 12,
    borderRadius: 13, borderWidth: 1,
    borderColor: EXPLORE.unverifiedLine, backgroundColor: EXPLORE.unverifiedDim,
  },
  noticeIcon: { marginTop: 1 },
  noticeBody: { flex: 1, minWidth: 0 },
  noticeTitle: { fontSize: 12.5, lineHeight: 16, fontFamily: "Inter_700Bold", color: EXPLORE.unverified },
  noticeText: { marginTop: 4, fontSize: 11, lineHeight: 15, fontFamily: "Inter_400Regular", color: BASECAMP.textMuted },

  footnote: {
    /* Small type needs real contrast to be read at all — textFaint is for
       decoration, not for a sentence that explains a number. */
    marginTop: SP.sm, fontSize: 10, lineHeight: 14,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },
});
