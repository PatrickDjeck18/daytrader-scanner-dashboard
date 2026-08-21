# Project TODO

- [x] Build dark dense multi-panel trading terminal layout with top status bar, scanner tables, symbol workspace, news/catalyst feed, alert stream, chart panel, watchlist, and sector/theme panel.
- [x] Implement fully resizable desktop panels with a responsive fallback layout.
- [x] Create a swappable market-data interface with a simulated real-time U.S. equity engine.
- [x] Generate live-updating quotes, trades, 1-minute OHLCV bars, volume, float, and market-cap data.
- [x] Implement exactly ten configurable scanners: Top Gainers, High-of-Day Breakout, Relative Volume Leaders, Low-Float Momentum, Pre-Market Movers, VWAP Reclaim/Loss, Opening Range Breakout, Halt Monitor, Unusual Tape Activity, and Offering/Dilution Risk.
- [x] Implement configurable scanner thresholds for price, float, market cap, dollar volume, spread, percent change, and relative volume.
- [x] Add saveable named scanner filter presets including Low-Float Gappers, Large-Cap Momentum, and News Breakouts.
- [x] Implement symbol detail panel with ticker, price, change, volume, float, catalyst badges, bid/ask spread, VWAP, and session high/low.
- [x] Add exactly four symbol quick actions: add to watchlist, mute alerts, show news, and copy ticker.
- [x] Implement simulated candlestick chart with exactly candlesticks, VWAP, 9 EMA, 20 EMA, volume bars, and pre-market/after-hours session markers.
- [x] Implement news/catalyst feed with headline, source, timestamp, catalyst classification, and symbol mapping.
- [x] Implement watchlist with custom columns, per-symbol alert state, drag-to-reorder, and quick-add from scanner rows.
- [x] Implement rule-based alerts for price, percent change, RVOL, VWAP cross, high-of-day break, halt, and news category conditions.
- [x] Implement alert deduplication, sound triggers, in-dashboard notifications, and acknowledgement behavior.
- [x] Implement sector/theme momentum panel with relative-strength rankings, breadth indicators, and correlated movers.
- [x] Add unit tests for scanner calculations, presets, data-provider contract, alert deduplication, acknowledgement, and watchlist actions.
- [x] Verify desktop and mobile/responsive rendering, interaction states, loading states, and client/server errors.
- [x] Save a final project checkpoint and provide the user with the completed dashboard version.

- [x] Replace native CSS resize with a dedicated resizable panel layout system and verify desktop/mobile behavior.
- [x] Extend the simulated engine with generated trades and live-updating market-cap values, and surface trades in the UI.
- [x] Implement all ten scanner algorithms and make scanner selection change displayed results.
- [x] Expose and apply all required threshold filters: price, float, market cap, dollar volume, spread, percent change, and RVOL.
- [x] Persist named presets and apply preset values to scanner results.
- [x] Add drag-to-reorder and functional custom-column controls to the watchlist.
- [x] Build live rule-based alert generation with wired deduplication and actual sound playback.
- [x] Add explicit loading, empty, and error states for dashboard panels and data flows.
