import { describe, expect, it } from "vitest";
import {
  markConfirmed, MAX_PARKING, MAX_PARKING_DISTANCE_M, parseParkingQuery,
} from "../services/summits/summitParking";
import type { ParkingCandidate } from "../services/directionsLookup";

const SCAFELL = { name: "Scafell Pike", lat: 54.454, lng: -3.211 };

const candidate = (over: Partial<ParkingCandidate> = {}): ParkingCandidate => ({
  placeId: "N1", name: "Wasdale Head", address: "", lat: 54.46, lng: -3.28,
  distanceM: 2000, ...over,
});

describe("reading a parking request", () => {
  it("accepts a hill with a name and a position", () => {
    expect(parseParkingQuery({ lat: "54.454", lng: "-3.211", name: "Scafell Pike" }))
      .toEqual({ name: "Scafell Pike", lat: 54.454, lng: -3.211 });
  });

  it("refuses a missing latitude instead of reading it as zero", () => {
    /* Number("") is 0, so a defaulted latitude would look up car parks in
       the Gulf of Guinea and return nothing, looking like a hill with none. */
    expect(parseParkingQuery({ lng: "-3.211", name: "Scafell Pike" })).toBeNull();
    expect(parseParkingQuery({ lat: "", lng: "-3.211", name: "Scafell Pike" })).toBeNull();
    expect(parseParkingQuery({ lat: "  ", lng: "-3.211", name: "Scafell Pike" })).toBeNull();
  });

  it("refuses nonsense and out-of-range coordinates", () => {
    expect(parseParkingQuery({ lat: "abc", lng: "-3.2", name: "Hill" })).toBeNull();
    expect(parseParkingQuery({ lat: "91", lng: "-3.2", name: "Hill" })).toBeNull();
    expect(parseParkingQuery({ lat: "54", lng: "181", name: "Hill" })).toBeNull();
    expect(parseParkingQuery({ lat: "NaN", lng: "-3.2", name: "Hill" })).toBeNull();
  });

  it("refuses a request with no hill name", () => {
    /* The name is how a confirmed car park is identified, and what an
       unnamed place gets labelled with. */
    expect(parseParkingQuery({ lat: "54.4", lng: "-3.2" })).toBeNull();
    expect(parseParkingQuery({ lat: "54.4", lng: "-3.2", name: "x" })).toBeNull();
    expect(parseParkingQuery({ lat: "54.4", lng: "-3.2", name: "x".repeat(161) })).toBeNull();
  });

  it("refuses a query that is not an object at all", () => {
    expect(parseParkingQuery(null)).toBeNull();
    expect(parseParkingQuery("lat=54")).toBeNull();
  });
});

describe("saying which car park is confirmed", () => {
  it("calls everything a lookup when nothing has been confirmed", () => {
    const pins = markConfirmed([candidate(), candidate({ placeId: "N2", distanceM: 3000 })], null, SCAFELL);
    expect(pins.map(p => p.status)).toEqual(["internet_lookup", "internet_lookup"]);
  });

  it("confirms only the car park that actually matches the record", () => {
    const pins = markConfirmed(
      [candidate({ placeId: "N1" }), candidate({ placeId: "N2", distanceM: 500 })],
      { placeId: "N2", label: "Wasdale Head NT", lat: 54.46, lng: -3.28 },
      SCAFELL,
    );
    const byId = new Map(pins.map(p => [p.placeId, p.status]));
    expect(byId.get("N2")).toBe("gps_confirmed");
    /* The neighbouring car park gains nothing from being nearby. */
    expect(byId.get("N1")).toBe("internet_lookup");
  });

  it("puts the confirmed car park first, ahead of nearer guesses", () => {
    const pins = markConfirmed(
      [candidate({ placeId: "N1", distanceM: 200 }), candidate({ placeId: "N2", distanceM: 4000 })],
      { placeId: "N2", label: "Honister", lat: 54.51, lng: -3.21 },
      SCAFELL,
    );
    expect(pins[0]!.placeId).toBe("N2");
    expect(pins[0]!.status).toBe("gps_confirmed");
  });

  it("keeps the confirmed car park even when the search did not return it", () => {
    /* The search box moves and OSM data changes. Losing the only verified
       car park because today's lookup missed it is the worst outcome here. */
    const pins = markConfirmed(
      [candidate({ placeId: "N1" })],
      { placeId: "N9", label: "Wasdale Head NT", lat: 54.457, lng: -3.29 },
      SCAFELL,
    );
    expect(pins.map(p => p.placeId)).toContain("N9");
    expect(pins.find(p => p.placeId === "N9")!.status).toBe("gps_confirmed");
    expect(pins[0]!.placeId).toBe("N9");
  });

  it("works out how far away a re-added confirmed car park is", () => {
    const pins = markConfirmed([], { placeId: "N9", label: "NT", lat: 54.5, lng: -3.3 }, SCAFELL);
    expect(pins[0]!.distanceM).toBeGreaterThan(1000);
    expect(pins[0]!.distanceM).toBeLessThan(12_000);
  });

  it("names a confirmed car park after the hill when the record has no label", () => {
    const pins = markConfirmed([], { placeId: "N9", label: "  ", lat: 54.46, lng: -3.28 }, SCAFELL);
    expect(pins[0]!.name).toBe("Parking for Scafell Pike");
  });

  it("ignores a confirmed record with no usable position", () => {
    const pins = markConfirmed([candidate()], { placeId: "N9", label: "NT", lat: null, lng: null }, SCAFELL);
    expect(pins).toHaveLength(1);
    expect(pins[0]!.status).toBe("internet_lookup");
  });

  it("drops a car park too far away to be this hill's", () => {
    const pins = markConfirmed(
      [candidate({ placeId: "N1", distanceM: 500 }),
       candidate({ placeId: "N2", distanceM: MAX_PARKING_DISTANCE_M + 1 })],
      null, SCAFELL,
    );
    expect(pins.map(p => p.placeId)).toEqual(["N1"]);
  });

  it("shows the nearest few rather than every car park in the county", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      candidate({ placeId: `N${i + 1}`, distanceM: (i + 1) * 100 }));
    const pins = markConfirmed(many, null, SCAFELL);
    expect(pins).toHaveLength(MAX_PARKING);
    expect(pins[0]!.placeId).toBe("N1");
    expect(pins.at(-1)!.placeId).toBe(`N${MAX_PARKING}`);
  });

  it("returns nothing when there is nothing to return", () => {
    expect(markConfirmed([], null, SCAFELL)).toEqual([]);
  });
});
