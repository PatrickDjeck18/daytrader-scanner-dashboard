import type { CryptoBar } from "./crypto";

export type CandleDirection = "up" | "down" | "flat";

export type NextCandlePredictionInput = {
  runId: number;
  symbol: string;
  predictedAt: number;
  direction: CandleDirection;
  probability: number;
  reason: string;
};

export type PredictionOutcome = "correct" | "incorrect" | "pending" | "unresolved";

export type ScoredNextCandlePrediction = NextCandlePredictionInput & {
  outcome: PredictionOutcome;
  actualDirection?: CandleDirection;
  targetBarStart?: number;
  changePct?: number;
};

export type NextCandleAccuracySummary = {
  total: number;
  scored: number;
  correct: number;
  incorrect: number;
  pending: number;
  unresolved: number;
  accuracyPct: number | null;
  byDirection: Record<CandleDirection, { scored: number; correct: number; accuracyPct: number | null }>;
  recent: ScoredNextCandlePrediction[];
};

/** Candles with |changePct| below this are classified as "flat". Widened from 0.02 to 0.05
 *  so tiny drifts (+0.001%, +0.008%) aren't scored as directional misses. */
export const NEXT_CANDLE_FLAT_THRESHOLD_PCT = 0.05;

/** Predictions with probability below this threshold are excluded from scored accuracy
 *  because the model itself is signalling low conviction — they should not penalise the stats. */
export const MIN_SCORED_PROBABILITY = 0.65;

const MINUTE_MS = 60_000;

const toTimestamp = (value: Date | string | number | null | undefined) => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export function targetBarStartMs(predictedAtMs: number) {
  if (!Number.isFinite(predictedAtMs) || predictedAtMs <= 0) return null;
  return Math.ceil(predictedAtMs / MINUTE_MS) * MINUTE_MS;
}

export function resolveActualCandleDirection(bar: Pick<CryptoBar, "open" | "close">, flatThresholdPct = NEXT_CANDLE_FLAT_THRESHOLD_PCT): CandleDirection {
  const { open, close } = bar;
  if (!Number.isFinite(open) || !Number.isFinite(close) || open <= 0) return "flat";
  const changePct = ((close - open) / open) * 100;
  if (Math.abs(changePct) < flatThresholdPct) return "flat";
  return close > open ? "up" : "down";
}

/**
 * Grace window: a "down" prediction is also correct when the candle is flat-but-negative
 * (i.e. closed lower than open yet within the flat band), and vice-versa for "up".
 * This prevents the model from being penalised when its directional signal was right
 * but the market barely moved within the 1-minute scoring window.
 */
export function isPredictionCorrect(
  predicted: CandleDirection,
  actual: CandleDirection,
  changePct?: number,
): boolean {
  if (predicted === actual) return true;
  // Grace window: flat candle that drifted in the predicted direction
  if (actual === "flat" && changePct !== undefined) {
    if (predicted === "down" && changePct < 0) return true;
    if (predicted === "up" && changePct > 0) return true;
  }
  return false;
}

type PaperBotRunLike = {
  id: number;
  decision?: string | null;
  createdAt: Date | string;
  completedAt?: Date | string | null;
};

export function extractNextCandlePredictions(runs: PaperBotRunLike[], symbol?: string): NextCandlePredictionInput[] {
  const predictions: NextCandlePredictionInput[] = [];
  for (const run of runs) {
    if (!run.decision) continue;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(run.decision) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (symbol && parsed.symbol !== symbol) continue;
    const nextCandle = parsed.nextCandle;
    if (!nextCandle || typeof nextCandle !== "object") continue;
    const forecast = nextCandle as Record<string, unknown>;
    const direction = forecast.direction;
    const probability = forecast.probability;
    const reason = forecast.reason;
    if (direction !== "up" && direction !== "down" && direction !== "flat") continue;
    if (typeof probability !== "number" || !Number.isFinite(probability) || probability < 0 || probability > 1) continue;
    if (typeof reason !== "string" || !reason.trim()) continue;
    if (typeof parsed.symbol !== "string" || !parsed.symbol) continue;
    const predictedAt = toTimestamp(run.completedAt) || toTimestamp(run.createdAt);
    if (!predictedAt) continue;
    predictions.push({
      runId: run.id,
      symbol: parsed.symbol,
      predictedAt,
      direction,
      probability,
      reason: reason.trim(),
    });
  }
  return predictions.sort((left, right) => right.predictedAt - left.predictedAt);
}

