import { describe, expect, it, vi } from "vitest";
import {
  getCanonicalMountainById,
  resolveCanonicalMountainIdentity,
  type CanonicalMountainIdentity,
} from "../services/mountain/canonicalMountainIdentity.js";

const first: CanonicalMountainIdentity = {
  id: "01b2c3d4-e5f6-4789-a012-3456789abcde",
  canonicalSourceKey: "provider:first",
  name: "Twin Peak",
  country: "Northland",
  region: "North Range",
  area: null,
  elevationM: 2100,
  prominenceM: 500,
};
const second: CanonicalMountainIdentity = {
  ...first,
  id: "11b2c3d4-e5f6-4789-a012-3456789abcde",
  canonicalSourceKey: "provider:second",
  country: "Southland",
  region: "South Range",
};

function queryReturning(rows: CanonicalMountainIdentity[]) {
  return vi.fn(async (_sql: string, _params: unknown[]) => rows);
}

describe("canonical mountain identity engine lookup", () => {
  it("uses the read-only catalogue query and requires a stable canonical row", async () => {
    const query = queryReturning([first]);
    const mountain = await getCanonicalMountainById(first.id, query as never);
    expect(mountain).toEqual(first);
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0]![0]).toContain("FROM public.mountains AS m");
    expect(query.mock.calls[0]![0]).toContain("canonical_source_key");
    expect(query.mock.calls[0]![0]).toContain("m.status = 'verified'");
    expect(query.mock.calls[0]![0]).toContain("Database of British and Irish Hills (DoBIH)");
    expect(query.mock.calls[0]![0]).toContain("msr.qa_status IN ('pass', 'info')");
    expect(query.mock.calls[0]![1]).toEqual([first.id]);
  });

  it("refuses ambiguous name-only identities but resolves an exact unique location", async () => {
    const ambiguousQuery = queryReturning([first, second]);
    await expect(resolveCanonicalMountainIdentity("Twin Peak", undefined, undefined, ambiguousQuery as never))
      .resolves.toBeNull();

    const locatedQuery = queryReturning([first, second]);
    await expect(resolveCanonicalMountainIdentity("Twin Peak", "South Range, Southland", undefined, locatedQuery as never))
      .resolves.toEqual(second);
  });

  it("requires a supplied UUID to match the canonical row name", async () => {
    const query = queryReturning([first]);
    await expect(resolveCanonicalMountainIdentity("Twin Peak", undefined, first.id, query as never))
      .resolves.toEqual(first);
    await expect(resolveCanonicalMountainIdentity("Other Peak", undefined, first.id, query as never))
      .resolves.toBeNull();
  });
});