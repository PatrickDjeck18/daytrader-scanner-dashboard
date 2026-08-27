import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("paper bot stop behavior", () => {
  it("closes simulated positions before pausing and does not invoke live close logic", async () => {
    const source = await readFile(new URL("./routers.ts", import.meta.url), "utf8");
    const pauseStart = source.indexOf("pauseBot:");
    const pauseEnd = source.indexOf("triggerBotNow:", pauseStart);
    const pauseSource = source.slice(pauseStart, pauseEnd);

    expect(pauseSource).toContain("closeAllBinancePaperPositions");
    expect(pauseSource).toContain("await pauseScheduledPaperBot");
    expect(pauseSource.indexOf("closeAllBinancePaperPositions")).toBeLessThan(pauseSource.indexOf("await pauseScheduledPaperBot"));
    expect(pauseSource).not.toContain("closeAllBinanceLivePositions");
  });
});
