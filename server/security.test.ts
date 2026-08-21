import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const baseContext = (user: TrpcContext["user"]): TrpcContext => ({
  user,
  req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
  res: { setHeader: vi.fn(), clearCookie: vi.fn() } as unknown as TrpcContext["res"],
});

describe("production security boundaries", () => {
  it("rejects unauthenticated workspace access", async () => {
    const caller = appRouter.createCaller(baseContext(null));
    await expect(caller.workspace.watchlists()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects market paper orders without a current mark", async () => {
    const caller = appRouter.createCaller(baseContext({ id: 7, openId: "security-user", name: "Security", email: null, loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }));
    await expect(caller.workspace.submitPaperOrder({ symbol: "AAPL", side: "buy", quantity: "1", orderType: "market", mode: "paper" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
