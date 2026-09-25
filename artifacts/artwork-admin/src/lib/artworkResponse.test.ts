import { describe, expect, it } from "vitest";
import { readArtworkJson } from "./artworkResponse";

describe("artwork API responses", () => {
  it("accepts a valid generation status", async () => {
    const response = new Response(JSON.stringify({ status: "ready" }), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
    await expect(readArtworkJson<{ status: string }>(response)).resolves.toEqual({ status: "ready" });
  });

  it("explains redirected HTML rather than exposing a JSON parse error", async () => {
    const response = new Response("<!DOCTYPE html><html></html>", {
      headers: { "content-type": "text/html" },
    });
    await expect(readArtworkJson(response)).rejects.toThrow("returned a webpage instead of data");
  });

  it("preserves the API's authorization error", async () => {
    const response = new Response(JSON.stringify({ error: "Valid admin key required" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
    await expect(readArtworkJson(response)).rejects.toThrow("Valid admin key required");
  });
});