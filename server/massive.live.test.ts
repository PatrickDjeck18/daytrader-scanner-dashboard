import { describe, expect, it } from "vitest";
import { massiveProvider } from "./massive";

describe("Massive live snapshot", () => {
  it("reports live snapshot capability without fabricating a quote", async () => {
    const quotes = await massiveProvider.getQuotes(["IONQ"]);
    expect(quotes).toHaveLength(1);
    if (quotes[0]?.source === "massive") {
      expect(quotes[0].price).toBeGreaterThan(0);
      expect(quotes[0].lastUpdated).toBeGreaterThan(0);
    } else {
      expect(quotes[0]?.source).toBe("unavailable");
      expect(quotes[0]?.providerError).toBeTruthy();
    }
  }, 15_000);
});
