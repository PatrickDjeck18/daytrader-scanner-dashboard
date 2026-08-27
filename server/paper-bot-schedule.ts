import type { Express } from "express";
import { sdk } from "./_core/sdk";
import { ensurePaperBotConfig, getDb, getPaperBotScheduleTask, updatePaperBotSchedule, upsertPaperBotScheduleTask } from "./db";
import { runPaperBotsForCadenceTask } from "./paper-bot-runner";
import { paperBotConfigs } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";

export const supportedBotIntervals = [1, 5, 15] as const;
export const botCron = (minutes: number) => `0 */${minutes} * * * *`;
export const managedPaperBotScheduleName = (minutes: number) => `binance-paper-bot-${minutes}m`;
export const isManagedPaperBotTaskUid = (taskUid: string | null | undefined) => Boolean(taskUid && !taskUid.startsWith("local-cadence-"));

const SCHEDULE_CALLBACK_PATH = "/api/scheduled/binance-paper-bot";

/**
 * Returns the project-managed cadence tasks already bound in the dashboard
 * database. Tasks are created once by the project owner through Heartbeat
 * after the site is deployed, rather than using a process-local fallback.
 */
export async function ensurePaperBotScheduleTasks(): Promise<{ intervalMinutes: number; taskUid: string }[]> {
  const results: { intervalMinutes: number; taskUid: string }[] = [];
  for (const minutes of supportedBotIntervals) {
    const existing = await getPaperBotScheduleTask(minutes);
    if (existing && isManagedPaperBotTaskUid(existing.taskUid)) {
      results.push({ intervalMinutes: minutes, taskUid: existing.taskUid });
    }
  }
  return results;
}

/** Binds an owner-created managed task and migrates enabled bots at that cadence. */
export async function bindManagedPaperBotSchedule(minutes: number, taskUid: string) {
  if (!supportedBotIntervals.includes(minutes as 1 | 5 | 15)) throw new Error("Supported bot schedules are 1, 5, or 15 minutes");
  if (!isManagedPaperBotTaskUid(taskUid)) throw new Error("A managed paper-bot task identifier is required");
  const saved = await upsertPaperBotScheduleTask(minutes, taskUid);
  const db = await getDb();
  if (db) {
    await db.update(paperBotConfigs).set({
      scheduleCronTaskUid: taskUid,
      lastRunStatus: "scheduled",
      lastRunError: null,
      updatedAt: new Date(),
    }).where(and(eq(paperBotConfigs.enabled, 1), eq(paperBotConfigs.scheduleMinutes, minutes)));
  }
  return saved;
}

export async function enableScheduledPaperBot(userId: number, minutes: number) {
  if (!supportedBotIntervals.includes(minutes as 1 | 5 | 15)) throw new Error("Supported bot schedules are 1, 5, or 15 minutes");
  const config = await ensurePaperBotConfig(userId);
  let schedule = await getPaperBotScheduleTask(minutes);
  if (!schedule || !isManagedPaperBotTaskUid(schedule.taskUid)) throw new Error("Paper-bot scheduler is not ready. Please retry once managed schedules are configured.");
  const taskUid = schedule.taskUid;

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
