import { describe, expect, it } from "vitest";
import { getPaperBotDisplayState } from "./BinancePaperBot";

describe("BinancePaperBot display state", () => {
  it("labels a new account as ready, an enabled config as scheduled, and historical activity as paused", () => {
    expect(getPaperBotDisplayState(undefined)).toBe("loading");
    expect(getPaperBotDisplayState({ enabled: 0, orders: [] })).toBe("ready");
    expect(getPaperBotDisplayState({ enabled: 1, orders: [] })).toBe("scheduled");
    expect(getPaperBotDisplayState({ enabled: 0, orders: [{ id: 1 }] })).toBe("paused");
  });
});
