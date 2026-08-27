import { z } from "zod";

export const BOT_DEFAULTS = { market: "global-spot", symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT"], scheduleMinutes: 5, riskPct: 1, dailyLossStopPct: 3, maxOpenPositions: 3 } as const;
export const PAPER_SCALPING_STRATEGY = "scalp_momentum" as const;
export const PAPER_BOT_STRATEGIES = [PAPER_SCALPING_STRATEGY, "fast_momentum", "range_reversion", "vwap_pullback", "bb_squeeze"] as const;
export type PaperBotStrategy = typeof PAPER_BOT_STRATEGIES[number];
export const HOLD_CATEGORIES = ["timeframe_conflict", "low_volatility", "no_qualified_setup", "risk_guard", "model_unavailable"] as const;
export type HoldCategory = typeof HOLD_CATEGORIES[number];

const STRATEGY_PROMPTS: Record<PaperBotStrategy, string> = {
  scalp_momentum: "Scalp Momentum: 1m trigger with both 5m and 15m confirmations required. Favor strong trending moves with aligned EMA 9/21/50 and RVOL expansion.",
  fast_momentum: "Fast Momentum: 1m trigger with one of 5m or 15m confirming. Favor early trend breakouts and quick follow-through.",
  range_reversion: "Range Reversion: 1m pullback or bounce inside a contained range. Favor mean reversion when price is near range edges with fading momentum.",
  vwap_pullback: "VWAP Pullback: price 0.05-0.30% above VWAP with RSI below 60 and RVOL above 1.2. Favor intraday mean reversion toward VWAP.",
  bb_squeeze: "BB Squeeze: Bollinger Band width below 0.5% followed by a breakout with RVOL above 1.4x. Favor volatility expansion breakouts.",
};

export function strategyPrompt(strategy: PaperBotStrategy): string {
  return STRATEGY_PROMPTS[strategy] ?? STRATEGY_PROMPTS.scalp_momentum;
}

export const botDecisionSchema = z.object({ action: z.enum(["buy", "sell", "hold"]), symbol: z.string().regex(/^[A-Z0-9]{5,24}$/), confidence: z.number().min(0).max(1), stopPrice: z.number().positive().nullable(), targetPrice: z.number().positive().nullable(), reason: z.string().min(1).max(600), nextCandle: z.object({ direction: z.enum(["up", "down", "flat"]), probability: z.number().min(0).max(1), reason: z.string().min(1).max(280) }).nullable().optional(), holdCategory: z.enum(HOLD_CATEGORIES).nullable().optional() });
export type BotDecision = z.infer<typeof botDecisionSchema>;
export type BotAccount = { equity: number; buyingPower: number; dailyStartEquity: number; positions: Array<{ symbol: string; quantity: number; averageCost: number }> };

export type QuantitativeIndicators = {
  ema9: number | null;
  ema21: number | null;
  ema50: number | null;
  rsi: number | null;
  atr: number | null;
  rvol: number | null;
  trend: "bullish" | "bearish" | "neutral";
  vwap: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  bbWidth: number | null;
  stochRsi: number | null;
};

export type ScalpMarketContext = {
  oneMinute: { bars: number; changePct: number | null; indicators?: QuantitativeIndicators | null };
  fiveMinute: { bars: number; changePct: number | null; indicators?: QuantitativeIndicators | null };
  fifteenMinute: { bars: number; changePct: number | null; indicators?: QuantitativeIndicators | null };
};

export function calculateEMA(prices: number[], period: number): number | null {
  if (!prices || prices.length < period || period <= 0) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return Number.isFinite(ema) ? Number(ema.toFixed(6)) : null;
}

export function calculateRSI(closes: number[], period = 14): number | null {
  if (!closes || closes.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  return Number.isFinite(rsi) ? Number(rsi.toFixed(2)) : null;
}

export function calculateATR(bars: Array<{ high: number; low: number; close: number }>, period = 14): number | null {
  if (!bars || bars.length <= period) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const current = bars[i];
    const prev = bars[i - 1];
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );
    trs.push(tr);
  }
  if (trs.length < period) return null;
  let atr = trs.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return Number.isFinite(atr) ? Number(atr.toFixed(6)) : null;
}

export function calculateRVOL(volumes: number[], period = 20): number | null {
  if (!volumes || volumes.length < 2) return null;
  const current = volumes[volumes.length - 1];
  const lookback = volumes.slice(Math.max(0, volumes.length - 1 - period), volumes.length - 1);
  if (!lookback.length) return null;
  const avg = lookback.reduce((sum, v) => sum + v, 0) / lookback.length;
  if (avg <= 0) return null;
  const rvol = current / avg;
  return Number.isFinite(rvol) ? Number(rvol.toFixed(2)) : null;
}

