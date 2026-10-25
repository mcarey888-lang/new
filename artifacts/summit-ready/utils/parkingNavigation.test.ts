import { describe, expect, it } from "vitest";
import { parkingNavigationUrls } from "./parkingNavigation";

const point = { lat: 54.46, lng: -3.28, name: "Wasdale Head", provider: "default" };
describe("external parking navigation", () => {
  it("uses the Android maps handler rather than forcing Google for the default choice", () => {
    const urls = parkingNavigationUrls(point, "android")!;
    expect(urls.native).toMatch(/^geo:/);
    expect(decodeURIComponent(urls.native)).toContain("54.46,-3.28(Wasdale Head)");
    expect(urls.fallback).toContain("destination=54.46%2C-3.28");
  });
  it("opens iOS maps with a driving destination", () => {
    expect(parkingNavigationUrls(point, "ios")!.native).toBe("maps://?daddr=54.46%2C-3.28&dirflg=d");
  });
  it("supports explicit Google Maps and Waze choices with web fallbacks", () => {
    expect(parkingNavigationUrls({ ...point, provider: "google" }, "android")!.native).toContain("google.navigation:");
    expect(parkingNavigationUrls({ ...point, provider: "google" }, "ios")!.native).toContain("comgooglemaps:");
    const waze = parkingNavigationUrls({ ...point, provider: "waze" }, "ios")!;
    expect(waze.native).toBe("waze://?ll=54.46%2C-3.28&navigate=yes");
    expect(waze.fallback).toBe("https://www.waze.com/ul?ll=54.46%2C-3.28&navigate=yes");
  });
  it("rejects malformed or arbitrary navigation messages", () => {
    for (const patch of [
      { lat: NaN }, { lat: 91 }, { lng: -181 }, { lat: "54" },
      { provider: "javascript:alert(1)" }, { name: "" }, { name: "x".repeat(201) },
    ]) expect(parkingNavigationUrls({ ...point, ...patch }, "android")).toBeNull();
  });
  it("uses external HTTPS destinations on web", () => {
    expect(parkingNavigationUrls(point, "web")!.native).toMatch(/^https:/);
    expect(parkingNavigationUrls({ ...point, provider: "waze" }, "web")!.native).toMatch(/^https:/);
  });
});
