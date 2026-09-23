/**
 * SummitReady UI tokens — Journey 1.
 *
 * These are the repeated values from the approved HTML prototypes, translated
 * for React Native rather than copied from CSS. They EXTEND `constants/theme.ts`
 * (which stays the source of colour truth); nothing here redefines a colour that
 * `T` already owns.
 *
 * Added during production UI integration so the approved spacing, radii, type
 * scale and motion timings stop being re-typed per screen.
 */
import { Platform } from "react-native";
import { T } from "./theme";

/** 4pt base. The prototypes use a 17px screen gutter; 16 is the RN equivalent. */
export const SP = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40,
  /** Horizontal screen gutter. */
  gutter: 16,
  /** Gap between stacked surfaces in a section. */
  stack: 12,
} as const;

export const RADIUS = {
  sm: 8, md: 12, lg: 15, xl: 18, pill: 999,
} as const;

/**
 * Type scale. `family` mirrors the fonts the app already loads — this does not
 * introduce a new typeface.
 */
export const TYPE = {
  hero:      { fontSize: 34, lineHeight: 38, fontFamily: "Inter_700Bold", letterSpacing: -0.6 },
  title:     { fontSize: 22, lineHeight: 27, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  heading:   { fontSize: 17, lineHeight: 22, fontFamily: "Inter_700Bold" },
  body:      { fontSize: 14, lineHeight: 20, fontFamily: "Inter_400Regular" },
  bodyBold:  { fontSize: 14, lineHeight: 20, fontFamily: "Inter_600SemiBold" },
  small:     { fontSize: 12, lineHeight: 16, fontFamily: "Inter_400Regular" },
  smallBold: { fontSize: 12, lineHeight: 16, fontFamily: "Inter_600SemiBold" },
  caption:   { fontSize: 11, lineHeight: 14, fontFamily: "Inter_400Regular" },
  /** Section eyebrows: uppercase, tracked out. */
  eyebrow:   { fontSize: 10, lineHeight: 13, fontFamily: "Inter_700Bold", letterSpacing: 1.6 },
  /** Large figures. Tabular so digits do not jitter while they animate. */
  metric:    { fontSize: 26, lineHeight: 30, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  metricLg:  { fontSize: 34, lineHeight: 38, fontFamily: "Inter_700Bold", letterSpacing: -0.6 },
} as const;

/** Surface treatments from the approved kit: `.panel`, `.panel-sub`, `.glass`. */
export const SURFACE = {
  panel:    { backgroundColor: T.basecampSurface, borderWidth: 1, borderColor: T.basecampBorder },
  panelSub: { backgroundColor: "rgba(255,255,255,0.035)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  glass:    { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.13)" },
} as const;

/** Motion timings. Consumers must still honour `useReducedMotion()`. */
export const MOTION = {
  /** Entrance of a surface. */
  enter: 420,
  /** Stagger between entering siblings. */
  stagger: 70,
  /** Gauge sweep and metric count-up. */
  gauge: 900,
  /** Small state changes. */
  quick: 180,
} as const;

/** Minimum interactive target, per the accessibility requirement. */
export const HIT = { minTarget: 44, slop: { top: 8, bottom: 8, left: 8, right: 8 } } as const;

export const ELEVATION = {
  card: Platform.select({
    ios: { shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 4 },
    default: {},
  }),
} as const;

/* ──────────────────────────────────────────────────────────────────────────
   BASECAMP — the approved Training Basecamp visual language.

   Taken from `summitready-training-basecamp-mockup.html`, which is the visual
   authority for this screen. These are deliberately SEPARATE from the legacy
   `T.basecamp*` values rather than a redefinition of them: the rest of the app
   still renders against the old palette, and nothing here changes what any
   other screen looks like except the shared tab bar, which the approved design
   owns.

   Colour only. No spacing, no behaviour, no data.
   ────────────────────────────────────────────────────────────────────────── */
export const BASECAMP = {
  /** Near-black with a blue-green cast — the prototype's `ink`. */
  ink: "#05090B",
  /** The training accent. Restrained: it marks progress and actions, nothing else. */
  accent: "#24EFA4",
  accentInk: "#05090B",
  accentDim: "rgba(36,239,164,0.13)",
  accentLine: "rgba(36,239,164,0.60)",

  /** `.panel` — the screen's primary surface, a dark green-tinted gradient. */
  panelGradient: ["rgba(20,36,32,0.92)", "rgba(10,17,19,0.94)", "rgba(8,13,15,0.96)"] as const,
  panelBorder: "rgba(255,255,255,0.075)",
  /** `.panel-sub` — a quieter surface nested inside a panel. */
  panelSub: "rgba(255,255,255,0.035)",
  panelSubBorder: "rgba(255,255,255,0.07)",
  /** `.glass` — used over photography. */
  glass: "rgba(255,255,255,0.07)",
  glassBorder: "rgba(255,255,255,0.13)",
  /** `.navglass` — the shared bottom navigation. */
  navGlass: "rgba(5,9,11,0.92)",
  navBorder: "rgba(255,255,255,0.07)",

  text: "#FFFFFF",
  textStrong: "rgba(255,255,255,0.88)",
  textMuted: "rgba(255,255,255,0.62)",
  textDim: "rgba(255,255,255,0.45)",
  textFaint: "rgba(255,255,255,0.28)",
  hairline: "rgba(255,255,255,0.10)",

  /** The prototype's 17px screen gutter. */
  gutter: 17,
} as const;
