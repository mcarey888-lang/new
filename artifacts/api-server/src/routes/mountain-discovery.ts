import { Router, type IRouter, type RequestHandler } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { aiMountainDiscoveries, db, executeEngineReadOnlyQuery } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

export interface MountainDiscoveryItem {
  id: string;
  name: string;
  country: string;
  region: string;
  area: string | null;
  elevationM: number | null;
  latitude: number;
  longitude: number;
  source: "catalogue" | "ai";
  verificationStatus: "verified" | "imported" | "ai_unverified";
}

interface SearchOrderKeys {
  sortName: string;
  sortCountry: string;
  sortRegion: string;
  sortSource: number;
  sortArea: string;
}

interface CatalogueRow extends Record<string, unknown>, SearchOrderKeys {
  id: string;
  name: string;
  country: string | null;
  region: string | null;
  area: string | null;
  elevationM: number | null;
  latitude: number;
  longitude: number;
  status: string;
}

interface SavedRow {
  id: string;
  name: string;
  country: string;
  region: string;
  area: string | null;
  elevationM: number | null;
  latitude: number;
  longitude: number;
  verificationStatus: string;
}

interface SavedSearchRow extends SavedRow, SearchOrderKeys {
}

interface MountainDiscoveryCandidate {
  name: string;
  country: string;
  region: string;
  area: string | null;
  elevationM: number | null;
  latitude: number;
  longitude: number;
  originalQuery: string;
  provenance: string;
  identityKey: string;
}

interface MountainIdentity {
  name: string;
  country: string;
  region: string;
}

interface MountainDiscoveryCursor {
  sortName: string;
  sortCountry: string;
  sortRegion: string;
  sortSource: number;
  sortArea: string;
  id: string;
}

export interface MountainDiscoveryDependencies {
  catalogueSearch: (query: string, limit: number, cursor?: MountainDiscoveryCursor) => Promise<CatalogueRow[]>;
  savedSearch: (query: string, limit: number, cursor?: MountainDiscoveryCursor) => Promise<SavedSearchRow[]>;
  catalogueIdentityExists: (identity: MountainIdentity) => Promise<boolean>;
  savedIdentityExists: (identityKey: string) => Promise<boolean>;
  saveCandidate: (candidate: MountainDiscoveryCandidate) => Promise<SavedRow>;
  generateCandidate: (query: string) => Promise<unknown>;
}

export class MountainCatalogueUnavailableError extends Error {
  constructor() {
    super("Mountain catalogue is temporarily unavailable");
    this.name = "MountainCatalogueUnavailableError";
  }
}

const catalogueSearchSql = `
SELECT
  m.id::text AS "id",
  m.name AS "name",
  m.country AS "country",
  m.region AS "region",
  m.area AS "area",
  m.elevation_m AS "elevationM",
  ST_Y(m.geom)::float8 AS "latitude",
  ST_X(m.geom)::float8 AS "longitude",
  m.status AS "status",
  lower(m.name) COLLATE "C" AS "sortName",
  lower(COALESCE(m.country, '')) COLLATE "C" AS "sortCountry",
  lower(COALESCE(m.region, '')) COLLATE "C" AS "sortRegion",
  0::int AS "sortSource",
  lower(COALESCE(m.area, '')) COLLATE "C" AS "sortArea"
FROM public.mountains AS m
WHERE m.geom IS NOT NULL
  AND (
    m.name ILIKE $1 ESCAPE '\\'
    OR COALESCE(m.region, '') ILIKE $1 ESCAPE '\\'
    OR COALESCE(m.country, '') ILIKE $1 ESCAPE '\\'
    OR COALESCE(m.area, '') ILIKE $1 ESCAPE '\\'
  )
  AND (
    $3::text IS NULL
    OR (
      lower(m.name) COLLATE "C",
      lower(COALESCE(m.country, '')) COLLATE "C",
      lower(COALESCE(m.region, '')) COLLATE "C",
      0::int,
      lower(COALESCE(m.area, '')) COLLATE "C",
      m.id::text COLLATE "C"
    ) > (
      $3::text COLLATE "C",
      $4::text COLLATE "C",
      $5::text COLLATE "C",
      $6::int,
      $7::text COLLATE "C",
      $8::text COLLATE "C"
    )
  )
ORDER BY "sortName", "sortCountry", "sortRegion", "sortSource", "sortArea", m.id::text COLLATE "C"
LIMIT $2
`;

