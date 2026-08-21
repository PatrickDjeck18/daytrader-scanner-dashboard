export type ReplayBar = { timestamp: number; open: number; high: number; low: number; close: number; volume: number };
export type BacktestConfig = { minChangePct: number; minRvol: number; initialCapital: number; positionSize: number };

export function replayBars(bars: ReplayBar[], speed = 1) {
  if (speed <= 0) throw new Error("Replay speed must be positive");
  return bars.slice().sort((a, b) => a.timestamp - b.timestamp).map((bar, index) => ({ ...bar, replayIndex: index, delayMs: index === 0 ? 0 : Math.max(1, Math.round((bar.timestamp - bars[index - 1]!.timestamp) / speed)) }));
}

export function runScannerBacktest(bars: ReplayBar[], config: BacktestConfig) {
  let cash = config.initialCapital;
  let shares = 0;
  let entries = 0;
  let peak = cash;
  let maxDrawdown = 0;
  for (let i = 1; i < bars.length; i++) {
    const previous = bars[i - 1]!;
    const bar = bars[i]!;
    const changePct = ((bar.close - previous.close) / previous.close) * 100;
    const rvol = bar.volume / Math.max(1, previous.volume);
    if (shares === 0 && changePct >= config.minChangePct && rvol >= config.minRvol && cash >= config.positionSize) { shares = Math.floor(config.positionSize / bar.close); cash -= shares * bar.close; entries++; }
    if (shares > 0 && (bar.close < previous.close || i === bars.length - 1)) { cash += shares * bar.close; shares = 0; }
    const equity = cash + shares * bar.close;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak === 0 ? 0 : (peak - equity) / peak);
  }
  const finalEquity = cash + (shares ? shares * bars[bars.length - 1]!.close : 0);
  return { initialCapital: config.initialCapital, finalEquity, pnl: finalEquity - config.initialCapital, returnPct: ((finalEquity / config.initialCapital) - 1) * 100, entries, maxDrawdownPct: maxDrawdown * 100 };
}

export function assertPaperOnlyOrder(mode: "paper" | "live") { if (mode !== "paper") throw new Error("Live order execution is disabled"); return true; }
