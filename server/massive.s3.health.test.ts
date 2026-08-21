import { afterEach, describe, expect, it, vi } from "vitest";
import { S3Client } from "@aws-sdk/client-s3";
import { checkMassiveFlatFileHealth } from "./massive-flatfiles";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const context: TrpcContext = { user: undefined, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };

describe("Massive flat-file health", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns healthy metadata for a successful non-mutating list", async () => {
    vi.spyOn(S3Client.prototype, "send").mockResolvedValue({ Contents: [{ Key: "reference/sample.csv", Size: 10 }] } as never);
    const result = await checkMassiveFlatFileHealth();
    expect(result.status).toBe("healthy");
    expect(result.sampleAvailable).toBe(true);
    expect(result).not.toHaveProperty("accessKeyId");
    expect(result).not.toHaveProperty("secretAccessKey");
  });

  it("returns unavailable metadata when the flat-file request fails", async () => {
    vi.spyOn(S3Client.prototype, "send").mockRejectedValue(new Error("access denied"));
    const result = await checkMassiveFlatFileHealth();
    expect(result.status).toBe("unavailable");
    expect(result.sampleAvailable).toBe(false);
    expect(result.error).toContain("access denied");
    expect(result).not.toHaveProperty("secretAccessKey");
  });

  it.each(["healthy", "unavailable"] as const)("returns safe %s metadata through market.flatFileHealth", async expected => {
    vi.spyOn(S3Client.prototype, "send").mockImplementation(async () => expected === "healthy" ? ({ Contents: [{ Key: "reference/sample.csv" }] } as never) : Promise.reject(new Error("offline")));
    const result = await appRouter.createCaller(context).market.flatFileHealth();
    expect(result.status).toBe(expected);
    expect(result).not.toHaveProperty("accessKeyId");
    expect(result).not.toHaveProperty("secretAccessKey");
  });
});
