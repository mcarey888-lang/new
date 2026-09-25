import { describe, expect, it, vi } from "vitest";
import {
  canonicalMountainImageUrl, fetchMountainHeroStatus, generatedMountainHeroUrl, MountainHeroRequestError,
} from "./mountainHero";

const mountainId = "c72f54a6-7022-4569-8573-0cb476b24a50";
const jobId = "a450cfd4-e345-4981-839b-1d77d0e469aa";
const path = `/api/artwork/mountains/${mountainId}/generated/${jobId}`;

describe("mountain hero requests", () => {
  it("uses only the server's immutable generated image path", () => {
    expect(generatedMountainHeroUrl(path, "https://example.test/api", mountainId)).toBe(`https://example.test${path}`);
    expect(generatedMountainHeroUrl(path, "/api", mountainId)).toBe(path);
    expect(generatedMountainHeroUrl(path, "/api", "bd2e9c47-73bd-4ac4-aa41-813fc9bb0c61")).toBeNull();
    expect(generatedMountainHeroUrl("https://elsewhere.test/photo.jpg", "/api", mountainId)).toBeNull();
    expect(generatedMountainHeroUrl("/api/artwork/mountains/other/generated/unsafe", "/api", mountainId)).toBeNull();
    expect(canonicalMountainImageUrl("/api", mountainId, "Ben Nevis", "Scotland", "approved"))
      .toContain(`mountainId=${mountainId}&name=Ben+Nevis&location=Scotland&width=960&height=620&revision=approved`);
  });

  it("requires a token and requests only the selected mountain", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ status: "generating", jobId }),
    } as Response);
    try {
      await expect(fetchMountainHeroStatus(mountainId, "/api", async () => null, true))
        .rejects.toThrow("Sign in");
      expect(fetchMock).not.toHaveBeenCalled();
      await expect(fetchMountainHeroStatus(mountainId, "/api", async () => "test-token", true))
        .resolves.toEqual({ status: "generating", jobId });
      expect(fetchMock).toHaveBeenCalledWith(`/api/artwork/mountains/${mountainId}/request-hero`, {
        method: "POST", headers: { Authorization: "Bearer test-token" },
      });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("reports a temporary capacity error with a retry delay", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
      headers: { get: () => "12" },
      json: async () => ({ error: "Generation is busy" }),
    } as unknown as Response);
    try {
      await expect(fetchMountainHeroStatus(mountainId, "/api", async () => "test-token", true))
        .rejects.toMatchObject<Partial<MountainHeroRequestError>>({
          status: 503, retryAfterMs: 12_000,
        });
    } finally {
      fetchMock.mockRestore();
    }
  });
});