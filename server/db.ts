import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { lookup } from "node:dns/promises";
import { Pool } from "pg";
import { InsertUser, users, watchlists, watchlistItems, scannerPresets, alertRules, workspaceLayouts, paperOrders, backtestRuns, auditEvents, providerHealth, binancePaperAccounts, binancePaperOrders, binanceLiveOrders, paperBotConfigs, paperBotRuns, paperBotScheduleTasks } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;
let _schemaInitialized = false;

async function ensureSchema(pool: Pool) {
  if (_schemaInitialized) return;
  try {
    await pool.query(`
      ALTER TABLE "paperBotConfigs" ADD COLUMN IF NOT EXISTS "tradingMode" varchar(16) DEFAULT 'paper' NOT NULL;
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
      CREATE INDEX IF NOT EXISTS "binanceLiveOrders_userId_idx" ON "binanceLiveOrders" ("userId");
      CREATE INDEX IF NOT EXISTS "binanceLiveOrders_symbol_idx" ON "binanceLiveOrders" ("symbol");
      CREATE INDEX IF NOT EXISTS "binanceLiveOrders_orderId_idx" ON "binanceLiveOrders" ("orderId");
    `);
    _schemaInitialized = true;
  } catch (err) {
    console.warn("[Database] Schema bootstrap check note:", err instanceof Error ? err.message : err);
  }
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  const connectionString = process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!_db && connectionString) {
    try {
      const parsed = new URL(connectionString);
      const resolved = await lookup(parsed.hostname, { family: 4 });
      _pool = new Pool({ connectionString, host: resolved.address, ssl: { rejectUnauthorized: false } });
      await ensureSchema(_pool);
      _db = drizzle({ client: _pool });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  } else if (_pool && !_schemaInitialized) {
    await ensureSchema(_pool);
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertSupabaseAuthUser(input: { authId: string; email?: string | null; name?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existingById = await db.select().from(users).where(eq(users.openId, input.authId)).limit(1);
  if (existingById[0]) {
    await db.update(users).set({ email: input.email ?? existingById[0].email, name: input.name ?? existingById[0].name, loginMethod: "supabase", lastSignedIn: new Date() }).where(eq(users.id, existingById[0].id));
    return { ...existingById[0], email: input.email ?? existingById[0].email, name: input.name ?? existingById[0].name, loginMethod: "supabase", lastSignedIn: new Date() };
  }
  const existingByEmail = input.email ? await db.select().from(users).where(eq(users.email, input.email)).limit(1) : [];
  if (existingByEmail[0]) {
    const email = input.email ?? existingByEmail[0].email;
    await db.update(users).set({ openId: input.authId, email, name: input.name ?? existingByEmail[0].name, loginMethod: "supabase", lastSignedIn: new Date() }).where(eq(users.id, existingByEmail[0].id));
    return { ...existingByEmail[0], openId: input.authId, email, name: input.name ?? existingByEmail[0].name, loginMethod: "supabase", lastSignedIn: new Date() };
  }
  await db.insert(users).values({ openId: input.authId, email: input.email ?? null, name: input.name ?? null, loginMethod: "supabase", lastSignedIn: new Date() });
  const created = await getUserByOpenId(input.authId);
  if (!created) throw new Error("Supabase user record could not be created");
  return created;
}

export async function deleteWatchlist(userId: number, id: number) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.delete(watchlists).where(and(eq(watchlists.id, id), eq(watchlists.userId, userId))); return true; }
export async function listWatchlistItems(userId: number, watchlistId: number) { const db = await getDb(); if (!db) return []; const owned = await db.select({ id: watchlists.id }).from(watchlists).where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId))); if (!owned.length) throw new Error("Watchlist not found"); return db.select().from(watchlistItems).where(eq(watchlistItems.watchlistId, watchlistId)); }
export async function addWatchlistItem(userId: number, watchlistId: number, symbol: string) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const owned = await db.select({ id: watchlists.id }).from(watchlists).where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId))); if (!owned.length) throw new Error("Watchlist not found"); await db.insert(watchlistItems).values({ watchlistId, symbol, sortOrder: 0 }); return true; }
export async function deleteWatchlistItem(userId: number, id: number) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const rows = await db.select({ itemId: watchlistItems.id }).from(watchlistItems).innerJoin(watchlists, eq(watchlists.id, watchlistItems.watchlistId)).where(and(eq(watchlistItems.id, id), eq(watchlists.userId, userId))); if (rows.length) await db.delete(watchlistItems).where(eq(watchlistItems.id, id)); return true; }
export async function listWatchlists(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(watchlists).where(eq(watchlists.userId, userId)); }
export async function createWatchlist(userId: number, name: string, columns: string[]) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(watchlists).values({ userId, name, columns: JSON.stringify(columns) }); return true; }
export async function deletePreset(userId: number, id: number) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.delete(scannerPresets).where(and(eq(scannerPresets.id, id), eq(scannerPresets.userId, userId))); return true; }
export async function listPresets(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(scannerPresets).where(eq(scannerPresets.userId, userId)); }
export async function savePreset(userId: number, name: string, scanner: string, thresholds: unknown) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(scannerPresets).values({ userId, name, scanner, thresholds: JSON.stringify(thresholds) }); return true; }
export async function deleteLayout(userId: number, id: number) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.delete(workspaceLayouts).where(and(eq(workspaceLayouts.id, id), eq(workspaceLayouts.userId, userId))); return true; }
export async function listLayouts(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(workspaceLayouts).where(eq(workspaceLayouts.userId, userId)); }
export async function saveLayout(userId: number, name: string, layout: unknown) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const serialized = JSON.stringify(layout); const existing = await db.select({ id: workspaceLayouts.id }).from(workspaceLayouts).where(and(eq(workspaceLayouts.userId, userId), eq(workspaceLayouts.name, name))).limit(1); if (existing[0]) { await db.update(workspaceLayouts).set({ layout: serialized }).where(and(eq(workspaceLayouts.id, existing[0].id), eq(workspaceLayouts.userId, userId))); return true; } await db.insert(workspaceLayouts).values({ userId, name, layout: serialized }); return true; }
export async function deleteAlertRule(userId: number, id: number) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.delete(alertRules).where(and(eq(alertRules.id, id), eq(alertRules.userId, userId))); return true; }
export async function listAlertRules(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(alertRules).where(eq(alertRules.userId, userId)); }
export async function createAlertRule(userId: number, name: string, symbol: string | undefined, condition: unknown) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(alertRules).values({ userId, name, symbol, condition: JSON.stringify(condition) }); return true; }
export function simulatePaperFill(input: { side: "buy" | "sell"; orderType: "market" | "limit"; limitPrice?: string; markPrice?: number }) { const mark = input.markPrice && Number.isFinite(input.markPrice) && input.markPrice > 0 ? input.markPrice : undefined; const limit = input.limitPrice ? Number(input.limitPrice) : undefined; const filled = input.orderType === "market" ? Boolean(mark) : Boolean(mark && limit && (input.side === "buy" ? mark <= limit : mark >= limit)); return { status: filled ? "filled" as const : "submitted" as const, fillPrice: filled ? mark : undefined }; }
export async function createPaperOrder(userId: number, input: { idempotencyKey: string; symbol: string; side: "buy" | "sell"; quantity: string; orderType: "market" | "limit"; limitPrice?: string; markPrice?: number }) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const existing = await db.select().from(paperOrders).where(and(eq(paperOrders.userId, userId), eq(paperOrders.idempotencyKey, input.idempotencyKey))).limit(1); if (existing[0]) return existing[0]; const fill = simulatePaperFill(input); const fillPrice = fill.fillPrice === undefined ? undefined : String(fill.fillPrice); const status = fill.status; await db.insert(paperOrders).values({ userId, idempotencyKey: input.idempotencyKey, symbol: input.symbol, side: input.side, quantity: input.quantity, orderType: input.orderType, limitPrice: input.limitPrice, fillPrice, status }); const created = await db.select().from(paperOrders).where(and(eq(paperOrders.userId, userId), eq(paperOrders.idempotencyKey, input.idempotencyKey))).limit(1); return created[0] ?? true; }
export async function listPaperOrders(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(paperOrders).where(eq(paperOrders.userId, userId)); }
export async function recordAuditEvent(input: { userId?: number; action: string; resource: string; metadata?: Record<string, unknown>; requestId?: string }) { const db = await getDb(); if (!db) return false; await db.insert(auditEvents).values({ userId: input.userId, action: input.action, resource: input.resource, metadata: JSON.stringify(input.metadata ?? {}), requestId: input.requestId }); return true; }
export async function updateProviderHealth(input: { provider: string; status: "healthy" | "degraded" | "offline"; latencyMs?: number; error?: string }) { const db = await getDb(); if (!db) return false; const now = new Date(); await db.insert(providerHealth).values({ provider: input.provider, status: input.status, latencyMs: input.latencyMs, lastSuccessAt: input.status === "healthy" ? now : undefined, lastFailureAt: input.status === "healthy" ? undefined : now, lastError: input.error }).onConflictDoUpdate({ target: providerHealth.provider, set: { status: input.status, latencyMs: input.latencyMs, lastSuccessAt: input.status === "healthy" ? now : undefined, lastFailureAt: input.status === "healthy" ? undefined : now, lastError: input.error } }); return true; }
export async function getProviderHealth(provider: string) { const db = await getDb(); if (!db) return undefined; const rows = await db.select().from(providerHealth).where(eq(providerHealth.provider, provider)).limit(1); return rows[0]; }
export function calculatePaperPnl(orders: Array<{ symbol: string; side: "buy" | "sell"; quantity: string | number; fillPrice: string | number | null; status?: "submitted" | "filled" | "cancelled" }>, prices: Record<string, number> = {}) { const state = new Map<string, { quantity: number; averageCost: number }>(); let realizedPnl = 0; for (const order of orders) { if (order.status && order.status !== "filled") continue; const quantity = Number(order.quantity); const price = Number(order.fillPrice ?? 0); const current = state.get(order.symbol) ?? { quantity: 0, averageCost: 0 }; if (order.side === "buy") { const totalCost = current.quantity * current.averageCost + quantity * price; current.quantity += quantity; current.averageCost = current.quantity ? totalCost / current.quantity : 0; } else { const closed = Math.min(quantity, Math.max(0, current.quantity)); realizedPnl += closed * (price - current.averageCost); current.quantity -= quantity; if (current.quantity <= 0) current.averageCost = 0; } state.set(order.symbol, current); } const positions = Array.from(state.entries()).filter(([, position]) => position.quantity !== 0).map(([symbol, position]) => ({ symbol, quantity: position.quantity, averageCost: position.averageCost, marketPrice: prices[symbol] ?? position.averageCost, unrealizedPnl: position.quantity * ((prices[symbol] ?? position.averageCost) - position.averageCost) })); const unrealizedPnl = positions.reduce((sum, position) => sum + position.unrealizedPnl, 0); return { realizedPnl, unrealizedPnl, totalPnl: realizedPnl + unrealizedPnl, positions }; }
export async function paperAccountSummary(userId: number, prices: Record<string, number> = {}) { const orders = await listPaperOrders(userId); const filledOrders = orders.filter(order => order.status === "filled"); const used = filledOrders.reduce((sum, order) => sum + (order.side === "buy" ? 1 : -1) * Number(order.quantity) * Number(order.fillPrice ?? 0), 0); return { mode: "paper" as const, buyingPower: 100000 - Math.max(0, used), usedCapital: used, ...calculatePaperPnl(orders, prices) }; }
export async function listBacktestRuns(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(backtestRuns).where(eq(backtestRuns.userId, userId)); }
export async function createBacktestRun(userId: number, name: string, strategy: unknown, metrics: unknown) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(backtestRuns).values({ userId, name, strategy: JSON.stringify(strategy), metrics: JSON.stringify(metrics), status: "completed" }); return true; }

