# Validation Notes

## Learning Mode trade ledger expansion

On August 22, 2026, desktop and mobile captures of `/auth` and `/binance` verified that unauthenticated visitors are redirected to the responsive sign-in experience. The protected Binance workspace, including its user-isolated Learning Mode order ledger, does not render before a valid Supabase session exists.

The full ledger’s behavior is covered by deterministic component and server tests because the preview session does not contain an authenticated user account. The verified test cases include an open simulated entry, matched realized win, matched realized loss, zero-price safety, source isolation, and win/loss/open filters.

TypeScript compilation, all 122 Vitest tests across 39 files, and the production build passed. The post-restart log review contained no application or ledger errors; one transient development HMR WebSocket reconnect message was followed by successful reconnects.

## Ten-order audit pagination

The Learning Mode audit now paginates all filtered order rows in groups of ten, displays the visible order range, and provides keyboard-accessible previous/next controls. Page changes are clamped to the available range after automatic data refreshes, while selecting a new All/Open/Wins/Losses filter starts at page one. TypeScript, all 123 Vitest tests across 39 files, and the production build passed. The mobile protected-route capture remained responsive; the user-specific ledger cannot be rendered in the unauthenticated preview.
