import pg from "pg";

const connectionString = process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("SUPABASE_DATABASE_URL is required");

const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });
const statements = [
  `CREATE TABLE IF NOT EXISTS "binancePaperAccounts" ("id" serial PRIMARY KEY NOT NULL, "userId" integer NOT NULL UNIQUE, "initialCapital" numeric(18,2) NOT NULL DEFAULT '50.00', "currency" varchar(12) NOT NULL DEFAULT 'USDT', "dailyAnchor" varchar(10) NOT NULL DEFAULT '1970-01-01', "dailyStartEquity" numeric(18,2) NOT NULL DEFAULT '50.00', "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS "binancePaperOrders" ("id" serial PRIMARY KEY NOT NULL, "userId" integer NOT NULL, "accountId" integer NOT NULL, "market" varchar(32) NOT NULL DEFAULT 'global-spot', "symbol" varchar(24) NOT NULL, "side" varchar(8) NOT NULL, "quantity" numeric(22,8) NOT NULL, "fillPrice" numeric(22,8) NOT NULL, "stopPrice" numeric(22,8), "targetPrice" numeric(22,8), "idempotencyKey" varchar(96) NOT NULL UNIQUE, "source" varchar(32) NOT NULL DEFAULT 'paper-bot', "createdAt" timestamp NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS "paperBotConfigs" ("id" serial PRIMARY KEY NOT NULL, "userId" integer NOT NULL UNIQUE, "market" varchar(32) NOT NULL DEFAULT 'global-spot', "symbols" text NOT NULL DEFAULT '["BTCUSDT","ETHUSDT","SOLUSDT"]', "strategy" varchar(32) NOT NULL DEFAULT 'scalp_momentum', "scheduleMinutes" integer NOT NULL DEFAULT 5, "riskPct" numeric(6,3) NOT NULL DEFAULT '1.000', "dailyLossStopPct" numeric(6,3) NOT NULL DEFAULT '3.000', "maxOpenPositions" integer NOT NULL DEFAULT 3, "enabled" integer NOT NULL DEFAULT 0, "tradingMode" varchar(16) NOT NULL DEFAULT 'paper', "scheduleCronTaskUid" varchar(65), "lastRunAt" timestamp, "lastRunStatus" varchar(32), "lastRunError" text, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS "paperBotScheduleTasks" ("id" serial PRIMARY KEY NOT NULL, "intervalMinutes" integer NOT NULL UNIQUE, "taskUid" varchar(65) NOT NULL UNIQUE, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS "paperBotRuns" ("id" serial PRIMARY KEY NOT NULL, "userId" integer NOT NULL, "configId" integer NOT NULL, "runKey" varchar(96) NOT NULL UNIQUE, "status" varchar(24) NOT NULL DEFAULT 'started', "decision" text, "marketContext" text, "error" text, "createdAt" timestamp NOT NULL DEFAULT now(), "completedAt" timestamp)`,
  `CREATE TABLE IF NOT EXISTS "auditEvents" ("id" serial PRIMARY KEY NOT NULL, "userId" integer, "action" varchar(80) NOT NULL, "resource" varchar(120) NOT NULL, "metadata" text NOT NULL, "requestId" varchar(80), "createdAt" timestamp NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS "providerHealth" ("id" serial PRIMARY KEY NOT NULL, "provider" varchar(40) NOT NULL UNIQUE, "status" varchar(16) NOT NULL DEFAULT 'offline', "lastSuccessAt" timestamp, "lastFailureAt" timestamp, "lastError" text, "latencyMs" integer, "updatedAt" timestamp NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS "binancePaperOrders_userId_idx" ON "binancePaperOrders" ("userId")`,
  `CREATE INDEX IF NOT EXISTS "binancePaperOrders_symbol_idx" ON "binancePaperOrders" ("symbol")`,
  `CREATE INDEX IF NOT EXISTS "paperBotRuns_userId_idx" ON "paperBotRuns" ("userId")`,
];

try {
  for (const statement of statements) await pool.query(statement);
  const result = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name IN ('binancePaperAccounts','binancePaperOrders','paperBotConfigs','paperBotRuns') ORDER BY table_name`);
  console.log(JSON.stringify({ created: result.rows.map(row => row.table_name) }));
} finally {
  await pool.end();
}
