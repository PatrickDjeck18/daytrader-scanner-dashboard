import { afterEach, describe, expect, it, vi } from "vitest";
import { massiveNews } from "./massive";

describe("Massive provider errors", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("surfaces a useful error when the news endpoint rejects", async () => {
    process.env.MASSIVE_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 })));
    await expect(massiveNews("AAPL", 1)).rejects.toThrow(/401/);
  });
});
