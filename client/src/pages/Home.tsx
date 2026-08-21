import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { MARKET_QUERY_OPTIONS } from "@shared/marketQuery";
import type { MarketQuote } from "@shared/scanner";
import {
  Activity,
  Bell,
  BellOff,
  BookOpen,
  ChevronDown,
  Clipboard,
  Command,
  Crosshair,
  Database,
  Gauge,
  GripVertical,
  LayoutGrid,
  Maximize2,
  Menu,
  Mic2,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Star,
  Volume2,
  X,
  Zap,
} from "lucide-react";

type Stock = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: number;
  rvol: number;
  float: string;
  floatM: number;
  marketCap: string;
  spread: number;
  sector: string;
  catalyst: string;
  catalystType: string;
  vwap: number;
  high: number;
  low: number;
  premarket: number;
  tape: string;
  color: string;
};

type Bar = { open: number; close: number; high: number; low: number; volume: number };

type AlertItem = { id: number; symbol: string; title: string; detail: string; tone: "green" | "pink" | "amber"; time: string; read: boolean };

const seedStocks: Stock[] = [
  { symbol: "NVDA", name: "NVIDIA Corp.", price: 182.42, change: 8.64, volume: 18.7, rvol: 4.82, float: "23.4B", floatM: 23400, marketCap: "$4.4T", spread: 0.01, sector: "Semis", catalyst: "AI infrastructure demand", catalystType: "Earnings", vwap: 178.92, high: 184.10, low: 171.88, premarket: 2.1, tape: "Aggressive buy", color: "#a78bfa" },
  { symbol: "SMCI", name: "Super Micro Computer", price: 48.73, change: 14.21, volume: 32.9, rvol: 8.31, float: "548M", floatM: 548, marketCap: "$2.8B", spread: 0.03, sector: "Hardware", catalyst: "New data center contract", catalystType: "Contract", vwap: 44.83, high: 49.08, low: 42.61, premarket: 6.8, tape: "Block buying", color: "#38bdf8" },
  { symbol: "IONQ", name: "IonQ, Inc.", price: 44.08, change: 11.72, volume: 21.3, rvol: 5.92, float: "219M", floatM: 219, marketCap: "$9.6B", spread: 0.02, sector: "Quantum", catalyst: "Government quantum award", catalystType: "News", vwap: 41.24, high: 45.12, low: 39.68, premarket: 3.6, tape: "Fast prints", color: "#f59e0b" },
  { symbol: "RIVN", name: "Rivian Automotive", price: 16.32, change: 9.45, volume: 45.8, rvol: 3.76, float: "1.05B", floatM: 1050, marketCap: "$18.2B", spread: 0.01, sector: "EV", catalyst: "Delivery guidance raised", catalystType: "Guidance", vwap: 15.42, high: 16.87, low: 14.91, premarket: 4.2, tape: "Momentum", color: "#34d399" },
  { symbol: "MARA", name: "MARA Holdings", price: 22.16, change: 7.38, volume: 39.4, rvol: 6.14, float: "354M", floatM: 354, marketCap: "$7.8B", spread: 0.02, sector: "Crypto", catalyst: "Bitcoin beta rotation", catalystType: "Theme", vwap: 21.31, high: 22.44, low: 20.56, premarket: 2.9, tape: "Steady bid", color: "#fb7185" },
  { symbol: "BBAI", name: "BigBear.ai", price: 4.88, change: 22.41, volume: 72.6, rvol: 12.52, float: "141M", floatM: 141, marketCap: "$690M", spread: 0.01, sector: "AI Software", catalyst: "Defense AI partnership", catalystType: "Contract", vwap: 4.12, high: 5.16, low: 3.88, premarket: 8.9, tape: "Very active", color: "#fb923c" },
  { symbol: "SOUN", name: "SoundHound AI", price: 11.27, change: 18.26, volume: 64.3, rvol: 10.44, float: "296M", floatM: 296, marketCap: "$3.4B", spread: 0.01, sector: "AI Software", catalyst: "Automotive deployment", catalystType: "News", vwap: 10.46, high: 11.58, low: 9.82, premarket: 7.1, tape: "Aggressive buy", color: "#22d3ee" },
  { symbol: "CELH", name: "Celsius Holdings", price: 33.14, change: 6.84, volume: 11.8, rvol: 2.84, float: "224M", floatM: 224, marketCap: "$7.5B", spread: 0.02, sector: "Consumer", catalyst: "Distribution expansion", catalystType: "Earnings", vwap: 32.12, high: 34.02, low: 31.48, premarket: 1.6, tape: "Building", color: "#c084fc" },
];

const newsItems = [
  { time: "09:16:02", symbol: "SMCI", title: "Super Micro signs multi-year AI infrastructure contract", source: "PR Newswire", type: "Contract", tone: "green" },
  { time: "09:15:41", symbol: "IONQ", title: "IonQ awarded quantum computing research program", source: "GlobeNewswire", type: "News", tone: "blue" },
  { time: "09:14:52", symbol: "BBAI", title: "BigBear.ai expands defense analytics partnership", source: "SEC Filing", type: "Contract", tone: "amber" },
  { time: "09:13:08", symbol: "NVDA", title: "NVIDIA announces next-gen inference platform", source: "Company Release", type: "Earnings", tone: "purple" },
  { time: "09:12:36", symbol: "SOUN", title: "SoundHound expands automotive voice AI deployments", source: "Benzinga", type: "News", tone: "blue" },
  { time: "09:11:19", symbol: "MARA", title: "Crypto-linked equities lead early sector rotation", source: "Market Desk", type: "Theme", tone: "pink" },
];

