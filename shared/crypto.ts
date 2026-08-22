export const CRYPTO_MARKETS = ["global-spot", "usds-futures", "binance-us-spot"] as const;
export type CryptoMarket = (typeof CRYPTO_MARKETS)[number];
export const CRYPTO_INTERVALS = ["1m", "5m", "15m"] as const;
export type CryptoInterval = (typeof CRYPTO_INTERVALS)[number];

export const CRYPTO_MARKET_OPTIONS: ReadonlyArray<{ value: CryptoMarket; label: string; shortLabel: string }> = [
  { value: "global-spot", label: "Binance Global · Spot", shortLabel: "Global Spot" },
  { value: "usds-futures", label: "Binance Global · USDⓈ-M Futures", shortLabel: "USDⓈ-M Futures" },
  { value: "binance-us-spot", label: "Binance.US · Spot", shortLabel: "Binance.US Spot" },
];

export type CryptoQuote = {
  market: CryptoMarket;
  symbol: string;
  availability: "live" | "unavailable";
  price: number | null;
  bid: number | null;
  ask: number | null;
  changePct: number | null;
  high: number | null;
  low: number | null;
  baseVolume: number | null;
  quoteVolume: number | null;
  weightedAverage: number | null;
  lastUpdated: number;
  providerError?: string;
};

export type CryptoBar = {
  symbol: string;
  start: number;
  end: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  closed: boolean;
};

export type CryptoTrade = {
  id: string;
  symbol: string;
  price: number;
  quantity: number;
  timestamp: number;
  buyerIsMaker: boolean | null;
};

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function normalizeCryptoSymbol(value: string): string {
  return value.trim().toUpperCase().replace(/[\s/_-]/g, "");
}

export function isSupportedCryptoSymbol(value: string): boolean {
  return /^[A-Z0-9]{5,20}$/.test(value);
}

export function unavailableCryptoQuote(market: CryptoMarket, symbol: string, reason: string): CryptoQuote {
  return { market, symbol, availability: "unavailable", price: null, bid: null, ask: null, changePct: null, high: null, low: null, baseVolume: null, quoteVolume: null, weightedAverage: null, lastUpdated: Date.now(), providerError: reason };
}

export function normalizeBinanceStreamTicker(payload: unknown, market: CryptoMarket): CryptoQuote | undefined {
  const body = record(payload);
  const symbol = typeof body?.s === "string" ? normalizeCryptoSymbol(body.s) : "";
  const price = finiteNumber(body?.c);
  if (!symbol || !isSupportedCryptoSymbol(symbol) || price === null || price <= 0) return undefined;
  return {
    market,
    symbol,
    availability: "live",
    price,
    bid: finiteNumber(body?.b),
    ask: finiteNumber(body?.a),
    changePct: finiteNumber(body?.P),
    high: finiteNumber(body?.h),
    low: finiteNumber(body?.l),
    baseVolume: finiteNumber(body?.v),
    quoteVolume: finiteNumber(body?.q),
    weightedAverage: finiteNumber(body?.w),
    lastUpdated: finiteNumber(body?.E) ?? Date.now(),
  };
}

export function normalizeBinanceStreamKline(payload: unknown): CryptoBar | undefined {
  const body = record(payload);
  const kline = record(body?.k);
  const symbol = typeof body?.s === "string" ? normalizeCryptoSymbol(body.s) : typeof kline?.s === "string" ? normalizeCryptoSymbol(kline.s) : "";
  const start = finiteNumber(kline?.t);
  const end = finiteNumber(kline?.T);
  const open = finiteNumber(kline?.o);
  const high = finiteNumber(kline?.h);
  const low = finiteNumber(kline?.l);
  const close = finiteNumber(kline?.c);
  const volume = finiteNumber(kline?.v);
  const quoteVolume = finiteNumber(kline?.q);
  if (!symbol || !isSupportedCryptoSymbol(symbol) || start === null || end === null || open === null || high === null || low === null || close === null || volume === null || quoteVolume === null) return undefined;
  return { symbol, start, end, open, high, low, close, volume, quoteVolume, closed: kline?.x === true };
}

export function normalizeBinanceStreamTrade(payload: unknown): CryptoTrade | undefined {
  const body = record(payload);
  const symbol = typeof body?.s === "string" ? normalizeCryptoSymbol(body.s) : "";
  const id = body?.a;
  const price = finiteNumber(body?.p);
  const quantity = finiteNumber(body?.q);
  const timestamp = finiteNumber(body?.T);
  if (!symbol || !isSupportedCryptoSymbol(symbol) || (typeof id !== "string" && typeof id !== "number") || price === null || quantity === null || timestamp === null) return undefined;
  return { id: String(id), symbol, price, quantity, timestamp, buyerIsMaker: typeof body?.m === "boolean" ? body.m : null };
}
