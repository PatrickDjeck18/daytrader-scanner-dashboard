import { describe, expect, it } from "vitest";
import { getCryptoNewsDisplayState } from "./BinanceDashboard";

describe("Binance public crypto news display state", () => {
  it("keeps loading, available, and unavailable states distinct", () => {
    expect(getCryptoNewsDisplayState(undefined, true)).toBe("loading");
    expect(getCryptoNewsDisplayState({ availability: "available", items: [{}] }, false)).toBe("available");
    expect(getCryptoNewsDisplayState({ availability: "unavailable", items: [] }, false)).toBe("unavailable");
  });
});
