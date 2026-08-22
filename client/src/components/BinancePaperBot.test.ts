import { describe, expect, it } from "vitest";
import { getPaperBotDisplayState, getScalpObservationDisplayState } from "./BinancePaperBot";

describe("BinancePaperBot display state", () => {
  it("labels a new account as ready, an enabled config as scheduled, and historical activity as paused", () => {
    expect(getPaperBotDisplayState(undefined)).toBe("loading");
    expect(getPaperBotDisplayState({ enabled: 0, orders: [] })).toBe("ready");
    expect(getPaperBotDisplayState({ enabled: 1, orders: [] })).toBe("scheduled");
    expect(getPaperBotDisplayState({ enabled: 0, orders: [{ id: 1 }] })).toBe("paused");
  });

  it("shows the live observation state only when all three provider-backed context windows are available", () => {
    expect(getScalpObservationDisplayState(undefined)).toBe("unavailable");
    expect(getScalpObservationDisplayState({ availability: "live", oneMinute: { bars: 40 }, fiveMinute: { bars: 40 }, fifteenMinute: { bars: 40 } })).toBe("live");
    expect(getScalpObservationDisplayState({ availability: "live", oneMinute: { bars: 40 }, fiveMinute: { bars: 0 }, fifteenMinute: { bars: 40 } })).toBe("unavailable");
  });
});
