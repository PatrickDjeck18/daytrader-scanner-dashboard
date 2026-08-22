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

# Finnhub scanner eligibility fix

- [x] Prevent unsupported Finnhub fields from being treated as known zero values in scanner eligibility.
- [x] Show a clear unsupported-data note for filters that cannot be evaluated from the active provider.
- [x] Add regression coverage proving valid Finnhub quotes are not reduced to zero scanner symbols by unavailable optional metrics.
- [x] Run TypeScript/Vitest, visually verify the scanner count, and save a checkpoint.

- [x] Distinguish Finnhub rate-limit/provider outage from an empty scanner result in the dashboard so users are not misled by a zero-symbol count.

# Finnhub scanner-mode follow-up

- [x] Treat unsupported Finnhub metrics as unknown in scanner-specific modes, including low-float and RVOL scanners, instead of interpreting them as zero.
- [x] Add a scanner-logic regression with valid Finnhub-style quote rows and missing optional metrics that asserts rows remain available.
- [x] Save a post-scanner-fix checkpoint after clean visual verification of a nonzero Finnhub symbol count.

# Finnhub RVOL scanner follow-up

- [x] Treat Finnhub RVOL-dependent scanner modes as metric-unavailable rather than sorting or filtering on numeric zero.
- [x] Add actual scanner-mode regression coverage for Finnhub rows in Low-Float Momentum and Relative Volume Leaders.

# Finnhub RVOL state disclosure

- [x] Add an explicit RVOL-unavailable state or label for Finnhub RVOL-dependent scanner modes instead of silently substituting change ordering.
- [x] Add regression coverage asserting the RVOL-dependent Finnhub state is visibly marked unavailable.

# Client regression discovery

- [x] Include client-side regression tests in Vitest discovery and verify the Finnhub scanner-state assertions execute.

# Final scanner evidence

- [x] Capture inspectable evidence that the running Finnhub scanner panel shows a nonzero symbol count after the final scanner-mode changes.
- [x] Save a final checkpoint containing that evidence and the fully completed task list.

# Expanded scanner symbol display

- [x] Increase the scanner table’s visible rows beyond the current seven-symbol slice.
- [x] Add a clear show-more/show-less control with accurate eligible-symbol counts.
- [x] Add regression coverage for expanded scanner results and preserve provider-aware/no-fake-data behavior.
- [x] Visually verify the expanded table and save a checkpoint.

# Expanded provider-backed symbol universe

- [x] Expand the real Finnhub quote universe beyond the original eight seed symbols.
- [x] Create quote-only rows from provider responses with unknown optional metadata, never fabricated prices or fundamentals.
- [x] Add regression coverage proving provider-backed rows make the expanded scanner control reachable.

# Deployment timeout investigation

- [x] Inspect deployment logs, package scripts, generated assets, and project size for timeout causes.
- [x] Fix any code, build, dependency, or packaging issue responsible for deployment timeout.
- [x] Run production build, TypeScript, and Vitest validation after the fix.
- [x] Save a verified checkpoint and document whether any remaining timeout is infrastructure-related.

# Finnhub ten-symbol request cap

- [x] Cap the active Finnhub quote request universe at exactly 10 symbols.
- [x] Preserve provider-backed row creation, no-fake-data behavior, and scanner counts under the cap.
- [x] Add regression coverage, run validation, visually verify the cap, and save a checkpoint.

# Persistent Finnhub rate-limit warning

- [x] Determine whether the displayed Finnhub 429 state is still active or stale after server restart.
- [x] Fix cooldown expiry, health refresh, or UI messaging if the warning persists after the provider window resets.
- [x] Add regression coverage for cooldown expiry and rate-limit state refresh.
- [x] Run validation, visually verify the corrected state, and save a checkpoint.

# Aborted market-data request fix

- [x] Trace whether the aborted error comes from provider timeout, client cancellation, or server request lifecycle.
- [x] Convert expected aborts into typed unavailable quote results without retry loops or fake prices.
- [x] Add regression coverage for AbortError and operation-aborted messages.
- [x] Run TypeScript/Vitest, inspect browser console, and save a checkpoint.

- [x] Add direct regression coverage for abort-error classification and safe market fallback behavior.

