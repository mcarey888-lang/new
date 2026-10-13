import { describe, expect, it } from "vitest";
import { elevationQuality, recordedHikeElevationQuality } from "./elevationQuality";

describe("recorded altitude coverage", () => {
  it("does not claim missing or rejected altitude is a confident zero", () => {
    expect(elevationQuality([{ alt: null, ts: 0 }, { alt: 300, ts: 3000, altAcc: 21 }]).status).toBe("unavailable");
  });
  it("surfaces sparse fixes independently of the filtered total", () => {
    expect(elevationQuality(Array.from({ length: 20 }, (_, i) => ({ alt: 200 + i, ts: i * 31_000, altAcc: 8 }))).status).toBe("partial");
  });
  it("reports unknown vertical accuracy as partial", () => {
    expect(elevationQuality([{ alt: 200, ts: 0 }, { alt: 201, ts: 3000 }]).status).toBe("partial");
  });
  it("can report trustworthy coverage on a stationary trace", () => {
    expect(elevationQuality(Array.from({ length: 20 }, (_, i) => ({ alt: 200, ts: i * 3000, altAcc: 3 })),57).status).toBe("reliable");
  });
});

describe("duration-aware quality persisted through recording lifecycle",()=>{
  it("never calls two nearby accurate fixes reliable, including unknown duration",()=>{
    const points=[{alt:200,ts:0,altAcc:3},{alt:210,ts:10_000,altAcc:3}];
    expect(elevationQuality(points).status).toBe("partial");
    expect(elevationQuality(points,6*3600).status).toBe("unavailable");
    expect(recordedHikeElevationQuality({trackPoints:points,timeTaken:360}).status).toBe("unavailable");
  });
  it("does not count a long gap as good coverage merely because endpoints span the whole recording",()=>{
    const points=Array.from({length:20},(_,i)=>({alt:200,altAcc:3,ts:i*1_000_000}));
    expect(elevationQuality(points,19_000).status).toBe("unavailable");
  });
  it("excludes a deliberate pause from active coverage without inventing intervening fixes",()=>{
    const points=[...Array.from({length:11},(_,i)=>({alt:200,altAcc:3,ts:i*3000})),
      ...Array.from({length:11},(_,i)=>({alt:200,altAcc:3,ts:7_230_000+i*3000}))];
    const result=elevationQuality(points,60,[{type:"start",ts:0},{type:"pause",ts:30_000},
      {type:"resume",ts:7_230_000},{type:"finish",ts:7_260_000}]);
    expect(result.status).toBe("reliable");expect(result.coveredSeconds).toBe(60);expect(result.gaps).toBe(0);
  });
  it("uses accepted raw altitude evidence without mutating the original points",()=>{
    const raw=Array.from({length:21},(_,i)=>({lat:53,lon:-2,alt:200,altAcc:3,ts:i*3000,
      acceptedForTrace:i!==10,source:"foreground" as const}));
    const original=JSON.stringify(raw);
    expect(recordedHikeElevationQuality({rawGPSFixes:raw,recordingDurationSeconds:60}).status).toBe("reliable");
    expect(JSON.stringify(raw)).toBe(original);
  });
});
