import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDown, ArrowUp, Radio, RefreshCw, ShieldCheck, WifiOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { CRYPTO_MARKET_OPTIONS, type CryptoBar, type CryptoInterval, type CryptoMarket, type CryptoQuote, type CryptoTrade, isSupportedCryptoSymbol, normalizeBinanceStreamKline, normalizeBinanceStreamTicker, normalizeBinanceStreamTrade, normalizeCryptoSymbol } from "@shared/crypto";

const STREAM_BASE: Record<CryptoMarket, string> = {
  "global-spot": "wss://data-stream.binance.vision/stream",
  "usds-futures": "wss://fstream.binance.com/market/stream",
  "binance-us-spot": "wss://stream.binance.us:9443/stream",
};

type StreamState = "connecting" | "live" | "reconnecting" | "offline";

function formatPrice(value: number | null | undefined) { if (value === null || value === undefined || !Number.isFinite(value)) return "—"; const digits = value >= 1_000 ? 2 : value >= 1 ? 4 : 6; return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: digits })}`; }
function formatCompact(value: number | null | undefined) { if (value === null || value === undefined || !Number.isFinite(value)) return "—"; if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`; if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`; if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(2)}K`; return value.toFixed(2); }
function formatTradeTime(timestamp: number) { return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }

function LiveCryptoChart({ bars }: { bars: CryptoBar[] }) {
  const recent = bars.slice(-72);
  if (!recent.length) return <div className="crypto-empty"><Radio size={15} /><span>Provider chart bars are unavailable. No generated candles are shown.</span></div>;
  const width = 760, height = 230, pad = 24, chartBottom = 192;
  const min = Math.min(...recent.map(bar => bar.low)), max = Math.max(...recent.map(bar => bar.high));
  const range = Math.max(0.00000001, max - min);
  const y = (value: number) => chartBottom - ((value - min) / range) * (chartBottom - pad);
  const x = (index: number) => pad + (index / Math.max(1, recent.length - 1)) * (width - pad * 2);
  const last = recent[recent.length - 1];
  return <div className="crypto-chart-wrap"><div className="crypto-chart-readout"><span>LIVE PROVIDER CANDLES</span><b>O {formatPrice(last.open)} · H {formatPrice(last.high)} · L {formatPrice(last.low)} · C {formatPrice(last.close)}</b><small>{formatTradeTime(last.end)}</small></div><svg viewBox={`0 0 ${width} ${height}`} className="crypto-chart" role="img" aria-label="Binance provider-backed live candlestick chart">{[0, .25, .5, .75, 1].map(level => <line key={level} x1={pad} x2={width - pad} y1={pad + (chartBottom - pad) * level} y2={pad + (chartBottom - pad) * level} stroke="#202a3c" strokeWidth="1" />)}{recent.map((bar, index) => { const up = bar.close >= bar.open; const candleWidth = Math.max(3, Math.min(9, (width - pad * 2) / recent.length * .62)); return <g key={bar.start}><line x1={x(index)} x2={x(index)} y1={y(bar.high)} y2={y(bar.low)} stroke={up ? "#37d39b" : "#f2768e"} strokeWidth="1.2" /><rect x={x(index) - candleWidth / 2} y={Math.min(y(bar.open), y(bar.close))} width={candleWidth} height={Math.max(2, Math.abs(y(bar.open) - y(bar.close)))} rx="1" fill={up ? "#37d39b" : "#f2768e"} /></g>; })}<line x1={pad} x2={width - pad} y1={y(last.close)} y2={y(last.close)} stroke={last.close >= last.open ? "#37d39b" : "#f2768e"} strokeDasharray="4 4" opacity=".85" /></svg><div className="crypto-axis"><span>{formatPrice(max)}</span><span>{formatPrice((min + max) / 2)}</span><span>{formatPrice(min)}</span></div></div>;
}

