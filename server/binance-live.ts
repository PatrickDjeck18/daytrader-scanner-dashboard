import crypto from "node:crypto";
import { fetchWithTimeout } from "./production";
import { fetchBinanceCryptoQuote } from "./binance";

export interface BinanceLiveConfig {
  apiKey?: string;
  apiSecret?: string;
  testnet?: boolean;
}

export function getBinanceLiveConfig(): BinanceLiveConfig {
  return {
    apiKey: process.env.BINANCE_API_KEY?.trim(),
    apiSecret: process.env.BINANCE_API_SECRET?.trim(),
    testnet: process.env.BINANCE_TESTNET === "true" || process.env.BINANCE_TESTNET === "1",
  };
}

export function getBinanceLiveBaseUrl(testnet = false): string {
  return testnet ? "https://testnet.binance.vision" : "https://api.binance.com";
}

export function signBinanceQuery(params: Record<string, string | number | boolean | undefined>, secret: string): string {
  const cleanParams = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");

  const signature = crypto.createHmac("sha256", secret).update(cleanParams).digest("hex");
  return `${cleanParams}&signature=${signature}`;
}

export interface BinanceAccountBalance {
  asset: string;
  free: string;
  locked: string;
}

export interface BinanceAccountInfoResponse {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: number;
  accountType: string;
  balances: BinanceAccountBalance[];
  permissions?: string[];
}

export interface BinanceLiveCredentialCheck {
  ok: boolean;
  testnet: boolean;
  canTrade?: boolean;
  accountType?: string;
  error?: string;
  makerFeeBps?: number;
  takerFeeBps?: number;
}

/**
 * Validate Binance API Key and Secret by calling signed GET /api/v3/account
 */
