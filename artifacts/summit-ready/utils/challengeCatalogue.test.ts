import { describe, expect, it } from "vitest";
import { STAGE_8_CHALLENGES } from "./challengeCatalogue";

describe("Stage 8 catalogue availability", () => {
  it("declares unsupported producers rather than implying fabricated progress", () => {
    for (const definition of STAGE_8_CHALLENGES) {
      expect(definition.availability?.status ?? "available").toBeDefined();
      if (definition.family !== "monthly_elevation") {
        expect(definition.availability?.status).toBe("unavailable");
        expect(definition.availability?.reason).toMatch(/authoritative/i);
      }
    }
  });
});