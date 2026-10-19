import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { activityDiscoveryQuery, communityDiscoveryFilters } from "../services/activityCommunityDiscovery";

const dialect = new PgDialect();
const render = (input: unknown) =>
  dialect.sqlToQuery(communityDiscoveryFilters(activityDiscoveryQuery.parse(input)));

describe("community route discovery filters", () => {
  it("accepts raw and recorder-prefixed IDs as the same exact mountain", () => {
    expect(render({ mountainId: "ABC-123" })).toEqual(render({ mountainId: "sde:mountain:ABC-123" }));
    expect(render({ mountainId: " SDE:MOUNTAIN:ABC-123 " }).params).toEqual(["%%", "abc-123"]);
  });
  it("filters the saved canonical identity, never a similar name or nearby position", () => {
    const query = render({ mountainId: "abc-123" });
    expect(query.sql).toContain("canonicalMountainId");
    expect(query.sql).toContain("regexp_replace");
    expect(query.sql).toMatch(/= \$2/);
    expect(query.sql).not.toContain("trackPoints");
    expect(query.params).toEqual(["%%", "abc-123"]);
  });
  it("leaves general discovery unfiltered by mountain, and excludes deleted backups", () => {
    const query = render({});
    expect(query.sql).not.toContain("canonicalMountainId");
    expect(query.sql).toContain("b.deleted_at IS NULL");
  });
  it("uses parameterised, literal case-insensitive name search", () => {
    const query = render({ q: "  Tryfan  " });
    expect(query.sql).toContain("ILIKE $1");
    expect(query.sql).not.toContain("Tryfan");
    expect(query.params).toEqual(["%Tryfan%"]);
    expect(render({ q: "100% _ \\ ascent" }).params).toEqual(["%100\\% \\_ \\\\ ascent%"]);
    expect(render({ q: "' OR true --" }).sql).not.toContain("OR true");
  });
  it.each(["", "sde:mountain:", "abc%' OR true", "a".repeat(257)])("rejects malformed mountain ID %s", mountainId => {
    expect(activityDiscoveryQuery.safeParse({ mountainId }).success).toBe(false);
  });
  it("retains bounded pagination, location and search validation", () => {
    for (const input of [{ page: -1 }, { page: 1001 }, { q: "a".repeat(121) }, { lat: 91 }, { radiusKm: 101 }]) {
      expect(activityDiscoveryQuery.safeParse(input).success).toBe(false);
    }
  });
});
