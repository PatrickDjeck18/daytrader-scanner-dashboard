import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, watchlists, watchlistItems, scannerPresets, alertRules, workspaceLayouts, paperOrders } from "../drizzle/schema";
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

export async function listWatchlists(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(watchlists).where(eq(watchlists.userId, userId)); }
export async function createWatchlist(userId: number, name: string, columns: string[]) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(watchlists).values({ userId, name, columns: JSON.stringify(columns) }); return true; }
export async function listPresets(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(scannerPresets).where(eq(scannerPresets.userId, userId)); }
export async function savePreset(userId: number, name: string, scanner: string, thresholds: unknown) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(scannerPresets).values({ userId, name, scanner, thresholds: JSON.stringify(thresholds) }); return true; }
export async function listLayouts(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(workspaceLayouts).where(eq(workspaceLayouts.userId, userId)); }
export async function saveLayout(userId: number, name: string, layout: unknown) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(workspaceLayouts).values({ userId, name, layout: JSON.stringify(layout) }); return true; }
export async function listAlertRules(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(alertRules).where(eq(alertRules.userId, userId)); }
export async function createAlertRule(userId: number, name: string, symbol: string | undefined, condition: unknown) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(alertRules).values({ userId, name, symbol, condition: JSON.stringify(condition) }); return true; }
export async function createPaperOrder(userId: number, input: { symbol: string; side: "buy" | "sell"; quantity: string; orderType: "market" | "limit"; limitPrice?: string }) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(paperOrders).values({ userId, symbol: input.symbol, side: input.side, quantity: input.quantity, orderType: input.orderType, limitPrice: input.limitPrice, status: "submitted" }); return true; }

// TODO: add feature queries here as your schema grows.