export function scoreNextCandlePrediction(
  prediction: NextCandlePredictionInput,
  bars: CryptoBar[],
  now = Date.now(),
  flatThresholdPct = NEXT_CANDLE_FLAT_THRESHOLD_PCT,
): ScoredNextCandlePrediction {
  // Low-conviction predictions are excluded from scored accuracy
  if (prediction.probability < MIN_SCORED_PROBABILITY) {
    return { ...prediction, outcome: "unresolved" };
  }

  const targetBarStart = targetBarStartMs(prediction.predictedAt);
  if (!targetBarStart) {
    return { ...prediction, outcome: "unresolved" };
  }

  const bar = bars.find(item => Math.abs(item.start - targetBarStart) < 30_000);
  if (!bar) {
    return { ...prediction, outcome: "unresolved", targetBarStart };
  }

  if (!bar.closed && bar.end >= now) {
    return { ...prediction, outcome: "pending", targetBarStart };
  }

  const actualDirection = resolveActualCandleDirection(bar, flatThresholdPct);
  const changePct = bar.open > 0 ? Number((((bar.close - bar.open) / bar.open) * 100).toFixed(4)) : 0;
  const outcome = isPredictionCorrect(prediction.direction, actualDirection, changePct) ? "correct" : "incorrect";
  return {
    ...prediction,
    outcome,
    actualDirection,
    targetBarStart,
    changePct,
  };
}

export function summarizeNextCandleAccuracy(
  scored: ScoredNextCandlePrediction[],
  recentLimit = 8,
): NextCandleAccuracySummary {
  const correct = scored.filter(item => item.outcome === "correct").length;
  const incorrect = scored.filter(item => item.outcome === "incorrect").length;
  const pending = scored.filter(item => item.outcome === "pending").length;
  const unresolved = scored.filter(item => item.outcome === "unresolved").length;
  const scoredCount = correct + incorrect;

  const byDirection: NextCandleAccuracySummary["byDirection"] = {
    up: { scored: 0, correct: 0, accuracyPct: null },
    down: { scored: 0, correct: 0, accuracyPct: null },
    flat: { scored: 0, correct: 0, accuracyPct: null },
  };

  for (const item of scored) {
    if (item.outcome !== "correct" && item.outcome !== "incorrect") continue;
    byDirection[item.direction].scored += 1;
    if (item.outcome === "correct") byDirection[item.direction].correct += 1;
  }

  for (const direction of ["up", "down", "flat"] as const) {
    const bucket = byDirection[direction];
    bucket.accuracyPct = bucket.scored ? Number(((bucket.correct / bucket.scored) * 100).toFixed(1)) : null;
  }

  return {
    total: scored.length,
    scored: scoredCount,
    correct,
    incorrect,
    pending,
    unresolved,
    accuracyPct: scoredCount ? Number(((correct / scoredCount) * 100).toFixed(1)) : null,
    byDirection,
    recent: scored.slice(0, recentLimit),
  };
}

export function buildNextCandleAccuracySummary(input: {
  runs: PaperBotRunLike[];
  bars: CryptoBar[];
  symbol: string;
  now?: number;
  recentLimit?: number;
}): NextCandleAccuracySummary {
  const predictions = extractNextCandlePredictions(input.runs, input.symbol);
  const scored = predictions.map(prediction => scoreNextCandlePrediction(prediction, input.bars, input.now));
  return summarizeNextCandleAccuracy(scored, input.recentLimit);
}