import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("application routes", () => {
  it("registers the Supabase authentication and protected dashboard entry points", async () => {
    const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");

    expect(source).toContain('path={"/auth"}');
    expect(source).toContain('path={"/auth/reset"}');
    expect(source).toContain('path={"/auth/callback"}');
    expect(source).toContain('path={"/"} component={ProtectedHome}');
    expect(source).toContain('path={"/binance"} component={ProtectedBinanceDashboard}');
  });
});
