import AsyncStorage from "@react-native-async-storage/async-storage";
import { getActivityAudiencePreference } from "@workspace/api-client-react";
import { enqueueSyncPending, retrySyncOutbox, readOutbox } from "./syncOutbox";
import { authenticatedHeaders } from "./authRequest";

export type ActivityAudience = "public" | "followers" | "private";
export const ACTIVITY_AUDIENCES: Array<{ value: ActivityAudience; label: string }> = [
  { value: "public", label: "Public" }, { value: "followers", label: "Followers only" }, { value: "private", label: "Only me" },
];
const key = (owner: string) => `activity-audience:${encodeURIComponent(owner)}`;
export const activityApiBase = process.env.EXPO_PUBLIC_MAP_BASE ??
  (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api` : "/api");
export async function readActivityAudience(owner: string): Promise<ActivityAudience | null> {
  const value = await AsyncStorage.getItem(key(owner));
  return value === "public" || value === "followers" || value === "private" ? value : null;
}
export async function refreshActivityAudience(owner: string, token: string): Promise<ActivityAudience | null> {
  // A local offline choice is newer than the server until its upload is
  // acknowledged. A second-device refresh must not undo that pending choice.
  if ((await readOutbox(owner)).some(item => item.kind === "activity-preference"))
    return readActivityAudience(owner);
  const result = await getActivityAudiencePreference({ headers: authenticatedHeaders(token) });
  const value = result.audience as ActivityAudience | null;
  if (value) await AsyncStorage.setItem(key(owner), value);
  return value;
}
export async function loadActivityAudience(owner: string, getToken: () => Promise<string | null>): Promise<ActivityAudience | null> {
  const local = await readActivityAudience(owner);
  try {
    const token = await getToken();
    return token ? await refreshActivityAudience(owner, token) : local;
  } catch { return local; } // Offline recording keeps its explicitly chosen default.
}
export async function saveActivityAudience(owner: string, audience: ActivityAudience, getToken: () => Promise<string | null>) {
  await AsyncStorage.setItem(key(owner), audience);
  await enqueueSyncPending(owner, { id: "activity-audience-default", kind: "activity-preference", method: "PUT",
    url: `${activityApiBase}/activity-community/preferences`, body: { audience } });
  void retrySyncOutbox(owner, getToken).catch(() => {});
}
