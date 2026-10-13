import express from "express";
import type {Server} from "node:http";
import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {mountRequestBodyParsers} from "../lib/requestBodyParsers";
import {SaveTrackedSchema} from "../routes/hill-session-contract";
describe("actual application parser mounts and training trace admission",()=>{
  let server:Server;let base:string;
  beforeAll(async()=>{
    const app=express();mountRequestBodyParsers(app);
    // Real production parser and validator, admission endpoint only. This is
    // intentionally not a database-backed training/credit acceptance test.
    app.post("/api/hill-session/save-tracked",(req,res)=>{
      const parsed=SaveTrackedSchema.safeParse(req.body);
      if(!parsed.success){res.status(400).json({error:"Invalid recording"});return;}
      res.json({points:parsed.data.rawGpsTrack?.length,last:parsed.data.rawGpsTrack?.at(-1),
        profile:parsed.data.elevationProfile?.length,activityId:parsed.data.activityId});
    });
    app.post("/api/other",(req,res)=>{res.json({ok:true});});
    await new Promise<void>((resolve,reject)=>{
      server=app.listen(0,"127.0.0.1",()=>resolve());
      server.once("error",reject);
    });
    base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  });
  afterAll(()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())));
  it("uses the tested mount function in the real application, not a plural imitation",()=>{
    expect(readFileSync(new URL("../app.ts",import.meta.url),"utf8")).toContain("mountRequestBodyParsers(app)");
  });
  it.each([1800,43201])("admits %i training fixes on the singular endpoint without truncation",async count=>{
    const points=Array.from({length:count},(_,i)=>({lat:53.1234567890123,lon:-2.1234567890123,alt:300+i/1000,ts:1791864000000+i*2000}));
    const body=JSON.stringify({activityId:"training-hike-1",plannedHillName:"Test hill",
      recordedDurationSeconds:(count-1)*2,rawGpsTrack:points,elevationProfile:points.map(p=>({ts:p.ts,alt:p.alt}))});
    expect(Buffer.byteLength(body)).toBeGreaterThan(100*1024);
    const response=await fetch(`${base}/api/hill-session/save-tracked`,{method:"POST",headers:{"Content-Type":"application/json"},body});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({points:count,last:points.at(-1),profile:count,activityId:"training-hike-1"});
  });
  it("keeps unrelated endpoints at their smaller limit with an actionable JSON413",async()=>{
    const response=await fetch(`${base}/api/other`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({notes:"x".repeat(130000)})});
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({error:expect.stringContaining("not been acknowledged")});
  });
  it("rejects unbounded training arrays without trimming the evidence",()=>{
    expect(SaveTrackedSchema.safeParse({activityId:"training-hike-1",plannedHillName:"Test hill",rawGpsTrack:Array(100001).fill(null)}).success).toBe(false);
  });
});
