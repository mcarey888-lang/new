import { describe,it,expect } from "vitest";
import { canReadActivity } from "../services/activityAudience";
describe("Activity audience: signed-in members, with server follower authority",()=>{
  it.each(["public","followers","private",null] as const)("rejects anonymous access to %s",(audience)=>{
    expect(canReadActivity({owner:"author",viewer:null,audience,follows:true})).toBe(false);
  });
  it.each(["public","followers","private",null] as const)("preserves the owner's access to %s",(audience)=>{
    expect(canReadActivity({owner:"author",viewer:"author",audience,follows:false})).toBe(true);
  });
  it("does not let a stranger read follower/private/unknown activities",()=>{
    for(const audience of ["followers","private",null] as const)
      expect(canReadActivity({owner:"author",viewer:"stranger",audience,follows:false})).toBe(false);
  });
  it("lets a member see public recordings, and only current followers see follower recordings",()=>{
    expect(canReadActivity({owner:"author",viewer:"member",audience:"public",follows:false})).toBe(true);
    expect(canReadActivity({owner:"author",viewer:"member",audience:"followers",follows:true})).toBe(true);
    expect(canReadActivity({owner:"author",viewer:"member",audience:"followers",follows:false})).toBe(false);
    expect(canReadActivity({owner:"author",viewer:"member",audience:"private",follows:true})).toBe(false);
  });
});
