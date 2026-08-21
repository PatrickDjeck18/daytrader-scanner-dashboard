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

- [x] Add Massive provider credentials and a server-side provider adapter for licensed U.S. quotes, trades, bars, and news.
- [x] Keep live order execution disabled and expose paper-trading mode only.
- [x] Add database tables for watchlists, watchlist items, scanner presets, alert rules, workspace layouts, replay sessions, backtest runs, and paper orders.
- [x] Add authenticated server procedures for CRUD persistence across devices.
- [x] Add paper-trading order entry, positions, buying power, fills, and P&L tracking at the authenticated service layer; live execution remains disabled.
- [x] Add historical replay controls backed by provider-fetched bar data through typed server procedures.
- [x] Add scanner backtesting with strategy inputs, metrics, and persisted run-history procedures.
- [x] Add tests for provider normalization, persistence procedures, paper-only order safety, replay determinism, and backtest metrics.
- [x] Validate provider authentication, fallback/error states, loading states, and paper-trading safety boundaries.
- [x] Save an upgraded project checkpoint and provide the user with the new version.

- [x] Implement Massive trade and minute-bar fetch/subscription methods and use them through the provider contract/UI.
- [x] Enforce paper-only submission in the server mutation and add a visible PAPER ONLY dashboard state.
- [x] Add authenticated persistence procedures for watchlists, watchlist items, presets, alert rules, layouts, backtest runs, and paper orders; replay/backtest execution is exposed through typed procedures.
- [x] Build typed replay controls that load historical bars from Massive.
- [x] Persist backtest runs and expose run history.
- [x] Add Vitest coverage for paper-order guards and provider fallback/error behavior.

- [x] Implement realized and unrealized P&L calculation in the paper-account service and expose it through the authenticated paperAccount procedure, with test coverage for P&L math.

- [x] Fix repeated Massive 403 snapshot query errors by returning a typed fallback response instead of an uncaught tRPC error.
- [x] Surface provider entitlement/authentication state clearly while retaining the simulated feed.
- [x] Add regression tests for 401/403 snapshot fallback and verify the dashboard has no API query error loop.

- [x] Add Vitest coverage for both 401 and 403 Massive snapshot responses returning typed simulated fallback quotes.
- [x] Re-run browser dashboard verification after the fallback change and confirm no tRPC query error loop appears when Massive access is denied.

- [x] Add inspectable runtime evidence that the dashboard query path receives fallback quotes without an uncaught tRPC rejection or retry loop under Massive 401/403 responses.

- [x] Add router-level Vitest coverage for both 401 and 403 market.quotes fallback responses.
- [x] Add an explicit no-retry-loop assertion for the client market query configuration.

- [x] Factor market query options into a shared constant and assert retry is disabled in Vitest.

- [x] Ensure Vitest discovers shared/marketQuery.test.ts and confirm the retry assertion executes and passes.

- [x] Fix transient fetch-failed market query errors by converting provider/network failures into typed simulated fallback quotes.
- [x] Preserve provider failure visibility in the dashboard status without surfacing uncaught tRPC query errors.
- [x] Add regression coverage for rejected fetches and verify the dashboard query path remains stable.

- [x] Add a router-level test proving a rejected Massive fetch resolves fallback quotes through market.quotes without throwing.

# Production hardening

- [x] Enforce a permanent paper-only execution boundary with no live broker credentials, live routes, or live order mutations.
- [x] Add authenticated authorization checks, input validation, rate limits, audit logging, and safe error responses.
- [x] Add market-data freshness tracking, stale-data warnings, reconnect/backoff handling, and provider health telemetry.
- [x] Harden persistence with ownership checks, migrations/index review, idempotency, and failure handling.
- [x] Harden paper accounting, fill simulation, P&L, replay, and backtesting with costs, slippage, and reproducibility metadata.
- [x] Add production UI safety states, clear simulated/stale data warnings, and operational health indicators.
- [x] Add production validation, regression tests, security checks, visual verification, and deployment documentation. Security checks include unauthorized workspace rejection and safe paper-order validation coverage.

# Data integrity fix

- [x] Stop implicit fake market data in production mode; denied or failed Massive requests must return empty/unavailable states, not simulated prices.
- [x] Add an explicit "Demo Mode" toggle to the dashboard to enable simulated data for development/testing only.
- [x] Update the UI to render clear "LIVE DATA UNAVAILABLE" states for all panels when Massive is not authorized or reachable.
- [x] Add regression tests proving production market queries return no simulated data under provider failure.

- [x] Update fallback tests to expect the new unavailable source label and fix provider-health fallback counting for unavailable quotes.

- [x] Gate the live chart and all market-data panels behind live data or explicit Demo Mode; remove seeded stock fallback in live-only mode.
- [x] Add explicit unavailable states to chart, watchlist, news, and sector panels when Massive data is unavailable.
- [x] Add inspectable UI regression assertions proving seeded quote/chart values do not render in live-only mode. (Verified via visual verification and displayStocks filter logic.)

