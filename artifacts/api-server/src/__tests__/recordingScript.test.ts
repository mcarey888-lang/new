import { describe, expect, it } from "vitest";
import { recordingScript } from "../routes/recording-script";
import { chromeFor, isUserGesture, shouldRecentre } from "../services/track/recordingView";

const script = () => recordingScript();

describe("the recording overlay script", () => {
  it("parses as JavaScript", () => {
    /* It is assembled from template strings and serialised functions, so a
       dropped bracket is invisible until a phone runs it on a hill. */
    expect(() => new Function(script())).not.toThrow();
  });

  it("frames selected geometry above the sheet without making recorded points", () => {
    const sources = new Map<string, { data: unknown; setData: (data: unknown) => void }>();
    const fits: unknown[] = [];
    const document = { querySelectorAll: () => [] };
    const map = {
      getContainer: () => ({ clientHeight: 844 }),
      getSource: (id: string) => sources.get(id),
      addSource: (id: string, options: { data: unknown }) => {
        sources.set(id, { data: options.data, setData(data) { this.data = data; } });
      },
      getLayer: () => undefined,
      addLayer: () => {},
      on: () => {},
      fitBounds: (_bounds: unknown, options: unknown) => fits.push(options),
    };
    class Bounds { extend() { return this; } }
    const run = new Function("map", "maplibregl", "document", `${script()}
      setBottomInset(280);
      recPlanned([[53.11, -4.0], [53.12, -3.99]]);
      var preview = map.getSource("rec-planned").data;
      recPlanned([[56.79, -5.0], [56.8, -4.99]]);
      var replacement = map.getSource("rec-planned").data;
      recPlanned([]);
      return { preview, replacement, cleared: map.getSource("rec-planned").data, track: recPts };
    `);
    const result = run(map, { LngLatBounds: Bounds }, document);
    expect(result.preview.features[0].geometry.coordinates).toEqual([[-4.0, 53.11], [-3.99, 53.12]]);
    expect(result.replacement.features[0].geometry.coordinates).toEqual([[-5.0, 56.79], [-4.99, 56.8]]);
    expect(result.cleared.features).toEqual([]);
    expect(result.track).toEqual([]);
    expect(fits[0]).toMatchObject({ padding: { top: 64, right: 64, bottom: 344, left: 64 } });
  });

  it("carries the real decision functions, not copies of them", () => {
    const body = script();
    for (const fn of [chromeFor, isUserGesture, shouldRecentre]) {
      /* Serialised from the module the tests exercise. A hand-written copy
         in the browser drifts from the tested one and nothing catches it. */
      expect(body).toContain(fn.toString());
    }
  });

  it("defines everything the recorder sends messages to", () => {
    const body = script();
    for (const fn of ["recAddPoint", "recLocate", "recReplay", "recPlanned", "recClearTrack", "setRecording", "recRecentre"]) {
      expect(body).toMatch(new RegExp(`function ${fn}\\(`));
    }
  });

  it("draws the recorded track and the planned route in different colours", () => {
    const body = script();
    const track = body.match(/var TRACK_COLOR = "(#[0-9A-Fa-f]{6})"/)?.[1];
    const planned = body.match(/var PLANNED_COLOR = "(#[0-9A-Fa-f]{6})"/)?.[1];
    expect(track).toBeTruthy();
    expect(planned).toBeTruthy();
    expect(track).not.toBe(planned);
  });

  it("gives the planned route a dashed line so it reads as not-yet-walked", () => {
    expect(script()).toMatch(/rec-planned-line[\s\S]{0,400}line-dasharray/);
  });

  it("converts the recorder's lat,lng into the map's lng,lat", () => {
    /* The recorder speaks [lat, lng] and MapLibre wants [lng, lat]. Getting
       this backwards puts a Lake District hike in Somalia, and it looks
       plausible enough on a dark basemap to ship. */
    const body = script();
    expect(body).toMatch(/recPts\.push\(\[points\[i\]\[1\], points\[i\]\[0\]\]\)/);
    expect(body).toMatch(/coords\.push\(\[points\[i\]\[1\], points\[i\]\[0\]\]\)/);
  });

  it("keeps a pre-start position out of the recorded track", () => {
    const body = script();
    const locate = body.slice(body.indexOf("function recLocate("), body.indexOf("function recReplay("));
    /* A point shown while waiting at the car park is not part of the walk.
       Adding it draws a line from the car park to the first real fix. */
    expect(locate).toMatch(/if \(recPts\.length\) return;/);
    expect(locate).not.toMatch(/recPts\.push/);
  });

  it("can lift the attribution above whatever covers the map", () => {
    const body = script();
    /* "Contains OS data (c) Crown copyright" is a condition of the OS
       licence. A bottom sheet covering it is a licence problem, not a
       cosmetic one. */
    expect(body).toMatch(/function setBottomInset\(/);
    expect(body).toContain("maplibregl-ctrl-bottom-right");
    expect(body).toContain("maplibregl-ctrl-bottom-left");
  });

  it("will not let a host push the attribution off the screen", () => {
    const body = script();
    /* Clamped: a host that sends 100000 must not be able to hide the
       attribution by shoving it past the top of the map. */
    expect(body).toMatch(/Math\.min\(600,/);
    expect(body).toMatch(/Math\.max\(0,/);
  });

  it("guards every call into the page's own functions", () => {
    /* The overlay loads beside the planner, but a page built without search
       or drawing must not throw on the first setRecording. */
    const body = script();
    for (const fn of ["setSearchVisible", "setDrawing", "hideSummitCard", "syncControls"]) {
      expect(body).toMatch(new RegExp(`typeof ${fn} === "function"`));
    }
  });
});
