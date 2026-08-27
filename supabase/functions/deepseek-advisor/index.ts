// Supabase Edge Function: deepseek-advisor
// Securely analyzes market data using DeepSeek AI without exposing credentials to the client

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!deepseekKey) {
      return new Response(
        JSON.stringify({ error: "DEEPSEEK_API_KEY secret is not configured in Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { symbol, market, interval, bars, indicators, strategy } = await req.json();

    const strategyAddendum = strategy === "vwap_pullback"
      ? "VWAP Pullback mode: Trigger only when price is 0.05–0.30% above VWAP (buy) or below VWAP (sell) on the 1m chart. Require RSI < 60 for buys and RVOL > 1.2 to confirm institutional participation. Use VWAP as the dynamic support/resistance anchor."
      : strategy === "bb_squeeze"
      ? "BB Squeeze mode: Require a squeeze condition (BB width < 0.5% of price) before entry. Trigger buy only on a price break ABOVE the upper Bollinger Band, sell only BELOW the lower band. RVOL must exceed 1.4x to confirm momentum expansion. ATR-based stops are mandatory."
      : strategy === "range_reversion"
      ? "Range Reversion mode: Only trade when 5m/15m show contained movement (range-bound). Buy on 1m pullbacks to VWAP or lower BB band, sell on bounces."
      : strategy === "fast_momentum"
      ? "Fast Momentum mode: Require 1m strength with at least one of 5m/15m confirming outside the ±0.04% neutral zone. Check RVOL > 1.2 and EMA9 > EMA21 for buys."
      : "Scalp Momentum mode: Require positive 1m momentum with BOTH 5m AND 15m confirmation. EMA9 > EMA21 required for buy entries.";

    const systemPrompt = `You are an elite quantitative day trading advisor for paper simulations.
Analyze the provided market context using this strict 5-step quantitative framework:
1. Multi-Timeframe Trend: Check EMA stack alignment (Bullish: EMA9 > EMA21 > EMA50). Note VWAP position relative to price.
2. Momentum & Volume: Check 14-period RSI (avoid RSI > 70 for buys, RSI < 30 for sells) and 20-period RVOL (require > 1.2x for confirmation). Check Stochastic RSI for oversold/overbought.
3. Volatility & Band Position: Use 14-period ATR for stop placement (1.0x–1.5x ATR). Check Bollinger Band position (width < 0.5% = squeeze; price above upper band = breakout).
4. Risk/Reward: Proposed trade MUST have at least 1.5:1 reward-to-risk. Return "hold" if R/R < 1.5 or quality is uncertain.
5. Invalidation: Identify the exact price level that invalidates the setup.

Strategy context: ${strategyAddendum}

Return ONLY valid JSON in this exact shape:
{
  "action": "buy" | "sell" | "hold",
  "confidence": number between 0 and 1,
  "entryPrice": number | null,
  "suggestedStopLoss": number | null,
  "suggestedTakeProfit": number | null,
  "riskRewardRatio": number | null,
  "invalidationLevel": number | null,
  "rationale": "1-2 concise sentences explaining the technical thesis"
}`;

    const userPrompt = `Symbol: ${symbol} (${market || "global-spot"})
Timeframe: ${interval || "1m"}
Strategy: ${strategy || "scalp_momentum"}
Quantitative Indicators: ${JSON.stringify(indicators || {})}
Recent Candles (most recent last):
${JSON.stringify(bars ? bars.slice(-20) : [])}`;


    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${deepseekKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.15,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: "DeepSeek API error", details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";

    return new Response(content, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