export function calculateVWAP(bars: Array<{ high: number; low: number; close: number; volume: number }>): number | null {
  if (!bars || bars.length === 0) return null;
  let cumPV = 0;
  let cumVol = 0;
  for (const bar of bars) {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    cumPV += typicalPrice * bar.volume;
    cumVol += bar.volume;
  }
  if (cumVol <= 0) return null;
  const vwap = cumPV / cumVol;
  return Number.isFinite(vwap) ? Number(vwap.toFixed(6)) : null;
}

export type BollingerBands = { upper: number; middle: number; lower: number; width: number } | null;
export function calculateBollingerBands(closes: number[], period = 20, multiplier = 2): BollingerBands {
  if (!closes || closes.length < period) return null;
  const slice = closes.slice(-period);
  const middle = slice.reduce((sum, c) => sum + c, 0) / period;
  const variance = slice.reduce((sum, c) => sum + Math.pow(c - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  const upper = middle + multiplier * stdDev;
  const lower = middle - multiplier * stdDev;
  const width = middle > 0 ? ((upper - lower) / middle) * 100 : 0;
  return { upper: Number(upper.toFixed(6)), middle: Number(middle.toFixed(6)), lower: Number(lower.toFixed(6)), width: Number(width.toFixed(4)) };
}

export function calculateStochasticRSI(closes: number[], rsiPeriod = 14, stochPeriod = 14): number | null {
  // Build RSI series
  if (closes.length < rsiPeriod + stochPeriod + 1) return null;
  const rsiSeries: number[] = [];
  for (let i = rsiPeriod; i < closes.length; i++) {
    const slice = closes.slice(i - rsiPeriod, i + 1);
    const rsi = calculateRSI(slice, rsiPeriod);
    if (rsi !== null) rsiSeries.push(rsi);
  }
  if (rsiSeries.length < stochPeriod) return null;
  const recentRsi = rsiSeries.slice(-stochPeriod);
  const minRsi = Math.min(...recentRsi);
  const maxRsi = Math.max(...recentRsi);
  const range = maxRsi - minRsi;
  if (range === 0) return 50;
  const stochRsi = ((rsiSeries.at(-1)! - minRsi) / range) * 100;
  return Number.isFinite(stochRsi) ? Number(stochRsi.toFixed(2)) : null;
}

export function computeBarIndicators(bars: Array<{ high: number; low: number; close: number; volume: number }>): QuantitativeIndicators {
  const closes = bars.map(b => b.close);
  const volumes = bars.map(b => b.volume);
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema50 = calculateEMA(closes, 50);
  const rsi = calculateRSI(closes, 14);
  const atr = calculateATR(bars, 14);
  const rvol = calculateRVOL(volumes, 20);
  const vwap = calculateVWAP(bars);
  const bb = calculateBollingerBands(closes, 20, 2);
  const stochRsi = calculateStochasticRSI(closes, 14, 14);

  let trend: "bullish" | "bearish" | "neutral" = "neutral";
  if (ema9 !== null && ema21 !== null) {
    if (ema9 > ema21 && (ema50 === null || ema21 > ema50)) {
      trend = "bullish";
    } else if (ema9 < ema21 && (ema50 === null || ema21 < ema50)) {
      trend = "bearish";
    }
  }

  return {
    ema9, ema21, ema50, rsi, atr, rvol, trend,
    vwap,
    bbUpper: bb?.upper ?? null,
    bbMiddle: bb?.middle ?? null,
    bbLower: bb?.lower ?? null,
    bbWidth: bb?.width ?? null,
    stochRsi,
  };
}

export function noTradeDeepSeekDecision(symbol: string, reason: string): BotDecision { return { action: "hold", symbol, confidence: 0, stopPrice: null, targetPrice: null, reason, nextCandle: null, holdCategory: "model_unavailable" }; }
function coerceDecisionNumber(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return value as null | undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}
function normalizeDecisionAction(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const action = value.trim().toLowerCase();
  if (action === "buy" || action === "sell" || action === "hold") return action;
  // Tolerate common DeepSeek phrasing like "BUY", "HOLD", "wait", "none".
  if (action === "wait" || action === "none" || action === "skip" || action === "no_trade" || action === "no trade") return "hold";
  return value;
}
function normalizeDecisionSymbol(value: unknown): unknown {
  if (typeof value !== "string") return value;
  // Strip common separators and whitespace, then uppercase (e.g. "BTC/USDT" -> "BTCUSDT").
  const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.length >= 5 && cleaned.length <= 24 ? cleaned : value;
}
function normalizeDecisionConfidence(value: unknown): number | null | undefined {
  const num = coerceDecisionNumber(value);
  if (num === null || num === undefined) return num;
  // DeepSeek sometimes returns a percentage (0-100) instead of a 0-1 fraction.
  if (num > 1) return Math.min(1, num / 100);
  return Math.max(0, Math.min(1, num));
}
function normalizeDecisionHoldCategory(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const category = value.trim().toLowerCase();
  // Coerce unknown categories to null rather than passing through an invalid string.
  return (HOLD_CATEGORIES as readonly string[]).includes(category) ? category : null;
}
function normalizeDecisionDirection(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const direction = value.trim().toLowerCase();
  if (direction === "up" || direction === "down" || direction === "flat") return direction;
  // Tolerate common DeepSeek phrasing for a flat/neutral outlook.
  if (["sideways", "neutral", "range", "sideways", "consolidation", "mixed", "uncertain"].includes(direction)) return "flat";
  return value;
}
function normalizeDeepSeekDecision(raw: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...raw };
  normalized.action = normalizeDecisionAction(normalized.action);
  normalized.symbol = normalizeDecisionSymbol(normalized.symbol);
  const confidence = normalizeDecisionConfidence(normalized.confidence);
  if (confidence !== undefined) normalized.confidence = confidence;
  // DeepSeek sometimes uses "rationale" instead of "reason"; map it over.
  if (normalized.reason === undefined || normalized.reason === null || normalized.reason === "") {
    if (typeof normalized.rationale === "string" && normalized.rationale.trim() !== "") {
      normalized.reason = normalized.rationale;
    }
  }
  // DeepSeek frequently omits stop/target for HOLD decisions; default them to null
  // so the schema's required nullable fields still validate.
  const stopPrice = coerceDecisionNumber(normalized.stopPrice);
  normalized.stopPrice = stopPrice === undefined ? null : stopPrice;
  const targetPrice = coerceDecisionNumber(normalized.targetPrice);
  normalized.targetPrice = targetPrice === undefined ? null : targetPrice;
  normalized.holdCategory = normalizeDecisionHoldCategory(normalized.holdCategory);
  if (normalized.nextCandle && typeof normalized.nextCandle === "object") {
    const candle = normalized.nextCandle as Record<string, unknown>;
    const probability = coerceDecisionNumber(candle.probability);
    if (probability !== undefined) candle.probability = probability;
    candle.direction = normalizeDecisionDirection(candle.direction);
  }
  return normalized;
}
export function parseDeepSeekDecisionContent(content: string | null | undefined, symbol: string): BotDecision {
  const normalized = content?.trim();
  if (!normalized) return noTradeDeepSeekDecision(symbol, "DeepSeek returned no decision content; no simulated order was created");
  // Strip optional markdown code fences that some models add around JSON.
  let json = normalized.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let rawObject: Record<string, unknown> | null = null;
  try {
    rawObject = JSON.parse(json) as Record<string, unknown>;
  } catch {
    // If direct parse failed, search for the first valid JSON object in the text
    const jsonMatch = normalized.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        rawObject = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      } catch {
        rawObject = null;
      }
    }
  }
  if (!rawObject || typeof rawObject !== "object") {
    console.warn("[DeepSeek] Malformed JSON response:", normalized.slice(0, 500));
    return noTradeDeepSeekDecision(symbol, "DeepSeek returned malformed JSON; no simulated order was created");
  }
  const normalizedObject = normalizeDeepSeekDecision(rawObject);
  // If nextCandle is present but fails to validate, drop it rather than
  // letting a bad candle sub-object poison the whole decision.
  if (normalizedObject.nextCandle !== null && normalizedObject.nextCandle !== undefined) {
    const candleResult = z.object({
      direction: z.enum(["up", "down", "flat"]),
      probability: z.number().min(0).max(1),
      reason: z.string().min(1).max(280),
    }).safeParse(normalizedObject.nextCandle);
    if (!candleResult.success) {
      console.warn("[DeepSeek] nextCandle field dropped (invalid):", normalizedObject.nextCandle);
      normalizedObject.nextCandle = null;
    }
  }
  const parsed = botDecisionSchema.safeParse(normalizedObject);
  if (parsed.success) return parsed.data;
  // Log the exact Zod error so we can diagnose recurring schema mismatches.
  console.warn("[DeepSeek] Schema validation failed. Raw:", JSON.stringify(normalizedObject).slice(0, 600), "Errors:", parsed.error.issues);
  return noTradeDeepSeekDecision(symbol, "DeepSeek returned an invalid decision schema; no simulated order was created");
}
export function constrainDecisionToConfiguredSymbols(decision: BotDecision, configuredSymbols: string[]): BotDecision { const fallbackSymbol = configuredSymbols[0] ?? BOT_DEFAULTS.symbols[0]; return configuredSymbols.includes(decision.symbol) ? decision : noTradeDeepSeekDecision(fallbackSymbol, "DeepSeek did not return exactly one configured pair; the run is recorded as hold and no simulated order was created"); }
export function toUtcDateKey(now = new Date()) { return now.toISOString().slice(0, 10); }
export function isDailyLossStopped(account: BotAccount, stopPct: number) { return account.equity <= account.dailyStartEquity * (1 - stopPct / 100); }

