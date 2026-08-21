import { describe, expect, it } from "vitest";
import { getFreePlanUiState } from "./Home";

describe("free-plan dashboard state", () => {
  it("shows the entitlement banner when live snapshots are unavailable", () => {
    expect(getFreePlanUiState({ demoMode: false, liveDataReady: false, planRestricted: true })).toEqual({ banner: "FREE PLAN · REAL-TIME UNAVAILABLE", showSeededMarketValues: false });
  });

  it("never permits seeded market values in live-only mode", () => {
    expect(getFreePlanUiState({ demoMode: false, liveDataReady: false, planRestricted: true }).showSeededMarketValues).toBe(false);
    expect(getFreePlanUiState({ demoMode: true, liveDataReady: false, planRestricted: true }).showSeededMarketValues).toBe(true);
  });
});
