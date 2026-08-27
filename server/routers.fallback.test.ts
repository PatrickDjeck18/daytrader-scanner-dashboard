import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { resetBarsRateLimitForTests, resetRealtimeDenialForTests } from "./massive";
import { resetRateLimitsForTests } from "./production";
import type { TrpcContext } from "./_core/context";

const context: TrpcContext = {
  user: undefined,
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

describe("market.quotes fallback query path", () => {
  afterEach(() => { vi.unstubAllGlobals(); resetRealtimeDenialForTests(); resetBarsRateLimitForTests(); resetRateLimitsForTests(); });
  it.each([401, 403])("resolves with unavailable quotes rather than a tRPC rejection on %s", async status => {
    process.env.MASSIVE_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(status === 401 ? "unauthorized" : "forbidden", { status })));
    const result = await appRouter.createCaller(context).market.quotes({ symbols: ["IONQ", "BBAI"] });
    expect(result).toHaveLength(2);
    expect(result.map(item => item.source)).toEqual(["unavailable", "unavailable"]);
    expect(result.every(item => item.providerError?.includes(String(status)))).toBe(true);
  });
  it("resolves fallback quotes through the router when Massive fetch rejects", async () => {
    process.env.MASSIVE_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const result = await appRouter.createCaller(context).market.quotes({ symbols: ["IONQ"] });
    expect(result[0]?.source).toBe("unavailable");
    expect(result[0]?.providerError).toMatch(/fetch failed/);
  });

  it("resolves bars to an empty chart state rather than rejecting tRPC on Massive 429", async () => {
    const finnhubKey = process.env.FINNHUB_API_KEY;
    delete process.env.FINNHUB_API_KEY;
    process.env.MASSIVE_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })));
    await expect(appRouter.createCaller(context).market.bars({ symbol: "SMCI", from: "2026-08-22", to: "2026-08-22" })).resolves.toEqual([]);
    process.env.FINNHUB_API_KEY = finnhubKey;
  });

  it("resolves the local bars limiter to an empty chart state rather than rejecting tRPC", async () => {
    const finnhubKey = process.env.FINNHUB_API_KEY;
    delete process.env.FINNHUB_API_KEY;
    process.env.MASSIVE_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })));
    const rateLimitedContext: TrpcContext = { user: undefined, req: { ip: "bars-rate-limit-test" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    const caller = appRouter.createCaller(rateLimitedContext);
    for (let attempt = 0; attempt < 11; attempt += 1) await expect(caller.market.bars({ symbol: "SMCI", from: "2026-08-22", to: "2026-08-22" })).resolves.toEqual([]);
    process.env.FINNHUB_API_KEY = finnhubKey;
  });

  it("resolves the local symbol-directory limiter to an empty list rather than rejecting tRPC", async () => {
    const finnhubKey = process.env.FINNHUB_API_KEY;
    delete process.env.FINNHUB_API_KEY;
    const rateLimitedContext: TrpcContext = { user: undefined, req: { ip: "symbols-rate-limit-test" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    const caller = appRouter.createCaller(rateLimitedContext);
    for (let attempt = 0; attempt < 6; attempt += 1) await expect(caller.market.symbols()).resolves.toEqual([]);
    process.env.FINNHUB_API_KEY = finnhubKey;
  });
});
