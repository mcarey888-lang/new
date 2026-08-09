/**
 * Signature Challenges API
 * ─────────────────────────
 * Curated UK adventure weekends that echo a target mountain's Route DNA.
 * These replace repetitive AI-generated hill laps with crafted multi-day
 * adventures.
 *
 * Endpoints:
 *   GET /api/sx/challenges                        — list all active challenges
 *   GET /api/sx/challenges/for-mountain/:slug     — challenges for a mountain slug
 *   GET /api/sx/challenges/:challengeId           — single challenge with stages + limitations
 *   GET /api/sx/featured                          — featured challenges only
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  signatureChallenges,
  challengeStages,
  challengeLimitations,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { bundledSignatureChallenges } from "../data/signature-challenges";

export const signatureChallengesRouter = Router();

type CatalogChallenge = (typeof bundledSignatureChallenges)[number] | typeof signatureChallenges.$inferSelect;

/**
 * Production schema publication does not copy development rows. Prefer the
 * database whenever it contains any catalogue records (so artwork/admin edits
 * remain authoritative), but keep the curated library available read-only when
 * a newly published production database has not been seeded yet.
 */
async function getCatalog(): Promise<{ challenges: CatalogChallenge[]; bundled: boolean }> {
  try {
    const rows = await db.select().from(signatureChallenges);
    if (rows.length > 0) return { challenges: rows, bundled: false };
  } catch (err) {
    console.error("[sx/catalog] database unavailable, using bundled library:", err);
  }
  return { challenges: bundledSignatureChallenges, bundled: true };
}

// ── Mountain fame ranking ─────────────────────────────────────────────────────
// Lower number = more famous. Mountains not listed default to 999.
const MOUNTAIN_FAME_RANK: Record<string, number> = {
  "Mount Everest": 1,
  "K2": 2,
  "Kangchenjunga": 3,
  "Matterhorn": 4,
  "Mont Blanc": 5,
  "Kilimanjaro": 6,
  "Eiger": 7,
  "Aconcagua": 8,
  "Annapurna I": 9,
  "Nanga Parbat": 10,
  "Lhotse": 11,
  "Makalu": 12,
  "Cho Oyu": 13,
  "Dhaulagiri I": 14,
  "Manaslu": 15,
  "Broad Peak": 16,
  "Gasherbrum I": 17,
  "Gasherbrum II": 18,
  "Shishapangma": 19,
  "Ama Dablam": 20,
  "Everest Base Camp": 21,
  "Denali": 22,
  "Elbrus": 23,
  "Mount Fuji": 24,
  "Vinson Massif": 25,
  "Puncak Jaya / Carstensz Pyramid": 26,
  "Mount Rainier": 27,
  "Mount Kenya - Batian": 28,
  "Mount Kenya - Point Lenana": 29,
  "Jungfrau": 30,
  "Mönch": 31,
  "Piz Bernina": 32,
  "Grossglockner": 33,
  "Gran Paradiso": 34,
  "Ojos del Salado": 35,
  "Mount Olympus - Mytikas": 36,
  "Mount Toubkal": 37,
  "Mount Whitney": 38,
  "Mount Shasta": 39,
  "Mount Kinabalu": 40,
  "Triglav": 41,
  "Teide": 42,
  "Mount Etna": 43,
  "Ben Nevis": 44,
  "Snowdon / Yr Wyddfa": 45,
  "Helvellyn": 46,
  "Scafell Pike": 47,
  "Mount Kosciuszko": 48,
  "Rysy": 49,
  "Carrauntoohil": 50,
};

function byFame(a: { targetMountainName: string }, b: { targetMountainName: string }) {
  const ra = MOUNTAIN_FAME_RANK[a.targetMountainName] ?? 999;
  const rb = MOUNTAIN_FAME_RANK[b.targetMountainName] ?? 999;
  return ra - rb;
}

// ── helper ────────────────────────────────────────────────────────────────────
async function getStagesAndLimitations(challengeId: string) {
  const [stages, limitations] = await Promise.all([
    db
      .select()
      .from(challengeStages)
      .where(eq(challengeStages.challengeId, challengeId))
      .orderBy(challengeStages.stageOrder),
    db
      .select()
      .from(challengeLimitations)
      .where(eq(challengeLimitations.challengeId, challengeId)),
  ]);
  return { stages, limitations: limitations.map((l) => l.limitation) };
}

