import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const trackedRoutesSource = readFileSync(
  new URL("../routes/tracked-routes.ts", import.meta.url),
  "utf8",
);
const userRoutesSource = readFileSync(
  new URL("../routes/user.ts", import.meta.url),
  "utf8",
);

describe("protected write route declarations", () => {
  it("keeps tracked-route mutations behind Clerk authentication", () => {
    expect(trackedRoutesSource).toMatch(
      /router\.post\("\/tracked-routes",\s*requireAuth\(\)/,
    );
    expect(trackedRoutesSource).toMatch(
      /router\.post\("\/tracked-routes\/:id\/contribute",\s*requireAuth\(\)/,
    );
    expect(trackedRoutesSource).toMatch(
      /router\.delete\("\/tracked-routes\/:id",\s*requireAuth\(\)/,
    );
  });

  it("keeps account deletion behind Clerk authentication", () => {
    expect(userRoutesSource).toMatch(
      /router\.delete\("\/user\/me",\s*requireAuth\(\)/,
    );
  });
});