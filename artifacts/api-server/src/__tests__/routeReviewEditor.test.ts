import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { reviewEditorScript } from "../routes/route-review-editor-script.js";
import { routeEditInput } from "../services/routeReviewEdit.js";

describe("indexed review draft import", () => {
  it("preserves every point on a long repeated out-and-back, without nearest-node guesses", () => {
    const outward = Array.from({ length: 1500 }, (_,i) => ({ lat: 54 + i/100000, lng: -3 + i/100000 }));
    const points = [...outward, ...outward.slice(0,-1).reverse()];
    const indices = [0,700,1499,2100,points.length-1];
    const ctx: any = { anchors:[],legs:[],flying:true,profileToken:0,
      setDrawing:()=>{},redraw:()=>{},emit:()=>{},fitSavedRoute:()=>{},post:()=>{} };
    runInNewContext(reviewEditorScript(),ctx);
    expect(ctx.loadReviewDraft({type:"loadReviewDraft",points,anchorIndices:indices})).toBe(true);
    const reconstructed = ctx.legs.flatMap((leg: any, i: number) => i ? leg.points.slice(1) : leg.points);
    expect(JSON.parse(JSON.stringify(reconstructed))).toEqual(points);
    expect(ctx.anchors).toHaveLength(indices.length);
    expect(ctx.legs.every((l: any)=>l.kind==="offPath")).toBe(true);
  });
  it("rejects malformed indices without changing the route", () => {
    const ctx: any = { anchors:["unchanged"],legs:[] };
    runInNewContext(reviewEditorScript(),ctx);
    for (const ix of [[1,2],[0,2,1],[0,9]]) {
      ctx.loadReviewDraft({ type:"loadReviewDraft", points:[{lat:54,lng:-3},{lat:55,lng:-3},{lat:56,lng:-3}],anchorIndices:ix });
      expect(ctx.anchors).toEqual(["unchanged"]);
    }
  });
  it("edit API never accepts claimed approval, elevation or canonical binding", () => {
    const body = { coordinates:[[-3,54],[-3.01,54.01]],expectedLatestRevisionId:"2678ccc8-36e2-4077-9748-1e30742f4c3c" };
    expect(routeEditInput.safeParse(body).success).toBe(true);
    for (const extra of [{canonicalGeometryId:"fake"},{approved:true},{profileFile:"fake"}])
      expect(routeEditInput.safeParse({...body,...extra}).success).toBe(false);
    expect(routeEditInput.safeParse({...body,coordinates:[[1800,54],[-3,54]]}).success).toBe(false);
  });
});