const enoughBars = (context: ScalpMarketContext | undefined) => Boolean(context && context.oneMinute.bars >= 12 && context.fiveMinute.bars >= 12 && context.fifteenMinute.bars >= 12);
// Stop/target distances are normalized inside buildRiskManagedPaperOrder, so a
// genuine buy decision is never blocked here by the numbers returned by the model.
const strategyPriceGuards = (_decision: BotDecision, _markPrice: number) => undefined;

export function deriveHoldCategory(context: ScalpMarketContext | undefined): HoldCategory { if (!enoughBars(context)) return "model_unavailable"; const values = [context!.oneMinute.changePct ?? 0, context!.fiveMinute.changePct ?? 0, context!.fifteenMinute.changePct ?? 0]; const meaningful = .04; if (values.every(value => Math.abs(value) < meaningful)) return "low_volatility"; const hasUp = values.some(value => value > meaningful); const hasDown = values.some(value => value < -meaningful); return hasUp && hasDown ? "timeframe_conflict" : "no_qualified_setup"; }
export function holdDiagnostic(category: HoldCategory | null | undefined) { return ({ timeframe_conflict: "Hold: 1m, 5m, and 15m momentum conflict", low_volatility: "Hold: low volatility inside the neutral zone", no_qualified_setup: "Hold: no qualified setup under the selected paper strategy", risk_guard: "Hold: paper risk guard prevented a new order", model_unavailable: "Hold: model or provider context was unavailable" } as const)[category ?? "model_unavailable"]; }
export function inferQuantitativeNextCandle(context: ScalpMarketContext | undefined, markPrice?: number): { direction: "up" | "down" | "flat"; probability: number; reason: string } {
  if (!context?.oneMinute.indicators) {
    return { direction: "flat", probability: 0.50, reason: "Awaiting sufficient quantitative indicators" };
  }
  const ind = context.oneMinute.indicators;
  const rsi = ind.rsi ?? 50;
  const trend = ind.trend;
  const stochRsi = ind.stochRsi ?? 50;
  const rvol = ind.rvol ?? 1.0;
  const price = markPrice ?? ind.vwap ?? 0;

  // Extreme overbought or rejection at upper Bollinger Band
  if ((rsi > 70 || stochRsi > 85 || (ind.bbUpper && price > ind.bbUpper)) && trend !== "bullish") {
    return { direction: "down", probability: 0.68, reason: `Overbought 14 RSI (${rsi}) and StochRSI (${stochRsi}) with downward mean reversion pressure` };
  }
  // Extreme oversold or bounce off lower Bollinger Band
  if ((rsi < 30 || stochRsi < 15 || (ind.bbLower && price < ind.bbLower)) && trend !== "bearish") {
    return { direction: "up", probability: 0.68, reason: `Oversold 14 RSI (${rsi}) and StochRSI (${stochRsi}) near lower band with potential bounce` };
  }
  // Strong trend alignment
  if (trend === "bullish" && (ind.ema9 ?? 0) > (ind.ema21 ?? 0) && rvol >= 1.05) {
    return { direction: "up", probability: 0.72, reason: `Bullish EMA 9/21 alignment confirmed by volume (${rvol}× RVOL)` };
  }
  if (trend === "bearish" && (ind.ema9 ?? 0) < (ind.ema21 ?? 0) && rvol >= 1.05) {
    return { direction: "down", probability: 0.72, reason: `Bearish EMA 9/21 alignment with selling pressure (${rvol}× RVOL)` };
  }
  return { direction: "flat", probability: 0.58, reason: `Consolidating inside range (14 RSI ${rsi}, neutral volume delta)` };
}

