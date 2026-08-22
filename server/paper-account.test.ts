import { describe, expect, it } from "vitest";
import { buildDeepSeekLearningLedger, calculatePaperPnl, simulatePaperFill } from "./db";

describe("paper account P&L", () => {
  it("fills market orders at the current mark and leaves non-crossed limits resting", () => {
    expect(simulatePaperFill({ side: "buy", orderType: "market", markPrice: 101 })).toEqual({ status: "filled", fillPrice: 101 });
    expect(simulatePaperFill({ side: "buy", orderType: "limit", limitPrice: "100", markPrice: 101 })).toEqual({ status: "submitted", fillPrice: undefined });
    expect(simulatePaperFill({ side: "sell", orderType: "limit", limitPrice: "100", markPrice: 101 })).toEqual({ status: "filled", fillPrice: 101 });
  });

  it("calculates realized and unrealized P&L from filled orders", () => {
    const result = calculatePaperPnl([
      { symbol: "AAPL", side: "buy", quantity: "10", fillPrice: "100" },
      { symbol: "AAPL", side: "sell", quantity: "4", fillPrice: "110", status: "filled" },
      { symbol: "AAPL", side: "buy", quantity: "100", fillPrice: null, status: "submitted" },
    ], { AAPL: 115 });
    expect(result.realizedPnl).toBe(40);
    expect(result.unrealizedPnl).toBe(90);
    expect(result.totalPnl).toBe(130);
    expect(result.positions[0]).toMatchObject({ symbol: "AAPL", quantity: 6, averageCost: 100 });
  });

  it("keeps a Learning Mode entry open until a persisted simulated exit closes it", () => {
    const ledger = buildDeepSeekLearningLedger([{ id: 1, symbol: "BTCUSDT", side: "buy", quantity: "0.5", fillPrice: "100", source: "deepseek-learning-paper-bot", createdAt: new Date("2026-08-22T10:00:00Z") }]);
    expect(ledger.summary).toMatchObject({ orders: 1, closedTrades: 0, wins: 0, losses: 0, realizedPnl: 0 });
    expect(ledger.openPositions).toEqual([expect.objectContaining({ symbol: "BTCUSDT", quantity: .5, entryAmount: 50 })]);
    expect(ledger.orders[0]).toMatchObject({ status: "open", amount: 50, realizedPnl: null });
  });

  it("matches Learning Mode exits FIFO and separates realized simulated wins from losses", () => {
    const ledger = buildDeepSeekLearningLedger([
      { id: 1, symbol: "BTCUSDT", side: "buy", quantity: "2", fillPrice: "100", source: "deepseek-learning-paper-bot", createdAt: new Date("2026-08-22T10:00:00Z") },
      { id: 2, symbol: "BTCUSDT", side: "sell", quantity: "1", fillPrice: "110", source: "deepseek-learning-paper-bot", createdAt: new Date("2026-08-22T10:01:00Z") },
      { id: 3, symbol: "BTCUSDT", side: "sell", quantity: "1", fillPrice: "90", source: "deepseek-learning-paper-bot", createdAt: new Date("2026-08-22T10:02:00Z") },
      { id: 4, symbol: "ETHUSDT", side: "buy", quantity: "1", fillPrice: "50", source: "deepseek-learning-paper-bot", createdAt: new Date("2026-08-22T10:03:00Z") },
      { id: 5, symbol: "SOLUSDT", side: "buy", quantity: "1", fillPrice: "0", source: "deepseek-learning-paper-bot", createdAt: new Date("2026-08-22T10:04:00Z") },
      { id: 6, symbol: "BTCUSDT", side: "buy", quantity: "1", fillPrice: "120", source: "manual-paper-order", createdAt: new Date("2026-08-22T10:05:00Z") },
    ]);
    expect(ledger.summary).toMatchObject({ orders: 5, closedTrades: 2, wins: 1, losses: 1, realizedPnl: 0 });
    expect(ledger.closedTrades.map(trade => ({ outcome: trade.outcome, entryAmount: trade.entryAmount, exitAmount: trade.exitAmount, realizedPnl: trade.realizedPnl }))).toEqual([{ outcome: "win", entryAmount: 100, exitAmount: 110, realizedPnl: 10 }, { outcome: "loss", entryAmount: 100, exitAmount: 90, realizedPnl: -10 }]);
    expect(ledger.orders.find(order => order.id === 2)).toMatchObject({ status: "exit", amount: 110, realizedPnl: 10 });
    expect(ledger.orders.find(order => order.id === 3)).toMatchObject({ status: "exit", amount: 90, realizedPnl: -10 });
    expect(ledger.orders.find(order => order.id === 4)).toMatchObject({ status: "open", amount: 50, realizedPnl: null });
    expect(ledger.orders.find(order => order.id === 5)).toMatchObject({ amount: 0, realizedPnl: null });
  });
});
