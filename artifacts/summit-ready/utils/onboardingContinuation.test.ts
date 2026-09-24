import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumePendingOnboardingIntent,
  continueFromOnboarding,
  restorePendingAfterActiveHike,
  restorePendingOnboardingIntent,
  shouldResetLandingRedirectForUser,
  shouldStartSignedInLandingRedirect,
  ONBOARDING_INTENT_TTL_MS,
  ONBOARDING_PENDING_INTENT_KEY,
  type OnboardingStorage,
} from "./onboardingContinuation";

const NOW = 1_700_000_000_000;

function makeStorage(): OnboardingStorage {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn(async key => values.get(key) ?? null),
    setItem: vi.fn(async (key, value) => { values.set(key, value); }),
    removeItem: vi.fn(async key => { values.delete(key); }),
  };
}

describe("onboarding auth continuation", () => {
  let storage: OnboardingStorage;
  let setShellMode: ReturnType<typeof vi.fn>;
  let navigateToAuth: ReturnType<typeof vi.fn>;
  let navigateToDestination: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = makeStorage();
    setShellMode = vi.fn(async () => {});
    navigateToAuth = vi.fn();
    navigateToDestination = vi.fn();
  });

  for (const action of ["finish", "skip"] as const) {
    it(`signed-out ${action} saves only intent and expiry, then opens sign-up`, async () => {
      const startedAt = Date.now();
      await continueFromOnboarding(action, false, "expedition", {
        storage, setShellMode, navigateToAuth, navigateToDestination,
      });

      expect(storage.setItem).toHaveBeenCalledTimes(1);
      const [key, raw] = vi.mocked(storage.setItem).mock.calls[0];
      expect(key).toBe(ONBOARDING_PENDING_INTENT_KEY);
      const payload = JSON.parse(raw);
      expect(Object.keys(payload).sort()).toEqual(["expiresAt", "intentId"]);
      expect(payload.intentId).toBe("expedition");
      expect(payload.expiresAt).toBeGreaterThanOrEqual(startedAt + ONBOARDING_INTENT_TTL_MS);
      expect(payload.expiresAt).toBeLessThanOrEqual(Date.now() + ONBOARDING_INTENT_TTL_MS);
      expect(navigateToAuth).toHaveBeenCalledWith("/(auth)/sign-up");
      expect(setShellMode).not.toHaveBeenCalled();
      expect(navigateToDestination).not.toHaveBeenCalled();
    });

    it(`signed-in ${action} goes directly to the selected destination`, async () => {
      await continueFromOnboarding(action, true, "explore", {
        storage, setShellMode, navigateToAuth, navigateToDestination,
      });

      expect(storage.setItem).not.toHaveBeenCalled();
      expect(setShellMode).toHaveBeenCalledWith("training");
      expect(navigateToDestination).toHaveBeenCalledWith("/(tabs)/explore");
      expect(navigateToAuth).not.toHaveBeenCalled();
    });
  }

  it("restores a pending intent once, clearing it before navigating", async () => {
    await continueFromOnboarding("finish", false, "training", {
      storage, setShellMode, navigateToAuth, navigateToDestination,
    });
    const events: string[] = [];
    const removeFromStorage = vi.mocked(storage.removeItem).getMockImplementation()!;
    vi.mocked(storage.removeItem).mockImplementationOnce(async key => {
      events.push("clear");
      await Promise.resolve();
      expect(key).toBe(ONBOARDING_PENDING_INTENT_KEY);
      await removeFromStorage(key);
    });
    const restored = await restorePendingOnboardingIntent(storage, {
      setShellMode: async () => { events.push("shell"); },
      navigateToDestination: route => {
        events.push(`navigate:${route}`);
        expect(storage.removeItem).toHaveBeenCalledOnce();
      },
    });

    expect(restored).toEqual({ status: "restored", intentId: "training" });
    expect(storage.removeItem).toHaveBeenCalledWith(ONBOARDING_PENDING_INTENT_KEY);
    expect(events).toEqual(["clear", "shell", "navigate:/(tabs)/dashboard"]);
    expect(await restorePendingOnboardingIntent(storage, {
      setShellMode, navigateToDestination,
    }, NOW + 1)).toEqual({ status: "missing" });
    expect(navigateToDestination).not.toHaveBeenCalled();
  });

  it("clears and rejects stale or invalid pending intents", async () => {
    // Supply stored payloads directly to isolate expiry/allow-list validation.
    const restoreDependencies = {
      setShellMode,
      navigateToDestination,
    };
    vi.mocked(storage.getItem).mockResolvedValueOnce(JSON.stringify({
      intentId: "expedition", expiresAt: NOW,
    }));
    expect(await restorePendingOnboardingIntent(storage, restoreDependencies, NOW)).toEqual({ status: "stale" });

    vi.mocked(storage.getItem).mockResolvedValueOnce(JSON.stringify({
      intentId: "/unapproved-route", expiresAt: NOW + 1,
    }));
    expect(await restorePendingOnboardingIntent(storage, restoreDependencies, NOW)).toEqual({ status: "invalid" });
    expect(storage.removeItem).toHaveBeenCalledTimes(2);
    expect(setShellMode).not.toHaveBeenCalled();
    expect(navigateToDestination).not.toHaveBeenCalled();
  });

  it("treats missing intent as a safe no-op, without creating an auth redirect loop", async () => {
    expect(await restorePendingOnboardingIntent(storage, {
      setShellMode, navigateToDestination,
    }, NOW)).toEqual({ status: "missing" });
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(navigateToAuth).not.toHaveBeenCalled();
    expect(navigateToDestination).not.toHaveBeenCalled();
  });

  it("starts post-auth landing only once, preventing a redirect loop", () => {
    expect(shouldStartSignedInLandingRedirect(true, true, false, false)).toBe(true);
    expect(shouldStartSignedInLandingRedirect(true, true, false, true)).toBe(false);
    expect(shouldStartSignedInLandingRedirect(true, false, false, false)).toBe(false);
    expect(shouldStartSignedInLandingRedirect(false, true, false, false)).toBe(false);
    expect(shouldResetLandingRedirectForUser(true, "user-a", "user-a")).toBe(false);
    expect(shouldResetLandingRedirectForUser(true, "user-b", "user-a")).toBe(true);
    expect(shouldResetLandingRedirectForUser(false, "user-a", "user-a")).toBe(false);
  });

  it("recovers the current owner's active hike before consuming onboarding intent", async () => {
    await continueFromOnboarding("finish", false, "expedition", {
      storage, setShellMode, navigateToAuth, navigateToDestination,
    });
    const recoverActiveHike = vi.fn(async () => true);
    const restoreIntent = vi.fn(() => restorePendingOnboardingIntent(storage, {
      setShellMode, navigateToDestination,
    }));

    expect(await restorePendingAfterActiveHike(recoverActiveHike, restoreIntent)).toBe("active-hike");
    expect(recoverActiveHike).toHaveBeenCalledOnce();
    expect(restoreIntent).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(await consumePendingOnboardingIntent(storage)).toEqual({
      status: "restored", intentId: "expedition",
    });
  });

  it("checks pending onboarding intent only after no active hike needs recovery", async () => {
    const sequence: string[] = [];
    const destination = await restorePendingAfterActiveHike(async () => {
      sequence.push("recover-active-hike");
      return false;
    }, async () => {
      sequence.push("consume-onboarding");
      return { status: "restored", intentId: "expedition" };
    });

    expect(sequence).toEqual(["recover-active-hike", "consume-onboarding"]);
    expect(destination).toEqual({ status: "restored", intentId: "expedition" });
  });
});