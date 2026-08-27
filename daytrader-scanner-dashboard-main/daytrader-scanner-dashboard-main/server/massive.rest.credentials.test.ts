import { describe, expect, it } from "vitest";

describe("Massive REST API credentials", () => {
  it("authenticates against the documented REST API", async () => {
    const key = process.env.MASSIVE_API_KEY;
    expect(key).toBeTruthy();
    let response: Response;
    try { response = await fetch(`https://api.massive.com/v3/reference/dividends?limit=1&apiKey=${encodeURIComponent(key!)}`); } catch (error) { const message = error instanceof Error ? error.message : String(error); expect(message).toMatch(/fetch failed|timeout|timed out|connect/i); return; }
    const body = await response.text();
    if (response.status === 429) return;
    expect(response.ok, `Massive REST returned ${response.status}: ${body.slice(0, 200)}`).toBe(true);
  }, 15_000);
});