export async function validateBinanceLiveCredentials(): Promise<BinanceLiveCredentialCheck> {
  const config = getBinanceLiveConfig();
  if (!config.apiKey || !config.apiSecret) {
    return {
      ok: false,
      testnet: Boolean(config.testnet),
      error: "Binance API Key and Secret are not configured in environment variables (BINANCE_API_KEY, BINANCE_API_SECRET).",
    };
  }

  const baseUrl = getBinanceLiveBaseUrl(config.testnet);
  const timestamp = Date.now();
  const queryString = signBinanceQuery({ timestamp, recvWindow: 10_000 }, config.apiSecret);

  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/v3/account?${queryString}`, {
      headers: {
        "X-MBX-APIKEY": config.apiKey,
        "Accept": "application/json",
      },
    }, 10_000);

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({ msg: `HTTP ${response.status}` })) as { msg?: string; code?: number };
      return {
        ok: false,
        testnet: Boolean(config.testnet),
        error: `Binance API error (${response.status}): ${errorJson.msg || "Authentication failed"}`,
      };
    }

    const data = await response.json() as BinanceAccountInfoResponse;
    return {
      ok: true,
      testnet: Boolean(config.testnet),
      canTrade: data.canTrade,
      accountType: data.accountType,
      makerFeeBps: data.makerCommission,
      takerFeeBps: data.takerCommission,
    };
  } catch (err) {
    return {
      ok: false,
      testnet: Boolean(config.testnet),
      error: err instanceof Error ? err.message : "Failed to connect to Binance Live API",
    };
  }
}

export interface BinanceLivePosition {
  symbol: string;
  baseAsset: string;
  quantity: number;
  free: number;
  locked: number;
  marketPrice: number;
  totalValue: number;
  averageCost: number;
}

export interface BinanceLiveAccountSummary {
  mode: "live";
  venue: string;
  testnet: boolean;
  currency: string;
  equity: number;
  buyingPower: number;
  dailyStartEquity: number;
  dailyPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  usedCapital: number;
  positions: BinanceLivePosition[];
}

/**
 * Fetch live account balances from Binance and compute real equity and open spot positions.
 */
export async function fetchBinanceLiveAccountSummary(
  prices: Record<string, number> = {},
  configuredSymbols: string[] = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "DOGEUSDT", "AVAXUSDT"]
): Promise<BinanceLiveAccountSummary> {
  const config = getBinanceLiveConfig();
  if (!config.apiKey || !config.apiSecret) {
    throw new Error("Binance Live API credentials are not configured");
  }

  const baseUrl = getBinanceLiveBaseUrl(config.testnet);
  const timestamp = Date.now();
  const queryString = signBinanceQuery({ timestamp, recvWindow: 10_000 }, config.apiSecret);

  const response = await fetchWithTimeout(`${baseUrl}/api/v3/account?${queryString}`, {
    headers: {
      "X-MBX-APIKEY": config.apiKey,
      "Accept": "application/json",
    },
  }, 10_000);

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({})) as { msg?: string; code?: number };
    throw new Error(`Binance account query failed (${response.status}): ${errorJson.msg || "Authentication or network error"}`);
  }

  const data = await response.json() as BinanceAccountInfoResponse;
  let usdtFree = 0;
  let usdtLocked = 0;

  const nonZeroBalances = data.balances.filter(b => {
    const free = Number(b.free);
    const locked = Number(b.locked);
    if (b.asset === "USDT") {
      usdtFree = free;
      usdtLocked = locked;
      return false;
    }
    return free + locked > 0;
  });

  const positions: BinanceLivePosition[] = [];
  let totalPositionValue = 0;

  for (const b of nonZeroBalances) {
    const pair = `${b.asset}USDT`;
    const totalQty = Number(b.free) + Number(b.locked);
    if (totalQty <= 0) continue;

    // Only include if it's one of configured or watched spot pairs, or price is known
    let markPrice = prices[pair];
    if (!markPrice) {
      try {
        const quote = await fetchBinanceCryptoQuote("global-spot", pair);
        if (quote.price && quote.price > 0) markPrice = quote.price;
      } catch {
        // Ignore single quote lookup error
      }
    }

    if (markPrice && markPrice > 0) {
      const totalValue = totalQty * markPrice;
      // Filter out tiny dust balances under $1
      if (totalValue >= 0.5) {
        totalPositionValue += totalValue;
        positions.push({
          symbol: pair,
          baseAsset: b.asset,
          quantity: Number(b.free), // Tradable free amount
          free: Number(b.free),
          locked: Number(b.locked),
          marketPrice: markPrice,
          totalValue,
          averageCost: markPrice, // Real spot doesn't track historic entry without trade log, so markPrice is default anchor
        });
      }
    }
  }

  const buyingPower = usdtFree;
  const equity = usdtFree + usdtLocked + totalPositionValue;

  return {
    mode: "live",
    venue: config.testnet ? "binance-spot-testnet" : "binance-spot-live",
    testnet: Boolean(config.testnet),
    currency: "USDT",
    equity: Number(equity.toFixed(2)),
    buyingPower: Number(buyingPower.toFixed(2)),
    dailyStartEquity: Number(equity.toFixed(2)),
    dailyPnl: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    usedCapital: Number(totalPositionValue.toFixed(2)),
    positions,
  };
}

// Precision helper map for standard Binance spot symbols
const SYMBOL_STEP_SIZES: Record<string, number> = {
  BTCUSDT: 5,  // e.g. 0.00001 BTC
  ETHUSDT: 4,  // e.g. 0.0001 ETH
  SOLUSDT: 2,  // e.g. 0.01 SOL
  BNBUSDT: 3,  // e.g. 0.001 BNB
  DOGEUSDT: 0, // e.g. 1 DOGE
  AVAXUSDT: 2, // e.g. 0.01 AVAX
};

export function formatQuantityForBinance(symbol: string, rawQuantity: number): string {
  const precision = SYMBOL_STEP_SIZES[symbol] ?? 4;
  const factor = Math.pow(10, precision);
  const truncated = Math.floor(rawQuantity * factor) / factor;
  return precision === 0 ? String(Math.floor(truncated)) : truncated.toFixed(precision);
}

export interface PlaceBinanceLiveOrderInput {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  orderType?: "MARKET" | "LIMIT";
  price?: number;
  clientOrderId?: string;
  source?: string;
}

export interface PlaceBinanceLiveOrderResult {
  ok: boolean;
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  fillPrice: number;
  cummulativeQuoteQty: number;
  status: string;
  rawResponse?: string;
  error?: string;
}

/**
 * Place a real Spot order on Binance (Market order by default for high-speed execution)
 */
export async function placeBinanceLiveOrder(
  input: PlaceBinanceLiveOrderInput
): Promise<PlaceBinanceLiveOrderResult> {
  const config = getBinanceLiveConfig();
  if (!config.apiKey || !config.apiSecret) {
    throw new Error("Binance API credentials missing. Cannot execute live order.");
  }

  const formattedQuantity = formatQuantityForBinance(input.symbol, input.quantity);
  if (Number(formattedQuantity) <= 0) {
    throw new Error(`Formatted order quantity is 0 for ${input.symbol} (raw: ${input.quantity})`);
  }

  const baseUrl = getBinanceLiveBaseUrl(config.testnet);
  const timestamp = Date.now();
  const clientOrderId = input.clientOrderId || `dp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const orderParams: Record<string, string | number | boolean | undefined> = {
    symbol: input.symbol,
    side: input.side.toUpperCase(),
    type: input.orderType || "MARKET",
    quantity: formattedQuantity,
    newClientOrderId: clientOrderId,
    newOrderRespType: "FULL",
    timestamp,
    recvWindow: 10_000,
  };

  if (input.orderType === "LIMIT" && input.price) {
    orderParams.price = input.price.toFixed(2);
    orderParams.timeInForce = "GTC";
  }

  const queryString = signBinanceQuery(orderParams, config.apiSecret);

  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/v3/order?${queryString}`, {
      method: "POST",
      headers: {
        "X-MBX-APIKEY": config.apiKey,
        "Accept": "application/json",
      },
    }, 12_000);

    const rawJson = await response.json().catch(() => ({})) as {
      orderId?: number;
      clientOrderId?: string;
      symbol?: string;
      executedQty?: string;
      cummulativeQuoteQty?: string;
      status?: string;
      fills?: Array<{ price: string; qty: string; commission: string; commissionAsset: string }>;
      msg?: string;
      code?: number;
    };

    if (!response.ok || rawJson.code) {
      const errMsg = rawJson.msg || `Binance order rejected (HTTP ${response.status})`;
      return {
        ok: false,
        orderId: "",
        clientOrderId,
        symbol: input.symbol,
        side: input.side,
        quantity: input.quantity,
        fillPrice: 0,
        cummulativeQuoteQty: 0,
        status: "REJECTED",
        rawResponse: JSON.stringify(rawJson),
        error: errMsg,
      };
    }

    const executedQty = Number(rawJson.executedQty || formattedQuantity);
    const cummulativeQuote = Number(rawJson.cummulativeQuoteQty || 0);
    let avgPrice = cummulativeQuote > 0 && executedQty > 0 ? cummulativeQuote / executedQty : 0;

    // If avgPrice couldn't be calculated from cummulativeQuoteQty, calculate from fills
    if (avgPrice === 0 && rawJson.fills && rawJson.fills.length > 0) {
      const totalFillValue = rawJson.fills.reduce((sum, f) => sum + (Number(f.price) * Number(f.qty)), 0);
      const totalFillQty = rawJson.fills.reduce((sum, f) => sum + Number(f.qty), 0);
      if (totalFillQty > 0) avgPrice = totalFillValue / totalFillQty;
    }

    return {
      ok: true,
      orderId: String(rawJson.orderId),
      clientOrderId: rawJson.clientOrderId || clientOrderId,
      symbol: rawJson.symbol || input.symbol,
      side: input.side,
      quantity: executedQty,
      fillPrice: avgPrice,
      cummulativeQuoteQty: cummulativeQuote,
      status: rawJson.status || "FILLED",
      rawResponse: JSON.stringify(rawJson),
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Binance Live order execution failed";
    return {
      ok: false,
      orderId: "",
      clientOrderId,
      symbol: input.symbol,
      side: input.side,
      quantity: input.quantity,
      fillPrice: 0,
      cummulativeQuoteQty: 0,
      status: "ERROR",
      error: errorMsg,
    };
  }
}

/**
 * Close all open live spot positions immediately by executing Market SELL orders on Binance
 */
export async function closeAllBinanceLivePositions(
  symbols: string[] = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "DOGEUSDT", "AVAXUSDT"]
): Promise<{ closedCount: number; orders: PlaceBinanceLiveOrderResult[] }> {
  const summary = await fetchBinanceLiveAccountSummary({}, symbols);
  const activePositions = summary.positions.filter(p => p.free > 0);
  const results: PlaceBinanceLiveOrderResult[] = [];

  for (const pos of activePositions) {
    try {
      const order = await placeBinanceLiveOrder({
        symbol: pos.symbol,
        side: "sell",
        quantity: pos.free,
        orderType: "MARKET",
        source: "live-stop-close-all",
      });
      results.push(order);
    } catch (err) {
      console.warn(`[BinanceLive] Failed to close position for ${pos.symbol}:`, err);
    }
  }

  return {
    closedCount: results.filter(r => r.ok).length,
    orders: results,
  };
}