function escapedLikeTerm(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

async function searchCatalogue(query: string, limit: number, cursor?: MountainDiscoveryCursor): Promise<CatalogueRow[]> {
  try {
    return await executeEngineReadOnlyQuery<CatalogueRow>(catalogueSearchSql, [
      `%${escapedLikeTerm(query)}%`,
      limit,
      cursor?.sortName ?? null,
      cursor?.sortCountry ?? null,
      cursor?.sortRegion ?? null,
      cursor?.sortSource ?? null,
      cursor?.sortArea ?? null,
      cursor?.id ?? null,
    ]);
  } catch {
    throw new MountainCatalogueUnavailableError();
  }
}

const fieldsPattern = (query: string) => {
  const pattern = `%${query}%`;
  return or(
    ilike(aiMountainDiscoveries.name, pattern),
    ilike(aiMountainDiscoveries.region, pattern),
    ilike(aiMountainDiscoveries.country, pattern),
    ilike(aiMountainDiscoveries.area, pattern),
  );
};

async function searchSaved(query: string, limit: number, cursor?: MountainDiscoveryCursor): Promise<SavedSearchRow[]> {
  const afterCursor = cursor
    ? sql`(
        lower(${aiMountainDiscoveries.name}) COLLATE "C",
        lower(${aiMountainDiscoveries.country}) COLLATE "C",
        lower(${aiMountainDiscoveries.region}) COLLATE "C",
        1::int,
        lower(COALESCE(${aiMountainDiscoveries.area}, '')) COLLATE "C",
        ${aiMountainDiscoveries.id} COLLATE "C"
      ) > (
        ${cursor.sortName}::text COLLATE "C",
        ${cursor.sortCountry}::text COLLATE "C",
        ${cursor.sortRegion}::text COLLATE "C",
        ${cursor.sortSource}::int,
        ${cursor.sortArea}::text COLLATE "C",
        ${cursor.id}::text COLLATE "C"
      )`
    : undefined;
  const rows = await db
    .select({
      id: aiMountainDiscoveries.id,
      name: aiMountainDiscoveries.name,
      country: aiMountainDiscoveries.country,
      region: aiMountainDiscoveries.region,
      area: aiMountainDiscoveries.area,
      elevationM: aiMountainDiscoveries.elevationM,
      latitude: aiMountainDiscoveries.latitude,
      longitude: aiMountainDiscoveries.longitude,
      verificationStatus: aiMountainDiscoveries.verificationStatus,
      sortName: sql<string>`lower(${aiMountainDiscoveries.name}) COLLATE "C"`,
      sortCountry: sql<string>`lower(${aiMountainDiscoveries.country}) COLLATE "C"`,
      sortRegion: sql<string>`lower(${aiMountainDiscoveries.region}) COLLATE "C"`,
      sortSource: sql<number>`1`,
      sortArea: sql<string>`lower(COALESCE(${aiMountainDiscoveries.area}, '')) COLLATE "C"`,
    })
    .from(aiMountainDiscoveries)
    .where(sql`${fieldsPattern(escapedLikeTerm(query))}${afterCursor ? sql` AND ${afterCursor}` : sql``}`)
    .orderBy(
      sql`lower(${aiMountainDiscoveries.name}) COLLATE "C"`,
      sql`lower(${aiMountainDiscoveries.country}) COLLATE "C"`,
      sql`lower(${aiMountainDiscoveries.region}) COLLATE "C"`,
      sql`1::int`,
      sql`lower(COALESCE(${aiMountainDiscoveries.area}, '')) COLLATE "C"`,
      aiMountainDiscoveries.id,
    )
    .limit(limit)
  return rows as SavedSearchRow[];
}

async function catalogueIdentityExists(identity: MountainIdentity): Promise<boolean> {
  try {
    const rows = await executeEngineReadOnlyQuery<Record<string, unknown>>(
      `SELECT 1 AS "found"
       FROM public.mountains AS m
       WHERE lower(normalize(trim(m.name), NFKC)) = lower(normalize(trim($1), NFKC))
         AND lower(normalize(trim(COALESCE(m.country, '')), NFKC)) = lower(normalize(trim($2), NFKC))
         AND lower(normalize(trim(COALESCE(m.region, '')), NFKC)) = lower(normalize(trim($3), NFKC))
       LIMIT 1`,
      [identity.name, identity.country, identity.region],
    );
    return rows.length > 0;
  } catch {
    throw new MountainCatalogueUnavailableError();
  }
}

async function savedIdentityExists(identityKey: string): Promise<boolean> {
  const rows = await db
    .select({ id: aiMountainDiscoveries.id })
    .from(aiMountainDiscoveries)
    .where(eq(aiMountainDiscoveries.identityKey, identityKey))
    .limit(1);
  return rows.length > 0;
}

async function persistCandidate(candidate: MountainDiscoveryCandidate): Promise<SavedRow> {
  const [inserted] = await db
    .insert(aiMountainDiscoveries)
    .values({
      id: `ai:${randomUUID()}`,
      identityKey: candidate.identityKey,
      name: candidate.name,
      country: candidate.country,
      region: candidate.region,
      area: candidate.area,
      elevationM: candidate.elevationM,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      originalQuery: candidate.originalQuery,
      provenance: candidate.provenance,
      verificationStatus: "ai_unverified",
    })
    .onConflictDoNothing({ target: aiMountainDiscoveries.identityKey })
    .returning({
      id: aiMountainDiscoveries.id,
      name: aiMountainDiscoveries.name,
      country: aiMountainDiscoveries.country,
      region: aiMountainDiscoveries.region,
      area: aiMountainDiscoveries.area,
      elevationM: aiMountainDiscoveries.elevationM,
      latitude: aiMountainDiscoveries.latitude,
      longitude: aiMountainDiscoveries.longitude,
      verificationStatus: aiMountainDiscoveries.verificationStatus,
    });
  if (inserted) return inserted;
  const [existing] = await db
    .select({
      id: aiMountainDiscoveries.id,
      name: aiMountainDiscoveries.name,
      country: aiMountainDiscoveries.country,
      region: aiMountainDiscoveries.region,
      area: aiMountainDiscoveries.area,
      elevationM: aiMountainDiscoveries.elevationM,
      latitude: aiMountainDiscoveries.latitude,
      longitude: aiMountainDiscoveries.longitude,
      verificationStatus: aiMountainDiscoveries.verificationStatus,
    })
    .from(aiMountainDiscoveries)
    .where(sql`${aiMountainDiscoveries.identityKey} = ${candidate.identityKey}`)
    .limit(1);
  if (!existing) throw new Error("Could not persist AI mountain discovery");
  return existing;
}

const CandidateSchema = z.object({
  exists: z.literal(true),
  confidence: z.object({
    existence: z.literal("high"),
    name: z.literal("high"),
    location: z.literal("high"),
    coordinates: z.literal("high"),
  }),
  name: z.string().trim().min(2).max(200),
  country: z.string().trim().min(1).max(100),
  region: z.string().trim().min(1).max(200),
  area: z.string().trim().max(200).nullable().optional(),
  elevationM: z.number().finite().min(-500).max(9000).nullable().optional(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

async function generateCandidate(query: string): Promise<unknown> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_completion_tokens: 500,
    messages: [
      {
        role: "system",
        content:
          'Identify a real mountain only when highly confident. Return only JSON with exists:true, confidence:{existence:"high",name:"high",location:"high",coordinates:"high"}, name, country, region, optional area/elevationM, latitude, longitude. If unsure or no real mountain exists, return {"exists":false}. Do not provide routes.',
      },
      { role: "user", content: `Identify this mountain: "${query}"` },
    ],
  });
  const content = response.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    return JSON.parse(content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
  } catch {
    return null;
  }
}

const defaultDependencies: MountainDiscoveryDependencies = {
  catalogueSearch: searchCatalogue,
  savedSearch: searchSaved,
  catalogueIdentityExists,
  savedIdentityExists,
  saveCandidate: persistCandidate,
  generateCandidate,
};

function catalogueItem(row: CatalogueRow): MountainDiscoveryItem {
  return {
    id: row.id,
    name: row.name,
    country: row.country ?? "",
    region: row.region ?? "",
    area: row.area,
    elevationM: row.elevationM,
    latitude: row.latitude,
    longitude: row.longitude,
    source: "catalogue",
    verificationStatus: row.status === "verified" ? "verified" : "imported",
  };
}

function savedItem(row: SavedRow): MountainDiscoveryItem {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    region: row.region,
    area: row.area,
    elevationM: row.elevationM,
    latitude: row.latitude,
    longitude: row.longitude,
    source: "ai",
    verificationStatus: "ai_unverified",
  };
}

