import { describe, expect, it } from "vitest";
import { approvedFeaturedMountainId } from "../services/mountain/approvedFeaturedMountainIdentity.js";

describe("approved featured mountain identity", () => {
  it("recognizes each of the thirty approved subjects without merging their identities", () => {
    const subjects = [
      "Ben Nevis", "Snowdon / Yr Wyddfa", "Scafell Pike", "Ben Lomond",
      "Helvellyn", "Tryfan", "Buachaille Etive Mòr", "Cadair Idris / Cader Idris",
      "Pen y Fan", "Old Man of Coniston", "Blencathra", "Great Gable", "Catbells",
      "Schiehallion", "Suilven", "Liathach", "An Teallach", "Ben Macdui",
      "Cairn Gorm", "Ben A'an", "The Cobbler / Ben Arthur", "Stac Pollaidh",
      "Aonach Eagach", "Crib Goch", "Glyder Fawr", "Kinder Scout", "Mam Tor",
      "Ingleborough", "Pen-y-ghent", "Roseberry Topping",
    ];
    const ids = subjects.map(subject => approvedFeaturedMountainId(subject));
    expect(ids).toHaveLength(30);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(30);
  });

  it("resolves app names, regional variants and explicitly named routes", () => {
    expect(approvedFeaturedMountainId("Snowdon / Yr Wyddfa")).toBe("d2e4f6b3-d992-4ed4-9622-4ab05c6ef1dd");
    expect(approvedFeaturedMountainId("Buachaille Etive Mòr")).toBe("03d78457-5527-4fcc-ae4b-33897f8ca8d3");
    expect(approvedFeaturedMountainId("Pen y Ghent")).toBe("8e90bcd9-35a9-456c-aee5-1ceb9a9a67b7");
    expect(approvedFeaturedMountainId("Tryfan North Ridge", "Wales")).toBe("76187fe7-2d70-452f-b89e-73526af374a4");
  });

  it("does not redirect unrelated routes or contradictory locations", () => {
    expect(approvedFeaturedMountainId("Tryfan North Ridge to Glyder Fach")).toBeNull();
    expect(approvedFeaturedMountainId("Tryfan North Top")).toBeNull();
    expect(approvedFeaturedMountainId("Ben Nevis", "Wales")).toBeNull();
    expect(approvedFeaturedMountainId("Ben More")).toBeNull();
  });
});