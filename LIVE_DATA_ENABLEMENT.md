# Live Chart and News Enablement Findings

Verified on 2026-08-22 from the provider documentation below.

| Provider | Live charts | Live news | Current practical implication |
| --- | --- | --- | --- |
| Massive | Stocks Advanced is listed as the real-time U.S. stock-data plan and includes minute/second aggregates, WebSockets, snapshots, trades, and quotes. | Massive’s News endpoint is included in all Stocks plans but its documentation lists it as updated hourly, not a real-time streaming news feed. | The existing adapter can use real-time bars after an Advanced entitlement is active; Massive news should remain labelled hourly/non-live. |
| Finnhub | The public docs mark US Candles (OHLCV) and trade data as Premium. | Finnhub’s WebSocket news endpoint is marked Premium; pricing describes real-time company-news updates on the paid plan. | The existing REST news fallback can remain; a premium entitlement is required before adding streaming news or treating it as real-time. |

The existing dashboard must remain paper-only. Any new provider key must be stored server-side through managed secrets, never in browser code.

## Sources

1. [Massive Pricing](https://massive.com/pricing)
2. [Massive Stocks REST API Overview](https://massive.com/docs/rest/stocks/overview)
3. [Finnhub Company News and WebSocket Documentation](https://finnhub.io/docs/api/company-news)
4. [Finnhub Pricing](https://finnhub.io/pricing)
5. [Massive Stock News Endpoint](https://massive.com/docs/rest/stocks/news)
