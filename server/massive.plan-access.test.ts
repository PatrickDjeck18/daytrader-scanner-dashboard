import { afterEach, describe, expect, it, vi } from "vitest";
import { massiveProvider, resetRealtimeDenialForTests } from "./massive";

describe("Massive Stocks Basic plan access", () => {
  afterEach(() => { vi.unstubAllGlobals(); resetRealtimeDenialForTests(); });

  it("stops repeated snapshot polling after a documented 403 entitlement denial", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const first = await massiveProvider.getQuotes(["IONQ"]);
    expect(first[0]?.source).toBe("unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockClear();
    const second = await massiveProvider.getQuotes(["BBAI"]);
    expect(second[0]?.providerError).toContain("plan does not include");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