const DEFAULT_BOT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
const asNumber = (value: string | number | null | undefined) => Number(value ?? 0);
const todayKey = () => new Date().toISOString().slice(0, 10);

export async function ensureBinancePaperAccount(userId: number) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  let account = (await db.select().from(binancePaperAccounts).where(eq(binancePaperAccounts.userId, userId)).limit(1))[0];
  if (!account) { await db.insert(binancePaperAccounts).values({ userId, initialCapital: "50.00", dailyStartEquity: "50.00", dailyAnchor: todayKey() }); account = (await db.select().from(binancePaperAccounts).where(eq(binancePaperAccounts.userId, userId)).limit(1))[0]; }
  if (!account) throw new Error("Binance paper account could not be initialized");
  return account;
}

export function calculateBinancePaperPnl(orders: Array<{ symbol: string; side: "buy" | "sell"; quantity: string | number; fillPrice: string | number }>, prices: Record<string, number> = {}) {
  const state = new Map<string, { quantity: number; averageCost: number }>(); let realizedPnl = 0;
  for (const order of orders) { const quantity = asNumber(order.quantity); const fill = asNumber(order.fillPrice); if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(fill) || fill <= 0) continue; const position = state.get(order.symbol) ?? { quantity: 0, averageCost: 0 }; if (order.side === "buy") { const nextQuantity = position.quantity + quantity; position.averageCost = nextQuantity ? ((position.quantity * position.averageCost) + quantity * fill) / nextQuantity : 0; position.quantity = nextQuantity; } else { const closed = Math.min(position.quantity, quantity); realizedPnl += closed * (fill - position.averageCost); position.quantity -= closed; if (position.quantity <= 0) position.averageCost = 0; } state.set(order.symbol, position); }
  const positions = Array.from(state.entries()).filter(([, item]) => item.quantity > 0).map(([symbol, item]) => { const marketPrice = prices[symbol] ?? item.averageCost; return { symbol, quantity: item.quantity, averageCost: item.averageCost, marketPrice, unrealizedPnl: item.quantity * (marketPrice - item.averageCost) }; });
  const usedCapital = positions.reduce((sum, item) => sum + item.quantity * item.averageCost, 0); const unrealizedPnl = positions.reduce((sum, item) => sum + item.unrealizedPnl, 0);
  return { realizedPnl, unrealizedPnl, usedCapital, positions };
}

