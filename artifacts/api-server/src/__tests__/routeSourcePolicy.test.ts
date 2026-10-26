import { describe, expect, it } from "vitest";
import { isConstructedRoute } from "../services/routeSourcePolicy.js";
import { buildExpeditionRouteQueue } from "../services/expeditionRouteQueue.js";
describe("published track sourcing policy", () => {
  it("withdraws both generated methods and any edited descendant carrying their provenance", () => {
    for (const draftMethod of ["ors-proposed-itinerary-v1","osm-network-proposed-itinerary-v1"]) {
      expect(isConstructedRoute([{draftMethod}])).toBe(true);
      expect(isConstructedRoute([{name:"Owner edit"},{draftMethod}],"owner-edit-id")).toBe(true);
    }
    expect(isConstructedRoute([], "ors-draft-abc")).toBe(true);
    expect(isConstructedRoute([], "osm-network-abc")).toBe(true);
    expect(isConstructedRoute([{provider:"OpenStreetMap",relationId:"4004198"}],"source-v1")).toBe(false);
    expect(isConstructedRoute([], "13-profile-1", "Snowdon via Watkin Path — pilot")).toBe(true);
    expect(isConstructedRoute([], "13-profile-1", "Unrelated published source")).toBe(false);
  });
  it("never counts generated paths as acquired expedition route sources", () => {
    const q=buildExpeditionRouteQueue([{
      challenge_id:"example",route_key:"helvellyn_edge",route_name:"Helvellyn",region:"Lakes",
      distance_km:13,ascent_m:950,
    }],[{id:"one",candidateKey:"Generated",revisionVersion:"owner-edit-id",
      canonicalGeometryId:null,routeKey:"helvellyn_edge",draftMethod:"ors-proposed-itinerary-v1"}]);
    expect(q.routes[0].reviews).toEqual([]);
    expect(q.routes[0].blockers.join(" ")).toContain("published route track");
  });
});
