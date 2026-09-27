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
const DEMO_COMMUNITY = code(read("components/profile/DemoCommunityPreview.tsx"));
const EXPEDITION_PROFILE = code(read("app/(expedition)/profile.tsx"));

// Missing verified data keeps the approved layout, without pretending the
// recorded balance is zero.
describe("Profile Elevation Bank hero", () => {
  it("does not switch back to the legacy card when the API is unavailable", () => {
    expect(ACCOUNT_CODE).toMatch(/<ElevationBankHero[\s\S]*?lifetimeAscentM=\{sampleYear \? sampleYear\.ascentM : bankPresentation\.kind/);
    expect(ACCOUNT_CODE).toMatch(/bankPresentation\.data\.lifetimeAscentM : null/);
    expect(ACCOUNT_CODE).toMatch(/Recorded balance unavailable right now\./);
    expect(ACCOUNT_CODE).not.toMatch(/bankPresentation\.kind === "ready" \|\| bankPresentation\.kind === "empty" \? \([\s\S]*?<ElevationBankCard/);
  });
  it("uses the approved composition for a labelled fictional year without banking its ascent", () => {
    const hero = code(read("components/elevation/ElevationBankHero.tsx"));
    expect(ACCOUNT_CODE).toMatch(/mode=\{sampleYear \? "sample" : "bank"\}/);
    expect(ACCOUNT_CODE).toMatch(/hikes=\{sampleYear \? sampleYear\.hikes\.length/);
    expect(ACCOUNT_CODE).toMatch(/monthly=\{sampleYear \? sampleMonthly/);
    expect(ACCOUNT_CODE).toMatch(/Your real Elevation Bank/);
    expect(hero).toMatch(/FICTIONAL ASCENT · NOT BANKED/);
    expect(hero).toMatch(/MONTHLY ASCENT · SAMPLE/);
    expect(hero).toMatch(/sample \? "Sample expeditions" : "Expeditions"/);
  });
});

describe("Profile is a mountain résumé", () => {
  it("shows fictional member stories only as a preview, outside real post and achievement data", () => {
    const hub = code(read("components/profile/CommunityHub.tsx"));
    expect(DEMO_COMMUNITY).toMatch(/Fictional members and achievements/);
    expect(DEMO_COMMUNITY).toMatch(/Perfect Week/);
    expect(DEMO_COMMUNITY).toMatch(/First Thousand/);
    expect(DEMO_COMMUNITY).not.toMatch(/createCommunityPost|ownerUserId|onReport|onDelete/);
    expect(hub).toMatch(/view === "members" && !loading && visiblePosts\.length === 0 && <DemoCommunityPreview/);
    expect(ACCOUNT_CODE).toMatch(/Sign in to see stories, photos and achievements shared by SummitReady members\.[\s\S]*?<DemoCommunityPreview/);
  });
  it("opens You on the feed, with Activity inside Achievements", () => {
    expect(ACCOUNT_CODE).toMatch(/PrimaryProfilePresentation/);
    expect(PROFILE_PRESENTATION).toMatch(/SRUnderlineTabs/);
    for (const label of ["Feed", "Profile", "Achievements", "Photos", "Stats"]) {
      expect(PROFILE_PRESENTATION).toMatch(new RegExp(`label: "${label}"`));
    }
    expect(PROFILE_PRESENTATION).not.toMatch(/value: "activity"/);
    expect(ACCOUNT_CODE).toMatch(/useState<PrimaryProfileTab>\("feed"\)/);
    expect(ACCOUNT_CODE).toMatch(/tab === "feed" && !showSettings && \([\s\S]*?<CommunityHub/);
    expect(ACCOUNT_CODE).toMatch(/tab === "achievements" && achievementsSection === "activity" && !showSettings/);
    expect(ACCOUNT_CODE).toMatch(/testID=\{`achievements-\$\{section\}`\}/);
    expect(EXPEDITION_PROFILE).toMatch(/PrimaryProfileScreen/);
  });

  it("keeps the You header compact and gives every recent activity an honest image", () => {
    expect(PROFILE_PRESENTATION).toMatch(/cover:\s*\{\s*height: 153/);
    expect(ACCOUNT_CODE).toMatch(/<ActivityThumbnail subject=\{activity\.imageSubject\}/);
    expect(ACCOUNT_CODE).toMatch(/hasApprovedMountainImage\(subject\)/);
    expect(ACCOUNT_CODE).toMatch(/local-hill-illustration\.png/);
  });

  it("uses the supplied Elevation Bank mountain without inventing the reference figures", () => {
    const bank = code(read("components/ElevationBankCard.tsx"));
    expect(bank).toMatch(/hero-base-camp\.png/);
    expect(ACCOUNT_CODE).toMatch(/photoAsset=\{require\("@\/assets\/images\/hero-base-camp\.png"\)\}/);
    expect(ACCOUNT_CODE).not.toMatch(/Image\.resolveAssetSource/);
    expect(ACCOUNT_CODE).not.toMatch(/photoUri=\{mountainImageUri\(/);
    expect(bank).toMatch(/formatElevationBankMetres\(value\)/);
    expect(bank).toMatch(/ready\.lifetimeAscentM/);
    expect(bank).toMatch(/recentCredits/);
    expect(bank).not.toMatch(/12,420|28%|317 h|127 Hikes/);
    expect(bank).toMatch(/elevation-bank-unavailable/);
    expect(bank).toMatch(/Credit history unavailable/);
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
    const communityHook = code(read("hooks/useCommunity.ts"));
    expect(ACCOUNT_CODE).toMatch(/useCommunity\(!suppliedCommunity && !showSettings && \(tab === "feed" \|\| tab === "photos"\)\)/);
    expect(communityHook).toMatch(/const enabled = visible && isLoaded/);
    expect(communityHook).toMatch(/offset \+= 4/);
    expect(communityHook).toMatch(/getTokenRef\.current\(\)/);
    expect(communityHook).toMatch(/createCommunityPost\([\s\S]*?authenticatedHeaders\(token\)/);
    expect(hub).toMatch(/status === 401 \|\| status === 403/);
    expect(hub).toMatch(/community-submit-error/);
    expect(communityHook).toMatch(/\}, \[enabled, hasPhotos, userId\]\)/);
    expect(communityHook).toMatch(/if \(Platform\.OS !== "web"\) return;/);
    expect(hub).toMatch(/visiblePosts\.slice\(0, visiblePostCount\)/);
    expect(ACCOUNT_CODE).toMatch(/journalPhotos\.slice\(0, visiblePhotoCount\)/);
    expect(ACCOUNT_CODE).toMatch(/sharedPhotos\.slice\(0, visiblePhotoCount\)/);
    expect(hub).toMatch(/useState<"private" \| "members">\("private"\)/);
    expect(hub).toMatch(/launchImageLibraryAsync/);
    expect(hub).toMatch(/onCreate\(\{[\s\S]*?kind:/);
    expect(hub).toMatch(/onVisibility\(post\.id/);
    expect(hub).toMatch(/onDelete\(id\)/);
    expect(hub).toMatch(/onReport\(id\)/);
    expect(ACCOUNT_CODE).toMatch(/community \? \([\s\S]*?<CommunityHub \{\.\.\.community\}/);
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

  it("the Elevation Bank explains recorded versus self-reported ascent", () => {
    const history = read("app/elevation-history.tsx");
    expect(history).toMatch(/Self-reported hikes and completed training sessions count toward/);
    expect(history).toMatch(/not GPS-verified/);
    expect(history).toMatch(/not yet synced between devices/);
  });
});
