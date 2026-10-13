import { beforeEach,describe,it,expect,vi } from "vitest";
const storage=vi.hoisted(()=>new Map<string,string>());
vi.mock("@react-native-async-storage/async-storage",()=>({default:{
  getItem:async(key:string)=>storage.get(key)??null,
  setItem:async(key:string,value:string)=>{storage.set(key,value);},
}}));
import type {ExploreHike} from "../context/AppContext";
import {backUpCurrentRecording,reconcileRecordingBackups,type RecordingBackupStore} from "./recordedHikeBackupActions";
import {enqueueSyncPending,readOutbox} from "./syncOutbox";
import {privateRecordedHikeBackup} from "./recordedHikeRecovery";
const token=async()=>`header.${btoa(JSON.stringify({sub:"owner"}))}.signature`;
const recording=()=>({id:"hike",name:"Test",date:"2026-10-13",timeTaken:360,distance:2,elevationGain:100,notes:"current",
  backupRevision:"2026-10-13T01:00:00.000Z",sharingRevision:"sharing-r",audience:"private",sharingIntentConfirmed:true,syncState:"queued"} as ExploreHike);
function testStore(initial=recording()) {
  let rows=[initial]; let validOwner=true;
  let tail:Promise<unknown>=Promise.resolve();
  const persist=vi.fn(async(next:ExploreHike[])=>{rows=next;});
  const store:RecordingBackupStore={
    exclusive:operation=>{const next=tail.then(operation);tail=next.catch(()=>{});return next;},
    read:()=>rows,write:persist,assertOwner:()=>{if(!validOwner)throw new Error("Account changed");},
  };
  return {store,persist,edit:(hike:ExploreHike)=>{rows=[hike];},switchOwner:()=>{validOwner=false;}};
}
describe("manual backup uses latest owned evidence and shared receipt-only metadata",()=>{
  beforeEach(()=>{storage.clear();vi.unstubAllGlobals();});
  it("ACK R keeps current/backed-up revision R without queuing a replacement",async()=>{
    const s=testStore();
    const fetcher=vi.fn(async(_url:string,options:RequestInit)=>{
      const body=JSON.parse(options.body as string);
      return new Response(JSON.stringify({ok:true,hikeId:body.hikeId,revision:body.revision}));
    });
    vi.stubGlobal("fetch",fetcher);
    expect(await backUpCurrentRecording("owner","hike",s.store,token)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(s.store.read()[0]).toMatchObject({backupRevision:recording().backupRevision,
      backedUpRevision:recording().backupRevision,sharingRevision:"sharing-r",syncState:"synced"});
    expect(await readOutbox("owner")).toEqual([]);
  });
  it("a newer edit during upload is not replaced by a stale snapshot or ACK",async()=>{
    const s=testStore();let release!:(response:Response)=>void;let signal!:()=>void;
    const started=new Promise<void>(resolve=>{signal=resolve;});
    vi.stubGlobal("fetch",vi.fn(()=>{signal();return new Promise<Response>(resolve=>{release=resolve;});}));
    const backup=backUpCurrentRecording("owner","hike",s.store,token);
    await started;
    const newer={...recording(),notes:"new edit",backupRevision:"2026-10-13T02:00:00.000Z",audience:"public" as const};
    await s.store.exclusive(async()=>{
      s.edit(newer);
      await enqueueSyncPending("owner",{id:"private-hike:hike",kind:"private-hike",method:"PUT",url:"/api/recorded-hikes",body:privateRecordedHikeBackup(newer)});
    });
    release(new Response(JSON.stringify({ok:true,hikeId:"hike",revision:recording().backupRevision})));
    expect(await backup).toBe(false);
    expect(s.store.read()[0]).toEqual(newer);
    expect((await readOutbox("owner"))[0].body).toMatchObject({revision:newer.backupRevision,snapshot:{notes:"new edit",audience:"public"}});
  });
  it("a metadata write failure does not falsely mutate memory, and automatic recovery uses the same ACK",async()=>{
    const s=testStore();
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({ok:true,hikeId:"hike",revision:recording().backupRevision}))));
    s.persist.mockRejectedValueOnce(new Error("Storage full"));
    await expect(backUpCurrentRecording("owner","hike",s.store,token)).rejects.toThrow("Storage full");
    expect(s.store.read()[0].backedUpRevision).toBeUndefined();
    await reconcileRecordingBackups("owner",s.store);
    expect(s.store.read()[0].backedUpRevision).toBe(recording().backupRevision);
    expect(await readOutbox("owner")).toEqual([]);
  });
  it("does not queue a stale recording after deletion or an account switch",async()=>{
    const s=testStore();s.switchOwner();
    await expect(backUpCurrentRecording("owner","hike",s.store,token)).rejects.toThrow("Account changed");
    expect(await readOutbox("owner")).toEqual([]);
  });
});
