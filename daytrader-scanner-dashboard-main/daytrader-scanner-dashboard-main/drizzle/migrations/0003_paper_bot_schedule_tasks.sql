-- Server-only registry for the three project-owned Heartbeat cadences.
-- End users enable or pause only their own configuration; no user-owned cron is created from a Supabase session.
create table public."paperBotScheduleTasks" (
  id serial primary key,
  "intervalMinutes" integer not null unique check ("intervalMinutes" in (1, 5, 15)),
  "taskUid" varchar(65) not null unique,
  "createdAt" timestamp not null default now(),
  "updatedAt" timestamp not null default now()
);
create index "paperBotScheduleTasks_interval_idx" on public."paperBotScheduleTasks" ("intervalMinutes");
alter table public."paperBotScheduleTasks" enable row level security;
