import { describe, expect, it } from "vitest";
import {
  formatElevationBankMetres,
  getElevationBankPresentation,
} from "./elevationBankPresentation";

const response = {
  status: "available" as const,
  lifetimeAscentM: 1_240,
  periodAscentM: 300,
  creditedActivities: 2,
  everestEquivalent: 0.1,
  recentCredits: [],
};

describe("Elevation Bank mobile presentation states", () => {
  it("keeps loading and unavailable states explicit", () => {
    expect(getElevationBankPresentation({ isLoading: true, isError: false })).toEqual({ kind: "loading" });
    expect(getElevationBankPresentation({ isLoading: false, isError: true })).toEqual({ kind: "unavailable" });
    expect(getElevationBankPresentation({ isLoading: false, isError: false })).toEqual({ kind: "unavailable" });
    expect(getElevationBankPresentation({
      isLoading: false,
      isError: false,
      data: {
        status: "unavailable",
        reason: "development_dependency_unavailable",
      },
    })).toEqual({ kind: "unavailable" });
  });

  it("does not substitute legacy totals for an empty ledger", () => {
    expect(getElevationBankPresentation({
      isLoading: false,
      isError: false,
      data: { ...response, lifetimeAscentM: 0, periodAscentM: 0, creditedActivities: 0 },
    })).toEqual({ kind: "empty" });
  });

  it("shows only ledger-backed totals and correction-capable recent rows", () => {
    const ready = getElevationBankPresentation({ isLoading: false, isError: false, data: response });
    expect(ready).toEqual({ kind: "ready", data: response });
    expect(formatElevationBankMetres(response.lifetimeAscentM)).toBe("1,240m");
  });
});