export async function listBinancePaperOrders(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(binancePaperOrders).where(eq(binancePaperOrders.userId, userId)).orderBy(desc(binancePaperOrders.id)); }
export async function binancePaperAccountSummary(userId: number, prices: Record<string, number> = {}) {
  const account = await ensureBinancePaperAccount(userId); const orders = await listBinancePaperOrders(userId); const pnl = calculateBinancePaperPnl(orders, prices); const initialCapital = asNumber(account.initialCapital); const equity = initialCapital + pnl.realizedPnl + pnl.unrealizedPnl; const currentDay = todayKey(); let dailyStartEquity = asNumber(account.dailyStartEquity);
  if (account.dailyAnchor !== currentDay) { dailyStartEquity = equity; const db = await getDb(); if (db) await db.update(binancePaperAccounts).set({ dailyAnchor: currentDay, dailyStartEquity: String(equity), updatedAt: new Date() }).where(eq(binancePaperAccounts.id, account.id)); }
  return { mode: "paper" as const, venue: "binance-public-simulation" as const, initialCapital, currency: account.currency, equity, buyingPower: Math.max(0, initialCapital + pnl.realizedPnl - pnl.usedCapital), dailyStartEquity, dailyPnl: equity - dailyStartEquity, ...pnl };
}

export async function createBinancePaperOrder(userId: number, input: { idempotencyKey: string; symbol: string; side: "buy" | "sell"; quantity: number; markPrice: number; stopPrice?: number | null; targetPrice?: number | null; source?: string }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable"); const account = await ensureBinancePaperAccount(userId); const existing = (await db.select().from(binancePaperOrders).where(eq(binancePaperOrders.idempotencyKey, input.idempotencyKey)).limit(1))[0]; if (existing) return existing;
  await db.insert(binancePaperOrders).values({ userId, accountId: account.id, symbol: input.symbol, side: input.side, quantity: String(input.quantity), fillPrice: String(input.markPrice), stopPrice: input.stopPrice ? String(input.stopPrice) : undefined, targetPrice: input.targetPrice ? String(input.targetPrice) : undefined, idempotencyKey: input.idempotencyKey, source: input.source ?? "paper-bot" });
  return (await db.select().from(binancePaperOrders).where(eq(binancePaperOrders.idempotencyKey, input.idempotencyKey)).limit(1))[0];
}

