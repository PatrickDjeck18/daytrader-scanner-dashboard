import { useEffect, useMemo, useState } from "react";
import { Activity, ChartNoAxesCombined, CirclePause, Crosshair, RefreshCw, ShieldAlert, Target } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { CryptoBar } from "@shared/crypto";

type ActivityOrder = { id: number; symbol: string; side: "buy" | "sell"; fillPrice: string | number; stopPrice?: string | number | null; targetPrice?: string | number | null; createdAt: Date | string };
type ActivityRun = { id: number; status: string; decision?: string | null; marketContext?: string | null; error?: string | null; createdAt: Date | string };
export type PaperActivityMarker = { id: string; type: "entry" | "stop" | "target" | "hold" | "risk_blocked" | "error"; timestamp: number; price?: number; title: string; detail: string };

const asNumber = (value: unknown) => { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined; };
const timestamp = (value: Date | string) => { const parsed = value instanceof Date ? value.getTime() : Date.parse(value); return Number.isFinite(parsed) ? parsed : 0; };
const parseJson = (value: string | null | undefined): Record<string, unknown> | undefined => { if (!value) return undefined; try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : undefined; } catch { return undefined; } };
const formatPrice = (value: number | undefined) => value === undefined ? "—" : value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: value >= 1_000 ? 2 : 6 });
const formatTime = (value: number) => value ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

function decisionMarkPrice(run: ActivityRun, symbol: string) {
  const context = parseJson(run.marketContext);
  const contexts = context?.contexts;
  if (!Array.isArray(contexts)) return undefined;
  const selected = contexts.find(item => item && typeof item === "object" && (item as { symbol?: unknown }).symbol === symbol) as { quote?: { price?: unknown } } | undefined;
  return asNumber(selected?.quote?.price);
}

export function buildPaperActivityMarkers(input: { symbol: string; orders: ActivityOrder[]; runs: ActivityRun[] }): PaperActivityMarker[] {
  const orderMarkers = input.orders.filter(order => order.symbol === input.symbol).flatMap(order => {
    const at = timestamp(order.createdAt); const side = order.side === "buy" ? "Buy" : "Sell"; const base = `Simulated ${side} entry`;
    const result: PaperActivityMarker[] = [{ id: `entry-${order.id}`, type: "entry", timestamp: at, price: asNumber(order.fillPrice), title: base, detail: `${base} · ${formatPrice(asNumber(order.fillPrice))}` }];
    const stop = asNumber(order.stopPrice); if (stop) result.push({ id: `stop-${order.id}`, type: "stop", timestamp: at, price: stop, title: "Risk stop", detail: `Simulated stop · ${formatPrice(stop)}` });
    const target = asNumber(order.targetPrice); if (target) result.push({ id: `target-${order.id}`, type: "target", timestamp: at, price: target, title: "Target", detail: `Simulated target · ${formatPrice(target)}` });
    return result;
  });
  const runMarkers = input.runs.flatMap(run => {
    if (!["hold", "risk_blocked", "error"].includes(run.status)) return [];
    const decision = parseJson(run.decision); if (decision?.symbol !== input.symbol) return [];
    const type = run.status as "hold" | "risk_blocked" | "error";
    const reason = typeof decision.reason === "string" ? decision.reason : run.error ?? "No paper order was created";
    return [{ id: `run-${run.id}`, type, timestamp: timestamp(run.createdAt), price: decisionMarkPrice(run, input.symbol), title: type === "hold" ? "DeepSeek hold" : type === "risk_blocked" ? "Risk blocked" : "Decision unavailable", detail: reason }];
  });
  return [...orderMarkers, ...runMarkers].sort((left, right) => right.timestamp - left.timestamp);
}

