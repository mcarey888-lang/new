import { describe, expect, it, vi } from "vitest";
import type { RequestHandler } from "express";
import {
  lookupVerifiedCanonicalSummitsInArea,
  lookupVerifiedCanonicalMountain,
  normalizeMountainLookupTerm,
  type CanonicalLookupResult,
  type CanonicalQuery,
  type VerifiedCanonicalMountain,
} from "../services/mountain/canonicalMountainLookup";

vi.mock("@workspace/db", () => ({
  cachedMountains: { slug: {} },
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

import {
  createMountainLookupHandler,
  type MountainLookupDependencies,
} from "../routes/mountain";

const candidate = {
  id: "11111111-1111-1111-1111-111111111111",
  sourceFeatureId: "INT-0200",
  canonicalSourceKey: "geonames:123",
  name: "Aletschhorn",
  matchedBy: "alias",
  country: "Switzerland",
  region: null,
  area: "Bernese Alps",
  county: null,
  elevationM: 4194,
  prominenceM: 1043,
  colHeightM: null,
  gridReference: null,
  summitFeature: null,
  latitude: 46.465,
  longitude: 7.993,
  provenanceVersion: "international-v4-2026-09-07",
};

const verifiedMountain: VerifiedCanonicalMountain = {
  id: candidate.id,
  sourceFeatureId: candidate.sourceFeatureId,
  canonicalSourceKey: candidate.canonicalSourceKey,
  name: candidate.name,
  matchedBy: "alias",
  country: "Switzerland",
  area: "Bernese Alps",
  elevationM: 4194,
  prominenceM: 1043,
  latitude: candidate.latitude,
  longitude: candidate.longitude,
  provenanceVersion: candidate.provenanceVersion,
  routes: [],
};

const legacyRoute = {
  name: "Normal route",
  distance: 12,
  elevationGain: 1400,
  highestAltitude: 4194,
  difficulty: "Alpine" as const,
  description: "Cached legacy route details",
  startingPoint: "Trailhead",
};

const verifiedRoute = {
  identityKey: "mount-fuji-yoshida",
  name: "Yoshida Trail",
  aliases: ["Yoshidaguchi Trail"],
  description: "Verified route description",
  startName: "Fuji-Subaru Line 5th Station",
  startElevationM: 2305,
  summitElevationM: 3776,
  distanceKm: 14,
  totalAscentM: 1471,
  totalDescentM: 1471,
  typicalDurationHours: 8,
  evidence: {
    publisher: "Official publisher",
    title: "Official route guide",
    url: "https://example.com/verified-route",
  },
};

function queryMockWith(
  ...results: Record<string, unknown>[][]
): CanonicalQuery & ReturnType<typeof vi.fn> {
  const query = vi.fn();
  for (const result of results) {
    query.mockResolvedValueOnce(result);
  }
  return query as CanonicalQuery & ReturnType<typeof vi.fn>;
}

function dependencies(
  canonicalResult: CanonicalLookupResult,
): MountainLookupDependencies {
  return {
    canonicalLookup: vi.fn().mockResolvedValue(canonicalResult),
    cacheLookup: vi.fn().mockResolvedValue(null),
    cacheStore: vi.fn().mockResolvedValue(undefined),
    aiLookup: vi.fn().mockResolvedValue({
      mountainName: "AI mountain",
      routes: [],
    }),
  };
}

async function invoke(
  handler: RequestHandler,
  body: unknown,
): Promise<{ status: number; payload: Record<string, unknown> }> {
  let status = 200;
  let payload: Record<string, unknown> = {};
  const response = {
    status(code: number) {
      status = code;
      return response;
    },
    json(value: Record<string, unknown>) {
      payload = value;
      return response;
    },
  };
  const request = {
    body,
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };

  await handler(
    request as never,
    response as never,
    vi.fn(),
  );

  return { status, payload };
}

describe("normalizeMountainLookupTerm", () => {
  it("uses NFKC and Unicode alphanumeric normalization", () => {
    expect(normalizeMountainLookupTerm("  ＡＬＥＴＳＣＨ-ＨＯＲＮ  ")).toBe(
      "aletschhorn",
    );
    expect(normalizeMountainLookupTerm("Aleč-hornas")).toBe("alečhornas");
    expect(normalizeMountainLookupTerm("Straße")).toBe("strasse");
    expect(normalizeMountainLookupTerm("ΟΣ")).toBe("οσ");
    expect(normalizeMountainLookupTerm("Ꭰ")).toBe("Ꭰ");
    expect(normalizeMountainLookupTerm("ꭰ")).toBe("Ꭰ");
    expect(normalizeMountainLookupTerm("µ")).toBe("μ");
  });
});

describe("lookupVerifiedCanonicalMountain", () => {
  it("resolves an exact canonical name and returns trusted facts", async () => {
    const query = queryMockWith(
      [],
      [{ ...candidate, name: "Mount Fuji" }],
      [{ ...candidate, name: "Mount Fuji", matchedBy: "canonical_name" }],
      [],
    );

    const result = await lookupVerifiedCanonicalMountain(
      { name: "mount fuji" },
      query,
    );

    expect(result.kind).toBe("match");
    if (result.kind === "match") {
      expect(result.mountain.name).toBe("Mount Fuji");
      expect(result.mountain.matchedBy).toBe("canonical_name");
    }
    expect(query.mock.calls[0][0]).toContain("m.status = 'verified'");
    expect(query.mock.calls[0][0]).toContain("a.status = 'verified'");
    expect(query.mock.calls[0][1]).toEqual(["mountfuji"]);
    expect(query.mock.calls[3][0]).toContain("ri.status = 'verified'");
    expect(query.mock.calls[3][0]).toContain("rd.status = 'verified'");
    expect(query.mock.calls[3][0]).toContain("rf.status = 'verified'");
  });

  it("trusts an imported DoBIH mountain only through its trusted source record", async () => {
    const dobihCandidate = {
      ...candidate,
      sourceFeatureId: "20501",
      canonicalSourceKey: "dobih:20501",
      name: "Scafell Pike",
      country: "United Kingdom",
      region: "Cumbria",
    };
    const query = queryMockWith(
      [],
      [dobihCandidate],
      [dobihCandidate],
      [],
    );

    const result = await lookupVerifiedCanonicalMountain(
      { name: "Scafell Pike" },
      query,
    );

    expect(result).toMatchObject({
      kind: "match",
      mountain: {
        name: "Scafell Pike",
        canonicalSourceKey: "dobih:20501",
        matchedBy: "canonical_name",
      },
    });
    for (const [sql, params] of query.mock.calls.slice(0, 3)) {
      expect(sql).toContain("EXISTS");
      expect(sql).toContain("msr.mountain_id = m.id");
      expect(sql).toContain(
        "msr.source_dataset = 'Database of British and Irish Hills (DoBIH)'",
      );
      expect(sql).toContain("msr.source_trust = 'trusted_source'");
      expect(sql).toContain("msr.final_verification_status = 'trusted_source'");
      expect(sql).toContain("msr.qa_status IN ('pass', 'info')");
      expect(sql).not.toContain("msr.ai_fallback_allowed");
      expect(params).toEqual(
        sql.includes("normalized_name") ? ["scafellpike"] :
        sql.includes("ANY($1::uuid[])") ? [[dobihCandidate.id]] : [],
      );
    }
  });

  it("maps verified route identity, definition, fact and evidence data", async () => {
    const query = queryMockWith(
      [],
      [{ ...candidate, name: "Mount Fuji" }],
      [{ ...candidate, name: "Mount Fuji" }],
      [
        {
          identityKey: verifiedRoute.identityKey,
          name: verifiedRoute.name,
          aliases: verifiedRoute.aliases,
          description: verifiedRoute.description,
          startName: verifiedRoute.startName,
          startElevationM: verifiedRoute.startElevationM,
          summitElevationM: verifiedRoute.summitElevationM,
          distanceKm: verifiedRoute.distanceKm,
          totalAscentM: verifiedRoute.totalAscentM,
          totalDescentM: verifiedRoute.totalDescentM,
          typicalDurationHours: verifiedRoute.typicalDurationHours,
          publisher: verifiedRoute.evidence.publisher,
          evidenceTitle: verifiedRoute.evidence.title,
          evidenceUrl: verifiedRoute.evidence.url,
        },
      ],
    );

    const result = await lookupVerifiedCanonicalMountain(
      { name: "Mount Fuji" },
      query,
    );

    expect(result).toMatchObject({
      kind: "match",
      mountain: { routes: [verifiedRoute] },
    });
  });

  it("resolves a diacritic-bearing approved alias to its canonical mountain", async () => {
    const query = queryMockWith(
      [candidate],
      [],
      [candidate],
      [],
    );

    const result = await lookupVerifiedCanonicalMountain(
      { name: "ALEČ-HORNAS", country: "switzerland" },
      query,
    );

    expect(result).toMatchObject({
      kind: "match",
      mountain: {
        name: "Aletschhorn",
        matchedBy: "alias",
        canonicalSourceKey: "geonames:123",
      },
    });
    expect(query.mock.calls[0][1]).toEqual(["alečhornas"]);
    expect(query.mock.calls[0][0]).toContain("a.status = 'verified'");
  });

  it("does not trust a review-only alias", async () => {
    const query = vi.fn(
      async (text: string): Promise<Record<string, unknown>[]> => {
        if (text.includes("mountain_aliases")) {
          return text.includes("a.status = 'verified'") ? [] : [candidate];
        }
        return [];
      },
    ) as CanonicalQuery & ReturnType<typeof vi.fn>;

    const result = await lookupVerifiedCanonicalMountain(
      { name: "ALEČ-HORNAS" },
      query,
    );

    expect(result).toEqual({ kind: "none" });
    expect(query.mock.calls[0][0]).toContain("a.status = 'verified'");
  });

  it("uses country context to resolve a genuine alias collision", async () => {
    const frenchCandidate = {
      ...candidate,
      id: "22222222-2222-2222-2222-222222222222",
      sourceFeatureId: "INT-0201",
      canonicalSourceKey: "geonames:456",
      name: "Aletschhorn France",
      country: "France",
    };
    const query = queryMockWith(
      [candidate, frenchCandidate],
      [],
      [candidate],
      [],
    );

    const result = await lookupVerifiedCanonicalMountain(
      { name: "Alečhornas", country: "Switzerland" },
      query,
    );

    expect(result).toMatchObject({
      kind: "match",
      mountain: {
        name: "Aletschhorn",
        country: "Switzerland",
      },
    });
    expect(query.mock.calls[2][1]).toEqual([[candidate.id]]);
  });

  it("uses importer-compatible case folding for canonical names", async () => {
    const streetMountain = {
      ...candidate,
      name: "Straße",
      country: "Germany",
    };
    const query = queryMockWith(
      [],
      [streetMountain],
      [streetMountain],
      [],
    );

    const result = await lookupVerifiedCanonicalMountain(
      { name: "STRASSE" },
      query,
    );

    expect(result).toMatchObject({
      kind: "match",
      mountain: {
        name: "Straße",
        matchedBy: "canonical_name",
      },
    });
  });

  it("uses Python case folding for alias query parameters", async () => {
    const query = queryMockWith(
      [candidate],
      [],
      [candidate],
      [],
    );

    const result = await lookupVerifiedCanonicalMountain(
      { name: "ꭰ" },
      query,
    );

    expect(result.kind).toBe("match");
    expect(query.mock.calls[0][1]).toEqual(["Ꭰ"]);
  });

  it("returns none if a discovered candidate is no longer verified", async () => {
    const query = queryMockWith(
      [candidate],
      [],
      [],
    );

    const result = await lookupVerifiedCanonicalMountain(
      { name: "Alečhornas" },
      query,
    );

    expect(result).toEqual({ kind: "none" });
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("returns every verified exact match as ambiguous without guessing", async () => {
    const secondCandidate = {
      ...candidate,
      id: "22222222-2222-2222-2222-222222222222",
      sourceFeatureId: "INT-0201",
      canonicalSourceKey: "geonames:456",
      name: "Aletschhorn East",
    };
    const query = queryMockWith(
      [candidate, secondCandidate],
      [],
      [candidate, secondCandidate],
    );

    const result = await lookupVerifiedCanonicalMountain(
      { name: "Alečhornas" },
      query,
    );

    expect(result.kind).toBe("ambiguous");
    if (result.kind === "ambiguous") {
      expect(result.matches).toHaveLength(2);
    }
    expect(query).toHaveBeenCalledTimes(3);
  });
});

describe("lookupVerifiedCanonicalSummitsInArea", () => {
  it("uses a bounded verified geographic query and attaches only verified routes", async () => {
    const lowerSummit = {
      ...candidate,
      id: "22222222-2222-2222-2222-222222222222",
      name: "Lower Summit",
      elevationM: 800,
      prominenceM: 120,
    };
    const query = queryMockWith(
      [candidate, lowerSummit],
      [{
        mountainId: candidate.id,
        identityKey: verifiedRoute.identityKey,
        name: verifiedRoute.name,
        aliases: verifiedRoute.aliases,
        description: verifiedRoute.description,
        startName: verifiedRoute.startName,
        startElevationM: verifiedRoute.startElevationM,
        summitElevationM: verifiedRoute.summitElevationM,
        distanceKm: verifiedRoute.distanceKm,
        totalAscentM: verifiedRoute.totalAscentM,
        totalDescentM: verifiedRoute.totalDescentM,
        typicalDurationHours: verifiedRoute.typicalDurationHours,
        publisher: verifiedRoute.evidence.publisher,
        evidenceTitle: verifiedRoute.evidence.title,
        evidenceUrl: verifiedRoute.evidence.url,
      }],
    );

    const summits = await lookupVerifiedCanonicalSummitsInArea({
      centerLat: 46.465,
      centerLng: 7.993,
      radiusKm: 30,
      limit: 2,
    }, query);

    expect(summits.map(summit => summit.name)).toEqual([
      "Aletschhorn",
      "Lower Summit",
    ]);
    expect(summits[0].routes).toEqual([verifiedRoute]);
    expect(summits[1].routes).toEqual([]);
    expect(query.mock.calls[0][0]).toContain("ST_DWithin");
    expect(query.mock.calls[0][0]).toContain("m.status = 'verified'");
    expect(query.mock.calls[0][0]).toContain("m.canonical_source_key IS NOT NULL");
    expect(query.mock.calls[0][1]).toEqual([46.465, 7.993, 30_000, 2]);
    expect(query.mock.calls[1][0]).toContain("ri.status = 'verified'");
    expect(query.mock.calls[1][0]).toContain("rd.status = 'verified'");
    expect(query.mock.calls[1][0]).toContain("rf.status = 'verified'");
    expect(query.mock.calls[1][1]).toEqual([[candidate.id, lowerSummit.id]]);
  });

  it("includes trusted DoBIH records in the bounded area query", async () => {
    const dobihCandidate = {
      ...candidate,
      sourceFeatureId: "20501",
      canonicalSourceKey: "dobih:20501",
      name: "Scafell Pike",
    };
    const query = queryMockWith([dobihCandidate], []);

    const summits = await lookupVerifiedCanonicalSummitsInArea(
      {
        centerLat: 54.454,
        centerLng: -3.213,
        radiusKm: 20,
        limit: 1,
      },
      query,
    );

    expect(summits).toMatchObject([
      { name: "Scafell Pike", canonicalSourceKey: "dobih:20501" },
    ]);
    expect(query.mock.calls[0][0]).toContain("EXISTS");
    expect(query.mock.calls[0][0]).toContain(
      "msr.source_dataset = 'Database of British and Irish Hills (DoBIH)'",
    );
    expect(query.mock.calls[0][0]).toContain("msr.final_verification_status = 'trusted_source'");
    expect(query.mock.calls[0][1]).toEqual([54.454, -3.213, 20_000, 1]);
    expect(query.mock.calls[1][1]).toEqual([[dobihCandidate.id]]);
  });
});

describe("POST /api/mountain-lookup handler", () => {
  it("returns only verified catalogue routes for a canonical match", async () => {
    const deps = dependencies({
      kind: "match",
      mountain: { ...verifiedMountain, routes: [verifiedRoute] },
    });
    vi.mocked(deps.cacheLookup).mockResolvedValue({
      mountainName: "Aletschhorn",
      routes: [legacyRoute],
    });
    vi.mocked(deps.aiLookup).mockResolvedValue({
      mountainName: "AI mountain",
      routes: [legacyRoute],
    });
    const result = await invoke(
      createMountainLookupHandler(deps),
      { name: "Aletschhorn" },
    );

    expect(result.status).toBe(200);
    expect(result.payload).toMatchObject({
      source: "canonical",
      mountainName: "Aletschhorn",
      routeSource: "canonical",
      routes: [verifiedRoute],
      canonicalIdentity: {
        canonicalSourceKey: "geonames:123",
        matchedBy: "alias",
        matchedTerm: "Aletschhorn",
      },
      trustedFacts: {
        verificationStatus: "verified",
        elevationM: 4194,
        routes: [verifiedRoute],
      },
    });
    expect(deps.cacheLookup).not.toHaveBeenCalled();
    expect(deps.aiLookup).not.toHaveBeenCalled();
    expect(deps.cacheStore).not.toHaveBeenCalled();
  });

  it("returns no routes and never invokes AI when a canonical mountain has no verified routes", async () => {
    const deps = dependencies({ kind: "match", mountain: verifiedMountain });
    vi.mocked(deps.cacheLookup).mockResolvedValue({
      mountainName: "Aletschhorn",
      routes: [legacyRoute],
    });
    vi.mocked(deps.aiLookup).mockResolvedValue({
      mountainName: "AI mountain",
      routes: [legacyRoute],
    });

    const result = await invoke(
      createMountainLookupHandler(deps),
      { name: "Aletschhorn" },
    );

    expect(result.payload).toMatchObject({
      source: "canonical",
      routeSource: "unavailable",
      routes: [],
      trustedFacts: { routes: [] },
    });
    expect(deps.cacheLookup).not.toHaveBeenCalled();
    expect(deps.aiLookup).not.toHaveBeenCalled();
    expect(deps.cacheStore).not.toHaveBeenCalled();
  });

  it("returns 409 for ambiguity and never falls back to cache or AI", async () => {
    const deps = dependencies({
      kind: "ambiguous",
      matches: [
        {
          id: candidate.id,
          sourceFeatureId: candidate.sourceFeatureId,
          canonicalSourceKey: candidate.canonicalSourceKey,
          name: candidate.name,
          country: "Switzerland",
        },
        {
          id: "22222222-2222-2222-2222-222222222222",
          sourceFeatureId: "INT-0201",
          canonicalSourceKey: "geonames:456",
          name: "Aletschhorn East",
          country: "Switzerland",
        },
      ],
    });

    const result = await invoke(
      createMountainLookupHandler(deps),
      { name: "Alečhornas" },
    );

    expect(result.status).toBe(409);
    expect(result.payload).toMatchObject({
      code: "AMBIGUOUS_MOUNTAIN",
    });
    expect(deps.cacheLookup).not.toHaveBeenCalled();
    expect(deps.aiLookup).not.toHaveBeenCalled();
  });

  it("checks the legacy cache only after a canonical miss", async () => {
    const events: string[] = [];
    const deps = dependencies({ kind: "none" });
    vi.mocked(deps.canonicalLookup).mockImplementation(async () => {
      events.push("canonical");
      return { kind: "none" };
    });
    vi.mocked(deps.cacheLookup).mockImplementation(async () => {
      events.push("cache");
      return { mountainName: "Cached mountain", routes: [] };
    });

    const result = await invoke(
      createMountainLookupHandler(deps),
      { name: "Cached mountain" },
    );

    expect(events).toEqual(["canonical", "cache"]);
    expect(result.payload).toMatchObject({
      source: "cache",
      mountainName: "Cached mountain",
    });
    expect(deps.aiLookup).not.toHaveBeenCalled();
  });

  it("never labels review-only Cho Oyu as canonical", async () => {
    const deps = dependencies({ kind: "none" });
    vi.mocked(deps.aiLookup).mockResolvedValue({
      mountainName: "Cho Oyu",
      routes: [legacyRoute],
    });

    const result = await invoke(
      createMountainLookupHandler(deps),
      { name: "Cho Oyu" },
    );

    expect(result.payload).toMatchObject({
      source: "ai",
      mountainName: "Cho Oyu",
      routes: [legacyRoute],
    });
    expect(result.payload).not.toHaveProperty("canonicalIdentity");
    expect(result.payload).not.toHaveProperty("trustedFacts");
  });
});
