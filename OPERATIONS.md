# Operations Notes

## Finnhub webhook acknowledgement

The server exposes `POST /api/webhooks/finnhub`. Finnhub must send the configured `X-Finnhub-Secret` header. The server compares it against the managed, server-only `FINNHUB_WEBHOOK_SECRET` using a timing-safe comparison.

Authenticated deliveries receive an immediate HTTP `204` response. Unauthenticated deliveries receive `401` and do not trigger downstream work. The current release intentionally performs no database writes, notifications, order actions, or payload processing after acknowledgement. This keeps the endpoint bounded until the provider event schema and an explicit persistence policy are approved.

## Live-data scope

Live quote requests remain capped at ten unique symbols for the configured free-tier protection. Selecting a ticker from the searchable directory replaces one capped scanner slot, so the selected ticker can receive provider-backed live data without enabling uncapped polling. The directory itself may be unavailable when the provider symbol-reference request is rate-limited or unavailable; this does not authorize fabricated symbols or prices.

When live provider data is unavailable, the dashboard renders unavailable or delayed states and does not synthesize market values. Demo Mode is the only simulation path. Paper trading remains the only execution mode.
