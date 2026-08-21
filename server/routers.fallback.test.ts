import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const context: TrpcContext = {
  user: undefined,
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

describe("market.quotes fallback query path", () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each([401, 403])("resolves with simulated quotes rather than a tRPC rejection on %s", async status => {
    process.env.MASSIVE_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(status === 401 ? "unauthorized" : "forbidden", { status })));
    const result = await appRouter.createCaller(context).market.quotes({ symbols: ["IONQ", "BBAI"] });
    expect(result).toHaveLength(2);
    expect(result.map(item => item.source)).toEqual(["simulated", "simulated"]);
    expect(result.every(item => item.providerError?.includes(String(status)))).toBe(true);
  });
});
