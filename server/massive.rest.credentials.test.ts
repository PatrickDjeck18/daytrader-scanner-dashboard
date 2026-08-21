import { describe, expect, it } from "vitest";

describe("Massive REST API credentials", () => {
  it("authenticates against the documented REST API", async () => {
    const key = process.env.MASSIVE_API_KEY;
    expect(key).toBeTruthy();
    const response = await fetch(`https://api.massive.com/v3/reference/dividends?limit=1&apiKey=${encodeURIComponent(key!)}`);
    const body = await response.text();
    expect(response.ok, `Massive REST returned ${response.status}: ${body.slice(0, 200)}`).toBe(true);
  }, 15_000);
});
