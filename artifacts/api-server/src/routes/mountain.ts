import { Router, type IRouter, type RequestHandler } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { aiMountainDiscoveries, db, cachedMountains, executeEngineReadOnlyQuery } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  CanonicalCatalogueUnavailableError,
  lookupVerifiedCanonicalMountainStrict,
  type CanonicalLookupInput,
  type CanonicalLookupResult,
  type VerifiedCanonicalMountain,
} from "../services/mountain/canonicalMountainLookup";

const RequestSchema = z.object({
  name: z.string().min(2).max(200).trim().optional(),
  country: z.string().trim().min(1).max(100).optional(),
  region: z.string().trim().min(1).max(200).optional(),
  catalogueId: z.string().min(1).max(200).optional(),
  discoveryId: z.string().min(1).max(200).optional(),
}).refine((input) => {
  if (input.catalogueId || input.discoveryId) {
    return !(input.catalogueId && input.discoveryId);
  }
  return Boolean(input.name);
}, "Provide a name or exactly one discovery ID");

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
  catalogueById?: (id: string) => Promise<{
    id: string;
    name: string;
    country: string | null;
    region: string | null;
    area: string | null;
    elevationM: number | null;
    status: string;
  } | null>;
  discoveryById?: (id: string) => Promise<{
    id: string;
    name: string;
    country: string;
    region: string;
    area: string | null;
    elevationM: number | null;
  } | null>;
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

async function getCatalogueById(id: string) {
  const rows = await executeEngineReadOnlyQuery<{
    id: string;
    name: string;
    country: string | null;
    region: string | null;
    area: string | null;
    elevationM: number | null;
    status: string;
  }>(
    `SELECT m.id::text AS "id", m.name AS "name", m.country AS "country",
      m.region AS "region", m.area AS "area", m.elevation_m AS "elevationM",
      m.status AS "status"
     FROM public.mountains AS m WHERE m.id::text = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

async function getDiscoveryById(id: string) {
  const rows = await db
    .select({
      id: aiMountainDiscoveries.id,
      name: aiMountainDiscoveries.name,
      country: aiMountainDiscoveries.country,
      region: aiMountainDiscoveries.region,
      area: aiMountainDiscoveries.area,
      elevationM: aiMountainDiscoveries.elevationM,
    })
    .from(aiMountainDiscoveries)
    .where(eq(aiMountainDiscoveries.id, id))
    .limit(1);
  return rows[0] ?? null;
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
) {
  return {
    source: "canonical" as const,
    mountainName: mountain.name,
    country: mountain.country,
    region: mountain.region,
    routes: mountain.routes,
    routeSource:
      mountain.routes.length > 0
        ? ("canonical" as const)
        : ("unavailable" as const),
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
  canonicalLookup: lookupVerifiedCanonicalMountainStrict,
  cacheLookup: lookupCache,
  cacheStore: storeCache,
  aiLookup: lookupWithAi,
  catalogueById: getCatalogueById,
  discoveryById: getDiscoveryById,
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

    if (input.discoveryId) {
      try {
        const discovery = await dependencies.discoveryById!(input.discoveryId);
        if (!discovery) {
          res.status(404).json({ error: "Mountain discovery not found", code: "MOUNTAIN_NOT_FOUND" });
          return;
        }
        res.json({
          source: "ai",
          mountainName: discovery.name,
          country: discovery.country,
          region: discovery.region,
          routes: [],
          routeSource: "unavailable",
          catalogueFacts: {
            elevationM: discovery.elevationM,
            area: discovery.area,
            verificationStatus: "ai_unverified",
          },
        });
      } catch (err) {
        req.log.error({ err }, "AI mountain discovery lookup failed");
        res.status(503).json({ error: "Mountain discovery is temporarily unavailable", code: "MOUNTAIN_DISCOVERY_UNAVAILABLE" });
      }
      return;
    }

    if (input.catalogueId) {
      let candidate;
      try {
        candidate = await dependencies.catalogueById!(input.catalogueId);
      } catch (err) {
        req.log.warn({ err }, "Exact catalogue mountain lookup failed");
        res.status(503).json({ error: "Mountain catalogue is temporarily unavailable", code: "CANONICAL_LOOKUP_UNAVAILABLE" });
        return;
      }
      if (!candidate) {
        res.status(404).json({ error: "Mountain not found", code: "MOUNTAIN_NOT_FOUND" });
        return;
      }

      try {
        const exactCanonical = await dependencies.canonicalLookup({
          name: candidate.name,
          ...(candidate.country ? { country: candidate.country } : {}),
          ...(candidate.region ? { region: candidate.region } : {}),
        });
        if (exactCanonical.kind === "match" && exactCanonical.mountain.id === candidate.id) {
          res.json(canonicalResponse(exactCanonical.mountain, candidate.name));
          return;
        }
      } catch (err) {
        req.log.warn({ err }, "Verified identity confirmation unavailable for exact catalogue record");
      }
      res.json({
        source: "catalogue",
        mountainName: candidate.name,
        country: candidate.country ?? undefined,
        region: candidate.region ?? undefined,
        routes: [],
        routeSource: "unavailable",
        catalogueFacts: {
          elevationM: candidate.elevationM,
          area: candidate.area,
          verificationStatus: candidate.status === "verified" ? "verified" : "imported",
        },
      });
      return;
    }

    const mountainName = input.name!;
    let canonical: CanonicalLookupResult = { kind: "none" };
    let catalogueUnavailable = false;
    try {
      canonical = await dependencies.canonicalLookup({
        name: mountainName,
        ...(input.country ? { country: input.country } : {}),
        ...(input.region ? { region: input.region } : {}),
      });
    } catch (err) {
      if (err instanceof CanonicalCatalogueUnavailableError) {
        catalogueUnavailable = true;
        req.log.warn("Trusted mountain catalogue is temporarily unavailable; returning browse-only data");
      } else {
        req.log.error({ err }, "Canonical mountain lookup failed");
        res.status(503).json({
          error: "Trusted mountain catalogue is temporarily unavailable",
          code: "CANONICAL_LOOKUP_UNAVAILABLE",
        });
        return;
      }
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
      res.json(canonicalResponse(canonical.mountain, mountainName));
      return;
    }

    const slug = mountainSlug(mountainName);

    try {
      const cached = await dependencies.cacheLookup(slug);
      if (cached) {
        req.log.info({ slug }, "Mountain cache hit");
        res.json({
          ...cached, source: "cache",
          ...(catalogueUnavailable ? { catalogueStatus: "unavailable" } : {}),
        });
        return;
      }
    } catch (err) {
      req.log.warn({ err }, "Mountain cache read failed, falling back to AI");
    }

    try {
      const result = await dependencies.aiLookup(mountainName);

      try {
        await dependencies.cacheStore(slug, result);
      } catch (err) {
        req.log.warn({ err }, "Mountain cache write failed");
      }

      res.json({
        ...result, source: "ai",
        ...(catalogueUnavailable ? { catalogueStatus: "unavailable" } : {}),
      });
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
