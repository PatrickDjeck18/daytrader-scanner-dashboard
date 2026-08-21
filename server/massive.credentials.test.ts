import { describe, expect, it } from "vitest";

describe("Massive credentials", () => {
  it("authenticates against the official lightweight news endpoint", async () => {
    const key = process.env.MASSIVE_API_KEY;
    expect(key, "MASSIVE_API_KEY must be configured").toBeTruthy();
    const response = await fetch(`https://api.massive.com/v2/reference/news?ticker=AAPL&limit=1&apiKey=${encodeURIComponent(key ?? "")}`);
    const responseText = await response.text();
    expect(response.status, responseText).toBe(200);
    const body = JSON.parse(responseText) as { results?: unknown[] };
    expect(Array.isArray(body.results)).toBe(true);
  }, 20_000);
});
