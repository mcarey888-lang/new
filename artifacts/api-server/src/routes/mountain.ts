import { Router, type IRouter, type RequestHandler } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, cachedMountains } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  lookupVerifiedCanonicalMountain,
  type CanonicalLookupInput,
  type CanonicalLookupResult,
  type VerifiedCanonicalMountain,
} from "../services/mountain/canonicalMountainLookup";

const RequestSchema = z.object({
  name: z.string().min(2).max(200).trim(),
  country: z.string().trim().min(1).max(100).optional(),
  region: z.string().trim().min(1).max(200).optional(),
});

const RouteSchema = z.object({
  name: z.string(),
  distance: z.number(),
  elevationGain: z.number(),
  highestAltitude: z.number(),
  difficulty: z.enum(["Easy", "Moderate", "Hard", "Alpine"]),
  description: z.string(),
  startingPoint: z.string().optional(),
});

const MountainResponseSchema = z.object({
  mountainName: z.string(),
  country: z.string().optional(),
  region: z.string().optional(),
  routes: z.array(RouteSchema),
});

type MountainResponse = z.infer<typeof MountainResponseSchema>;

export interface MountainLookupDependencies {
  canonicalLookup: (
    input: CanonicalLookupInput,
  ) => Promise<CanonicalLookupResult>;
  cacheLookup: (slug: string) => Promise<MountainResponse | null>;
  cacheStore: (slug: string, result: MountainResponse) => Promise<void>;
  aiLookup: (name: string) => Promise<MountainResponse>;
}

const SYSTEM_PROMPT = `You are a mountain hiking and alpine routes expert. When given a mountain or hike name, return accurate route information as a JSON object.

Return ONLY valid JSON — no markdown fences, no explanation, just the raw JSON object:
{
  "mountainName": string,
  "country": string,
  "region": string,
  "routes": [
    {
      "name": string,
      "distance": number,
      "elevationGain": number,
      "highestAltitude": number,
      "difficulty": "Easy" | "Moderate" | "Hard" | "Alpine",
      "description": string,
      "startingPoint": string
    }
  ]
}

Rules:
- distance = round trip km (realistic number)
- elevationGain = summit altitude MINUS the specific trailhead/car-park elevation for THAT route. Every route starts at a different elevation — do NOT use the same elevationGain for multiple routes. Example for Snowdon (summit 1085m): Pyg Track starts at Pen-y-Pass ~359m → gain 726m; Llanberis Path starts at Llanberis ~115m → gain 970m; Watkin Path starts at Nantgwynant ~102m → gain 983m. Calculate each route individually.
- highestAltitude = summit altitude metres above sea level (same for all routes on the same mountain)
- Provide 2-4 routes
- Difficulty: Easy=walking, Moderate=sustained climb, Hard=steep/scrambling, Alpine=technical/glacier
- Use real, verified data for well-known peaks (UK peaks, Alps, etc.). Double-check trailhead elevations — they vary significantly between routes on the same mountain.`;

function mountainSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function lookupCache(slug: string): Promise<MountainResponse | null> {
  const rows = await db
    .select()
    .from(cachedMountains)
    .where(eq(cachedMountains.slug, slug))
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  return MountainResponseSchema.parse(JSON.parse(rows[0].data));
}

async function storeCache(
  slug: string,
  result: MountainResponse,
): Promise<void> {
  await db
    .insert(cachedMountains)
    .values({ slug, data: JSON.stringify(result) })
    .onConflictDoUpdate({
      target: cachedMountains.slug,
      set: { data: JSON.stringify(result), cachedAt: new Date() },
    });
}