// ── GET /api/sx/challenges ────────────────────────────────────────────────────
// Optional query params:
//   ?region=Scotland       filter by region (partial match)
//   ?days=2                filter by recommendedDays
//   ?difficulty=Expert     filter by difficulty (exact)
//   ?featured=true         only featured challenges
//   ?mountain=matterhorn   filter by mountainSlug (exact)
//   ?withStages=true       include stages in list response
signatureChallengesRouter.get("/sx/challenges", async (req, res) => {
  try {
    const { region, days, difficulty, featured, mountain, withStages } = req.query;
    const { challenges, bundled } = await getCatalog();
    const rows = challenges
      .filter((challenge) => challenge.status === "active")
      .filter((challenge) => typeof region !== "string"
        || challenge.regions?.toLowerCase().includes(region.toLowerCase()))
      .filter((challenge) => !days || challenge.recommendedDays === Number(days))
      .filter((challenge) => typeof difficulty !== "string"
        || challenge.difficulty === difficulty)
      .filter((challenge) => featured !== "true" || challenge.featured)
      .filter((challenge) => typeof mountain !== "string"
        || challenge.mountainSlug === mountain)
      .sort(byFame);

    if (withStages === "true") {
      const enriched = await Promise.all(
        rows.map(async (c) => {
          if (bundled && "stages" in c) return c;
          const { stages, limitations } = await getStagesAndLimitations(c.challengeId);
          return { ...c, stages, limitations };
        })
      );
      return res.json({ challenges: enriched, total: enriched.length });
    }

    return res.json({ challenges: rows, total: rows.length });
  } catch (err) {
    console.error("[sx/challenges] list error:", err);
    return res.status(500).json({ error: "Failed to fetch challenges" });
  }
});

// ── GET /api/sx/featured ─────────────────────────────────────────────────────
signatureChallengesRouter.get("/sx/featured", async (_req, res) => {
  try {
    const { challenges } = await getCatalog();
    const rows = challenges
      .filter((challenge) => challenge.status === "active" && challenge.featured)
      .sort(byFame);

    return res.json({ challenges: rows, total: rows.length });
  } catch (err) {
    console.error("[sx/featured] error:", err);
    return res.status(500).json({ error: "Failed to fetch featured challenges" });
  }
});

// ── GET /api/sx/challenges/for-mountain/:slug ─────────────────────────────────
// Primary lookup used by the Virtual Expedition flow.
// :slug is the normalised mountain slug, e.g. "matterhorn", "k2"
signatureChallengesRouter.get("/sx/challenges/for-mountain/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const { challenges, bundled } = await getCatalog();
    const rows = challenges
      .filter((challenge) =>
        challenge.mountainSlug === slug && challenge.status === "active")
      .sort((a, b) => (a.adventureScore ?? 0) - (b.adventureScore ?? 0));

    if (rows.length === 0) {
      return res.json({ challenges: [], total: 0 });
    }

    // Enrich with stages + limitations
    const enriched = await Promise.all(
      rows.map(async (c) => {
        if (bundled && "stages" in c) return c;
        const { stages, limitations } = await getStagesAndLimitations(c.challengeId);
        return { ...c, stages, limitations };
      })
    );

    return res.json({ challenges: enriched, total: enriched.length });
  } catch (err) {
    console.error("[sx/for-mountain] error:", err);
    return res.status(500).json({ error: "Failed to fetch challenges for mountain" });
  }
});

// ── GET /api/sx/challenges/:challengeId ───────────────────────────────────────
signatureChallengesRouter.get("/sx/challenges/:challengeId", async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { challenges, bundled } = await getCatalog();
    const challenge = challenges.find((row) => row.challengeId === challengeId);

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    if (bundled && "stages" in challenge) {
      return res.json({ challenge });
    }
    const { stages, limitations } = await getStagesAndLimitations(challengeId);

    return res.json({ challenge: { ...challenge, stages, limitations } });
  } catch (err) {
    console.error("[sx/challenge] detail error:", err);
    return res.status(500).json({ error: "Failed to fetch challenge" });
  }
});
