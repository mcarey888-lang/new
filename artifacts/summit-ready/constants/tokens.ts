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