export function attachHoldDiagnostic(decision: BotDecision, context: ScalpMarketContext | undefined): BotDecision { return decision.action === "hold" ? { ...decision, holdCategory: decision.holdCategory ?? deriveHoldCategory(context) } : decision; }
export type RangeRegime = "range" | "trend" | "unavailable";
export function detectRangeRegime(context: ScalpMarketContext | undefined): RangeRegime { if (!enoughBars(context)) return "unavailable"; const five = context!.fiveMinute.changePct ?? 0, fifteen = context!.fifteenMinute.changePct ?? 0; return Math.abs(five) <= .4 && Math.abs(fifteen) <= .7 ? "range" : "trend"; }
export function rangeInactiveHold(symbol: string, regime: RangeRegime): BotDecision { return { action: "hold", symbol, confidence: 0, stopPrice: null, targetPrice: null, reason: regime === "trend" ? "Range Reversion mode inactive: 5m/15m movement is trending rather than contained" : "Range Reversion mode inactive: sufficient provider bars are unavailable", nextCandle: null, holdCategory: regime === "unavailable" ? "model_unavailable" : "no_qualified_setup" }; }

// Ultra-Fast Micro-Scalping Defaults (exits in seconds on volatility spikes):
export const DEFAULT_STOP_LOSS_PCT = 0.18;
export const DEFAULT_TAKE_PROFIT_PCT = 0.15;

