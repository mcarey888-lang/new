import { describe, expect, it } from "vitest";
import express from "express";
import cors from "cors";

/**
 * Drawing a route failed with every section straight and no reason given. The
 * snap requests were coming back 500 with a 1.9 kB HTML stack trace, from a
 * browser pointed at a Replit development URL carrying an explicit port.
 *
 * REPLIT_DOMAINS supplies a bare hostname, so the allow-list held
 * "https://host" while the browser sent "https://host:8080". The exact-match
 * lookup missed and the request was refused.
 *
 * The page itself loaded throughout, because a document GET sends no Origin
 * header at all. Only the fetch calls carried one. So the map looked perfectly
 * healthy while everything it asked for was being turned away.
 */

const DOMAIN = "c845fd48-4223-49a2-a54f-cbec8cb8f5c3-00-32e0r8ryvemws.spock.replit.dev";
const allowedOrigins = new Set([`https://${DOMAIN}`, "https://summitready.uk"]);

/* The policy as app.ts now implements it. */
function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins.has(origin)) return true;
  let host: string;
  let protocol: string;
  try {
    const url = new URL(origin);
    host = url.hostname;
    protocol = url.protocol;
  } catch {
    return false;
  }
  for (const allowed of allowedOrigins) {
    try {
      const a = new URL(allowed);
      if (a.hostname === host && a.protocol === protocol) return true;
    } catch { /* ignore */ }
  }
  return false;
}

async function ask(origin: string | null): Promise<{ status: number; body: string }> {
  const app = express();
  app.use(cors({
    origin: (o, cb) => {
      if (!o || isAllowedOrigin(o)) cb(null, true);
      else cb(new Error(`CORS: origin not allowed — ${o}`));
    },
    credentials: true,
  }));
  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof Error && err.message.startsWith("CORS: ")) {
      res.status(403).json({ error: "origin_not_allowed" });
      return;
    }
    next(err);
  });
  app.use(express.json());
  app.post("/api/path-snap", (_req, res) => { res.json({ outcome: "no_paths" }); });

  const server = app.listen(0);
  try {
    const port = (server.address() as { port: number }).port;
    const res = await fetch(`http://127.0.0.1:${port}/api/path-snap`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
      body: JSON.stringify({ to: { lat: 53.1, lng: -4 } }),
    });
    return { status: res.status, body: await res.text() };
  } finally {
    server.close();
  }
}

describe("the origin a development URL actually sends", () => {
  it("accepts our own host on an explicit port", async () => {
    const res = await ask(`https://${DOMAIN}:8080`);
    expect(res.status).toBe(200);
    expect(res.body).toContain("outcome");
  }, 20000);

  it("still accepts it without a port", async () => {
    expect((await ask(`https://${DOMAIN}`)).status).toBe(200);
  }, 20000);

  it("still accepts a request that sends no origin, as a page load does", async () => {
    expect((await ask(null)).status).toBe(200);
  }, 20000);
});

describe("an origin we do not know", () => {
  it("is still refused", async () => {
    const res = await ask("https://not-us.example.com");
    expect(res.status).toBe(403);
  }, 20000);

  it("is refused on a port too — the port is forgiven, the host is not", async () => {
    expect((await ask("https://not-us.example.com:8080")).status).toBe(403);
  }, 20000);

  it("is refused over the wrong scheme on a host we do allow", async () => {
    /* Forgiving the port must not quietly forgive http for an https host. */
    expect((await ask(`http://${DOMAIN}:8080`)).status).toBe(403);
  }, 20000);

  it("is refused when the origin is not a URL at all", async () => {
    expect((await ask("null")).status).toBe(403);
  }, 20000);

  it("does not pass a lookalike host", async () => {
    expect((await ask(`https://${DOMAIN}.evil.com`)).status).toBe(403);
  }, 20000);
});

describe("how a refusal reads", () => {
  it("says it is a refusal, not a server fault", async () => {
    /* The 500 with a stack trace is what sent a whole afternoon looking for a
       bug in the snapping engine, which was working the entire time. */
    const res = await ask("https://not-us.example.com");
    expect(res.status).toBe(403);
    expect(res.status).not.toBe(500);
    expect(res.body).toContain("origin_not_allowed");
    expect(res.body).not.toContain("<!DOCTYPE html>");
    expect(res.body.length).toBeLessThan(200);
  }, 20000);
});
