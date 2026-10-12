import AsyncStorage from "@react-native-async-storage/async-storage";

export interface PlannerDraft {
  anchors: Array<{ lat: number; lng: number }>;
  geometry: Array<{ lat: number; lng: number }>;
  legs: Array<{ kind: "routed" | "gap" | "offPath" | "straight" | "pending"; lengthM: number | null }>;
  lengthM: number;
  ascentM: number | null;
  descentM: number | null;
  fullySnapped: boolean;
}
const key = (owner: string) => `planner-draft:${encodeURIComponent(owner)}`;
export async function savePlannerDraft(owner: string, value: unknown) {
  const d = value as PlannerDraft;
  if (!owner || !d || !Array.isArray(d.geometry) || d.geometry.length < 2 ||
      !Array.isArray(d.anchors) || !Array.isArray(d.legs) || !Number.isFinite(d.lengthM) ||
      !d.geometry.every(p => Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 &&
        Number.isFinite(p.lng) && Math.abs(p.lng) <= 180)) throw new Error("The drawn route has no usable geometry.");
  await AsyncStorage.setItem(key(owner), JSON.stringify(d));
}
export async function readPlannerDraft(owner: string): Promise<PlannerDraft | null> {
  const value = await AsyncStorage.getItem(key(owner));
  return value ? JSON.parse(value) : null;
}