function normalizedIdentity(item: Pick<MountainDiscoveryItem, "name" | "country" | "region">): string {
  return JSON.stringify([item.name, item.country, item.region]
    .map((part) => part.normalize("NFKC").trim().toLocaleLowerCase("en"))
  );
}

function identityKeyFor(identity: MountainIdentity): string {
  return createHash("sha256")
    .update(JSON.stringify([identity.name, identity.country, identity.region]
      .map((part) => part.normalize("NFKC").trim().toLocaleLowerCase("en"))))
    .digest("hex");
}

const SEARCH_CHUNK_SIZE = 250;
type SearchRow = CatalogueRow | SavedSearchRow;

function cursorFor(row: SearchRow): MountainDiscoveryCursor {
  return {
    sortName: row.sortName,
    sortCountry: row.sortCountry,
    sortRegion: row.sortRegion,
    sortSource: row.sortSource,
    sortArea: row.sortArea,
    id: row.id,
  };
}

function compareUnicodeScalars(left: string, right: string): number {
  const leftScalars = Array.from(left, (character) => character.codePointAt(0)!);
  const rightScalars = Array.from(right, (character) => character.codePointAt(0)!);
  const length = Math.min(leftScalars.length, rightScalars.length);
  for (let index = 0; index < length; index += 1) {
    if (leftScalars[index] !== rightScalars[index]) return leftScalars[index] - rightScalars[index];
  }
  return leftScalars.length - rightScalars.length;
}

