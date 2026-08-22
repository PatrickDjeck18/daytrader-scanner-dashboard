import { fetchBinanceCryptoBars, fetchBinanceCryptoQuote } from "./binance";
import { binancePaperAccountSummary, completePaperBotRun, createBinancePaperOrder, ensureBinancePaperAccount, getPaperBotConfigByTaskUid, listEnabledPaperBotConfigsByTaskUid, startPaperBotRun } from "./db";
import { paperBotConfigs } from "../drizzle/schema";
import { buildRiskManagedPaperOrder, isDailyLossStopped, requestDeepSeekDecision } from "./paper-bot";
import { safeAudit } from "./production";

type PaperBotConfig = typeof paperBotConfigs.$inferSelect;
const parseSymbols = (raw: string) => { try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string" && /^[A-Z0-9]{5,24}$/.test(value)).slice(0, 6) : []; } catch { return []; } };
const summarizeBars = (bars: Array<{ close: number; volume: number; start: number }>) => { const first = bars[0]?.close; const last = bars.at(-1)?.close; return { bars: bars.length, firstClose: first ?? null, lastClose: last ?? null, changePct: first && last ? ((last - first) / first) * 100 : null, lastVolume: bars.at(-1)?.volume ?? null, updatedAt: bars.at(-1)?.start ?? null }; };
export const paperBotRunKey = (taskUid: string, configId: number, minutes: number, now = Date.now()) => `${taskUid}:${configId}:${Math.floor(now / Math.max(1, minutes) / 60_000)}`;

async function runPaperBotConfig(config: PaperBotConfig, taskUid: string, now = Date.now()) {
  if (config.enabled !== 1) return { ok: true, skipped: "disabled-or-orphan" as const };
  const symbols = parseSymbols(config.symbols); if (!symbols.length) return { ok: true, skipped: "no-symbols" as const };
  const contexts = await Promise.all(symbols.map(async symbol => { const [quote, oneMinute, fiveMinute, fifteenMinute] = await Promise.all([fetchBinanceCryptoQuote("global-spot", symbol), fetchBinanceCryptoBars("global-spot", symbol, "1m", 40), fetchBinanceCryptoBars("global-spot", symbol, "5m", 40), fetchBinanceCryptoBars("global-spot", symbol, "15m", 40)]); return { symbol, quote: { price: quote.price, changePct: quote.changePct, quoteVolume: quote.quoteVolume, availability: quote.availability }, oneMinute: summarizeBars(oneMinute), fiveMinute: summarizeBars(fiveMinute), fifteenMinute: summarizeBars(fifteenMinute) }; }));
  const prices = Object.fromEntries(contexts.flatMap(item => item.quote.price && item.quote.availability === "live" ? [[item.symbol, item.quote.price]] : []));
  const account = await binancePaperAccountSummary(config.userId, prices); const started = await startPaperBotRun({ userId: config.userId, configId: config.id, runKey: paperBotRunKey(taskUid, config.id, config.scheduleMinutes, now), marketContext: { contexts, account: { equity: account.equity, buyingPower: account.buyingPower, positions: account.positions } } });
  if (!started.created) return { ok: true, skipped: "duplicate" as const };
  try {
    if (isDailyLossStopped(account, Number(config.dailyLossStopPct))) { await completePaperBotRun({ id: started.run.id, configId: config.id, status: "risk_blocked", error: "Daily simulated-loss stop is active" }); return { ok: true, status: "risk_blocked" as const }; }
    const decision = await requestDeepSeekDecision({ symbol: symbols.join(","), marketContext: { market: "global-spot", supportedSymbols: symbols, account: { equity: account.equity, buyingPower: account.buyingPower, positions: account.positions.map(item => ({ symbol: item.symbol, quantity: item.quantity, averageCost: item.averageCost })) }, contexts } });
    if (!symbols.includes(decision.symbol)) { await completePaperBotRun({ id: started.run.id, configId: config.id, status: "risk_blocked", decision, error: "AI selected a pair outside the configured universe" }); return { ok: true, status: "risk_blocked" as const }; }
    const markPrice = prices[decision.symbol]; const order = buildRiskManagedPaperOrder({ decision, markPrice, account, riskPct: Number(config.riskPct), maxOpenPositions: config.maxOpenPositions });
    if (!order.allowed) { await completePaperBotRun({ id: started.run.id, configId: config.id, status: decision.action === "hold" ? "hold" : "risk_blocked", decision, error: order.reason }); return { ok: true, status: decision.action === "hold" ? "hold" as const : "risk_blocked" as const }; }
    const created = await createBinancePaperOrder(config.userId, { idempotencyKey: `bot-order:${started.run.runKey}`, symbol: decision.symbol, side: order.side, quantity: order.quantity, markPrice, stopPrice: order.stopPrice, targetPrice: order.targetPrice, source: "deepseek-scheduled-paper-bot" });
    await completePaperBotRun({ id: started.run.id, configId: config.id, status: "ordered", decision }); await safeAudit({ userId: config.userId, action: "binance_paper_bot_order", resource: decision.symbol, metadata: { orderId: created?.id, side: order.side, quantity: order.quantity, mode: "paper" }, requestId: started.run.runKey }); return { ok: true, status: "ordered" as const };
  } catch (error) { const message = error instanceof Error ? error.message : "Paper bot run failed"; await completePaperBotRun({ id: started.run.id, configId: config.id, status: "error", error: message }); return { ok: false, status: "error" as const, error: message }; }
}

export async function runScheduledBinancePaperBot(taskUid: string, now = Date.now()) {
  const config = await getPaperBotConfigByTaskUid(taskUid);
  if (!config) return { ok: true, skipped: "disabled-or-orphan" as const };
  return runPaperBotConfig(config, taskUid, now);
}

export async function runPaperBotsForCadenceTask(taskUid: string, now = Date.now()) {
  const configs = await listEnabledPaperBotConfigsByTaskUid(taskUid);
  const results = await Promise.all(configs.map(config => runPaperBotConfig(config, taskUid, now)));
  return { ok: true, processed: configs.length, results };
}

export async function getBinancePaperBotBootstrap(userId: number) { await ensureBinancePaperAccount(userId); return { taskUid: undefined }; }
