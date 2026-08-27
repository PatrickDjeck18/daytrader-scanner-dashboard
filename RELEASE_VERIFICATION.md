# Release Verification

## Preview review

The desktop entry view at `/auth` was reviewed at 1280×720. It presents a coherent dark terminal-style identity, an accessible sign-in card with labeled email and password fields, and an explicit statement that the workspace supports paper-only market tools with no live orders.

The protected `/` and `/binance` entries were reviewed without a signed-in Supabase session. Both correctly resolved to the sign-in surface instead of exposing dashboard data. The password-reset path at `/auth/reset` rendered a focused update-password form. The callback path at `/auth/callback` rendered a neutral secure-session confirmation state while no recovery or callback token was supplied, as expected for an unauthenticated direct visit.

The `/auth` entry was also reviewed at 375×812. The header, explanatory copy, field labels, controls, and paper-only notice remained legible and vertically ordered with no visible horizontal overflow or clipped primary action.

## Live preview evidence

The browser-accessible `/auth` route was verified to expose labeled email and password inputs, a sign-in action, and a password-reset action. Its visible content states that U.S. equities and Binance crypto tools are protected by Supabase authentication, that saved workspace data is user-isolated, and that no live order execution is available.

The browser-accessible `/auth/reset` route was verified to expose labeled new-password and confirmation inputs, an update action, and a return-to-sign-in control. It maintains the same paper-only no-live-orders notice.

## Production limitations accepted for this release

Massive market analytics and Finnhub credential checks are disabled by the user for this release. The application has tested visible fallback copy that identifies unavailable or rate-limited provider data and explicitly withholds fabricated prices and generated news. Existing Supabase-backed data and authentication tests pass against the configured service.
