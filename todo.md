# Project TODO

- [x] Inspect the uploaded dashboard source, excluding local dependencies, build output, logs, and secrets.
- [x] Import the React, Express, and tRPC dashboard into the Manus project while retaining its application routes and interface modules.
- [x] Adapt authentication, database, and runtime environment configuration for Manus without copying bundled credentials.
- [x] Review database migrations and apply only the safe, required schema changes for the deployed application.
- [x] Configure recurring paper-trading work for the Manus runtime or document any production-hosting limitation.
- [x] Run type checks, tests, and a production build; resolve deployment-blocking defects.
- [x] Verify the dashboard’s responsive production UI and key unauthenticated routes.
- [x] Create a release checkpoint for publication on Manus.
- [x] Configure the default managed deployment path, using durable one-minute-or-greater paper-bot schedules instead of a continuous background monitor.
- [x] Release with the dashboard’s visible degraded-data handling for unavailable Massive analytics and Finnhub news credentials.
- [x] Verify clear degraded or unavailable UI messaging for Massive analytics and Finnhub news when their provider credentials are unavailable.
- [x] Review the captured desktop and mobile preview evidence for the protected dashboard entry routes.
- [x] Verify the authentication entry, password-reset, and callback route definitions required for Supabase sign-in.
- [x] Record the reviewed preview evidence and accepted provider limitations in the project release verification notes.
- [x] Diagnose and fix the deployed “Please login (10001)” error without weakening authentication safeguards.
- [x] Verify the protected-route session acceptance path with server-key and authenticated-bearer regression tests.
- [ ] Save a corrected release checkpoint for the authentication fix.
