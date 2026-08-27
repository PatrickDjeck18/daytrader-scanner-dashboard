import { useEffect, useMemo, useState } from "react";
import { Activity, BrainCircuit, ChartNoAxesCombined, CheckCircle2, ChevronRight, CirclePause, Crosshair, Clock3, RefreshCw, ShieldAlert, ShieldCheck, Target, XCircle, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ensureSupabaseAccessToken } from "@/lib/supabase";
import type { CryptoBar } from "@shared/crypto";
import { buildNextCandleAccuracySummary, type PredictionOutcome, type ScoredNextCandlePrediction } from "@shared/nextCandleAccuracy";

type ActivityOrder = { id: number; symbol: string; side: "buy" | "sell"; fillPrice: string | number; stopPrice?: string | number | null; targetPrice?: string | number | null; createdAt: Date | string };
type ActivityRun = { id: number; status: string; decision?: string | null; marketContext?: string | null; error?: string | null; createdAt: Date | string; completedAt?: Date | string | null };
type ActivePosition = { symbol: string; quantity: number; averageCost: number; marketPrice?: number; unrealizedPnl?: number };

export type PaperActivityMarker = {
  id: string;
  type: "entry" | "exit" | "stop" | "target" | "hold" | "risk_blocked" | "error";
  timestamp: number;
  price?: number;
  title: string;
  detail: string;
  confidence?: number;
  rawDecision?: Record<string, unknown>;
  nextCandle?: { direction: "up" | "down" | "flat"; probability: number; reason: string };
  symbol: string;
};

export type NextCandleForecast = { runId: number; direction: "up" | "down" | "flat"; probability: number; reason: string; timestamp: number };

const directionLabel = (direction: "up" | "down" | "flat") => direction === "up" ? "Up" : direction === "down" ? "Down" : "Flat";

const outcomeLabel = (item: ScoredNextCandlePrediction) => {
  if (item.outcome === "correct") return `Verified correct · actual ${directionLabel(item.actualDirection ?? "flat")}${item.changePct !== undefined ? ` (${item.changePct >= 0 ? "+" : ""}${item.changePct.toFixed(3)}%)` : ""}`;
  if (item.outcome === "incorrect") return `Verified wrong · actual ${directionLabel(item.actualDirection ?? "flat")}${item.changePct !== undefined ? ` (${item.changePct >= 0 ? "+" : ""}${item.changePct.toFixed(3)}%)` : ""}`;
  if (item.outcome === "pending") return "Awaiting target 1m bar close";
  return "Target bar not in loaded chart history";
};

const outcomeClass = (outcome: PredictionOutcome) => ({
  correct: "verified-correct",
  incorrect: "verified-incorrect",
  pending: "verified-pending",
  unresolved: "verified-unresolved",
}[outcome]);

const asNumber = (value: unknown) => { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined; };
const timestamp = (value: Date | string | null | undefined) => { if (!value) return 0; const parsed = value instanceof Date ? value.getTime() : Date.parse(value); return Number.isFinite(parsed) ? parsed : 0; };
const parseJson = (value: string | null | undefined): Record<string, unknown> | undefined => { if (!value) return undefined; try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : undefined; } catch { return undefined; } };
const formatPrice = (value: number | undefined) => value === undefined ? "—" : value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: value >= 1_000 ? 2 : 6 });
const formatTime = (value: number) => value ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

function decisionMarkPrice(run: ActivityRun, symbol: string) {
  const context = parseJson(run.marketContext); const contexts = context?.contexts;
  if (!Array.isArray(contexts)) return undefined;
  const selected = contexts.find(item => item && typeof item === "object" && (item as { symbol?: unknown }).symbol === symbol) as { quote?: { price?: unknown } } | undefined;
  return asNumber(selected?.quote?.price);
}

