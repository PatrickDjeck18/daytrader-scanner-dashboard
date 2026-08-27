ALTER TABLE "paperBotConfigs" ADD COLUMN IF NOT EXISTS "tradingMode" varchar(16) DEFAULT 'paper' NOT NULL;--> statement-breakpoint
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
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "binanceLiveOrders_userId_idx" ON "binanceLiveOrders" ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "binanceLiveOrders_symbol_idx" ON "binanceLiveOrders" ("symbol");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "binanceLiveOrders_orderId_idx" ON "binanceLiveOrders" ("orderId");
