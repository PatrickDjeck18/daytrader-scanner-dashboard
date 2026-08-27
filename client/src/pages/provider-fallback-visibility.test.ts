import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const pageSource = async (fileName: string) => readFile(new URL(`./${fileName}`, import.meta.url), "utf8");

describe("provider fallback visibility", () => {
  it("keeps the U.S. market dashboard clear when real-time provider data is unavailable", async () => {
    const source = await pageSource("Home.tsx");

    expect(source).toContain("LIVE DATA UNAVAILABLE");
    expect(source).toContain("FINNHUB QUOTES UNAVAILABLE");
    expect(source).toContain("no fabricated prices are shown");
    expect(source).toContain("news is temporarily unavailable");
  });

  it("keeps the crypto news panel clear when its public feed is unavailable", async () => {
    const source = await pageSource("BinanceDashboard.tsx");

    expect(source).toContain("Public crypto news is currently unavailable");
    expect(source).toContain("No generated headlines are shown");
  });
});
