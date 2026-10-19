import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(__dirname, "..", path), "utf8");

describe("community discovery entry points and identity boundaries", () => {
  it("offers Explore discovery with the current search term", () => {
    const source = read("app/(tabs)/explore.tsx");
    expect(source).toContain('testID="open-community-routes"');
    expect(source).toContain('pathname: "/community-routes"');
    expect(source).toContain('params: textQuery ? { q: textQuery.slice(0, 120) }');
  });
  it("hands URL search to discovery without changing the saved library", () => {
    const source = read("app/community-routes.tsx");
    expect(source).toContain("useLocalSearchParams");
    expect(source).toContain("Array.isArray(params.q)");
    expect(source).toContain("<CommunityRecordingLibrary initialQuery={initialQuery}/>");
    expect(source).toContain("<CommunityRecordingLibrary saved/>");
  });
  it("shows exact-mountain member recordings separately from existing routes", () => {
    const source = read("app/mountain.tsx");
    expect(source).toContain("{canonicalMountainId ? (");
    expect(source).toContain("mountainId={canonicalMountainId} mountainName={mountain.name}");
    expect(source).toContain('SRSectionHeader title="Routes"');
  });
  it("keeps member recordings unverified and excludes nearby guesses in mountain mode", () => {
    const source = read("components/track/CommunityRecordingLibrary.tsx");
    expect(source).toContain('mountainId?{mountainId}:{}');
    expect(source).toContain('scoped?"Member routes":"Member recordings"');
    expect(source).toContain("Real member activity · not verified trails");
    expect(source).toContain("Member recordings appear here only when linked to this exact mountain.");
    expect(source).toContain("{scoped?null:<Pressable");
  });
  it("fences old results and map pins across account and search changes", () => {
    const source = read("components/track/CommunityRecordingLibrary.tsx");
    expect(source).toContain("dataOwner===userId&&dataKey===filterKey?dataRaw:[]");
    expect(source).toContain("[dataRaw,dataOwner,dataKey,filterKey,userId,mapView]");
    expect(source).toContain("signal:ctl.signal");
    expect(source).toContain("active=false;ctl.abort();clearTimeout(timer)");
    expect(source).toContain("if(!active || ownerRef.current!==userId)return;");
    expect(source).toContain("if(!userId){setData([]);setMore(false);setLoading(false);return");
  });
});
