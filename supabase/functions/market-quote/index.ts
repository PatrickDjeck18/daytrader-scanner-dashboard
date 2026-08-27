// Supabase Edge Function: market-quote
// Server-side market data proxy for Massive & Finnhub APIs

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
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider") || "finnhub";
    const symbol = url.searchParams.get("symbol") || "AAPL";

    if (provider === "finnhub") {
      const apiKey = Deno.env.get("FINNHUB_API_KEY");
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "FINNHUB_API_KEY not configured on Supabase" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`
      );
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (provider === "massive") {
      const apiKey = Deno.env.get("MASSIVE_API_KEY");
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "MASSIVE_API_KEY not configured on Supabase" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = await fetch(
        `https://api.massive.com/v2/reference/news?ticker=${encodeURIComponent(symbol)}&limit=5&apiKey=${encodeURIComponent(apiKey)}`
      );
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: `Unknown provider: ${provider}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
