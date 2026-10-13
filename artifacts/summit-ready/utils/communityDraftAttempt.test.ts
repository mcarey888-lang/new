import {describe,it,expect} from "vitest";
import {CommunityDraftAttempt} from "./communityDraftAttempt";
describe("creation keys identify an account/draft attempt, not equal text",()=>{
  const attempts=()=>{let id=0;return new CommunityDraftAttempt(()=>`request-${++id}`);};
  it("an ambiguous failure retains the same key until acknowledgement",()=>{
    const a=attempts();expect(a.acquire("owner","draft")).toBe(a.acquire("owner","draft"));
  });
  it("a successful request is not reused for a second identical submission",()=>{
    const a=attempts();const first=a.acquire("owner","draft");a.acknowledge(first);
    expect(a.acquire("owner","draft")).not.toBe(first);
  });
  it("a genuinely new draft has a separate key before old acknowledgement",()=>{
    const a=attempts();const first=a.acquire("owner","draft-a");const second=a.acquire("owner","draft-b");
    a.acknowledge(first);expect(a.acquire("owner","draft-b")).toBe(second);
  });
  it("account switching never reuses another account attempt",()=>{
    const a=attempts();expect(a.acquire("owner-b","same-draft")).not.toBe(a.acquire("owner-a","same-draft"));
  });
  it("an explicit reset starts a new creation",()=>{
    const a=attempts();const first=a.acquire("owner","draft");a.reset();expect(a.acquire("owner","draft")).not.toBe(first);
  });
});
