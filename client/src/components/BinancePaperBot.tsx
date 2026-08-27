import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Bot, BrainCircuit, CircleDollarSign, Clock3, Crosshair, Gauge, Pause, Play, Radio, RefreshCw, ShieldAlert, ShieldCheck, TrendingDown, TrendingUp, Trophy, WifiOff, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ensureSupabaseAccessToken } from "@/lib/supabase";
import PaperBotActivityChart from "@/components/PaperBotActivityChart";

const PAPER_STRATEGIES = ["scalp_momentum", "fast_momentum", "range_reversion", "vwap_pullback", "bb_squeeze"] as const;
type PaperStrategy = typeof PAPER_STRATEGIES[number];
const money = (value: number | null | undefined) => value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const percentage = (value: number | null | undefined) => value === null || value === undefined || !Number.isFinite(value) ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const observedTime = (value: number | undefined) => value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
const isPaperStrategy = (value: unknown): value is PaperStrategy => typeof value === "string" && (PAPER_STRATEGIES as readonly string[]).includes(value);
type StrategyMeta = { title: string; description: string; bestFor: string; icon: typeof TrendingUp };
const strategyCopy: Record<PaperStrategy, StrategyMeta> = {
  scalp_momentum: { title: "Scalp Momentum", description: "1m trigger · both 5m/15m confirmations", bestFor: "Strong trending moves", icon: TrendingUp },
  fast_momentum: { title: "Fast Momentum", description: "1m trigger · one of 5m/15m confirms", bestFor: "Early trend breakouts", icon: Zap },
  range_reversion: { title: "Range Reversion", description: "1m pullback/bounce inside a contained range", bestFor: "Sideways / consolidating", icon: Gauge },
  vwap_pullback: { title: "VWAP Pullback", description: "Price 0.05–0.30% above VWAP · RSI<60 · RVOL>1.2", bestFor: "Intraday mean reversion", icon: Crosshair },
  bb_squeeze: { title: "BB Squeeze", description: "Band width <0.5% → breakout with RVOL>1.4x", bestFor: "Volatility expansion", icon: BarChart3 },
};
const holdLabels: Record<string, string> = { timeframe_conflict: "Timeframes conflict", low_volatility: "Low volatility", no_qualified_setup: "No qualified setup", risk_guard: "Paper risk guard", model_unavailable: "Model or provider unavailable" };

function StrategyCard({ strategy, active, onClick }: { strategy: PaperStrategy; active: boolean; onClick: () => void }) {
  const meta = strategyCopy[strategy];
  const Icon = meta.icon;
  return (
    <button type="button" className={`strategy-card${active ? " active" : ""}`} onClick={onClick} aria-pressed={active}>
      <div className="strategy-card-icon"><Icon size={15} /></div>
      <div className="strategy-card-body">
        <b>{meta.title}</b>
        <span>{meta.description}</span>
        <small>Best for: {meta.bestFor}</small>
      </div>
      {active ? <div className="strategy-card-pip" /> : null}
    </button>
  );
}

