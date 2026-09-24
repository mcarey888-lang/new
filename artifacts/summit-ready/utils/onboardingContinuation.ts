import { routeForIntent, shellForIntent } from "./onboardingSteps";

export const ONBOARDING_PENDING_INTENT_KEY = "summitready:onboarding-pending-intent";
export const ONBOARDING_INTENT_TTL_MS = 24 * 60 * 60 * 1000;

export type PendingOnboardingIntentId = "training" | "expedition" | "explore" | null;

export interface OnboardingStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type PendingIntentResult =
  | { status: "restored"; intentId: PendingOnboardingIntentId }
  | { status: "missing" | "invalid" | "stale" | "storage-error" };

const VALID_INTENTS = new Set(["training", "expedition", "explore"]);

function isIntentId(value: unknown): value is PendingOnboardingIntentId {
  return value === null || (typeof value === "string" && VALID_INTENTS.has(value));
}

export async function savePendingOnboardingIntent(
  storage: Pick<OnboardingStorage, "setItem">,
  intentId: string | null,
  now = Date.now(),
): Promise<void> {
  if (!isIntentId(intentId)) throw new Error("Invalid onboarding destination.");
  await storage.setItem(ONBOARDING_PENDING_INTENT_KEY, JSON.stringify({
    intentId,
    expiresAt: now + ONBOARDING_INTENT_TTL_MS,
  }));
}

/** Reads and removes the intent before exposing it to navigation code. */
export async function consumePendingOnboardingIntent(
  storage: Pick<OnboardingStorage, "getItem" | "removeItem">,
  now = Date.now(),
): Promise<PendingIntentResult> {
  let raw: string | null;
  try {
    raw = await storage.getItem(ONBOARDING_PENDING_INTENT_KEY);
  } catch {
    return { status: "storage-error" };
  }
  if (raw === null) return { status: "missing" };

  let result: PendingIntentResult;
  try {
    const pending: unknown = JSON.parse(raw);
    if (!pending || typeof pending !== "object") {
      result = { status: "invalid" };
    } else {
      const record = pending as Record<string, unknown>;
      if (!isIntentId(record.intentId) || typeof record.expiresAt !== "number"
        || !Number.isFinite(record.expiresAt)) {
        result = { status: "invalid" };
      } else if (record.expiresAt <= now) {
        result = { status: "stale" };
      } else {
        result = { status: "restored", intentId: record.intentId };
      }
    }
  } catch {
    result = { status: "invalid" };
  }

  try {
    await storage.removeItem(ONBOARDING_PENDING_INTENT_KEY);
  } catch {
    // Never navigate using an intent that could be replayed on the next launch.
    return { status: "storage-error" };
  }
  return result;
}

export interface OnboardingContinuationDependencies {
  storage: OnboardingStorage;
  setShellMode(mode: "training" | "expedition"): Promise<void>;
  navigateToAuth(route: "/(auth)/sign-up"): void;
  navigateToDestination(route: string): void;
}

/** Shared by Finish and Skip so both actions preserve the same auth intent. */
export async function continueFromOnboarding(
  _action: "finish" | "skip",
  isSignedIn: boolean,
  intentId: string | null,
  dependencies: OnboardingContinuationDependencies,
): Promise<void> {
  if (!isIntentId(intentId)) throw new Error("Invalid onboarding destination.");
  if (!isSignedIn) {
    await savePendingOnboardingIntent(dependencies.storage, intentId);
    dependencies.navigateToAuth("/(auth)/sign-up");
    return;
  }

  await dependencies.setShellMode(shellForIntent(intentId));
  dependencies.navigateToDestination(routeForIntent(intentId));
}

export async function restorePendingOnboardingIntent(
  storage: Pick<OnboardingStorage, "getItem" | "removeItem">,
  dependencies: {
    setShellMode(mode: "training" | "expedition"): Promise<void>;
    navigateToDestination(route: string): void;
  },
  now = Date.now(),
): Promise<PendingIntentResult> {
  const pending = await consumePendingOnboardingIntent(storage, now);
  if (pending.status === "restored") {
    await dependencies.setShellMode(shellForIntent(pending.intentId));
    dependencies.navigateToDestination(routeForIntent(pending.intentId));
  }
  return pending;
}

export function shouldStartSignedInLandingRedirect(
  authLoaded: boolean,
  isSignedIn: boolean | undefined,
  appLoading: boolean,
  alreadyStarted: boolean,
): boolean {
  return authLoaded && isSignedIn === true && !appLoading && !alreadyStarted;
}

export function shouldResetLandingRedirectForUser(
  isSignedIn: boolean | undefined,
  userId: string | undefined,
  redirectedUserId: string | null,
): boolean {
  return isSignedIn === true && !!userId && userId !== redirectedUserId;
}

/** An owned active hike takes priority; leave onboarding intent untouched. */
export async function restorePendingAfterActiveHike(
  recoverActiveHike: () => Promise<boolean>,
  restorePendingIntent: () => Promise<PendingIntentResult>,
): Promise<"active-hike" | PendingIntentResult> {
  if (await recoverActiveHike()) return "active-hike";
  return restorePendingIntent();
}