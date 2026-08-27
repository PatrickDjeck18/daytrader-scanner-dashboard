# Binance Account Dashboard Scope Notes

Verified on 2026-08-22 from Binance documentation.

## Account-read boundary

The dedicated dashboard can support a **read-only account view** if the user provides a separate Binance API key restricted to `USER_DATA` / **Enable Reading**. Binance classifies private account information, order status, and trade history as `USER_DATA`; those secure requests require an API key, timestamp, and signature. The dashboard must make only HTTP `GET` requests to the minimum account endpoints necessary for balances, positions, and read-only order history. It must never use `TRADE`, `USER_STREAM`, transfer, borrow, repay, withdrawal, redemption, prediction-order, or other state-changing endpoints.

For USDⓈ-M Futures, the account-information and account-balance endpoints are `USER_DATA` endpoints. They return current balances, margin figures, and position details, but should be treated as account visibility only. The application must not call live order, leverage, or transfer endpoints.

## Margin and prediction products

Binance’s own Margin guidance states that Margin API calls may be rejected unless the key has **Enable Spot & Margin Trading** and related margin permissions. Those scopes are incompatible with the current project’s permanent paper-only execution boundary; this project therefore must not integrate private Margin account endpoints that require trading-capable credentials. The dashboard can display public Spot/Futures market data and explicit “not connected” / “permission not accepted” states instead.

Binance publishes a prediction-trading API with market-data endpoints and separate account/order/transfer workflows. The integration guide describes a credentialed WebSocket that receives prediction order and transfer status events. This project must not subscribe to those account event topics or expose any prediction buy, sell, claim, redeem, order, or transfer operation. Public prediction market-data support is a possible future read-only feature only after a dedicated endpoint/auth review.

## Approved capability matrix

| Product | Current project capability |
|---|---|
| Spot account balances and history | Possible with a separate read-only key after user confirmation |
| USDⓈ-M Futures balances and positions | Possible with a separate read-only key after user confirmation |
| Spot/Margin orders, borrow/repay, transfers, withdrawals | Prohibited in this paper-only project |
| Futures orders, leverage changes, transfers | Prohibited in this paper-only project |
| Prediction market-data browsing | Deferred pending endpoint/auth review |
| Prediction market orders, claims, redemptions, transfers, account event streams | Prohibited in this paper-only project |

## Sources

1. [Binance Spot REST API](https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md)
2. [Binance Margin Best Practice](https://developers.binance.com/en/docs/products/margin-trading/best-practice)
3. [Binance USDⓈ-M Futures Account API](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account)
4. [Binance Prediction Trading Market Data API](https://developers.binance.com/en/docs/catalog/web3-wallet-prediction-trading/api/rest-api/market-data)
5. [Binance Prediction Market WebSocket Integration Guide](https://developers.binance.com/en/docs/products/w3w-prediction/websocket-api/integration-guide)
