import { describe, expect, it, vi } from "vitest";
import {
  createMountainDiscoveryHandlers,
  MountainCatalogueUnavailableError,
} from "../routes/mountain-discovery";
import { createMountainLookupHandler } from "../routes/mountain";

function invoke(handler: any, input: { query?: unknown; body?: unknown }) {
  const result: { status: number; body: unknown } = { status: 200, body: undefined };
  const res = {
    status(code: number) {
      result.status = code;
      return this;
    },
    json(body: unknown) {
      result.body = body;
      return this;
    },
  };
  const req = {
    query: input.query ?? {},
    body: input.body ?? {},
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  };
  return Promise.resolve(handler(req, res, vi.fn())).then(() => result);
}

const catalogueRow = {
  id: "sde-123",
  name: "Mount Sample",
  sortRank: 2,
  country: "Exampleland",
  region: "North",
  area: "Sample Range",
  elevationM: 2100,
  latitude: 45,
  longitude: 7,
  status: "imported",
};

describe("mountain discovery", () => {
  it("places an exact Mont Blanc match ahead of nearby peaks across paginated sources", async () => {
    const sortFields = {
      sortCountry: "france", sortRegion: "haute-savoie", sortArea: "mont blanc massif", sortSource: 0,
    };
    const catalogueRows = [
      { ...catalogueRow, ...sortFields, id: "summit", name: "Mont Blanc", sortRank: 0, sortName: "mont blanc",
        country: "France", region: "Haute-Savoie" },
      { ...catalogueRow, ...sortFields, id: "tacul", name: "Mont Blanc du Tacul", sortRank: 1, sortName: "mont blanc du tacul",
        country: "France", region: "Haute-Savoie" },
      { ...catalogueRow, ...sortFields, id: "midi", name: "Aiguille du Midi", sortRank: 3, sortName: "aiguille du midi",
        country: "France", region: "Haute-Savoie" },
    ];
    const savedRows = [{
      ...catalogueRows[0], id: "ai:duplicate", sortSource: 1, verificationStatus: "ai_unverified",
    }];
    const pageAfter = <T extends { id: string }>(rows: T[], limit: number, cursor?: { id: string }) => {
      const index = cursor ? rows.findIndex(row => row.id === cursor.id) + 1 : 0;
      return rows.slice(index, index + limit);
    };
    const handlers = createMountainDiscoveryHandlers({
      catalogueSearch: vi.fn(async (_query, limit, cursor) => pageAfter(catalogueRows, limit, cursor)),
      savedSearch: vi.fn(async (_query, limit, cursor) => pageAfter(savedRows, limit, cursor)),
    });
    const first = await invoke(handlers.search, { query: { q: "Mont blanc", limit: "1" } });
    const second = await invoke(handlers.search, { query: { q: "Mont blanc", limit: "1", offset: "1" } });
    const third = await invoke(handlers.search, { query: { q: "Mont blanc", limit: "1", offset: "2" } });
    expect(first.body).toMatchObject({ items: [{ id: "summit" }], hasMore: true });
    expect(second.body).toMatchObject({ items: [{ id: "tacul" }], hasMore: true });
    expect(third.body).toMatchObject({ items: [{ id: "midi" }], hasMore: false });
  });

  it("returns catalogue matches without invoking AI and labels imported status", async () => {
    const generateCandidate = vi.fn();
    const handlers = createMountainDiscoveryHandlers({
      catalogueSearch: vi.fn().mockResolvedValue([catalogueRow]),
      savedSearch: vi.fn().mockResolvedValue([]),
      catalogueIdentityExists: vi.fn().mockResolvedValue(false),
      savedIdentityExists: vi.fn().mockResolvedValue(false),
      generateCandidate,
    });
    const response = await invoke(handlers.search, { query: { q: "sample" } });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      catalogueStatus: "available",
      items: [{ id: "sde-123", source: "catalogue", verificationStatus: "imported" }],
    });
    expect(generateCandidate).not.toHaveBeenCalled();
  });

  it("does not invoke AI when the catalogue read is unavailable", async () => {
    const generateCandidate = vi.fn();
    const handlers = createMountainDiscoveryHandlers({
      catalogueSearch: vi.fn().mockRejectedValue(new MountainCatalogueUnavailableError()),
      savedSearch: vi.fn().mockResolvedValue([]),
      catalogueIdentityExists: vi.fn().mockResolvedValue(false),
      savedIdentityExists: vi.fn().mockResolvedValue(false),
      generateCandidate,
    });
    const response = await invoke(handlers.discoverAi, { body: { q: "Sample Peak" } });
    expect(response.status).toBe(503);
    expect(generateCandidate).not.toHaveBeenCalled();
  });

  it("persists only a high-confidence candidate after a genuine zero-result recheck", async () => {
    const catalogueSearch = vi.fn().mockResolvedValue([]);
    const savedSearch = vi.fn().mockResolvedValue([]);
    const candidate = {
      exists: true,
      confidence: { existence: "high", name: "high", location: "high", coordinates: "high" },
      name: "New Sample Peak",
      country: "Exampleland",
      region: "North",
      area: "Sample Range",
      elevationM: 2300,
      latitude: 45.1,
      longitude: 7.1,
    };
    const saveCandidate = vi.fn().mockImplementation(async (input) => ({
      id: "ai:unique-id",
      ...input,
      verificationStatus: "ai_unverified",
    }));
    const handlers = createMountainDiscoveryHandlers({
      catalogueSearch,
      savedSearch,
      catalogueIdentityExists: vi.fn().mockResolvedValue(false),
      savedIdentityExists: vi.fn().mockResolvedValue(false),
      generateCandidate: vi.fn().mockResolvedValue(candidate),
      saveCandidate,
    });
    const response = await invoke(handlers.discoverAi, { body: { q: "New Sample Peak" } });
    expect(catalogueSearch).toHaveBeenCalledTimes(1);
    expect(saveCandidate).toHaveBeenCalledTimes(1);
    expect(saveCandidate.mock.calls[0][0].provenance).toContain("ai_unverified");
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      item: { id: "ai:unique-id", source: "ai", verificationStatus: "ai_unverified" },
    });
  });

  it("rejects an exact candidate found by the unbounded post-AI identity check", async () => {
    const saveCandidate = vi.fn();
    const handlers = createMountainDiscoveryHandlers({
      catalogueSearch: vi.fn().mockResolvedValue([]),
      savedSearch: vi.fn().mockResolvedValue([]),
      // This exact identity lookup covers every engine row, not merely the
      // first couple of broad name-search results.
      catalogueIdentityExists: vi.fn().mockResolvedValue(true),
      savedIdentityExists: vi.fn().mockResolvedValue(false),
      generateCandidate: vi.fn().mockResolvedValue({
        exists: true,
        confidence: { existence: "high", name: "high", location: "high", coordinates: "high" },
        name: "New Sample Peak",
        country: "Exampleland",
        region: "North",
        latitude: 45.1,
        longitude: 7.1,
      }),
      saveCandidate,
    });
    const response = await invoke(handlers.discoverAi, { body: { q: "New Sample Peak" } });
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ code: "DISCOVERY_ALREADY_EXISTS" });
    expect(saveCandidate).not.toHaveBeenCalled();
  });

  it("supports stable catalogue pagination beyond the former 10k offset ceiling", async () => {
    const rows = Array.from({ length: 10_240 }, (_, index) => {
      const suffix = String(index).padStart(5, "0");
      return {
        ...catalogueRow,
        id: `sde:${suffix}`,
        name: `Peak ${suffix}`,
          sortRank: 1,
        sortName: `peak ${suffix}`,
        sortCountry: "exampleland",
        sortRegion: "north",
        sortSource: 0,
        sortArea: "sample range",
      };
    });
    const pagedCatalogue = vi.fn(async (_query: string, limit: number, cursor?: { id: string }) => {
      const start = cursor ? Number(cursor.id.slice(-5)) + 1 : 0;
      return rows.slice(start, start + limit);
    });
    const handlers = createMountainDiscoveryHandlers({
      catalogueSearch: pagedCatalogue,
      savedSearch: vi.fn().mockResolvedValue([]),
    });
    const response = await invoke(handlers.search, {
      query: { q: "Peak", offset: "10005", limit: "5" },
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      items: [
        { id: "sde:10005" },
        { id: "sde:10006" },
        { id: "sde:10007" },
        { id: "sde:10008" },
        { id: "sde:10009" },
      ],
      hasMore: true,
    });
    expect(pagedCatalogue.mock.calls.length).toBeGreaterThan(1);
    expect(pagedCatalogue.mock.calls.every((call) => call[1] <= 250)).toBe(true);
  });

  it("deduplicates catalogue and saved AI identities before slicing page boundaries", async () => {
    const catalogueRows = [
      {
        ...catalogueRow,
        id: "sde-peak",
        name: "Peak",
        sortRank: 0,
        sortName: "peak",
        sortCountry: "exampleland",
        sortRegion: "north",
        sortSource: 0,
        sortArea: "sample range",
      },
      {
        ...catalogueRow,
        id: "sde-peak-b",
        name: "Peak B",
        sortRank: 1,
        sortName: "peak b",
        sortCountry: "exampleland",
        sortRegion: "north",
        sortSource: 0,
        sortArea: "sample range",
      },
    ];
    const savedRows = [
      {
        id: "ai:peak",
        name: " peak ",
        country: "Exampleland",
        region: "North",
        area: "Sample Range",
        elevationM: 2100,
        latitude: 45,
        longitude: 7,
        verificationStatus: "ai_unverified",
        sortRank: 0,
        sortName: "peak",
        sortCountry: "exampleland",
        sortRegion: "north",
        sortSource: 1,
        sortArea: "sample range",
      },
    ];
    const pageAfter = <T extends { id: string }>(rows: T[], limit: number, cursor?: { id: string }) => {
      const index = cursor ? rows.findIndex((row) => row.id === cursor.id) + 1 : 0;
      return rows.slice(index, index + limit);
    };
    const handlers = createMountainDiscoveryHandlers({
      catalogueSearch: vi.fn(async (_query, limit, cursor) => pageAfter(catalogueRows, limit, cursor)),
      savedSearch: vi.fn(async (_query, limit, cursor) => pageAfter(savedRows, limit, cursor)),
    });
    const firstPage = await invoke(handlers.search, { query: { q: "Peak", limit: "1" } });
    const secondPage = await invoke(handlers.search, { query: { q: "Peak", limit: "1", offset: "1" } });
    expect(firstPage.body).toMatchObject({ items: [{ id: "sde-peak" }], hasMore: true });
    expect(secondPage.body).toMatchObject({ items: [{ id: "sde-peak-b" }] });
  });
});

