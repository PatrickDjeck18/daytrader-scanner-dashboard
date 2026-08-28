import { index, integer, numeric, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "admin"]);
export const replayStatus = pgEnum("replay_status", ["created", "running", "paused", "completed"]);
export const backtestStatus = pgEnum("backtest_status", ["queued", "running", "completed", "failed"]);
export const orderSide = pgEnum("order_side", ["buy", "sell"]);
export const orderType = pgEnum("order_type", ["market", "limit"]);
export const orderStatus = pgEnum("order_status", ["submitted", "filled", "cancelled"]);
export const providerStatus = pgEnum("provider_status", ["healthy", "degraded", "offline"]);
export const paperBotRunStatus = pgEnum("paper_bot_run_status", ["started", "hold", "ordered", "risk_blocked", "error"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRole("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: false }).defaultNow().notNull(),
});

export const watchlists = pgTable("watchlists", {
  id: serial("id").primaryKey(), userId: integer("userId").notNull(), name: varchar("name", { length: 120 }).notNull(), columns: text("columns").notNull(), createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(), updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
}, table => ({ userIdIdx: index("watchlists_userId_idx").on(table.userId) }));
export const watchlistItems = pgTable("watchlistItems", {
  id: serial("id").primaryKey(), watchlistId: integer("watchlistId").notNull(), symbol: varchar("symbol", { length: 16 }).notNull(), name: varchar("name", { length: 120 }), sortOrder: integer("sortOrder").notNull().default(0), alertsMuted: integer("alertsMuted").notNull().default(0), createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
}, table => ({ watchlistIdIdx: index("watchlistItems_watchlistId_idx").on(table.watchlistId) }));
export const scannerPresets = pgTable("scannerPresets", {
  id: serial("id").primaryKey(), userId: integer("userId").notNull(), name: varchar("name", { length: 120 }).notNull(), scanner: varchar("scanner", { length: 80 }).notNull(), thresholds: text("thresholds").notNull(), createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(), updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
});
export const alertRules = pgTable("alertRules", {
  id: serial("id").primaryKey(), userId: integer("userId").notNull(), name: varchar("name", { length: 120 }).notNull(), symbol: varchar("symbol", { length: 16 }), condition: text("condition").notNull(), enabled: integer("enabled").notNull().default(1), createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
});
export const workspaceLayouts = pgTable("workspaceLayouts", {
  id: serial("id").primaryKey(), userId: integer("userId").notNull(), name: varchar("name", { length: 120 }).notNull(), layout: text("layout").notNull(), createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(), updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
});
export const replaySessions = pgTable("replaySessions", {
  id: serial("id").primaryKey(), userId: integer("userId").notNull(), symbol: varchar("symbol", { length: 16 }).notNull(), startAt: timestamp("startAt", { withTimezone: false }).notNull(), endAt: timestamp("endAt", { withTimezone: false }).notNull(), speed: numeric("speed", { precision: 8, scale: 2 }).notNull().default("1"), status: replayStatus("status").notNull().default("created"), createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
});
export const backtestRuns = pgTable("backtestRuns", {
  id: serial("id").primaryKey(), userId: integer("userId").notNull(), name: varchar("name", { length: 120 }).notNull(), strategy: text("strategy").notNull(), metrics: text("metrics").notNull(), status: backtestStatus("status").notNull().default("queued"), createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
}, table => ({ userIdIdx: index("backtestRuns_userId_idx").on(table.userId) }));
export const paperOrders = pgTable("paperOrders", {
  id: serial("id").primaryKey(), userId: integer("userId").notNull(), idempotencyKey: varchar("idempotencyKey", { length: 80 }).unique(), symbol: varchar("symbol", { length: 16 }).notNull(), side: orderSide("side").notNull(), quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull(), orderType: orderType("orderType").notNull().default("market"), limitPrice: numeric("limitPrice", { precision: 18, scale: 4 }), fillPrice: numeric("fillPrice", { precision: 18, scale: 4 }), status: orderStatus("status").notNull().default("submitted"), createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
}, table => ({ userIdIdx: index("paperOrders_userId_idx").on(table.userId), symbolIdx: index("paperOrders_symbol_idx").on(table.symbol) }));
export const binancePaperAccounts = pgTable("binancePaperAccounts", {
  id: serial("id").primaryKey(), userId: integer("userId").notNull().unique(), initialCapital: numeric("initialCapital", { precision: 18, scale: 2 }).notNull().default("10000.00"), currency: varchar("currency", { length: 12 }).notNull().default("USDT"), dailyAnchor: varchar("dailyAnchor", { length: 10 }).notNull().default("1970-01-01"), dailyStartEquity: numeric("dailyStartEquity", { precision: 18, scale: 2 }).notNull().default("10000.00"), createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(), updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
}, table => ({ userIdIdx: index("binancePaperAccounts_userId_idx").on(table.userId) }));
export const binancePaperOrders = pgTable("binancePaperOrders", {
  id: serial("id").primaryKey(), userId: integer("userId").notNull(), accountId: integer("accountId").notNull(), market: varchar("market", { length: 32 }).notNull().default("global-spot"), symbol: varchar("symbol", { length: 24 }).notNull(), side: orderSide("side").notNull(), quantity: numeric("quantity", { precision: 22, scale: 8 }).notNull(), fillPrice: numeric("fillPrice", { precision: 22, scale: 8 }).notNull(), stopPrice: numeric("stopPrice", { precision: 22, scale: 8 }), targetPrice: numeric("targetPrice", { precision: 22, scale: 8 }), idempotencyKey: varchar("idempotencyKey", { length: 96 }).notNull().unique(), source: varchar("source", { length: 32 }).notNull().default("paper-bot"), createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
}, table => ({ userIdIdx: index("binancePaperOrders_userId_idx").on(table.userId), accountIdIdx: index("binancePaperOrders_accountId_idx").on(table.accountId), symbolIdx: index("binancePaperOrders_symbol_idx").on(table.symbol) }));
export const binanceLiveAccounts = pgTable("binanceLiveAccounts", {
  id: serial("id").primaryKey(), userId: integer("userId").notNull().unique(), apiKeyEncrypted: text("apiKeyEncrypted").notNull(), apiSecretEncrypted: text("apiSecretEncrypted").notNull(), accountType: varchar("accountType", { length: 32 }).notNull().default("spot"), isTestnet: integer("isTestnet").notNull().default(0), dailyAnchor: varchar("dailyAnchor", { length: 10 }).notNull().default("1970-01-01"), dailyStartEquity: numeric("dailyStartEquity", { precision: 18, scale: 2 }).default("0"), lastSyncAt: timestamp("lastSyncAt", { withTimezone: false }), createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(), updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
}, table => ({ userIdIdx: index("binanceLiveAccounts_userId_idx").on(table.userId) }));
export const binanceLiveOrders = pgTable("binanceLiveOrders", {
  id: serial("id").primaryKey(), userId: integer("userId").notNull(), accountId: integer("accountId").notNull(), market: varchar("market", { length: 32 }).notNull().default("global-spot"), symbol: varchar("symbol", { length: 24 }).notNull(), side: orderSide("side").notNull(), quantity: numeric("quantity", { precision: 22, scale: 8 }).notNull(), fillPrice: numeric("fillPrice", { precision: 22, scale: 8 }), stopPrice: numeric("stopPrice", { precision: 22, scale: 8 }), targetPrice: numeric("targetPrice", { precision: 22, scale: 8 }), binanceOrderId: varchar("binanceOrderId", { length: 64 }), idempotencyKey: varchar("idempotencyKey", { length: 96 }).notNull().unique(), source: varchar("source", { length: 32 }).notNull().default("live-bot"), status: varchar("status", { length: 32 }).notNull().default("submitted"), createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(), filledAt: timestamp("filledAt", { withTimezone: false }),
}, table => ({ userIdIdx: index("binanceLiveOrders_userId_idx").on(table.userId), accountIdIdx: index("binanceLiveOrders_accountId_idx").on(table.accountId), symbolIdx: index("binanceLiveOrders_symbol_idx").on(table.symbol) }));
export const paperBotConfigs = pgTable("paperBotConfigs", {
  id: serial("id").primaryKey(), userId: integer("userId").notNull().unique(), market: varchar("market", { length: 32 }).notNull().default("global-spot"), symbols: text("symbols").notNull().default("[\"BTCUSDT\",\"ETHUSDT\",\"SOLUSDT\"]"), strategy: varchar("strategy", { length: 32 }).notNull().default("scalp_momentum"), scheduleMinutes: integer("scheduleMinutes").notNull().default(5), riskPct: numeric("riskPct", { precision: 6, scale: 3 }).notNull().default("1.000"), dailyLossStopPct: numeric("dailyLossStopPct", { precision: 6, scale: 3 }).notNull().default("3.000"), maxOpenPositions: integer("maxOpenPositions").notNull().default(3), confidenceThreshold: numeric("confidenceThreshold", { precision: 4, scale: 2 }).notNull().default("0.60"), stopLossPct: numeric("stopLossPct", { precision: 5, scale: 3 }).notNull().default("0.500"), takeProfitRatio: numeric("takeProfitRatio", { precision: 4, scale: 2 }).notNull().default("1.50"), momentumThreshold: numeric("momentumThreshold", { precision: 5, scale: 3 }).notNull().default("0.040"), rangeUpperBound: numeric("rangeUpperBound", { precision: 5, scale: 3 }).notNull().default("0.700"), rangeLowerBound: numeric("rangeLowerBound", { precision: 5, scale: 3 }).notNull().default("0.400"), enabled: integer("enabled").notNull().default(0), scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }), lastRunAt: timestamp("lastRunAt", { withTimezone: false }), lastRunStatus: varchar("lastRunStatus", { length: 32 }), lastRunError: text("lastRunError"), createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(), updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
}, table => ({ userIdIdx: index("paperBotConfigs_userId_idx").on(table.userId), taskIdx: index("paperBotConfigs_task_idx").on(table.scheduleCronTaskUid) }));
export const paperBotScheduleTasks = pgTable("paperBotScheduleTasks", {
  id: serial("id").primaryKey(), intervalMinutes: integer("intervalMinutes").notNull().unique(), taskUid: varchar("taskUid", { length: 65 }).notNull().unique(), createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(), updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
}, table => ({ intervalIdx: index("paperBotScheduleTasks_interval_idx").on(table.intervalMinutes) }));
export const paperBotRuns = pgTable("paperBotRuns", {
  id: serial("id").primaryKey(), userId: integer("userId").notNull(), configId: integer("configId").notNull(), runKey: varchar("runKey", { length: 96 }).notNull().unique(), status: paperBotRunStatus("status").notNull().default("started"), decision: text("decision"), marketContext: text("marketContext"), error: text("error"), createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(), completedAt: timestamp("completedAt", { withTimezone: false }),
}, table => ({ userIdIdx: index("paperBotRuns_userId_idx").on(table.userId), configIdIdx: index("paperBotRuns_configId_idx").on(table.configId) }));
export const auditEvents = pgTable("auditEvents", {
  id: serial("id").primaryKey(), userId: integer("userId"), action: varchar("action", { length: 80 }).notNull(), resource: varchar("resource", { length: 120 }).notNull(), metadata: text("metadata").notNull(), requestId: varchar("requestId", { length: 80 }), createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
});
export const providerHealth = pgTable("providerHealth", {
  id: serial("id").primaryKey(), provider: varchar("provider", { length: 40 }).notNull().unique(), status: providerStatus("status").notNull().default("offline"), lastSuccessAt: timestamp("lastSuccessAt", { withTimezone: false }), lastFailureAt: timestamp("lastFailureAt", { withTimezone: false }), lastError: text("lastError"), latencyMs: integer("latencyMs"), updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type BinanceLiveAccount = typeof binanceLiveAccounts.$inferSelect;
export type InsertBinanceLiveAccount = typeof binanceLiveAccounts.$inferInsert;
export type BinanceLiveOrder = typeof binanceLiveOrders.$inferSelect;
export type InsertBinanceLiveOrder = typeof binanceLiveOrders.$inferInsert;
