import AsyncStorage from "@react-native-async-storage/async-storage";
import { getActivityAudiencePreference } from "@workspace/api-client-react";
import { enqueueSyncPending, retrySyncOutbox } from "./syncOutbox";
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
  const result = await getActivityAudiencePreference({ headers: authenticatedHeaders(token) });
  const value = result.audience as ActivityAudience | null;
  if (value) await AsyncStorage.setItem(key(owner), value);
  return value;
}
export async function saveActivityAudience(owner: string, audience: ActivityAudience, getToken: () => Promise<string | null>) {
  await AsyncStorage.setItem(key(owner), audience);
  await enqueueSyncPending(owner, { id: "activity-audience-default", kind: "activity-preference", method: "PUT",
    url: `${activityApiBase}/activity-community/preferences`, body: { audience } });
  void retrySyncOutbox(owner, getToken).catch(() => {});
}