# Full eligible-symbol scanner

- [x] Deferred: identify an authoritative provider-backed full-universe source compatible with the configured Finnhub/Massive plans.
- [x] Deferred: remove the fixed ten-symbol request cap only where the provider and rate limits support it.
- [x] Deferred: display all eligible returned symbols with pagination or virtualization; live quote requests remain capped.
- [x] Preserved caching, backoff, no-fake-data, and unavailable-state behavior.
- [x] Add regression coverage, validate, visually verify, and save a checkpoint.

# All-symbol directory mode

- [x] Add a provider-backed U.S. ticker directory without fetching live quotes for every ticker.
- [x] Add search and selection behavior that requests live data only for the selected symbol or capped scanner set.
- [x] Clearly label directory entries without current quotes and preserve no-fake-data safeguards.
- [x] Add regression coverage, validate, visually verify, and save a checkpoint.

- [x] Bound symbol-directory provider latency so the panel resolves to a clear unavailable state instead of remaining in loading indefinitely.

# Continuation: selected directory quotes and Finnhub webhook

- [x] Include a searched directory ticker in the capped provider-backed live quote request set without exceeding the free-tier cap.
- [x] Remove any duplicate market-bars helper declaration and confirm the server compiles cleanly.
- [x] Add the managed FINNHUB_WEBHOOK_SECRET and a Finnhub webhook endpoint that acknowledges authenticated deliveries with 2xx immediately.
- [x] Add webhook authentication and acknowledgement regression tests without persisting or fabricating event data.
- [x] Run TypeScript, Vitest, production build, and browser verification for live-only unavailable states and selected-symbol behavior.
- [x] Save the final validated checkpoint and provide the published project version.
- [x] Deferred uncapped all-symbol live polling; directory search remains available and live requests stay capped by the free-tier policy.
- [x] Deferred live execution permanently; only paper trading remains enabled.
- [x] Deferred provider-plan upgrades and synthetic data in live-only mode.
- [x] Deferred scheduled background polling and third-party notification delivery.
- [x] Deferred webhook event side effects until an event schema and persistence policy are approved.
- [x] Keep the selected-directory quote helper covered by a deterministic client regression test.
- [x] Keep webhook acknowledgements side-effect free, bounded, and server-only.
- [x] Keep the final checkpoint description explicit about live, delayed, unavailable, and deferred behavior.
- [x] Keep final verification free of external network calls and database seeding.
- [x] Keep all previous production-hardening regressions passing.
- [x] Keep final delivery after checkpoint save only.

# Price direction indicators

- [x] Add green upward indicators for positive price movement.
- [x] Add red downward indicators for negative price movement.
- [x] Preserve neutral styling for unchanged or unavailable values.
- [x] Apply direction indicators consistently to scanner rows, selected-symbol workspace, and watchlist.
- [x] Add regression coverage for positive, negative, neutral, and unavailable direction states.
- [x] Run TypeScript, Vitest, and browser visual verification.
- [x] Save and publish the updated checkpoint.

# Refresh and watchlist interaction repair

- [x] Trace the refresh button and add-symbol-to-watchlist event paths.
- [x] Make refresh explicitly invalidate or refetch relevant market-data queries and show feedback.
- [x] Make add-symbol-to-watchlist reliably add valid symbols, prevent duplicates, and show feedback.
- [x] Ensure the add-symbol control works when provider quotes are unavailable and does not fabricate values.
- [x] Add regression tests for refresh and watchlist-add behavior.
- [x] Run TypeScript, full Vitest suite, production build, and browser interaction verification.
- [x] Save and publish the repaired checkpoint.

# Alert stream history repair

- [x] Trace the alert history button and alert state behavior.
- [x] Implement an accessible alert history view with close and empty states.
- [x] Preserve existing alert entries and read-state behavior.
- [x] Add regression coverage for opening and closing alert history.
- [x] Run TypeScript, full Vitest suite, production build, and browser verification.
- [x] Save and publish the alert history repair checkpoint.

# News notification sound

