import { describe, expect, it } from "vitest";
import { calculatePaperPnl } from "./db";

describe("paper account P&L", () => {
  it("calculates realized and unrealized P&L from filled orders", () => {
    const result = calculatePaperPnl([
      { symbol: "AAPL", side: "buy", quantity: "10", fillPrice: "100" },
      { symbol: "AAPL", side: "sell", quantity: "4", fillPrice: "110" },
    ], { AAPL: 115 });
    expect(result.realizedPnl).toBe(40);
    expect(result.unrealizedPnl).toBe(90);
    expect(result.totalPnl).toBe(130);
    expect(result.positions[0]).toMatchObject({ symbol: "AAPL", quantity: 6, averageCost: 100 });
  });
});
