import {describe,it,expect,vi,beforeEach} from "vitest";
const enqueue=vi.hoisted(()=>vi.fn(async(_owner:string,_item:{body:unknown})=>{}));
vi.mock("./syncOutbox",()=>({enqueueSyncPending:enqueue}));
import {queueRecordedHikeSync} from "./recordedHikeSync";
import {privateRecordedHikeBackup} from "./recordedHikeRecovery";
import {recordedHikeElevationQuality} from "./elevationQuality";
import type {ExploreHike} from "../context/AppContext";
describe("save, restore and canonical upload recalculate the same coverage",()=>{
  beforeEach(()=>enqueue.mockClear());
  it("does not upload a cached reliable badge from a sparse six-hour recording as gps_recorded",async()=>{
    const hike={id:"hike",name:"Sparse",date:"2026-10-13",timeTaken:360,recordingDurationSeconds:21600,
      distance:2,elevationGain:100,notes:"original",backupRevision:"2026-10-13T00:00:00.000Z",
      trackPoints:[{lat:53,lon:-2,alt:200,altAcc:3,ts:0},{lat:53,lon:-2,alt:210,altAcc:3,ts:10_000}],
      elevationQuality:{status:"reliable",label:"old misleading badge"}} as ExploreHike;
    const backup=privateRecordedHikeBackup(hike);
    expect(backup.snapshot.elevationQuality.status).toBe("unavailable");
    const restored=JSON.parse(JSON.stringify(backup.snapshot));
    expect(recordedHikeElevationQuality(restored)).toEqual(recordedHikeElevationQuality(hike));
    await queueRecordedHikeSync("owner",hike);
    expect(enqueue.mock.calls[1][1].body).toMatchObject({
      evidenceClassification:"unavailable_untrusted",durationSeconds:21600,
      sourceSnapshot:{elevationQuality:{status:"unavailable"}},
    });
    expect(hike.elevationQuality?.status).toBe("reliable"); // original evidence/metadata untouched
    expect(hike.elevationGain).toBe(100);
  });
});
