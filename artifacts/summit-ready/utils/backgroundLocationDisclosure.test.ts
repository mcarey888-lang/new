import { describe, expect, it, vi } from "vitest";
import {
  BACKGROUND_LOCATION_MESSAGE, BACKGROUND_LOCATION_TITLE,
  requestBackgroundLocation,
} from "./backgroundLocationDisclosure";

function deps(opts: { agree: boolean; status?: string }) {
  const order: string[] = [];
  return {
    order,
    confirm: vi.fn(async () => { order.push("disclosure"); return opts.agree; }),
    request: vi.fn(async () => { order.push("system"); return { status: opts.status ?? "granted" }; }),
  };
}

describe("asking for background location", () => {
  it("shows the disclosure before the system prompt", async () => {
    const d = deps({ agree: true });
    await requestBackgroundLocation(d);
    /* The order is the policy. A disclosure after the prompt is no
       disclosure at all. */
    expect(d.order).toEqual(["disclosure", "system"]);
  });

  it("never reaches the system prompt when the person declines", async () => {
    const d = deps({ agree: false });
    const result = await requestBackgroundLocation(d);
    expect(d.request).not.toHaveBeenCalled();
    expect(result).toEqual({ granted: false, declinedDisclosure: true });
  });

  it("reports a refusal at the system prompt as not granted", async () => {
    const d = deps({ agree: true, status: "denied" });
    const result = await requestBackgroundLocation(d);
    expect(result).toEqual({ granted: false, declinedDisclosure: false });
  });

  it("treats a thrown permission call as not granted rather than crashing", async () => {
    const result = await requestBackgroundLocation({
      confirm: async () => true,
      request: async () => { throw new Error("no permission module"); },
    });
    expect(result.granted).toBe(false);
  });

  it("says the three things the policy requires it to say", () => {
    const text = `${BACKGROUND_LOCATION_TITLE} ${BACKGROUND_LOCATION_MESSAGE}`.toLowerCase();
    /* What is collected, that it happens in the background including when
       the app is closed, and what it is for. */
    expect(text).toContain("location");
    expect(text).toContain("background");
    expect(text).toContain("closed");
    expect(text).toMatch(/distance|ascent|route|track/);
  });

  it("says when the collection stops", () => {
    /* A disclosure that never says when it ends reads as "always". */
    expect(BACKGROUND_LOCATION_MESSAGE.toLowerCase()).toMatch(/only while|stops the collection/);
  });
});

describe("the tracking screen", () => {
  it("routes its first background request through the disclosure", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const body = readFileSync(join(__dirname, "..", "app/hike-tracking.tsx"), "utf8");
    const code = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    /* Starting a hike must go through the helper, with the real permission
       call handed to it rather than made alongside it. */
    expect(code).toMatch(/requestBackgroundLocation\(\{/);
    expect(code).toMatch(/request:\s*\(\)\s*=>\s*Location\.requestBackgroundPermissionsAsync\(\)/);

    /* Everything else: the resume path may call the API directly, because
       consent was given when the hike started and that call only re-reads a
       decision already made. A second one would be a new ask with no
       disclosure in front of it. */
    const withoutInjection = code.replace(
      /request:\s*\(\)\s*=>\s*Location\.requestBackgroundPermissionsAsync\(\)/g, "",
    );
    const direct = (withoutInjection.match(/Location\.requestBackgroundPermissionsAsync/g) ?? []).length;
    expect(direct).toBeLessThanOrEqual(1);
  });
});
