/**
 * Onboarding — the six screens, as data.
 *
 * SIX. The flow is locked at six screens and this list is the lock: the
 * screen renders `ONBOARDING_STEPS` and nothing else, and a test asserts the
 * length. Adding a seventh screen means changing this file, which means
 * failing that test, which is the point.
 *
 * Five of the six are a photograph, a headline and one decision. Only one
 * asks the user for anything, and it asks after the product has been
 * explained rather than before.
 *
 * ── WHAT THIS FILE MAY NOT CONTAIN ────────────────────────────────────────
 * No figures. Onboarding happens before the user has recorded anything, so
 * any number here would be either zero or an invention. The Elevation Bank
 * screen therefore explains what the bank IS and says yours starts at zero,
 * rather than demonstrating someone else's total.
 */

export type OnboardingStepId =
  | "welcome" | "paths" | "bank" | "coach" | "intent" | "ready";

export interface OnboardingStep {
  id: OnboardingStepId;
  /** The headline, as two lines. Kept as written — it is approved copy. */
  headline: string;
  lede?: string;
  /** The primary control's label, where it differs from "Next". */
  cta?: string;
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: "welcome",
    headline: "HIGHER\nEVERY DAY",
    lede: "Train. Explore. Achieve.\nTurn everyday hills into extraordinary adventures.",
    cta: "Get started",
  },
  {
    id: "paths",
    headline: "TWO WAYS\nTO GO HIGHER",
    lede: "Choose your path, or explore both.",
  },
  {
    id: "bank",
    headline: "EVERY METRE\nCOUNTS.",
    lede: "Track your hikes.\nBuild your Elevation Bank.\nGrow your mountain experience.",
  },
  {
    id: "coach",
    headline: "YOUR AI\nMOUNTAIN COACH",
    lede: "Training that adapts to your mountain.",
  },
  {
    id: "intent",
    headline: "WHAT BRINGS\nYOU HERE?",
    lede: "This helps us personalise your experience.\nYou can change this anytime.",
  },
  {
    id: "ready",
    headline: "YOU'RE READY\nTO BEGIN",
    lede: "Mountains are closer than you think.",
    cta: "Continue to SummitReady",
  },
] as const;

/* ── Screen 2 · the two paths ───────────────────────────────────────────── */

export interface OnboardingPath {
  id: "training" | "expedition";
  title: string;
  body: string;
}

/**
 * Training and Expeditions are related but DIFFERENT products, and the copy
 * keeps them apart: training prepares you for a mountain you intend to climb;
 * an expedition is a legendary objective climbed through real local hills.
 * Nothing is chosen on this screen — it explains.
 */
export const ONBOARDING_PATHS: readonly OnboardingPath[] = [
  {
    id: "training",
    title: "Train for a specific mountain",
    body: "A personalised plan that builds your readiness for a real mountain you intend to climb.",
  },
  {
    id: "expedition",
    title: "Take on an expedition",
    body: "Turn the hills near you into stages of a bigger adventure, and climb towards an iconic objective.",
  },
] as const;

export const PATHS_FOOTNOTE =
  "You are not choosing permanently — both are always there.";

/* ── Screen 3 · the Elevation Bank ──────────────────────────────────────── */

export const BANK_POINTS: readonly { key: string; label: string }[] = [
  { key: "track", label: "Track any hike" },
  { key: "earn", label: "Earn elevation" },
  { key: "unlock", label: "Unlock achievements" },
] as const;

/** Said plainly, not in fine print. A new account has banked nothing. */
export const BANK_NOTE =
  "Your bank starts at zero and grows with every hike you record. "
  + "Only recorded outdoor ascent counts towards it.";

/* ── Screen 4 · the AI Coach ────────────────────────────────────────────── */

/**
 * The division of labour, stated on the screen rather than assumed.
 *
 * SummitReady's deterministic engines CALCULATE — readiness, rank, elevation,
 * route facts. The Coach INTERPRETS and communicates what they produced. It
 * does not invent any of them, and the screen says so in the user's words.
 */
export const COACH_POINTS: readonly { key: string; title: string; body: string }[] = [
  {
    key: "understands",
    title: "Understands your goal",
    body: "Tailored to the mountain and the route you are preparing for.",
  },
  {
    key: "learns",
    title: "Learns from your progress",
    body: "It reads the activities and training evidence you have actually recorded.",
  },
  {
    key: "guides",
    title: "Guides your next move",
    body: "Clear recommendations for what to do next, and why.",
  },
] as const;

export const COACH_BOUNDARY =
  "SummitReady's engines calculate your readiness, rank and elevation. "
  + "Your coach explains what they mean — it never invents a figure, a route "
  + "fact or a mountain fact.";

export const COACH_DISCLAIMER =
  "Coaching guidance, not a safety assessment. Always check conditions before you set off.";

/* ── Screen 5 · intent ──────────────────────────────────────────────────── */

export interface OnboardingIntent {
  id: "training" | "expedition" | "explore";
  title: string;
  why: string;
  /** Where the app opens afterwards, named on screen so it is no surprise. */
  destination: string;
}

export const ONBOARDING_INTENTS: readonly OnboardingIntent[] = [
  {
    id: "training",
    title: "I have a mountain in mind",
    why: "Set it as your goal and get a plan built around it.",
    destination: "Training Basecamp",
  },
  {
    id: "expedition",
    title: "I want a big objective",
    why: "Pick an expedition and climb it through the hills near you.",
    destination: "Expeditions",
  },
  {
    id: "explore",
    title: "I'm just getting started",
    why: "Look around, find hills near you and record your first hike.",
    destination: "Explore",
  },
] as const;

export const INTENT_FOOTNOTE =
  "Not a permanent choice — it only decides where you start.";

/* ── Screen 6 · the close ───────────────────────────────────────────────── */

export const READY_POINTS: readonly string[] = [
  "Train for real mountains using the hills near you",
  "Record every hike, online or off",
  "Build your Elevation Bank with every metre you climb",
] as const;

/** Where a chosen intent lands. Null means the app's usual starting point. */
export function destinationFor(intentId: string | null): OnboardingIntent | null {
  return ONBOARDING_INTENTS.find(intent => intent.id === intentId) ?? null;
}

/** The shell an intent implies. Explore stays in the training shell. */
export function shellForIntent(intentId: string | null): "training" | "expedition" {
  return intentId === "expedition" ? "expedition" : "training";
}

/** The route an intent opens. */
export function routeForIntent(intentId: string | null): string {
  if (intentId === "expedition") return "/(expedition)/mountains";
  if (intentId === "explore") return "/(tabs)/explore";
  return "/(tabs)/dashboard";
}

/** Where the flow is, as "3 of 6". */
export function stepPosition(id: OnboardingStepId): { index: number; total: number } {
  return {
    index: ONBOARDING_STEPS.findIndex(step => step.id === id),
    total: ONBOARDING_STEPS.length,
  };
}