export function buildPaperActivityMarkers(input: { symbol: string; orders: ActivityOrder[]; runs: ActivityRun[] }): PaperActivityMarker[] {
  const orderMarkers = input.orders.filter(order => order.symbol === input.symbol).flatMap(order => {
    const at = timestamp(order.createdAt);
    const isBuy = order.side === "buy";
    const type = isBuy ? "entry" as const : "exit" as const;
    const base = isBuy ? "Simulated Buy" : "Simulated Sell Exit";
    const result: PaperActivityMarker[] = [{ id: `order-${order.id}`, symbol: order.symbol, type, timestamp: at, price: asNumber(order.fillPrice), title: base, detail: `${base} · ${formatPrice(asNumber(order.fillPrice))}` }];
    const stop = asNumber(order.stopPrice);
    if (stop && isBuy) result.push({ id: `stop-${order.id}`, symbol: order.symbol, type: "stop", timestamp: at, price: stop, title: "Risk stop", detail: `Simulated stop · ${formatPrice(stop)}` });
    const target = asNumber(order.targetPrice);
    if (target && isBuy) result.push({ id: `target-${order.id}`, symbol: order.symbol, type: "target", timestamp: at, price: target, title: "Target", detail: `Simulated target · ${formatPrice(target)}` });
    return result;
  });

  // Filter out "ordered" runs because they are already represented by orderMarkers (avoids duplicate markers)
  const runMarkers = input.runs.flatMap(run => {
    if (!(["hold", "risk_blocked", "error"] as string[]).includes(run.status)) return [];
    const decision = parseJson(run.decision); if (decision?.symbol !== input.symbol) return [];
    const type = run.status as "hold" | "risk_blocked" | "error";
    const reason = typeof decision.reason === "string" ? decision.reason : run.error ?? "No paper order was created";
    const confidence = typeof decision.confidence === "number" ? decision.confidence : undefined;
    const nextCandle = decision.nextCandle && typeof decision.nextCandle === "object" ? decision.nextCandle as { direction: "up" | "down" | "flat"; probability: number; reason: string } : undefined;
    return [{
      id: `run-${run.id}`,
      symbol: input.symbol,
      type,
      timestamp: timestamp(run.createdAt),
      price: decisionMarkPrice(run, input.symbol),
      title: type === "hold" ? "DeepSeek hold" : type === "risk_blocked" ? "Risk blocked" : "Decision unavailable",
      detail: reason,
      confidence,
      rawDecision: decision,
      nextCandle,
    }];
  });
  return [...orderMarkers, ...runMarkers].sort((left, right) => right.timestamp - left.timestamp);
}

const runTimestamp = (run: ActivityRun) => timestamp(run.completedAt) || timestamp(run.createdAt);

export function getLatestNextCandleForecast(input: { symbol: string; runs: ActivityRun[] }): NextCandleForecast | undefined {
  for (const run of input.runs.slice().sort((left, right) => runTimestamp(right) - runTimestamp(left))) {
    const decision = parseJson(run.decision); if (decision?.symbol !== input.symbol || !decision.nextCandle || typeof decision.nextCandle !== "object") continue;
    const forecast = decision.nextCandle as Record<string, unknown>; const direction = forecast.direction; const probability = forecast.probability; const reason = forecast.reason;
    if ((direction === "up" || direction === "down" || direction === "flat") && typeof probability === "number" && Number.isFinite(probability) && probability >= 0 && probability <= 1 && typeof reason === "string" && reason.trim()) {
      return { runId: run.id, direction, probability, reason, timestamp: runTimestamp(run) };
    }
  }
  return undefined;
}

function calculateSeriesEMA(bars: CryptoBar[], period: number): Array<{ x: number; y: number } | null> {
  if (bars.length < period) return [];
  const k = 2 / (period + 1);
  let ema = bars.slice(0, period).reduce((sum, b) => sum + b.close, 0) / period;
  const result: Array<number | null> = new Array(period - 1).fill(null);
  result.push(ema);
  for (let i = period; i < bars.length; i++) {
    ema = bars[i].close * k + ema * (1 - k);
    result.push(ema);
  }
  return result.map((val, idx) => val !== null ? { x: bars[idx].start, y: val } : null);
}

