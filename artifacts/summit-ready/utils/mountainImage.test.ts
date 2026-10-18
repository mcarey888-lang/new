import { afterEach, describe, expect, it, vi } from "vitest";
import { appendApprovedImageRevision, hasApprovedMountainImage, mountainImageUri } from "./mountainImage";

afterEach(() => vi.unstubAllGlobals());

describe("approved mountain image subjects", () => {
  it("escapes the September thumbnail cache while preserving mountain identity and dimensions", () => {
    const old = "/api/mountain-image?name=Ben%20Nevis&location=Scotland&width=520&height=480&mountainId=original-id&approvedHeroRevision=approved-30-20260925";
    const updated = appendApprovedImageRevision(old, "Ben Nevis");
    expect(updated).toBe(old.replace("approved-30-20260925", "approved-library-20261015"));
    expect(appendApprovedImageRevision(updated, "Ben Nevis")).toBe(updated);
  });

  it("refreshes route-labelled approved thumbnails without changing their subject", () => {
    const old = "/api/mountain-image?name=Snowdon&width=240&height=200";
    expect(appendApprovedImageRevision(old, "Snowdon"))
      .toBe(`${old}&approvedHeroRevision=approved-library-20261015`);
    expect(appendApprovedImageRevision(old, "Snowdon")).toBe(appendApprovedImageRevision(old, "Snowdon"));
  });
  it("recognizes the approved mountain collection and documented name variants", () => {
    const mountains = [
      "Ben Nevis",
      "Snowdon",
      "Scafell Pike",
      "Ben Lomond",
      "Helvellyn",
      "Tryfan",
      "Buachaille Etive Mor",
      "Cadair Idris",
      "Pen y Fan",
      "Old Man of Coniston",
      "Blencathra",
      "Great Gable",
      "Catbells",
      "Schiehallion",
      "Suilven",
      "Liathach",
      "An Teallach",
      "Ben Macdui",
      "Cairn Gorm",
      "Ben Aan",
      "The Cobbler",
      "Stac Pollaidh",
      "Aonach Eagach",
      "Crib Goch",
      "Glyder Fawr",
      "Kinder Scout",
      "Mam Tor",
      "Ingleborough",
      "Pen-y-ghent",
      "Roseberry Topping",
    ];

    for (const mountain of mountains) {
      expect(hasApprovedMountainImage(mountain), mountain).toBe(true);
    }
    expect(hasApprovedMountainImage("Yr Wyddfa")).toBe(true);
    expect(hasApprovedMountainImage("Buachaille Etive Mòr")).toBe(true);
    expect(hasApprovedMountainImage("Ben A'an")).toBe(true);
    expect(hasApprovedMountainImage("Tryfan North Ridge")).toBe(true);
    expect(hasApprovedMountainImage("Tryfan North Ridge to Glyder Fach")).toBe(false);
  });

  it("does not opt unrelated mountains into the curated-image override", () => {
    expect(hasApprovedMountainImage("Mount Everest")).toBe(false);
    expect(hasApprovedMountainImage("Ben")).toBe(false);
    expect(hasApprovedMountainImage("")).toBe(false);
    expect(hasApprovedMountainImage(null)).toBe(false);
  });

  it("builds the existing API image URL with responsive dimensions", () => {
    const uri = mountainImageUri("Yr Wyddfa", { width: 400, height: 280 });
    expect(uri).toContain("/api/mountain-image?name=Yr%20Wyddfa");
    expect(uri).toContain("&width=400&height=280");
    expect(uri).toContain("&approvedHeroRevision=");
    expect(mountainImageUri("  ")).toBeNull();
  });

  it("refreshes cached approved cards without changing route or location identity", () => {
    const previous = "/api/mountain-image?name=Snowdon&location=Snowdonia%2C%20Wales&routeIdentityKey=pyg";
    const refreshed = appendApprovedImageRevision(previous, "Snowdon");
    expect(refreshed).toContain("location=Snowdonia%2C%20Wales&routeIdentityKey=pyg&approvedHeroRevision=");
    expect(appendApprovedImageRevision(refreshed, "Snowdon")).toBe(refreshed);
    expect(appendApprovedImageRevision(previous, "Matterhorn")).toContain("&approvedHeroRevision=");
  });

  it("uses the same approved-aware mountain endpoint in previews and installed builds", () => {
    vi.stubGlobal("__DEV__", true);
    const previous = "/api/mountain-image?name=Matterhorn&width=800&height=300";
    expect(appendApprovedImageRevision(previous, "Matterhorn"))
      .toContain(`${previous}&approvedHeroRevision=`);
    expect(mountainImageUri("Matterhorn"))
      .toContain("/api/mountain-image?name=Matterhorn");
    vi.stubGlobal("__DEV__", false);
    for (const mountain of ["Mont Blanc", "Matterhorn", "Kilimanjaro", "Mount Kilimanjaro"]) {
      expect(hasApprovedMountainImage(mountain)).toBe(true);
      expect(mountainImageUri(mountain)).toContain("&approvedHeroRevision=");
    }
  });
});