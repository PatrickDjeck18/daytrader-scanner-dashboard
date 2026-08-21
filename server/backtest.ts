export type ReplayBar = { timestamp: number; open: number; high: number; low: number; close: number; volume: number };
export type BacktestConfig = { minChangePct: number; minRvol: number; initialCapital: number; positionSize: number; slippageBps?: number; feePerTrade?: number };

export function replayBars(bars: ReplayBar[], speed = 1) {
  if (speed <= 0) throw new Error("Replay speed must be positive");
  const ordered = bars.slice().sort((a, b) => a.timestamp - b.timestamp); return ordered.map((bar, index) => ({ ...bar, replayIndex: index, delayMs: index === 0 ? 0 : Math.max(1, Math.round((bar.timestamp - ordered[index - 1]!.timestamp) / speed)) }));
}

export function runScannerBacktest(bars: ReplayBar[], config: BacktestConfig) {
  const ordered = bars.slice().sort((a, b) => a.timestamp - b.timestamp); const slippage = Math.max(0, config.slippageBps ?? 0) / 10_000; const fee = Math.max(0, config.feePerTrade ?? 0);
  let cash = config.initialCapital;
  let shares = 0;
  let entries = 0;
  let peak = cash;
  let maxDrawdown = 0;
  for (let i = 1; i < ordered.length; i++) {
    const previous = ordered[i - 1]!;
    const bar = ordered[i]!;
    const changePct = ((bar.close - previous.close) / previous.close) * 100;
    const rvol = bar.volume / Math.max(1, previous.volume);
    if (shares === 0 && changePct >= config.minChangePct && rvol >= config.minRvol && cash >= config.positionSize) { const entryPrice = bar.close * (1 + slippage); shares = Math.floor((config.positionSize - fee) / entryPrice); cash -= shares * entryPrice + fee; entries++; }
    if (shares > 0 && (bar.close < previous.close || i === ordered.length - 1)) { const exitPrice = bar.close * (1 - slippage); cash += shares * exitPrice - fee; shares = 0; }
    const equity = cash + shares * bar.close;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak === 0 ? 0 : (peak - equity) / peak);
  }
  const finalEquity = cash + (shares ? shares * ordered[ordered.length - 1]!.close * (1 - slippage) - fee : 0);
  return { initialCapital: config.initialCapital, finalEquity, pnl: finalEquity - config.initialCapital, returnPct: ((finalEquity / config.initialCapital) - 1) * 100, entries, maxDrawdownPct: maxDrawdown * 100, slippageBps: slippage * 10_000, feePerTrade: fee, dataStart: ordered[0]?.timestamp ?? null, dataEnd: ordered[ordered.length - 1]?.timestamp ?? null };
}

export function assertPaperOnlyOrder(mode: "paper" | "live") { if (mode !== "paper") throw new Error("Live order execution is disabled"); return true; }
