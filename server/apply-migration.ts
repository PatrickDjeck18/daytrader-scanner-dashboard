import { Pool } from "pg";
import { lookup } from "node:dns/promises";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const connectionString = process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("No database connection string found in environment.");
    return;
  }

  console.log("Connecting to PostgreSQL...");
  const parsed = new URL(connectionString);
  const resolved = await lookup(parsed.hostname, { family: 4 });
  const pool = new Pool({ connectionString, host: resolved.address, ssl: { rejectUnauthorized: false } });

  console.log("Adding tradingMode column to paperBotConfigs...");
  await pool.query(`ALTER TABLE "paperBotConfigs" ADD COLUMN IF NOT EXISTS "tradingMode" varchar(16) DEFAULT 'paper' NOT NULL;`);

  console.log("Creating binanceLiveOrders table if not exists...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "binanceLiveOrders" (
      "id" serial PRIMARY KEY NOT NULL,
      "userId" integer NOT NULL,
      "orderId" varchar(64) NOT NULL,
      "clientOrderId" varchar(96),
      "symbol" varchar(24) NOT NULL,
      "side" "order_side" NOT NULL,
      "orderType" varchar(24) DEFAULT 'MARKET' NOT NULL,
      "quantity" numeric(22, 8) NOT NULL,
      "fillPrice" numeric(22, 8) NOT NULL,
      "cummulativeQuoteQty" numeric(22, 8),
      "status" varchar(32) DEFAULT 'FILLED' NOT NULL,
      "source" varchar(32) DEFAULT 'deepseek-live-bot' NOT NULL,
      "rawResponse" text,
      "createdAt" timestamp DEFAULT now() NOT NULL
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS "binanceLiveOrders_userId_idx" ON "binanceLiveOrders" ("userId");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "binanceLiveOrders_symbol_idx" ON "binanceLiveOrders" ("symbol");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "binanceLiveOrders_orderId_idx" ON "binanceLiveOrders" ("orderId");`);

  console.log("Updating existing paper accounts to $50 initial capital...");
  await pool.query(`UPDATE "binancePaperAccounts" SET "initialCapital" = '50.00', "dailyStartEquity" = '50.00';`);

  console.log("Migration executed successfully!");
  await pool.end();
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
