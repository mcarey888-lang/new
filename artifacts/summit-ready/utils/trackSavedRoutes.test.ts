import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const read = (file: string) => readFileSync(join(root, file), "utf8");

describe("Track artwork and personal route access", () => {
  it("keeps the real private route library available in You", () => {
    const profile = read("components/profile/PrimaryProfilePresentation.tsx");
    const account = read("app/(tabs)/account.tsx");
    const section = read("components/track/SavedRoutesSection.tsx");
    expect(profile).toContain('{ value: "saved", label: "Saved hikes" }');
    expect(account).toMatch(/tab === "saved" && !showSettings && \([\s\S]*?<SavedRoutesSection/);
    expect(account).toContain('testID="you-saved-hikes"');
    expect(account).toContain("Only you can see this library.");
    expect(section).toContain('title = "Saved routes"');
    expect(section).toContain('testID = "track-saved-routes"');
    expect(section).toContain("listRoutes(() => tokenGetter.current())");
    expect(section).toContain("result?.owner === userId");
  });

  it("uses the shared map and retains saved-route selection and recording controls", () => {
    const screen = read("components/SharedTrackScreen.tsx");
    expect(screen).toContain("<TrackMap recording={false}");
    expect(screen).not.toContain('require("@/assets/images/track-mountain-hiker.png")');
    for (const id of ["track-resume-activity", "track-route-row", "track-start-hike"]) {
      expect(screen).toContain(`testID="${id}"`);
    }
    expect(screen).toContain("listRoutes(getToken)");
    expect(screen).toContain("Your saved routes");
  });

  it("loads real saved routes on focus and rejects stale account responses", () => {
    const section = read("components/track/SavedRoutesSection.tsx");
    expect(section).toContain("useFocusEffect(useCallback");
    expect(section).toContain("listRoutes(() => tokenGetter.current())");
    expect(section).toContain("result?.owner === userId");
    expect(section).toContain("if (cancelled) return");
    expect(section).toContain("cancelled = true");
    expect(section).toContain("describeRoute(route)");
    expect(section).toContain("plannedRouteId: id");
    expect(section).toContain("No saved routes yet");
    expect(section).toContain("Could not load saved routes");
    expect(section).toContain("Try again");
  });

  it("opens the selected owner-scoped route only after the planner map is ready", () => {
    const planner = read("app/route-planner.tsx");
    expect(planner).toContain('if (msg.type === "ready") setMapReady(true)');
    expect(planner).toContain("if (!mapReady || !plannedRouteId) return");
    expect(planner).toContain('toPage({ type: "clear" })');
    expect(planner).toContain("if (!userId) return");
    expect(planner).toContain("loadRoute(plannedRouteId, () => tokenGetter.current())");
    expect(planner).toContain('toPage({ type: "loadRoute", route: result.value })');
    expect(planner).toContain("if (cancelled) return");
  });
});