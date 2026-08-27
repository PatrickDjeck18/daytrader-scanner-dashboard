# Massive REST verification

Reviewed 2026-08-21 from the official documentation.

- REST API uses `https://api.massive.com`.
- Authentication supports `apiKey` query parameter or an Authorization header; the API key must remain server-side.
- Single ticker snapshot: `GET /v2/snapshot/locale/us/markets/stocks/tickers/{stocksTicker}`. It returns a root response with `status`, `request_id`, and `ticker`, whose fields include `day`, `lastQuote`, `lastTrade`, `min`, `prevDay`, `todaysChange`, `todaysChangePerc`, and `updated`.
- Trades: `GET /v3/trades/{stockTicker}` with `timestamp`, `order`, `limit`, and `sort`; trade timestamps are nanosecond Unix timestamps and results are under `results`.
- Custom bars: `GET /v2/aggs/ticker/{stocksTicker}/range/{multiplier}/{timespan}/{from}/{to}`; custom bars include pre-market, regular, and after-hours sessions.
- News: `GET /v2/reference/news`; results include title, article URL, publisher, published UTC, tickers, description, and optional insights.
- Snapshot/trades real-time plan access is dependent on the account plan; the docs list Stocks Advanced as real-time while lower plans may be delayed or unavailable.
- The quickstart directs live streams to the WebSocket API and bulk historical downloads to Flat Files.

The current adapter already uses the documented base URL and primary snapshot/trade/bar/news routes. The separate S3 flat-file credentials do not replace `MASSIVE_API_KEY` and do not grant REST/WebSocket access.

Sources:
- https://massive.com/docs/rest/quickstart
- https://massive.com/docs/rest/stocks/snapshots/single-ticker-snapshot
- https://massive.com/docs/rest/stocks/trades-quotes/trades
- https://massive.com/docs/rest/stocks/aggregates/custom-bars
- https://massive.com/docs/rest/stocks/news