const sectors = [
  { name: "AI Software", strength: 96, breadth: "8 / 11", movers: "BBAI · SOUN", color: "#fb923c" },
  { name: "Semiconductors", strength: 88, breadth: "14 / 18", movers: "NVDA · AMD", color: "#a78bfa" },
  { name: "Quantum", strength: 82, breadth: "4 / 5", movers: "IONQ · QBTS", color: "#38bdf8" },
  { name: "Crypto", strength: 71, breadth: "9 / 15", movers: "MARA · RIOT", color: "#fb7185" },
  { name: "EV / Mobility", strength: 63, breadth: "6 / 12", movers: "RIVN · LCID", color: "#34d399" },
];

export const quoteUniverse = Array.from(new Set([...seedStocks.map(item => item.symbol), "AAPL", "AMD", "AMZN", "COIN", "GOOGL", "LCID", "META", "MSFT", "MSTR", "PLTR", "QBTS", "RIOT", "TSLA"])).slice(0, 10);
const quoteColors = ["#a78bfa", "#38bdf8", "#f59e0b", "#34d399", "#fb7185", "#fb923c", "#22d3ee", "#c084fc"];
export function providerQuoteToStock(quote: MarketQuote, index: number): Stock { return { symbol: quote.symbol, name: `${quote.symbol} · provider quote`, price: quote.price, change: quote.changePct, volume: quote.volume / 1_000_000, rvol: 0, float: "—", floatM: 0, marketCap: "—", spread: Math.max(.01, quote.ask - quote.bid), sector: "—", catalyst: "Finnhub quote", catalystType: "Quote", vwap: quote.vwap, high: quote.sessionHigh, low: quote.sessionLow, premarket: 0, tape: "Provider quote", color: quoteColors[index % quoteColors.length] }; }

const scannerNames = ["Top Gainers", "High-of-Day Breakout", "Relative Volume Leaders", "Low-Float Momentum", "Pre-Market Movers", "VWAP Reclaim/Loss", "Opening Range Breakout", "Halt Monitor", "Unusual Tape Activity", "Offering/Dilution Risk"];
const presets = ["Low-Float Gappers", "Large-Cap Momentum", "News Breakouts"];

function formatVol(value: number) { return value >= 1 ? `${value.toFixed(1)}M` : `${Math.round(value * 1000)}K`; }
function makeBars(stock: Stock): Bar[] {
  let price = stock.low + (stock.high - stock.low) * .46;
  return Array.from({ length: 34 }, (_, i) => {
    const drift = (stock.price - price) / 40 + Math.sin(i * 1.6) * (stock.price * .005);
    const open = price;
    const close = Math.max(stock.low * .98, Math.min(stock.high * 1.02, price + drift));
    const high = Math.max(open, close) + stock.price * (.004 + (i % 4) * .0015);
    const low = Math.min(open, close) - stock.price * (.004 + ((i + 1) % 3) * .0015);
    price = close;
    return { open, close, high, low, volume: 25 + ((i * 17) % 60) + (i > 27 ? 40 : 0) };
  });
}