function ActivityChart({ bars, markers }: { bars: CryptoBar[]; markers: PaperActivityMarker[] }) {
  const recent = bars.slice(-110);
  if (!recent.length) return <div className="bot-activity-empty"><ChartNoAxesCombined size={16} />Public one-minute bars are unavailable. No chart or inferred markers are shown.</div>;
  const plotted = markers.filter(marker => marker.timestamp >= recent[0].start && marker.timestamp <= recent.at(-1)!.end);
  const pricedMarkers = plotted.flatMap(marker => marker.price ? [marker.price] : []);
  const width = 860, height = 270, pad = 30, bottom = 225;
  const min = Math.min(...recent.map(bar => bar.low), ...pricedMarkers);
  const max = Math.max(...recent.map(bar => bar.high), ...pricedMarkers);
  const range = Math.max(0.00000001, max - min);
  const x = (at: number) => pad + ((at - recent[0].start) / Math.max(1, recent.at(-1)!.end - recent[0].start)) * (width - pad * 2);
  const y = (value: number) => bottom - ((value - min) / range) * (bottom - pad);
  const markerY = (marker: PaperActivityMarker) => y(marker.price ?? recent.reduce((closest, bar) => Math.abs(bar.start - marker.timestamp) < Math.abs(closest.start - marker.timestamp) ? bar : closest, recent[0]).close);
  const markerColor: Record<PaperActivityMarker["type"], string> = { entry: "#37d39b", stop: "#ef596f", target: "#8e74ff", hold: "#fcd535", risk_blocked: "#ef596f", error: "#f08ba2" };
  const markerGlyph: Record<PaperActivityMarker["type"], string> = { entry: "E", stop: "S", target: "T", hold: "H", risk_blocked: "!", error: "×" };
  return <div className="bot-activity-chart-wrap"><svg className="bot-activity-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Public Binance one-minute chart with DeepSeek paper-bot decision markers">{[0, .25, .5, .75, 1].map(level => <line key={level} x1={pad} x2={width - pad} y1={pad + (bottom - pad) * level} y2={pad + (bottom - pad) * level} stroke="#27313b" strokeWidth="1" />)}{recent.map((bar, index) => { const up = bar.close >= bar.open; const at = pad + index / Math.max(1, recent.length - 1) * (width - pad * 2); const candle = Math.max(2.5, Math.min(7, (width - pad * 2) / recent.length * .6)); return <g key={bar.start}><line x1={at} x2={at} y1={y(bar.high)} y2={y(bar.low)} stroke={up ? "#37d39b" : "#f2768e"} strokeWidth="1" /><rect x={at - candle / 2} y={Math.min(y(bar.open), y(bar.close))} width={candle} height={Math.max(2, Math.abs(y(bar.open) - y(bar.close)))} fill={up ? "#37d39b" : "#f2768e"} rx="1" /></g>; })}{plotted.map(marker => <g key={marker.id} transform={`translate(${x(marker.timestamp)}, ${markerY(marker)})`} className={`bot-chart-marker ${marker.type}`}><title>{`${marker.title}: ${marker.detail}`}</title><circle r="9" fill={markerColor[marker.type]} stroke="#10151b" strokeWidth="2" /><text y="3" textAnchor="middle" fill="#10151b" fontSize="8" fontWeight="900">{markerGlyph[marker.type]}</text></g>)}</svg><div className="bot-activity-axis"><span>{formatPrice(max)}</span><span>{formatPrice((max + min) / 2)}</span><span>{formatPrice(min)}</span></div></div>;
}

export default function PaperBotActivityChart({ symbols, orders, runs }: { symbols: string[]; orders: ActivityOrder[]; runs: ActivityRun[] }) {
  const validSymbols = symbols.length ? symbols : ["BTCUSDT"];
  const [symbol, setSymbol] = useState(validSymbols[0]);
  useEffect(() => { if (!validSymbols.includes(symbol)) setSymbol(validSymbols[0]); }, [symbol, validSymbols]);
  const bars = trpc.crypto.bars.useQuery({ market: "global-spot", symbol, interval: "1m", limit: 120 }, { retry: false, refetchInterval: 15_000 });
  const markers = useMemo(() => buildPaperActivityMarkers({ symbol, orders, runs }), [symbol, orders, runs]);
  const inView = useMemo(() => { const first = bars.data?.[0]?.start ?? Infinity; const last = bars.data?.at(-1)?.end ?? -Infinity; return markers.filter(marker => marker.timestamp >= first && marker.timestamp <= last).length; }, [bars.data, markers]);
  return <section className="paper-bot-activity"><div className="paper-bot-activity-head"><div><span className="binance-kicker">LIVE PAPER ACTIVITY</span><h3><Activity size={16} /> DeepSeek decisions on public chart</h3><p>Public one-minute candles refresh while this dashboard is open. Markers show recorded paper decisions and simulated orders only.</p></div><button aria-label="Refresh paper-bot activity chart" onClick={() => void bars.refetch()}><RefreshCw size={14} className={bars.isFetching ? "spin" : ""} /></button></div><div className="bot-activity-toolbar"><div className="bot-activity-symbols" role="tablist" aria-label="Paper bot pair chart">{validSymbols.map(item => <button type="button" key={item} className={symbol === item ? "active" : ""} onClick={() => setSymbol(item)}>{item}</button>)}</div><span><Crosshair size={12} /> {inView} marker{inView === 1 ? "" : "s"} in visible window</span></div><div className="bot-marker-legend"><span className="entry">E Entry</span><span className="stop">S Stop</span><span className="target">T Target</span><span className="hold">H Hold</span><span className="blocked">! Blocked / unavailable</span></div><ActivityChart bars={bars.data ?? []} markers={markers} /><div className="bot-activity-events">{markers.length ? markers.slice(0, 6).map(marker => <div key={marker.id} className={`bot-activity-event ${marker.type}`}><span>{marker.type === "entry" ? <Activity size={13} /> : marker.type === "target" ? <Target size={13} /> : marker.type === "hold" ? <CirclePause size={13} /> : <ShieldAlert size={13} />}</span><div><b>{marker.title}</b><small>{marker.detail}</small></div><time>{formatTime(marker.timestamp)}</time></div>) : <div className="bot-activity-empty"><CirclePause size={15} />No persisted DeepSeek decision or simulated order exists for {symbol} yet.</div>}</div><div className="bot-activity-note">Markers are audit records, not forecasts or execution signals. A hold, risk block, or unavailable decision never creates a simulated order.</div></section>;
}
