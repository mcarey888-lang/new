import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PLANNER = readFileSync(join(__dirname, "..", "app/route-planner.tsx"), "utf8");

describe("tapping a summit card opens its mountain", () => {
  it("navigates on the message the map sends", () => {
    expect(PLANNER).toContain('msg.type === "openMountain"');
    expect(PLANNER).toContain('pathname: "/mountain"');
  });

  it("carries the catalogue id, which is what makes the lookup exact", () => {
    expect(PLANNER).toContain("catalogueId: msg.catalogueId");
    expect(PLANNER).toContain('typeof msg.catalogueId === "string" && msg.catalogueId');
  });

  it("leaves out what the catalogue does not carry", () => {
    /* An empty string would reach the lookup as a real answer and narrow the
       search to nowhere. */
    expect(PLANNER).toContain("...(msg.name ? { name: msg.name } : {})");
    expect(PLANNER).toContain("...(msg.region ? { region: msg.region } : {})");
    expect(PLANNER).toContain("...(msg.country ? { country: msg.country } : {})");
  });

  it("keeps the router in the callback's dependencies", () => {
    /* It comes from a hook. Omitted, the callback closes over the first one
       forever, which is the kind of thing that works until it does not. */
    const handler = PLANNER.slice(PLANNER.indexOf("const onMessage"));
    expect(handler.slice(0, handler.indexOf("useEffect"))).toContain("}, [router]);");
  });

  it("still handles the save handshake", () => {
    expect(PLANNER).toContain('msg.type === "saveRequested" && msg.route');
  });

  it("leaves drawing and snapping to the page", () => {
    /* Reacting to them from both sides is how the two get out of step. */
    expect(PLANNER).not.toContain('msg.type === "planRouteFrom"');
    expect(PLANNER).not.toContain('msg.type === "snappingChanged"');
  });
});
