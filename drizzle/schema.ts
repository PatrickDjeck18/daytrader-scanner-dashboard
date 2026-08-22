import { index, integer, numeric, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "admin"]);
export const replayStatus = pgEnum("replay_status", ["created", "running", "paused", "completed"]);
export const backtestStatus = pgEnum("backtest_status", ["queued", "running", "completed", "failed"]);
export const orderSide = pgEnum("order_side", ["buy", "sell"]);
export const orderType = pgEnum("order_type", ["market", "limit"]);
export const orderStatus = pgEnum("order_status", ["submitted", "filled", "cancelled"]);
export const providerStatus = pgEnum("provider_status", ["healthy", "degraded", "offline"]);

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
  id: serial("id").primaryKey(), watchlistId: integer("watchlistId").notNull(), symbol: varchar("symbol", { length: 16 }).notNull(), sortOrder: integer("sortOrder").notNull().default(0), alertsMuted: integer("alertsMuted").notNull().default(0), createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
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
export const auditEvents = pgTable("auditEvents", {
  id: serial("id").primaryKey(), userId: integer("userId"), action: varchar("action", { length: 80 }).notNull(), resource: varchar("resource", { length: 120 }).notNull(), metadata: text("metadata").notNull(), requestId: varchar("requestId", { length: 80 }), createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
});
export const providerHealth = pgTable("providerHealth", {
  id: serial("id").primaryKey(), provider: varchar("provider", { length: 40 }).notNull().unique(), status: providerStatus("status").notNull().default("offline"), lastSuccessAt: timestamp("lastSuccessAt", { withTimezone: false }), lastFailureAt: timestamp("lastFailureAt", { withTimezone: false }), lastError: text("lastError"), latencyMs: integer("latencyMs"), updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
