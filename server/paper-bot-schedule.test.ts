import { describe, expect, it } from "vitest";
import { botCron, isManagedPaperBotTaskUid, managedPaperBotScheduleName, supportedBotIntervals } from "./paper-bot-schedule";
import { paperBotRunKey } from "./paper-bot-runner";
describe("scheduled Binance paper bot", () => {
  it("uses platform-safe one, five, and fifteen-minute cron expressions", () => { expect(supportedBotIntervals).toEqual([1, 5, 15]); expect(botCron(5)).toBe("0 */5 * * * *"); });
  it("uses project-managed task identifiers and rejects the retired local fallback", () => { expect(managedPaperBotScheduleName(5)).toBe("binance-paper-bot-5m"); expect(isManagedPaperBotTaskUid("cron-task-123")).toBe(true); expect(isManagedPaperBotTaskUid("local-cadence-5m")).toBe(false); });
  it("keeps each paper account idempotent when a shared cadence runs", () => {
    const now = Date.parse("2026-08-22T10:05:00.000Z");
    expect(paperBotRunKey("shared-task", 11, 5, now)).not.toBe(paperBotRunKey("shared-task", 12, 5, now));
    expect(paperBotRunKey("shared-task", 11, 5, now)).toBe(paperBotRunKey("shared-task", 11, 5, now));
    expect(paperBotRunKey("shared-task", 11, 5, now, "BTCUSDT")).not.toBe(paperBotRunKey("shared-task", 11, 5, now, "ETHUSDT"));
  });
});
