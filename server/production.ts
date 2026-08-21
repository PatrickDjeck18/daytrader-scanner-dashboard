import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { recordAuditEvent } from "./db";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function requestId(req: { headers?: Record<string, unknown> | { [key: string]: unknown } }) {
  const header = req.headers?.["x-request-id"];
  return typeof header === "string" && header.length <= 80 ? header : randomUUID();
}

export function clientKey(req: { ip?: string; headers?: Record<string, unknown> | { [key: string]: unknown } }) {
  const forwarded = req.headers?.["x-forwarded-for"];
  const value = typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined;
  return value || req.ip || "unknown";
}

export function assertRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + windowMs }); return; }
  if (current.count >= limit) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded; please retry shortly" });
  current.count += 1;
}

export function safeAudit(input: { userId?: number; action: string; resource: string; metadata?: Record<string, unknown>; requestId?: string }) {
  return recordAuditEvent(input).catch(error => { console.warn("[Audit] Failed to persist event", error); return false; });
}

export function isAbortError(error: unknown) { const message = error instanceof Error ? error.message : String(error); return error instanceof DOMException && error.name === "AbortError" || error instanceof Error && error.name === "AbortError" || /operation was aborted|aborted|aborterror/i.test(message); }

export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}
