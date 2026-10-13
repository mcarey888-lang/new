import AsyncStorage from "@react-native-async-storage/async-storage";
const key = (owner: string) => `summitready_deleted_recordings_v1_${owner}`;
export async function deletedRecordingIds(owner: string): Promise<Set<string>> {
  return new Set(JSON.parse(await AsyncStorage.getItem(key(owner)) ?? "[]") as string[]);
}
/** Call inside the library write lock. Do not age out tombstones. */
export async function rememberRecordingDeletion(owner: string, id: string): Promise<void> {
  const ids = await deletedRecordingIds(owner);
  ids.add(id);
  await AsyncStorage.setItem(key(owner), JSON.stringify([...ids]));
}
