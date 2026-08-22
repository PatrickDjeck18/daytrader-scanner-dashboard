# Binance Crypto Data Integration Notes

Verified on 2026-08-22 from Binance documentation.

Binance provides unauthenticated, public Spot market-data endpoints for aggregated trades, order-book depth, klines/candlesticks, tickers, prices, and trades through `data-api.binance.vision`. Its public market-data WebSocket domain is `data-stream.binance.vision`. These public-market endpoints are sufficient for a read-only crypto scanner and chart; an API key is not required.

An authenticated API key is only necessary if later work requires account-specific information or other endpoints marked as requiring `X-MBX-APIKEY`. No trading, balances, transfers, or user-data stream should be included in this dashboard’s integration.

## Confirmed multi-market scope

The integration will support three explicitly selected venues and markets: **Binance Global Spot**, **Binance Global USDⓈ-M Futures**, and **Binance.US Spot**. Global USDⓈ-M Futures uses the official `https://fapi.binance.com` REST base URL; its public market documentation provides ticker, aggregate-trade, kline/candlestick, mark-price, and funding-rate fields. Its public kline stream updates the current bar at a stated 250-millisecond cadence. Binance.US documents public endpoints as `NONE` security type and exposes market data separately from account, user-stream, and order-management functionality.

The dashboard must request public quote, candle, trade, and ticker data only. It must never call account, order, transfer, balance, user-stream, or signed endpoints; it must never request, retain, or send a Binance secret or use a user-supplied API key for this scope. Every screen must name the venue and market type, while regional/access errors must render as unavailable data without synthetic values.

## Browser-session streaming implementation

The selected approach connects from the active dashboard browser directly to public, combined market streams. It closes the connection when the dashboard selection changes or the page unmounts, so no server-side streaming process or background service is required. The stream set is restricted to the selected symbol’s `@ticker`, `@aggTrade`, and `@kline_<interval>` events. The Global Spot browser endpoint is `wss://data-stream.binance.vision/stream`; Binance.US is `wss://stream.binance.us:9443/stream`; and Global USDⓈ-M Futures uses the documented `fstream` public market stream endpoint. The app will consume only the combined-event `data` payload, lower-case its stream symbol, and construct interface state from actual ticker, aggregate-trade, and kline fields.

No stream is a substitute for a managed order book. The module will not display a depth ladder because accurate depth reconstruction requires snapshot/reconciliation logic that is outside this initial, read-only quote/chart/tape scope.

## Dedicated dashboard verification

The `/binance` route was verified in-browser with no account API configured. Global Spot returned a real BTCUSDT quote, 24-hour statistics, current provider candle, and aggregate trade prints through the public browser stream. The public market radar also returned a bounded, provider-derived USDT liquid-pair set ranked by reported quote volume. The route visibly states that there is no account connection and that order, transfer, withdrawal, leverage, margin, and prediction-trading controls are not present. The paper planning calculator performs local sizing only and cannot submit any order.

## Dashboard switching verification

The U.S. Equities root route exposes two visible, semantic navigation links labelled **U.S. Equities** and **Binance Crypto**, targeting the separately routed dashboards. A direct browser-click attempt was interrupted by the browser connector rather than by an application navigation error, so the route targets are also covered by deterministic page-source regression tests and are verified through direct route navigation.

## Binance announcement-news research

Binance officially announced a real-time English **Announcements WebSocket** on 2025-07-28. The announcement says the stream delivers Binance announcements directly without polling or delays. Binance’s developer-center catalogue separately advertises an **Announcements** product described as getting the latest Binance announcements in real time. The documentation landing page did not expose the stream schema to the text-only browser view, so implementation must discover and validate the exact endpoint and message contract before claiming a browser stream is connected. This source covers Binance platform announcements, listings, product notices, and promotions; it is not a general third-party crypto news wire.

The official Announcements WebSocket reference confirms the base URL `wss://api.binance.com/sapi/wss`, but it is a signed, authenticated API: it requires a user API key in the `X-MBX-APIKEY` WebSocket header, a timestamp/signature in the connection URL, periodic PING messages, and reconnection after 24 hours. It therefore cannot be used in the current no-Binance-API scope. The documentation also exposes an **Announcements** reference page for topic details, but private credentials must never be used in the browser.

Sources: [Binance announcement launch](https://www.binance.com/en/support/announcement/detail/a72645c63e4a4062b77db52b86fef1bb), [Binance Announcements WebSocket API basic information](https://developers.binance.com/en/docs/products/announcements/general-info), [Binance Developer Center](https://developers.binance.com/en).

## Public crypto news wire verification

The selected no-account implementation fetches the official CoinDesk RSS URL server-side and refreshes its typed dashboard query every 60 seconds only while the Binance dashboard is open. Direct tRPC verification and live browser rendering confirmed provider-returned headlines, canonical article links, source labels, provider publication timestamps, and a visible “Near-real-time provider feed” label. No Binance key, account connection, generated headline, summary, timestamp, or catalyst is used. CoinDesk states its RSS feed updates as soon as it publishes a story; the dashboard deliberately does not call it a streaming feed.

## Sources

1. [Binance Market Data Only URLs](https://developers.binance.com/en/docs/products/spot/faqs/market_data_only)
2. [Binance Spot Market REST API](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market)
3. [Binance USDⓈ-M Futures General Information](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/general-info)
4. [Binance USDⓈ-M Futures Market Data](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data)
5. [Binance USDⓈ-M Futures Market Streams](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/market)
6. [Binance.US API Documentation](https://docs.binance.us/)
7. [Binance Spot WebSocket Streams](https://github.com/binance/binance-spot-api-docs/blob/master/web-socket-streams.md)
8. [Binance.US WebSocket Streams](https://github.com/binance-us/binance-us-api-docs/blob/master/web-socket-streams.md)
