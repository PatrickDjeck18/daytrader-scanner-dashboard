import type { Express } from "express";
import { sdk } from "./_core/sdk";
import { ensurePaperBotConfig, getPaperBotScheduleTask, updatePaperBotSchedule } from "./db";
import { runPaperBotsForCadenceTask } from "./paper-bot-runner";

export const supportedBotIntervals = [1, 5, 15] as const;
export const botCron = (minutes: number) => `0 */${minutes} * * * *`;

export async function enableScheduledPaperBot(userId: number, minutes: number) {
  if (!supportedBotIntervals.includes(minutes as 1 | 5 | 15)) throw new Error("Supported bot schedules are 1, 5, or 15 minutes");
  const config = await ensurePaperBotConfig(userId);
  if (config.scheduleMinutes !== minutes) throw new Error("Save the selected simulation cadence before starting the bot");
  const schedule = await getPaperBotScheduleTask(minutes);
  if (!schedule) throw new Error("The managed simulation schedule is not ready yet. Please try again shortly.");
  return updatePaperBotSchedule(userId, { enabled: true, taskUid: schedule.taskUid, status: "scheduled", error: null });
}

export async function pauseScheduledPaperBot(userId: number) { await ensurePaperBotConfig(userId); return updatePaperBotSchedule(userId, { enabled: false, taskUid: null, status: "paused", error: null }); }

export function registerPaperBotScheduleRoute(app: Express) {
  app.post("/api/scheduled/binance-paper-bot", async (req, res) => { try { const user = await sdk.authenticateRequest(req); if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" }); const result = await runPaperBotsForCadenceTask(user.taskUid); return res.json(result); } catch (error) { const message = error instanceof Error ? error.message : "Scheduled paper bot failed"; return res.status(500).json({ error: message, context: { url: req.originalUrl, taskUid: undefined }, timestamp: new Date().toISOString() }); } });
}
