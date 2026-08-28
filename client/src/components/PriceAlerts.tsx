import { useState, useCallback, useMemo } from "react";
import { Bell, BellOff, Plus, Trash2, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { trpc } from "@/lib/trpc";

type ConditionType = "above" | "below" | "crosses_above" | "crosses_below";

interface AlertFormData {
  name: string;
  symbol: string;
  condition: ConditionType;
  price: number;
}

export default function PriceAlerts() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<AlertFormData>({
    name: "",
    symbol: "",
    condition: "above",
    price: 0,
  });

  const { data: alerts, isLoading } = trpc.crypto.alertRules.useQuery();
  const createAlert = trpc.crypto.createAlertRule.useMutation();
  const deleteAlert = trpc.crypto.deleteAlertRule.useMutation();
  const toggleAlert = trpc.crypto.toggleAlertRule.useMutation();

  const tickers = trpc.crypto.tickers.useQuery(
    { market: "global-spot", limit: 100 },
    { refetchInterval: 10_000 }
  );

  const pricesMap = useMemo(() => {
    return new Map((tickers.data ?? []).map(t => [t.symbol, t]));
  }, [tickers.data]);

  const handleCreate = useCallback(() => {
    if (!formData.name.trim() || !formData.symbol.trim() || !formData.price) return;

    createAlert.mutate({
      name: formData.name.trim(),
      symbol: formData.symbol.trim().toUpperCase(),
      condition: `${formData.condition}_${formData.price}`,
      enabled: 1,
    });

    setFormData({ name: "", symbol: "", condition: "above", price: 0 });
    setShowForm(false);
  }, [formData, createAlert]);

  const handleDelete = useCallback((id: number) => {
    deleteAlert.mutate({ id });
  }, [deleteAlert]);

  const handleToggle = useCallback((id: number, enabled: number) => {
    toggleAlert.mutate({ id, enabled: enabled ? 0 : 1 });
  }, [toggleAlert]);

  const conditionLabels: Record<ConditionType, string> = {
    above: "Price Above",
    below: "Price Below",
    crosses_above: "Crosses Above",
    crosses_below: "Crosses Below",
  };

  if (isLoading) {
    return <div className="crypto-empty">Loading alerts...</div>;
  }

  return (
    <section className="binance-card crypto-alerts">
      <div className="binance-card-head">
        <div>
          <span className="binance-kicker">PRICE ALERTS</span>
          <h2><Bell size={18} /> Price Alerts</h2>
        </div>
        <button onClick={() => setShowForm(!showForm)}>
          <Plus size={14} /> {showForm ? "Cancel" : "New Alert"}
        </button>
      </div>

      {showForm && (
        <div className="alert-form">
          <div className="alert-form-grid">
            <label>
              <span>Alert Name</span>
              <input
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., BTC Breakout"
                maxLength={120}
              />
            </label>
            <label>
              <span>Symbol</span>
              <input
                value={formData.symbol}
                onChange={e => setFormData(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                placeholder="BTCUSDT"
                maxLength={16}
              />
            </label>
            <label>
              <span>Condition</span>
              <select
                value={formData.condition}
                onChange={e => setFormData(prev => ({ ...prev, condition: e.target.value as ConditionType }))}
              >
                <option value="above">Above</option>
                <option value="below">Below</option>
                <option value="crosses_above">Crosses Above</option>
                <option value="crosses_below">Crosses Below</option>
              </select>
            </label>
            <label>
              <span>Target Price ($)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.price || ""}
                onChange={e => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
              />
            </label>
          </div>
          <div className="alert-form-actions">
            <button 
              className="bot-enable" 
              onClick={handleCreate}
              disabled={!formData.name.trim() || !formData.symbol.trim() || !formData.price}
            >
              <Bell size={14} /> Create Alert
            </button>
          </div>
          <p className="alert-form-note">
            <Activity size={12} /> Alerts are checked every 30 seconds while the dashboard is open. Browser notifications require permission.
          </p>
        </div>
      )}

      {alerts?.length ? (
        <div className="alert-list">
          <div className="binance-market-row table-heading">
            <span>NAME</span>
            <span>SYMBOL</span>
            <span>CONDITION</span>
            <span>TARGET</span>
            <span>CURRENT</span>
            <span>STATUS</span>
            <span>ACTIONS</span>
          </div>
          {alerts.map(alert => {
            const ticker = pricesMap.get(alert.symbol);
            const currentPrice = ticker?.price ?? 0;
            
            // Parse condition
            const conditionMatch = alert.condition.match(/^(above|below|crosses_above|crosses_below)_(.+)$/);
            const conditionType = (conditionMatch?.[1] as ConditionType) || "above";
            const targetPrice = parseFloat(conditionMatch?.[2] || "0");
            
            const isTriggered = (() => {
              if (!currentPrice) return false;
              switch (conditionType) {
                case "above": return currentPrice >= targetPrice;
                case "below": return currentPrice <= targetPrice;
                case "crosses_above": return false; // Would need historical data
                case "crosses_below": return false;
                default: return false;
              }
            })();

            return (
              <div className="binance-market-row" key={alert.id}>
                <b>{alert.name}</b>
                <span>{alert.symbol}</span>
                <span>{conditionLabels[conditionType]}</span>
                <span>${targetPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                <span className={isTriggered ? "up" : ""}>
                  ${currentPrice ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : "—"}
                </span>
                <span>
                  <span className={`paper-state ${alert.enabled ? "" : "muted"}`} style={{ fontSize: "8px" }}>
                    {alert.enabled ? <Bell size={10} /> : <BellOff size={10} />}
                    {alert.enabled ? "ACTIVE" : "PAUSED"}
                  </span>
                </span>
                <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => handleToggle(alert.id, alert.enabled)}
                    style={{ padding: "2px 4px", width: "auto", height: "auto" }}
                    title={alert.enabled ? "Pause alert" : "Activate alert"}
                  >
                    {alert.enabled ? <BellOff size={12} /> : <Bell size={12} />}
                  </button>
                  <button
                    onClick={() => handleDelete(alert.id)}
                    style={{ padding: "2px 4px", width: "auto", height: "auto" }}
                    title="Delete alert"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="binance-empty">
          <Bell size={24} style={{ marginBottom: "8px", opacity: 0.5 }} />
          <p>No price alerts yet. Create your first alert to get notified when price targets are hit.</p>
        </div>
      )}
    </section>
  );
}
