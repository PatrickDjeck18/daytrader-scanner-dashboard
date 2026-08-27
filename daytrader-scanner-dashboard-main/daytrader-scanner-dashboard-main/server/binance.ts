import { type CryptoBar, type CryptoInterval, type CryptoMarket, type CryptoQuote, type CryptoTrade, isSupportedCryptoSymbol, normalizeCryptoSymbol, unavailableCryptoQuote } from "@shared/crypto";
import { fetchWithTimeout } from "./production";

type BinanceMarketConfig = { label: string; restBase: string; tickerPath: string; klinesPath: string; aggregateTradesPath: string };
type BinanceRestTicker = { symbol?: string; lastPrice?: string; bidPrice?: string; askPrice?: string; priceChangePercent?: string; highPrice?: string; lowPrice?: string; volume?: string; quoteVolume?: string; weightedAvgPrice?: string; closeTime?: number };
type BinanceAggregateTrade = { a?: number | string; p?: string; q?: string; T?: number; m?: boolean };

const configs: Record<CryptoMarket, BinanceMarketConfig> = {
  "global-spot": { label: "Binance Global Spot", restBase: "https://data-api.binance.vision", tickerPath: "/api/v3/ticker/24hr", klinesPath: "/api/v3/klines", aggregateTradesPath: "/api/v3/aggTrades" },
  "usds-futures": { label: "Binance Global USDⓈ-M Futures", restBase: "https://fapi.binance.com", tickerPath: "/fapi/v1/ticker/24hr", klinesPath: "/fapi/v1/klines", aggregateTradesPath: "/fapi/v1/aggTrades" },
  "binance-us-spot": { label: "Binance.US Spot", restBase: "https://api.binance.us", tickerPath: "/api/v3/ticker/24hr", klinesPath: "/api/v3/klines", aggregateTradesPath: "/api/v3/aggTrades" },
};

function finiteNumber(value: unknown): number | null { const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN; return Number.isFinite(parsed) ? parsed : null; }
function validSymbol(symbol: string): string | undefined { const normalized = normalizeCryptoSymbol(symbol); return isSupportedCryptoSymbol(normalized) ? normalized : undefined; }

export function normalizeBinanceRestTicker(payload: BinanceRestTicker, market: CryptoMarket, fallbackSymbol: string): CryptoQuote | undefined {
  const symbol = validSymbol(payload.symbol ?? fallbackSymbol);
  const price = finiteNumber(payload.lastPrice);
  if (!symbol || price === null || price <= 0) return undefined;
  return { market, symbol, availability: "live", price, bid: finiteNumber(payload.bidPrice), ask: finiteNumber(payload.askPrice), changePct: finiteNumber(payload.priceChangePercent), high: finiteNumber(payload.highPrice), low: finiteNumber(payload.lowPrice), baseVolume: finiteNumber(payload.volume), quoteVolume: finiteNumber(payload.quoteVolume), weightedAverage: finiteNumber(payload.weightedAvgPrice), lastUpdated: finiteNumber(payload.closeTime) ?? Date.now() };
}

export function normalizeBinanceMarketTickers(payload: unknown, market: CryptoMarket, limit = 12): CryptoQuote[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((item): CryptoQuote[] => {
    const ticker = item as BinanceRestTicker;
    const quote = normalizeBinanceRestTicker(ticker, market, ticker.symbol ?? "");
    return quote && quote.symbol.endsWith("USDT") && (quote.quoteVolume ?? 0) > 0 ? [quote] : [];
  }).sort((left, right) => (right.quoteVolume ?? 0) - (left.quoteVolume ?? 0)).slice(0, Math.max(1, Math.min(24, limit)));
}

export function normalizeBinanceRestKlines(payload: unknown, symbol: string): CryptoBar[] {
  if (!Array.isArray(payload)) return [];
  const normalizedSymbol = validSymbol(symbol);
  if (!normalizedSymbol) return [];
  return payload.flatMap((row): CryptoBar[] => {
    if (!Array.isArray(row)) return [];
    const start = finiteNumber(row[0]), open = finiteNumber(row[1]), high = finiteNumber(row[2]), low = finiteNumber(row[3]), close = finiteNumber(row[4]), volume = finiteNumber(row[5]), end = finiteNumber(row[6]), quoteVolume = finiteNumber(row[7]);
    if (start === null || open === null || high === null || low === null || close === null || volume === null || end === null || quoteVolume === null) return [];
    return [{ symbol: normalizedSymbol, start, end, open, high, low, close, volume, quoteVolume, closed: end < Date.now() }];
  });
}

