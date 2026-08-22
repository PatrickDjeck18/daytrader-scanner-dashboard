import { z } from "zod";

export const BOT_DEFAULTS = { market: "global-spot", symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT"], scheduleMinutes: 5, riskPct: 1, dailyLossStopPct: 3, maxOpenPositions: 3 } as const;
export const PAPER_SCALPING_STRATEGY = "scalp_momentum" as const;
export const botDecisionSchema = z.object({ action: z.enum(["buy", "sell", "hold"]), symbol: z.string().regex(/^[A-Z0-9]{5,24}$/), confidence: z.number().min(0).max(1), stopPrice: z.number().positive().nullable(), targetPrice: z.number().positive().nullable(), reason: z.string().min(1).max(600), nextCandle: z.object({ direction: z.enum(["up", "down", "flat"]), probability: z.number().min(0).max(1), reason: z.string().min(1).max(280) }).nullable().optional() });
export type BotDecision = z.infer<typeof botDecisionSchema>;
export type BotAccount = { equity: number; buyingPower: number; dailyStartEquity: number; positions: Array<{ symbol: string; quantity: number; averageCost: number }> };
export type ScalpMarketContext = { oneMinute: { bars: number; changePct: number | null }; fiveMinute: { bars: number; changePct: number | null }; fifteenMinute: { bars: number; changePct: number | null } };

export function noTradeDeepSeekDecision(symbol: string, reason: string): BotDecision {
  return { action: "hold", symbol, confidence: 0, stopPrice: null, targetPrice: null, reason, nextCandle: null };
}

export function parseDeepSeekDecisionContent(content: string | null | undefined, symbol: string): BotDecision {
  const normalized = content?.trim();
  if (!normalized) return noTradeDeepSeekDecision(symbol, "DeepSeek returned no decision content; no simulated order was created");
  const json = normalized.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = botDecisionSchema.safeParse(JSON.parse(json));
    if (parsed.success) return parsed.data;
    return noTradeDeepSeekDecision(symbol, "DeepSeek returned an invalid decision schema; no simulated order was created");
  } catch {
    return noTradeDeepSeekDecision(symbol, "DeepSeek returned malformed JSON; no simulated order was created");
  }
}

export function constrainDecisionToConfiguredSymbols(decision: BotDecision, configuredSymbols: string[]): BotDecision {
  const fallbackSymbol = configuredSymbols[0] ?? BOT_DEFAULTS.symbols[0];
  if (configuredSymbols.includes(decision.symbol)) return decision;
  return noTradeDeepSeekDecision(fallbackSymbol, "DeepSeek did not return exactly one configured pair; the run is recorded as hold and no simulated order was created");
}

export function toUtcDateKey(now = new Date()) { return now.toISOString().slice(0, 10); }
export function isDailyLossStopped(account: BotAccount, stopPct: number) { return account.equity <= account.dailyStartEquity * (1 - stopPct / 100); }
export function buildRiskManagedPaperOrder(input: { decision: BotDecision; markPrice: number; account: BotAccount; riskPct: number; maxOpenPositions: number }) {
  const { decision, markPrice, account, riskPct, maxOpenPositions } = input;
  if (!Number.isFinite(markPrice) || markPrice <= 0) return { allowed: false as const, reason: "Current provider mark is unavailable" };
  const position = account.positions.find(item => item.symbol === decision.symbol);
  if (decision.action === "hold") return { allowed: false as const, reason: "AI selected hold" };
  if (decision.action === "sell") {
    if (!position || position.quantity <= 0) return { allowed: false as const, reason: "No simulated spot position is available to sell" };
    return { allowed: true as const, side: "sell" as const, quantity: position.quantity, stopPrice: null, targetPrice: decision.targetPrice };
  }
  if (position) return { allowed: false as const, reason: "A simulated position already exists for this pair" };
  if (account.positions.length >= maxOpenPositions) return { allowed: false as const, reason: "Maximum open simulated positions reached" };
  if (!decision.stopPrice || decision.stopPrice >= markPrice) return { allowed: false as const, reason: "Buy decisions require a provider-valid stop below the current mark" };
  const riskBudget = account.equity * (riskPct / 100);
  const unitRisk = markPrice - decision.stopPrice;
  const quantity = Math.min(riskBudget / unitRisk, account.buyingPower / markPrice, (account.equity * 0.2) / markPrice);
  if (!Number.isFinite(quantity) || quantity <= 0) return { allowed: false as const, reason: "Insufficient simulated buying power" };
  return { allowed: true as const, side: "buy" as const, quantity, stopPrice: decision.stopPrice, targetPrice: decision.targetPrice };
}

