# Production Operations

## Execution boundary

This application is permanently paper-only. The server exposes `submitPaperOrder` with `mode: "paper"` and rejects any other mode. No live broker adapter, live broker credential, or live order route is included. The UI displays `PAPER ONLY`, and live order execution must remain disabled in future changes.

## Required configuration

`MASSIVE_API_KEY` must be provided through the managed secrets interface. The key is server-side only and is never sent to the browser. Massive subscription entitlements must be validated for the intended U.S. equity quote, trade, aggregate, news, and WebSocket workloads.

## Market-data safety

Massive requests use bounded timeouts. Snapshot requests are isolated per symbol, and 401, 403, and network failures produce typed simulated fallback quotes instead of rejecting the full dashboard query. The dashboard shows `SIMULATED / DEGRADED` or `STALE FEED` whenever live data is unavailable or old. WebSocket subscriptions use bounded exponential reconnect backoff and update persisted provider health telemetry.

Fallback data is for continuity and development only. It must never be interpreted as a live quote or used to authorize an order. Paper orders require explicit paper mode and are idempotent through a user-scoped key.

## Security and operations

Authenticated workspace and paper procedures enforce the current user ID on every database query. Public market procedures validate symbols and limits and use request rate limits. Sensitive mutations write audit events with a request identifier. Database migrations are generated from `drizzle/schema.ts`, reviewed, and applied through the managed database migration workflow.

Production monitoring should alert on provider health `degraded` or `offline`, stale quote age, repeated rate-limit events, failed audit writes, database connection failures, and unexpected tRPC errors. Rotate `MASSIVE_API_KEY` through the managed secrets UI rather than committing credentials.

## Research integrity

Replay and backtests sort bars chronologically, persist data start/end timestamps, and support configurable slippage and per-trade fees. Results are research outputs, not performance guarantees. Before relying on a result, verify the provider’s historical-data completeness, corporate-action adjustments, market-session boundaries, and strategy assumptions.

## Release checklist

Before publishing, run `pnpm check` and `pnpm test`, review all generated SQL migrations, verify the paper-only guard and fallback tests, inspect the dashboard at desktop and narrow breakpoints, confirm the Massive entitlement state, and click the managed Publish control only after creating a checkpoint. Live order execution remains out of scope.

## Multi-instance note

The application-level limiter is a defensive per-instance guard. For a multi-instance deployment, configure equivalent IP/user quotas at the managed edge or API gateway as the authoritative control, because process-local counters are not globally shared across instances.