describe("mountain lookup by discovery ID", () => {
  const makeDependencies = () => ({
    canonicalLookup: vi.fn().mockResolvedValue({ kind: "none" }),
    cacheLookup: vi.fn().mockResolvedValue(null),
    cacheStore: vi.fn(),
    aiLookup: vi.fn(),
  });

  it("does not generate routes or canonical trust for an imported catalogue ID", async () => {
    const dependencies = makeDependencies();
    const handler = createMountainLookupHandler({
      ...dependencies,
      catalogueById: vi.fn().mockResolvedValue(catalogueRow),
    });
    const response = await invoke(handler, { body: { catalogueId: "sde-123" } });
    expect(response.body).toMatchObject({
      source: "catalogue",
      routes: [],
      routeSource: "unavailable",
      catalogueFacts: { verificationStatus: "imported", area: "Sample Range", elevationM: 2100 },
    });
    expect(response.body).not.toHaveProperty("canonicalIdentity");
    expect(response.body).not.toHaveProperty("trustedFacts");
    expect(dependencies.aiLookup).not.toHaveBeenCalled();
  });

  it("returns saved AI discovery with no routes and no canonical identity", async () => {
    const dependencies = makeDependencies();
    const handler = createMountainLookupHandler({
      ...dependencies,
      discoveryById: vi.fn().mockResolvedValue({
        id: "ai:unique-id",
        name: "New Sample Peak",
        country: "Exampleland",
        region: "North",
        area: null,
        elevationM: null,
      }),
    });
    const response = await invoke(handler, { body: { discoveryId: "ai:unique-id" } });
    expect(response.body).toMatchObject({
      source: "ai",
      routes: [],
      routeSource: "unavailable",
      catalogueFacts: { verificationStatus: "ai_unverified" },
    });
    expect(response.body).not.toHaveProperty("canonicalIdentity");
    expect(response.body).not.toHaveProperty("trustedFacts");
  });
});