function calculateSeriesVWAP(bars: CryptoBar[]): Array<{ x: number; y: number } | null> {
  if (!bars.length) return [];
  let cumPV = 0;
  let cumVol = 0;
  return bars.map(bar => {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    cumPV += typicalPrice * bar.volume;
    cumVol += bar.volume;
    if (cumVol <= 0) return null;
    return { x: bar.start, y: cumPV / cumVol };
  });
}

function calculateSeriesBollingerBands(bars: CryptoBar[], period = 20, multiplier = 2): Array<{ x: number; upper: number; lower: number; middle: number } | null> {
  if (bars.length < period) return [];
  const result: Array<{ x: number; upper: number; lower: number; middle: number } | null> = new Array(period - 1).fill(null);
  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1).map(b => b.close);
    const middle = slice.reduce((sum, c) => sum + c, 0) / period;
    const variance = slice.reduce((sum, c) => sum + Math.pow(c - middle, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    result.push({
      x: bars[i].start,
      upper: middle + multiplier * stdDev,
      lower: middle - multiplier * stdDev,
      middle,
    });
  }
  return result;
}

function ActivityChart({
  bars,
  markers,
  activePosition,
  latestOrder,
  selectedMarkerId,
  onSelectMarker,
}: {
  bars: CryptoBar[];
  markers: PaperActivityMarker[];
  activePosition?: ActivePosition;
  latestOrder?: ActivityOrder;
  selectedMarkerId?: string | null;
  onSelectMarker: (marker: PaperActivityMarker) => void;
}) {
  const recent = bars.slice(-110);
  if (!recent.length) return <div className="bot-activity-empty"><ChartNoAxesCombined size={16} />Public one-minute bars are unavailable. No chart or inferred markers are shown.</div>;
  const plotted = markers.filter(marker => marker.timestamp >= recent[0].start && marker.timestamp <= recent.at(-1)!.end);
  const pricedMarkers = plotted.flatMap(marker => marker.price ? [marker.price] : []);
  const positionPrices = [activePosition?.averageCost, asNumber(latestOrder?.stopPrice), asNumber(latestOrder?.targetPrice)].filter(Boolean) as number[];
  const width = 860, height = 320, pad = 30, bottom = 230, volTop = 245, volBottom = 305;

  const min = Math.min(...recent.map(bar => bar.low), ...pricedMarkers, ...positionPrices);
  const max = Math.max(...recent.map(bar => bar.high), ...pricedMarkers, ...positionPrices);
  const range = Math.max(0.00000001, max - min);
  const maxVol = Math.max(...recent.map(bar => bar.volume), 1);

  const x = (at: number) => pad + ((at - recent[0].start) / Math.max(1, recent.at(-1)!.end - recent[0].start)) * (width - pad * 2);
  const y = (value: number) => bottom - ((value - min) / range) * (bottom - pad);
  const yVol = (vol: number) => volBottom - (vol / maxVol) * (volBottom - volTop);
  const markerY = (marker: PaperActivityMarker) => y(marker.price ?? recent.reduce((closest, bar) => Math.abs(bar.start - marker.timestamp) < Math.abs(closest.start - marker.timestamp) ? bar : closest, recent[0]).close);
  const markerColor: Record<PaperActivityMarker["type"], string> = { entry: "#37d39b", exit: "#4f8cff", stop: "#ef596f", target: "#8e74ff", hold: "#fcd535", risk_blocked: "#ef596f", error: "#f08ba2" };
  const markerGlyph: Record<PaperActivityMarker["type"], string> = { entry: "B", exit: "S", stop: "SL", target: "TP", hold: "H", risk_blocked: "!", error: "×" };

  const ema9Series = calculateSeriesEMA(recent, 9);
  const ema21Series = calculateSeriesEMA(recent, 21);
  const vwapSeries = calculateSeriesVWAP(recent);
  const bbSeries = calculateSeriesBollingerBands(recent, 20, 2);

  const ema9Points = ema9Series.flatMap(pt => pt ? [`${x(pt.x).toFixed(1)},${y(pt.y).toFixed(1)}`] : []).join(" ");
  const ema21Points = ema21Series.flatMap(pt => pt ? [`${x(pt.x).toFixed(1)},${y(pt.y).toFixed(1)}`] : []).join(" ");
  const vwapPoints = vwapSeries.flatMap(pt => pt ? [`${x(pt.x).toFixed(1)},${y(pt.y).toFixed(1)}`] : []).join(" ");

  const validBb = bbSeries.map((bb, i) => bb ? { ...bb, idx: i } : null).filter(Boolean) as Array<{ x: number; upper: number; lower: number; middle: number; idx: number }>;
  const bbAreaPoints = validBb.length > 1 ? [
    ...validBb.map(pt => `${x(pt.x).toFixed(1)},${y(pt.upper).toFixed(1)}`),
    ...validBb.slice().reverse().map(pt => `${x(pt.x).toFixed(1)},${y(pt.lower).toFixed(1)}`)
  ].join(" ") : "";

  const latestStop = asNumber(latestOrder?.stopPrice) ?? plotted.find(m => m.type === "stop")?.price;
  const latestTarget = asNumber(latestOrder?.targetPrice) ?? plotted.find(m => m.type === "target")?.price;
  const entryPrice = activePosition?.averageCost ?? asNumber(latestOrder?.fillPrice);
  const lastBar = recent.at(-1)!;

  return (
    <div className="bot-activity-chart-wrap">
      <svg className="bot-activity-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Binance one-minute chart with live DeepSeek AI decision markers">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {[0, .25, .5, .75, 1].map(level => <line key={level} x1={pad} x2={width - pad} y1={pad + (bottom - pad) * level} y2={pad + (bottom - pad) * level} stroke="#27313b" strokeWidth="1" />)}
        <line x1={pad} x2={width - pad} y1={volTop} y2={volTop} stroke="#27313b" strokeWidth="1" strokeDasharray="2 2" />

        {/* Bollinger Bands Shaded Area */}
        {bbAreaPoints ? <polygon points={bbAreaPoints} fill="rgba(79, 140, 255, 0.08)" stroke="rgba(79, 140, 255, 0.3)" strokeWidth="1" strokeDasharray="3 3" /> : null}

        {/* Active Trade Projections */}
        {latestTarget ? (
          <g>
            <line x1={pad} x2={width - pad} y1={y(latestTarget)} y2={y(latestTarget)} stroke="#8e74ff" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.85" />
            <rect x={width - pad - 80} y={y(latestTarget) - 9} width="75" height="18" fill="#1b1733" stroke="#8e74ff" rx="3" strokeWidth="1" />
            <text x={width - pad - 42} y={y(latestTarget) + 3} fill="#c8b6ff" fontSize="9" fontWeight="800" textAnchor="middle">TARGET {formatPrice(latestTarget)}</text>
          </g>
        ) : null}

        {entryPrice && activePosition ? (
          <g>
            <line x1={pad} x2={width - pad} y1={y(entryPrice)} y2={y(entryPrice)} stroke="#37d39b" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.85" />
            <rect x={width - pad - 80} y={y(entryPrice) - 9} width="75" height="18" fill="#0d241d" stroke="#37d39b" rx="3" strokeWidth="1" />
            <text x={width - pad - 42} y={y(entryPrice) + 3} fill="#71e8b7" fontSize="9" fontWeight="800" textAnchor="middle">ENTRY {formatPrice(entryPrice)}</text>
          </g>
        ) : null}

        {latestStop ? (
          <g>
            <line x1={pad} x2={width - pad} y1={y(latestStop)} y2={y(latestStop)} stroke="#ef596f" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.85" />
            <rect x={width - pad - 80} y={y(latestStop) - 9} width="75" height="18" fill="#2d1217" stroke="#ef596f" rx="3" strokeWidth="1" />
            <text x={width - pad - 42} y={y(latestStop) + 3} fill="#ff9dae" fontSize="9" fontWeight="800" textAnchor="middle">STOP {formatPrice(latestStop)}</text>
          </g>
        ) : null}

        {/* Volume Bars */}
        {recent.map((bar, index) => {
          const up = bar.close >= bar.open;
          const at = pad + index / Math.max(1, recent.length - 1) * (width - pad * 2);
          const candle = Math.max(2.5, Math.min(7, (width - pad * 2) / recent.length * .6));
          const vHeight = Math.max(1, volBottom - yVol(bar.volume));
          return <rect key={`vol-${bar.start}`} x={at - candle / 2} y={volBottom - vHeight} width={candle} height={vHeight} fill={up ? "rgba(14,203,129,0.3)" : "rgba(246,70,93,0.3)"} />;
        })}

        {/* Candlesticks */}
        {recent.map((bar, index) => {
          const up = bar.close >= bar.open;
          const at = pad + index / Math.max(1, recent.length - 1) * (width - pad * 2);
          const candle = Math.max(2.5, Math.min(7, (width - pad * 2) / recent.length * .6));
          return (
            <g key={bar.start}>
              <line x1={at} x2={at} y1={y(bar.high)} y2={y(bar.low)} stroke={up ? "#37d39b" : "#f2768e"} strokeWidth="1" />
              <rect x={at - candle / 2} y={Math.min(y(bar.open), y(bar.close))} width={candle} height={Math.max(2, Math.abs(y(bar.open) - y(bar.close)))} fill={up ? "#37d39b" : "#f2768e"} rx="1" />
            </g>
          );
        })}

        {/* Indicator Curves */}
        {vwapPoints ? <polyline points={vwapPoints} fill="none" stroke="#00e5ff" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.85" /> : null}
        {ema21Points ? <polyline points={ema21Points} fill="none" stroke="#8e74ff" strokeWidth="1.5" opacity="0.85" /> : null}
        {ema9Points ? <polyline points={ema9Points} fill="none" stroke="#fcd535" strokeWidth="1.5" opacity="0.9" /> : null}

        {/* Live Price Pulse Line */}
        {lastBar ? (
          <g>
            <line x1={pad} x2={width - pad} y1={y(lastBar.close)} y2={y(lastBar.close)} stroke={lastBar.close >= lastBar.open ? "#37d39b" : "#f2768e"} strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
            <circle cx={x(lastBar.start)} cy={y(lastBar.close)} r="3" fill={lastBar.close >= lastBar.open ? "#37d39b" : "#f2768e"} filter="url(#glow)" />
          </g>
        ) : null}

        {/* Decision Markers */}
        {plotted.map(marker => {
          const isSelected = selectedMarkerId === marker.id;
          const cx = x(marker.timestamp);
          const cy = markerY(marker);
          return (
            <g
              key={marker.id}
              transform={`translate(${cx}, ${cy})`}
              className={`bot-chart-marker ${marker.type}${isSelected ? " active" : ""}`}
              onClick={() => onSelectMarker(marker)}
              style={{ cursor: "pointer" }}
            >
              {isSelected ? (
                <circle r="9" fill="none" stroke={markerColor[marker.type]} strokeWidth="1.5" strokeDasharray="2 2" opacity="0.9" />
              ) : null}
              <circle r="5.5" fill={markerColor[marker.type]} stroke="#10151b" strokeWidth="1.5" filter={isSelected ? "url(#glow)" : undefined} />
              <text y="2.5" textAnchor="middle" fill="#10151b" fontSize="6.5" fontWeight="900">{markerGlyph[marker.type]}</text>
            </g>
          );
        })}
      </svg>
      <div className="bot-activity-axis">
        <span>{formatPrice(max)}</span>
        <span>{formatPrice((max + min) / 2)}</span>
        <span>{formatPrice(min)}</span>
      </div>
    </div>
  );
}

export default function PaperBotActivityChart({
  symbols,
  orders,
  runs,
  positions,
}: {
  symbols: string[];
  orders: ActivityOrder[];
  runs: ActivityRun[];
  positions?: ActivePosition[];
}) {
  const validSymbols = symbols.length ? symbols : ["BTCUSDT"];
  const [symbol, setSymbol] = useState(validSymbols[0]);
  const [selectedMarker, setSelectedMarker] = useState<PaperActivityMarker | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const utils = trpc.useUtils();

  useEffect(() => { if (!validSymbols.includes(symbol)) setSymbol(validSymbols[0]); }, [symbol, validSymbols]);

  const bars = trpc.crypto.bars.useQuery({ market: "global-spot", symbol, interval: "1m", limit: 500 }, { retry: false, refetchInterval: 5_000 });
  const triggerNow = trpc.binancePaper.triggerBotNow.useMutation({
    onSuccess: async () => {
      await Promise.all([
        bars.refetch(),
        utils.binancePaper.botRuns.refetch(),
        utils.binancePaper.orders.refetch(),
        utils.binancePaper.account.refetch(),
      ]);
      setIsTriggering(false);
    },
    onError: () => {
      setIsTriggering(false);
    },
  });

  const handleTriggerAnalysis = async () => {
    setIsTriggering(true);
    await ensureSupabaseAccessToken();
    triggerNow.mutate();
  };

  const markers = useMemo(() => buildPaperActivityMarkers({ symbol, orders, runs }), [symbol, orders, runs]);
  const forecast = useMemo(() => getLatestNextCandleForecast({ symbol, runs }), [symbol, runs]);
  const accuracy = useMemo(
    () => buildNextCandleAccuracySummary({ runs, bars: bars.data ?? [], symbol }),
    [runs, bars.data, symbol],
  );
  const latestVerification = useMemo(
    () => (forecast ? accuracy.recent.find(item => item.runId === forecast.runId) ?? accuracy.recent[0] : undefined),
    [accuracy.recent, forecast],
  );
  const inView = useMemo(() => {
    const first = bars.data?.[0]?.start ?? Infinity;
    const last = bars.data?.at(-1)?.end ?? -Infinity;
    return markers.filter(marker => marker.timestamp >= first && marker.timestamp <= last).length;
  }, [bars.data, markers]);

  const activePosition = positions?.find(p => p.symbol === symbol);
  const latestOrder = orders.find(o => o.symbol === symbol);
  const activeMarker = selectedMarker ?? markers[0] ?? null;

  return (
    <section className="paper-bot-activity">
      <div className="paper-bot-activity-head">
        <div>
          <div className="activity-live-badge-row">
            <span className="binance-kicker">LIVE DEEPSEEK CHART</span>
            <span className="live-stream-pulse"><span className="pulse-dot" /> STREAMING 1M BARS</span>
          </div>
          <h3><Activity size={16} /> Live AI Trade Decisions &amp; Candlestick Plot</h3>
          <p>Watch DeepSeek evaluate multi-timeframe quantitative indicators (EMA 9/21, VWAP, Bollinger Bands, ATR, RVOL) live on Binance 1m bars.</p>
        </div>
        <div className="chart-head-actions">
          <button
            type="button"
            className="bot-trigger-scan-btn"
            disabled={isTriggering || triggerNow.isPending}
            onClick={handleTriggerAnalysis}
            title="Send current multi-timeframe market context to DeepSeek for instant live decision"
          >
            {isTriggering || triggerNow.isPending ? (
              <><RefreshCw size={13} className="spin" /> Analyzing live chart…</>
            ) : (
              <><Zap size={13} /> Evaluate with DeepSeek Now</>
            )}
          </button>
          <button aria-label="Refresh paper-bot activity chart" onClick={() => void bars.refetch()}>
            <RefreshCw size={14} className={bars.isFetching ? "spin" : ""} />
          </button>
        </div>
      </div>

      <div className="bot-activity-toolbar">
        <div className="bot-activity-symbols" role="tablist" aria-label="Paper bot pair chart">
          {validSymbols.map(item => (
            <button
              type="button"
              key={item}
              className={symbol === item ? "active" : ""}
              onClick={() => { setSymbol(item); setSelectedMarker(null); }}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="toolbar-stats">
          <span><Crosshair size={12} /> {inView} AI marker{inView === 1 ? "" : "s"} visible</span>
          {activePosition ? (
            <span className="active-pos-tag"><ShieldCheck size={11} /> POSITION OPEN ({activePosition.quantity.toFixed(4)})</span>
          ) : null}
        </div>
      </div>

      {/* Experimental Next Candle Forecast */}
      <div className={`next-candle-forecast ${forecast?.direction ?? "empty"}`}>
        <div>
          <span className="binance-kicker">EXPERIMENTAL · DEEPSEEK NEXT 1M CANDLE PREDICTION</span>
          {forecast ? (
            <>
              <b>{forecast.direction === "up" ? "▲ Upward Bullish" : forecast.direction === "down" ? "▼ Downward Bearish" : "▬ Flat / Neutral"} bias · {Math.round(forecast.probability * 100)}% model probability</b>
              <small>{forecast.reason}</small>
              {latestVerification ? (
                <span className={`forecast-verification ${outcomeClass(latestVerification.outcome)}`}>
                  {latestVerification.outcome === "correct" ? <CheckCircle2 size={11} /> : latestVerification.outcome === "incorrect" ? <XCircle size={11} /> : <Clock3 size={11} />}
                  {outcomeLabel(latestVerification)}
                </span>
              ) : null}
            </>
          ) : (
            <>
              <b>No stored next-candle prediction yet</b>
              <small>Click "Evaluate with DeepSeek Now" above to generate a real-time quantitative forecast.</small>
            </>
          )}
        </div>
        {forecast ? <time>{formatTime(forecast.timestamp)}</time> : null}
        <p>Each forecast targets the first full 1m bar after the evaluation timestamp. Flat candles use a ±0.02% open/close threshold.</p>
      </div>

      <div className="next-candle-accuracy">
        <div className="accuracy-head">
          <span className="binance-kicker">PREDICTION ACCURACY · VERIFIED OUTCOMES</span>
          <span>{accuracy.scored} scored · {accuracy.pending} pending · {accuracy.unresolved} outside chart window</span>
        </div>
        <div className="accuracy-stats">
          <div className="accuracy-main">
            <b>{accuracy.accuracyPct ?? "—"}%</b>
            <small>hit rate ({accuracy.correct}/{accuracy.scored || 0})</small>
          </div>
          <div className="accuracy-breakdown">
            <span>Up {accuracy.byDirection.up.accuracyPct ?? "—"}% <small>({accuracy.byDirection.up.correct}/{accuracy.byDirection.up.scored})</small></span>
            <span>Down {accuracy.byDirection.down.accuracyPct ?? "—"}% <small>({accuracy.byDirection.down.correct}/{accuracy.byDirection.down.scored})</small></span>
            <span>Flat {accuracy.byDirection.flat.accuracyPct ?? "—"}% <small>({accuracy.byDirection.flat.correct}/{accuracy.byDirection.flat.scored})</small></span>
          </div>
        </div>
        {accuracy.recent.length ? (
          <div className="accuracy-recent">
            {accuracy.recent.slice(0, 5).map(item => (
              <div key={item.runId} className={`accuracy-row ${outcomeClass(item.outcome)}`}>
                <span>{directionLabel(item.direction)} · {Math.round(item.probability * 100)}%</span>
                <small>{outcomeLabel(item)}</small>
                <time>{formatTime(item.predictedAt)}</time>
              </div>
            ))}
          </div>
        ) : (
          <p className="accuracy-empty">Run DeepSeek evaluations to start building a verified accuracy history for {symbol}.</p>
        )}
      </div>

      <div className="bot-marker-legend">
        <span className="entry">● E Buy Entry</span>
        <span className="stop">● S Stop Loss</span>
        <span className="target">● T Target TP</span>
        <span className="hold">● H Hold Decision</span>
        <span className="blocked">● ! Risk Guard</span>
        <span style={{ color: "#fcd535" }}>— EMA 9</span>
        <span style={{ color: "#8e74ff" }}>— EMA 21</span>
        <span style={{ color: "#00e5ff" }}>··· VWAP</span>
        <span style={{ color: "rgba(79, 140, 255, 0.7)" }}>░ BB(20,2)</span>
      </div>

      <ActivityChart
        bars={bars.data ?? []}
        markers={markers}
        activePosition={activePosition}
        latestOrder={latestOrder}
        selectedMarkerId={activeMarker?.id}
        onSelectMarker={m => setSelectedMarker(m)}
      />

      {/* Interactive DeepSeek Decision Inspector */}
      {activeMarker ? (
        <div className={`bot-decision-inspector ${activeMarker.type}`}>
          <div className="inspector-header">
            <div className="inspector-title">
              <BrainCircuit size={15} />
              <b>DeepSeek Decision Inspector · {activeMarker.symbol}</b>
              <span className={`decision-badge ${activeMarker.type}`}>{activeMarker.type.toUpperCase().replace("_", " ")}</span>
            </div>
            <time>{formatTime(activeMarker.timestamp)}</time>
          </div>
          <div className="inspector-body">
            <div className="inspector-field">
              <span>RATIONALE / REASONING</span>
              <p>{activeMarker.detail}</p>
            </div>
            <div className="inspector-grid">
              {activeMarker.confidence !== undefined ? (
                <div>
                  <span>CONFIDENCE</span>
                  <b>{Math.round(activeMarker.confidence * 100)}%</b>
                </div>
              ) : null}
              {activeMarker.price ? (
                <div>
                  <span>RECORDED MARK</span>
                  <b>{formatPrice(activeMarker.price)}</b>
                </div>
              ) : null}
              {activeMarker.nextCandle ? (
                <div>
                  <span>NEXT CANDLE</span>
                  <b>{activeMarker.nextCandle.direction.toUpperCase()} ({Math.round(activeMarker.nextCandle.probability * 100)}%)</b>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="bot-activity-events">
        <div className="events-header">
          <span>RECORDED DEEPSEEK AI DECISION AUDIT (Click to inspect on chart)</span>
        </div>
        {markers.length ? markers.slice(0, 6).map(marker => (
          <div
            key={marker.id}
            className={`bot-activity-event ${marker.type}${activeMarker?.id === marker.id ? " active-event" : ""}`}
            onClick={() => setSelectedMarker(marker)}
            style={{ cursor: "pointer" }}
          >
            <span>
              {marker.type === "entry" ? <Activity size={13} /> : marker.type === "target" ? <Target size={13} /> : marker.type === "hold" ? <CirclePause size={13} /> : <ShieldAlert size={13} />}
            </span>
            <div>
              <b>{marker.title} {marker.confidence !== undefined ? `(${Math.round(marker.confidence * 100)}% Conf)` : ""}</b>
              <small>{marker.detail}</small>
            </div>
            <time>{formatTime(marker.timestamp)}</time>
            <ChevronRight size={12} opacity={0.6} />
          </div>
        )) : (
          <div className="bot-activity-empty">
            <CirclePause size={15} />
            No DeepSeek decision or simulated order recorded for {symbol} yet. Click "Evaluate with DeepSeek Now" above to analyze!
          </div>
        )}
      </div>

      <div className="bot-activity-note">
        Interactive chart overlay. Click any marker on the chart to inspect DeepSeek's quantitative reasoning, confidence metric, and multi-timeframe risk parameters.
      </div>
    </section>
  );
}
