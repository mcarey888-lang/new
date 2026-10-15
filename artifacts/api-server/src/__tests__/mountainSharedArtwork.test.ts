import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  resolve: vi.fn(),
  byId: vi.fn(),
}));
vi.mock("@workspace/db", async (original) => ({
  ...await original<typeof import("@workspace/db")>(),
  pool: { query: mocks.query },
}));
vi.mock("../services/mountain/canonicalMountainIdentity.js", () => ({
  resolveCanonicalMountainIdentity: mocks.resolve,
  getCanonicalMountainById: mocks.byId,
}));

import { getImageData } from "../routes/mountain-image.js";
import { MOUNTAIN_PLACEHOLDER_SVG } from "../services/artwork/mountainPlaceholder.js";

const id = "01b2c3d4-e5f6-4789-a012-3456789abcde";
const job = "11b2c3d4-e5f6-4789-a012-3456789abcde";
const generated = `/api/artwork/mountains/${id}/generated/${job}`;
const mountain = { id, name: "Obscure Hill", country: "Scotland", region: "Test Area" };
let records: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  records = {};
  mocks.resolve.mockResolvedValue(mountain);
  mocks.byId.mockResolvedValue(mountain);
  mocks.query.mockImplementation(async (_sql: string, params: string[]) => ({
    rows: records[params[0]!] ? [{ data: JSON.stringify(records[params[0]!]) }] : [],
  }));
});

describe("shared catalogue artwork", () => {
  it("uses an illustrative placeholder rather than photos or satellite for an untouched hill", async () => {
    expect(await getImageData({ name: mountain.name, mountainId: id })).toMatchObject({
      thumbUrl: null, placeholder: true, mutableHero: true,
    });
    // Only shared artwork metadata is read; no cached photo or paid job is requested.
    expect(mocks.query.mock.calls.every(([sql]) =>
      sql.startsWith("SELECT data FROM public.cached_mountains"))).toBe(true);
    expect(mocks.query.mock.calls.some(([, args]) => args[0].startsWith("hero-image:"))).toBe(false);
  });

  it("preserves explicitly approved artwork ahead of automatic artwork", async () => {
    const approved = `/api/artwork/mountains/${id}/generated/21b2c3d4-e5f6-4789-a012-3456789abcde`;
    records[`hero-approved:v1:id:${id}`] = { mountainId: id, imageUrl: approved };
    records[`hero-auto:v1:${id}`] = { status: "ready", candidate: { imageUrl: generated } };
    expect((await getImageData({ name: mountain.name, mountainId: id })).thumbUrl).toBe(approved);
    expect(mocks.query.mock.calls.some(([, args]) => args[0] === `hero-auto:v1:${id}`)).toBe(false);
  });

  it("sees a newly completed image on the very next read without cached placeholder stickiness", async () => {
    expect((await getImageData({ name: mountain.name, mountainId: id })).placeholder).toBe(true);
    records[`hero-auto:v1:${id}`] = { status: "ready", candidate: { imageUrl: generated } };
    expect(await getImageData({ name: mountain.name, mountainId: id })).toMatchObject({
      thumbUrl: generated, placeholder: false, mutableHero: true,
    });
  });

  it("does not display artwork belonging to another mountain", async () => {
    records[`hero-auto:v1:${id}`] = {
      status: "ready",
      candidate: { imageUrl: generated.replace(id, "31b2c3d4-e5f6-4789-a012-3456789abcde") },
    };
    expect((await getImageData({ name: mountain.name, mountainId: id })).placeholder).toBe(true);
  });

  it("does not substitute a name-only photo when explicit catalogue identity is unavailable", async () => {
    mocks.resolve.mockResolvedValue(null);
    mocks.byId.mockResolvedValue(null);
    expect((await getImageData({ name: mountain.name, mountainId: id })).placeholder).toBe(true);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("uses the canonical ID even when the displayed locality differs from the engine region", async () => {
    records[`hero-auto:v1:${id}`] = { status: "ready", candidate: { imageUrl: generated } };
    expect((await getImageData({
      name: mountain.name, mountainId: id, location: "A more specific valley",
    })).thumbUrl).toBe(generated);
    expect(mocks.byId).toHaveBeenCalledWith(id);
    expect(mocks.resolve).not.toHaveBeenCalled();
  });

  it("renders the single replaceable trig-point placeholder as an actual image", async () => {
    const png = await sharp(Buffer.from(MOUNTAIN_PLACEHOLDER_SVG)).resize(220, 200).png().toBuffer();
    expect(await sharp(png).metadata()).toMatchObject({ format: "png", width: 220, height: 200 });
  });
});