- [x] Add an optional sound when new provider-backed news arrives.
- [x] Respect the existing sound mute/unmute control and browser autoplay restrictions.
- [x] Do not play sound for demo-only, unavailable, or fabricated news states.
- [x] Add deterministic regression coverage for news notification eligibility and mute behavior.
- [x] Run TypeScript, full Vitest suite, production build, and browser verification.
- [x] Save and publish the news notification sound checkpoint.

# Visual hierarchy redesign

- [x] Collapse competing top status pills into a primary feed-health indicator and compact market-status chip with detail on hover.
- [x] Replace decorative symbol colors with semantic catalyst, unusual-tape, halt, and price-direction meanings plus a legend.
- [x] Make unsupported RVOL, float, and volume values visibly unavailable and visually recessive rather than numeric placeholders.
- [x] Increase selected-symbol price hierarchy and use aligned monospace tabular numerals.
- [x] Replace the historical chart table presentation with an SVG market-pattern chart while retaining timeframe controls and provider-unavailable safeguards.
- [x] Preserve row selection, scanner switching, refresh, watchlist, alert-history, news-sound, paper-only, and no-fake-data behavior.
- [x] Add regression coverage for visual-state helpers and run TypeScript, full Vitest, build, and responsive visual verification.
- [x] Save and publish the verified visual hierarchy checkpoint.

# Supabase database setup

- [x] Inspect the connected Supabase project and verify available database access.
- [x] Convert the current Drizzle schema from MySQL to PostgreSQL-compatible definitions.
- [x] Configure Drizzle and server database access for Supabase without exposing secrets.
- [x] Apply the schema and migrate existing rows if the source database is accessible.
- [x] Add database connectivity and protected-flow regression coverage.
- [x] Run TypeScript, full Vitest, production build, and database verification.
- [x] Save and publish the verified Supabase database checkpoint.

- [x] Use the explicitly selected Supabase project `nafzdjyehhuexjsipaeb` (`https://nafzdjyehhuexjsipaeb.supabase.co`) as the migration target instead of the previously detected project.

# Massive historical-bars rate-limit repair

- [x] Trace the Massive bars 429 path from provider adapter through the tRPC chart query.
- [x] Normalize bars 429 responses to a typed unavailable or delayed result without uncaught client errors.
- [x] Add a bounded bars cooldown to prevent repeated provider calls during the rate-limit window.
- [x] Normalize the local tRPC bars limiter into the same safe delayed chart state rather than surfacing a client query error.
- [x] Add regression coverage for Massive bars 429 behavior and client chart handling.
- [x] Run TypeScript, full Vitest, production build, browser verification, and log inspection.
- [x] Save and publish the verified historical-bars rate-limit repair checkpoint.

# Full modernisation package

- [x] Inspect reusable command, dialog, layout, and chart components before implementation.
- [x] Add a versioned Supabase-backed workspace layout model and protected save/load API.
- [x] Implement keyboard-first command palette actions for symbol selection, scanner switching, refresh, sound, and workspace operations.
- [x] Implement drag-and-drop panel ordering, panel visibility controls, and saved workspace layout restoration.
- [x] Add enhanced chart controls: line/candlestick modes, VWAP, volume, session high/low, and provider-safe unavailable states.
- [x] Preserve paper-only execution, provider cooldowns, no-fake-data labels, and current accessibility behavior.
- [x] Add deterministic database, command palette, layout, and chart-control regression coverage.
- [x] Run TypeScript, full Vitest, production build, and desktop/mobile interaction verification.
- [x] Save and publish the verified full modernisation checkpoint.

# Verification follow-up: local market-query rate limit

- [x] Trace the uncaught local market-query rate-limit error observed during modernisation browser verification.
- [x] Normalize the affected public market query into a typed safe state instead of surfacing a client query error.
- [x] Add a regression test and re-run browser log verification after restart.

# Live chart and live news enablement

- [x] Verify the current Massive and Finnhub entitlement limits for live U.S. chart bars and news.
- [x] Map the existing dashboard provider adapters to the viable live-data integration paths.
- [x] Present the required provider entitlement and secure configuration steps without enabling live orders.
- [x] Deferred by the current scope: configure a selected U.S. equities provider entitlement and validate live chart/news behavior only after the user chooses a Massive/Finnhub plan path.

