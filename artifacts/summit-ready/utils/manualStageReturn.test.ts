import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  addUniqueCompletedRoute, creditExpeditionHike,
  expeditionRouteIdentityMatches, routeCompletionKey,
} from "./stateReliability";

const source = readFileSync(new URL("../app/log-hill.tsx", import.meta.url), "utf8");
const handler = source.slice(
  source.indexOf("async function handleLogSession()"),
  source.indexOf('const [searchText,'),
).trim();

function harness(params: Record<string, string> = {
  manualHillName: "Test stage", expeditionId: "expedition", returnTo: "expedition-basecamp",
}) {
  const route = {
    name: "Test stage", routeIdentityKey: "stage-one", elevation: 500,
    distance: 3, repeats: 1,
  };
  const calls: string[] = [];
  const addSession = vi.fn(async (..._args: unknown[]) => { calls.push("session-saved"); return "session"; });
  const patchExpedition = vi.fn(async (..._args: unknown[]) => { calls.push("progress-saved"); });
  const dismissTo = vi.fn(() => { calls.push("basecamp"); });
  const ctx = {
    params, logTarget: route, reps: 1,
    activeExpedition: {
      id: "expedition", virtualHills: [route], completedRoutes: [],
      virtualHikeProgress: undefined,
    },
    addSession, patchExpedition,
    addUniqueCompletedRoute, creditExpeditionHike, expeditionRouteIdentityMatches, routeCompletionKey,
    setLogging: vi.fn(), logHillSessionCompleted: vi.fn(),
    setLoggedHill: vi.fn(), closeLogModal: vi.fn(),
    setTimeout: vi.fn(), activeChallenges: [{ completed: false }],
    setPendingChallenge: vi.fn(), router: { dismissTo },
  };
  // Execute the actual save handler with isolated context dependencies; no account or API writes.
  const run = new Function("ctx", `with(ctx) { return (${handler}); }`)(ctx) as () => Promise<void>;
  return { ctx, run, calls };
}

describe("manual expedition stage Basecamp handoff", () => {
  it("waits for both saves, then returns directly without exposing the picker or challenge sheet", async () => {
    const h = harness();
    await h.run();
    expect(h.calls).toEqual(["session-saved", "progress-saved", "basecamp"]);
    expect(h.ctx.router.dismissTo).toHaveBeenCalledWith("/(tabs)/dashboard");
    expect(h.ctx.closeLogModal).not.toHaveBeenCalled();
    expect(h.ctx.setLoggedHill).not.toHaveBeenCalled();
    expect(h.ctx.setPendingChallenge).not.toHaveBeenCalled();
    expect(h.ctx.patchExpedition.mock.calls[0]).toEqual(["expedition", expect.objectContaining({
      completedRoutes: ["stage-one"],
    })]);
    expect(h.ctx.addSession.mock.calls[0]?.[0]).toMatchObject({
      expeditionId: "expedition", routeIdentityKey: "stage-one", completed: true,
    });
  });

  it("also returns for already-open legacy stage log links", async () => {
    const h = harness({ manualHillName: "Test stage", expeditionId: "expedition" });
    await h.run();
    expect(h.calls).toEqual(["session-saved", "progress-saved", "basecamp"]);
  });

  it("does not navigate before expedition progress finishes saving", async () => {
    const h = harness();
    let finish!: () => void;
    h.ctx.patchExpedition.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const pending = h.run();
    await Promise.resolve();
    expect(h.ctx.router.dismissTo).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(h.ctx.router.dismissTo).toHaveBeenCalledOnce();
  });

  it("does not navigate after a failed session save or failed progress save", async () => {
    for (const failure of ["session", "progress"]) {
      const h = harness();
      if (failure === "session") h.ctx.addSession.mockRejectedValueOnce(new Error("save failed"));
      else h.ctx.patchExpedition.mockRejectedValueOnce(new Error("save failed"));
      await expect(h.run()).rejects.toThrow("save failed");
      expect(h.ctx.router.dismissTo).not.toHaveBeenCalled();
      expect(h.ctx.setLogging).toHaveBeenLastCalledWith(false);
    }
  });

  it("keeps ordinary Training hill logging and optional challenge assignment unchanged", async () => {
    const h = harness({});
    await h.run();
    expect(h.ctx.router.dismissTo).not.toHaveBeenCalled();
    expect(h.ctx.closeLogModal).toHaveBeenCalledOnce();
    expect(h.ctx.setPendingChallenge).toHaveBeenCalledOnce();
  });

  it("never awards expedition completion directly, even on the final stage", async () => {
    expect(handler).not.toContain("completeExpedition(");
    expect(handler).not.toMatch(/router\.(push|replace).*celebrat|router\.(push|replace).*complet/i);
  });

  it("marks only the expedition stage CTA for a direct Basecamp return", () => {
    const stage = readFileSync(new URL("../app/hill-detail.tsx", import.meta.url), "utf8");
    expect(stage).toContain('returnTo: "expedition-basecamp"');
  });
});