export function normalizeBinanceAggregateTrades(payload: unknown, symbol: string): CryptoTrade[] {
  if (!Array.isArray(payload)) return [];
  const normalizedSymbol = validSymbol(symbol);
  if (!normalizedSymbol) return [];
  return payload.flatMap((item): CryptoTrade[] => {
    const trade = item as BinanceAggregateTrade;
    const price = finiteNumber(trade.p), quantity = finiteNumber(trade.q), timestamp = finiteNumber(trade.T);
    if ((typeof trade.a !== "string" && typeof trade.a !== "number") || price === null || quantity === null || timestamp === null) return [];
    return [{ id: String(trade.a), symbol: normalizedSymbol, price, quantity, timestamp, buyerIsMaker: typeof trade.m === "boolean" ? trade.m : null }];
  });
}

function endpoint(market: CryptoMarket, path: string, params: Record<string, string | number>) { const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])); return `${configs[market].restBase}${path}?${query.toString()}`; }

export async function fetchBinanceCryptoQuote(market: CryptoMarket, symbol: string): Promise<CryptoQuote> {
  const normalizedSymbol = validSymbol(symbol);
  if (!normalizedSymbol) return unavailableCryptoQuote(market, normalizeCryptoSymbol(symbol), "Invalid crypto symbol");
  const config = configs[market];
  try {
    const response = await fetchWithTimeout(endpoint(market, config.tickerPath, { symbol: normalizedSymbol }), {}, 7_000);
    if (!response.ok) return unavailableCryptoQuote(market, normalizedSymbol, `${config.label} ticker request failed: ${response.status}`);
    return normalizeBinanceRestTicker(await response.json() as BinanceRestTicker, market, normalizedSymbol) ?? unavailableCryptoQuote(market, normalizedSymbol, `${config.label} returned no current quote`);
  } catch (error) {
    return unavailableCryptoQuote(market, normalizedSymbol, error instanceof Error ? error.message : `${config.label} ticker request failed`);
  }
}

export async function fetchBinanceCryptoTickers(market: CryptoMarket, limit = 12): Promise<CryptoQuote[]> {
  const config = configs[market];
  try {
    const response = await fetchWithTimeout(endpoint(market, config.tickerPath, {}), {}, 8_000);
    if (!response.ok) return [];
    return normalizeBinanceMarketTickers(await response.json(), market, limit);
  } catch {
    return [];
  }
}

export async function fetchBinanceCryptoBars(market: CryptoMarket, symbol: string, interval: CryptoInterval, limit = 120): Promise<CryptoBar[]> {
  const normalizedSymbol = validSymbol(symbol);
  if (!normalizedSymbol) return [];
  const config = configs[market];
  const response = await fetchWithTimeout(endpoint(market, config.klinesPath, { symbol: normalizedSymbol, interval, limit: Math.max(20, Math.min(1000, limit)) }), {}, 7_000);
  if (!response.ok) throw new Error(`${config.label} bars request failed: ${response.status}`);
  return normalizeBinanceRestKlines(await response.json(), normalizedSymbol);
}

export async function fetchBinanceCryptoTrades(market: CryptoMarket, symbol: string, limit = 12): Promise<CryptoTrade[]> {
  const normalizedSymbol = validSymbol(symbol);
  if (!normalizedSymbol) return [];
  const config = configs[market];
  const response = await fetchWithTimeout(endpoint(market, config.aggregateTradesPath, { symbol: normalizedSymbol, limit: Math.max(1, Math.min(50, limit)) }), {}, 7_000);
  if (!response.ok) throw new Error(`${config.label} aggregate-trade request failed: ${response.status}`);
  return normalizeBinanceAggregateTrades(await response.json(), normalizedSymbol).sort((a, b) => b.timestamp - a.timestamp);
}
