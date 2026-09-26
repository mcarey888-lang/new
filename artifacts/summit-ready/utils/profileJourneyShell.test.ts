/**
 * Profile / progression — source-shape guards.
 *
 * The rules here are about MEANING, not styling: rank, achievements and
 * challenges are three different things and must not collapse into one, and
 * nothing on this screen may invent social proof SummitReady does not record.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const ACCOUNT = read("app/(tabs)/account.tsx");
const ACCOUNT_CODE = code(ACCOUNT);
const PROFILE_PRESENTATION = code(read("components/profile/PrimaryProfilePresentation.tsx"));
const EXPEDITION_PROFILE = code(read("app/(expedition)/profile.tsx"));

describe("Profile is a mountain résumé", () => {
  it("exposes the five sections as tabs", () => {
    expect(ACCOUNT_CODE).toMatch(/PrimaryProfilePresentation/);
    expect(PROFILE_PRESENTATION).toMatch(/SRUnderlineTabs/);
    for (const label of ["Profile", "Achievements", "Activity", "Photos", "Stats"]) {
      expect(PROFILE_PRESENTATION).toMatch(new RegExp(`label: "${label}"`));
    }
    expect(EXPEDITION_PROFILE).toMatch(/PrimaryProfileScreen/);
  });

  it("leads with rank and lifetime ascent, from the engines", () => {
    expect(ACCOUNT_CODE).toMatch(/rankResult\.currentRank/);
    expect(ACCOUNT_CODE).toMatch(/lifetimeElevation/);
    /* Never a hard-coded rank or a placeholder title. */
    expect(ACCOUNT_CODE).not.toMatch(/"Summit Master"|"Mountaineer"|currentRank = "/);
  });

  it("puts the Elevation Bank at the top of the profile", () => {
    const bank = ACCOUNT_CODE.indexOf("ElevationBankCard");
    const subscription = ACCOUNT_CODE.indexOf("SUBSCRIPTION");
    expect(bank).toBeGreaterThan(-1);
    expect(bank).toBeLessThan(subscription);
  });
});

describe("rank, achievements and challenges stay separate", () => {
  it("keeps three distinct headings", () => {
    expect(ACCOUNT).toMatch(/RankExperience/);
    expect(ACCOUNT).toMatch(/ACHIEVEMENTS/);
    expect(ACCOUNT).toMatch(/ACTIVE CHALLENGES/);
  });

  it("draws each from its own source", () => {
    /* Achievements come from the achievement catalogue; challenges come from
       the user's active attempts. Neither list is built from the other. */
    const achievements = ACCOUNT_CODE.slice(
      ACCOUNT_CODE.indexOf("ACHIEVEMENTS ·"),
      ACCOUNT_CODE.indexOf("ACTIVE CHALLENGES"),
    );
    expect(achievements).toMatch(/ACHIEVEMENTS\.slice|ACHIEVEMENTS\.length/);
    expect(achievements).not.toMatch(/activeChallenges|getChallenge\(/);

    const challenges = ACCOUNT_CODE.slice(ACCOUNT_CODE.indexOf("ACTIVE CHALLENGES"));
    expect(challenges).toMatch(/inProgressChallenges/);
  });
});

describe("no fabricated social data", () => {
  for (const rel of ["app/(tabs)/account.tsx", "app/rank.tsx", "app/elevation-history.tsx", "components/profile/CommunityHub.tsx"]) {
    it(`${rel} records no fabricated engagement counts`, () => {
      const body = code(read(rel));
      expect(body).not.toMatch(/\b\d[\d,]*\s+(?:likes|followers|following|comments|members|posts)\b/i);
      expect(body).not.toMatch(/leaderboard|ranking against|percentile/i);
    });
  }

  it("never silently shares journal photos and defaults new posts to private", () => {
    const hub = code(read("components/profile/CommunityHub.tsx"));
    expect(hub).toMatch(/useState<"private" \| "members">\("private"\)/);
    expect(hub).toMatch(/launchImageLibraryAsync/);
    expect(hub).toMatch(/onCreate\(\{[\s\S]*?kind:/);
    expect(hub).toMatch(/onVisibility\(post\.id/);
    expect(hub).toMatch(/onDelete\(id\)/);
    expect(hub).toMatch(/onReport\(id\)/);
    expect(ACCOUNT_CODE).toMatch(/community \? <View[\s\S]*?<CommunityHub \{\.\.\.community\}/);
    expect(ACCOUNT_CODE).toMatch(/unlockedAchievements\.includes\(a\.id\)/);
    expect(ACCOUNT_CODE).toMatch(/stage8ConfirmedAwards/);
  });

  it("the Photos tab shows only photos that genuinely exist", () => {
    expect(ACCOUNT_CODE).toMatch(/summitready:expedition-journal:/);
    /* No stock or prototype imagery is substituted for an empty gallery. */
    expect(ACCOUNT_CODE).not.toMatch(/unsplash|placeholder\.|mockup-assets/);
    expect(ACCOUNT).toMatch(/No photos yet/);
  });
});

describe("the progression screens use the shared system", () => {
  for (const rel of ["app/rank.tsx", "app/elevation-history.tsx"]) {
    it(`${rel} composes from the shared tokens and header`, () => {
      const body = code(read(rel));
      expect(body).toMatch(/from "@\/constants\/tokens"/);
      expect(body).toMatch(/SRScreenHeader/);
    });
  }

  it("Elevation History keeps its existing test hook", () => {
    expect(ACCOUNT_CODE.length).toBeGreaterThan(0);
    expect(code(read("app/elevation-history.tsx")))
      .toMatch(/backTestID="elevation-history-back"/);
  });

  it("the Elevation Bank ledger still states what it counts", () => {
    expect(read("app/elevation-history.tsx")).toMatch(/qualified recorded outdoor ascent/);
  });
});
