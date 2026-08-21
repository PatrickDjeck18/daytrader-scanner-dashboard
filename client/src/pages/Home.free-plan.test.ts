import { describe, expect, it } from "vitest";
import { getFreePlanUiState, getNewsItemKey } from "./Home";

describe("free-plan dashboard state", () => {
  it("shows the entitlement banner when live snapshots are unavailable", () => {
    expect(getFreePlanUiState({ demoMode: false, liveDataReady: false, planRestricted: true })).toEqual({ banner: "FREE PLAN · REAL-TIME UNAVAILABLE", showSeededMarketValues: false });
  });

  it("never permits seeded market values in live-only mode", () => {
    expect(getFreePlanUiState({ demoMode: false, liveDataReady: false, planRestricted: true }).showSeededMarketValues).toBe(false);
    expect(getFreePlanUiState({ demoMode: true, liveDataReady: false, planRestricted: true }).showSeededMarketValues).toBe(true);
  });

  it("generates unique keys for duplicate-time catalyst items", () => {
    const item = { time: "08:05 PM", symbol: "SMCI" };
    expect(getNewsItemKey(item, 0)).not.toBe(getNewsItemKey(item, 1));
  });
});