function IndicatorBadge({ label, value, color }: { label: string; value: string; color?: "up" | "down" | "warn" | "info" }) {
  return (
    <div className={`indicator-badge${color ? ` ${color}` : ""}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

type OneMinIndicators = { rsi?: number | null; trend?: string; rvol?: number | null; atr?: number | null; vwap?: number | null; bbWidth?: number | null; bbUpper?: number | null; bbLower?: number | null; stochRsi?: number | null };


export function getPaperBotDisplayState(input: { enabled?: number; lastRunStatus?: string | null; orders?: unknown[] } | undefined) { if (!input) return "loading" as const; if (input.enabled === 1) return "scheduled" as const; if ((input.orders?.length ?? 0) > 0) return "paused" as const; return "ready" as const; }
export function getScalpObservationDisplayState(input: { availability?: string; oneMinute?: { bars?: number }; fiveMinute?: { bars?: number }; fifteenMinute?: { bars?: number } } | undefined) { return input?.availability === "live" && (input.oneMinute?.bars ?? 0) > 0 && (input.fiveMinute?.bars ?? 0) > 0 && (input.fifteenMinute?.bars ?? 0) > 0 ? "live" as const : "unavailable" as const; }
export function getPaperBotRunSummary(run: { status: string; error?: string | null; decision?: string | null }) { try { const decision = run.decision ? JSON.parse(run.decision) as { reason?: unknown; holdCategory?: unknown } : undefined; const reason = typeof decision?.reason === "string" ? decision.reason : undefined; const category = typeof decision?.holdCategory === "string" ? holdLabels[decision.holdCategory] : undefined; return category && reason ? `${category} — ${reason}` : reason ?? run.error ?? "Awaiting completion"; } catch { return run.error ?? "Awaiting completion"; } }
export function getPaperBotQualityStats(runs: Array<{ decision?: string | null }>) { const decisions = runs.flatMap(run => { try { const parsed = run.decision ? JSON.parse(run.decision) as { confidence?: unknown; holdCategory?: unknown } : undefined; return parsed ? [parsed] : []; } catch { return []; } }); const confidence = decisions.flatMap(decision => typeof decision.confidence === "number" && Number.isFinite(decision.confidence) ? [decision.confidence] : []); const band = (predicate: (value: number) => boolean) => confidence.filter(predicate).length; return { decisions: decisions.length, averageConfidence: confidence.length ? confidence.reduce((sum, value) => sum + value, 0) / confidence.length : undefined, under40: band(value => value < .4), mid: band(value => value >= .4 && value < .6), qualified: band(value => value >= .6), modelOrParserHolds: decisions.filter(decision => decision.holdCategory === "model_unavailable").length }; }

export function getPaperBotPollingOptions(isBotEnabled: boolean) { return { retry: false, refetchInterval: isBotEnabled ? 3_000 : 10_000, refetchIntervalInBackground: true, refetchOnWindowFocus: true } as const; }

export type SymbolAttribution = {
  symbol: string;
  trades: number;
  wins: number;
  winRate: number;
  netPnl: number;
};

export type PaperBotPerformanceMetrics = {
  totalTrades: number;
  winRate: number;
  profitFactor: number | null;
  grossProfit: number;
  grossLoss: number;
  maxDrawdownPct: number;
  attribution: SymbolAttribution[];
};

export function getPaperBotPerformanceMetrics(orders: Array<{ symbol: string; side: string; fillPrice?: number | string | null; quantity?: number | string | null; status?: string }>, equity = 50, initialCapital = 50): PaperBotPerformanceMetrics {
  const symbolStats: Record<string, { trades: number; wins: number; netPnl: number }> = {};
  let grossProfit = 0;
  let grossLoss = 0;
  let totalTrades = 0;
  let wins = 0;

  // Track simulated round-trip PnL from filled paper orders
  const symbolPositions: Record<string, { totalCost: number; quantity: number }> = {};

  for (const order of orders) {
    const sym = order.symbol;
    const price = typeof order.fillPrice === "number" ? order.fillPrice : Number(order.fillPrice || 0);
    const qty = typeof order.quantity === "number" ? order.quantity : Number(order.quantity || 0);
    if (!price || !qty) continue;

    if (!symbolStats[sym]) {
      symbolStats[sym] = { trades: 0, wins: 0, netPnl: 0 };
    }
    if (!symbolPositions[sym]) {
      symbolPositions[sym] = { totalCost: 0, quantity: 0 };
    }

    if (order.side === "buy") {
      symbolPositions[sym].totalCost += price * qty;
      symbolPositions[sym].quantity += qty;
    } else if (order.side === "sell" && symbolPositions[sym].quantity > 0) {
      const closedQty = Math.min(qty, symbolPositions[sym].quantity);
      const avgEntry = symbolPositions[sym].totalCost / symbolPositions[sym].quantity;
      const tradePnl = (price - avgEntry) * closedQty;
      // Deduct simulated maker/taker fee
      const netTradePnl = tradePnl - (price * closedQty * 0.00075) - (avgEntry * closedQty * 0.00075);

      symbolPositions[sym].quantity -= closedQty;
      symbolPositions[sym].totalCost -= avgEntry * closedQty;

      totalTrades += 1;
      symbolStats[sym].trades += 1;
      symbolStats[sym].netPnl += netTradePnl;

      if (netTradePnl > 0) {
        wins += 1;
        symbolStats[sym].wins += 1;
        grossProfit += netTradePnl;
      } else {
        grossLoss += Math.abs(netTradePnl);
      }
    }
  }

  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99.9 : null;
  const maxDrawdownPct = Math.max(0, ((initialCapital - equity) / initialCapital) * 100);

  const attribution: SymbolAttribution[] = Object.entries(symbolStats).map(([symbol, stat]) => ({
    symbol,
    trades: stat.trades,
    wins: stat.wins,
    winRate: stat.trades > 0 ? (stat.wins / stat.trades) * 100 : 0,
    netPnl: stat.netPnl,
  }));

  return {
    totalTrades,
    winRate,
    profitFactor,
    grossProfit,
    grossLoss,
    maxDrawdownPct,
    attribution,
  };
}

function LiveScalpContext({ symbols }: { symbols: string[] }) {
  const [symbol, setSymbol] = useState(symbols[0] ?? "BTCUSDT");
  useEffect(() => { if (!symbols.includes(symbol)) setSymbol(symbols[0] ?? "BTCUSDT"); }, [symbol, symbols]);
  const observation = trpc.crypto.scalpContext.useQuery({ symbol }, { retry: false, refetchInterval: 5_000, refetchIntervalInBackground: false }); const state = getScalpObservationDisplayState(observation.data);
  const windows = state === "live" ? [{ label: "1m trigger", value: observation.data?.oneMinute }, { label: "5m confirm", value: observation.data?.fiveMinute }, { label: "15m confirm", value: observation.data?.fifteenMinute }] : [];
  const ind = (observation.data?.oneMinute as { indicators?: OneMinIndicators })?.indicators;
  const price = observation.data?.quote.price ?? null;
  const vwapDist = ind?.vwap && price ? (((price - ind.vwap) / ind.vwap) * 100) : null;

  return (
    <div className={`bot-live-context ${state}`}>
      <div className="bot-live-context-head">
        <div>
          <span className="binance-kicker">LIVE STRATEGY CONTEXT</span>
          <b><Radio size={13} /> Public chart observation · 5s refresh</b>
        </div>
        <span className="bot-observation-status">{observation.isFetching ? "REFRESHING" : state === "live" ? "OBSERVING" : "UNAVAILABLE"}</span>
      </div>
      <div className="bot-live-symbols" role="tablist" aria-label="Live paper-bot context pair">
        {symbols.map(item => <button type="button" key={item} onClick={() => setSymbol(item)} className={symbol === item ? "active" : ""}>{item}</button>)}
      </div>
      {state === "live" ? (
        <>
          <div className="bot-live-summary">
            <span>LAST {money(observation.data?.quote.price)}</span>
            <span className={(observation.data?.quote.changePct ?? 0) >= 0 ? "up" : "down"}>{percentage(observation.data?.quote.changePct)}</span>
            <small>Observed {observedTime(observation.data?.observedAt)}</small>
          </div>
          {ind ? (
            <div className="bot-indicator-panel">
              <IndicatorBadge label="TREND" value={ind.trend?.toUpperCase() ?? "NEUTRAL"} color={ind.trend === "bullish" ? "up" : ind.trend === "bearish" ? "down" : undefined} />
              {ind.rsi !== null && ind.rsi !== undefined ? <IndicatorBadge label="14 RSI" value={String(ind.rsi)} color={ind.rsi > 70 ? "down" : ind.rsi < 30 ? "up" : "warn"} /> : null}
              {ind.rvol !== null && ind.rvol !== undefined ? <IndicatorBadge label="20 RVOL" value={`${ind.rvol}×`} color={ind.rvol >= 1.4 ? "up" : ind.rvol < 1.0 ? "down" : "warn"} /> : null}
              {ind.atr !== null && ind.atr !== undefined ? <IndicatorBadge label="14 ATR" value={`$${ind.atr}`} color="info" /> : null}
              {vwapDist !== null ? <IndicatorBadge label="VWAP DIST" value={`${vwapDist >= 0 ? "+" : ""}${vwapDist.toFixed(3)}%`} color={Math.abs(vwapDist) < 0.3 ? "warn" : vwapDist > 0 ? "up" : "down"} /> : null}
              {ind.bbWidth !== null && ind.bbWidth !== undefined ? <IndicatorBadge label="BB WIDTH" value={`${ind.bbWidth.toFixed(3)}%`} color={ind.bbWidth < 0.5 ? "warn" : "info"} /> : null}
              {ind.stochRsi !== null && ind.stochRsi !== undefined ? <IndicatorBadge label="STOCH RSI" value={String(ind.stochRsi)} color={ind.stochRsi > 80 ? "down" : ind.stochRsi < 20 ? "up" : "info"} /> : null}
            </div>
          ) : null}
          <div className="bot-live-windows">
            {windows.map(window => (
              <div key={window.label}>
                <span>{window.label}</span>
                <b className={(window.value?.changePct ?? 0) >= 0 ? "up" : "down"}>{percentage(window.value?.changePct)}</b>
                <small>{window.value?.bars ?? 0} provider bars</small>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bot-live-unavailable"><WifiOff size={14} />{observation.data?.providerError ?? "Public 1m/5m/15m context is currently unavailable. No inferred market state is shown."}</div>
      )}
      <p><b>Observation only.</b> DeepSeek paper decisions evaluate multi-timeframe indicators and confidence-scaled risk sizing.</p>
    </div>
  );
}

export default function BinancePaperBot() {
  const utils = trpc.useUtils(); const tickers = trpc.crypto.tickers.useQuery({ market: "global-spot", limit: 24 }, { retry: false, refetchInterval: 30_000 }); const prices = useMemo(() => Object.fromEntries((tickers.data ?? []).map(item => ({ symbol: item.symbol, price: Number(item.price ?? 0) })).filter(item => item.price > 0).map(item => [item.symbol, item.price] as const)), [tickers.data]);
  const authMe = trpc.auth.me.useQuery(undefined, { retry: false });
  const authed = Boolean(authMe.data);
  const config = trpc.binancePaper.botConfig.useQuery(undefined, { enabled: authed, refetchInterval: 15_000, refetchIntervalInBackground: true, refetchOnWindowFocus: true, retry: false });
  const isBotEnabled = config.data?.enabled === 1;
  const polling = getPaperBotPollingOptions(isBotEnabled);
  const [tradingMode, setTradingMode] = useState<"paper" | "live">("paper");
  const isLive = tradingMode === "live";

  const credCheck = trpc.binancePaper.validateCredentials.useQuery(undefined, { enabled: authed, retry: false, refetchInterval: 20_000 });
  const account = trpc.binancePaper.account.useQuery({ prices }, { enabled: authed && !isLive, ...polling });
  const liveAccount = trpc.binancePaper.liveAccount.useQuery({ prices }, { enabled: authed && isLive, ...polling });
  const orders = trpc.binancePaper.orders.useQuery(undefined, { enabled: authed && !isLive, ...polling });
  const liveOrders = trpc.binancePaper.liveOrders.useQuery(undefined, { enabled: authed && isLive, ...polling });
  const runs = trpc.binancePaper.botRuns.useQuery(undefined, { enabled: authed, ...polling });

  const activeAccount = isLive ? (liveAccount.data ?? account.data) : account.data;
  const activeOrders = isLive ? (liveOrders.data ?? []) : (orders.data ?? []);

  const [symbols, setSymbols] = useState("BTCUSDT, ETHUSDT, SOLUSDT"); const [interval, setInterval] = useState<1 | 5 | 15>(5); const [strategy, setStrategy] = useState<PaperStrategy>("scalp_momentum"); const [expandedRun, setExpandedRun] = useState<number | null>(null); const [closingSymbol, setClosingSymbol] = useState<string | null>(null); const [closeError, setCloseError] = useState<string | null>(null);
  useEffect(() => {
    if (config.data) {
      try { const parsed = JSON.parse(config.data.symbols); if (Array.isArray(parsed)) setSymbols(parsed.join(", ")); } catch { /* preserved safely */ }
      setInterval(config.data.scheduleMinutes as 1 | 5 | 15);
      if (isPaperStrategy(config.data.strategy)) setStrategy(config.data.strategy);
      if (config.data.tradingMode === "live" || config.data.tradingMode === "paper") {
        setTradingMode(config.data.tradingMode as "paper" | "live");
      }
    }
  }, [config.data]);

  const refresh = async () => {
    await Promise.all([
      account.refetch(), liveAccount.refetch(), config.refetch(), orders.refetch(),
      liveOrders.refetch(), runs.refetch(), credCheck.refetch(),
    ]);
  };
  const save = trpc.binancePaper.saveBotConfig.useMutation({ onSuccess: refresh });
  const enable = trpc.binancePaper.enableBot.useMutation({ onSuccess: refresh });
  const closePosition = trpc.binancePaper.closePosition.useMutation({
    onSuccess: async () => {
      await Promise.all([account.refetch(), orders.refetch()]);
      await Promise.all([utils.binancePaper.account.invalidate(), utils.binancePaper.orders.invalidate()]);
      setClosingSymbol(null);
    },
    onError: () => setClosingSymbol(null),
  });
  const pause = trpc.binancePaper.pauseBot.useMutation({
    onSuccess: async () => {
      await refresh();
      await Promise.all([
        utils.binancePaper.account.invalidate(),
        utils.binancePaper.orders.invalidate(),
        utils.binancePaper.botConfig.invalidate(),
      ]);
    },
  });
  const triggerNow = trpc.binancePaper.triggerBotNow.useMutation({ onSuccess: refresh });
  const resetAccount = trpc.binancePaper.resetAccount.useMutation({ onSuccess: refresh });
  const parsedSymbols = symbols.split(",").map(value => value.trim().toUpperCase()).filter(Boolean);
  const status = getPaperBotDisplayState({ enabled: config.data?.enabled, lastRunStatus: config.data?.lastRunStatus, orders: activeOrders });
  const busy = save.isPending || enable.isPending || closePosition.isPending || pause.isPending || triggerNow.isPending || resetAccount.isPending;
  const currentStrategy = strategyCopy[strategy];
  const quality = useMemo(() => getPaperBotQualityStats(runs.data ?? []), [runs.data]);
  const paperInitialCapital = activeAccount && "initialCapital" in activeAccount ? activeAccount.initialCapital : undefined;
  const metrics = useMemo(() => getPaperBotPerformanceMetrics(activeOrders, activeAccount?.equity, paperInitialCapital), [activeOrders, activeAccount?.equity, paperInitialCapital]);

  const saveConfig = async () => {
    try {
      await ensureSupabaseAccessToken();
      await save.mutateAsync({ symbols: parsedSymbols, strategy, scheduleMinutes: interval, riskPct: 1, dailyLossStopPct: 3, maxOpenPositions: 3, tradingMode });
      if (config.data?.enabled === 1) {
        await enable.mutateAsync({ scheduleMinutes: interval });
      }
      refresh();
    } catch (err) {
      console.error("[BinancePaperBot] Failed to save bot config:", err);
    }
  };

  const handleEnableBot = async () => {
    try {
      await ensureSupabaseAccessToken();
      await save.mutateAsync({ symbols: parsedSymbols, strategy, scheduleMinutes: interval, riskPct: 1, dailyLossStopPct: 3, maxOpenPositions: 3, tradingMode });
      await enable.mutateAsync({ scheduleMinutes: interval });
      refresh();
    } catch (err) {
      console.error("[BinancePaperBot] Failed to enable scheduled bot:", err);
    }
  };

  const handleTriggerNow = async () => {
    try {
      await ensureSupabaseAccessToken();
      await triggerNow.mutateAsync();
      refresh();
    } catch (err) {
      console.error("[BinancePaperBot] Failed to trigger bot:", err);
    }
  };

  const handleClosePosition = async (symbol: string, markPrice: number) => {
    if (closingSymbol !== null) return;
    setClosingSymbol(symbol);
    setCloseError(null);
    try {
      await ensureSupabaseAccessToken();
      await Promise.race([
        closePosition.mutateAsync({ symbol, markPrice }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Close request timed out. Please refresh and try again.")), 15_000)),
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Unable to close ${symbol}`;
      setCloseError(message);
      console.error(`[BinancePaperBot] Failed to close ${symbol}:`, err);
      setClosingSymbol(null);
    }
  };

  const handlePauseBot = async () => {
    try {
      await ensureSupabaseAccessToken();
      await pause.mutateAsync();
    } catch (err) {
      console.error("[BinancePaperBot] Failed to stop paper bot:", err);
    }
  };

  const handleResetAccount = async () => {
    if (window.confirm("Reset paper account to $50.00 cash? This will close all open positions and clear previous order history.")) {
      try {
        await ensureSupabaseAccessToken();
        await resetAccount.mutateAsync();
        refresh();
      } catch (err) {
        console.error("[BinancePaperBot] Failed to reset paper account:", err);
      }
    }
  };

  const equityPnl = activeAccount ? activeAccount.equity - (paperInitialCapital ?? activeAccount.equity) : 0;
  const equityPct = paperInitialCapital ? (equityPnl / paperInitialCapital) * 100 : 0;
  const inProfit = equityPnl >= 0;

  return (
    <section className="binance-card paper-bot-card" id="binance-paper-bot">
      <div className="binance-card-head">
        <div>
          <span className="binance-kicker">{isLive ? "DEEPSEEK · BINANCE LIVE SPOT BOT" : "DEEPSEEK · QUANT PAPER BOT"}</span>
          <h2>
            <Bot size={18} /> {isLive ? `Binance Live Account · ${money(activeAccount?.equity)}` : "$50 intelligent paper account"}
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {!isLive && (
            <button type="button" className="bot-reset-btn" disabled={busy} onClick={handleResetAccount} title="Reset account balance to $50 cash and clear open positions">
              <RefreshCw size={12} className={resetAccount.isPending ? "spin" : ""} /> Reset to $50 Cash
            </button>
          )}
          <button aria-label="Refresh bot data" onClick={refresh}>
            <RefreshCw size={14} className={(account.isFetching || liveAccount.isFetching) ? "spin" : ""} />
          </button>
        </div>
      </div>

      {/* Mode Switch: Paper simulation or read-only Binance account visibility */}
      <div className="trading-mode-toggle-wrap">
        <div className="trading-mode-selector">
          <button
            type="button"
            className={`mode-btn ${tradingMode === "paper" ? "active paper" : ""}`}
            onClick={() => {
              if (tradingMode !== "paper") {
                setTradingMode("paper");
                void save.mutateAsync({ symbols: parsedSymbols, strategy, scheduleMinutes: interval, riskPct: 1, dailyLossStopPct: 3, maxOpenPositions: 3, tradingMode: "paper" });
              }
            }}
          >
            🧪 Paper Simulation
          </button>
          <button
            type="button"
            className={`mode-btn ${tradingMode === "live" ? "active live" : ""}`}
            onClick={() => {
              if (tradingMode !== "live") {
                const confirmed = window.confirm(
                  "Show your read-only Binance account view?\n\nThis only retrieves account balances and open positions. All bot decisions and simulated orders remain paper-only."
                );
                if (confirmed) {
                  setTradingMode("live");
                  void save.mutateAsync({ symbols: parsedSymbols, strategy, scheduleMinutes: interval, riskPct: 1, dailyLossStopPct: 3, maxOpenPositions: 3, tradingMode: "live" });
                }
              }
            }}
          >
            <span className="live-dot" /> Binance Account View
          </button>
        </div>
        {isLive && (
          <div className={`live-credentials-banner ${credCheck.data?.ok ? "connected" : "warning"}`}>
            <ShieldCheck size={13} />
            {credCheck.data?.ok
              ? `Binance API Connected (${credCheck.data.testnet ? "Testnet" : "Read-only Spot"})`
              : (credCheck.data?.error ?? "Binance account credentials are not configured")}
          </div>
        )}
      </div>

      {isLive && (
          <div className="live-mode-disclaimer">
            <ShieldAlert size={15} />
            <div>
              <b>READ-ONLY ACCOUNT VIEW:</b> This view retrieves Binance balances and open positions. The automated strategy and every generated order remain paper-only.
            </div>
          </div>
      )}

      <div className="paper-bot-banner">
        <ShieldCheck size={15} />
        <div>
          <b>{isLive ? "Read-only Binance account view." : "Simulated quantitative trading engine."} Kelly confidence-scaled risk sizing &amp; ATR stops.</b>
          <span>{currentStrategy.title}: {currentStrategy.description} — EMA/RSI/ATR/RVOL/VWAP/BB indicators · DeepSeek Chain-of-Thought reasoning.</span>
        </div>
      </div>

      {/* Premium Performance Scoreboard */}
      <div className={`paper-performance-board${inProfit ? " profit" : " loss"}`}>
        <div className="perf-equity">
          <span>{isLive ? "LIVE SPOT EQUITY" : "PAPER EQUITY"}</span>
          <b>{money(activeAccount?.equity)}</b>
          <div className={`perf-pnl ${inProfit ? "up" : "down"}`}>
            {inProfit ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{money(Math.abs(equityPnl))} ({percentage(equityPct)})</span>
          </div>
        </div>
        <div className="perf-stats-grid">
          <div><span>{isLive ? "FREE USDT" : "BUYING POWER"}</span><b>{money(activeAccount?.buyingPower)}</b><small>{activeAccount?.positions.length ?? 0} open position(s)</small></div>
          <div><span>WIN RATE</span><b>{metrics.totalTrades > 0 ? `${metrics.winRate.toFixed(1)}%` : "—"}</b><small>{metrics.totalTrades} closed trade(s)</small></div>
          <div><span>PROFIT FACTOR</span><b>{metrics.profitFactor !== null ? metrics.profitFactor.toString() : "—"}</b><small>Gross win {money(metrics.grossProfit)}</small></div>
          <div><span>MAX DRAWDOWN</span><b className={metrics.maxDrawdownPct > 1 ? "down" : ""}>{metrics.maxDrawdownPct > 0 ? `${metrics.maxDrawdownPct.toFixed(2)}%` : "—"}</b><small>{isLive ? "account balance view" : `vs initial ${money(paperInitialCapital)}`}</small></div>
        </div>
      </div>

      {!isLive && (activeAccount?.positions.length ?? 0) > 0 ? (
        <div className="paper-open-positions" aria-label="Open simulated positions">
          <div className="paper-open-positions-head">
            <div><span className="binance-kicker">OPEN SIMULATED POSITIONS</span><b>Manage positions individually</b></div>
            <small>Market sells use the latest public mark.</small>
          </div>
          <div className="paper-open-positions-grid">
            {activeAccount?.positions.map(position => {
              const unrealizedPnl = "unrealizedPnl" in position ? position.unrealizedPnl : 0;
              return (
                <div className="paper-position-row" key={position.symbol}>
                  <div>
                    <b>{position.symbol.replace("USDT", " / USDT")}</b>
                    <span>{position.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })} units · Entry {money(position.averageCost)}</span>
                  </div>
                  <div className="paper-position-mark">
                    <strong className={unrealizedPnl >= 0 ? "up" : "down"}>{money(unrealizedPnl)}</strong>
                    <small>Mark {money(position.marketPrice)}</small>
                  </div>
                  <button type="button" className="bot-position-close" disabled={closingSymbol === position.symbol} onClick={() => { void handleClosePosition(position.symbol, position.marketPrice); }}>
                    {closingSymbol === position.symbol ? "Closing…" : "Close position"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {metrics.maxDrawdownPct > 1 ? (
        <div className="paper-drawdown-warning"><ShieldAlert size={13} /><span>Drawdown {metrics.maxDrawdownPct.toFixed(2)}% detected — daily loss stop triggers at 3%</span></div>
      ) : null}

      <div className="bot-settings">
        <div className="bot-settings-head">
          <div><BrainCircuit size={15} /><b>{isLive ? "Live Binance Quantitative Settings" : "Scheduled quantitative settings"}</b></div>
          <span className={`bot-status ${status}`}>{status === "scheduled" ? (isLive ? "● LIVE ACTIVE (AUTO)" : "● SCHEDULED (AUTO)") : status === "paused" ? "○ PAUSED / IDLE" : "READY"}</span>
        </div>
        <div className="bot-symbol-selector">
          <label>
            <span>WATCHED GLOBAL SPOT PAIRS (Max 6)</span>
            <input aria-label="Scheduled bot pairs" value={symbols} onChange={event => setSymbols(event.target.value)} placeholder="BTCUSDT, ETHUSDT, SOLUSDT" />
          </label>
          <div className="quick-pair-chips">
            <span className="quick-pair-label">Quick add:</span>
            {["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "DOGEUSDT", "AVAXUSDT"].map(pair => {
              const active = parsedSymbols.includes(pair);
              return (
                <button
                  type="button"
                  key={pair}
                  className={`quick-pair-chip${active ? " active" : ""}`}
                  onClick={() => {
                    if (active) {
                      setSymbols(parsedSymbols.filter(s => s !== pair).join(", "));
                    } else if (parsedSymbols.length < 6) {
                      setSymbols([...parsedSymbols, pair].join(", "));
                    }
                  }}
                >
                  {active ? "✓ " : "+ "}{pair.replace("USDT", "")}
                </button>
              );
            })}
          </div>
        </div>
        <div className="bot-cadence-row">
          <span>RUN CADENCE</span>
          <div className="bot-intervals">{([1, 5, 15] as const).map(value => <button type="button" key={value} className={interval === value ? "active" : ""} onClick={() => setInterval(value)}>{value}m</button>)}</div>
          <small>Each decision sees multi-timeframe 1m · 5m · 15m indicators (EMA, RSI, ATR, RVOL, VWAP, Bollinger Bands).</small>
        </div>
        <div>
          <span className="bot-settings-label">{isLive ? "LIVE STRATEGY ENGINE" : "SIMULATION STRATEGY"}</span>
          <div className="strategy-card-grid">
            {PAPER_STRATEGIES.map(item => <StrategyCard key={item} strategy={item} active={strategy === item} onClick={() => setStrategy(item)} />)}
          </div>
          <small style={{ color: "#7f8999", fontSize: "9px", marginTop: "6px", display: "block" }}>Confidence-weighted Kelly sizing, +0.10% quick-profit lock, -0.18% stop-loss, and 3% daily drawdown stop active in paper mode. The managed bot evaluates at the selected 1m/5m/15m cadence; it never forces a trade.</small>
        </div>
        <div className="bot-actions">
          <button className="bot-secondary" disabled={busy || parsedSymbols.length < 1} onClick={saveConfig}><CircleDollarSign size={14} /> {isLive ? "Save live settings" : "Save paper settings"}</button>
          <button className="bot-trigger-instant" disabled={busy || parsedSymbols.length < 1} onClick={handleTriggerNow} title="Instantly trigger DeepSeek quantitative analysis on active market"><Zap size={14} className={triggerNow.isPending ? "spin" : ""} /> {triggerNow.isPending ? "Evaluating live chart…" : "⚡ Run DeepSeek Now"}</button>
          {config.data?.enabled === 1 ? <button className="bot-pause" disabled={busy} onClick={() => { void handlePauseBot(); }}><Pause size={14} /> {pause.isPending ? "Closing positions…" : "Stop / Pause Bot"}</button> : <button className="bot-enable" disabled={busy || parsedSymbols.length < 1} onClick={() => { void handleEnableBot(); }}><Play size={14} /> {isLive ? "Start Live DeepSeek Bot" : "Start scheduled simulation"}</button>}
        </div>
        {save.error || enable.error || closeError || closePosition.error || pause.error || triggerNow.error || resetAccount.error ? <div className="bot-error"><ShieldAlert size={14} />{save.error?.message ?? enable.error?.message ?? closeError ?? closePosition.error?.message ?? pause.error?.message ?? triggerNow.error?.message ?? resetAccount.error?.message}</div> : null}
      </div>

      <LiveScalpContext symbols={parsedSymbols} />
      <PaperBotActivityChart symbols={parsedSymbols} orders={orders.data ?? []} runs={runs.data ?? []} positions={account.data?.positions} />

      {metrics.attribution.length ? (
        <div className="paper-bot-history">
          <div><span className="binance-kicker">ALPHA ATTRIBUTION</span><h3><Trophy size={14} /> Performance by Asset</h3></div>
          <div className="alpha-attribution-grid">
            {metrics.attribution.map(attr => (
              <div key={attr.symbol} className="alpha-attribution-card">
                <div className="alpha-symbol">{attr.symbol.replace("USDT", "")}</div>
                <div className="alpha-stats">
                  <span>{attr.trades} trades</span>
                  <span className={attr.winRate >= 50 ? "up" : "down"}>{attr.winRate.toFixed(0)}% win</span>
                </div>
                <div className={`alpha-pnl ${attr.netPnl >= 0 ? "up" : "down"}`}>{money(attr.netPnl)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="paper-bot-history">
        <div><span className="binance-kicker">SIMULATION AUDIT · LAST {quality.decisions}</span><h3>Decision quality and latest activity</h3></div>
        {quality.decisions ? (
          <div className="bot-quality-summary">
            <span>AVG CONFIDENCE <b>{quality.averageConfidence?.toFixed(2) ?? "—"}</b></span>
            <span>&lt;0.40 <b>{quality.under40}</b></span>
            <span>0.40–0.59 <b>{quality.mid}</b></span>
            <span>≥0.60 <b>{quality.qualified}</b></span>
            <span>MODEL / PARSER HOLD <b>{quality.modelOrParserHolds}</b></span>
          </div>
        ) : null}
        {runs.data?.length ? (
          <div className="bot-run-list">
            {runs.data.slice(0, 8).map(run => (
              <div key={run.id} className="bot-run-row">
                <span className={`run-dot ${run.status}`} />
                <b>{run.status.replace("_", " ")}</b>
                <span>{new Date(run.createdAt).toLocaleString()}</span>
                <button type="button" className="run-expand-btn" onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)} aria-label="Toggle detail">{expandedRun === run.id ? "▲" : "▼"}</button>
                {expandedRun === run.id
                  ? <div className="bot-run-detail"><small>{getPaperBotRunSummary(run)}</small></div>
                  : <small className="bot-run-collapse">{getPaperBotRunSummary(run)}</small>}
              </div>
            ))}
          </div>
        ) : (
          <div className="binance-empty"><Clock3 size={15} />No scheduled simulation has run yet.</div>
        )}
      </div>
      <div className="paper-bot-footnote">{currentStrategy.title} is simulated analysis, not financial advice or execution. Market availability, diagnostic holds, risk guards, duplicate-run keys, and paper-only checks can block any proposed order.</div>
    </section>
  );
}