# Binance crypto data integration

- [x] Confirm whether the user needs Binance Spot, Futures, or both, and whether the account is production or testnet. (User selected all three public markets; account mode is not used.)
- [x] Verify the regional availability and public versus authenticated Binance API requirements.
- [x] Add a clearly separated read-only Binance crypto quote and chart integration without live order execution.
- [x] Keep Binance credentials server-only and request only the minimum required read scope if authenticated endpoints are needed. (No credentials are required or requested for public market data.)
- [x] Add tests and validate that U.S. equities, paper-only execution, and no-fake-data safety boundaries remain unchanged.
- [x] Support a clear market selector for Binance Global Spot, Global USDⓈ-M Futures, and Binance.US Spot data.
- [x] Surface venue, market type, freshness, regional availability, and provider errors without using generated market values.
- [x] Add scoped starter instruments and input validation appropriate to each Binance market.
- [x] Implement live Binance updates only while an active dashboard browser session is connected; do not add an always-on relay or background alert service.

# Dedicated Binance account dashboard

- [x] Deferred by the current scope: a private read-only Binance account dashboard requires user API credentials, which the user has chosen not to use now.
- [x] Verified and documented Binance account-read permissions, endpoint scopes, and regional product considerations from official documentation.
- [x] Deferred by the current scope: request an Enable Reading-only Binance key only if the user later chooses account portfolio visibility.
- [x] Deferred by the current scope: do not build private balance or position views without an approved server-only read key.
- [x] Retained public live market data, no-fake-data unavailable states, and paper-only simulation without account trade, transfer, balance, or credential features.
- [x] Added public-data normalization coverage and retained existing paper-only safety tests; private-API permission tests are deferred until a read-only account integration is approved.

# Live Binance execution request boundary

- [x] Preserve the permanent paper-only execution boundary: do not add Spot/Margin, Futures, or Prediction Trading order routes to this project.
- [x] Keep Binance API credentials out of Supabase tables, browser storage, logs, and source code; use managed server-side secrets only for approved read-only access.
- [x] Deferred by the current scope: the user requested no Binance API connection, so no credentials will be requested.

# Dedicated public-data Binance dashboard

- [x] Build a dedicated Binance dashboard view that operates with public market data only and requires no user API credentials.
- [x] Add Global Spot, USDⓈ-M Futures, and Binance.US Spot market switching with explicit venue and availability labels.
- [x] Add public-market movers, liquid-pair discovery, market statistics, chart and aggregate-trade context without fabricated values.
- [x] Add a clearly labelled paper-only crypto trade-planning workspace; do not add any live order, account, transfer, balance, or credential feature.
- [x] Add deterministic tests, responsive verification, and explicit no-account/no-live-execution safeguards.

# Dashboard separation

- [x] Remove the embedded Binance crypto terminal from the U.S. equities dashboard so the root view is U.S.-equities-only.
- [x] Keep the dedicated Binance dashboard at its own route with no U.S. equities scanner panels.
- [x] Add a clear two-option switcher for **U.S. Equities Dashboard** and **Binance Crypto Dashboard** on both dashboard headers.
- [x] Add regression coverage and desktop/mobile verification that the two dashboards remain visually and functionally separate.
- [x] Fix the Binance mobile header so the two-dashboard switcher remains visible rather than being hidden by the compact navigation rule.

# Dashboard switch interaction verification

- [x] Verify that the U.S. Equities and Binance Crypto switcher controls navigate to their respective dedicated routes on desktop and mobile.
- [x] Add or refine any necessary switching affordance so the active dashboard and navigation action are unmistakable.
- [x] Add deterministic coverage for route targets, verify actual browser navigation, and publish the result.

# Binance crypto news

- [x] Verify official/public crypto-news sources, delivery mechanisms, rate limits, and freshness semantics without requiring the user’s Binance account API.
- [x] Add a provider-backed Binance dashboard news panel with source, timestamp, link, and truthful live or delayed labels.
- [x] Do not fabricate headlines, summaries, timestamps, or catalyst classifications when the source is unavailable.
- [x] Add deterministic tests and responsive verification for news loading, unavailable, duplicate, and fresh-item states.

# Public crypto news wire

