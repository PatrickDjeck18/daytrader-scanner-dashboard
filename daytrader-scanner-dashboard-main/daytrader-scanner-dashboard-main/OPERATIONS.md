# Operations Notes

## Finnhub webhook acknowledgement

The server exposes `POST /api/webhooks/finnhub`. Finnhub must send the configured `X-Finnhub-Secret` header. The server compares it against the managed, server-only `FINNHUB_WEBHOOK_SECRET` using a timing-safe comparison.

Authenticated deliveries receive an immediate HTTP `204` response. Unauthenticated deliveries receive `401` and do not trigger downstream work. The current release intentionally performs no database writes, notifications, order actions, or payload processing after acknowledgement. This keeps the endpoint bounded until the provider event schema and an explicit persistence policy are approved.

## Live-data scope

Live quote requests remain capped at ten unique symbols for the configured free-tier protection. Selecting a ticker from the searchable directory replaces one capped scanner slot, so the selected ticker can receive provider-backed live data without enabling uncapped polling. The directory itself may be unavailable when the provider symbol-reference request is rate-limited or unavailable; this does not authorize fabricated symbols or prices.

When live provider data is unavailable, the dashboard renders unavailable or delayed states and does not synthesize market values. Demo Mode is the only simulation path. Paper trading remains the only execution mode.

## Supabase database

The application database now runs on the selected Supabase PostgreSQL project through a server-only `SUPABASE_DATABASE_URL` transaction-pooler connection. The dashboard uses Drizzle with the PostgreSQL adapter and forces an IPv4 TLS route because the direct database hostname is not available from this application environment.

The migration created the application schema, enums, indexes, updated-at triggers, and row-level security on every public table. No browser-side Supabase key is used. The current application accesses the database only from the server through authenticated tRPC procedures; RLS has no public policies by design, so direct anonymous and authenticated Supabase API access is denied. The existing owner account and provider-health records were migrated; all other source tables were empty at cutover.
