import { useMemo, useState, useCallback } from "react";
import { TrendingUp, Bell, Star, Trash2, Download, Plus, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

type WatchlistItem = { symbol: string; name?: string };

export default function CryptoWatchlist() {
  const [newSymbol, setNewSymbol] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  
  const { data: watchlists, isLoading: loadingWatchlists } = trpc.crypto.watchlists.useQuery();
  const createWatchlist = trpc.crypto.createWatchlist.useMutation();
  const deleteWatchlist = trpc.crypto.deleteWatchlist.useMutation();
  const addItem = trpc.crypto.addWatchlistItem.useMutation();
  const removeItem = trpc.crypto.removeWatchlistItem.useMutation();
  const updateItem = trpc.crypto.updateWatchlistItem.useMutation();
  
  const activeWatchlist = watchlists?.[0];
  const { data: items } = trpc.crypto.watchlistItems.useQuery(
    { watchlistId: activeWatchlist?.id ?? 0 },
    { enabled: !!activeWatchlist }
  );
  
  const tickers = trpc.crypto.tickers.useQuery(
    { market: "global-spot", limit: 50 },
    { refetchInterval: 10_000 }
  );
  
  const pricesMap = useMemo(() => {
    return new Map((tickers.data ?? []).map(t => [t.symbol, t]));
  }, [tickers.data]);

  const handleAddSymbol = useCallback(() => {
    const symbol = newSymbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!symbol || !activeWatchlist) return;
    
    addItem.mutate({ watchlistId: activeWatchlist.id, symbol, name: symbol });
    setNewSymbol("");
  }, [newSymbol, activeWatchlist, addItem]);

  const handleRemoveItem = useCallback((itemId: number) => {
    removeItem.mutate({ itemId });
  }, [removeItem]);

  const handleStartEdit = useCallback((item: { id: number; name: string | null }) => {
    setEditingId(item.id);
    setEditName(item.name ?? item.symbol);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingId === null) return;
    updateItem.mutate({ itemId: editingId, name: editName.trim() || null });
    setEditingId(null);
    setEditName("");
  }, [editingId, editName, updateItem]);

  const handleDeleteWatchlist = useCallback(() => {
    if (!activeWatchlist) return;
    deleteWatchlist.mutate({ watchlistId: activeWatchlist.id });
  }, [activeWatchlist, deleteWatchlist]);

  const handleCreateWatchlist = useCallback(() => {
    createWatchlist.mutate({ name: `Watchlist ${Date.now()}` });
  }, [createWatchlist]);

  const exportToCSV = useCallback(() => {
    if (!items?.length) return;
    
    const headers = ["Symbol", "Name", "Price", "Change %", "Volume", "Added At"];
    const rows = items.map(item => {
      const ticker = pricesMap.get(item.symbol);
      return [
        item.symbol,
        item.name ?? item.symbol,
        ticker?.price?.toFixed(2) ?? "N/A",
        ticker?.changePct?.toFixed(2) ?? "N/A",
        ticker?.quoteVolume?.toFixed(2) ?? "N/A",
        new Date(item.createdAt).toISOString()
      ].join(",");
    });
    
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `watchlist-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [items, pricesMap]);

  if (loadingWatchlists) {
    return <div className="crypto-empty">Loading watchlist...</div>;
  }

  if (!activeWatchlist) {
    return (
      <section className="binance-card crypto-watchlist">
        <div className="binance-card-head">
          <div>
            <span className="binance-kicker">WATCHLIST</span>
            <h2><Star size={18} /> Crypto Watchlist</h2>
          </div>
        </div>
        <div className="binance-empty">
          <p>No watchlist found. Create one to track your favorite pairs.</p>
          <button onClick={handleCreateWatchlist} className="bot-enable">
            <Plus size={14} /> Create Watchlist
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="binance-card crypto-watchlist">
      <div className="binance-card-head">
        <div>
          <span className="binance-kicker">WATCHLIST</span>
          <h2><Star size={18} /> {activeWatchlist.name}</h2>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button aria-label="Export watchlist" onClick={exportToCSV} disabled={!items?.length}>
            <Download size={14} />
          </button>
          <button aria-label="Delete watchlist" onClick={handleDeleteWatchlist}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="watchlist-add-row">
        <input
          value={newSymbol}
          onChange={e => setNewSymbol(e.target.value)}
          placeholder="Add symbol (e.g., BTCUSDT)"
          maxLength={24}
          onKeyDown={e => e.key === "Enter" && handleAddSymbol()}
        />
        <button onClick={handleAddSymbol} disabled={!newSymbol.trim()}>
          <Plus size={14} /> Add
        </button>
      </div>

      {items?.length ? (
        <div className="watchlist-items">
          <div className="binance-market-row table-heading">
            <span>SYMBOL</span>
            <span>PRICE</span>
            <span>24H</span>
            <span>VOL</span>
            <span>ACTIONS</span>
          </div>
          {items.map(item => {
            const ticker = pricesMap.get(item.symbol);
            const changeClass = (ticker?.changePct ?? 0) >= 0 ? "up" : "down";
            
            return (
              <div className="binance-market-row" key={item.id}>
                <b>
                  {editingId === item.id ? (
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onBlur={handleSaveEdit}
                      onKeyDown={e => e.key === "Enter" && handleSaveEdit()}
                      autoFocus
                      style={{ width: "80px", background: "#171b20", border: "1px solid #fcd535" }}
                    />
                  ) : (
                    <span onClick={() => handleStartEdit(item)} style={{ cursor: "pointer" }}>
                      {item.name ?? item.symbol}
                    </span>
                  )}
                  <small>{item.symbol}</small>
                </b>
                <span>${ticker?.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) ?? "—"}</span>
                <span className={changeClass}>
                  {ticker?.changePct !== null && ticker?.changePct !== undefined 
                    ? `${ticker.changePct >= 0 ? "+" : ""}${ticker.changePct.toFixed(2)}%`
                    : "—"}
                </span>
                <span>{ticker?.quoteVolume ? formatVolume(ticker.quoteVolume) : "—"}</span>
                <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                  <button 
                    onClick={() => handleStartEdit(item)}
                    style={{ padding: "2px 4px", width: "auto", height: "auto" }}
                  >
                    ✏️
                  </button>
                  <button 
                    onClick={() => handleRemoveItem(item.id)}
                    style={{ padding: "2px 4px", width: "auto", height: "auto" }}
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="binance-empty">
          <p>No symbols in watchlist yet. Add your first pair above.</p>
        </div>
      )}
    </section>
  );
}

function formatVolume(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}
