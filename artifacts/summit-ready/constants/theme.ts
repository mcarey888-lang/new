export const T = {
  bg: "#060D1B",
  bgGrad: ["#060D1B", "#0A1628", "#060E1C"] as const,
  card: "#0F1D30",
  cardBorder: "rgba(255,255,255,0.07)",
  cardHover: "#132035",
  surface: "#142236",
  surfaceBorder: "rgba(255,255,255,0.06)",

  green: "#3ECF75",
  greenDim: "rgba(62,207,117,0.12)",
  greenGlow: "rgba(62,207,117,0.25)",

  orange: "#FF9030",
  orangeDim: "rgba(255,144,48,0.12)",

  blue: "#4A9FF5",
  blueDim: "rgba(74,159,245,0.12)",

  purple: "#9B7FD4",
  purpleDim: "rgba(155,127,212,0.12)",

  red: "#FF4444",
  redDim: "rgba(255,68,68,0.12)",

  white: "#FFFFFF",
  text: "#F0F8FF",
  textMuted: "#7A9BB5",
  textDim: "#4A6580",

  border: "rgba(255,255,255,0.07)",
  borderActive: "rgba(62,207,117,0.4)",

  tabBg: "rgba(6,13,27,0.95)",
};

export const PHASE_COLOR: Record<string, string> = {
  Accelerated: T.red,
  Base: T.green,
  Build: T.blue,
  Peak: T.orange,
  Taper: T.purple,
};

export const STATUS_COLOR = (score: number) =>
  score >= 70 ? T.green : score >= 40 ? T.orange : T.red;

export const STATUS_LABEL = (score: number) =>
  score >= 70 ? "Ready" : score >= 40 ? "Close" : "Not Ready";
