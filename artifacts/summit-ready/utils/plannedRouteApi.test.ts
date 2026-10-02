import { afterEach, describe, expect, it, vi } from "vitest";
import {
  describeRoute,
  deleteRoute,
  listRoutes,
  saveRoute,
  type SaveDraft,
} from "./plannedRouteApi";

const draft: SaveDraft = {
  name: "North Ridge",
  anchors: [{ lat: 53.1225, lng: -3.997 }, { lat: 53.115, lng: -3.9986 }],
  geometry: [{ lat: 53.1225, lng: -3.997 }, { lat: 53.115, lng: -3.9986 }],
  lengthM: 840,
  ascentM: 500,
  fullySnapped: true,
};

const token = async () => "clerk-token";
const noToken = async () => null;

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown) {
  const spy = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", spy);
  return spy;
}

describe("signing in", () => {
  it("does not send a route when nobody is signed in", async () => {
    /* Checked before the request rather than after a 401. A route is somebody's
       work, and losing it to a round trip that was never going to succeed is
       avoidable. */
    const spy = stubFetch(200, {});
    const r = await saveRoute(draft, noToken);
    expect(r).toEqual({ ok: false, reason: "Sign in to save routes", signedOut: true });
    expect(spy).not.toHaveBeenCalled();
  });

  it("sends the token when there is one", async () => {
    const spy = stubFetch(200, { route: { id: "r1" } });
    await saveRoute(draft, token);
    const init = spy.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer clerk-token");
  });

  it("marks a 401 as signed out, so the caller can act on it", async () => {
    stubFetch(401, {});
    const r = await saveRoute(draft, token);
    expect(r).toEqual({ ok: false, reason: "Sign in to save routes", signedOut: true });
  });

  it("survives the token lookup itself failing", async () => {
    stubFetch(200, {});
    const r = await saveRoute(draft, async () => { throw new Error("clerk down"); });
    expect(r.ok).toBe(false);
  });
});

describe("failures reach the person intact", () => {
  it("passes the server's own reason through", async () => {
    /* "a route needs a name" is something they can act on. "Save failed" is
       not. */
    stubFetch(400, { error: "a route needs a name" });
    const r = await saveRoute(draft, token);
    expect(r).toEqual({ ok: false, reason: "a route needs a name" });
  });

  it("says something useful when the server says nothing", async () => {
    stubFetch(500, null);
    const r = await saveRoute(draft, token);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.length).toBeGreaterThan(0);
  });

  it("returns a result rather than throwing when there is no connection", async () => {
    /* Saving happens on a hillside with one bar. A failure must be a message
       on screen, not a crash. */
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
    await expect(saveRoute(draft, token)).resolves.toEqual({ ok: false, reason: "No connection" });
    await expect(listRoutes(token)).resolves.toEqual({ ok: false, reason: "No connection" });
    await expect(deleteRoute("r1", token)).resolves.toEqual({ ok: false, reason: "No connection" });
  });
});

describe("reading what comes back", () => {
  it("returns the saved route", async () => {
    stubFetch(200, { route: { id: "r1", name: "North Ridge" } });
    const r = await saveRoute(draft, token);
    expect(r.ok && r.value.id).toBe("r1");
  });

  it("treats a missing list as empty rather than breaking", async () => {
    stubFetch(200, {});
    const r = await listRoutes(token);
    expect(r).toEqual({ ok: true, value: [] });
  });

  it("escapes an id going into the path", async () => {
    const spy = stubFetch(200, { deleted: "x" });
    await deleteRoute("a/b?c", token);
    expect(spy.mock.calls[0]![0]).toContain("a%2Fb%3Fc");
  });
});

describe("how a saved route is described", () => {
  it("shows distance and climb", () => {
    expect(describeRoute({ lengthM: 4210, ascentM: 519, fullySnapped: true }))
      .toBe("4.21 km · ↑519 m");
  });

  it("says nothing about climb when it is unknown", () => {
    /* Not a zero and not a dash. A row reading "4.21 km · 0 m" is read as a
       flat walk; "4.21 km" alone is honestly silent about the climb. */
    expect(describeRoute({ lengthM: 4210, ascentM: null, fullySnapped: true }))
      .toBe("4.21 km");
  });

  it("still shows a real zero", () => {
    expect(describeRoute({ lengthM: 4210, ascentM: 0, fullySnapped: true }))
      .toBe("4.21 km · ↑0 m");
  });

  it("flags a route that is not all on paths", () => {
    expect(describeRoute({ lengthM: 4210, ascentM: 519, fullySnapped: false }))
      .toBe("4.21 km · ↑519 m · not all on paths");
  });
});
