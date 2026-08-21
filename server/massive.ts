import type { MarketBar, MarketDataProvider, MarketQuote, MarketTrade } from "../shared/scanner";
import { fetchWithTimeout } from "./production";
import { updateProviderHealth } from "./db";

export type MassiveQuoteEvent = { ev: "Q"; sym: string; bp?: number; ap?: number; bs?: number; as?: number; t?: number };
export type MassiveTradeEvent = { ev: "T"; sym: string; p: number; s: number; t?: number; x?: number };
export type MassiveMinuteEvent = { ev: "AM"; sym: string; o: number; c: number; h: number; l: number; v: number; a?: number; vw?: number; s: number; e: number };
export type MassiveNewsItem = { id: string; title: string; article_url: string; published_utc: string; tickers?: string[]; publisher?: { name?: string }; description?: string };

const baseUrl = "https://api.massive.com";
const stocksSocket = "wss://socket.massive.com/stocks";

function requireKey() { const key = process.env.MASSIVE_API_KEY; if (!key) throw new Error("MASSIVE_API_KEY is not configured"); return key; }
function fallbackQuote(symbol: string, reason: string): MarketQuote { return { symbol, price: 0, bid: 0, ask: 0, changePct: 0, volume: 0, rvol: 0, floatM: 0, marketCapM: 0, dollarVolumeM: 0, vwap: 0, sessionHigh: 0, sessionLow: 0, halted: false, lastUpdated: Date.now(), source: "unavailable", providerError: reason }; }
type RestSnapshot = { ticker?: { ticker?: string; lastQuote?: { bid?: number; ask?: number }; lastTrade?: { price?: number; p?: number; sip_timestamp?: number; t?: number }; min?: { c?: number; v?: number; av?: number; vw?: number }; day?: { h?: number; l?: number; c?: number; v?: number; vw?: number }; todaysChangePerc?: number; updated?: number } };
export function normalizeRestSnapshot(body: RestSnapshot, fallbackSymbol: string): MarketQuote { const t = body.ticker; const price = t?.lastTrade?.price ?? t?.lastTrade?.p ?? t?.day?.c ?? 0; const bid = t?.lastQuote?.bid ?? price; const ask = t?.lastQuote?.ask ?? price; const volume = t?.day?.v ?? t?.min?.av ?? t?.min?.v ?? 0; return { symbol: t?.ticker ?? fallbackSymbol, price, bid, ask, changePct: t?.todaysChangePerc ?? 0, volume, rvol: 0, floatM: 0, marketCapM: 0, dollarVolumeM: price * volume / 1_000_000, vwap: t?.day?.vw ?? t?.min?.vw ?? price, sessionHigh: t?.day?.h ?? price, sessionLow: t?.day?.l ?? price, halted: false, lastUpdated: t?.lastTrade?.sip_timestamp ?? t?.lastTrade?.t ?? t?.updated ?? Date.now(), source: "massive" }; }
async function fetchSnapshot(symbol: string, key: string): Promise<MarketQuote> { try { const response = await fetchWithTimeout(`${baseUrl}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(symbol)}?apiKey=${encodeURIComponent(key)}`); if (!response.ok) { if (response.status === 401 || response.status === 403) return fallbackQuote(symbol, `Massive snapshot access denied (${response.status})`); throw new Error(`Massive snapshot request failed for ${symbol}: ${response.status}`); } return normalizeRestSnapshot(await response.json() as RestSnapshot, symbol); } catch (error) { const reason = error instanceof Error ? error.message : "Massive snapshot network failure"; return fallbackQuote(symbol, reason); } }

export function normalizeQuote(event: MassiveQuoteEvent): MarketQuote {
  const bid = event.bp ?? 0, ask = event.ap ?? bid, price = ask || bid;
  return { symbol: event.sym, price, bid, ask, changePct: 0, volume: 0, rvol: 0, floatM: 0, marketCapM: 0, dollarVolumeM: 0, vwap: price, sessionHigh: price, sessionLow: price, halted: false, lastUpdated: event.t ?? Date.now() };
}

export function normalizeMinute(event: MassiveMinuteEvent): MarketBar { return { symbol: event.sym, open: event.o, close: event.c, high: event.h, low: event.l, volume: event.v, vwap: event.vw ?? event.a ?? event.c, start: event.s, end: event.e }; }
export function normalizeTrade(event: MassiveTradeEvent): MarketTrade { return { symbol: event.sym, price: event.p, size: event.s, timestamp: event.t ?? Date.now() }; }

