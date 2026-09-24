import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));

import {
  isCanonicalRouteHandoffFresh,
  isReusableCanonicalGeometry,
} from "./canonicalRouteHandoff";

const geometry = {
  geometryVersion: "7",
  coordinateReferenceSystem: "EPSG:4326",
  coordinates: [[-3.9, 53.1], [-3.8, 53.2]],
  direction: "forward",
  derivationMethod: "sde",
  sourceMembers: [{ rightsClassification: "reusable_geometry" }],
  topologyStatus: "complete",
};

describe("canonical route handoff local validation", () => {
  it("accepts complete reusable EPSG:4326 geometry from the published API DTO", () => {
    expect(isReusableCanonicalGeometry(geometry)).toBe(true);
  });

  it("rejects missing, malformed, incomplete, or non-reusable geometry", () => {
    expect(isReusableCanonicalGeometry(null)).toBe(false);
    expect(isReusableCanonicalGeometry({ ...geometry, coordinates: [[-3.9, 53.1]] })).toBe(false);
    expect(isReusableCanonicalGeometry({
      ...geometry, coordinates: [[181, 53], [-3.8, 53.2]],
    })).toBe(false);
    expect(isReusableCanonicalGeometry({
      ...geometry, coordinateReferenceSystem: "EPSG:3857",
    })).toBe(false);
    expect(isReusableCanonicalGeometry({
      ...geometry, sourceMembers: [{ rightsClassification: "unclear" }],
    })).toBe(false);
    expect(isReusableCanonicalGeometry({
      ...geometry, topologyStatus: "incomplete",
    })).toBe(false);
  });

  it("rejects stale and future-dated handoffs", () => {
    const now = 1_000_000;
    expect(isCanonicalRouteHandoffFresh(now, now)).toBe(true);
    expect(isCanonicalRouteHandoffFresh(now - 25 * 60 * 60 * 1000, now)).toBe(false);
    expect(isCanonicalRouteHandoffFresh(now + 1, now)).toBe(false);
    expect(isCanonicalRouteHandoffFresh("yesterday", now)).toBe(false);
  });
});