export function deterministicScalpDecision(context: ScalpMarketContext | undefined, symbol: string, markPrice: number): BotDecision | null {
  if (!context || !Number.isFinite(markPrice) || markPrice <= 0) return null;
  const ind = context.oneMinute.indicators;
  if (!ind) return null;
  const one = context.oneMinute.changePct ?? 0;
  const five = context.fiveMinute.changePct ?? 0;
  const fifteen = context.fifteenMinute.changePct ?? 0;
  const rvol = ind.rvol ?? 1.0;
  const rsi = ind.rsi ?? 50;

  // Bear market guard: if 15m is falling sharply, avoid opening new longs.
  if (fifteen < -0.45) return null;

  const emaBullish = ind.trend === "bullish" || (ind.ema9 !== null && ind.ema21 !== null && ind.ema9 > ind.ema21);
  const allTimeframesPositive = one > 0.01 && (five > 0 || fifteen > -0.1);
  const volumeOk = rvol >= 1.0;
  const rsiOk = rsi >= 38 && rsi <= 68;

  if (!emaBullish || !allTimeframesPositive || !volumeOk || !rsiOk) return null;

  const stopPrice = Number((markPrice * (1 - DEFAULT_STOP_LOSS_PCT / 100)).toFixed(6));
  const targetPrice = Number((markPrice * (1 + DEFAULT_TAKE_PROFIT_PCT / 100)).toFixed(6));
  return {
    action: "buy",
    symbol,
    confidence: 0.82,
    stopPrice,
    targetPrice,
    reason: "Scalp Momentum: 1m trigger confirmed by multi-timeframe alignment, healthy RSI, and bullish EMA 9/21",
    nextCandle: { direction: "up", probability: 0.78, reason: "bullish momentum with volume expansion across timeframes" },
    holdCategory: null,
  };
}

export function deterministicFastMomentumDecision(context: ScalpMarketContext | undefined, symbol: string, markPrice: number): BotDecision | null {
  if (!context || !Number.isFinite(markPrice) || markPrice <= 0) return null;
  const ind = context.oneMinute.indicators;
  if (!ind) return null;
  const one = context.oneMinute.changePct ?? 0;
  const five = context.fiveMinute.changePct ?? 0;
  const fifteen = context.fifteenMinute.changePct ?? 0;
  const rvol = ind.rvol ?? 1.0;
  const rsi = ind.rsi ?? 50;

  if (fifteen < -0.35) return null;

  const emaBullish = ind.trend === "bullish" || (ind.ema9 !== null && ind.ema21 !== null && ind.ema9 >= ind.ema21);
  const fastTrigger = one > 0.02 && (five > 0 || fifteen > -0.15);
  const volumeOk = rvol >= 1.0;
  const rsiOk = rsi >= 40 && rsi <= 72;

  if (!emaBullish || !fastTrigger || !volumeOk || !rsiOk) return null;

  const stopPrice = Number((markPrice * (1 - DEFAULT_STOP_LOSS_PCT / 100)).toFixed(6));
  const targetPrice = Number((markPrice * (1 + DEFAULT_TAKE_PROFIT_PCT / 100)).toFixed(6));
  return {
    action: "buy",
    symbol,
    confidence: 0.80,
    stopPrice,
    targetPrice,
    reason: "Fast Momentum: early 1m breakout confirmed by multi-timeframe follow-through and volume support",
    nextCandle: { direction: "up", probability: 0.75, reason: "fast breakout momentum with volume backing" },
    holdCategory: null,
  };
}

