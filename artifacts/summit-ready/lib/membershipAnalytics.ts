import AsyncStorage from "@react-native-async-storage/async-storage";
import { logAnalyticsEvent } from "@/lib/analytics";

const pending = new Set<string>();

/** Owner-scoped milestone/receipt deduplication. Identity stays local, never in
 * marketing properties. Only non-sensitive, explicitly supplied properties go out. */
export async function onceMembershipAnalytics(
  owner: string | null | undefined, event: string, identity: string,
  emit: () => Promise<unknown>,
) {
  const key = `membership_analytics_${owner ?? "guest"}_${event}_${identity}`;
  if (pending.has(key)) return;
  pending.add(key);
  try {
    if (await AsyncStorage.getItem(key)) return;
    await emit();
    await AsyncStorage.setItem(key, "1");
  } catch {
    // Analytics must never block or invalidate an activity/purchase.
  } finally {
    pending.delete(key);
  }
}

export function logMembershipOnce(
  owner: string | null | undefined, event: string,
  properties: Record<string, string | number | boolean> = {}, identity = "first",
) {
  return onceMembershipAnalytics(owner, event, identity, () => logAnalyticsEvent(event, properties));
}
