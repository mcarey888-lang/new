/**
 * Source-shape guards for the Expedition journey consolidation.
 *
 * The important ones are the protections: the Progress Mountain and the
 * summit cinematic must survive untouched, stages must stay real hills with
 * real identities, and no screen may derive expedition progress for itself.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("the protected Progress Mountain survives", () => {
  it("Basecamp still renders the real component, not a replacement", () => {
    const body = code(read("app/(expedition)/base-camp.tsx"));
    expect(body).toMatch(/CompactBasecampMountain/);
    expect(body).toMatch(/mountainImageRef=\{mountainRef\}/);
  });

  it("the wrapper still mounts MountainProgress itself", () => {
    const body = code(read("components/CompactBasecampMountain.tsx"));
    expect(body).toMatch(/import MountainProgress from "@\/components\/MountainProgress"/);
    expect(body).toMatch(/<MountainProgress/);
    /* The wrapper supplies chrome; it must not start drawing a mountain. */
    expect(body).not.toMatch(/<Svg|<Path|<Polygon/);
  });

  it("the summit cinematic is still the one that runs", () => {
    const body = code(read("app/(expedition)/base-camp.tsx"));
    expect(body).toMatch(/CinematicPrototype/);
    expect(body).toMatch(/snapToIdentity=\{showCompletion\}/);
  });

  it("no expedition presentation component draws a mountain or a summit", () => {
    for (const rel of [
      "components/expedition/parts.tsx",
      "components/expedition/ExpeditionHeader.tsx",
      "components/expedition/StageRail.tsx",
      "components/expedition/CurrentStageCard.tsx",
    ]) {
      const body = code(read(rel));
      expect(body).not.toMatch(/MountainProgress|CompletionCinematic|CinematicPrototype/);
    }
  });
});

describe("expedition progress is selected once, never re-derived", () => {
  it("the screens read the selector rather than computing percentages", () => {
    for (const rel of ["app/(expedition)/progress.tsx", "app/(expedition)/base-camp.tsx"]) {
      const body = code(read(rel));
      expect(body).toMatch(/selectExpeditionPresentation|presentation\./);
    }
  });

  it("the shared header takes the selected state and derives no progress", () => {
    const body = code(read("components/expedition/ExpeditionHeader.tsx"));
    expect(body).toMatch(/presentation\.progress/);
    /* It may clamp and format; it may not sum, divide or count stages. */
    expect(body).not.toMatch(/reduce\(|filter\(.*completed.*\)\.length/);
  });
});

describe("stages stay real hills with real identities", () => {
  it("the stage rail keys on the route identity, not the display name alone", () => {
    const body = code(read("components/expedition/StageRail.tsx"));
    expect(body).toMatch(/stage\.routeIdentityKey/);
  });

  it("Basecamp still hands Track the stage's canonical identities", () => {
    const body = code(read("app/(expedition)/base-camp.tsx"));
    expect(body).toMatch(/routeIdentityKey: nextHill\.routeIdentityKey/);
    expect(body).toMatch(/summitIdentityKey: nextHill\.summitIdentityKey/);
    expect(body).toMatch(/trackingMode: "expedition-route"/);
  });

  it("Create Custom Expedition is preserved", () => {
    const body = code(read("components/ExpeditionMountainsScreen.tsx"));
    expect(body).toMatch(/createRouteCard/);
    expect(body).toMatch(/saveManualExpedition/);
  });

  it("the free-hike route out of Basecamp is preserved", () => {
    const body = code(read("app/(expedition)/base-camp.tsx"));
    expect(body).toMatch(/trackingMode: "freehike"/);
    expect(body).toMatch(/onFreeHike=/);
    /* Its testID moved with the button into the shared card. */
    expect(code(read("components/expedition/CurrentStageCard.tsx")))
      .toMatch(/free-hike-base-camp-cta/);
  });
});

describe("no prototype figures reach the expedition surfaces", () => {
  for (const rel of [
    "components/expedition/parts.tsx",
    "components/expedition/ExpeditionHeader.tsx",
    "components/expedition/StageRail.tsx",
    "components/expedition/CurrentStageCard.tsx",
    "app/(expedition)/progress.tsx",
  ]) {
    it(`${rel} names no prototype mountain or figure`, () => {
      const body = code(read(rel));
      expect(body).not.toMatch(/Mont Blanc|Kilimanjaro|Everest|Helvellyn|Matterhorn/);
      expect(body).not.toMatch(/12,?420|88,?429/);
      /* The prototype's worked expedition: 7 stages, 8,848 m. */
      expect(body).not.toMatch(/8,?848/);
    });
  }
});
