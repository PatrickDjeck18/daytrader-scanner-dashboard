import { describe, expect, it } from "vitest";
import { normalizeMinute, normalizeQuote } from "./massive";

describe("Massive adapter", () => {
  it("normalizes NBBO quote events", () => {
    expect(normalizeQuote({ ev: "Q", sym: "AAPL", bp: 199.9, ap: 200, bs: 4, as: 6, t: 123 })).toMatchObject({ symbol: "AAPL", price: 200, bid: 199.9, ask: 200, lastUpdated: 123 });
  });

  it("normalizes minute aggregate events and preserves VWAP/session timestamps", () => {
    expect(normalizeMinute({ ev: "AM", sym: "AAPL", o: 198, c: 200, h: 201, l: 197, v: 12000, vw: 199.2, s: 1000, e: 69999 })).toEqual({ symbol: "AAPL", open: 198, close: 200, high: 201, low: 197, volume: 12000, vwap: 199.2, start: 1000, end: 69999 });
  });
});
