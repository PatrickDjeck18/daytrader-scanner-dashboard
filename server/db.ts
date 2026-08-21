import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, watchlists, watchlistItems, scannerPresets, alertRules, workspaceLayouts, paperOrders, backtestRuns, auditEvents, providerHealth } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
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

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
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
export async function saveLayout(userId: number, name: string, layout: unknown) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(workspaceLayouts).values({ userId, name, layout: JSON.stringify(layout) }); return true; }
export async function deleteAlertRule(userId: number, id: number) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.delete(alertRules).where(and(eq(alertRules.id, id), eq(alertRules.userId, userId))); return true; }
export async function listAlertRules(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(alertRules).where(eq(alertRules.userId, userId)); }
export async function createAlertRule(userId: number, name: string, symbol: string | undefined, condition: unknown) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(alertRules).values({ userId, name, symbol, condition: JSON.stringify(condition) }); return true; }
export function simulatePaperFill(input: { side: "buy" | "sell"; orderType: "market" | "limit"; limitPrice?: string; markPrice?: number }) { const mark = input.markPrice && Number.isFinite(input.markPrice) && input.markPrice > 0 ? input.markPrice : undefined; const limit = input.limitPrice ? Number(input.limitPrice) : undefined; const filled = input.orderType === "market" ? Boolean(mark) : Boolean(mark && limit && (input.side === "buy" ? mark <= limit : mark >= limit)); return { status: filled ? "filled" as const : "submitted" as const, fillPrice: filled ? mark : undefined }; }
export async function createPaperOrder(userId: number, input: { idempotencyKey: string; symbol: string; side: "buy" | "sell"; quantity: string; orderType: "market" | "limit"; limitPrice?: string; markPrice?: number }) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const existing = await db.select().from(paperOrders).where(and(eq(paperOrders.userId, userId), eq(paperOrders.idempotencyKey, input.idempotencyKey))).limit(1); if (existing[0]) return existing[0]; const fill = simulatePaperFill(input); const fillPrice = fill.fillPrice === undefined ? undefined : String(fill.fillPrice); const status = fill.status; await db.insert(paperOrders).values({ userId, idempotencyKey: input.idempotencyKey, symbol: input.symbol, side: input.side, quantity: input.quantity, orderType: input.orderType, limitPrice: input.limitPrice, fillPrice, status }); const created = await db.select().from(paperOrders).where(and(eq(paperOrders.userId, userId), eq(paperOrders.idempotencyKey, input.idempotencyKey))).limit(1); return created[0] ?? true; }
export async function listPaperOrders(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(paperOrders).where(eq(paperOrders.userId, userId)); }
export async function recordAuditEvent(input: { userId?: number; action: string; resource: string; metadata?: Record<string, unknown>; requestId?: string }) { const db = await getDb(); if (!db) return false; await db.insert(auditEvents).values({ userId: input.userId, action: input.action, resource: input.resource, metadata: JSON.stringify(input.metadata ?? {}), requestId: input.requestId }); return true; }
export async function updateProviderHealth(input: { provider: string; status: "healthy" | "degraded" | "offline"; latencyMs?: number; error?: string }) { const db = await getDb(); if (!db) return false; const now = new Date(); await db.insert(providerHealth).values({ provider: input.provider, status: input.status, latencyMs: input.latencyMs, lastSuccessAt: input.status === "healthy" ? now : undefined, lastFailureAt: input.status === "healthy" ? undefined : now, lastError: input.error }).onDuplicateKeyUpdate({ set: { status: input.status, latencyMs: input.latencyMs, lastSuccessAt: input.status === "healthy" ? now : undefined, lastFailureAt: input.status === "healthy" ? undefined : now, lastError: input.error } }); return true; }
export async function getProviderHealth(provider: string) { const db = await getDb(); if (!db) return undefined; const rows = await db.select().from(providerHealth).where(eq(providerHealth.provider, provider)).limit(1); return rows[0]; }
export function calculatePaperPnl(orders: Array<{ symbol: string; side: "buy" | "sell"; quantity: string | number; fillPrice: string | number | null; status?: "submitted" | "filled" | "cancelled" }>, prices: Record<string, number> = {}) { const state = new Map<string, { quantity: number; averageCost: number }>(); let realizedPnl = 0; for (const order of orders) { if (order.status && order.status !== "filled") continue; const quantity = Number(order.quantity); const price = Number(order.fillPrice ?? 0); const current = state.get(order.symbol) ?? { quantity: 0, averageCost: 0 }; if (order.side === "buy") { const totalCost = current.quantity * current.averageCost + quantity * price; current.quantity += quantity; current.averageCost = current.quantity ? totalCost / current.quantity : 0; } else { const closed = Math.min(quantity, Math.max(0, current.quantity)); realizedPnl += closed * (price - current.averageCost); current.quantity -= quantity; if (current.quantity <= 0) current.averageCost = 0; } state.set(order.symbol, current); } const positions = Array.from(state.entries()).filter(([, position]) => position.quantity !== 0).map(([symbol, position]) => ({ symbol, quantity: position.quantity, averageCost: position.averageCost, marketPrice: prices[symbol] ?? position.averageCost, unrealizedPnl: position.quantity * ((prices[symbol] ?? position.averageCost) - position.averageCost) })); const unrealizedPnl = positions.reduce((sum, position) => sum + position.unrealizedPnl, 0); return { realizedPnl, unrealizedPnl, totalPnl: realizedPnl + unrealizedPnl, positions }; }
export async function paperAccountSummary(userId: number, prices: Record<string, number> = {}) { const orders = await listPaperOrders(userId); const filledOrders = orders.filter(order => order.status === "filled"); const used = filledOrders.reduce((sum, order) => sum + (order.side === "buy" ? 1 : -1) * Number(order.quantity) * Number(order.fillPrice ?? 0), 0); return { mode: "paper" as const, buyingPower: 100000 - Math.max(0, used), usedCapital: used, ...calculatePaperPnl(orders, prices) }; }
export async function listBacktestRuns(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(backtestRuns).where(eq(backtestRuns.userId, userId)); }
export async function createBacktestRun(userId: number, name: string, strategy: unknown, metrics: unknown) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(backtestRuns).values({ userId, name, strategy: JSON.stringify(strategy), metrics: JSON.stringify(metrics), status: "completed" }); return true; }

// TODO: add feature queries here as your schema grows.
