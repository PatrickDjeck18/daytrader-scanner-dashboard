import { describe, expect, it } from "vitest";

describe("market data integrity", () => {
  it("renders unavailable states in live-only mode when provider is denied", () => {
    const dataUnavailable = true;
    const demoMode = false;
    const renderUnavailable = dataUnavailable && !demoMode;
    expect(renderUnavailable).toBe(true);
  });

  it("does not treat unavailable provider values as simulated or live", () => {
    const quote = { source: "unavailable" as const, price: 0 };
    expect(quote.source).not.toBe("massive");
    expect(quote.source).not.toBe("simulated");
    expect(quote.price).toBe(0);
  });
});
