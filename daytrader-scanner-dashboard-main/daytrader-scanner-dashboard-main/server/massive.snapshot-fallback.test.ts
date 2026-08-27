import { afterEach, describe, expect, it, vi } from "vitest";
import { massiveProvider, resetRealtimeDenialForTests } from "./massive";

describe("Massive snapshot fallback", () => {
  afterEach(() => { vi.unstubAllGlobals(); resetRealtimeDenialForTests(); });
  it.each([401, 403])("returns an unavailable quote for Massive status %s", async status => {
    process.env.MASSIVE_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(status === 401 ? "unauthorized" : "forbidden", { status })));
    const quotes = await massiveProvider.getQuotes(["IONQ", "BBAI"]);
    expect(quotes).toHaveLength(2);
    expect(quotes.every(quote => quote.source === "unavailable")).toBe(true);
    expect(quotes[0]?.providerError).toMatch(String(status));
  });
});
