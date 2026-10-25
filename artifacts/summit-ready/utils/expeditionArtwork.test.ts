import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { approvedExpeditionArtwork } from "./expeditionArtwork";

const challenge = { challengeId: "SIG053", approved: true, imageVersion: 1,
  heroImage: "/api/artwork/image/SIG053/hero", cardImage: "/api/artwork/image/SIG053/card",
  thumbnailImage: "/api/artwork/image/SIG053/thumbnail" };
describe("exact expedition artwork selection", () => {
  it("uses Welsh Mont Blanc's approved composition rather than generic Mont Blanc art", () => {
    expect(approvedExpeditionArtwork(challenge, "hero", "https://example.com/api"))
      .toBe("https://example.com/api/artwork/image/SIG053/hero?approved=1&artwork=expedition-v1&v=1");
  });
  it("selects the appropriate approved crop and preserves artifact-relative API paths", () => {
    expect(approvedExpeditionArtwork(challenge, "card", "/api")).toContain("/api/artwork/image/SIG053/card?");
    expect(approvedExpeditionArtwork(challenge, "thumbnail", "/api")).toContain("/api/artwork/image/SIG053/thumbnail?");
    expect(approvedExpeditionArtwork({ ...challenge, thumbnailImage: null }, "thumbnail", "/api"))
      .toContain("/api/artwork/image/SIG053/card?");
  });
  it("never serves pending/rejected art or another expedition's image", () => {
    expect(approvedExpeditionArtwork({ ...challenge, approved: false }, "hero", "/api")).toBeNull();
    expect(approvedExpeditionArtwork({ ...challenge, heroImage: "/api/artwork/image/SIG051/hero",
      cardImage: null }, "hero", "/api")).toBeNull();
    expect(approvedExpeditionArtwork(null, "hero", "/api")).toBeNull();
  });
  it("updates the rollout URL on image version changes without random cache busting", () => {
    expect(approvedExpeditionArtwork({ ...challenge, imageVersion: 2 }, "hero", "/api")).toContain("&v=2");
    expect(approvedExpeditionArtwork(challenge, "hero", "/api"))
      .toBe(approvedExpeditionArtwork(challenge, "hero", "/api"));
  });
  it("wires approved expedition artwork into details, browse, Basecamp and completion", () => {
    for (const path of ["../components/ChallengeDetailSheet.tsx", "../components/ExpeditionMountainsScreen.tsx",
      "../app/(expedition)/base-camp.tsx", "../app/(expedition)/expedition-complete.tsx"]) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).toContain('from "@/utils/expeditionArtwork"');
      expect(source).toMatch(/approvedExpeditionArtwork\(/);
    }
  });
});