export async function ensurePaperBotConfig(userId: number) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable"); let config = (await db.select().from(paperBotConfigs).where(eq(paperBotConfigs.userId, userId)).limit(1))[0];
  if (!config) { await db.insert(paperBotConfigs).values({ userId, symbols: JSON.stringify(DEFAULT_BOT_SYMBOLS), strategy: "scalp_momentum", scheduleMinutes: 5, riskPct: "1.000", dailyLossStopPct: "3.000", maxOpenPositions: 3, enabled: 0, tradingMode: "paper" }); config = (await db.select().from(paperBotConfigs).where(eq(paperBotConfigs.userId, userId)).limit(1))[0]; }
  if (!config) throw new Error("Paper bot configuration could not be initialized");
  if (config.tradingMode !== "paper") {
    await db.update(paperBotConfigs).set({ tradingMode: "paper", updatedAt: new Date() }).where(eq(paperBotConfigs.id, config.id));
    config = { ...config, tradingMode: "paper" };
  }
  return config;
}

export async function savePaperBotConfig(userId: number, input: { symbols: string[]; strategy: "scalp_momentum" | "fast_momentum" | "range_reversion" | "vwap_pullback" | "bb_squeeze"; scheduleMinutes: number; riskPct: number; dailyLossStopPct: number; maxOpenPositions: number; enabled?: boolean; tradingMode?: "paper" | "live" }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable"); const current = await ensurePaperBotConfig(userId);
  const nextEnabled = input.enabled !== undefined ? (input.enabled ? 1 : 0) : current.enabled;
  await db.update(paperBotConfigs).set({
    symbols: JSON.stringify(input.symbols),
    strategy: input.strategy,
    scheduleMinutes: input.scheduleMinutes,
    riskPct: String(input.riskPct),
    dailyLossStopPct: String(input.dailyLossStopPct),
    maxOpenPositions: input.maxOpenPositions,
    enabled: nextEnabled,
    tradingMode: "paper",
    ...(input.enabled === false ? { scheduleCronTaskUid: null } : {}),
    lastRunStatus: nextEnabled === 1 ? current.lastRunStatus : "settings_saved",
    lastRunError: null,
    updatedAt: new Date()
  }).where(eq(paperBotConfigs.id, current.id));
  return ensurePaperBotConfig(userId);
}
export async function updatePaperBotSchedule(userId: number, input: { enabled: boolean; taskUid?: string | null; status?: string; error?: string | null }) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const current = await ensurePaperBotConfig(userId); await db.update(paperBotConfigs).set({ enabled: input.enabled ? 1 : 0, ...(input.taskUid === undefined ? {} : { scheduleCronTaskUid: input.taskUid }), lastRunStatus: input.status ?? current.lastRunStatus, lastRunError: input.error ?? null, updatedAt: new Date() }).where(eq(paperBotConfigs.id, current.id)); return ensurePaperBotConfig(userId); }
export async function getPaperBotConfigByTaskUid(taskUid: string) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(paperBotConfigs).where(eq(paperBotConfigs.scheduleCronTaskUid, taskUid)).limit(1))[0]; }
export async function listEnabledPaperBotConfigsByTaskUid(taskUid: string) { const db = await getDb(); if (!db) return []; return db.select().from(paperBotConfigs).where(and(eq(paperBotConfigs.scheduleCronTaskUid, taskUid), eq(paperBotConfigs.enabled, 1))); }
export async function getPaperBotScheduleTask(intervalMinutes: number) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); return (await db.select().from(paperBotScheduleTasks).where(eq(paperBotScheduleTasks.intervalMinutes, intervalMinutes)).limit(1))[0]; }
export async function upsertPaperBotScheduleTask(intervalMinutes: number, taskUid: string) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const existing = (await db.select().from(paperBotScheduleTasks).where(eq(paperBotScheduleTasks.intervalMinutes, intervalMinutes)).limit(1))[0]; if (existing) { await db.update(paperBotScheduleTasks).set({ taskUid, updatedAt: new Date() }).where(eq(paperBotScheduleTasks.id, existing.id)); } else { await db.insert(paperBotScheduleTasks).values({ intervalMinutes, taskUid }); } return (await db.select().from(paperBotScheduleTasks).where(eq(paperBotScheduleTasks.intervalMinutes, intervalMinutes)).limit(1))[0]; }
export async function listPaperBotRuns(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(paperBotRuns).where(eq(paperBotRuns.userId, userId)).orderBy(desc(paperBotRuns.id)).limit(200); }
export async function startPaperBotRun(input: { userId: number; configId: number; runKey: string; marketContext: unknown }) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const existing = (await db.select().from(paperBotRuns).where(eq(paperBotRuns.runKey, input.runKey)).limit(1))[0]; if (existing) return { run: existing, created: false }; await db.insert(paperBotRuns).values({ userId: input.userId, configId: input.configId, runKey: input.runKey, marketContext: JSON.stringify(input.marketContext), status: "started" }); const run = (await db.select().from(paperBotRuns).where(eq(paperBotRuns.runKey, input.runKey)).limit(1))[0]; if (!run) throw new Error("Paper bot run could not be created"); return { run, created: true }; }
export async function completePaperBotRun(input: { id: number; status: "hold" | "ordered" | "risk_blocked" | "error"; decision?: unknown; error?: string; configId: number }) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.update(paperBotRuns).set({ status: input.status, decision: input.decision ? JSON.stringify(input.decision) : undefined, error: input.error, completedAt: new Date() }).where(eq(paperBotRuns.id, input.id)); await db.update(paperBotConfigs).set({ lastRunAt: new Date(), lastRunStatus: input.status, lastRunError: input.error ?? null, updatedAt: new Date() }).where(eq(paperBotConfigs.id, input.configId)); }
export async function resetBinancePaperAccount(userId: number) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  await db.delete(binancePaperOrders).where(eq(binancePaperOrders.userId, userId));
  await db.delete(paperBotRuns).where(eq(paperBotRuns.userId, userId));
  const today = todayKey();
  await db.update(binancePaperAccounts).set({ initialCapital: "50.00", dailyStartEquity: "50.00", dailyAnchor: today, updatedAt: new Date() }).where(eq(binancePaperAccounts.userId, userId));
  await db.update(paperBotConfigs).set({ enabled: 0, scheduleCronTaskUid: null, lastRunStatus: "ready", lastRunError: null, updatedAt: new Date() }).where(eq(paperBotConfigs.userId, userId));
  return ensureBinancePaperAccount(userId);
}

