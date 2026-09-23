/**
 * SummitReady shared UI primitives.
 *
 * These are the pieces the approved prototypes use on every screen: the
 * gradient panel, the tracked-out section header, the screen header, the hero
 * frame, the segmented control, the bottom sheet and the designed
 * missing-state. They were proven on Training Basecamp and are now the app's
 * shared vocabulary, so a screen composes from them instead of re-typing them.
 *
 * Colours come from `constants/tokens.ts` (BASECAMP) and `constants/theme.ts`.
 * Nothing here reads app state or computes a value.
 */
import React from "react";
import {
  ActivityIndicator, Image, ImageSourcePropType, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { T } from "@/constants/theme";
import { BASECAMP, HIT, RADIUS, SP, TYPE } from "@/constants/tokens";

/* ── SRPanel ───────────────────────────────────────────────────────────────
   The prototype's `.panel`: a dark green-tinted gradient with a hairline
   border. The caller's style lands on the OUTERMOST element so a pressable
   panel can still take part in its parent's layout. */
export function SRPanel({
  children, style, radius = 18, padded = 0, onPress, accessibilityLabel, accessibilityHint, testID,
}: {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[] | (ViewStyle | false | null | undefined)[];
  radius?: number;
  padded?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}) {
  const composed = [
    styles.panel,
    { borderRadius: radius },
    padded ? { padding: padded } : null,
    style,
  ] as ViewStyle[];
  const surface = (
    <LinearGradient
      colors={BASECAMP.panelGradient}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      pointerEvents="none"
    />
  );
  if (!onPress) {
    return <View style={composed} testID={testID}>{surface}{children}</View>;
  }
  return (
    <TouchableOpacity
      style={composed}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
    >
      {surface}
      {children}
    </TouchableOpacity>
  );
}

/* ── SRSubPanel ────────────────────────────────────────────────────────── */
export function SRSubPanel({
  children, style, radius = 14, onPress, accessibilityLabel, testID,
}: {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  radius?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const composed = [styles.subPanel, { borderRadius: radius }, style] as ViewStyle[];
  if (!onPress) return <View style={composed} testID={testID}>{children}</View>;
  return (
    <TouchableOpacity
      style={composed}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {children}
    </TouchableOpacity>
  );
}

/* ── SRSectionHeader ───────────────────────────────────────────────────── */
export function SRSectionHeader({
  title, action, onAction, icon, style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={styles.sectionTitleWrap}>
        {icon}
        <Text style={styles.sectionTitle} accessibilityRole="header" numberOfLines={1}>
          {title.toUpperCase()}
        </Text>
      </View>
      {action && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          hitSlop={HIT.slop}
          style={styles.sectionAction}
          accessibilityRole="button"
          accessibilityLabel={action}
        >
          <Text style={styles.sectionActionText} numberOfLines={1}>{action}</Text>
          <ChevronRight size={13} color={BASECAMP.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** The small tracked-out label above a figure or a title. */
export function SREyebrow({
  children, tone, style,
}: { children: React.ReactNode; tone?: string; style?: TextStyle }) {
  return (
    <Text style={[styles.eyebrow, tone ? { color: tone } : null, style]} numberOfLines={1}>
      {children}
    </Text>
  );
}

/** A thin vertical rule between inline facts. */
export function SRFactDivider() {
  return <View style={styles.factDivider} />;
}

/* ── SRScreenHeader ────────────────────────────────────────────────────────
   Back, a centred tracked-out title with an optional subtitle, and one
   optional action. Used by every pushed screen so they share one header. */
export function SRScreenHeader({
  title, subtitle, onBack, right, style, transparent = true, backTestID,
}: {
  title: string;
  subtitle?: string | null;
  onBack?: () => void;
  right?: React.ReactNode;
  style?: ViewStyle;
  transparent?: boolean;
  /** Keeps an existing test hook working when a screen adopts this header. */
  backTestID?: string;
}) {
  return (
    <View style={[styles.screenHeader, !transparent && { backgroundColor: BASECAMP.ink }, style]}>
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          hitSlop={HIT.slop}
          style={styles.headerSide}
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID={backTestID}
        >
          <ChevronLeft size={22} color={BASECAMP.text} />
        </TouchableOpacity>
      ) : <View style={styles.headerSide} />}

      <View style={styles.headerCentre} pointerEvents="none">
        <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
          {title.toUpperCase()}
        </Text>
        {subtitle ? <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle.toUpperCase()}</Text> : null}
      </View>

      <View style={[styles.headerSide, { alignItems: "flex-end" }]}>{right}</View>
    </View>
  );
}

/* ── SRHeroFrame ───────────────────────────────────────────────────────────
   A photograph that resolves into the page background, with the approved
   two-axis scrim. `uri` null renders the designed gradient instead — never an
   empty box and never a broken-image state. The frame sizes to its content
   above `minHeight`, so long names push it taller rather than clipping.

   ── ARTWORK MUST NOT COMPETE WITH THE INTERFACE ─────────────────────────
   Generated artwork often carries its own lettering and its own subject
   framing. Left alone it bleeds down the page and argues with the title and
   controls drawn over it — the Incline Treadmill session artwork did exactly
   that, its title text showing through behind functional content.

   So a hero TERMINATES. `artwork="generated"` clips the image to the top of
   the frame and ramps to solid ink well before the bottom edge, which is
   where a screen's functional content sits. Nothing of the source survives
   past that ramp, whatever the image contains. `artwork="photo"` (the
   default) keeps the softer treatment that suits a real photograph.
   Either way the bottom of the frame is opaque ink, so content below the
   hero never has artwork behind it. */
export function SRHeroFrame({
  uri, source, onImageError, minHeight = 280, children, style, dim = 1,
  artwork = "photo",
}: {
  uri?: string | null;
  /** A local asset (require(...)) where the screen already has one. */
  source?: ImageSourcePropType | null;
  onImageError?: () => void;
  minHeight?: number;
  children?: React.ReactNode;
  style?: ViewStyle;
  /** 0–1 multiplier on the scrim, for heroes that need more of the photo. */
  dim?: number;
  /**
   * "photo" — a real photograph; the soft two-axis scrim.
   * "generated" — artwork that may contain its own lettering or framing; it
   * is clipped to the top of the frame and inked out before the content band.
   */
  artwork?: "photo" | "generated";
}) {
  const generated = artwork === "generated";
  const a = (v: number) => Math.min(1, v * dim).toFixed(2);
  const body = (
    <View style={[{ minHeight }, style]}>
      <LinearGradient
        colors={generated
          ? [
              `rgba(5,9,11,${a(0.5)})`, `rgba(5,9,11,${a(0.22)})`,
              `rgba(5,9,11,${a(0.82)})`, BASECAMP.ink, BASECAMP.ink,
            ]
          : [
              `rgba(5,9,11,${a(0.66)})`, `rgba(5,9,11,${a(0.1)})`,
              `rgba(5,9,11,${a(0.42)})`, `rgba(5,9,11,${a(0.94)})`, BASECAMP.ink,
            ]}
        /* Generated artwork is fully inked by 62% of the frame, so the whole
           lower band — where titles, metrics and controls live — is drawn on
           flat ink rather than on someone else's typography. */
        locations={generated ? [0, 0.16, 0.46, 0.62, 1] : [0, 0.22, 0.56, 0.88, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[`rgba(5,9,11,${a(0.88)})`, `rgba(5,9,11,${a(0.34)})`, "rgba(5,9,11,0)"]}
        locations={[0, 0.48, 0.84]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );

  const resolved: ImageSourcePropType | null = source ?? (uri ? { uri } : null);
  if (!resolved) {
    return (
      <LinearGradient colors={["#1B2C2A", "#0C1417", BASECAMP.ink]} style={{ backgroundColor: BASECAMP.ink }}>
        {body}
      </LinearGradient>
    );
  }
  return (
    <View style={{ backgroundColor: BASECAMP.ink }}>
      {/* Absolutely filled rather than an ImageBackground so the frame's
          height is driven by its content, not by the image. Generated
          artwork is additionally clipped to the top 70% of the frame, so
          even a fully opaque source cannot reach the content band. */}
      <View
        style={[StyleSheet.absoluteFill, generated && { bottom: "30%", overflow: "hidden" }]}
        pointerEvents="none"
      >
        <Image
          source={resolved}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={onImageError}
          accessible={false}
        />
      </View>
      {body}
    </View>
  );
}

/* ── SRSegmented ───────────────────────────────────────────────────────────
   The pill segmented control: chart period, plan section. */
export function SRSegmented<TValue extends string>({
  options, value, onChange, style, compact = false,
}: {
  options: { value: TValue; label: string }[];
  value: TValue;
  onChange: (v: TValue) => void;
  style?: ViewStyle;
  compact?: boolean;
}) {
  return (
    <View style={[styles.segmented, style]} accessibilityRole="tablist">
      {options.map(o => {
        const on = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[
              styles.segment,
              compact && { paddingHorizontal: 9, height: 22 },
              on && styles.segmentOn,
            ]}
            activeOpacity={0.85}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
          >
            <Text
              style={[styles.segmentText, compact && { fontSize: 9.5 }, on && styles.segmentTextOn]}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ── SRUnderlineTabs ───────────────────────────────────────────────────────
   Full-width tabs with an accent underline, as the Training Plan uses.

   Past four tabs the row scrolls instead of squeezing: at 320pt, five equal
   columns truncate a word like "Achievements" to "Achie…", and a tab whose
   label you cannot read is not a tab. */
export function SRUnderlineTabs<TValue extends string>({
  options, value, onChange, style,
}: {
  options: { value: TValue; label: string }[];
  value: TValue;
  onChange: (v: TValue) => void;
  style?: ViewStyle;
}) {
  const scroll = options.length > 4;

  const items = options.map(o => {
    const on = o.value === value;
    return (
      <TouchableOpacity
        key={o.value}
        onPress={() => onChange(o.value)}
        style={[styles.tab, scroll && styles.tabAuto]}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={o.label}
      >
        <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>{o.label}</Text>
        <View style={[styles.tabRule, on && { backgroundColor: BASECAMP.accent }]} />
      </TouchableOpacity>
    );
  });

  /* The rule belongs to the row, not to the scroller, so it still spans the
     screen when the tabs are scrolled part-way. */
  if (!scroll) {
    return (
      <View style={[styles.tabsRow, style]} accessibilityRole="tablist">{items}</View>
    );
  }
  return (
    <View style={[styles.tabsRule, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsScroll}
        /* A horizontal ScrollView has no intrinsic height: without this it
           collapses and the tabs vanish, leaving only the rule. */
        style={styles.tabsScroller}
        accessibilityRole="tablist"
      >
        {items}
      </ScrollView>
    </View>
  );
}

/* ── SRSheet ───────────────────────────────────────────────────────────────
   The bottom sheet the prototypes use for detail. Scrolls internally and
   never covers the whole screen. */
export function SRSheet({
  visible, onClose, children, accessibilityLabel,
}: {
  visible: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  accessibilityLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View
          style={[styles.sheet, { paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 16 }]}
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
        >
          <View style={styles.sheetGrabber} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ── SREmptyState ──────────────────────────────────────────────────────────
   The designed missing / unavailable / empty state. A screen must never fall
   back to a blank area or a fabricated number, so this is the one place that
   says "we do not have this yet" and, where relevant, offers the way out. */
export function SREmptyState({
  title, body, icon, action, onAction, loading = false, compact = false, style, testID,
}: {
  title: string;
  body?: string;
  icon?: React.ReactNode;
  action?: string;
  onAction?: () => void;
  loading?: boolean;
  compact?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  return (
    <View style={[styles.empty, compact && { paddingVertical: SP.md }, style]} testID={testID}>
      {loading ? <ActivityIndicator size="small" color={BASECAMP.accent} /> : icon}
      <Text style={styles.emptyTitle} numberOfLines={2}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {action && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          style={styles.emptyAction}
          hitSlop={HIT.slop}
          accessibilityRole="button"
          accessibilityLabel={action}
        >
          <Text style={styles.emptyActionText}>{action}</Text>
          <ChevronRight size={13} color={BASECAMP.accent} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/* ── SRMetric ──────────────────────────────────────────────────────────────
   A figure with a label. `value` accepts null so "unknown" can never be
   rendered as zero — it shows an em dash instead. */
export function SRMetric({
  value, label, sub, size = "md", tone, align = "left", style,
}: {
  value: string | number | null | undefined;
  label: string;
  sub?: string | null;
  size?: "md" | "lg";
  tone?: string;
  align?: "left" | "center";
  style?: ViewStyle;
}) {
  const shown = value === null || value === undefined ? "—" : String(value);
  return (
    <View style={[{ minWidth: 0, alignItems: align === "center" ? "center" : "flex-start" }, style]}>
      <Text
        style={[size === "lg" ? TYPE.metricLg : TYPE.metric, { color: tone ?? BASECAMP.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {shown}
      </Text>
      <Text style={styles.metricLabel} numberOfLines={2}>{label}</Text>
      {sub ? <Text style={styles.metricSub} numberOfLines={2}>{sub}</Text> : null}
    </View>
  );
}

/* ── SRStatusPill ──────────────────────────────────────────────────────── */
export function SRStatusPill({
  label, tone = BASECAMP.accent, icon, style,
}: { label: string; tone?: string; icon?: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.pill, { borderColor: `${tone}80`, backgroundColor: `${tone}26` }, style]}>
      {icon}
      <Text style={[styles.pillText, { color: tone }]} numberOfLines={1}>{label.toUpperCase()}</Text>
    </View>
  );
}

/* ── SRProgress ────────────────────────────────────────────────────────────
   A track with an earned fill and, optionally, a visually distinct projected
   extension drawn beyond it — never in place of it. */
export function SRProgress({
  value, projected, tone = BASECAMP.accent, projectedTone = BASECAMP.accent,
  height = 7, style, accessibilityLabel,
}: {
  value: number;
  projected?: number | null;
  tone?: string;
  projectedTone?: string;
  height?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const projPct = projected === null || projected === undefined
    ? null : Math.max(pct, Math.min(100, projected));
  return (
    <View
      style={[{ height, borderRadius: height / 2, backgroundColor: "rgba(255,255,255,0.10)", overflow: "hidden" }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
    >
      {projPct !== null && projPct > pct ? (
        <View style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${projPct}%`, backgroundColor: `${projectedTone}59`,
          borderRadius: height / 2,
        }} />
      ) : null}
      <View style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: `${pct}%`, backgroundColor: tone, borderRadius: height / 2,
      }} />
    </View>
  );
}

/* ── SRButton ──────────────────────────────────────────────────────────────
   Always at least the minimum touch target. */
export function SRButton({
  label, onPress, variant = "primary", icon, disabled, style, accessibilityHint, compact = false,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "quiet";
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
  compact?: boolean;
}) {
  const v = {
    primary:   { backgroundColor: BASECAMP.accent, color: BASECAMP.accentInk, borderColor: "transparent" },
    secondary: { backgroundColor: BASECAMP.panelSub, color: BASECAMP.textStrong, borderColor: BASECAMP.panelSubBorder },
    quiet:     { backgroundColor: "transparent", color: BASECAMP.textMuted, borderColor: "transparent" },
  }[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        styles.button,
        compact && { minHeight: 40, paddingHorizontal: SP.md },
        { backgroundColor: v.backgroundColor, borderColor: v.borderColor },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      {icon}
      <Text
        style={[styles.buttonText, compact && { fontSize: 11, letterSpacing: 0.6 }, { color: v.color }]}
        numberOfLines={1}
      >
        {compact ? label.toUpperCase() : label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  panel: { overflow: "hidden", borderWidth: 1, borderColor: BASECAMP.panelBorder },
  subPanel: {
    backgroundColor: BASECAMP.panelSub,
    borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },

  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 24,
  },
  sectionTitleWrap: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1, minWidth: 0 },
  sectionTitle: {
    fontSize: 11, lineHeight: 14, fontFamily: "Inter_600SemiBold",
    letterSpacing: 2, color: BASECAMP.textMuted, flexShrink: 1,
  },
  sectionAction: {
    flexDirection: "row", alignItems: "center", gap: 5,
    minHeight: HIT.minTarget, paddingLeft: 10,
  },
  sectionActionText: {
    fontSize: 12, lineHeight: 16, fontFamily: "Inter_500Medium", color: BASECAMP.textMuted,
  },
  eyebrow: {
    fontSize: 9.5, lineHeight: 12, fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.8, color: BASECAMP.textMuted,
  },
  factDivider: { width: 1, height: 11, backgroundColor: BASECAMP.textFaint },

  screenHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: BASECAMP.gutter, minHeight: HIT.minTarget,
  },
  headerSide: { width: 56, minHeight: HIT.minTarget, justifyContent: "center" },
  headerCentre: { flex: 1, alignItems: "center", minWidth: 0 },
  headerTitle: {
    fontSize: 12, lineHeight: 15, fontFamily: "Inter_700Bold",
    letterSpacing: 2.2, color: BASECAMP.text,
  },
  headerSubtitle: {
    fontSize: 8.5, lineHeight: 11, fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.8, color: BASECAMP.textDim, marginTop: 3,
  },

  segmented: {
    flexDirection: "row", alignItems: "center", gap: 3, padding: 2,
    borderRadius: RADIUS.pill,
    backgroundColor: BASECAMP.panelSub,
    borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
    alignSelf: "flex-start",
  },
  segment: {
    paddingHorizontal: 11, height: 26, borderRadius: RADIUS.pill,
    alignItems: "center", justifyContent: "center",
  },
  segmentOn: { backgroundColor: "rgba(255,255,255,0.92)" },
  segmentText: {
    fontSize: 10.5, lineHeight: 13, fontFamily: "Inter_700Bold", color: BASECAMP.textMuted,
  },
  segmentTextOn: { color: BASECAMP.ink },

  tabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: BASECAMP.gutter,
  },
  tabsRule: { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  tabsScroller: { flexGrow: 0, height: HIT.minTarget + 4 },
  tabsScroll: {
    flexDirection: "row", gap: SP.xl, alignItems: "flex-start",
    paddingHorizontal: BASECAMP.gutter,
  },
  tab: { flex: 1, minWidth: 0, paddingTop: 4, minHeight: HIT.minTarget },
  /* In a scrolling row a tab sizes to its label instead of sharing the width.
     flexBasis must be "auto": `flex: 0` alone resolves to a 0% basis and
     every tab collapses to zero width. */
  tabAuto: { flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
  tabText: {
    fontSize: 13.5, lineHeight: 18, fontFamily: "Inter_600SemiBold",
    color: BASECAMP.textDim, textAlign: "center",
  },
  tabTextOn: { color: BASECAMP.text },
  tabRule: { marginTop: 9, height: 2.5, borderRadius: 2, backgroundColor: "transparent" },

  sheetRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.62)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "86%",
    backgroundColor: "#0B1214",
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderColor: BASECAMP.panelBorder,
    paddingHorizontal: BASECAMP.gutter, paddingTop: 12,
  },
  sheetGrabber: {
    alignSelf: "center", width: 38, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)", marginBottom: 14,
  },

  empty: { alignItems: "flex-start", gap: 7, paddingVertical: SP.lg },
  emptyTitle: { fontSize: 14, lineHeight: 19, fontFamily: "Inter_600SemiBold", color: BASECAMP.text },
  emptyBody: { fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
  emptyAction: {
    flexDirection: "row", alignItems: "center", gap: 5,
    minHeight: HIT.minTarget, marginTop: -6,
  },
  emptyActionText: { fontSize: 12, lineHeight: 16, fontFamily: "Inter_600SemiBold", color: BASECAMP.accent },

  metricLabel: {
    fontSize: 10, lineHeight: 13, fontFamily: "Inter_500Medium",
    color: BASECAMP.textDim, marginTop: 3,
  },
  metricSub: { ...TYPE.caption, color: T.basecampTextDim, marginTop: 2 } as TextStyle,

  pill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: RADIUS.sm, borderWidth: 1, alignSelf: "flex-start",
  },
  pillText: { fontSize: 9, lineHeight: 12, fontFamily: "Inter_700Bold", letterSpacing: 1 },

  button: {
    minHeight: HIT.minTarget, borderRadius: RADIUS.md, borderWidth: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SP.sm, paddingHorizontal: SP.lg,
  },
  buttonText: { fontSize: 14, lineHeight: 20, fontFamily: "Inter_700Bold" },
});
