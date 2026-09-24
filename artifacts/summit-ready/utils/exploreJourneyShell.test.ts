/**
 * Source-shape guards for the Explore journey rebuild.
 *
 * These assert the things a rendering test cannot: that the superseded
 * presentation is gone, that the screens read production data rather than
 * inventing it, and — most importantly — that the navigation safety gate is
 * still a single predicate with an action-level guard behind it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("Explore", () => {
  const body = code(read("app/(tabs)/explore.tsx"));

  it("opens the one Mountain Detail decision surface, not the old trail route", () => {
    expect(body).toMatch(/pathname: "\/mountain"/);
    expect(body).not.toMatch(/trail-detail/);
  });

  it("no longer carries the superseded presentation", () => {
    expect(body).not.toMatch(/FallbackImage|s\.featuredBadge|MOUNTAIN IMAGE UNAVAILABLE/);
    expect(body).not.toMatch(/Popular This Month/);
  });

  it("composes from the shared system rather than re-typing it", () => {
    expect(body).toMatch(/from "@\/components\/ui"/);
    expect(body).toMatch(/SRSectionHeader/);
    expect(body).toMatch(/BASECAMP|EXPLORE/);
  });

  it("keeps the shared mode toggle rather than a screen-local copy", () => {
    expect(body).toMatch(/ModeTogglePill/);
  });

  it("invents no popularity, rating or engagement figure", () => {
    /* `TrendingUp` is an icon, not a metric — the words below are counts. */
    expect(body).not.toMatch(/\blikes\b|\bfollowers\b|\breviews\b|ratingCount|reviewCount|viewCount/i);
  });
});

describe("Mountain Detail", () => {
  const body = code(read("app/mountain.tsx"));

  it("resolves the mountain through the canonical lookup", () => {
    expect(body).toMatch(/\/mountain-lookup/);
    expect(body).toMatch(/presentMountain/);
    expect(body).toMatch(/presentRoutes/);
  });

  it("reads the engine's record for the selected route", () => {
    expect(body).toMatch(/fetchCanonicalRouteRecord/);
    expect(body).toMatch(/selectCanonicalRoute/);
    expect(body).toMatch(/mapExploreRoute/);
  });

  it("selects a route in place instead of navigating to a route screen", () => {
    expect(body).toMatch(/setSelectedKey/);
    expect(body).toMatch(/SelectedRoute/);
    /* the only router.push targets are Track, the goal setup and back */
    const pushes = body.match(/pathname: "\/[a-z-]+"/g) ?? [];
    expect(pushes.every(p => /hike-tracking/.test(p))).toBe(true);
    expect(body).not.toMatch(/route-detail/);
  });

  it("guards Start Route at the action, not by hiding a button", () => {
    expect(body).toMatch(/startRouteHandoff\(/);
    expect(body).toMatch(/if \(!handoff \|\| !geometry\) return;/);
    expect(body).toMatch(/if \(!userId\)/);
    expect(body).toMatch(/saveCanonicalRouteHandoff/);
  });

  it("hands Track the canonical identity, never a display name", () => {
    expect(body).toMatch(/canonicalRouteId: handoff\.routeId/);
    expect(body).toMatch(/canonicalRouteIdentityKey: handoff\.routeIdentityKey/);
    expect(body).toMatch(/canonicalRouteVersion: handoff\.routeVersion/);
    expect(body).toMatch(/canonicalMountainId: handoff\.mountainId/);
    expect(body).not.toMatch(/referenceRouteId: handoff\.routeId/);
  });

  it("stores geometry locally and never serializes route coordinates into navigation params", () => {
    const route = body.slice(body.indexOf("async function startRoute"));
    expect(route).toMatch(/geometry,/);
    expect(route).toMatch(/saveCanonicalRouteHandoff/);
    expect(route).not.toMatch(/coordinates:/);
    expect(route).not.toMatch(/JSON\.stringify\(geometry/);
  });

  it("copies optional start information only from the exact canonical record", () => {
    const route = body.slice(body.indexOf("async function startRoute"));
    expect(route).toMatch(/record\.route\.version\.routeId !== handoff\.routeId/);
    expect(route).toMatch(/record\.route\.version\.identityKey !== handoff\.routeIdentityKey/);
    expect(route).toMatch(/record\.mountain\.id !== handoff\.mountainId/);
    expect(route).toMatch(/record\.definition\?\.startLabel/);
    expect(route).toMatch(/record\.facts\?\.startElevationM/);
    expect(route).not.toMatch(/presented\.route\.startName/);
  });

  it("does not offer a capability this build lacks", () => {
    expect(body).not.toMatch(/View in 3D|view3d|View3D/i);
  });
});

describe("the canonical read fires from every entry point", () => {
  it("hills-finder passes the summit identity the canonical read requires", () => {
    const body = code(read("app/hills-finder.tsx"));
    expect(body).toMatch(/summitIdentityKey: hill\.summitIdentityKey/);
  });

  it("hill-detail still requires both identities before asking the engine", () => {
    const body = code(read("app/hill-detail.tsx"));
    expect(body).toMatch(/routeIdentityKey\?\.startsWith\("sde:route:"\)/);
    expect(body).toMatch(/summitIdentityKey\?\.startsWith\("sde:mountain:"\)/);
  });
});

describe("trail-detail survives — it still has callers", () => {
  it("is still reachable from the trail lists", () => {
    for (const rel of ["app/trail-list.tsx", "app/trails-saved.tsx", "app/trails-completed.tsx"]) {
      expect(read(rel)).toMatch(/trail-detail/);
    }
  });
});
