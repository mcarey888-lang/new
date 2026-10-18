import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUTH_CONNECTING_MESSAGE,
  AUTH_SLOW_MS,
  AUTH_UNREACHABLE_MESSAGE,
  authUnavailableMessage,
} from "./authAvailability";

describe("what sign-in says when the auth service is not ready", () => {
  it("calls a fresh wait a wait", () => {
    expect(authUnavailableMessage(0)).toBe(AUTH_CONNECTING_MESSAGE);
    expect(authUnavailableMessage(AUTH_SLOW_MS - 1)).toBe(AUTH_CONNECTING_MESSAGE);
  });

  it("stops calling it loading once it plainly is not", () => {
    expect(authUnavailableMessage(AUTH_SLOW_MS)).toBe(AUTH_UNREACHABLE_MESSAGE);
    expect(authUnavailableMessage(60_000)).toBe(AUTH_UNREACHABLE_MESSAGE);
  });

  it("treats a nonsense elapsed time as no time at all", () => {
    /* Calling a working connection broken is worse than being slow to say so. */
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY * 0, -1, -9_999]) {
      expect(authUnavailableMessage(bad)).toBe(AUTH_CONNECTING_MESSAGE);
    }
  });

  it("never promises that waiting alone will fix an unreachable service", () => {
    /* The old copy did exactly this, and with no signal it never came true. */
    expect(AUTH_UNREACHABLE_MESSAGE).not.toMatch(/wait|loading/i);
    expect(AUTH_UNREACHABLE_MESSAGE).toMatch(/connection/i);
  });

  it("tells somebody what to do in both cases", () => {
    for (const message of [AUTH_CONNECTING_MESSAGE, AUTH_UNREACHABLE_MESSAGE]) {
      expect(message).toMatch(/try again/i);
    }
  });

  it("says nothing about a service by name, which nobody outside the team knows", () => {
    for (const message of [AUTH_CONNECTING_MESSAGE, AUTH_UNREACHABLE_MESSAGE]) {
      expect(message).not.toMatch(/clerk|auth0|firebase|oauth/i);
    }
  });
});

/**
 * The screens themselves. Structural, in the style this repo already uses:
 * the value is in catching a later edit that quietly reinstates a sentence
 * nobody remembers was wrong.
 */
const SCREENS = [
  "app/(auth)/sign-in.tsx",
  "app/(auth)/sign-up.tsx",
  "app/(auth)/forgot-password.tsx",
];
const read = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8");

describe("the auth screens do not claim a dead connection is loading", () => {
  it("has no screen left saying the service is still loading", () => {
    for (const screen of SCREENS) {
      expect(read(screen), screen).not.toMatch(/still loading/i);
    }
  });

  it("chooses the message from how long the screen has been open", () => {
    /* Asserted per screen rather than once: a new auth screen that forgets
       the ref would otherwise inherit the suite's blessing. */
    for (const screen of SCREENS) {
      const body = read(screen);
      expect(body, screen).toMatch(/const openedAtRef = useRef\(Date\.now\(\)\)/);
      expect(body, screen)
        .toMatch(/authUnavailableMessage\(Date\.now\(\) - openedAtRef\.current\)/);
    }
  });

  it("leaves no screen writing this message by hand", () => {
    for (const screen of SCREENS) {
      const literals = read(screen).match(/setError\("[^"]*sign-in service[^"]*"\)/g) ?? [];
      expect(literals, screen).toHaveLength(0);
    }
  });
});
