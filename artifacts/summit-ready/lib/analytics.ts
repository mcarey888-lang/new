import { useEffect } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { optionalAllowed, privacyReady, optionalRequest, releaseOptionalRequest, initialiseNativePrivacy } from "./privacy";

/**
 * Consent-gated native usage analytics. Reddit remains Android-only and has
 * an independent advertising-measurement choice. Unknown/declined choices
 * never emit or queue events. Errors cannot block essential app functionality.
 */

type EventParams = Record<string, string | number | boolean | undefined>;

type RedditEventName =
  | "first_open"
  | "readiness_test_completed"
  | "readiness_score_viewed"
  | "subscription_started"
  | "purchase";

const INSTALL_ID_KEY = "analytics_install_id_v1";
const FIRST_OPEN_SENT_KEY = "reddit_first_open_sent_v1";

async function getInstallId(): Promise<string> {
  const existing = await AsyncStorage.getItem(INSTALL_ID_KEY);
  if (existing) return existing;
  const created = Crypto.randomUUID();
  await AsyncStorage.setItem(INSTALL_ID_KEY, created);
  return created;
}

/** Best-effort server relay. Reddit credentials are never present in this bundle. */
async function mirrorToReddit(
  eventName: RedditEventName,
  metadata?: { plan?: string; value?: number; currency?: string },
): Promise<boolean> {
  await privacyReady;
  if (!isAndroid() || !optionalAllowed("advertising")) return false;
  const controller = optionalRequest();
  try {
    const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "summitready.uk";
    const installId = await getInstallId();
    if (!optionalAllowed("advertising") || controller.signal.aborted) return false;
    const response = await fetch(`https://${domain}/api/reddit-conversions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        eventAt: Date.now(),
        conversionId: Crypto.randomUUID(),
        installId,
        advertisingConsent: true,
        ...metadata,
      }),
      signal: controller.signal,
    });
    return response.ok;
  } catch (err) {
    if (__DEV__) console.warn(`[analytics] Failed to mirror "${eventName}" to Reddit`, err);
    return false;
  } finally {
    releaseOptionalRequest(controller);
    if (!optionalAllowed("advertising")) {
      await AsyncStorage.removeItem(INSTALL_ID_KEY).catch(() => {});
    }
  }
}

/** Mirrors Firebase's automatic first_open once per app installation. Retries after failures. */
export async function logFirstOpenForReddit(): Promise<void> {
  await privacyReady;
  if (!isAndroid() || !optionalAllowed("advertising")) return;
  if ((await AsyncStorage.getItem(FIRST_OPEN_SENT_KEY)) === "1") return;
  if (await mirrorToReddit("first_open") && optionalAllowed("advertising")) {
    await AsyncStorage.setItem(FIRST_OPEN_SENT_KEY, "1");
  }
}

function isAndroid(): boolean {
  return Platform.OS === "android";
}

async function getAnalyticsInstance() {
  await initialiseNativePrivacy();
  const analyticsModule = await import("@react-native-firebase/analytics");
  return analyticsModule.default();
}

/** Consent-gated Firebase event with a deliberately narrow parameter allowlist. */
export async function logAnalyticsEvent(name: string, params?: EventParams): Promise<void> {
  await privacyReady;
  if (Platform.OS === "web" || !optionalAllowed("analytics")) return;
  try {
    const analytics = await getAnalyticsInstance();
    if (!optionalAllowed("analytics")) return;
    // Never send location names, readiness scores or coaching text as analytics.
    const permitted = new Set(["method", "plan", "value", "currency"]);
    const safe = Object.fromEntries(Object.entries(params ?? {}).filter(([key]) => permitted.has(key)));
    await analytics.logEvent(name, safe);
  } catch (err) {
    if (__DEV__) {
      console.warn(`[analytics] Failed to log event "${name}"`, err);
    }
  }
}

/** Consent-gated native screen_view. */
export async function logScreenView(screenName: string, screenClass?: string): Promise<void> {
  await privacyReady;
  if (Platform.OS === "web" || !optionalAllowed("analytics")) return;
  try {
    const analytics = await getAnalyticsInstance();
    if (!optionalAllowed("analytics")) return;
    await analytics.logScreenView({
      screen_name: screenName,
      screen_class: screenClass ?? screenName,
    });
  } catch (err) {
    if (__DEV__) {
      console.warn(`[analytics] Failed to log screen_view "${screenName}"`, err);
    }
  }
}

/**
 * Reusable hook — fires `logScreenView` once when the screen component
 * mounts. For stack screens (auth, setup, paywall, etc.) a fresh mount
 * happens on every navigation, so this is a true per-visit screen_view.
 * For bottom-tab screens (kept mounted by the navigator after first visit),
 * this fires once per tab per app session rather than on every re-focus —
 * a deliberate simplification to avoid depending on internal navigation
 * hooks not already used elsewhere in this codebase.
 */
export function useScreenView(screenName: string, screenClass?: string): void {
  useEffect(() => {
    logScreenView(screenName, screenClass);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ── Named event helpers (19 events) ─────────────────────────────────────────

/** App was opened / became ready to use. */
export function logAppOpen(): Promise<void> {
  return logAnalyticsEvent("app_open");
}

/** A new account was created. */
export function logSignUp(method: "email" | "google" | "apple"): Promise<void> {
  return logAnalyticsEvent("sign_up", { method });
}

/** An existing user signed in. */
export function logLogin(method: "email" | "email_mfa" | "google" | "apple"): Promise<void> {
  return logAnalyticsEvent("login", { method });
}

/** The readiness/fitness questionnaire was completed. */
export function logReadinessTestCompleted(params: {
  readiness_score?: number;
  fitness_level?: string;
}): Promise<void> {
  void mirrorToReddit("readiness_test_completed");
  return logAnalyticsEvent("readiness_test_completed", params);
}

/** A summit/mountain target was selected. */
export function logMountainSelected(params: {
  mountain_name: string;
  difficulty?: string;
}): Promise<void> {
  return logAnalyticsEvent("mountain_selected", params);
}

/** A personalised training plan was generated for a goal. */
export function logTrainingPlanGenerated(params: {
  mountain_name: string;
  weeks?: number;
}): Promise<void> {
  return logAnalyticsEvent("training_plan_generated", params);
}

/** A hill training session (live GPS tracked) was started. */
export function logHillSessionStarted(params?: { hill_name?: string }): Promise<void> {
  return logAnalyticsEvent("hill_session_started", params);
}

/** A hill training session was completed (either live-tracked or manually logged). */
export function logHillSessionCompleted(params?: {
  hill_name?: string;
  elevation_gain?: number;
  reps?: number;
  source?: "gps_tracked" | "manual";
}): Promise<void> {
  return logAnalyticsEvent("hill_session_completed", params);
}

/** A generic training-plan workout was started. Currently unused — see report. */
export function logWorkoutStarted(params?: { workout_type?: string }): Promise<void> {
  return logAnalyticsEvent("workout_started", params);
}

/** A generic training-plan workout was marked complete. */
export function logWorkoutCompleted(params?: {
  workout_type?: string;
  week_number?: number;
}): Promise<void> {
  return logAnalyticsEvent("workout_completed", params);
}

/** A GPS-tracked hike was recorded/saved. */
export function logHikeTracked(params?: {
  distance_km?: number;
  elevation_gain?: number;
  duration_min?: number;
}): Promise<void> {
  return logAnalyticsEvent("hike_tracked", params);
}

/** The AI coach was used (assessment or a direct question). */
export function logAiCoachUsed(params?: {
  interaction_type?: "ask" | "assessment";
}): Promise<void> {
  return logAnalyticsEvent("ai_coach_used", params);
}

/** A challenge was started. */
export function logChallengeStarted(params: { challenge_id: string }): Promise<void> {
  return logAnalyticsEvent("challenge_started", params);
}

/** A challenge was completed. */
export function logChallengeCompleted(params: { challenge_id: string }): Promise<void> {
  return logAnalyticsEvent("challenge_completed", params);
}

/** The readiness score was viewed on the dashboard. */
export function logReadinessScoreViewed(params: { readiness_score: number }): Promise<void> {
  void mirrorToReddit("readiness_score_viewed");
  return logAnalyticsEvent("readiness_score_viewed", params);
}

/** The readiness score improved after logging activity. */
export function logReadinessScoreImproved(params: {
  readiness_score: number;
  previous_score: number;
}): Promise<void> {
  return logAnalyticsEvent("readiness_score_improved", params);
}

/** A free-trial subscription period was started. */
export function logTrialStarted(params?: { plan?: string }): Promise<void> {
  void mirrorToReddit("subscription_started", { plan: params?.plan });
  return logAnalyticsEvent("trial_started", params);
}

/** A paid subscription was started (non-trial). */
export function logSubscriptionStarted(params?: { plan?: string }): Promise<void> {
  void mirrorToReddit("subscription_started", { plan: params?.plan });
  return logAnalyticsEvent("subscription_started", params);
}

/** A confirmed, non-trial store purchase. Firebase remains the primary event store. */
export function logPurchase(params: { plan?: string; value?: number; currency?: string }): Promise<void> {
  void mirrorToReddit("purchase", params);
  return logAnalyticsEvent("purchase", {
    transaction_id: Crypto.randomUUID(),
    item_id: params.plan,
    value: params.value,
    currency: params.currency,
  });
}

/** A subscription was cancelled. Currently unused — see report. */
export function logSubscriptionCancelled(params?: { plan?: string }): Promise<void> {
  return logAnalyticsEvent("subscription_cancelled", params);
}
