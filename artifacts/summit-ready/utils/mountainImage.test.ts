import { describe, expect, it } from "vitest";
import { appendApprovedImageRevision, hasApprovedMountainImage, mountainImageUri } from "./mountainImage";

describe("approved mountain image subjects", () => {
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
    expect(appendApprovedImageRevision(previous, "Matterhorn")).toBe(previous);
  });
});