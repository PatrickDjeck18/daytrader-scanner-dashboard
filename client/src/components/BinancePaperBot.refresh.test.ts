import { describe, expect, it } from "vitest";
import { getPaperBotPollingOptions } from "./BinancePaperBot";

describe("paper bot metric polling", () => {
  it("refreshes enabled accounts frequently and while the tab is backgrounded", () => {
    expect(getPaperBotPollingOptions(true)).toMatchObject({
      refetchInterval: 3_000,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
      retry: false,
    });
  });

  it("keeps a slower refresh for disabled accounts without stopping refresh entirely", () => {
    expect(getPaperBotPollingOptions(false)).toMatchObject({
      refetchInterval: 10_000,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
      retry: false,
    });
  });
});