export function buildBinancePaperCloseOrder(input: { userId: number; symbol: string; quantity: number; markPrice: number }) {
  if (!input.symbol || !/^[A-Z0-9]{5,24}$/.test(input.symbol)) throw new Error("Invalid paper position symbol");
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error(`No open paper position for ${input.symbol}`);
  if (!Number.isFinite(input.markPrice) || input.markPrice <= 0) throw new Error(`No valid market price available for ${input.symbol}`);
  return {
    idempotencyKey: `manual-close:${input.userId}:${input.symbol}:${Date.now()}`,
    symbol: input.symbol,
    side: "sell" as const,
    quantity: input.quantity,
    markPrice: input.markPrice,
    source: "user-close-position",
  };
}

export async function closeBinancePaperPosition(userId: number, symbol: string, prices: Record<string, number> = {}) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const account = await binancePaperAccountSummary(userId, prices);
  const position = account.positions.find(item => item.symbol === symbol && item.quantity > 0);
  if (!position) throw new Error(`No open paper position for ${symbol}`);
  const markPrice = prices[symbol] ?? position.marketPrice ?? position.averageCost;
  const order = await createBinancePaperOrder(userId, buildBinancePaperCloseOrder({ userId, symbol, quantity: position.quantity, markPrice }));
  return { closed: 1, order };
}

