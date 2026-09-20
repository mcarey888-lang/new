import express from "express";
import http from "node:http";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requireAdminKey } from "../middlewares/requireAdminKey.js";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

const artworkSource = readFileSync(
  new URL("../routes/artwork.ts", import.meta.url),
  "utf8",
);
const atlasSource = readFileSync(
  new URL("../routes/atlas.ts", import.meta.url),
  "utf8",
);
const artworkStorageSource = readFileSync(
  new URL("../services/artwork/artworkStorage.ts", import.meta.url),
  "utf8",
);

const protectedGroups: Array<{ name: string; method: Method; path: string }> = [
  { name: "artwork mutation", method: "POST", path: "/artwork" },
  { name: "artwork deletion", method: "DELETE", path: "/artwork" },
  { name: "Atlas mutation", method: "POST", path: "/atlas" },
  { name: "Atlas style-lock mutation", method: "PATCH", path: "/atlas" },
  { name: "Atlas deletion", method: "DELETE", path: "/atlas" },
  { name: "Atlas GitHub administration", method: "GET", path: "/atlas-github" },
];

function buildGuardApp(): express.Express {
  const app = express();
  for (const group of protectedGroups) {
    app[group.method.toLowerCase() as "get" | "post" | "patch" | "delete"](
      group.path,
      requireAdminKey,
      (_req, res) => res.status(204).end(),
    );
  }
  return app;
}

async function callEndpoint(
  app: express.Express,
  method: Method,
  path: string,
  key?: string,
  encoded = false,
): Promise<number> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address() as { port: number };
      const request = http.request(
        {
          hostname: "127.0.0.1",
          port: address.port,
          method,
          path,
          headers: key
            ? encoded
              ? { "x-vx-admin-key-b64": Buffer.from(key, "utf8").toString("base64") }
              : { "x-vx-admin-key": key }
            : {},
        },
        (response) => {
          response.resume();
          response.on("end", () => server.close(() => resolve(response.statusCode ?? 500)));
        },
      );
      request.on("error", () => server.close(() => resolve(500)));
      request.end();
    });
  });
}

describe("shared admin-key protection", () => {
  const app = buildGuardApp();

  beforeAll(() => {
    delete process.env.ADMIN_API_KEY;
    process.env.VIRTUAL_ENGINE_ADMIN_KEY = "test-admin-key";
  });

  afterAll(() => {
    delete process.env.ADMIN_API_KEY;
    delete process.env.VIRTUAL_ENGINE_ADMIN_KEY;
  });

  for (const group of protectedGroups) {
    it(`rejects unauthenticated ${group.name} requests`, async () => {
      expect(await callEndpoint(app, group.method, group.path)).toBe(401);
    });

    it(`allows authorised ${group.name} requests`, async () => {
      expect(await callEndpoint(app, group.method, group.path, "test-admin-key")).toBe(204);
    });
  }

  it("fails closed when the server key is not configured", async () => {
    delete process.env.ADMIN_API_KEY;
    delete process.env.VIRTUAL_ENGINE_ADMIN_KEY;
    expect(await callEndpoint(app, "POST", "/artwork", "test-admin-key")).toBe(503);
    process.env.VIRTUAL_ENGINE_ADMIN_KEY = "test-admin-key";
  });

  it("uses the shared ADMIN_API_KEY when the legacy key is absent", async () => {
    delete process.env.VIRTUAL_ENGINE_ADMIN_KEY;
    process.env.ADMIN_API_KEY = "shared-admin-key";
    expect(await callEndpoint(app, "POST", "/artwork")).toBe(401);
    expect(await callEndpoint(app, "POST", "/artwork", "shared-admin-key")).toBe(204);
    delete process.env.ADMIN_API_KEY;
    process.env.VIRTUAL_ENGINE_ADMIN_KEY = "test-admin-key";
  });

  it("accepts a UTF-8 admin key through the encoded header", async () => {
    delete process.env.VIRTUAL_ENGINE_ADMIN_KEY;
    process.env.ADMIN_API_KEY = "shared—admin—key";
    expect(await callEndpoint(app, "POST", "/artwork", "shared—admin—key", true)).toBe(204);
    delete process.env.ADMIN_API_KEY;
    process.env.VIRTUAL_ENGINE_ADMIN_KEY = "test-admin-key";
  });
});

describe("privileged route declarations", () => {
  it("guards every Artwork mutation", () => {
    const declarations = artworkSource.match(/artworkRouter\.(?:post|patch|put|delete)\([^;]+?=> \{/gs) ?? [];
    expect(declarations).toHaveLength(11);
    for (const declaration of declarations) {
      expect(declaration).toContain("requireAdminKey");
    }
  });

  it("keeps review-batch routes development-only and reason-gated", () => {
    expect(artworkSource).toContain('if (process.env.NODE_ENV !== "development")');
    const batchMutation = artworkSource.match(
      /artworkRouter\.post\("\/batches\/:batchId\/generate"[\s\S]*?\n\}\);/,
    )?.[0];
    expect(batchMutation).toContain("requireDevelopment");
    expect(batchMutation).toContain("requireAdminKey");
    expect(batchMutation).toContain("objectiveFailureReason");
    expect(batchMutation).toContain("isObjectiveFailureReason");
  });

  it("uses create-only review objects and an owned expiring generation lease", () => {
    expect(artworkStorageSource).toContain("preconditionOpts: { ifGenerationMatch: 0 }");
    expect(artworkStorageSource).toContain("GENERATION_LOCK_LEASE_MS");
    expect(artworkStorageSource).toContain("existing.owner !== owner");
    expect(artworkStorageSource).toContain("ifGenerationMatch: generation");
  });

  it("guards every Atlas mutation", () => {
    const declarations = atlasSource.match(/atlasRouter\.(?:post|patch|put|delete)\([^;]+?=> \{/gs) ?? [];
    expect(declarations).toHaveLength(11);
    for (const declaration of declarations) {
      expect(declaration).toContain("requireAdminKey");
    }
  });

  it("guards Atlas GitHub status and queue reads", () => {
    expect(atlasSource).toMatch(/get\("\/github\/status", requireAdminKey,/);
    expect(atlasSource).toMatch(/get\("\/github\/queue", requireAdminKey,/);
  });
});