export default function CryptoTerminal() {
  const [market, setMarket] = useState<CryptoMarket>("global-spot");
  const [activeSymbol, setActiveSymbol] = useState("BTCUSDT");
  const [symbolInput, setSymbolInput] = useState("BTCUSDT");
  const [interval, setInterval] = useState<CryptoInterval>("1m");
  const [quote, setQuote] = useState<CryptoQuote | undefined>();
  const [bars, setBars] = useState<CryptoBar[]>([]);
  const [trades, setTrades] = useState<CryptoTrade[]>([]);
  const [streamState, setStreamState] = useState<StreamState>("connecting");
  const [inputError, setInputError] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const snapshot = trpc.crypto.quote.useQuery({ market, symbol: activeSymbol }, { retry: false, refetchOnWindowFocus: false });
  const initialBars = trpc.crypto.bars.useQuery({ market, symbol: activeSymbol, interval, limit: 120 }, { retry: false, refetchOnWindowFocus: false });
  const initialTrades = trpc.crypto.trades.useQuery({ market, symbol: activeSymbol, limit: 10 }, { retry: false, refetchOnWindowFocus: false });
  const marketLabel = CRYPTO_MARKET_OPTIONS.find(option => option.value === market)?.label ?? "Binance";
  const streamUrl = useMemo(() => { const lower = activeSymbol.toLowerCase(); return `${STREAM_BASE[market]}?streams=${lower}@ticker/${lower}@aggTrade/${lower}@kline_${interval}`; }, [activeSymbol, interval, market]);

  useEffect(() => { setQuote(snapshot.data); }, [snapshot.data]);
  useEffect(() => { setBars(initialBars.data ?? []); }, [initialBars.data]);
  useEffect(() => { setTrades(initialTrades.data ?? []); }, [initialTrades.data]);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | undefined;
    let retryTimer: number | undefined;
    let retryDelay = 1_500;
    const connect = () => {
      if (disposed) return;
      setStreamState(retryDelay > 1_500 ? "reconnecting" : "connecting");
      try {
        socket = new WebSocket(streamUrl);
        socket.onopen = () => { retryDelay = 1_500; };
        socket.onmessage = event => {
          try {
            const envelope = JSON.parse(String(event.data)) as { data?: unknown };
            const payload = envelope.data ?? envelope;
            if (payload && typeof payload === "object" && (payload as { e?: string }).e === "24hrTicker") {
              const next = normalizeBinanceStreamTicker(payload, market);
              if (next) { setQuote(next); setStreamState("live"); }
            } else if (payload && typeof payload === "object" && (payload as { e?: string }).e === "kline") {
              const next = normalizeBinanceStreamKline(payload);
              if (next) { setBars(current => [...current.filter(bar => bar.start !== next.start), next].sort((a, b) => a.start - b.start).slice(-160)); setStreamState("live"); }
            } else if (payload && typeof payload === "object" && (payload as { e?: string }).e === "aggTrade") {
              const next = normalizeBinanceStreamTrade(payload);
              if (next) { setTrades(current => [next, ...current.filter(trade => trade.id !== next.id)].slice(0, 12)); setStreamState("live"); }
            }
          } catch { /* Malformed public stream messages are ignored; no values are synthesized. */ }
        };
        socket.onerror = () => { if (!disposed) setStreamState("offline"); };
        socket.onclose = () => { if (disposed) return; setStreamState("reconnecting"); retryTimer = window.setTimeout(() => { retryDelay = Math.min(retryDelay * 2, 10_000); connect(); }, retryDelay); };
      } catch { setStreamState("offline"); }
    };
    connect();
    return () => { disposed = true; if (retryTimer) window.clearTimeout(retryTimer); socket?.close(); };
  }, [market, streamUrl]);

  const applySymbol = (event: React.FormEvent) => { event.preventDefault(); const next = normalizeCryptoSymbol(symbolInput); if (!isSupportedCryptoSymbol(next)) { setInputError("Enter a supported pair such as BTCUSDT or BTC/USDT."); return; } setInputError(null); setSymbolInput(next); setActiveSymbol(next); };
  const refresh = async () => { await Promise.allSettled([snapshot.refetch(), initialBars.refetch(), initialTrades.refetch(), utils.crypto.quote.invalidate({ market, symbol: activeSymbol })]); };
  const isUnavailable = quote?.availability === "unavailable";
  const direction = (quote?.changePct ?? 0) >= 0 ? "up" : "down";

  return <section className="crypto-terminal" aria-label="Binance live crypto terminal"><div className="crypto-terminal-head"><div><div className="crypto-title"><Activity size={14} /><span>BINANCE CRYPTO</span><span className="crypto-read-only"><ShieldCheck size={11} /> READ ONLY</span></div><p>Public market data · browser-session streaming · no account or order access</p></div><div className={`crypto-stream-state ${streamState}`}><span className="status-dot" />{streamState === "live" ? "LIVE STREAM" : streamState === "reconnecting" ? "RECONNECTING" : streamState === "offline" ? "STREAM OFFLINE" : "CONNECTING"}</div></div><div className="crypto-controls"><div className="crypto-market-tabs" role="tablist" aria-label="Binance crypto market"><button className={market === "global-spot" ? "active" : ""} onClick={() => setMarket("global-spot")}>Global Spot</button><button className={market === "usds-futures" ? "active" : ""} onClick={() => setMarket("usds-futures")}>USDⓈ-M Futures</button><button className={market === "binance-us-spot" ? "active" : ""} onClick={() => setMarket("binance-us-spot")}>Binance.US Spot</button></div><form className="crypto-symbol-form" onSubmit={applySymbol}><input aria-label="Crypto pair" value={symbolInput} onChange={event => setSymbolInput(event.target.value.toUpperCase())} placeholder="BTCUSDT" maxLength={24} /><button type="submit">Load pair</button></form><div className="crypto-intervals">{(["1m", "5m", "15m"] as CryptoInterval[]).map(value => <button key={value} className={interval === value ? "active" : ""} onClick={() => setInterval(value)}>{value}</button>)}</div><button className="crypto-refresh" onClick={() => void refresh()} aria-label="Refresh Binance market data"><RefreshCw size={13} className={snapshot.isFetching || initialBars.isFetching ? "spin" : ""} /></button></div>{inputError && <div className="crypto-notice" role="status">{inputError}</div>}{isUnavailable || snapshot.isError ? <div className="crypto-empty crypto-unavailable"><WifiOff size={15} /><span>{quote?.providerError ?? `${marketLabel} quote is currently unavailable. No generated price is shown.`}</span></div> : <><div className="crypto-quote-grid"><div className="crypto-pair"><span>ACTIVE PAIR</span><b>{activeSymbol}</b><small>{marketLabel}</small></div><div className="crypto-last"><span>LAST</span><b>{formatPrice(quote?.price)}</b></div><div className={`crypto-change ${direction}`}><span>24H CHANGE</span><b>{quote?.changePct === null || quote?.changePct === undefined ? "—" : <>{direction === "up" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{quote.changePct >= 0 ? "+" : ""}{quote.changePct.toFixed(2)}%</>}</b></div><div><span>24H HIGH / LOW</span><b>{formatPrice(quote?.high)} <em>/</em> {formatPrice(quote?.low)}</b></div><div><span>24H QUOTE VOL</span><b>{formatCompact(quote?.quoteVolume)}</b></div><div><span>BID / ASK</span><b>{formatPrice(quote?.bid)} <em>/</em> {formatPrice(quote?.ask)}</b></div></div><div className="crypto-data-grid"><LiveCryptoChart bars={bars} /><div className="crypto-tape"><div className="crypto-tape-head"><span>AGGREGATE TRADE TAPE</span><small>{trades.length ? `${trades.length} provider prints` : "Awaiting provider prints"}</small></div>{trades.length ? <div className="crypto-trade-list">{trades.map(trade => <div className={`crypto-trade-row ${trade.buyerIsMaker === true ? "sell" : "buy"}`} key={trade.id}><span>{formatTradeTime(trade.timestamp)}</span><b>{formatPrice(trade.price)}</b><span>{formatCompact(trade.quantity)}</span><i>{trade.buyerIsMaker === true ? "SELL" : trade.buyerIsMaker === false ? "BUY" : "—"}</i></div>)}</div> : <div className="crypto-empty"><Radio size={14} /><span>No aggregate trades returned yet.</span></div>}</div></div></>}</section>;
}
