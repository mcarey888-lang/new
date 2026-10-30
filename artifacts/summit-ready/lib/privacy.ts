import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { PRIVACY_KEY, parsePrivacyChoice, permits, type PrivacyChoice } from "../utils/privacyConsent";

let choice: PrivacyChoice | null = null;
let loaded = false;
let revision = 0;
const listeners = new Set<() => void>();
const requests = new Set<AbortController>();
let nativeQueue = Promise.resolve();
export const privacySnapshot = () => choice;
export const privacyLoaded = () => loaded;
export const subscribePrivacy = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const notify = () => listeners.forEach(listener => listener());
export const optionalAllowed = (purpose: "analytics" | "advertising") => permits(choice, purpose);
export function optionalRequest(): AbortController {
  const controller = new AbortController();
  requests.add(controller);
  return controller;
}
export function releaseOptionalRequest(controller: AbortController) { requests.delete(controller); }

async function configureNative(expectedRevision: number): Promise<void> {
  if (Platform.OS === "web") return;
  const sdk = (await import("@react-native-firebase/analytics")).default();
  await sdk.setAnalyticsCollectionEnabled(false);
  // Google advertising identifiers and signals remain off even when Reddit
  // measurement is chosen. iOS does not use the Reddit relay.
  await sdk.setConsent({
    analyticsStorage: optionalAllowed("analytics"),
    adStorage: false, adUserData: false, adPersonalization: false,
  });
  if (expectedRevision === revision && optionalAllowed("analytics")) {
    await sdk.setAnalyticsCollectionEnabled(true);
  } else if (!optionalAllowed("analytics")) {
    await sdk.resetAnalyticsData();
  }
}
function queueNative() {
  const expected = revision;
  const operation = nativeQueue.catch(() => {}).then(() => configureNative(expected));
  nativeQueue = operation;
  return operation;
}
export const privacyReady = AsyncStorage.getItem(PRIVACY_KEY)
  .then(async raw => {
    choice = parsePrivacyChoice(raw);
  })
  .catch(() => { choice = null; }) // A failed initialisation is not consent.
  .finally(() => { loaded = true; notify(); });

let nativeInitialisation: Promise<void> | undefined;
export function initialiseNativePrivacy() {
  return nativeInitialisation ??= privacyReady.then(() => queueNative());
}

/** Read existing identifiers only for the person's erasure request. Never
 * generate a Reddit identifier or enable an SDK to obtain one. */
export async function privacyErasureIdentifiers(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const reddit = await AsyncStorage.getItem("analytics_install_id_v1").catch(() => null);
  if (reddit) result.redditInstallationId = reddit;
  if (Platform.OS !== "web" && optionalAllowed("analytics")) {
    try {
      const sdk = (await import("@react-native-firebase/analytics")).default();
      const id = await sdk.getAppInstanceId();
      if (id) result.firebaseAppInstanceId = id;
    } catch { /* Provider review remains pending when an identifier is unavailable. */ }
  }
  return result;
}

export async function savePrivacyChoice(analytics: boolean, advertising: boolean): Promise<void> {
  await privacyReady;
  // Fence JS emission and abort outstanding relay requests before asynchronous
  // storage/SDK operations. No past events are replayed after an opt-in.
  revision += 1;
  requests.forEach(controller => controller.abort());
  requests.clear();
  choice = { version: 1, analytics, advertising };
  notify();
  try {
    // Remove a prior grant first: a failed write must not resurrect that grant
    // on the next launch. A failed removal is surfaced to the person.
    await AsyncStorage.removeItem(PRIVACY_KEY);
    await queueNative();
    await AsyncStorage.setItem(PRIVACY_KEY, JSON.stringify(choice));
    if (!advertising) await AsyncStorage.multiRemove(["analytics_install_id_v1", "reddit_first_open_sent_v1"]);
  } catch (error) {
    choice = { version: 1, analytics: false, advertising: false };
    revision += 1;
    notify();
    await queueNative().catch(() => {});
    await AsyncStorage.removeItem(PRIVACY_KEY).catch(() => {});
    throw error;
  }
}
