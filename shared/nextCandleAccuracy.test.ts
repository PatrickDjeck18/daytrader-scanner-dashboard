import { describe, expect, it } from "vitest";
import type { CryptoBar } from "./crypto";
import {
  buildNextCandleAccuracySummary,
  extractNextCandlePredictions,
  isPredictionCorrect,
  MIN_SCORED_PROBABILITY,
  NEXT_CANDLE_FLAT_THRESHOLD_PCT,
  resolveActualCandleDirection,
  scoreNextCandlePrediction,
  targetBarStartMs,
} from "./nextCandleAccuracy";

const bar = (start: number, open: number, close: number, closed = true): CryptoBar => ({
  symbol: "BTCUSDT",
  start,
  end: start + 59_999,
  open,
  high: Math.max(open, close),
  low: Math.min(open, close),
  close,
  volume: 10,
  quoteVolume: 100,
  closed,
});

describe("next-candle accuracy tracking", () => {
  it("targets the first full 1m bar after the prediction timestamp", () => {
    expect(targetBarStartMs(Date.parse("2026-08-22T10:03:45.000Z"))).toBe(Date.parse("2026-08-22T10:04:00.000Z"));
    expect(targetBarStartMs(Date.parse("2026-08-22T10:04:00.000Z"))).toBe(Date.parse("2026-08-22T10:04:00.000Z"));
  });

  it("classifies candle direction with a widened flat threshold (0.05%)", () => {
    // These tiny moves are now flat (were borderline at the old 0.02% threshold)
    expect(resolveActualCandleDirection({ open: 100, close: 100.01 })).toBe("flat"); // +0.01%
    expect(resolveActualCandleDirection({ open: 100, close: 100.04 })).toBe("flat"); // +0.04%
    // Above the flat band
    expect(resolveActualCandleDirection({ open: 100, close: 100.06 })).toBe("up");   // +0.06%
    expect(resolveActualCandleDirection({ open: 100, close: 99.94 })).toBe("down");  // -0.06%
    // Verify the exported constant matches the default
    expect(NEXT_CANDLE_FLAT_THRESHOLD_PCT).toBe(0.05);
  });

  it("extracts only valid next-candle predictions for the active symbol", () => {
    const runs = [
      {
        id: 1,
        createdAt: "2026-08-22T10:03:00.000Z",
        completedAt: "2026-08-22T10:03:01.000Z",
        decision: JSON.stringify({ symbol: "BTCUSDT", nextCandle: { direction: "down", probability: 0.68, reason: "below VWAP" } }),
      },
      {
        id: 2,
        createdAt: "2026-08-22T10:04:00.000Z",
        completedAt: "2026-08-22T10:04:01.000Z",
        decision: JSON.stringify({ symbol: "ETHUSDT", nextCandle: { direction: "up", probability: 0.7, reason: "momentum" } }),
      },
      {
        id: 3,
        createdAt: "2026-08-22T10:05:00.000Z",
        completedAt: "2026-08-22T10:05:01.000Z",
        decision: JSON.stringify({ symbol: "BTCUSDT", nextCandle: { direction: "up", probability: 1.2, reason: "invalid probability" } }),
      },
    ];

    expect(extractNextCandlePredictions(runs, "BTCUSDT")).toHaveLength(1);
    expect(extractNextCandlePredictions(runs, "BTCUSDT")[0]).toMatchObject({ runId: 1, direction: "down", probability: 0.68 });
  });

  it("scores correct, incorrect, pending, and unresolved outcomes", () => {
    const predictedAt = Date.parse("2026-08-22T10:03:45.000Z");
    const targetStart = targetBarStartMs(predictedAt)!;
    const prediction = {
      runId: 9,
      symbol: "BTCUSDT",
      predictedAt,
      direction: "down" as const,
      probability: 0.68, // above MIN_SCORED_PROBABILITY
      reason: "below VWAP",
    };

    expect(scoreNextCandlePrediction(prediction, [bar(targetStart, 100, 99.9)], Date.parse("2026-08-22T10:05:00.000Z"))).toMatchObject({
      outcome: "correct",
      actualDirection: "down",
    });

    expect(scoreNextCandlePrediction(prediction, [bar(targetStart, 100, 100.1)], Date.parse("2026-08-22T10:05:00.000Z"))).toMatchObject({
      outcome: "incorrect",
      actualDirection: "up",
    });

    expect(scoreNextCandlePrediction(prediction, [bar(targetStart, 100, 99.9, false)], Date.parse("2026-08-22T10:04:30.000Z"))).toMatchObject({
      outcome: "pending",
    });

    expect(scoreNextCandlePrediction(prediction, [], Date.parse("2026-08-22T10:05:00.000Z"))).toMatchObject({
      outcome: "unresolved",
    });
  });

  it("grace window: flat candle that drifted in the predicted direction counts as correct", () => {
    // predicted "down", candle closed -0.008% (flat-negative) → correct
    expect(isPredictionCorrect("down", "flat", -0.008)).toBe(true);
    // predicted "up", candle closed +0.008% (flat-positive) → correct
    expect(isPredictionCorrect("up", "flat", +0.008)).toBe(true);
    // predicted "down", candle closed +0.001% (flat-positive) → wrong direction
    expect(isPredictionCorrect("down", "flat", +0.001)).toBe(false);
    // predicted "up", candle was genuinely down → always incorrect
    expect(isPredictionCorrect("up", "down")).toBe(false);
    // exact match still works
    expect(isPredictionCorrect("flat", "flat")).toBe(true);
  });

  it("low-confidence predictions (< MIN_SCORED_PROBABILITY) are excluded from scoring", () => {
    const predictedAt = Date.parse("2026-08-22T10:03:45.000Z");
    const targetStart = targetBarStartMs(predictedAt)!;
    const lowConf = {
      runId: 99,
      symbol: "BTCUSDT",
      predictedAt,
      direction: "up" as const,
      probability: 0.55, // below 0.65 threshold
      reason: "weak signal",
    };
    const result = scoreNextCandlePrediction(lowConf, [bar(targetStart, 100, 101)], Date.parse("2026-08-22T10:05:00.000Z"));
    // Should be excluded from accuracy (unresolved), even though the bar is available and closed
    expect(result.outcome).toBe("unresolved");
    expect(MIN_SCORED_PROBABILITY).toBe(0.65);
  });

  it("summarizes accuracy for all stored predictions on a symbol", () => {
    const runs = [
      {
        id: 10,
        createdAt: "2026-08-22T10:03:00.000Z",
        completedAt: "2026-08-22T10:03:01.000Z",
        decision: JSON.stringify({ symbol: "BTCUSDT", nextCandle: { direction: "down", probability: 0.68, reason: "below VWAP" } }),
      },
      {
        id: 11,
        createdAt: "2026-08-22T10:04:10.000Z",
        completedAt: "2026-08-22T10:04:11.000Z",
        decision: JSON.stringify({ symbol: "BTCUSDT", nextCandle: { direction: "up", probability: 0.72, reason: "momentum" } }),
      },
    ];

    const bars = [
      bar(targetBarStartMs(Date.parse("2026-08-22T10:03:01.000Z"))!, 100, 99.9),
      bar(targetBarStartMs(Date.parse("2026-08-22T10:04:11.000Z"))!, 100, 100.06),
    ];

    const summary = buildNextCandleAccuracySummary({
      runs,
      bars,
      symbol: "BTCUSDT",
      now: Date.parse("2026-08-22T10:10:00.000Z"),
    });

    expect(summary.scored).toBe(2);
    expect(summary.correct).toBe(2);
    expect(summary.accuracyPct).toBe(100);
    expect(isPredictionCorrect("flat", "flat")).toBe(true);
  });
});