function MiniSpark({ color, flip = false }: { color: string; flip?: boolean }) {
  return <svg viewBox="0 0 100 28" className="mini-spark" aria-hidden="true"><polyline points={flip ? "0,7 12,10 24,8 35,16 45,12 58,20 72,17 84,23 100,21" : "0,23 10,21 22,22 33,14 44,17 56,8 69,12 80,5 91,8 100,2"} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CandleChart({ stock }: { stock: Stock }) {
  const bars = useMemo(() => makeBars(stock), [stock.symbol]);
  const max = Math.max(...bars.map(b => b.high));
  const min = Math.min(...bars.map(b => b.low));
  const range = max - min || 1;
  const y = (v: number) => 12 + ((max - v) / range) * 190;
  const vwapY = y(stock.vwap);
  const ema9 = bars.map((b, i) => b.close * .55 + stock.vwap * .45 + Math.sin(i) * stock.price * .004);
  const ema20 = bars.map((b, i) => b.close * .35 + stock.vwap * .65 + Math.cos(i * .7) * stock.price * .006);
  const points = (values: number[]) => values.map((v, i) => `${18 + i * 14},${y(v)}`).join(" ");
  return <div className="chart-wrap">
    <div className="chart-legend"><span><i className="legend-line vwap" />VWAP <b>{stock.vwap.toFixed(2)}</b></span><span><i className="legend-line ema9" />9 EMA</span><span><i className="legend-line ema20" />20 EMA</span><span className="chart-session"><i />PRE · RTH · AH</span></div>
    <svg viewBox="0 0 500 250" preserveAspectRatio="none" className="candle-svg">
      <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6d5dfc" stopOpacity=".16" /><stop offset="1" stopColor="#6d5dfc" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map(i => <line key={i} x1="0" x2="500" y1={35 + i * 40} y2={35 + i * 40} stroke="#242944" strokeWidth="1" />)}
      <rect x="0" y="0" width="74" height="220" fill="#24233a" opacity=".35" /><rect x="430" y="0" width="70" height="220" fill="#20262e" opacity=".5" />
      <text x="8" y="235" className="session-label">PRE-MARKET</text><text x="210" y="235" className="session-label">REGULAR SESSION</text><text x="447" y="235" className="session-label">AH</text>
      <polygon points={`18,${y(bars[0].close)} ${points(bars.map(b => b.close))} 480,220 18,220`} fill="url(#area)" />
      <polyline points={points(ema20)} fill="none" stroke="#e879f9" strokeWidth="1.5" opacity=".8" /><polyline points={points(ema9)} fill="none" stroke="#fbbf24" strokeWidth="1.5" opacity=".9" />
      <line x1="0" x2="500" y1={vwapY} y2={vwapY} stroke="#a78bfa" strokeDasharray="4 4" strokeWidth="1.5" />
      {bars.map((b, i) => { const x = 18 + i * 14; const up = b.close >= b.open; return <g key={i}><line x1={x + 3} x2={x + 3} y1={y(b.high)} y2={y(b.low)} stroke={up ? "#37d39b" : "#f87171"} strokeWidth="1" /><rect x={x} y={Math.min(y(b.open), y(b.close))} width="6" height={Math.max(2, Math.abs(y(b.open) - y(b.close)))} fill={up ? "#37d39b" : "#f87171"} rx="1" /><rect x={x} y={222 - b.volume * .42} width="6" height={b.volume * .42} fill={up ? "#37d39b" : "#f87171"} opacity=".3" /></g>; })}
    </svg>
    <div className="chart-axis"><span>{(min).toFixed(2)}</span><span>{((min + max) / 2).toFixed(2)}</span><span>{max.toFixed(2)}</span></div>
  </div>;
}

export function getFreePlanUiState(input: { demoMode: boolean; liveDataReady: boolean; planRestricted: boolean }) { return { banner: !input.demoMode && (!input.liveDataReady || input.planRestricted) ? "FREE PLAN · REAL-TIME UNAVAILABLE" : undefined, showSeededMarketValues: input.demoMode || input.liveDataReady }; }
export function shouldApplyOptionalScannerFilters(provider?: string) { return provider !== "finnhub"; }
export function isProviderAwareScannerEligible(stock: Pick<Stock, "price" | "floatM" | "marketCap" | "volume" | "change" | "rvol" | "spread">, thresholds: { minPrice: number; minFloat: number; maxFloat: number; minMarketCap: number; minDollarVolume: number; minChange: number; minRvol: number; maxSpread: number }, provider?: string) { const optionalKnown = shouldApplyOptionalScannerFilters(provider); const marketCap = Number(stock.marketCap.replace(/[$TB]/g, "")) * (stock.marketCap.includes("T") ? 1000000 : stock.marketCap.includes("B") ? 1000 : 1); return stock.price >= thresholds.minPrice && (!optionalKnown || (stock.floatM >= thresholds.minFloat && stock.floatM <= thresholds.maxFloat && marketCap >= thresholds.minMarketCap && Number(stock.volume) * stock.price >= thresholds.minDollarVolume && stock.rvol >= thresholds.minRvol)) && stock.change >= thresholds.minChange && stock.spread <= thresholds.maxSpread; }

export function getNewsItemKey(item: { time: string; symbol: string }, index: number) { return `${item.symbol}-${item.time}-${index}`; }
export function getScannerDataNotice(scanner: string, provider?: string) { return provider === "finnhub" && (scanner === "Relative Volume Leaders" || scanner === "Unusual Tape Activity") ? "RVOL UNAVAILABLE · Finnhub quote feed has no relative-volume history; ranked by percent change instead." : undefined; }
export function getVisibleScannerRows<T>(rows: T[], showAll: boolean, limit = 12) { return showAll ? rows : rows.slice(0, limit); }
export function getProviderAwareScannerRows(stocks: Stock[], scanner: string, thresholds: { minPrice: number; minFloat: number; maxFloat: number; minMarketCap: number; minDollarVolume: number; minChange: number; minRvol: number; maxSpread: number }, provider?: string) { const quoteOnly = !shouldApplyOptionalScannerFilters(provider); const eligible = stocks.filter(s => isProviderAwareScannerEligible(s, thresholds, provider)); const sortBy = (key: "change" | "rvol" | "volume" | "floatM" | "spread") => [...eligible].sort((a, b) => b[key] - a[key]); if (scanner === "High-of-Day Breakout" || scanner === "Opening Range Breakout") return eligible.filter(s => s.price >= s.high * (scanner === "High-of-Day Breakout" ? .985 : .97)); if (scanner === "Relative Volume Leaders" || scanner === "Unusual Tape Activity") return quoteOnly ? eligible.sort((a, b) => b.change - a.change) : sortBy("rvol"); if (scanner === "Low-Float Momentum") return (quoteOnly ? eligible : eligible.filter(s => s.floatM < 500)).sort((a, b) => b.change - a.change); if (scanner === "Pre-Market Movers") return [...eligible].sort((a, b) => b.premarket - a.premarket); if (scanner === "VWAP Reclaim/Loss") return eligible.filter(s => s.price >= s.vwap).sort((a, b) => (b.price - b.vwap) - (a.price - a.vwap)); if (scanner === "Halt Monitor") return [...eligible].filter((_, i) => i === 2).sort((a, b) => b.change - a.change); if (scanner === "Offering/Dilution Risk") return (quoteOnly ? eligible : eligible.filter(s => s.catalystType === "Earnings" || s.catalystType === "News")).sort((a, b) => a.change - b.change); return sortBy("change"); }

function HistoricalBars({ bars }: { bars: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }> }) {
  const recent = bars.slice(-8);
  return <div className="history-bars"><div className="history-label">PERMITTED HISTORICAL BARS · NON-LIVE</div>{recent.length === 0 ? <div className="panel-state"><BookOpen size={15} /><span>No historical bars returned for this range.</span></div> : recent.map(bar => <div className="history-row" key={bar.timestamp}><span>{new Date(bar.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}</span><b>${bar.close.toFixed(2)}</b><span>H {bar.high.toFixed(2)} · L {bar.low.toFixed(2)}</span><small>Vol {formatVol(bar.volume / 1_000_000)}</small></div>)}</div>;
}

function Panel({ title, subtitle, children, className = "", action }: { title: string; subtitle?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return <section className={`terminal-panel ${className}`}><div className="panel-head"><div><div className="panel-title"><span className="panel-dot" />{title}</div>{subtitle && <div className="panel-subtitle">{subtitle}</div>}</div><div className="panel-actions">{action}<button className="icon-btn" aria-label="Panel menu"><MoreHorizontal size={14} /></button></div></div>{children}</section>;
}

export default function Home() {
  const [stocks, setStocks] = useState(seedStocks);
  const quoteSymbols = useMemo(() => quoteUniverse, []);
  // Massive entitlement failures are converted to typed fallback quotes server-side; do not retry them in the client.
  const liveQuotes = trpc.market.quotes.useQuery({ symbols: quoteSymbols }, MARKET_QUERY_OPTIONS);
  const providerHealth = trpc.market.health.useQuery(undefined, { refetchInterval: 30_000, retry: false });
  const flatFileHealth = trpc.market.flatFileHealth.useQuery(undefined, { refetchInterval: 60_000, retry: false });
  const [demoMode, setDemoMode] = useState(false);
  const [selected, setSelected] = useState("SMCI");
  const [historyRange] = useState(() => { const to = new Date(); const from = new Date(to); from.setDate(from.getDate() - 5); return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }; });
  const delayedHistory = trpc.market.bars.useQuery({ symbol: selected, ...historyRange }, { retry: false, refetchInterval: 15 * 60_000 });
  const delayedNews = trpc.market.news.useQuery({ ticker: selected, limit: 8 }, { refetchInterval: 15 * 60_000, retry: false });
  const freePlanRestricted = Boolean(providerHealth.data?.lastError?.includes("Stocks Basic") || liveQuotes.data?.some(q => q.providerError?.includes("plan does not include")));
  const displayNews = demoMode ? newsItems : (delayedNews.data ?? []).map(item => ({ time: new Date(item.published_utc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), symbol: item.tickers?.[0] ?? selected, title: item.title, source: item.publisher?.name ?? "Massive News", type: "News", tone: "blue" }));
  const displaySectors = demoMode ? sectors : [];
  const displayTape = demoMode ? stocks.slice(1, 6) : [];
  const hasFallbackQuotes = Boolean(liveQuotes.data?.some(q => q.source === "simulated"));
  const hasUnavailableQuotes = Boolean(liveQuotes.data?.some(q => q.source === "unavailable"));
  const isLiveProviderSource = (source?: string) => source === "massive" || source === "finnhub";
  const liveDataReady = Boolean(liveQuotes.data?.some(q => isLiveProviderSource(q.source)));
  const dataUnavailable = !demoMode && !liveDataReady;
  const feedStale = Boolean(liveQuotes.data?.some(q => isLiveProviderSource(q.source) && q.lastUpdated > 0 && Date.now() - q.lastUpdated > 60_000));
  const feedWarning = dataUnavailable || liveQuotes.isError || hasFallbackQuotes || hasUnavailableQuotes || feedStale || providerHealth.data?.status === "degraded" || providerHealth.data?.status === "offline";
  const freePlanUi = getFreePlanUiState({ demoMode, liveDataReady, planRestricted: freePlanRestricted });
  const [scanner, setScanner] = useState("Top Gainers");
  const [preset, setPreset] = useState("Low-Float Gappers");
  const [customPresets, setCustomPresets] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("arcane-presets") || "[]"); } catch { return []; } });
  const [newPresetName, setNewPresetName] = useState("");
  const [query, setQuery] = useState("");
  const [watchlist, setWatchlist] = useState(["NVDA", "SMCI", "IONQ", "BBAI"]);
  const [watchColumns, setWatchColumns] = useState(["LAST", "CHG", "ALERT"]);
  const [draggedTicker, setDraggedTicker] = useState<string | null>(null);
  const [muted, setMuted] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([
    { id: 1, symbol: "SMCI", title: "High-of-day breakout", detail: "48.20 → 48.73 · RVOL 8.31x", tone: "green", time: "09:16:04", read: false },
    { id: 2, symbol: "BBAI", title: "Unusual tape activity", detail: "72.6M volume · 12.52x RVOL", tone: "pink", time: "09:15:52", read: false },
    { id: 3, symbol: "IONQ", title: "News catalyst detected", detail: "Government quantum award", tone: "amber", time: "09:14:51", read: false },
  ]);
  const [lastTick, setLastTick] = useState(Date.now());
  const [filterOpen, setFilterOpen] = useState(false);
  const [live, setLive] = useState(true);
  const [sound, setSound] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showAllSymbols, setShowAllSymbols] = useState(false);
  const availablePresets = [...presets, ...customPresets];
  const [thresholds, setThresholds] = useState({ minPrice: "2.00", minFloat: "0", maxFloat: "5000", minMarketCap: "0", maxMarketCap: "5000000", minDollarVolume: "1", minChange: "2.00", minRvol: "2.00", maxSpread: "0.08" });
  const interval = useRef<number | null>(null);
  const alertKeys = useRef(new Set<string>());
  const displayStocks = demoMode ? stocks : stocks.filter(s => liveQuotes.data?.some(q => q.symbol === s.symbol && isLiveProviderSource(q.source)));
  const stock = displayStocks.find(s => s.symbol === selected) ?? displayStocks[0] ?? (demoMode ? stocks[1] : { symbol: "—", name: "Live data unavailable", price: 0, change: 0, volume: 0, rvol: 0, float: "—", floatM: 0, marketCap: "—", spread: 0, sector: "—", catalyst: "—", catalystType: "—", vwap: 0, high: 0, low: 0, premarket: 0, tape: "—", color: "#7c849f" });
  useEffect(() => { localStorage.setItem("arcane-presets", JSON.stringify(customPresets)); const timer = window.setTimeout(() => setLoading(false), 450); return () => window.clearTimeout(timer); }, [customPresets]);
  useEffect(() => { if (!liveQuotes.data?.length) return; setStocks(current => { const existing = new Map(current.map(item => [item.symbol, item])); const next = [...current]; for (const quote of liveQuotes.data) { if (!isLiveProviderSource(quote.source) || quote.price <= 0) continue; const currentRow = existing.get(quote.symbol); const updated = currentRow ? { ...currentRow, price: quote.price, change: quote.changePct, volume: quote.volume / 1000000, rvol: quote.source === "finnhub" ? 0 : currentRow.rvol, float: quote.source === "finnhub" ? "—" : currentRow.float, floatM: quote.source === "finnhub" ? 0 : currentRow.floatM, marketCap: quote.source === "finnhub" ? "—" : currentRow.marketCap, catalyst: quote.source === "finnhub" ? "Finnhub quote" : currentRow.catalyst, catalystType: quote.source === "finnhub" ? "Quote" : currentRow.catalystType, vwap: quote.vwap, high: quote.sessionHigh, low: quote.sessionLow, spread: Math.max(.01, quote.ask - quote.bid) } : providerQuoteToStock(quote, next.length); if (currentRow) next[next.findIndex(item => item.symbol === quote.symbol)] = updated; else next.push(updated); } return next; }); }, [liveQuotes.data]);
  const scannerRows = useMemo(() => { const minPrice = Number(thresholds.minPrice) || 0, minFloat = Number(thresholds.minFloat) || 0, maxFloat = Number(thresholds.maxFloat) || Infinity, minCap = Number(thresholds.minMarketCap) || 0, minDollar = Number(thresholds.minDollarVolume) || 0, minChange = Number(thresholds.minChange) || 0, minRvol = Number(thresholds.minRvol) || 0, maxSpread = Number(thresholds.maxSpread) || Infinity; return getProviderAwareScannerRows(displayStocks, scanner, { minPrice, minFloat, maxFloat, minMarketCap: minCap, minDollarVolume: minDollar, minChange, minRvol, maxSpread }, providerHealth.data?.provider); }, [displayStocks, providerHealth.data?.provider, scanner, thresholds]);
  const filteredStocks = scannerRows.filter(s => !query || `${s.symbol} ${s.name}`.toLowerCase().includes(query.toLowerCase()));
  const visibleScannerStocks = getVisibleScannerRows(filteredStocks, showAllSymbols);

  useEffect(() => {
    if (!live || !demoMode) return;
    interval.current = window.setInterval(() => {
      setStocks(current => current.map((s, i) => {
        const pulse = Math.sin(Date.now() / 1700 + i) * (s.price * .0011);
        const next = Math.max(.5, s.price + pulse);
        const change = s.change + Math.sin(Date.now() / 4200 + i) * .08;
        return { ...s, price: next, change, volume: s.volume + (i % 3 === 0 ? .03 : .01), high: Math.max(s.high, next) };
      }));
      setLastTick(Date.now());
      const liveKey = `SMCI:hod:${Math.floor(Date.now() / 12000)}`;
      if (!alertKeys.current.has(liveKey)) {
        alertKeys.current.add(liveKey);
        setAlerts(items => [{ id: Date.now(), symbol: "SMCI", title: "Live quote update", detail: "Simulated tick engine refreshed · deduped", tone: "green" as const, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }), read: false }, ...items].slice(0, 6));
        if (sound) { try { const ctx = new AudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.frequency.value = 740; gain.gain.value = .025; osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .06); } catch {} }
      }
    }, 1400);
    return () => { if (interval.current) window.clearInterval(interval.current); };
  }, [live, demoMode]);

  
  const selectedIsWatched = watchlist.includes(stock.symbol);
  const unread = alerts.filter(a => !a.read).length;
  const markAlertRead = (id: number) => setAlerts(items => items.map(a => a.id === id ? { ...a, read: true } : a));
  const copyTicker = async () => { try { await navigator.clipboard?.writeText(stock.symbol); } catch {} };
  const toggleWatch = () => setWatchlist(list => selectedIsWatched ? list.filter(x => x !== stock.symbol) : [...list, stock.symbol]);
  const toggleMute = () => setMuted(list => list.includes(stock.symbol) ? list.filter(x => x !== stock.symbol) : [...list, stock.symbol]);

  return <div className="terminal-app">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Activity size={15} /></div><div><span className="brand-name">ARCANE</span><span className="brand-product">MONITOR</span></div><button className="tiny-menu"><Menu size={13} /></button></div>
      <div className="topbar-center"><div className="market-pill"><span className="live-dot" />NYSE <b>OPEN</b></div><div className="session-clock"><span>MARKET CLOCK</span><strong>09:18:29 <em>AM ET</em></strong></div><div className="pre-market">PRE-MARKET <b>00h 11m 31s</b></div></div>
      <div className="topbar-right"><div className="feed-status"><Radio size={12} /> Feed <b>12ms</b></div><div className={`feed-status ${flatFileHealth.data?.status === "healthy" ? "healthy" : "offline"}`}><Database size={12} /> Files <b>{flatFileHealth.isLoading ? "…" : flatFileHealth.data?.status === "healthy" ? "OK" : "OFF"}</b></div><button className="top-icon"><Command size={14} /></button><button className="top-icon"><Settings2 size={14} /></button><div className="avatar">JD</div></div>
    </header>
    <div className="subbar"><div className="subbar-left"><span className="crumb">WORKSPACE / <b>DAY TRADER</b></span><span className="divider" /><button className="layout-btn"><LayoutGrid size={12} /> Dense layout <ChevronDown size={12} /></button></div><div className="subbar-right"><span className="paper-badge">PAPER ONLY</span>{!demoMode && <span className={`plan-badge ${freePlanRestricted || dataUnavailable ? "restricted" : ""}`}>{freePlanRestricted || dataUnavailable ? "FREE PLAN · REAL-TIME UNAVAILABLE" : "REAL-TIME ENTITLED"}</span>}{!demoMode && providerHealth.data?.provider === "finnhub" && <span className="personal-use-badge">FINNHUB · PERSONAL USE</span>}<button className={`demo-toggle ${demoMode ? "active" : ""}`} onClick={() => setDemoMode(value => !value)}>{demoMode ? "DEMO MODE" : "LIVE ONLY"}</button>{feedWarning && <span className="feed-warning">{freePlanRestricted || dataUnavailable ? "FREE PLAN · REAL-TIME UNAVAILABLE" : hasFallbackQuotes || liveQuotes.isError ? "PROVIDER ERROR" : "STALE FEED"}</span>}<span className="last-update"><span className="status-dot" />Last tick {new Date(lastTick).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span><button className={`live-toggle ${live ? "active" : ""}`} onClick={() => setLive(!live)}><span />{live ? "LIVE ENGINE" : "PAUSED"}</button></div></div>

    <main className="dashboard-grid">
      <aside className="scanner-rail">
        <div className="rail-head"><div><span className="eyebrow">SCANNER DECK</span><h1>Market pulse</h1></div><button className="icon-btn"><PanelLeft size={15} /></button></div>
        <div className="search-box"><Search size={14} /><input placeholder="Search symbol" value={query} onChange={e => setQuery(e.target.value)} /><kbd>/</kbd></div>
        <div className="rail-label">SCANNERS <span>10</span></div>
        <div className="scanner-list">{scannerNames.map((name, i) => <button key={name} onClick={() => setScanner(name)} className={`scanner-item ${scanner === name ? "active" : ""}`}><span className={`scanner-icon c${i}`}><Zap size={12} /></span><span>{name}</span><strong>{["48", "12", "31", "18", "22", "14", "9", "3", "27", "5"][i]}</strong></button>)}</div>
        <div className="rail-label preset-label">PRESETS <button className="icon-btn"><Plus size={13} /></button></div>
        <div className="preset-list">{availablePresets.map((p, i) => <button key={p} className={`preset ${preset === p ? "active" : ""}`} onClick={() => { setPreset(p); if (p === "Low-Float Gappers") setThresholds({ ...thresholds, maxFloat: "500", minChange: "5.00", minRvol: "3.00" }); if (p === "Large-Cap Momentum") setThresholds({ ...thresholds, minMarketCap: "10000", minDollarVolume: "25" }); if (p === "News Breakouts") setThresholds({ ...thresholds, minChange: "3.00", minRvol: "2.50", minDollarVolume: "5" }); }}><span className={`preset-dot d${i}`} />{p}<MoreHorizontal size={13} /></button>)}</div>
        <div className="rail-footer"><div className="engine-card"><div className="engine-card-head"><span className={`live-dot ${feedWarning ? "offline" : ""}`} />{dataUnavailable ? (freePlanRestricted ? "FREE PLAN · DELAYED DATA" : "LIVE DATA UNAVAILABLE") : demoMode ? "EXPLICIT DEMO FEED" : feedStale ? "STALE PROVIDER FEED" : providerHealth.data?.status === "healthy" ? `${providerHealth.data.provider?.toUpperCase() ?? "MARKET"} FEED` : "CONNECTING FEED"} <span className="engine-ms">{liveQuotes.isFetching ? "…" : "12ms"}</span></div><div className="engine-progress"><span /></div><div className="engine-stats"><span><b>8,412</b> symbols</span><span><b>1.4k</b> ticks/s</span></div></div><div className="rail-links"><button><BookOpen size={13} /> Docs</button><button><Settings2 size={13} /> Settings</button></div></div>
      </aside>

      <div className="main-column">
        <Panel title={scanner} subtitle={`${filteredStocks.length} symbols · ${preset}`} className="scanner-panel" action={<><button className="filter-chip" onClick={() => setFilterOpen(!filterOpen)}><SlidersHorizontal size={12} /> Filters</button><button className="icon-btn"><RefreshCw size={13} /></button></>}>
          {providerHealth.data?.provider === "finnhub" && !demoMode && <div className="filter-note">Finnhub quotes do not include RVOL, float, market cap, or volume. Those filters are not applied until the provider supplies the required fields.{getScannerDataNotice(scanner, providerHealth.data?.provider) ? ` ${getScannerDataNotice(scanner, providerHealth.data?.provider)}` : ""}</div>}{filterOpen && <div className="filter-drawer"><div><label>Min price</label><input value={thresholds.minPrice} onChange={e => setThresholds({ ...thresholds, minPrice: e.target.value })} /></div><div><label>Min float M</label><input value={thresholds.minFloat} onChange={e => setThresholds({ ...thresholds, minFloat: e.target.value })} /></div><div><label>Max float M</label><input value={thresholds.maxFloat} onChange={e => setThresholds({ ...thresholds, maxFloat: e.target.value })} /></div><div><label>Min cap M</label><input value={thresholds.minMarketCap} onChange={e => setThresholds({ ...thresholds, minMarketCap: e.target.value })} /></div><div><label>Min $vol M</label><input value={thresholds.minDollarVolume} onChange={e => setThresholds({ ...thresholds, minDollarVolume: e.target.value })} /></div><div><label>Min chg %</label><input value={thresholds.minChange} onChange={e => setThresholds({ ...thresholds, minChange: e.target.value })} /></div><div><label>Min RVOL</label><input value={thresholds.minRvol} onChange={e => setThresholds({ ...thresholds, minRvol: e.target.value })} /></div><div><label>Max spread</label><input value={thresholds.maxSpread} onChange={e => setThresholds({ ...thresholds, maxSpread: e.target.value })} /></div><div><label>Preset name</label><input placeholder="My scan" value={newPresetName} onChange={e => setNewPresetName(e.target.value)} /></div><button className="save-preset" onClick={() => { const name = newPresetName.trim() || `Custom scan ${customPresets.length + 1}`; setCustomPresets([...customPresets, name]); setPreset(name); setNewPresetName(""); }}>Save preset</button></div>}
          {loading ? <div className="panel-state"><RefreshCw size={15} className="spin" /><span>Connecting to {providerHealth.data?.provider === "finnhub" ? "Finnhub" : "Massive"} live feed…</span></div> : dataUnavailable ? <div className="panel-state unavailable-state"><Radio size={15} /><span>{providerHealth.data?.lastError?.includes("rate limit") ? "FINNHUB RATE LIMIT: quotes are temporarily unavailable. Wait for the provider window to reset; no fabricated prices are shown." : providerHealth.data?.provider === "finnhub" ? "FINNHUB QUOTES UNAVAILABLE: no valid provider quotes are available right now; no fabricated prices are shown." : "FREE PLAN ACCESS: real-time snapshots are not included. Upgrade Massive Stocks to enable live scanning; historical bars and provider news remain available below."}</span></div> : filteredStocks.length === 0 ? <div className="panel-state"><Search size={15} /><span>No symbols match these thresholds.</span></div> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th className="drag-col" /><th>SYMBOL</th><th>LAST</th><th>CHG %</th><th>RVOL</th><th>VOLUME</th><th>FLOAT</th><th>TAPE</th><th /></tr></thead><tbody>{visibleScannerStocks.map((s, i) => <tr key={s.symbol} className={selected === s.symbol ? "selected" : ""} onClick={() => setSelected(s.symbol)}><td className="drag-col"><GripVertical size={12} /></td><td><div className="symbol-cell"><span className="symbol-dot" style={{ background: s.color }} /><div><b>{s.symbol}</b><small>{s.name}</small></div></div></td><td className="price-cell">${s.price.toFixed(2)}</td><td className="positive">+{s.change.toFixed(2)}%</td><td><span className="rvol-badge">{s.rvol.toFixed(2)}x</span></td><td>{formatVol(s.volume)}</td><td>{s.float}</td><td><MiniSpark color={s.color} /></td><td><button className="row-add" onClick={e => { e.stopPropagation(); if (!watchlist.includes(s.symbol)) setWatchlist([...watchlist, s.symbol]); }}><Plus size={13} /></button></td></tr>)}</tbody></table></div>}
          <div className="table-footer"><span><span className="status-dot" /> Live updates enabled</span><span>{providerHealth.data?.provider === "finnhub" ? (getScannerDataNotice(scanner, providerHealth.data?.provider) ?? "Quote-only filters active · unsupported metrics ignored") : `Showing ${Math.min(visibleScannerStocks.length, filteredStocks.length)} of ${filteredStocks.length} matches`} {filteredStocks.length > 12 && <button className="show-more-btn" onClick={() => setShowAllSymbols(value => !value)}>{showAllSymbols ? "Show less" : `Show all ${filteredStocks.length}`} </button>}</span></div>
        </Panel>

        <div className="lower-grid">
          <Panel title="Symbol workspace" subtitle="Selected symbol · live quote" className="detail-panel" action={<span className="panel-kbd">⌘ K</span>}>
            {dataUnavailable && !demoMode ? <div className="panel-state unavailable-state"><Radio size={15} /><span>Live symbol data is unavailable. No seeded price is shown.</span></div> : <>
            <div className="symbol-hero"><div className="hero-title"><span className="hero-symbol">{stock.symbol}</span><span className="hero-name">{stock.name}</span><div className="hero-badges"><span className="badge badge-purple">{stock.catalystType}</span><span className="badge badge-green">{stock.sector}</span></div></div><div className="hero-quote"><span>${stock.price.toFixed(2)}</span><b className="positive">+{stock.change.toFixed(2)}%</b><small>+{(stock.price * stock.change / 100).toFixed(2)}</small></div></div>
            <div className="metrics-grid"><div><span>VOLUME</span><b>{formatVol(stock.volume)}</b></div><div><span>FLOAT</span><b>{stock.float}</b></div><div><span>RVOL</span><b className="amber-text">{stock.rvol.toFixed(2)}x</b></div><div><span>VWAP</span><b>${stock.vwap.toFixed(2)}</b></div><div><span>SESSION HIGH</span><b>${stock.high.toFixed(2)}</b></div><div><span>SESSION LOW</span><b>${stock.low.toFixed(2)}</b></div></div>
            <div className="quote-strip"><div><span>BID</span><b>${(stock.price - stock.spread).toFixed(2)}</b></div><div className="spread"><span>SPREAD</span><b>${stock.spread.toFixed(2)}</b></div><div><span>ASK</span><b>${(stock.price + stock.spread).toFixed(2)}</b></div></div>
            <div className="catalyst-callout"><Sparkles size={14} /><div><span>PRIMARY CATALYST</span><b>{stock.catalyst}</b></div><span className="confidence">92% relevance</span></div>
            <div className="quick-actions"><button onClick={toggleWatch} className={selectedIsWatched ? "active" : ""}><Star size={13} fill={selectedIsWatched ? "currentColor" : "none"} />{selectedIsWatched ? "Watching" : "Add to watchlist"}</button><button onClick={toggleMute} className={muted.includes(stock.symbol) ? "active" : ""}>{muted.includes(stock.symbol) ? <BellOff size={13} /> : <Bell size={13} />}{muted.includes(stock.symbol) ? "Alerts muted" : "Mute alerts"}</button><button onClick={() => { setScanner("Top Gainers"); document.querySelector(".news-panel")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}><BookOpen size={13} />Show news</button><button onClick={copyTicker}><Clipboard size={13} />Copy ticker</button>            </div></>}
          </Panel>

          <Panel title={dataUnavailable && !demoMode ? "Historical chart" : "Live chart"} subtitle={dataUnavailable && !demoMode ? `${stock.symbol} · provider bars · non-live` : `${stock.symbol} · 1 minute`} className="chart-panel" action={<><button className="timeframe active">1m</button><button className="timeframe">5m</button><button className="timeframe">D</button><button className="icon-btn"><Maximize2 size={13} /></button></>}>{demoMode ? <CandleChart stock={stock} /> : delayedHistory.data?.length ? <HistoricalBars bars={delayedHistory.data.map(bar => ({ timestamp: bar.start, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume }))} /> : <div className="panel-state unavailable-state"><Radio size={15} /><span>Provider chart bars are unavailable; generated candles are withheld.</span></div>}</Panel>
        </div>

        <div className="bottom-grid">
          <Panel title="Catalyst feed" subtitle={demoMode ? "Demo headlines · simulated" : `${providerHealth.data?.provider === "finnhub" ? "Finnhub" : "Massive"} provider news · non-live` } className="news-panel" action={<button className="filter-chip">All sources <ChevronDown size={11} /></button>}>{!demoMode && delayedNews.isError ? <div className="panel-state unavailable-state"><Radio size={15} /><span>{providerHealth.data?.provider === "finnhub" ? "Finnhub" : "Massive"} news is temporarily unavailable.</span></div> : displayNews.length === 0 ? <div className="panel-state"><BookOpen size={15} /><span>No provider headlines returned for {selected}.</span></div> : <div className="news-list">{displayNews.map((item, index) => (<div className="news-row" key={getNewsItemKey(item, index)}><span className="news-time">{item.time}</span><div className={`news-type ${item.tone}`} /><div className="news-copy"><div><b>{item.symbol}</b><span className={`news-tag ${item.tone}`}>{item.type}</span></div><p>{item.title}</p><small>{item.source}</small></div><button className="open-news">↗</button></div>))}</div>}</Panel>
          <Panel title="Watchlist" subtitle={`${watchlist.length} symbols · custom view`} className="watch-panel" action={<button className="filter-chip" onClick={() => setWatchColumns(watchColumns.length === 3 ? ["LAST", "CHG"] : ["LAST", "CHG", "ALERT"])}><Settings2 size={12} /> Columns</button>}>{dataUnavailable && !demoMode ? <div className="panel-state unavailable-state"><Radio size={15} /><span>LIVE WATCHLIST QUOTES UNAVAILABLE.</span></div> : <><div className="watch-table"><div className="watch-head"><span>SYMBOL</span>{watchColumns.map(column => <span key={column}>{column}</span>)}</div>{watchlist.map(ticker => { const s = displayStocks.find(x => x.symbol === ticker); if (!s) return null; return <button draggable className="watch-row" key={ticker} onDragStart={() => setDraggedTicker(ticker)} onDragOver={e => e.preventDefault()} onDrop={() => { if (draggedTicker && draggedTicker !== ticker) { const next = [...watchlist]; const from = next.indexOf(draggedTicker), to = next.indexOf(ticker); next.splice(from, 1); next.splice(to, 0, draggedTicker); setWatchlist(next); } setDraggedTicker(null); }} onClick={() => setSelected(ticker)}><span><span className="watch-star"><Star size={11} fill="currentColor" /></span><b>{ticker}</b></span>{watchColumns.includes("LAST") && <span>${s.price.toFixed(2)}</span>}{watchColumns.includes("CHG") && <span className="positive">+{s.change.toFixed(1)}%</span>}{watchColumns.includes("ALERT") && <span className={`alert-state ${muted.includes(ticker) ? "muted" : "on"}`}>{muted.includes(ticker) ? <BellOff size={11} /> : <Bell size={11} />}</span>}</button>; })}</div><button className="add-watch"><Plus size={13} /> Add symbol</button></>}</Panel>
        </div>
      </div>

      <aside className="right-column">
        <Panel title="Alert stream" subtitle={`${unread} unread · rule engine`} className="alert-panel" action={<button className="sound-btn" onClick={() => setSound(!sound)}>{sound ? <Volume2 size={13} /> : <BellOff size={13} />}</button>}><div className="alert-list">{alerts.map(a => <button className={`alert-row ${a.read ? "read" : ""}`} key={a.id} onClick={() => markAlertRead(a.id)}><div className={`alert-icon ${a.tone}`}>{a.tone === "green" ? <Crosshair size={13} /> : a.tone === "pink" ? <Gauge size={13} /> : <Sparkles size={13} />}</div><div className="alert-copy"><div><b>{a.symbol}</b><span>{a.time}</span></div><strong>{a.title}</strong><small>{a.detail}</small></div><span className="alert-unread" /></button>)}</div><button className="view-all">View alert history <ChevronDown size={13} /></button></Panel>
        <Panel title="Sector momentum" subtitle="Relative strength · breadth" className="sector-panel" action={<button className="icon-btn"><RefreshCw size={13} /></button>}>{dataUnavailable && !demoMode ? <div className="panel-state unavailable-state"><Radio size={15} /><span>LIVE SECTOR DATA UNAVAILABLE.</span></div> : <div className="sector-list">{displaySectors.map(s => <div className="sector-row" key={s.name}><div className="sector-top"><span><i style={{ background: s.color }} />{s.name}</span><b>{s.strength}</b></div><div className="strength-bar"><span style={{ width: `${s.strength}%`, background: s.color }} /></div><div className="sector-meta"><span>{s.breadth} advancing</span><span>{s.movers}</span></div></div>)}</div>}</Panel>
        <Panel title="Tape monitor" subtitle="Unusual activity · live" className="tape-panel" action={<span className="live-label"><span className="live-dot" />LIVE</span>}>{dataUnavailable && !demoMode ? <div className="panel-state unavailable-state"><Radio size={15} /><span>LIVE TAPE UNAVAILABLE.</span></div> : <div className="tape-list">{displayTape.map((s, i) => <div className="tape-row" key={s.symbol}><span className="tape-time">09:{16 - i}:0{i + 2}</span><b style={{ color: s.color }}>{s.symbol}</b><span className="tape-bar"><i style={{ width: `${35 + i * 12}%`, background: s.color }} /></span><span className="tape-value">{["$2.4M", "$884K", "$621K", "$418K", "$302K"][i]}</span></div>)}</div>}</Panel>
        <div className="right-footer"><button><Mic2 size={13} /> Voice search</button><span>{demoMode ? "Data is simulated (explicit demo mode)" : dataUnavailable ? "Live data unavailable" : `${providerHealth.data?.provider === "finnhub" ? "Finnhub" : "Massive"} live data`}</span></div>
      </aside>
    </main>
    <div className="toast"><span className="status-dot" /> {demoMode ? "Explicit demo feed connected" : dataUnavailable ? "Live data unavailable" : `${providerHealth.data?.provider === "finnhub" ? "Finnhub" : "Massive"} feed connected`} <button><X size={13} /></button></div>
  </div>;
}
