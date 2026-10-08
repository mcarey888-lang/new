import { describe, expect, it } from "vitest";
import { authMode } from "../middlewares/requireAuth";

/**
 * Which way this fails is the whole point.
 *
 * The rule it replaces enforced only for a key starting with `sk_live_`, and
 * waved everything else through. A production box with the key missing or
 * mid-rotation would have stopped checking anybody, silently.
 */
describe("choosing how to treat a request", () => {
  it("enforces with a live key", () => {
    expect(authMode({ CLERK_SECRET_KEY: "sk_live_abc", NODE_ENV: "production" })).toBe("enforce");
  });

  it("enforces with a test key too", () => {
    /* A preview build signs in with a test key and sends real sessions. The
       old rule treated those requests as needing no check at all. */
    expect(authMode({ CLERK_SECRET_KEY: "sk_test_abc", NODE_ENV: "production" })).toBe("enforce");
    expect(authMode({ CLERK_SECRET_KEY: "sk_test_abc", NODE_ENV: "development" })).toBe("enforce");
  });

  it("refuses in production when the key is missing", () => {
    for (const key of [undefined, "", "   "]) {
      expect(authMode({ CLERK_SECRET_KEY: key, NODE_ENV: "production" })).toBe("refuse");
    }
  });

  it("never waves anything through in production", () => {
    /* The single most important line here. */
    for (const key of [undefined, "", "sk_live_x", "sk_test_x", "whatever"]) {
      expect(authMode({ CLERK_SECRET_KEY: key, NODE_ENV: "production" }))
        .not.toBe("allow_unauthenticated");
    }
  });

  it("stays out of the way locally and under test", () => {
    expect(authMode({ NODE_ENV: "development" })).toBe("allow_unauthenticated");
    expect(authMode({ NODE_ENV: "test" })).toBe("allow_unauthenticated");
    expect(authMode({})).toBe("allow_unauthenticated");
  });
});
