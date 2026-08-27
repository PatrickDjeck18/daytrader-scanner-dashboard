-- Supabase Auth ownership policies for the application tables.
-- The server-side Drizzle connection also enforces ownership in its queries.

alter table public.users enable row level security;
alter table public.watchlists enable row level security;
alter table public.watchlistItems enable row level security;
alter table public.scannerPresets enable row level security;
alter table public.alertRules enable row level security;
alter table public.workspaceLayouts enable row level security;
alter table public.replaySessions enable row level security;
alter table public.backtestRuns enable row level security;
alter table public.paperOrders enable row level security;
alter table public.auditEvents enable row level security;

drop policy if exists "auth_users_select_own" on public.users;
drop policy if exists "auth_users_update_own" on public.users;
create policy "auth_users_select_own" on public.users for select to authenticated using ("openId" = auth.uid()::text);
create policy "auth_users_update_own" on public.users for update to authenticated using ("openId" = auth.uid()::text) with check ("openId" = auth.uid()::text);

drop policy if exists "auth_watchlists_own" on public.watchlists;
create policy "auth_watchlists_own" on public.watchlists for all to authenticated using ("userId" = (select id from public.users where "openId" = auth.uid()::text)) with check ("userId" = (select id from public.users where "openId" = auth.uid()::text));

drop policy if exists "auth_watchlist_items_own" on public.watchlistItems;
create policy "auth_watchlist_items_own" on public.watchlistItems for all to authenticated using (exists (select 1 from public.watchlists where public.watchlists.id = "watchlistItems"."watchlistId" and public.watchlists."userId" = (select id from public.users where "openId" = auth.uid()::text))) with check (exists (select 1 from public.watchlists where public.watchlists.id = "watchlistItems"."watchlistId" and public.watchlists."userId" = (select id from public.users where "openId" = auth.uid()::text)));

drop policy if exists "auth_scanner_presets_own" on public.scannerPresets;
create policy "auth_scanner_presets_own" on public.scannerPresets for all to authenticated using ("userId" = (select id from public.users where "openId" = auth.uid()::text)) with check ("userId" = (select id from public.users where "openId" = auth.uid()::text));

drop policy if exists "auth_alert_rules_own" on public.alertRules;
create policy "auth_alert_rules_own" on public.alertRules for all to authenticated using ("userId" = (select id from public.users where "openId" = auth.uid()::text)) with check ("userId" = (select id from public.users where "openId" = auth.uid()::text));

drop policy if exists "auth_workspace_layouts_own" on public.workspaceLayouts;
create policy "auth_workspace_layouts_own" on public.workspaceLayouts for all to authenticated using ("userId" = (select id from public.users where "openId" = auth.uid()::text)) with check ("userId" = (select id from public.users where "openId" = auth.uid()::text));

drop policy if exists "auth_replay_sessions_own" on public.replaySessions;
create policy "auth_replay_sessions_own" on public.replaySessions for all to authenticated using ("userId" = (select id from public.users where "openId" = auth.uid()::text)) with check ("userId" = (select id from public.users where "openId" = auth.uid()::text));

drop policy if exists "auth_backtest_runs_own" on public.backtestRuns;
create policy "auth_backtest_runs_own" on public.backtestRuns for all to authenticated using ("userId" = (select id from public.users where "openId" = auth.uid()::text)) with check ("userId" = (select id from public.users where "openId" = auth.uid()::text));

drop policy if exists "auth_paper_orders_own" on public.paperOrders;
create policy "auth_paper_orders_own" on public.paperOrders for all to authenticated using ("userId" = (select id from public.users where "openId" = auth.uid()::text)) with check ("userId" = (select id from public.users where "openId" = auth.uid()::text));

drop policy if exists "auth_audit_events_own" on public.auditEvents;
create policy "auth_audit_events_own" on public.auditEvents for all to authenticated using ("userId" = (select id from public.users where "openId" = auth.uid()::text)) with check ("userId" = (select id from public.users where "openId" = auth.uid()::text));
