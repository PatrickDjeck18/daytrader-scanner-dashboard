import { describe, expect, it } from "vitest";
import { buildPaperActivityMarkers, getLatestNextCandleForecast } from "./PaperBotActivityChart";

describe("paper-bot live activity markers", () => {
  it("maps simulated entries, stop and target levels, and no-trade holds to one configured pair", () => {
    const at = "2026-08-22T10:00:00.000Z";
    const markers = buildPaperActivityMarkers({
      symbol: "BTCUSDT",
      orders: [{ id: 7, symbol: "BTCUSDT", side: "buy", fillPrice: "100", stopPrice: "99", targetPrice: "103", createdAt: at }],
      runs: [{ id: 11, status: "hold", decision: JSON.stringify({ symbol: "BTCUSDT", reason: "No simulated order was created" }), marketContext: JSON.stringify({ contexts: [{ symbol: "BTCUSDT", quote: { price: 100 } }] }), createdAt: at }],
    });
    expect(markers.map(marker => marker.type).sort()).toEqual(["entry", "hold", "stop", "target"]);
    expect(markers.find(marker => marker.type === "entry")?.price).toBe(100);
    expect(markers.find(marker => marker.type === "hold")?.detail).toContain("No simulated order");
  });

  it("does not place a marker from another configured pair", () => {
    const markers = buildPaperActivityMarkers({ symbol: "BTCUSDT", orders: [{ id: 8, symbol: "ETHUSDT", side: "buy", fillPrice: "100", createdAt: "2026-08-22T10:00:00.000Z" }], runs: [] });
    expect(markers).toEqual([]);
  });

  it("extracts the latest valid experimental next-candle estimate only for the active pair", () => {
    const runs = [
      { id: 22, status: "hold", decision: JSON.stringify({ symbol: "BTCUSDT", nextCandle: { direction: "up", probability: .64, reason: "1m momentum is positive" } }), createdAt: "2026-08-22T10:03:00.000Z" },
      { id: 21, status: "hold", decision: JSON.stringify({ symbol: "ETHUSDT", nextCandle: { direction: "down", probability: .7, reason: "Different configured pair" } }), createdAt: "2026-08-22T10:04:00.000Z" },
    ];
    expect(getLatestNextCandleForecast({ symbol: "BTCUSDT", runs })).toMatchObject({ runId: 22, direction: "up", probability: .64, reason: "1m momentum is positive" });
    expect(getLatestNextCandleForecast({ symbol: "SOLUSDT", runs })).toBeUndefined();
  });
});
