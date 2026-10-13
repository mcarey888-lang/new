import { afterEach,describe,it,expect,vi } from "vitest";
const storage=vi.hoisted(()=>new Map<string,string>());
vi.mock("@react-native-async-storage/async-storage",()=>({default:{
  getItem:async(key:string)=>storage.get(key)??null,
  setItem:async(key:string,value:string)=>{storage.set(key,value);},
}}));
import {resolveActivityApiBase} from "./activityServiceOrigin";
describe("create, audience, retry and deletion share one recording service",()=>{
  afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();storage.clear();});
  it("prefers the explicit map/activity service over a different general domain",()=>{
    expect(resolveActivityApiBase({mapBase:"https://service-a.example/api/",domain:"service-b.example"}))
      .toBe("https://service-a.example/api");
  });
  it("retargets stale DOMAIN-only owned-recording queue URLs without sending auth to server B",async()=>{
    vi.stubEnv("EXPO_PUBLIC_MAP_BASE","https://service-a.example/api");
    vi.stubEnv("EXPO_PUBLIC_DOMAIN","service-b.example");
    vi.resetModules();
    const {enqueueSyncPending,retrySyncOutbox,readOutbox}=await import("./syncOutbox");
    const token=async()=>`header.${btoa(JSON.stringify({sub:"owner"}))}.signature`;
    const fetched:string[]=[];
    vi.stubGlobal("fetch",vi.fn(async(url:string,options:RequestInit)=>{
      fetched.push(url);const body=JSON.parse(options.body as string);
      if(options.method==="DELETE")return new Response(null,{status:204});
      return new Response(JSON.stringify(options.method==="PUT"&&url.endsWith("/recorded-hikes")?
        {ok:true,hikeId:body.hikeId,revision:body.revision}:{ok:true}));
    }));
    const item={id:"private-hike:hike",kind:"private-hike" as const,method:"PUT" as const,
      url:"https://service-b.example/api/recorded-hikes",body:{hikeId:"hike",revision:"R",snapshot:{id:"hike"}}};
    await enqueueSyncPending("owner",item);await retrySyncOutbox("owner",token);
    await enqueueSyncPending("owner",{...item,body:{...item.body,revision:"R2",snapshot:{id:"hike",audience:"private"}}});
    await retrySyncOutbox("owner",token);
    await enqueueSyncPending("owner",{id:"pref",kind:"activity-preference",method:"PUT",url:"https://service-b.example/api/activity-community/preferences",body:{audience:"private"}});
    await retrySyncOutbox("owner",token);
    await enqueueSyncPending("owner",{...item,id:"delete",kind:"private-hike-delete",method:"DELETE",body:{hikeId:"hike"}});
    await retrySyncOutbox("owner",token);
    expect(fetched).toEqual([
      "https://service-a.example/api/recorded-hikes","https://service-a.example/api/recorded-hikes",
      "https://service-a.example/api/activity-community/preferences","https://service-a.example/api/recorded-hikes/hike"]);
    expect(await readOutbox("owner")).toEqual([]);
  });
});