export function deterministicRangeReversionDecision(context: ScalpMarketContext | undefined, symbol: string, markPrice: number): BotDecision | null {
  if (!context || !Number.isFinite(markPrice) || markPrice <= 0) return null;
  if (detectRangeRegime(context) !== "range") return null;
  const ind = context.oneMinute.indicators;
  if (!ind) return null;
  const rsi = ind.rsi ?? 50;
  const stochRsi = ind.stochRsi ?? 50;
  const bbLower = ind.bbLower;

  // Mean reversion long: RSI oversold or price tested lower Bollinger band
  const nearLowerBand = bbLower ? markPrice <= bbLower * 1.003 : false;
  const isOversold = rsi <= 40 || stochRsi <= 28 || nearLowerBand;
  const oneChange = context.oneMinute.changePct ?? 0;
  const notFreefalling = oneChange >= -0.20; // not in uncontrolled crash

  if (!isOversold || !notFreefalling) return null;

  const stopPrice = Number((markPrice * (1 - 0.18 / 100)).toFixed(6));
  const targetPrice = Number((markPrice * (1 + 0.15 / 100)).toFixed(6));
  return {
    action: "buy",
    symbol,
    confidence: 0.78,
    stopPrice,
    targetPrice,
    reason: "Range Reversion: oversold boundary bounce setup inside established non-trending range",
    nextCandle: { direction: "up", probability: 0.72, reason: "oversold mean-reversion bounce toward range midpoint" },
    holdCategory: null,
  };
}

export function deterministicVwapPullbackDecision(context: ScalpMarketContext | undefined, symbol: string, markPrice: number): BotDecision | null {
  if (!context || !Number.isFinite(markPrice) || markPrice <= 0) return null;
  const ind = context.oneMinute.indicators;
  if (!ind || !ind.vwap) return null;
  const vwap = ind.vwap;
  const rvol = ind.rvol ?? 1.0;
  const rsi = ind.rsi ?? 50;
  const fifteen = context.fifteenMinute.changePct ?? 0;

  if (fifteen < -0.30) return null;

  // VWAP pullback: price within 0.03% to 0.50% above VWAP with healthy RSI and solid volume
  const priceAboveVwapPct = ((markPrice - vwap) / vwap) * 100;
  const nearVwap = priceAboveVwapPct >= 0.02 && priceAboveVwapPct <= 0.55;
  const rsiOk = rsi >= 38 && rsi <= 62;
  const volumeOk = rvol >= 1.0;

  if (!nearVwap || !rsiOk || !volumeOk) return null;

  const stopPrice = Number((markPrice * (1 - 0.18 / 100)).toFixed(6));
  const targetPrice = Number((markPrice * (1 + DEFAULT_TAKE_PROFIT_PCT / 100)).toFixed(6));
  return {
    action: "buy",
    symbol,
    confidence: 0.80,
    stopPrice,
    targetPrice,
    reason: "VWAP Pullback: shallow dip to institutional VWAP support with active buyers stepping in",
    nextCandle: { direction: "up", probability: 0.74, reason: "support bounce off intraday VWAP baseline" },
    holdCategory: null,
  };
}

export function deterministicBbSqueezeDecision(context: ScalpMarketContext | undefined, symbol: string, markPrice: number): BotDecision | null {
  if (!context || !Number.isFinite(markPrice) || markPrice <= 0) return null;
  const ind = context.oneMinute.indicators;
  if (!ind || ind.bbWidth === null) return null;
  const one = context.oneMinute.changePct ?? 0;
  const fifteen = context.fifteenMinute.changePct ?? 0;
  const rvol = ind.rvol ?? 1.0;
  const rsi = ind.rsi ?? 50;

  if (fifteen < -0.25) return null;

  // Squeeze condition: BB width compressed (<= 0.75%), breaking out upward with volume
  const isCompressed = ind.bbWidth <= 0.75;
  const breakoutUp = one >= 0.02;
  const volumeExpansion = rvol >= 1.10;
  const rsiHealthy = rsi >= 42 && rsi <= 70;

  if (!isCompressed || !breakoutUp || !volumeExpansion || !rsiHealthy) return null;

  const stopPrice = Number((markPrice * (1 - DEFAULT_STOP_LOSS_PCT / 100)).toFixed(6));
  const targetPrice = Number((markPrice * (1 + 0.15 / 100)).toFixed(6));
  return {
    action: "buy",
    symbol,
    confidence: 0.82,
    stopPrice,
    targetPrice,
    reason: "BB Squeeze Breakout: volatility compression breakout accompanied by surging volume",
    nextCandle: { direction: "up", probability: 0.77, reason: "volatility expansion following tight band squeeze" },
    holdCategory: null,
  };
}