function compareSearchRows(left: SearchRow, right: SearchRow): number {
  return compareUnicodeScalars(left.sortName, right.sortName)
    || compareUnicodeScalars(left.sortCountry, right.sortCountry)
    || compareUnicodeScalars(left.sortRegion, right.sortRegion)
    || left.sortSource - right.sortSource
    || compareUnicodeScalars(left.sortArea, right.sortArea)
    || compareUnicodeScalars(left.id, right.id);
}

interface SearchStream<Row extends SearchRow> {
  search: (query: string, limit: number, cursor?: MountainDiscoveryCursor) => Promise<Row[]>;
  buffer: Row[];
  cursor?: MountainDiscoveryCursor;
  exhausted: boolean;
}

async function ensureStreamHead<Row extends SearchRow>(
  stream: SearchStream<Row>,
  query: string,
): Promise<void> {
  if (stream.buffer.length || stream.exhausted) return;
  const rows = await stream.search(query, SEARCH_CHUNK_SIZE, stream.cursor);
  stream.buffer = rows;
  if (rows.length) stream.cursor = cursorFor(rows[rows.length - 1]);
  if (rows.length < SEARCH_CHUNK_SIZE) stream.exhausted = true;
}

function validQuery(query: string): boolean {
  return query.length >= 2 && query.length <= 100 && /[\p{Letter}\p{Number}]{2}/u.test(query);
}

