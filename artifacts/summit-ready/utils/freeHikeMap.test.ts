import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const screen = readFileSync(join(__dirname, "../app/hike-tracking.tsx"), "utf8");
function callbackBody(name: string) {
  const declaration = screen.indexOf(`const ${name} = useCallback(`);
  if (declaration < 0) throw new Error(`Missing ${name}`);
  const start = screen.indexOf("=> {", declaration) + 4;
  const end = screen.indexOf("}, [", start);
  if (end < start) throw new Error(`Missing callback end for ${name}`);
  return screen.slice(start, end).replaceAll(" as never", "");
}

describe("free hike map inset behavior", () => {
  it.each([
    { ready: true, options: false, busy: false, expected: 42 },
    { ready: true, options: true, busy: false, expected: 320 },
    { ready: true, options: true, busy: true, expected: 42 },
    { ready: false, options: false, busy: false, expected: 320 },
  ])("reserves $expected px for $ready/$options/$busy", ({ ready, options, busy, expected }) => {
    const send = vi.fn();
    runInNewContext(`function sendInsets() { ${callbackBody("sendRecordingInsets")} } sendInsets();`, {
      freeHikeReady: ready, freeHikeOptionsOpen: options, freeHikeMapBusy: busy,
      recordingSheetHeight: 320, insets: { bottom: 34 },
      recordingMapRef: { current: { send } },
    });
    expect(send.mock.calls).toEqual([
      [{ type: "bottomInset", px: expected }], [{ type: "topInset", px: 0 }],
    ]);
  });
});

function handle(message: Record<string, unknown>, ready = true, owner: string | null = "test-owner") {
  const context = {
    message, freeHikeReady: ready, userId: owner,
    sendRecordingInsets: vi.fn(),
    setFreeHikeDrawing: vi.fn(), setFreeHikeOptionsOpen: vi.fn(),
    setFreeHikeDraft: vi.fn(), setFreeHikeSummitOpen: vi.fn(),
    recordingMapRef: { current: { send: vi.fn() } },
    savePlannerDraft: vi.fn().mockResolvedValue(undefined),
    router: { push: vi.fn() }, Alert: { alert: vi.fn() },
  };
  runInNewContext(`function handleMessage(message) { ${callbackBody("handleRecordingMapMessage")} } handleMessage(message);`, context);
  return context;
}

describe("free hike map message behavior", () => {
  it("closes options while drawing and tracks an unsaved draft", () => {
    const drawing = handle({ type: "drawingChanged", on: true });
    expect(drawing.setFreeHikeDrawing).toHaveBeenCalledWith(true);
    expect(drawing.setFreeHikeOptionsOpen).toHaveBeenCalledWith(false);
    expect(handle({ type: "routeChanged", anchors: [1, 2] }).setFreeHikeDraft).toHaveBeenCalledWith(true);
    expect(handle({ type: "routeChanged", anchors: [] }).setFreeHikeDraft).toHaveBeenCalledWith(false);
  });

  it("persists an owner-scoped draft before opening the existing planner", async () => {
    const route = { anchors: [[54, -3], [54.1, -3.1]] };
    const result = handle({ type: "saveRequested", route });
    expect(result.recordingMapRef.current.send).toHaveBeenCalledWith({ type: "saveResult", ok: false });
    expect(result.savePlannerDraft).toHaveBeenCalledWith("test-owner", route);
    expect(result.router.push).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(result.router.push).toHaveBeenCalledWith({
      pathname: "/route-planner", params: { draftHandoff: "1" },
    });
  });

  it("does not hand off a route without an authenticated owner", () => {
    const result = handle({ type: "saveRequested", route: {} }, true, null);
    expect(result.Alert.alert).toHaveBeenCalled();
    expect(result.savePlannerDraft).not.toHaveBeenCalled();
  });

  it("ignores planner handoffs during an actual recording or a non-free hike", () => {
    const result = handle({ type: "saveRequested", route: {} }, false);
    expect(result.savePlannerDraft).not.toHaveBeenCalled();
    expect(result.router.push).not.toHaveBeenCalled();
    expect(result.recordingMapRef.current.send).not.toHaveBeenCalled();
  });
});
