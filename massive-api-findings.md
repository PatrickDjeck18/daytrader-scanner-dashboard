# Massive API Findings

Official documentation reviewed on 2026-08-21.

- WebSocket endpoint for real-time U.S. stocks: `wss://socket.massive.com/stocks`.
- Delayed WebSocket endpoint: `wss://delayed.massive.com/stocks`.
- WebSocket clients authenticate with an API key before subscribing.
- Quote channel: `Q.*`; quote events provide bid/ask prices, sizes, timestamps, and tape metadata.
- Trade channel is available for tick-level stock trades.
- Per-minute aggregate channel: `AM.*`; aggregate events provide OHLC, volume, VWAP, accumulated volume, and start/end Unix-millisecond timestamps. Documentation says aggregates cover pre-market, regular, and after-hours sessions.
- News REST endpoint: `GET https://api.massive.com/v2/reference/news`; it supports ticker filters, publication date filters, sorting, limits, article URLs, publisher data, tickers, descriptions, and insights. Documentation says news is available on Stocks plans and updates hourly.
- WebSocket access is plan-dependent. The official docs show Stocks Advanced as real-time for quotes and minute aggregates; lower plans may be delayed or not included. Confirm the user's Massive plan before relying on real-time entitlements.
- The provider documentation recommends official client libraries and reconnect/subscription handling for production.

Sources:
- https://massive.com/docs/websocket/quickstart
- https://massive.com/docs/websocket/stocks/quotes
- https://massive.com/docs/websocket/stocks/aggregates-per-minute
- https://massive.com/docs/rest/stocks/news
