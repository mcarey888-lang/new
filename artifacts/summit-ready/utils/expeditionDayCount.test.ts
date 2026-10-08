import { describe, expect, it } from "vitest";
import { parseExpeditionDayCount } from "./expeditionDayCount";

describe("walking-day counts", () => {
  it("accepts walking stages beyond three days, including weeks and months", () => {
    for (const days of [1, 3, 7, 30, 90, 365]) expect(parseExpeditionDayCount(String(days))).toBe(days);
  });
  it("rejects empty, fractional, negative and unsafe values", () => {
    for (const input of ["", "0", "-1", "2.5", "abc", "Infinity", "9007199254740992"]) expect(parseExpeditionDayCount(input)).toBeNull();
  });
});
