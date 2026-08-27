import type { Express } from "express";
import { sdk } from "./_core/sdk";
import { createHeartbeatJob } from "./_core/heartbeat";
import { ENV } from "./_core/env";
import { ensurePaperBotConfig, getDb, getPaperBotScheduleTask, updatePaperBotSchedule, upsertPaperBotScheduleTask } from "./db";
import { runPaperBotsForCadenceTask } from "./paper-bot-runner";
import { paperBotConfigs } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export const supportedBotIntervals = [1, 5, 15] as const;
export const botCron = (minutes: number) => `0 */${minutes} * * * *`;

const SCHEDULE_CALLBACK_PATH = "/api/scheduled/binance-paper-bot";

/**
 * Create (or refresh) the three cadence tasks (1m / 5m / 15m).
 * If Forge Heartbeat is available, it registers the remote heartbeat jobs.
 * Otherwise, it creates reliable local cadence task identifiers.
 */
export async function ensurePaperBotScheduleTasks(): Promise<{ intervalMinutes: number; taskUid: string }[]> {
  const results: { intervalMinutes: number; taskUid: string }[] = [];
  for (const minutes of supportedBotIntervals) {
    try {
      const existing = await getPaperBotScheduleTask(minutes);
      if (existing) {
        results.push({ intervalMinutes: minutes, taskUid: existing.taskUid });
        continue;
      }
      let taskUid = `local-cadence-${minutes}m`;
      if (ENV.forgeApiUrl && ENV.forgeApiKey) {
        try {
          const created = await createHeartbeatJob(
            {
              name: `binance-paper-bot-${minutes}m`,
              cron: botCron(minutes),
              path: SCHEDULE_CALLBACK_PATH,
              method: "POST",
              description: `Runs the DeepSeek paper-bot simulation every ${minutes} minute(s) for all enabled users.`,
            },
            ""
          );
          taskUid = created.taskUid;
        } catch (forgeErr) {
          console.warn(`[PaperBotSchedule] Forge heartbeat unavailable for ${minutes}m, using local fallback:`, forgeErr instanceof Error ? forgeErr.message : forgeErr);
        }
      }
      const saved = await upsertPaperBotScheduleTask(minutes, taskUid);
      if (saved) {
        results.push({ intervalMinutes: minutes, taskUid: saved.taskUid });
      }
    } catch (error) {
      console.warn(`[PaperBotSchedule] Failed to seed ${minutes}m schedule task:`, error instanceof Error ? error.message : error);
    }
  }
  return results;
}

export async function enableScheduledPaperBot(userId: number, minutes: number) {
  if (!supportedBotIntervals.includes(minutes as 1 | 5 | 15)) throw new Error("Supported bot schedules are 1, 5, or 15 minutes");
  const config = await ensurePaperBotConfig(userId);
  let schedule = await getPaperBotScheduleTask(minutes);
  if (!schedule) {
    await ensurePaperBotScheduleTasks();
    schedule = await getPaperBotScheduleTask(minutes);
  }
  const taskUid = schedule?.taskUid ?? `local-cadence-${minutes}m`;
  if (!schedule) {
    try {
      await upsertPaperBotScheduleTask(minutes, taskUid);
    } catch {
      // Ignored if DB is in fallback mode
    }
  }

  // Update cadence scheduleMinutes and enable the bot
  const db = await getDb();
  if (db) {
    await db.update(paperBotConfigs).set({ scheduleMinutes: minutes, updatedAt: new Date() }).where(eq(paperBotConfigs.id, config.id));
  }

  return updatePaperBotSchedule(userId, { enabled: true, taskUid, status: "scheduled", error: null });
}

export async function pauseScheduledPaperBot(userId: number) {
  await ensurePaperBotConfig(userId);
  return updatePaperBotSchedule(userId, { enabled: false, taskUid: null, status: "paused", error: null });
}

/**
 * Production uses managed scheduled callbacks rather than process-local timers,
 * which are not durable in autoscaling environments. This no-op preserves the
 * function signature for callers from earlier application versions.
 */
export function startInProcessPaperBotScheduler() {
  return;
}

export function registerPaperBotScheduleRoute(app: Express) {
  app.post("/api/scheduled/binance-paper-bot", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const result = await runPaperBotsForCadenceTask(user.taskUid);
      return res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Scheduled paper bot failed";
      return res.status(500).json({ error: message, context: { url: req.originalUrl, taskUid: undefined }, timestamp: new Date().toISOString() });
    }
  });
}
