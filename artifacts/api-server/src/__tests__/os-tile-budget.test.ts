import { describe, expect, it } from "vitest";
import { OsTileBudget, OS_GLOBAL_TILES_PER_MINUTE, OS_IP_TILES_PER_MINUTE } from "../lib/os-tile-budget";

describe("OS paid-tile budgets", () => {
  it("allows a maximum-sized 4,000-tile route with browsing headroom in one minute", () => {
    const budget = new OsTileBudget();
    for (let n = 0; n < 4500; n++) expect(budget.take("one-phone", 10000)).toBe(0);
  });
  it("allows three maximum-sized route downloads simultaneously", () => {
    const budget = new OsTileBudget();
    for (let n = 0; n < 4000; n++) {
      for (const ip of ["phone-one", "phone-two", "phone-three"]) expect(budget.take(ip, 10000)).toBe(0);
    }
  });
  it("keeps the per-IP cap and reports actual remaining window time", () => {
    const budget = new OsTileBudget();
    for (let n = 0; n < OS_IP_TILES_PER_MINUTE; n++) budget.take("one", 10000);
    expect(budget.take("one", 55000)).toBe(15);
    expect(budget.take("two", 55000)).toBe(0);
    expect(budget.take("one", 70000)).toBe(0);
  });
  it("retains a global bound without charging rejected attempts to other users", () => {
    const budget = new OsTileBudget();
    for (let n = 0; n < OS_IP_TILES_PER_MINUTE; n++) budget.take("limited", 10000);
    for (let n = 0; n < 5000; n++) expect(budget.take("limited", 10000)).toBe(60);
    for (let n = OS_IP_TILES_PER_MINUTE; n < OS_GLOBAL_TILES_PER_MINUTE; n++) {
      expect(budget.take(`phone-${Math.floor(n / 4000)}`, 10000)).toBe(0);
    }
    expect(budget.take("other", 59000)).toBe(11);
    expect(budget.take("other", 70000)).toBe(0);
  });
  it("resets safely after the server clock goes backwards", () => {
    const budget = new OsTileBudget();
    for (let n = 0; n < OS_IP_TILES_PER_MINUTE; n++) budget.take("one", 10000);
    expect(budget.take("one", 9000)).toBe(0);
  });
});