import { describe, expect, it } from "vitest";
import { elevationQuality } from "./elevationQuality";

describe("recorded altitude coverage", () => {
  it("does not claim missing or rejected altitude is a confident zero", () => {
    expect(elevationQuality([{ alt: null, ts: 0 }, { alt: 300, ts: 3000, altAcc: 21 }]).status).toBe("unavailable");
  });
  it("surfaces sparse fixes independently of the filtered total", () => {
    expect(elevationQuality(Array.from({ length: 20 }, (_, i) => ({ alt: 200 + i, ts: i * 31_000, altAcc: 8 }))).status).toBe("partial");
  });
  it("reports unknown vertical accuracy as partial", () => {
    expect(elevationQuality([{ alt: 200, ts: 0 }, { alt: 201, ts: 3000 }]).status).toBe("partial");
  });
  it("can report trustworthy coverage on a stationary trace", () => {
    expect(elevationQuality(Array.from({ length: 20 }, (_, i) => ({ alt: 200, ts: i * 3000, altAcc: 3 }))).status).toBe("reliable");
  });
});