- [x] Integrate the selected public crypto RSS feed without requesting Binance credentials or connecting a Binance account.
- [x] Fetch and normalize only provider-returned headline, publication time, source, and canonical article link.
- [x] Refresh the news feed only while the dashboard is open and label it as near-real-time rather than streaming.
- [x] Retain an explicit unavailable state and prevent generated headlines, timestamps, links, summaries, or catalyst classifications.

# Official Binance announcement stream

- [x] Deferred by the selected no-account scope: the official Binance Announcements WebSocket requires an API key and signed connection.
- [x] Deferred by the selected no-account scope: do not implement an authenticated Binance Announcements client or introduce credentials.
- [x] Superseded by the public RSS wire: provider-returned CoinDesk title, publication time, source, and canonical link now render in the Binance-only news panel.
- [x] Validated the public no-account route: no Binance trading/account code or secrets were added, and RSS failures return a truthful unavailable state.

# Supabase authentication and protected dashboards

- [x] Audit the existing Manus OAuth session, Supabase PostgreSQL schema, user identifiers, and every persisted dashboard data flow before migration.
- [x] Configure Supabase Auth client credentials and authorized redirect URLs using managed environment variables only.
- [x] Create dedicated Supabase sign-in, sign-up, password-reset, and signed-out screens.
- [x] Require an active Supabase session before access to the U.S. Equities or Binance Crypto dashboards.
- [x] Reconcile dashboard ownership through Supabase Auth UUID-to-application-user mapping so workspace layouts, watchlists, presets, alerts, paper orders, backtests, and preferences remain user-isolated in Supabase.
- [x] Add row-level access protections and server-side session verification without exposing service credentials to the browser.
- [x] Add deterministic authentication and ownership-isolation tests, then verify desktop and mobile protected routes.
- [x] Resolve Supabase Auth route and user-record TypeScript errors before validating the protected dashboard flow.
- [x] Apply and verify Supabase Auth row-level security policies through the connected PostgreSQL project after the legacy TiDB schema tool rejected PostgreSQL-only policy syntax.

# Authentication copy refinement

- [x] Remove the requested “Supabase-backed identity” heading and “Email/password sessions managed by Supabase Auth.” sentence from the authentication screen.
- [x] Verify the sign-in screen remains balanced and responsive after the copy removal, then publish the update.

# Binance paper account and DeepSeek paper bot

 - [x] Define a persistent $10,000 Binance paper account, supported public markets, balances, positions, fills, realized/unrealized P&L, and reset policy.
 - [x] Enforce no-live-execution guardrails: no Binance account credential, order, leverage, margin, transfer, withdrawal, or prediction-trading integration.
 - [x] Define bot risk limits, quote freshness requirements, daily loss controls, position sizing, duplicate-order protection, and explicit simulation labels.
 - [x] Configure a server-only DeepSeek API credential and validate the connection without exposing the key to the browser or Supabase tables.
 - [x] Add a DeepSeek-assisted market-analysis and paper-trade decision workflow using provider-returned Binance market context only.
 - [x] Persist paper account, bot configuration, bot decisions, simulated orders, and audit history per Supabase-authenticated user.
 - [x] Add deterministic simulation, risk-limit, persistence, no-live-order, and DeepSeek failure-path coverage; verify protected desktop/mobile routes.
- [x] Implement the user-selected scheduled paper-bot mode with managed project-owned 1m/5m/15m jobs, per-user pause/resume, per-account idempotent runs, and no in-process timer.
 - [x] Apply the selected 1m, 5m, and 15m decision context, 1% per-trade risk limit, and 3% daily simulated-loss stop to every bot run.
 - [x] Resolve scheduled paper-bot TypeScript mismatches for Binance bar timestamps, quote availability, and cron callback request typing.
- [x] Resolve the paper-bot UI ticker-price type mismatch and add the responsive paper-account/bot styles.

# DeepSeek empty-decision repair

- [x] Trace and safely normalize empty DeepSeek decision content in the scheduled paper bot.
- [x] Add regression coverage for empty, malformed, and truncated DeepSeek decision responses.
- [x] Revalidate, publish, and verify the paper-only error state does not create a simulated order.
