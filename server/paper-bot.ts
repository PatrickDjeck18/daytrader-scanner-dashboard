import { z } from "zod";

export const BOT_DEFAULTS = { market: "global-spot", symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT"], scheduleMinutes: 5, riskPct: 1, dailyLossStopPct: 3, maxOpenPositions: 3 } as const;
export const botDecisionSchema = z.object({ action: z.enum(["buy", "sell", "hold"]), symbol: z.string().regex(/^[A-Z0-9]{5,24}$/), confidence: z.number().min(0).max(1), stopPrice: z.number().positive().nullable(), targetPrice: z.number().positive().nullable(), reason: z.string().min(1).max(600) });
export type BotDecision = z.infer<typeof botDecisionSchema>;
export type BotAccount = { equity: number; buyingPower: number; dailyStartEquity: number; positions: Array<{ symbol: string; quantity: number; averageCost: number }> };

export function noTradeDeepSeekDecision(symbol: string, reason: string): BotDecision {
  return { action: "hold", symbol, confidence: 0, stopPrice: null, targetPrice: null, reason };
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

export async function requestDeepSeekDecision(input: { marketContext: unknown; symbol: string; fetchImpl?: typeof fetch }): Promise<BotDecision> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DeepSeek analysis is not configured");
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.deepseek.com/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: "deepseek-v4-flash", stream: false, thinking: { type: "disabled" }, max_tokens: 700, response_format: { type: "json_object" }, messages: [{ role: "system", content: "You analyze provider-returned Binance spot market context for a paper-trading simulation only. Return exactly one non-empty JSON object and no markdown. Required JSON shape: {\"action\":\"hold\",\"symbol\":\"BTCUSDT\",\"confidence\":0,\"stopPrice\":null,\"targetPrice\":null,\"reason\":\"brief reason\"}. action must be buy, sell, or hold. Never return blank. Never imply a real order, account action, leverage, transfer, or financial certainty." }, { role: "user", content: `Return JSON for symbol ${input.symbol}. Market context: ${JSON.stringify(input.marketContext)}` }] }), signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`DeepSeek analysis request failed (${response.status})`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
  const content = payload.choices?.[0]?.message?.content;
  return parseDeepSeekDecisionContent(content, input.symbol);
}
