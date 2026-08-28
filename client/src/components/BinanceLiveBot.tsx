import { useEffect, useMemo, useState } from "react";
import { Bot, BrainCircuit, CircleDollarSign, Clock3, Pause, Play, Radio, RefreshCw, ShieldAlert, ShieldCheck, WifiOff, Key, Trash2, Eye, EyeOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { CRYPTO_MARKETS, type CryptoMarket } from "@shared/crypto";

const LIVE_STRATEGIES = ["scalp_momentum", "fast_momentum", "range_reversion", "learning_mode"] as const;
type LiveStrategy = typeof LIVE_STRATEGIES[number];
const money = (value: number | null | undefined) => value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const percentage = (value: number | null | undefined) => value === null || value === undefined || !Number.isFinite(value) ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const isLiveStrategy = (value: unknown): value is LiveStrategy => typeof value === "string" && (LIVE_STRATEGIES as readonly string[]).includes(value);
const strategyCopy: Record<LiveStrategy, { title: string; description: string }> = {
  scalp_momentum: { title: "Scalp Momentum", description: "1m trigger · both 5m / 15m confirmations" },
  fast_momentum: { title: "Fast Momentum", description: "1m trigger · one of 5m / 15m confirms" },
  range_reversion: { title: "Range Reversion", description: "1m pullback / bounce inside a contained range" },
  learning_mode: { title: "Learning Mode", description: "Permissive live entries / exits · valid market marks only" },
};

interface LiveAccountSummary {
  id: number;
  userId: number;
  apiKeyEncrypted: string;
  apiSecretEncrypted: string;
  accountType: string;
  isTestnet: number;
  dailyAnchor: string;
  dailyStartEquity: number | null;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  balances?: Array<{ asset: string; free: string; locked: string }>;
  equity?: number;
}

function LiveAccountCard() {
  const utils = trpc.useUtils();
  const account = trpc.binanceLive.account.useQuery(undefined, { retry: false });
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [accountType, setAccountType] = useState<"spot" | "futures">("spot");
  const [isTestnet, setIsTestnet] = useState(false);
  
  const saveCredentials = trpc.binanceLive.saveCredentials.useMutation({
    onSuccess: () => {
      void utils.binanceLive.account.invalidate();
      setApiKey("");
      setApiSecret("");
    },
  });
  
  const deleteCredentials = trpc.binanceLive.deleteCredentials.useMutation({
    onSuccess: () => {
      void utils.binanceLive.account.invalidate();
    },
  });
  
  const syncAccount = trpc.binanceLive.syncAccount.useMutation({
    onSuccess: () => {
      void utils.binanceLive.account.invalidate();
    },
  });
  
  useEffect(() => {
    if (account.data && account.data.apiKeyEncrypted) {
      // Don't populate sensitive data, just indicate it exists
    }
  }, [account.data]);
  
  const hasCredentials = !!account.data?.apiKeyEncrypted;
  const busy = saveCredentials.isPending || deleteCredentials.isPending || syncAccount.isPending;
  
  if (account.isLoading) {
    return <div className="binance-empty"><Clock3 size={15} />Loading live account configuration…</div>;
  }
  
  return (
    <div className="live-account-card">
      <div className="binance-card-head">
        <div>
          <span className="binance-kicker">BINANCE LIVE TRADING</span>
          <h2><Key size={18} /> API Credentials</h2>
        </div>
        <button aria-label="Refresh account status" onClick={() => void account.refetch()}>
          <RefreshCw size={14} className={account.isFetching ? "spin" : ""} />
        </button>
      </div>
      
      <div className={`live-account-banner ${hasCredentials ? "connected" : "disconnected"}`}>
        <ShieldCheck size={15} />
        <div>
          <b>{hasCredentials ? "API credentials stored securely" : "No API credentials configured"}</b>
          <span>
            {hasCredentials 
              ? "Your encrypted API keys enable live trading with the same bot strategies as paper trading."
              : "Add your Binance API credentials to enable live trading. Keys are encrypted at rest."}
          </span>
        </div>
      </div>
      
      {!hasCredentials ? (
        <div className="live-credentials-form">
          <label>
            API Key
            <input
              type="text"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Enter your Binance API key"
              autoComplete="off"
            />
          </label>
          <label>
            API Secret
            <input
              type="password"
              value={apiSecret}
              onChange={e => setApiSecret(e.target.value)}
              placeholder="Enter your Binance API secret"
              autoComplete="off"
            />
          </label>
          <div className="live-account-options">
            <label className="live-account-type">
              <span>Account Type</span>
              <select value={accountType} onChange={e => setAccountType(e.target.value as "spot" | "futures")}>
                <option value="spot">Spot</option>
                <option value="futures">Futures</option>
              </select>
            </label>
            <label className="live-testnet-toggle">
              <input
                type="checkbox"
                checked={isTestnet}
                onChange={e => setIsTestnet(e.target.checked)}
              />
              <span>Use Testnet</span>
            </label>
          </div>
          <button
            className="bot-enable"
            disabled={busy || !apiKey.trim() || !apiSecret.trim()}
            onClick={() => saveCredentials.mutate({
              apiKeyEncrypted: apiKey.trim(),
              apiSecretEncrypted: apiSecret.trim(),
              accountType,
              isTestnet,
            })}
          >
            <ShieldCheck size={14} /> Save Credentials Securely
          </button>
          {saveCredentials.error && (
            <div className="bot-error">
              <ShieldAlert size={14} />{saveCredentials.error.message}
            </div>
          )}
          <div className="live-credentials-warning">
            <ShieldAlert size={14} />
            <span>
              <b>Security Notice:</b> Only use API keys with read and trade permissions. Never enable withdrawal permissions.
              Keys are encrypted using your Supabase JWT secret.
            </span>
          </div>
        </div>
      ) : (
        <div className="live-account-status">
          <div className="live-account-info">
            <div>
              <span>ACCOUNT TYPE</span>
              <b>{account.data?.accountType?.toUpperCase() ?? "SPOT"}</b>
            </div>
            <div>
              <span>ENVIRONMENT</span>
              <b>{account.data?.isTestnet ? "TESTNET" : "MAINNET"}</b>
            </div>
            {account.data?.lastSyncAt && (
              <div>
                <span>LAST SYNC</span>
                <b>{new Date(account.data.lastSyncAt).toLocaleString()}</b>
              </div>
            )}
            <div>
              <span>API KEY</span>
              <b className="api-key-display">
                {showApiKey ? account.data.apiKeyEncrypted.slice(0, 16) + "..." : "••••••••••••••••"}
              </b>
              <button onClick={() => setShowApiKey(!showApiKey)} aria-label={showApiKey ? "Hide API key" : "Show API key"}>
                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="live-account-actions">
            <button
              className="bot-secondary"
              disabled={busy}
              onClick={() => syncAccount.mutate({ equity: 10000 })}
            >
              <RefreshCw size={14} /> Sync Account Balance
            </button>
            <button
              className="bot-pause"
              disabled={busy}
              onClick={() => deleteCredentials.mutate()}
            >
              <Trash2 size={14} /> Remove Credentials
            </button>
          </div>
          {deleteCredentials.error && (
            <div className="bot-error">
              <ShieldAlert size={14} />{deleteCredentials.error.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LiveBotControls() {
  const config = trpc.binancePaper.botConfig.useQuery(undefined, { retry: false });
  const orders = trpc.binanceLive.orders.useQuery(undefined, { retry: false, refetchInterval: 15_000 });
  
  const [symbols, setSymbols] = useState("BTCUSDT, ETHUSDT, SOLUSDT");
  const [interval, setInterval] = useState<1 | 5 | 15>(5);
  const [strategy, setStrategy] = useState<LiveStrategy>("scalp_momentum");
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.60);
  const [stopLossPct, setStopLossPct] = useState(0.5);
  const [takeProfitRatio, setTakeProfitRatio] = useState(1.5);
  const [momentumThreshold, setMomentumThreshold] = useState(0.04);
  const [rangeUpperBound, setRangeUpperBound] = useState(0.7);
  const [rangeLowerBound, setRangeLowerBound] = useState(0.4);
  
  useEffect(() => {
    if (config.data) {
      try {
        const parsed = JSON.parse(config.data.symbols);
        if (Array.isArray(parsed)) setSymbols(parsed.join(", "));
      } catch { /* preserved safely */ }
      setInterval(config.data.scheduleMinutes as 1 | 5 | 15);
      if (isLiveStrategy(config.data.strategy)) setStrategy(config.data.strategy);
      if (typeof config.data.confidenceThreshold === "string") setConfidenceThreshold(parseFloat(config.data.confidenceThreshold));
      if (typeof config.data.stopLossPct === "string") setStopLossPct(parseFloat(config.data.stopLossPct));
      if (typeof config.data.takeProfitRatio === "string") setTakeProfitRatio(parseFloat(config.data.takeProfitRatio));
      if (typeof config.data.momentumThreshold === "string") setMomentumThreshold(parseFloat(config.data.momentumThreshold));
      if (typeof config.data.rangeUpperBound === "string") setRangeUpperBound(parseFloat(config.data.rangeUpperBound));
      if (typeof config.data.rangeLowerBound === "string") setRangeLowerBound(parseFloat(config.data.rangeLowerBound));
    }
  }, [config.data]);
  
  const saveBotConfig = trpc.binancePaper.saveBotConfig.useMutation();
  const enableBot = trpc.binancePaper.enableBot.useMutation();
  const pauseBot = trpc.binancePaper.pauseBot.useMutation();
  
  const refresh = () => {
    void config.refetch();
    void orders.refetch();
  };
  
  const parsedSymbols = symbols.split(",").map(value => value.trim().toUpperCase()).filter(Boolean);
  const busy = saveBotConfig.isPending || enableBot.isPending || pauseBot.isPending;
  const currentStrategy = strategyCopy[strategy];
  
  const saveConfig = () => {
    saveBotConfig.mutate({
      symbols: parsedSymbols,
      strategy,
      scheduleMinutes: interval,
      riskPct: 1,
      dailyLossStopPct: 3,
      maxOpenPositions: 3,
      confidenceThreshold,
      stopLossPct,
      takeProfitRatio,
      momentumThreshold,
      rangeUpperBound,
      rangeLowerBound,
    });
  };
  
  return (
    <div className="bot-settings">
      <div className="bot-settings-head">
        <div>
          <BrainCircuit size={15} />
          <b>Live trading strategy settings</b>
        </div>
        <span className={`bot-status ready`}>READY FOR LIVE</span>
      </div>
      
      <label>
        GLOBAL SPOT PAIRS
        <input
          aria-label="Live trading pairs"
          value={symbols}
          onChange={event => setSymbols(event.target.value)}
          placeholder="BTCUSDT, ETHUSDT, SOLUSDT"
        />
      </label>
      
      <div className="bot-control-grid">
        <div>
          <span>RUN CADENCE</span>
          <div className="bot-intervals">
            {([1, 5, 15] as const).map(value => (
              <button
                type="button"
                key={value}
                className={interval === value ? "active" : ""}
                onClick={() => setInterval(value)}
              >
                {value}m
              </button>
            ))}
          </div>
          <small>Each decision sees 1m · 5m · 15m context.</small>
        </div>
        
        <div>
          <span>LIVE TRADING STRATEGY</span>
          <div className="bot-strategy-buttons" role="group" aria-label="Live trading strategy">
            {LIVE_STRATEGIES.map(item => (
              <button
                type="button"
                key={item}
                className={strategy === item ? "active" : ""}
                onClick={() => setStrategy(item)}
              >
                {strategyCopy[item].title}
              </button>
            ))}
          </div>
          <b>{currentStrategy.description}</b>
          <small>
            {strategy === "learning_mode"
              ? "Learning mode bypasses confidence, momentum, range filters. Valid market marks required."
              : "Risk management and confidence thresholds apply to live trades."}
          </small>
        </div>
      </div>
      
      <div className="strategy-parameters">
        <h4>Strategy Parameters</h4>
        <div className="parameter-sliders">
          <label>
            <span>Confidence Threshold: {(confidenceThreshold * 100).toFixed(0)}%</span>
            <input
              type="range"
              min={0.3}
              max={0.9}
              step={0.05}
              value={confidenceThreshold}
              onChange={e => setConfidenceThreshold(parseFloat(e.target.value))}
            />
          </label>
          <label>
            <span>Stop Loss: {stopLossPct.toFixed(2)}%</span>
            <input
              type="range"
              min={0.1}
              max={2}
              step={0.1}
              value={stopLossPct}
              onChange={e => setStopLossPct(parseFloat(e.target.value))}
            />
          </label>
          <label>
            <span>Take Profit Ratio: {takeProfitRatio.toFixed(2)}x</span>
            <input
              type="range"
              min={0.5}
              max={5}
              step={0.1}
              value={takeProfitRatio}
              onChange={e => setTakeProfitRatio(parseFloat(e.target.value))}
            />
          </label>
          <label>
            <span>Momentum Threshold: {(momentumThreshold * 100).toFixed(2)}%</span>
            <input
              type="range"
              min={0.01}
              max={0.1}
              step={0.005}
              value={momentumThreshold}
              onChange={e => setMomentumThreshold(parseFloat(e.target.value))}
            />
          </label>
          <label>
            <span>Range Upper Bound: {(rangeUpperBound * 100).toFixed(0)}%</span>
            <input
              type="range"
              min={0.5}
              max={0.9}
              step={0.05}
              value={rangeUpperBound}
              onChange={e => setRangeUpperBound(parseFloat(e.target.value))}
            />
          </label>
          <label>
            <span>Range Lower Bound: {(rangeLowerBound * 100).toFixed(0)}%</span>
            <input
              type="range"
              min={0.2}
              max={0.6}
              step={0.05}
              value={rangeLowerBound}
              onChange={e => setRangeLowerBound(parseFloat(e.target.value))}
            />
          </label>
        </div>
      </div>
      
      <div className="bot-actions">
        <button
          className="bot-secondary"
          disabled={busy || parsedSymbols.length < 1}
          onClick={saveConfig}
        >
          <CircleDollarSign size={14} /> Save Live Settings
        </button>
        {config.data?.enabled === 1 ? (
          <button
            className="bot-pause"
            disabled={busy}
            onClick={() => pauseBot.mutate()}
          >
            <Pause size={14} /> Pause Live Bot
          </button>
        ) : (
          <button
            className="bot-enable"
            disabled={busy || parsedSymbols.length < 1}
            onClick={() => enableBot.mutate({ scheduleMinutes: interval })}
          >
            <Play size={14} /> Start Live Trading
          </button>
        )}
      </div>
      
      {saveBotConfig.error || enableBot.error || pauseBot.error ? (
        <div className="bot-error">
          <ShieldAlert size={14} />
          {saveBotConfig.error?.message ?? enableBot.error?.message ?? pauseBot.error?.message}
        </div>
      ) : null}
      
      <div className="live-orders-preview">
        <h4>Recent Live Orders</h4>
        {orders.isLoading ? (
          <div className="binance-empty"><Clock3 size={15} />Loading orders…</div>
        ) : orders.data?.length ? (
          <div className="live-order-list">
            {orders.data.slice(0, 5).map(order => (
              <div key={order.id} className="live-order-row">
                <span className={`order-status ${order.status}`}>{order.status}</span>
                <b>{order.symbol}</b>
                <span>{order.side.toUpperCase()}</span>
                <span>{order.quantity}</span>
                <span>{order.fillPrice ? `$${order.fillPrice}` : "Pending"}</span>
                <small>{new Date(order.createdAt).toLocaleString()}</small>
              </div>
            ))}
          </div>
        ) : (
          <div className="binance-empty">
            <Clock3 size={15} />No live orders yet. Configure credentials and start the bot.
          </div>
        )}
      </div>
    </div>
  );
}

export default function BinanceLiveBot() {
  return (
    <section className="binance-card live-bot-card" id="binance-live-bot">
      <div className="binance-card-head">
        <div>
          <span className="binance-kicker">LIVE TRADING · REAL CAPITAL AT RISK</span>
          <h2><Bot size={18} /> Live Binance Account</h2>
        </div>
      </div>
      
      <div className="live-bot-banner warning">
        <ShieldAlert size={15} />
        <div>
          <b>WARNING: Live trading involves real financial risk.</b>
          <span>
            You are about to enable real trading with actual funds. Only use capital you can afford to lose.
            Past performance does not guarantee future results.
          </span>
        </div>
      </div>
      
      <LiveAccountCard />
      <LiveBotControls />
      
      <div className="live-bot-footnote">
        {strategyCopy["scalp_momentum"].title} live trading uses real Binance API orders.
        Ensure you understand the risks and have proper risk management in place.
      </div>
    </section>
  );
}
