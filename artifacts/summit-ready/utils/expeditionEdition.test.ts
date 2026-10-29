import { describe, expect, it } from "vitest";
import { expeditionEdition, EXPEDITION_EDITION_LABELS } from "./expeditionEdition";

describe("stable expedition edition labels", () => {
  it("marks all summit-stage catalogue revisions, including later revisions", () => {
    for (const id of ["SIG024-SUMMITS-1", "SIG004-SUMMITS-1", "SIG014-SUMMITS-1", "SIG060-SUMMITS-2"]) {
      expect(expeditionEdition(id)).toBe("summit");
    }
    expect(EXPEDITION_EDITION_LABELS.summit).toBe("New · Summit stages");
  });
  it("distinguishes original sources without renaming saved plans", () => {
    expect(expeditionEdition("SIG024")).toBe("original");
    expect(expeditionEdition("EXP_483A3ED557774E939B1C045EEDE4CACD")).toBe("original");
    expect(EXPEDITION_EDITION_LABELS.original).toBe("Original");
  });
  it("does not guess the edition of custom plans or unknown IDs", () => {
    for (const id of [undefined, null, "", "custom-123", "EXP_123", "MY-SUMMITS-1", "SIG024-SUMMITS-1-extra"]) {
      expect(expeditionEdition(id)).toBeNull();
    }
  });
});
