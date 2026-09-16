import AsyncStorage from "@react-native-async-storage/async-storage";

export const PENDING_HIKE_SELECTION_KEY = "summitready_pending_hike_selection_v1";
const mutations = new Map<string, Promise<void>>();

export interface PendingHikeSelection {
  userId: string;
  routeName: string;
  trackingMode: string | null;
  expeditionId: string | null;
  routeIdentityKey?: string;
  summitIdentityKey?: string;
  objectiveType?: string;
  stageSnapshot?: Record<string, unknown>;
  savedAt: number;
}

export async function savePendingHikeSelection(selection: PendingHikeSelection): Promise<void> {
  const key = `${PENDING_HIKE_SELECTION_KEY}_${selection.userId}`;
  const previous = mutations.get(key) ?? Promise.resolve();
  const next = previous.then(() => AsyncStorage.setItem(key, JSON.stringify(selection)));
  mutations.set(key, next.catch(() => {}));
  await next;
  if (mutations.get(key) === next) mutations.delete(key);
}

export async function readPendingHikeSelection(userId: string): Promise<PendingHikeSelection | null> {
  const key = `${PENDING_HIKE_SELECTION_KEY}_${userId}`;
  await mutations.get(key);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const selection = JSON.parse(raw) as PendingHikeSelection;
    if (selection.userId !== userId) return null;
    return selection;
  } catch {
    return null;
  }
}

export async function clearPendingHikeSelection(userId: string): Promise<void> {
  const key = `${PENDING_HIKE_SELECTION_KEY}_${userId}`;
  const previous = mutations.get(key) ?? Promise.resolve();
  const next = previous.then(() => AsyncStorage.removeItem(key));
  mutations.set(key, next.catch(() => {}));
  await next;
  if (mutations.get(key) === next) mutations.delete(key);
}