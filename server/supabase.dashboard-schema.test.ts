import { describe, expect, it } from "vitest";
import {
  alertRules,
  auditEvents,
  backtestRuns,
  binancePaperAccounts,
  binancePaperOrders,
  paperBotConfigs,
  paperBotRuns,
  paperBotScheduleTasks,
  providerHealth,
  scannerPresets,
  users,
  watchlistItems,
  watchlists,
  workspaceLayouts,
} from "../drizzle/schema";
import { getDb } from "./db";

describe("Supabase dashboard schema", () => {
  it("exposes each persisted dashboard table through the application schema", async () => {
    const db = await getDb();
    expect(db).not.toBeNull();

    const tables = [
      users,
      watchlists,
      watchlistItems,
      scannerPresets,
      alertRules,
      workspaceLayouts,
      backtestRuns,
      binancePaperAccounts,
      binancePaperOrders,
      paperBotConfigs,
      paperBotRuns,
      paperBotScheduleTasks,
      auditEvents,
      providerHealth,
    ];

    await Promise.all(tables.map(table => db!.select().from(table).limit(1)));
  }, 30_000);
});
