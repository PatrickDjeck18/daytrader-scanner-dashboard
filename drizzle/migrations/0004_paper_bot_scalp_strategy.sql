-- Persist the only permitted DeepSeek paper-bot strategy. This does not create any live-trading capability.
alter table public."paperBotConfigs" add column if not exists strategy varchar(32) not null default 'scalp_momentum';
