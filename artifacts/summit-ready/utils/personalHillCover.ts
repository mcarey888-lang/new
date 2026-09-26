import AsyncStorage from "@react-native-async-storage/async-storage";

export type HillCoverIdentity = {
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  routeIdentityKey?: string | null;
  summitIdentityKey?: string | null;
};

export type JourneyPhoto = { id: string; uri: string };
type CoverSelection = { expeditionId: string; photoId: string };

export function personalHillCoverKey(ownerId: string | null | undefined, hill: HillCoverIdentity): string | null {
  if (!ownerId || !hill.name?.trim()) return null;
  const lat = hill.latitude;
  const lng = hill.longitude;
  const identity = hill.routeIdentityKey?.trim() || hill.summitIdentityKey?.trim()
    || (typeof lat === "number" && Number.isFinite(lat) && Math.abs(lat) <= 90 &&
        typeof lng === "number" && Number.isFinite(lng) && Math.abs(lng) <= 180
      ? `${lat.toFixed(5)}:${lng.toFixed(5)}`
      : null);
  if (!identity) return null;
  return `summitready:hill-cover:${ownerId}:${encodeURIComponent(identity)}`;
}

export function journeyPhotoKey(ownerId: string, expeditionId: string): string {
  return `summitready:expedition-journal:${ownerId}:${expeditionId}`;
}

export async function readJourneyPhotos(ownerId: string, expeditionId: string): Promise<JourneyPhoto[]> {
  try {
    const raw = await AsyncStorage.getItem(journeyPhotoKey(ownerId, expeditionId));
    if (!raw) return [];
    const saved: unknown = JSON.parse(raw);
    if (!Array.isArray(saved)) return [];
    return saved.filter((item): item is JourneyPhoto =>
      !!item && typeof item.id === "string" && typeof item.uri === "string" && !!item.uri);
  } catch {
    return [];
  }
}

/** A private reference, not a copy or a public upload. A removed journal photo stops being a cover. */
export async function readPersonalHillCover(
  ownerId: string | null | undefined,
  hill: HillCoverIdentity,
): Promise<string | null> {
  const key = personalHillCoverKey(ownerId, hill);
  if (!key || !ownerId) return null;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const selected: CoverSelection = JSON.parse(raw);
    if (typeof selected.expeditionId !== "string" || typeof selected.photoId !== "string") return null;
    const photos = await readJourneyPhotos(ownerId, selected.expeditionId);
    return photos.find(photo => photo.id === selected.photoId)?.uri ?? null;
  } catch {
    return null;
  }
}

export async function savePersonalHillCover(
  ownerId: string,
  hill: HillCoverIdentity,
  expeditionId: string,
  photoId: string,
): Promise<boolean> {
  const key = personalHillCoverKey(ownerId, hill);
  if (!key || !expeditionId || !photoId) return false;
  const photos = await readJourneyPhotos(ownerId, expeditionId);
  if (!photos.some(photo => photo.id === photoId)) return false;
  await AsyncStorage.setItem(key, JSON.stringify({ expeditionId, photoId } satisfies CoverSelection));
  return true;
}

export async function clearPersonalHillCover(ownerId: string, hill: HillCoverIdentity): Promise<void> {
  const key = personalHillCoverKey(ownerId, hill);
  if (key) await AsyncStorage.removeItem(key);
}