import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { randomUUID } from "node:crypto";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  const requestId = typeof opts.req.headers["x-request-id"] === "string" && opts.req.headers["x-request-id"].length <= 80 ? opts.req.headers["x-request-id"] : randomUUID();
  opts.res.setHeader("x-request-id", requestId);
  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
