import { describe, expect, it } from "vitest";
import { assertPaperOnlyOrder, replayBars, runScannerBacktest } from "./backtest";

const bars = [
  { timestamp: 3, open: 10, high: 12, low: 9, close: 11, volume: 300 },
  { timestamp: 1, open: 9, high: 10, low: 8, close: 9, volume: 100 },
  { timestamp: 2, open: 9, high: 11, low: 8, close: 10, volume: 200 },
];

describe("replay and backtesting", () => {
  it("sorts replay bars deterministically and scales delays", () => {
    expect(replayBars(bars, 2).map(bar => bar.timestamp)).toEqual([1, 2, 3]);
    expect(replayBars(bars, 2)[1]?.delayMs).toBe(1);
  });

  it("returns deterministic P&L metrics", () => {
    const orderedBars = replayBars(bars).map(({ replayIndex: _replayIndex, delayMs: _delayMs, ...bar }) => bar);
    const result = runScannerBacktest(orderedBars, { minChangePct: 5, minRvol: 1.5, initialCapital: 1000, positionSize: 500 });
    expect(result.entries).toBe(1);
    expect(result.finalEquity).toBeGreaterThan(1000);
  });

  it("includes configured slippage and fees in the result metadata", () => {
    const orderedBars = replayBars(bars).map(({ replayIndex: _replayIndex, delayMs: _delayMs, ...bar }) => bar);
    const result = runScannerBacktest(orderedBars, { minChangePct: 5, minRvol: 1.5, initialCapital: 1000, positionSize: 500, slippageBps: 25, feePerTrade: 2 });
    expect(result.slippageBps).toBe(25);
    expect(result.feePerTrade).toBe(2);
    expect(result.dataStart).toBe(1);
    expect(result.dataEnd).toBe(3);
  });

  it("rejects live execution", () => {
    expect(assertPaperOnlyOrder("paper")).toBe(true);
    expect(() => assertPaperOnlyOrder("live")).toThrow(/disabled/);
  });
});
