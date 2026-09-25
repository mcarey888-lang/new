import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import {
  buildMountainHeroPrompt,
  MountainHeroRequestError,
  resolveExistingMountainAutoHeroRequest,
  type MountainAutoHeroRecord,
  type AutoHeroMountain,
} from "../services/artwork/mountainAutoHeroService.js";
import {
  createMountainAutoHeroHandlers,
  type MountainAutoHeroRouteDependencies,
} from "../routes/mountain-auto-hero.js";

const mountain: AutoHeroMountain = {
  id: "01b2c3d4-e5f6-4789-a012-3456789abcde",
  canonicalSourceKey: "geonames:12345",
  name: "Mount Test",
  country: "Testland",
  region: "Test Range",
  area: null,
  elevationM: 3456,
  prominenceM: null,
};

function mockRequest(id = mountain.id) {
  return {
    params: { id },
    ip: "192.0.2.10",
    socket: { remoteAddress: "192.0.2.10" },
    log: { error: vi.fn() },
  } as unknown as Request;
}

function mockResponse() {
  const result = {
    code: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status: vi.fn((code: number) => { result.code = code; return result; }),
    json: vi.fn((body: unknown) => { result.body = body; return result; }),
    setHeader: vi.fn((key: string, value: string) => { result.headers[key] = value; return result; }),
  };
  return result as unknown as Response & typeof result;
}

describe("canonical mountain auto hero prompt", () => {
  it("uses the same realistic photo-style prompt with canonical facts in either grounding mode", () => {
    const grounded = buildMountainHeroPrompt(mountain, true);
    const ungrounded = buildMountainHeroPrompt(mountain, false);
    for (const prompt of [grounded, ungrounded]) {
      expect(prompt).toContain("Mount Test");
      expect(prompt).toContain("Test Range, Testland");
      expect(prompt).toContain("3456 m");
      expect(prompt).toContain("photo-style");
      expect(prompt).toContain("AI-generated artwork");
      expect(prompt).not.toMatch(/hand-painted|travel-poster/);
    }
    expect(grounded).toContain("exact-match reference photograph");
    expect(ungrounded).toContain("No trustworthy exact-match reference photograph");
  });
});

describe("mountain auto hero idempotency and cooldown", () => {
  it("reuses the same in-progress job instead of creating another", () => {
    const record: MountainAutoHeroRecord = {
      status: "generating",
      jobId: "11b2c3d4-e5f6-4789-a012-3456789abcde",
      updatedAt: "2026-10-01T00:00:00.000Z",
    };
    expect(resolveExistingMountainAutoHeroRequest(record)).toEqual({
      kind: "generating",
      jobId: record.jobId,
    });
  });

  it("reuses a ready hero and reports a bounded retry cooldown after failure", () => {
    const ready: MountainAutoHeroRecord = {
      status: "ready",
      jobId: "11b2c3d4-e5f6-4789-a012-3456789abcde",
      updatedAt: "2026-10-01T00:00:00.000Z",
      candidate: {
        id: "11b2c3d4-e5f6-4789-a012-3456789abcde",
        title: "Mount Test — AI-generated depiction",
        imageUrl: "/api/artwork/mountains/01b2c3d4-e5f6-4789-a012-3456789abcde/generated/11b2c3d4-e5f6-4789-a012-3456789abcde",
        sourcePageUrl: "",
        source: "AI-generated illustration",
        width: 1536,
        height: 1024,
        license: null,
        artist: null,
        score: 0,
      },
    };
    expect(resolveExistingMountainAutoHeroRequest(ready)).toEqual({
      kind: "ready",
      imageUrl: ready.candidate!.imageUrl,
    });
    expect(resolveExistingMountainAutoHeroRequest({
      status: "failed",
      updatedAt: "2026-10-01T00:00:00.000Z",
      retryAfter: "2026-10-01T00:10:00.000Z",
      error: "provider failed",
    }, Date.parse("2026-10-01T00:05:00.000Z"))).toEqual({
      kind: "cooldown",
      error: "provider failed",
      retryAfterSeconds: 300,
    });
  });
});

describe("mountain auto hero route auth and response contract", () => {
  it("rejects anonymous opens even when auth middleware is a no-op", async () => {
    const requestMountainAutoHero = vi.fn();
    const dependencies = {
      authenticatedUserId: () => null,
      isMountainHeroRequestId: () => true,
      requestMountainAutoHero,
      getMountainAutoHeroStatus: vi.fn(),
    } as unknown as MountainAutoHeroRouteDependencies;
    const handlers = createMountainAutoHeroHandlers(dependencies);
    const req = mockRequest();
    const res = mockResponse();

    await handlers.requestHero(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(requestMountainAutoHero).not.toHaveBeenCalled();
  });

  it("returns the shared generating job contract for an idempotent in-progress request", async () => {
    const requestMountainAutoHero = vi.fn(async () => ({
      status: "generating" as const,
      jobId: "11b2c3d4-e5f6-4789-a012-3456789abcde",
      started: false,
    }));
    const dependencies = {
      authenticatedUserId: () => "clerk-user",
      isMountainHeroRequestId: () => true,
      requestMountainAutoHero,
      getMountainAutoHeroStatus: vi.fn(),
    } as unknown as MountainAutoHeroRouteDependencies;
    const handlers = createMountainAutoHeroHandlers(dependencies);

    for (let index = 0; index < 2; index += 1) {
      const res = mockResponse();
      await handlers.requestHero(mockRequest(), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({
        status: "generating",
        jobId: "11b2c3d4-e5f6-4789-a012-3456789abcde",
      });
    }
    expect(requestMountainAutoHero).toHaveBeenCalledTimes(2);
    expect(requestMountainAutoHero).toHaveBeenCalledWith(
      mountain.id,
      "clerk-user",
      "192.0.2.10",
    );
  });

  it("serves the hero-status status shape after authenticating", async () => {
    const getMountainAutoHeroStatus = vi.fn(async () => ({
      status: "ready" as const,
      imageUrl: "/api/artwork/mountains/example/generated/job",
    }));
    const dependencies = {
      authenticatedUserId: () => "clerk-user",
      isMountainHeroRequestId: () => true,
      requestMountainAutoHero: vi.fn(),
      getMountainAutoHeroStatus,
    } as unknown as MountainAutoHeroRouteDependencies;
    const handlers = createMountainAutoHeroHandlers(dependencies);
    const res = mockResponse();

    await handlers.heroStatus(mockRequest(), res, vi.fn());

    expect(res.json).toHaveBeenCalledWith({
      status: "ready",
      imageUrl: "/api/artwork/mountains/example/generated/job",
    });
  });

  it("returns Retry-After for transient capacity, daily quota, and cooldown errors", async () => {
    for (const [statusCode, retryAfterSeconds] of [[503, 60], [429, 3600], [429, 900]] as const) {
      const dependencies = {
        authenticatedUserId: () => "clerk-user",
        isMountainHeroRequestId: () => true,
        requestMountainAutoHero: vi.fn(async () => {
          throw new MountainHeroRequestError("Please retry later", statusCode, retryAfterSeconds);
        }),
        getMountainAutoHeroStatus: vi.fn(),
      } as unknown as MountainAutoHeroRouteDependencies;
      const handlers = createMountainAutoHeroHandlers(dependencies);
      const res = mockResponse();

      await handlers.requestHero(mockRequest(), res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(statusCode);
      expect(res.setHeader).toHaveBeenCalledWith("Retry-After", String(retryAfterSeconds));
    }
  });
});