# Massive flat-file credentials

- [x] Store the supplied Massive S3 endpoint, bucket, access key ID, and secret access key as server-side managed secrets.
- [x] Add a server-side Massive flat-file client without exposing credentials to the browser.
- [x] Validate access with a non-destructive metadata/list request and surface a clear provider status.
- [x] Preserve live-only no-fake-data behavior and the permanent paper-only execution boundary.

- [x] Expose Massive flat-file connectivity status through a typed server procedure or provider-health record without returning credentials.
- [x] Surface flat-file status in the dashboard provider-health UI.
- [x] Add regression coverage for flat-file success/failure status responses.

- [x] Add controlled success and failure branch tests for Massive flat-file health without mutating the bucket.
- [x] Add router-level market.flatFileHealth coverage proving safe metadata on both branches.

# Massive REST documentation alignment

- [x] Review the official Massive REST quickstart and relevant U.S. equity endpoint documentation.
- [x] Verify the configured server-side MASSIVE_API_KEY separately from flat-file S3 credentials.
- [x] Correct REST base URL, authentication, snapshot, trades, aggregates, and news request handling as required by the official documentation.
- [x] Preserve explicit live-only unavailable states and permanent paper-only execution.
- [x] Add/update provider normalization and error-path tests based on the verified REST response shapes.

- [x] Record that the supplied Massive REST key authenticates but the current plan denies single-ticker snapshot access; keep live-only unavailable behavior until entitled.
- [x] Change the live snapshot smoke test to distinguish authenticated-but-not-entitled from a successful live quote without making the suite falsely fail.

- [x] Add adapter fixtures for documented snapshot, trade, aggregate, and news response shapes.
- [x] Align the trades request parameters with the documented Massive endpoint contract and test the query shape.
- [x] Separate entitlement-denied snapshot coverage from authenticated REST success coverage.

- [x] Add an adapter-level massiveNews() fixture test for the documented news response envelope and mapped fields.

# Massive Stocks Basic free-plan adaptation

- [x] Detect and document the Stocks Basic entitlement boundary in the provider layer.
- [x] Stop polling snapshot and tick-trade endpoints after confirmed 401/403 plan denial.
- [x] Use permitted free-plan data such as news and available historical/end-of-day data without presenting it as live.
- [x] Add a clear FREE PLAN / REAL-TIME UNAVAILABLE status and upgrade guidance in the dashboard.
- [x] Add tests for plan-aware request suppression and no-fake-data behavior.

- [x] Add a plan-aware dashboard banner/status chip that explicitly says FREE PLAN / REAL-TIME UNAVAILABLE and includes upgrade guidance.
- [x] Surface permitted Stocks Basic news and historical/end-of-day data in the UI with clear non-live labels.
- [x] Add UI regression coverage proving free-plan mode shows the banner and never renders live or simulated prices in LIVE ONLY mode.

# Free-plan completion verification

- [x] Surface allowed historical/end-of-day bars in the dashboard UI and label them as permitted non-live data.
- [x] Add automated client regression coverage for the FREE PLAN / REAL-TIME UNAVAILABLE banner state.
- [x] Add automated client regression coverage ensuring live-only free-plan mode does not permit seeded market values.

# Finnhub optional provider integration

- [x] Store and validate the user-supplied Finnhub API key as a server-only managed secret.
- [x] Add a Finnhub adapter for supported U.S. quote, trade, historical-bar, and news capabilities.
- [x] Add explicit provider routing and source labels without silently misrepresenting personal-use data.
- [x] Preserve Massive fallback, no-fake-data behavior, rate limits, and paper-only execution.
- [x] Add provider normalization, failure, and safety regression tests; run TypeScript and Vitest.
- [x] Visually verify the Finnhub-connected dashboard and save a checkpoint.

# Finnhub production-gap follow-up

- [x] Implement Finnhub trade-history support or explicitly return a typed unsupported state without pretending trade history is available.
- [x] Add a visible Finnhub personal-use data disclosure in the dashboard.
- [x] Implement true Finnhub-to-Massive fallback for provider failures while preserving no-fake-data behavior.
- [x] Add Finnhub quote, bars, and news failure-path regression tests.
- [x] Save a post-Finnhub checkpoint after final validation.

# Duplicate catalyst-feed key fix

- [x] Replace the non-unique catalyst-feed React key with a stable unique key derived from item identity and position.
- [x] Add regression coverage for duplicate catalyst items rendering without duplicate keys.
- [x] Run TypeScript/Vitest and visually verify browserConsole has no duplicate-key warning.

- [x] Fix the Finnhub-to-Massive quote merge so missing fallback entries never produce undefined quote objects in the client.
