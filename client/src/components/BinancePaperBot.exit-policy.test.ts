import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("paper bot exit policy copy", () => {
  it("discloses the small-profit and risk controls next to the managed cadence", async () => {
    const source = await readFile(new URL("./BinancePaperBot.tsx", import.meta.url), "utf8");

    expect(source).toContain("+0.10% quick-profit lock");
    expect(source).toContain("-0.18% stop-loss");
    expect(source).toContain("selected 1m/5m/15m cadence");
    expect(source).toContain("never forces a trade");
  });
});
