import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const watchlists = mysqlTable("watchlists", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), name: varchar("name", { length: 120 }).notNull(), columns: text("columns").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() });
export const watchlistItems = mysqlTable("watchlistItems", { id: int("id").autoincrement().primaryKey(), watchlistId: int("watchlistId").notNull(), symbol: varchar("symbol", { length: 16 }).notNull(), sortOrder: int("sortOrder").notNull().default(0), alertsMuted: int("alertsMuted").notNull().default(0), createdAt: timestamp("createdAt").defaultNow().notNull() });
export const scannerPresets = mysqlTable("scannerPresets", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), name: varchar("name", { length: 120 }).notNull(), scanner: varchar("scanner", { length: 80 }).notNull(), thresholds: text("thresholds").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() });
export const alertRules = mysqlTable("alertRules", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), name: varchar("name", { length: 120 }).notNull(), symbol: varchar("symbol", { length: 16 }), condition: text("condition").notNull(), enabled: int("enabled").notNull().default(1), createdAt: timestamp("createdAt").defaultNow().notNull() });
export const workspaceLayouts = mysqlTable("workspaceLayouts", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), name: varchar("name", { length: 120 }).notNull(), layout: text("layout").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() });
export const replaySessions = mysqlTable("replaySessions", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), symbol: varchar("symbol", { length: 16 }).notNull(), startAt: timestamp("startAt").notNull(), endAt: timestamp("endAt").notNull(), speed: decimal("speed", { precision: 8, scale: 2 }).notNull().default("1"), status: mysqlEnum("status", ["created", "running", "paused", "completed"]).notNull().default("created"), createdAt: timestamp("createdAt").defaultNow().notNull() });
export const backtestRuns = mysqlTable("backtestRuns", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), name: varchar("name", { length: 120 }).notNull(), strategy: text("strategy").notNull(), metrics: text("metrics").notNull(), status: mysqlEnum("status", ["queued", "running", "completed", "failed"]).notNull().default("queued"), createdAt: timestamp("createdAt").defaultNow().notNull() });
export const paperOrders = mysqlTable("paperOrders", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), symbol: varchar("symbol", { length: 16 }).notNull(), side: mysqlEnum("side", ["buy", "sell"]).notNull(), quantity: decimal("quantity", { precision: 18, scale: 4 }).notNull(), orderType: mysqlEnum("orderType", ["market", "limit"]).notNull().default("market"), limitPrice: decimal("limitPrice", { precision: 18, scale: 4 }), fillPrice: decimal("fillPrice", { precision: 18, scale: 4 }), status: mysqlEnum("status", ["submitted", "filled", "cancelled"]).notNull().default("submitted"), createdAt: timestamp("createdAt").defaultNow().notNull() });

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