async function lookupWithAi(name: string): Promise<MountainResponse> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_completion_tokens: 1200,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Provide route information for: "${name.trim()}"` },
    ],
  });
  const content = response.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from AI");
  }

  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse route data");
    }
    parsedJson = JSON.parse(jsonMatch[0]);
  }

  return MountainResponseSchema.parse(parsedJson);
}

function canonicalResponse(
  mountain: VerifiedCanonicalMountain,
  matchedTerm: string,
  routes: MountainResponse["routes"],
  routeSource: "cache" | "ai" | "unavailable",
) {
  return {
    source: "canonical" as const,
    mountainName: mountain.name,
    country: mountain.country,
    region: mountain.region,
    // The legacy route shape remains available for existing clients, but its
    // source is explicit and never overrides the trusted catalogue facts.
    routes,
    routeSource,
    canonicalIdentity: {
      id: mountain.id,
      sourceFeatureId: mountain.sourceFeatureId,
      canonicalSourceKey: mountain.canonicalSourceKey,
      canonicalName: mountain.name,
      matchedBy: mountain.matchedBy,
      matchedTerm,
    },
    trustedFacts: {
      verificationStatus: "verified" as const,
      area: mountain.area,
      county: mountain.county,
      elevationM: mountain.elevationM,
      prominenceM: mountain.prominenceM,
      colHeightM: mountain.colHeightM,
      gridReference: mountain.gridReference,
      summitFeature: mountain.summitFeature,
      coordinates: {
        latitude: mountain.latitude,
        longitude: mountain.longitude,
      },
      routes: mountain.routes,
      provenanceVersion: mountain.provenanceVersion,
    },
  };
}

const defaultDependencies: MountainLookupDependencies = {
  canonicalLookup: lookupVerifiedCanonicalMountain,
  cacheLookup: lookupCache,
  cacheStore: storeCache,
  aiLookup: lookupWithAi,
};

export function createMountainLookupHandler(
  overrides: Partial<MountainLookupDependencies> = {},
): RequestHandler {
  const dependencies = { ...defaultDependencies, ...overrides };

  return async (req, res) => {
    const parsed = RequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Mountain name required (2–200 characters)",
      });
      return;
    }

    const input = parsed.data;

    let canonical: CanonicalLookupResult;
    try {
      canonical = await dependencies.canonicalLookup(input);
    } catch (err) {
      req.log.error({ err }, "Canonical mountain lookup failed");
      res.status(503).json({
        error: "Trusted mountain catalogue is temporarily unavailable",
        code: "CANONICAL_LOOKUP_UNAVAILABLE",
      });
      return;
    }

    if (canonical.kind === "ambiguous") {
      req.log.info(
        { query: input.name, matches: canonical.matches.length },
        "Canonical mountain lookup is ambiguous",
      );
      res.status(409).json({
        error:
          "Multiple verified mountains match this name. Add country or region.",
        code: "AMBIGUOUS_MOUNTAIN",
        query: input,
        matches: canonical.matches,
      });
      return;
    }

    if (canonical.kind === "match") {
      req.log.info(
        {
          canonicalSourceKey: canonical.mountain.canonicalSourceKey,
          matchedBy: canonical.mountain.matchedBy,
        },
        "Canonical mountain catalogue hit",
      );
      const canonicalSlug = mountainSlug(canonical.mountain.name);
      try {
        const cached = await dependencies.cacheLookup(canonicalSlug);
        if (cached) {
          res.json(
            canonicalResponse(
              canonical.mountain,
              input.name,
              cached.routes,
              "cache",
            ),
          );
          return;
        }
      } catch (err) {
        req.log.warn(
          { err, slug: canonicalSlug },
          "Canonical route cache read failed, falling back to AI",
        );
      }

      try {
        const generated = await dependencies.aiLookup(canonical.mountain.name);
        try {
          await dependencies.cacheStore(canonicalSlug, generated);
        } catch (err) {
          req.log.warn(
            { err, slug: canonicalSlug },
            "Canonical route cache write failed",
          );
        }
        res.json(
          canonicalResponse(
            canonical.mountain,
            input.name,
            generated.routes,
            "ai",
          ),
        );
      } catch (err) {
        req.log.warn(
          { err },
          "Canonical identity resolved but legacy route enrichment failed",
        );
        res.json(
          canonicalResponse(
            canonical.mountain,
            input.name,
            [],
            "unavailable",
          ),
        );
      }
      return;
    }

    const slug = mountainSlug(input.name);

    try {
      const cached = await dependencies.cacheLookup(slug);
      if (cached) {
        req.log.info({ slug }, "Mountain cache hit");
        res.json({ ...cached, source: "cache" });
        return;
      }
    } catch (err) {
      req.log.warn({ err }, "Mountain cache read failed, falling back to AI");
    }

    try {
      const result = await dependencies.aiLookup(input.name);

      try {
        await dependencies.cacheStore(slug, result);
      } catch (err) {
        req.log.warn({ err }, "Mountain cache write failed");
      }

      res.json({ ...result, source: "ai" });
    } catch (err) {
      req.log.error({ err }, "Mountain lookup failed");
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: `Lookup failed: ${message}` });
    }
  };
}

const router: IRouter = Router();
router.post("/mountain-lookup", createMountainLookupHandler());

export default router;