export async function massiveNews(ticker?: string, limit = 50): Promise<MassiveNewsItem[]> {
  const params = new URLSearchParams({ order: "desc", sort: "published_utc", limit: String(limit), apiKey: requireKey() });
  if (ticker) params.set("ticker", ticker);
  const started = Date.now(); const response = await fetchWithTimeout(`${baseUrl}/v2/reference/news?${params}`);
  if (!response.ok) { await updateProviderHealth({ provider: "massive", status: response.status === 401 || response.status === 403 ? "degraded" : "offline", latencyMs: Date.now() - started, error: `news ${response.status}` }); throw new Error(`Massive news request failed: ${response.status}`); } await updateProviderHealth({ provider: "massive", status: "healthy", latencyMs: Date.now() - started });
  const body = await response.json() as { results?: MassiveNewsItem[] };
  return body.results ?? [];
}

export class MassiveMarketDataProvider implements MarketDataProvider {
  async getQuotes(symbols: string[]) {
    const key = requireKey(); const started = Date.now();
    const results = await Promise.all(symbols.map(symbol => fetchSnapshot(symbol, key)));
    const fallbackCount = results.filter(item => item.source !== "massive").length;
    await updateProviderHealth({ provider: "massive", status: fallbackCount === 0 ? "healthy" : fallbackCount === results.length ? "offline" : "degraded", latencyMs: Date.now() - started, error: fallbackCount ? `${fallbackCount}/${results.length} snapshot requests failed` : undefined });
    return results;
  }

  async getTrades(symbol: string, from: string, to: string): Promise<MarketTrade[]> { const key = requireKey(); const response = await fetchWithTimeout(`${baseUrl}/v3/trades/${encodeURIComponent(symbol)}?timestamp=${encodeURIComponent(from)}&order=asc&sort=timestamp&limit=1000&apiKey=${encodeURIComponent(key)}`); if (!response.ok) throw new Error(`Massive trades request failed for ${symbol}: ${response.status}`); const body = await response.json() as { results?: Array<{ participant_timestamp?: number; price: number; size: number }> }; return (body.results ?? []).map(item => normalizeTrade({ ev: "T", sym: symbol, p: item.price, s: item.size, t: item.participant_timestamp })); }

  async getBars(symbol: string, from: string, to: string): Promise<MarketBar[]> { const key = requireKey(); const response = await fetchWithTimeout(`${baseUrl}/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/minute/${encodeURIComponent(from)}/${encodeURIComponent(to)}?adjusted=true&sort=asc&limit=50000&apiKey=${encodeURIComponent(key)}`); if (!response.ok) throw new Error(`Massive bars request failed for ${symbol}: ${response.status}`); const body = await response.json() as { results?: Array<{ o: number; c: number; h: number; l: number; v: number; vw?: number; t: number }> }; return (body.results ?? []).map(item => normalizeMinute({ ev: "AM", sym: symbol, o: item.o, c: item.c, h: item.h, l: item.l, v: item.v, vw: item.vw, s: item.t, e: item.t + 59999 })); }

  subscribe(symbols: string[], onQuote: (quote: MarketQuote) => void, onTrade?: (trade: MarketTrade) => void, onBar?: (bar: MarketBar) => void) {
    let closed = false; let socket: WebSocket | null = null; let attempt = 0; let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    const connect = () => { if (closed) return; try { socket = new WebSocket(stocksSocket); socket.addEventListener("open", () => { attempt = 0; socket?.send(JSON.stringify({ action: "auth", params: requireKey() })); socket?.send(JSON.stringify({ action: "subscribe", params: symbols.flatMap(symbol => [`Q.${symbol}`, `T.${symbol}`, `AM.${symbol}`]).join(",") })); void updateProviderHealth({ provider: "massive", status: "healthy" }); }); socket.addEventListener("message", message => { const payload = JSON.parse(String(message.data)) as (MassiveQuoteEvent | MassiveTradeEvent | MassiveMinuteEvent) | (MassiveQuoteEvent | MassiveTradeEvent | MassiveMinuteEvent)[]; for (const event of Array.isArray(payload) ? payload : [payload]) if (event.ev === "Q") onQuote(normalizeQuote(event)); else if (event.ev === "T") onTrade?.(normalizeTrade(event as MassiveTradeEvent)); else if (event.ev === "AM") onBar?.(normalizeMinute(event as MassiveMinuteEvent)); }); const retry = () => { if (closed) return; attempt += 1; void updateProviderHealth({ provider: "massive", status: "degraded", error: "WebSocket disconnected; reconnecting" }); reconnectTimer = setTimeout(connect, Math.min(30_000, 500 * 2 ** Math.min(attempt, 6))); }; socket.addEventListener("error", retry); socket.addEventListener("close", retry); } catch { if (closed) return; attempt += 1; void updateProviderHealth({ provider: "massive", status: "degraded", error: "WebSocket connection failed; reconnecting" }); reconnectTimer = setTimeout(connect, Math.min(30_000, 500 * 2 ** Math.min(attempt, 6))); } };
    connect(); return () => { closed = true; if (reconnectTimer) clearTimeout(reconnectTimer); socket?.close(); socket = null; };
  }
}

export const massiveProvider = new MassiveMarketDataProvider();