export function assessScalpingDecision(input: { decision: BotDecision; markPrice: number; context: ScalpMarketContext | undefined }) {
  const { decision, markPrice, context } = input;
  if (decision.action === "hold") return { allowed: true as const };
  if (decision.confidence < .6) return { allowed: false as const, reason: "Scalping filter requires at least 0.60 model confidence" };
  if (!context || context.oneMinute.bars < 12 || context.fiveMinute.bars < 12 || context.fifteenMinute.bars < 12) return { allowed: false as const, reason: "Scalping filter requires sufficient 1m, 5m, and 15m provider bars" };
  const one = context.oneMinute.changePct ?? 0; const five = context.fiveMinute.changePct ?? 0; const fifteen = context.fifteenMinute.changePct ?? 0;
  if (decision.action === "buy") {
    if (one < .05 || five < 0 || fifteen < 0) return { allowed: false as const, reason: "Scalping buy requires positive 1m momentum with 5m/15m confirmation" };
    if (!decision.stopPrice || !decision.targetPrice || decision.stopPrice >= markPrice || decision.targetPrice <= markPrice) return { allowed: false as const, reason: "Scalping buy requires a stop below and target above the provider mark" };
    const riskPct = ((markPrice - decision.stopPrice) / markPrice) * 100; const rewardRisk = (decision.targetPrice - markPrice) / (markPrice - decision.stopPrice);
    if (riskPct < .03 || riskPct > .75) return { allowed: false as const, reason: "Scalping stop distance must be between 0.03% and 0.75%" };
    if (rewardRisk < 1.2) return { allowed: false as const, reason: "Scalping target requires at least 1.2:1 simulated reward-to-risk" };
  } else if (one > -.05 || five > 0 || fifteen > 0) return { allowed: false as const, reason: "Scalping sell requires negative 1m momentum with 5m/15m confirmation" };
  return { allowed: true as const };
}

export async function requestDeepSeekDecision(input: { marketContext: unknown; configuredSymbols: string[]; fetchImpl?: typeof fetch }): Promise<BotDecision> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DeepSeek analysis is not configured");
  const fetchImpl = input.fetchImpl ?? fetch;
  const configuredSymbols = input.configuredSymbols.filter(symbol => /^[A-Z0-9]{5,24}$/.test(symbol));
  const fallbackSymbol = configuredSymbols[0] ?? BOT_DEFAULTS.symbols[0];
  const response = await fetchImpl("https://api.deepseek.com/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: "deepseek-v4-flash", stream: false, thinking: { type: "disabled" }, max_tokens: 700, response_format: { type: "json_object" }, messages: [{ role: "system", content: "You analyze provider-returned Binance spot market context for a paper-only scalp-momentum simulation. 1m provides execution momentum; 5m and 15m must confirm direction. For a buy, propose a stop 0.03% to 0.75% below mark and a target with at least 1.2:1 reward-to-risk. For a sell, only propose closing an existing simulated spot position. Use hold whenever confirmation, price availability, or setup quality is insufficient. Also include an experimental nextCandle estimate for the next one-minute candle using only direction up/down/flat, probability 0 to 1, and a brief reason. This is uncertain context only and MUST NOT be presented as certainty or used to override any trade guard. Return exactly one non-empty JSON object and no markdown. The symbol field MUST contain exactly one configured symbol from the allowed list, never a comma-separated list or an external pair. Required JSON shape: {\"action\":\"hold\",\"symbol\":\"BTCUSDT\",\"confidence\":0,\"stopPrice\":null,\"targetPrice\":null,\"reason\":\"brief reason\",\"nextCandle\":{\"direction\":\"flat\",\"probability\":0.5,\"reason\":\"uncertain momentum\"}}. Never return blank. Never imply a real order, account action, leverage, transfer, or financial certainty." }, { role: "user", content: `Return JSON for exactly one allowed symbol: ${JSON.stringify(configuredSymbols)}. Market context: ${JSON.stringify(input.marketContext)}` }] }), signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`DeepSeek analysis request failed (${response.status})`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
  const content = payload.choices?.[0]?.message?.content;
  return constrainDecisionToConfiguredSymbols(parseDeepSeekDecisionContent(content, fallbackSymbol), configuredSymbols);
}