export async function closeAllBinancePaperPositions(userId: number, prices: Record<string, number> = {}) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const account = await binancePaperAccountSummary(userId, prices);
  const openPositions = account.positions.filter(p => p.quantity > 0);
  if (!openPositions.length) return { closed: 0, orders: [] };

  const createdOrders = [];
  for (const pos of openPositions) {
    const markPrice = prices[pos.symbol] ?? pos.marketPrice ?? pos.averageCost;
    if (!markPrice || markPrice <= 0) continue;
    const order = await createBinancePaperOrder(userId, {
      idempotencyKey: `stop-close:${pos.symbol}:${Date.now()}`,
      symbol: pos.symbol,
      side: "sell",
      quantity: pos.quantity,
      markPrice,
      source: "user-stop-close-all"
    });
    if (order) createdOrders.push(order);
  }
  return { closed: createdOrders.length, orders: createdOrders };
}

export async function createBinanceLiveOrder(userId: number, input: { orderId: string; clientOrderId?: string; symbol: string; side: "buy" | "sell"; orderType?: string; quantity: number; fillPrice: number; cummulativeQuoteQty?: number; status?: string; source?: string; rawResponse?: string }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const existing = (await db.select().from(binanceLiveOrders).where(eq(binanceLiveOrders.orderId, input.orderId)).limit(1))[0];
  if (existing) return existing;
  await db.insert(binanceLiveOrders).values({
    userId,
    orderId: input.orderId,
    clientOrderId: input.clientOrderId,
    symbol: input.symbol,
    side: input.side,
    orderType: input.orderType ?? "MARKET",
    quantity: String(input.quantity),
    fillPrice: String(input.fillPrice),
    cummulativeQuoteQty: input.cummulativeQuoteQty !== undefined ? String(input.cummulativeQuoteQty) : undefined,
    status: input.status ?? "FILLED",
    source: input.source ?? "deepseek-live-bot",
    rawResponse: input.rawResponse,
  });
  return (await db.select().from(binanceLiveOrders).where(eq(binanceLiveOrders.orderId, input.orderId)).limit(1))[0];
}

export async function listBinanceLiveOrders(userId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(binanceLiveOrders).where(eq(binanceLiveOrders.userId, userId)).orderBy(desc(binanceLiveOrders.id));
}
