import { describe, expect, it } from "vitest";
import { lookup } from "node:dns/promises";
import { sql } from "drizzle-orm";
import pg from "pg";
import { getDb } from "./db";
import { providerHealth, users } from "../drizzle/schema";

const { Client } = pg;

describe("Supabase database connection", () => {
  it("connects with the managed PostgreSQL secret", async () => {
    const url = process.env.SUPABASE_DATABASE_URL;
    expect(url, "SUPABASE_DATABASE_URL must be configured for this test").toBeTruthy();
    const parsed = new URL(url!);
    const resolved = await lookup(parsed.hostname, { family: 4 });
    const client = new Client({
      connectionString: url,
      host: resolved.address,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    try {
      const result = await client.query<{ ok: number }>("select 1 as ok");
      expect(result.rows[0]?.ok).toBe(1);
    } finally {
      await client.end();
    }
  }, 20_000);

  it("uses the Supabase connection through the application database adapter", async () => {
    const db = await getDb();
    expect(db).not.toBeNull();
    const result = await db!.execute<{ ok: number }>(sql`select 1 as ok`);
    expect(result.rows[0]?.ok).toBe(1);
  }, 20_000);

  it("reads the migrated provider health rows through the application schema", async () => {
    const db = await getDb();
    const rows = await db!.select({ provider: providerHealth.provider }).from(providerHealth).limit(2);
    expect(rows.map((row) => row.provider)).toEqual(expect.arrayContaining(["finnhub", "massive"]));
  }, 20_000);

  it("reads the migrated authenticated-user record through the application schema", async () => {
    const db = await getDb();
    const rows = await db!.select({ id: users.id, role: users.role }).from(users).limit(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.role).toBe("admin");
  }, 20_000);
});
