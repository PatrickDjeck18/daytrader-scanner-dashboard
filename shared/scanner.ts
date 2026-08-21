export type MarketSession = "pre-market" | "regular" | "after-hours" | "closed";

export type MarketQuote = {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  changePct: number;
  volume: number;
  rvol: number;
  floatM: number;
  marketCapM: number;
  dollarVolumeM: number;
  vwap: number;
  sessionHigh: number;
  sessionLow: number;
  halted: boolean;
  catalystType?: string;
  lastUpdated: number;
  source?: "massive" | "finnhub" | "simulated" | "unavailable";
  providerError?: string;
};

export type MarketTrade = { symbol: string; price: number; size: number; timestamp: number };
export type MarketBar = { symbol: string; open: number; close: number; high: number; low: number; volume: number; vwap: number; start: number; end: number };
export type MarketDataProvider = {
  getQuotes: (symbols: string[]) => Promise<MarketQuote[]>;
  getTrades: (symbol: string, from: string, to: string) => Promise<MarketTrade[]>;
  getBars: (symbol: string, from: string, to: string) => Promise<MarketBar[]>;
  subscribe: (symbols: string[], onQuote: (quote: MarketQuote) => void, onTrade?: (trade: MarketTrade) => void, onBar?: (bar: MarketBar) => void) => () => void;
};

export type ScannerThresholds = {
  minPrice: number;
  minFloatM: number;
  maxFloatM: number;
  minMarketCapM: number;
  maxMarketCapM: number;
  minDollarVolumeM: number;
  maxSpread: number;
  minChangePct: number;
  minRvol: number;
};

export const defaultThresholds: ScannerThresholds = {
  minPrice: 2,
  minFloatM: 0,
  maxFloatM: 5000,
  minMarketCapM: 0,
  maxMarketCapM: 5000000,
  minDollarVolumeM: 1,
  maxSpread: 0.08,
  minChangePct: 2,
  minRvol: 2,
};

export const presetThresholds: Record<string, Partial<ScannerThresholds>> = {
  "Low-Float Gappers": { maxFloatM: 500, minChangePct: 5, minRvol: 3 },
  "Large-Cap Momentum": { minMarketCapM: 10000, minDollarVolumeM: 25, minChangePct: 2 },
  "News Breakouts": { minChangePct: 3, minRvol: 2.5, minDollarVolumeM: 5 },
};

export function meetsBaseFilters(q: MarketQuote, t: ScannerThresholds = defaultThresholds) {
  const spread = q.ask - q.bid;
  return q.price >= t.minPrice && q.floatM >= t.minFloatM && q.floatM <= t.maxFloatM && q.marketCapM >= t.minMarketCapM && q.marketCapM <= t.maxMarketCapM && q.dollarVolumeM >= t.minDollarVolumeM && spread <= t.maxSpread && q.changePct >= t.minChangePct && q.rvol >= t.minRvol;
}

export function scanTopGainers(quotes: MarketQuote[], t?: ScannerThresholds) {
  return quotes.filter(q => meetsBaseFilters(q, t)).sort((a, b) => b.changePct - a.changePct);
}

export function scanHighOfDayBreakout(quotes: MarketQuote[], t?: ScannerThresholds) {
  return quotes.filter(q => meetsBaseFilters(q, t) && q.price >= q.sessionHigh * .995);
}

export function scanRelativeVolume(quotes: MarketQuote[], t?: ScannerThresholds) {
  return quotes.filter(q => meetsBaseFilters(q, t)).sort((a, b) => b.rvol - a.rvol);
}

export function applyPreset(name: string, base: ScannerThresholds = defaultThresholds) {
  return { ...base, ...(presetThresholds[name] ?? {}) };
}

export type AlertKey = { symbol: string; rule: string; value: string };
export function alertFingerprint(a: AlertKey) { return `${a.symbol}:${a.rule}:${a.value}`; }
export function dedupeAlerts(alerts: AlertKey[]) { return Array.from(new Map(alerts.map(a => [alertFingerprint(a), a])).values()); }

export type WatchlistItem = { symbol: string; order: number; alertsMuted: boolean };
export function toggleWatchlist(items: WatchlistItem[], symbol: string): WatchlistItem[] {
  if (items.some(item => item.symbol === symbol)) return items.filter(item => item.symbol !== symbol).map((item, i) => ({ ...item, order: i }));
  return [...items, { symbol, order: items.length, alertsMuted: false }];
}
export function toggleAlertsMuted(items: WatchlistItem[], symbol: string) { return items.map(item => item.symbol === symbol ? { ...item, alertsMuted: !item.alertsMuted } : item); }
export function acknowledgeAlert<T extends { id: string; acknowledged: boolean }>(alerts: T[], id: string) { return alerts.map(alert => alert.id === id ? { ...alert, acknowledged: true } : alert); }
