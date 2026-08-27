import { fetchBinanceCryptoBars, fetchBinanceCryptoQuote } from "./binance";
import { binancePaperAccountSummary, completePaperBotRun, createBinancePaperOrder, createBinanceLiveOrder, ensureBinancePaperAccount, ensurePaperBotConfig, getDb, getPaperBotConfigByTaskUid, listEnabledPaperBotConfigsByTaskUid, startPaperBotRun } from "./db";
import { paperBotConfigs } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { assessPaperBotDecision, attachHoldDiagnostic, buildRiskManagedPaperOrder, computeBarIndicators, DEFAULT_STOP_LOSS_PCT, DEFAULT_TAKE_PROFIT_PCT, deterministicStrategyDecision, detectRangeRegime, inferQuantitativeNextCandle, isDailyLossStopped, noTradeDeepSeekDecision, PAPER_BOT_STRATEGIES, type BotDecision, type PaperBotStrategy, type QuantitativeIndicators, rangeInactiveHold, requestDeepSeekDecision } from "./paper-bot";
import { fetchBinanceLiveAccountSummary, placeBinanceLiveOrder, getBinanceLiveConfig } from "./binance-live";
import { safeAudit } from "./production";

type PaperBotConfig = typeof paperBotConfigs.$inferSelect;
type MarketContext = { symbol: string; quote: { price: number | null; changePct: number | null; quoteVolume: number | null; availability: string }; oneMinute: { bars: number; changePct: number | null; indicators?: QuantitativeIndicators | null }; fiveMinute: { bars: number; changePct: number | null; indicators?: QuantitativeIndicators | null }; fifteenMinute: { bars: number; changePct: number | null; indicators?: QuantitativeIndicators | null } };
const parseSymbols = (raw: string) => { try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string" && /^[A-Z0-9]{5,24}$/.test(value)).slice(0, 6) : []; } catch { return []; } };
const summarizeBars = (bars: Array<{ open: number; high: number; low: number; close: number; volume: number; start: number }>) => {
  const first = bars[0]?.close;
  const last = bars.at(-1)?.close;
  const indicators = bars.length >= 12 ? computeBarIndicators(bars) : null;
  return {
    bars: bars.length,
    firstClose: first ?? null,
    lastClose: last ?? null,
    changePct: first && last ? ((last - first) / first) * 100 : null,
    lastVolume: bars.at(-1)?.volume ?? null,
    updatedAt: bars.at(-1)?.start ?? null,
    indicators
  };
};
export const paperBotRunKey = (taskUid: string, configId: number, minutes: number, now = Date.now(), symbol?: string) => `${taskUid}:${configId}:${Math.floor(now / Math.max(1, minutes) / 60_000)}${symbol ? `:${symbol}` : ""}`;

// In-memory high watermark tracking for dynamic trailing stops
const positionPeakPrices = new Map<string, number>();

async function fetchContexts(symbols: string[]): Promise<MarketContext[]> { return Promise.all(symbols.map(async symbol => { const [quote, oneMinute, fiveMinute, fifteenMinute] = await Promise.all([fetchBinanceCryptoQuote("global-spot", symbol), fetchBinanceCryptoBars("global-spot", symbol, "1m", 40), fetchBinanceCryptoBars("global-spot", symbol, "5m", 40), fetchBinanceCryptoBars("global-spot", symbol, "15m", 40)]); return { symbol, quote: { price: quote.price, changePct: quote.changePct, quoteVolume: quote.quoteVolume, availability: quote.availability }, oneMinute: summarizeBars(oneMinute), fiveMinute: summarizeBars(fiveMinute), fifteenMinute: summarizeBars(fifteenMinute) }; })); }

async function runPaperBotSymbol(input: { config: PaperBotConfig; taskUid: string; now: number; strategy: PaperBotStrategy; context: MarketContext; allContexts: MarketContext[]; prices: Record<string, number> }) {
  const { config, taskUid, now, strategy, context, allContexts, prices } = input;
  const isLive = false;
  const started = await startPaperBotRun({ userId: config.userId, configId: config.id, runKey: paperBotRunKey(taskUid, config.id, config.scheduleMinutes, now, context.symbol), marketContext: { evaluationSymbol: context.symbol, strategy, mode: isLive ? "live" : "paper", contexts: allContexts, selectedContext: context } });
  if (!started.created) return { ok: true, symbol: context.symbol, skipped: "duplicate" as const };
  try {
    let account;
    if (isLive) {
      try {
        account = await fetchBinanceLiveAccountSummary(prices, [context.symbol]);
      } catch (liveErr) {
        console.warn(`[BinanceLiveBot] Live balance query failed, using paper fallback for user ${config.userId}:`, liveErr);
        account = await binancePaperAccountSummary(config.userId, prices);
      }
    } else {
      account = await binancePaperAccountSummary(config.userId, prices);
    }

    const currentPrice = prices[context.symbol] ?? context.quote.price ?? 0;
    const existingPosition = account.positions.find(p => p.symbol === context.symbol && p.quantity > 0);
    const posKey = `${config.userId}:${context.symbol}`;

    // Fee-Profitable Auto-Management: Take-Profit (>= +0.65%), Stop-Loss (<= -0.38%), or Trailing Stop
    if (existingPosition && currentPrice > 0) {
      const peakPrice = Math.max(positionPeakPrices.get(posKey) ?? existingPosition.averageCost, currentPrice);
      positionPeakPrices.set(posKey, peakPrice);

      const pnlPct = ((currentPrice - existingPosition.averageCost) / existingPosition.averageCost) * 100;
      const peakGainPct = ((peakPrice - existingPosition.averageCost) / existingPosition.averageCost) * 100;
      const trailingDropPct = ((peakPrice - currentPrice) / peakPrice) * 100;

      const isTakeProfit = pnlPct >= DEFAULT_TAKE_PROFIT_PCT;
      const isStopLoss = pnlPct <= -DEFAULT_STOP_LOSS_PCT;
      const isTrailingStop = peakGainPct >= 0.08 && trailingDropPct >= 0.03;
      const isQuickProfitLock = pnlPct >= 0.10;

      // Next-candle predictive exit guard: if next candle forecasts a drop
      const nextForecast = inferQuantitativeNextCandle(context, currentPrice);
      const isNextCandleDropAlert = nextForecast.direction === "down" && (pnlPct >= 0.04 || pnlPct <= -0.10);

      if (isTakeProfit || isStopLoss || isTrailingStop || isQuickProfitLock || isNextCandleDropAlert) {
        positionPeakPrices.delete(posKey);
        const exitAction = isTakeProfit
          ? "Micro Take-Profit (Target Reached)"
          : isQuickProfitLock
          ? "Quick Gain Lock (+0.10% Instant Profit)"
          : isTrailingStop
          ? "Trailing Profit Lock (Peak Retracement)"
          : isNextCandleDropAlert
          ? `Next-Candle Exit (${nextForecast.reason})`
          : "Stop Loss (Risk Cap)";

        const exitDecision = {
          action: "sell" as const,
          symbol: context.symbol,
          confidence: 0.98,
          stopPrice: null,
          targetPrice: null,
          reason: `${exitAction} at $${currentPrice.toFixed(2)} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}% return) [${isLive ? "LIVE" : "PAPER"}]`,
          nextCandle: nextForecast,
          holdCategory: null,
        };

        if (isLive) {
          const liveOrder = await placeBinanceLiveOrder({
            symbol: context.symbol,
            side: "sell",
            quantity: existingPosition.quantity,
            orderType: "MARKET",
            source: "fast-scalp-manager-live",
          });
          if (liveOrder.ok) {
            await createBinanceLiveOrder(config.userId, {
              orderId: liveOrder.orderId,
              clientOrderId: liveOrder.clientOrderId,
              symbol: context.symbol,
              side: "sell",
              quantity: liveOrder.quantity,
              fillPrice: liveOrder.fillPrice || currentPrice,
              cummulativeQuoteQty: liveOrder.cummulativeQuoteQty,
              status: liveOrder.status,
              source: "fast-scalp-live",
              rawResponse: liveOrder.rawResponse,
            });
          }
        } else {
          await createBinancePaperOrder(config.userId, {
            idempotencyKey: `scalp-exit:${started.run.runKey}`,
            symbol: context.symbol,
            side: "sell",
            quantity: existingPosition.quantity,
            markPrice: currentPrice,
            source: "fast-scalp-manager",
          });
        }

        await completePaperBotRun({ id: started.run.id, configId: config.id, status: "ordered", decision: exitDecision });
        await safeAudit({ userId: config.userId, action: isLive ? "binance_live_bot_order" : "binance_paper_bot_order", resource: context.symbol, metadata: { side: "sell", quantity: existingPosition.quantity, mode: isLive ? "live" : "paper", reason: exitAction }, requestId: started.run.runKey });
        return { ok: true, symbol: context.symbol, status: "ordered" as const };
      }
    } else {
      positionPeakPrices.delete(posKey);
    }
    
    let rawDecision;
    try {
      rawDecision = strategy === "range_reversion" && detectRangeRegime(context) !== "range"
        ? rangeInactiveHold(context.symbol, detectRangeRegime(context))
        : await requestDeepSeekDecision({ configuredSymbols: [context.symbol], strategy, marketContext: { strategy, market: "global-spot", mode: isLive ? "live" : "paper", evaluationSymbol: context.symbol, account: { equity: account.equity, buyingPower: account.buyingPower, positions: account.positions.map(item => ({ symbol: item.symbol, quantity: item.quantity, averageCost: item.averageCost })) }, context } });
    } catch (deepseekErr) {
      console.warn(`[PaperBot] DeepSeek decision unavailable for ${context.symbol}, evaluating technical fallback:`, deepseekErr instanceof Error ? deepseekErr.message : deepseekErr);
      rawDecision = noTradeDeepSeekDecision(context.symbol, `Model analysis fallback: ${deepseekErr instanceof Error ? deepseekErr.message : "unavailable"}`);
    }

    // Resolve candle forecast from model or quantitative engine
    const markPriceForFallback = prices[context.symbol] ?? context.quote.price ?? 0;
    const candleForecast = rawDecision.nextCandle ?? inferQuantitativeNextCandle(context, markPriceForFallback);

    let decision: BotDecision = {
      ...rawDecision,
      nextCandle: candleForecast,
    };

    // DIRECT CANDLE-PREDICTION TRADING ENGINE (No Restrictions):
    // 1. If candle forecast is UP -> BUY
    if (candleForecast && candleForecast.direction === "up") {
      decision.action = "buy";
      decision.symbol = context.symbol;
      decision.confidence = Math.max(decision.confidence || 0, candleForecast.probability || 0.75);
      decision.reason = `Next-Candle Buy: ${candleForecast.reason} [Forecast: UP (${Math.round((candleForecast.probability || 0.75) * 100)}%)]`;
      if (!decision.stopPrice || decision.stopPrice >= markPriceForFallback) {
        decision.stopPrice = Number((markPriceForFallback * (1 - DEFAULT_STOP_LOSS_PCT / 100)).toFixed(6));
      }
      if (!decision.targetPrice || decision.targetPrice <= markPriceForFallback) {
        decision.targetPrice = Number((markPriceForFallback * (1 + DEFAULT_TAKE_PROFIT_PCT / 100)).toFixed(6));
      }
      decision.holdCategory = null;
    } else if (rawDecision.action === "hold" && markPriceForFallback > 0) {
      const fallback = deterministicStrategyDecision(strategy, context, context.symbol, markPriceForFallback);
      if (fallback && fallback.action === "buy") {
        decision = { ...fallback, nextCandle: candleForecast };
      }
    }

    const markPrice = prices[decision.symbol] ?? prices[context.symbol] ?? context.quote.price ?? 0;
    const assessment = assessPaperBotDecision({ strategy, decision, markPrice, context });

    if (!assessment.allowed) {
      const isHold = decision.action === "hold";
      await completePaperBotRun({ id: started.run.id, configId: config.id, status: isHold ? "hold" : "hold", decision, error: assessment.reason });
      return { ok: true, symbol: context.symbol, status: "hold" as const };
    }

    const order = buildRiskManagedPaperOrder({ decision, markPrice, account, riskPct: Number(config.riskPct), maxOpenPositions: config.maxOpenPositions });
    if (!order.allowed) {
      await completePaperBotRun({ id: started.run.id, configId: config.id, status: "hold", decision, error: order.reason });
      return { ok: true, symbol: context.symbol, status: "hold" as const };
    }

    if (isLive) {
      const liveOrder = await placeBinanceLiveOrder({
        symbol: decision.symbol,
        side: order.side,
        quantity: order.quantity,
        orderType: "MARKET",
        source: "deepseek-live-bot",
      });

      if (!liveOrder.ok) {
        await completePaperBotRun({ id: started.run.id, configId: config.id, status: "error", decision, error: liveOrder.error || "Binance Live order rejected" });
        return { ok: false, symbol: context.symbol, status: "error" as const, error: liveOrder.error };
      }

      await createBinanceLiveOrder(config.userId, {
        orderId: liveOrder.orderId,
        clientOrderId: liveOrder.clientOrderId,
        symbol: decision.symbol,
        side: order.side,
        quantity: liveOrder.quantity,
        fillPrice: liveOrder.fillPrice || markPrice,
        cummulativeQuoteQty: liveOrder.cummulativeQuoteQty,
        status: liveOrder.status,
        source: "deepseek-live-bot",
        rawResponse: liveOrder.rawResponse,
      });

      await completePaperBotRun({ id: started.run.id, configId: config.id, status: "ordered", decision });
      await safeAudit({ userId: config.userId, action: "binance_live_bot_order", resource: decision.symbol, metadata: { orderId: liveOrder.orderId, side: order.side, quantity: liveOrder.quantity, fillPrice: liveOrder.fillPrice, mode: "live" }, requestId: started.run.runKey });
      return { ok: true, symbol: context.symbol, status: "ordered" as const };
    }

    // Default Paper Simulation Order
    const created = await createBinancePaperOrder(config.userId, {
      idempotencyKey: `bot-order:${started.run.runKey}`,
      symbol: decision.symbol,
      side: order.side,
      quantity: order.quantity,
      markPrice,
      stopPrice: order.stopPrice,
      targetPrice: order.targetPrice,
      source: "deepseek-scheduled-paper-bot",
    });

    await completePaperBotRun({ id: started.run.id, configId: config.id, status: "ordered", decision });
    await safeAudit({ userId: config.userId, action: "binance_paper_bot_order", resource: decision.symbol, metadata: { orderId: created?.id, side: order.side, quantity: order.quantity, mode: "paper" }, requestId: started.run.runKey });
    return { ok: true, symbol: context.symbol, status: "ordered" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Paper bot run failed";
    await completePaperBotRun({ id: started.run.id, configId: config.id, status: "error", error: message });
    return { ok: false, symbol: context.symbol, status: "error" as const, error: message };
  }
}

export async function runPaperBotConfig(config: PaperBotConfig, taskUid: string, now = Date.now()) {
  if (config.enabled !== 1) return { ok: true, skipped: "disabled-or-orphan" as const }; const symbols = parseSymbols(config.symbols); if (!symbols.length) return { ok: true, skipped: "no-symbols" as const };
  const contexts = await fetchContexts(symbols); const prices = Object.fromEntries(contexts.flatMap(item => item.quote.price && item.quote.availability === "live" ? [[item.symbol, item.quote.price]] : [])); const strategy = PAPER_BOT_STRATEGIES.includes(config.strategy as PaperBotStrategy) ? config.strategy as PaperBotStrategy : "scalp_momentum";
  const results = []; for (const context of contexts) results.push(await runPaperBotSymbol({ config, taskUid, now, strategy, context, allContexts: contexts, prices }));
  return { ok: true, processed: results.length, results };
}

export async function runScheduledBinancePaperBot(taskUid: string, now = Date.now()) { const config = await getPaperBotConfigByTaskUid(taskUid); if (!config) return { ok: true, skipped: "disabled-or-orphan" as const }; return runPaperBotConfig(config, taskUid, now); }
export async function runPaperBotsForCadenceTask(taskUid: string, now = Date.now()) { const configs = await listEnabledPaperBotConfigsByTaskUid(taskUid); const results = await Promise.all(configs.map(config => runPaperBotConfig(config, taskUid, now))); return { ok: true, processed: configs.length, results }; }
export async function runUserPaperBotNow(userId: number, now = Date.now()) { const config = await ensurePaperBotConfig(userId); const taskUid = `manual-${Date.now()}`; return runPaperBotConfig({ ...config, enabled: 1 }, taskUid, now); }
export async function getBinancePaperBotBootstrap(userId: number) { await ensureBinancePaperAccount(userId); return { taskUid: undefined }; }

export async function manageActivePaperPositions(now = Date.now()) {
  try {
    const db = await getDb();
    if (!db) return { closed: 0 };
    const configs = await db.select().from(paperBotConfigs).where(eq(paperBotConfigs.enabled, 1));
    for (const config of configs) {
      const isLive = config.tradingMode === "live";
      let account;
      if (isLive) {
        try {
          account = await fetchBinanceLiveAccountSummary();
        } catch {
          continue;
        }
      } else {
        account = await binancePaperAccountSummary(config.userId);
      }

      const activePositions = account.positions.filter(p => p.quantity > 0);
      if (!activePositions.length) continue;

      for (const pos of activePositions) {
        try {
          const quote = await fetchBinanceCryptoQuote("global-spot", pos.symbol);
          const currentPrice = quote.price;
          if (!currentPrice || currentPrice <= 0) continue;

          const posKey = `${config.userId}:${pos.symbol}`;
          const peakPrice = Math.max(positionPeakPrices.get(posKey) ?? pos.averageCost, currentPrice);
          positionPeakPrices.set(posKey, peakPrice);

          const pnlPct = ((currentPrice - pos.averageCost) / pos.averageCost) * 100;
          const peakGainPct = ((peakPrice - pos.averageCost) / pos.averageCost) * 100;
          const trailingDropPct = ((peakPrice - currentPrice) / peakPrice) * 100;

          const isTakeProfit = pnlPct >= DEFAULT_TAKE_PROFIT_PCT;
          const isStopLoss = pnlPct <= -DEFAULT_STOP_LOSS_PCT;
          const isTrailingStop = peakGainPct >= 0.08 && trailingDropPct >= 0.03;
          const isQuickProfitLock = pnlPct >= 0.10;

          if (isTakeProfit || isStopLoss || isTrailingStop || isQuickProfitLock) {
            positionPeakPrices.delete(posKey);
            const exitAction = isTakeProfit
              ? "Micro Take-Profit (Target Reached)"
              : isQuickProfitLock
              ? "Quick Gain Lock (+0.10% Instant Profit)"
              : isTrailingStop
              ? "Trailing Profit Lock (Peak Retracement)"
              : "Stop Loss (Risk Cap)";

            const exitDecision = {
              action: "sell" as const,
              symbol: pos.symbol,
              confidence: 0.98,
              stopPrice: null,
              targetPrice: null,
              reason: `${exitAction} at $${currentPrice.toFixed(2)} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}% return) [${isLive ? "LIVE" : "PAPER"}]`,
              nextCandle: null,
              holdCategory: null,
            };
            const orderKey = `fast-exit:${pos.symbol}:${Math.floor(now / 3_000)}`;

            if (isLive) {
              const liveOrder = await placeBinanceLiveOrder({
                symbol: pos.symbol,
                side: "sell",
                quantity: pos.quantity,
                orderType: "MARKET",
                source: "fast-scalp-manager-live",
              });
              if (liveOrder.ok) {
                await createBinanceLiveOrder(config.userId, {
                  orderId: liveOrder.orderId,
                  clientOrderId: liveOrder.clientOrderId,
                  symbol: pos.symbol,
                  side: "sell",
                  quantity: liveOrder.quantity,
                  fillPrice: liveOrder.fillPrice || currentPrice,
                  cummulativeQuoteQty: liveOrder.cummulativeQuoteQty,
                  status: liveOrder.status,
                  source: "fast-scalp-live",
                  rawResponse: liveOrder.rawResponse,
                });
                const run = await startPaperBotRun({
                  userId: config.userId,
                  configId: config.id,
                  runKey: `run-exit:${orderKey}`,
                  marketContext: { evaluationSymbol: pos.symbol, trigger: "fast_scalp_exit", mode: "live", currentPrice, pnlPct }
                });
                if (run.created) {
                  await completePaperBotRun({ id: run.run.id, configId: config.id, status: "ordered", decision: exitDecision });
                }
              }
            } else {
              const created = await createBinancePaperOrder(config.userId, {
                idempotencyKey: orderKey,
                symbol: pos.symbol,
                side: "sell",
                quantity: pos.quantity,
                markPrice: currentPrice,
                source: "fast-scalp-manager",
              });
              if (created) {
                const run = await startPaperBotRun({
                  userId: config.userId,
                  configId: config.id,
                  runKey: `run-exit:${orderKey}`,
                  marketContext: { evaluationSymbol: pos.symbol, trigger: "fast_scalp_exit", mode: "paper", currentPrice, pnlPct }
                });
                if (run.created) {
                  await completePaperBotRun({ id: run.run.id, configId: config.id, status: "ordered", decision: exitDecision });
                }
                await safeAudit({
                  userId: config.userId,
                  action: "binance_paper_bot_order",
                  resource: pos.symbol,
                  metadata: { orderId: created.id, side: "sell", quantity: pos.quantity, mode: "paper", reason: exitAction },
                  requestId: orderKey
                });
              }
            }
          }
        } catch {
          // ignore single quote failure
        }
      }
    }
  } catch {
    // ignore
  }
}