export function deterministicStrategyDecision(strategy: PaperBotStrategy, context: ScalpMarketContext | undefined, symbol: string, markPrice: number): BotDecision | null {
  switch (strategy) {
    case "fast_momentum":
      return deterministicFastMomentumDecision(context, symbol, markPrice);
    case "range_reversion":
      return deterministicRangeReversionDecision(context, symbol, markPrice);
    case "vwap_pullback":
      return deterministicVwapPullbackDecision(context, symbol, markPrice);
    case "bb_squeeze":
      return deterministicBbSqueezeDecision(context, symbol, markPrice);
    case "scalp_momentum":
    default:
      return deterministicScalpDecision(context, symbol, markPrice);
  }
}

export function buildRiskManagedPaperOrder(input: { decision: BotDecision; markPrice: number; account: BotAccount; riskPct: number; maxOpenPositions: number }) {
  const { decision, markPrice, account, riskPct, maxOpenPositions } = input;
  if (!Number.isFinite(markPrice) || markPrice <= 0) return { allowed: false as const, reason: "Current provider mark is unavailable" };
  const position = account.positions.find(item => item.symbol === decision.symbol);
  if (decision.action === "hold") return { allowed: false as const, reason: "AI selected hold" };
  if (decision.action === "sell") {
    if (!position || position.quantity <= 0) return { allowed: false as const, reason: "No active simulated position to sell for this symbol" };
    return { allowed: true as const, side: "sell" as const, quantity: position.quantity, stopPrice: null, targetPrice: decision.targetPrice };
  }

  // If position already exists, allow scaling in if total position value is under 35% of equity
  if (position && position.quantity > 0) {
    const currentPositionValue = position.quantity * markPrice;
    if (currentPositionValue >= account.equity * 0.35) {
      return { allowed: false as const, reason: `Position already held for ${decision.symbol} (${position.quantity.toFixed(4)} @ avg $${position.averageCost.toFixed(2)})` };
    }
  }

  const effectiveMaxPositions = Math.max(maxOpenPositions, 6);
  if (!position && account.positions.length >= effectiveMaxPositions) {
    return { allowed: false as const, reason: "Maximum open simulated positions reached" };
  }

  const defaultStop = Number((markPrice * (1 - DEFAULT_STOP_LOSS_PCT / 100)).toFixed(6));
  const defaultTarget = Number((markPrice * (1 + DEFAULT_TAKE_PROFIT_PCT / 100)).toFixed(6));

  const candidateStop = decision.stopPrice && decision.stopPrice < markPrice && decision.stopPrice >= markPrice * 0.990
    ? decision.stopPrice
    : defaultStop;
  const candidateTarget = decision.targetPrice && decision.targetPrice > markPrice && decision.targetPrice <= markPrice * 1.015
    ? decision.targetPrice
    : defaultTarget;

  const effectiveStop = candidateStop;
  const effectiveTarget = candidateTarget;

  // Risk-managed position sizing with confidence scaling
  const confidenceMultiplier = decision.confidence >= 0.80 ? 1.2 : decision.confidence >= 0.70 ? 1.0 : 0.7;
  const effectiveRiskPct = Math.max(0.3, riskPct * confidenceMultiplier);
  const riskBudget = account.equity * (effectiveRiskPct / 100);
  const unitRisk = Math.max(markPrice * 0.0018, markPrice - effectiveStop);
  const maxSpend = Math.min(account.buyingPower * 0.85, account.equity * 0.25);
  const quantity = Math.min(riskBudget / unitRisk, maxSpend / markPrice);

  if (!Number.isFinite(quantity) || quantity <= 0 || (quantity * markPrice) < 5) {
    if (account.buyingPower >= 10) {
      const fallbackQty = Math.min((account.equity * 0.02) / markPrice, account.buyingPower * 0.5 / markPrice);
      if (fallbackQty * markPrice >= 5) {
        return { allowed: true as const, side: "buy" as const, quantity: fallbackQty, stopPrice: effectiveStop, targetPrice: effectiveTarget };
      }
    }
    return { allowed: false as const, reason: "Insufficient simulated buying power to open new position" };
  }
  return { allowed: true as const, side: "buy" as const, quantity, stopPrice: effectiveStop, targetPrice: effectiveTarget };
}

export function assessScalpingDecision(input: { decision: BotDecision; markPrice: number; context: ScalpMarketContext | undefined }) {
  const { decision, markPrice } = input;
  if (decision.action === "hold") return { allowed: true as const };
  if (!Number.isFinite(markPrice) || markPrice <= 0) return { allowed: false as const, reason: "Valid live price is required" };
  return { allowed: true as const };
}

export function assessFastMomentumDecision(input: { decision: BotDecision; markPrice: number; context: ScalpMarketContext | undefined }) {
  const { decision, markPrice } = input;
  if (decision.action === "hold") return { allowed: true as const };
  if (!Number.isFinite(markPrice) || markPrice <= 0) return { allowed: false as const, reason: "Valid live price is required" };
  return { allowed: true as const };
}

