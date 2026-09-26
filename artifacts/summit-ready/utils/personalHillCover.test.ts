import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  journeyPhotoKey, personalHillCoverKey, readPersonalHillCover, savePersonalHillCover,
} from "./personalHillCover";
import AsyncStorage from "@react-native-async-storage/async-storage";

const entries = vi.hoisted(() => new Map<string, string>());
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => entries.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { entries.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { entries.delete(key); }),
  },
}));

describe("personal hill covers", () => {
  const hill = { name: "Pendle Hill", latitude: 53.869, longitude: -2.299 };
  beforeEach(() => entries.clear());

  it("keeps covers separate for each owner and geographic identity", () => {
    expect(personalHillCoverKey("owner-a", hill)).not.toBe(personalHillCoverKey("owner-b", hill));
    expect(personalHillCoverKey("owner-a", hill)).not.toBe(personalHillCoverKey("owner-a", { ...hill, longitude: -3 }));
  });

  it("will not assign a cover to a hill with no stable identity", () => {
    expect(personalHillCoverKey("owner-a", { name: "Pendle Hill" })).toBeNull();
    expect(personalHillCoverKey(null, hill)).toBeNull();
  });

  it("shows a cover only to its owner while the chosen photo remains in that journey", async () => {
    const key = journeyPhotoKey("owner-a", "expedition-a");
    await AsyncStorage.setItem(key, JSON.stringify([{ id: "photo-1", uri: "file:///private/photo.jpg" }]));
    expect(await savePersonalHillCover("owner-a", hill, "expedition-a", "photo-1")).toBe(true);
    expect(await readPersonalHillCover("owner-a", hill)).toBe("file:///private/photo.jpg");
    expect(await readPersonalHillCover("owner-b", hill)).toBeNull();
    await AsyncStorage.setItem(key, "[]");
    expect(await readPersonalHillCover("owner-a", hill)).toBeNull();
  });

  it("does not select a photo that has been removed", async () => {
    expect(await savePersonalHillCover("owner-a", hill, "expedition-a", "missing")).toBe(false);
  });
});