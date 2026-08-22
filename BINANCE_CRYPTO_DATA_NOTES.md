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

## Sources

1. [Binance Market Data Only URLs](https://developers.binance.com/en/docs/products/spot/faqs/market_data_only)
2. [Binance Spot Market REST API](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market)
3. [Binance USDⓈ-M Futures General Information](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/general-info)
4. [Binance USDⓈ-M Futures Market Data](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data)
5. [Binance USDⓈ-M Futures Market Streams](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/market)
6. [Binance.US API Documentation](https://docs.binance.us/)
7. [Binance Spot WebSocket Streams](https://github.com/binance/binance-spot-api-docs/blob/master/web-socket-streams.md)
8. [Binance.US WebSocket Streams](https://github.com/binance-us/binance-us-api-docs/blob/master/web-socket-streams.md)