export function assessRangeReversionDecision(input: { decision: BotDecision; markPrice: number; context: ScalpMarketContext | undefined }) {
  const { decision, markPrice } = input;
  if (decision.action === "hold") return { allowed: true as const };
  if (!Number.isFinite(markPrice) || markPrice <= 0) return { allowed: false as const, reason: "Valid live price is required" };
  return { allowed: true as const };
}

export function assessVwapPullbackDecision(input: { decision: BotDecision; markPrice: number; context: ScalpMarketContext | undefined }) {
  const { decision, markPrice } = input;
  if (decision.action === "hold") return { allowed: true as const };
  if (!Number.isFinite(markPrice) || markPrice <= 0) return { allowed: false as const, reason: "Valid live price is required" };
  return { allowed: true as const };
}

export function assessBbSqueezeDecision(input: { decision: BotDecision; markPrice: number; context: ScalpMarketContext | undefined }) {
  const { decision, markPrice } = input;
  if (decision.action === "hold") return { allowed: true as const };
  if (!Number.isFinite(markPrice) || markPrice <= 0) return { allowed: false as const, reason: "Valid live price is required" };
  return { allowed: true as const };
}

export function assessNextCandleConfirmation(decision: BotDecision): { allowed: true } | { allowed: false; reason: string } {
  if (decision.action !== "buy" || !decision.nextCandle) return { allowed: true };
  const { direction } = decision.nextCandle;
  if (direction === "down") {
    return {
      allowed: false,
      reason: `Next candle forecast is Down — Buy held until an Up candle forecast appears`
    };
  }
  return { allowed: true };
}

export function assessPaperBotDecision(input: { strategy: PaperBotStrategy; decision: BotDecision; markPrice: number; context: ScalpMarketContext | undefined }) {
  if (!Number.isFinite(input.markPrice) || input.markPrice <= 0) return { allowed: false as const, reason: "Valid mark price is required" };
  if (input.decision.action === "hold") return { allowed: true as const };

  const candleCheck = assessNextCandleConfirmation(input.decision);
  if (!candleCheck.allowed) return { allowed: false as const, reason: candleCheck.reason };

  return { allowed: true as const };
}

export async function requestDeepSeekDecision(input: { marketContext: unknown; configuredSymbols: string[]; strategy?: PaperBotStrategy; fetchImpl?: typeof fetch }): Promise<BotDecision> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DeepSeek analysis is not configured");
  const fetchImpl = input.fetchImpl ?? fetch;
  const configuredSymbols = input.configuredSymbols.filter(symbol => /^[A-Z0-9]{5,24}$/.test(symbol));
  const fallbackSymbol = configuredSymbols[0] ?? BOT_DEFAULTS.symbols[0];
  const strategy = input.strategy ?? PAPER_SCALPING_STRATEGY;
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  const strategyGuidance = strategyPrompt(strategy);
  const systemPrompt = `You are a high-speed automated crypto trading algorithm for Binance Spot.
Your PRIMARY task is to forecast the immediate next 1-minute candle direction ("up", "down", or "flat") and execute trades without hesitation:

Direct Trading Rules:
1. Predict "nextCandle": {"direction": "up" | "down" | "flat", "probability": 0.50-1.0, "reason": "reason"}.
2. If your next candle forecast is "up": Set action = "buy" (confidence >= 0.70). Provide stopPrice (-0.18%) and targetPrice (+0.15%).
3. If your next candle forecast is "down" and an open position is held: Set action = "sell".
4. If your next candle forecast is "flat": Set action = "hold".

Active Strategy Context: ${strategyGuidance}

Return strictly a single JSON object:
{"action":"buy"|"sell"|"hold","symbol":"BTCUSDT","confidence":0.78,"stopPrice":99.82,"targetPrice":100.15,"reason":"Next candle forecast UP with immediate momentum","holdCategory":null,"nextCandle":{"direction":"up"|"down"|"flat","probability":0.78,"reason":"1-minute outlook reason"}}`;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetchImpl("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          stream: false,
          max_tokens: 250,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Return JSON decision for one allowed symbol: ${JSON.stringify(configuredSymbols)}. Live market context: ${JSON.stringify(input.marketContext)}` }
          ]
        }),
        signal: AbortSignal.timeout(4_500)
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`DeepSeek analysis request failed (${response.status}): ${errorText}`);
      }
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
      return constrainDecisionToConfiguredSymbols(parseDeepSeekDecisionContent(payload.choices?.[0]?.message?.content, fallbackSymbol), configuredSymbols);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === 0) {
        await new Promise(res => setTimeout(res, 200));
      }
    }
  }
  throw lastError ?? new Error("DeepSeek analysis request failed");
}