export function createMountainDiscoveryHandlers(
  overrides: Partial<MountainDiscoveryDependencies> = {},
): { search: RequestHandler; discoverAi: RequestHandler } {
  const dependencies = { ...defaultDependencies, ...overrides };
  const search: RequestHandler = async (req, res) => {
    const parsed = z.object({
      q: z.string().trim().min(2).max(100),
      limit: z.coerce.number().int().min(1).max(50).default(20),
      offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
    }).safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Search term must be 2–100 characters; limit and offset must be valid." });
      return;
    }
    const { q, limit, offset } = parsed.data;
    try {
      const catalogueStream: SearchStream<CatalogueRow> = {
        search: dependencies.catalogueSearch,
        buffer: [],
        exhausted: false,
      };
      const savedStream: SearchStream<SavedSearchRow> = {
        search: dependencies.savedSearch,
        buffer: [],
        exhausted: false,
      };
      const identities = new Set<string>();
      const items: MountainDiscoveryItem[] = [];
      let uniqueCount = 0;
      let hasMore = false;
      while (true) {
        await Promise.all([
          ensureStreamHead(catalogueStream, q),
          ensureStreamHead(savedStream, q),
        ]);
        const catalogueHead = catalogueStream.buffer[0];
        const savedHead = savedStream.buffer[0];
        if (!catalogueHead && !savedHead) break;

        const takeCatalogue = !savedHead
          || Boolean(catalogueHead && compareSearchRows(catalogueHead, savedHead) <= 0);
        const row = takeCatalogue
          ? catalogueStream.buffer.shift()!
          : savedStream.buffer.shift()!;
        const item = takeCatalogue ? catalogueItem(row as CatalogueRow) : savedItem(row as SavedRow);
        const identity = normalizedIdentity(item);
        if (identities.has(identity)) continue;
        identities.add(identity);
        if (uniqueCount >= offset + limit) {
          hasMore = true;
          break;
        }
        if (uniqueCount >= offset) items.push(item);
        uniqueCount += 1;
      }
      res.json({
        items,
        hasMore,
        catalogueStatus: "available",
      });
    } catch (error) {
      if (error instanceof MountainCatalogueUnavailableError) {
        res.status(503).json({ error: error.message, code: "MOUNTAIN_CATALOGUE_UNAVAILABLE" });
      } else {
        req.log.error({ err: error }, "Mountain discovery search failed");
        res.status(503).json({ error: "Mountain discovery is temporarily unavailable", code: "MOUNTAIN_DISCOVERY_UNAVAILABLE" });
      }
    }
  };

  const discoverAi: RequestHandler = async (req, res) => {
    const parsed = z.object({ q: z.string().trim().min(2).max(100) }).safeParse(req.body);
    if (!parsed.success || !validQuery(parsed.data.q)) {
      res.status(400).json({ error: "A reasonable mountain search term (2–100 characters) is required." });
      return;
    }
    const q = parsed.data.q;
    try {
      const [catalogue, saved] = await Promise.all([
        dependencies.catalogueSearch(q, 1),
        dependencies.savedSearch(q, 1),
      ]);
      if (catalogue.length || saved.length) {
        res.status(409).json({ error: "A catalogue or saved discovery result already exists.", code: "DISCOVERY_ALREADY_EXISTS" });
        return;
      }

      const candidateResult = await dependencies.generateCandidate(q);
      const candidate = CandidateSchema.safeParse(candidateResult);
      if (!candidate.success) {
        res.status(404).json({ error: "No confidently identified mountain was found.", code: "AI_NO_CONFIDENT_RESULT" });
        return;
      }
      const data = candidate.data;
      const identity = { name: data.name, country: data.country, region: data.region };
      const identityKey = identityKeyFor(identity);

      // Recheck after generation so an SDE entry added while AI was running can
      // never be saved as a new unverified identity.
      const [catalogueDuplicate, savedDuplicate] = await Promise.all([
        dependencies.catalogueIdentityExists(identity),
        dependencies.savedIdentityExists(identityKey),
      ]);
      if (catalogueDuplicate || savedDuplicate) {
        res.status(409).json({ error: "This mountain now exists in the catalogue or saved discoveries.", code: "DISCOVERY_ALREADY_EXISTS" });
        return;
      }
      const savedItemResult = await dependencies.saveCandidate({
        name: data.name,
        country: data.country,
        region: data.region,
        area: data.area ?? null,
        elevationM: data.elevationM ?? null,
        latitude: data.latitude,
        longitude: data.longitude,
        originalQuery: q,
        provenance: JSON.stringify({
          provider: "OpenAI",
          model: "gpt-4o",
          query: q,
          verificationStatus: "ai_unverified",
          generatedAt: new Date().toISOString(),
        }),
        identityKey,
      });
      res.status(201).json({ item: savedItem(savedItemResult) });
    } catch (error) {
      if (error instanceof MountainCatalogueUnavailableError) {
        res.status(503).json({ error: error.message, code: "MOUNTAIN_CATALOGUE_UNAVAILABLE" });
      } else {
        req.log.error({ err: error }, "AI mountain discovery failed");
        res.status(503).json({ error: "Mountain discovery is temporarily unavailable", code: "MOUNTAIN_DISCOVERY_UNAVAILABLE" });
      }
    }
  };
  return { search, discoverAi };
}

const router: IRouter = Router();
const handlers = createMountainDiscoveryHandlers();
router.get("/mountain-discovery", handlers.search);
router.post("/mountain-discovery/ai", handlers.discoverAi);
export default router;