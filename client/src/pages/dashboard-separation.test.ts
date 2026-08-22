import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const readSibling = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");

describe("dashboard separation", () => {
  it("keeps the U.S. equities page free of the Binance terminal while exposing a two-dashboard switcher", () => {
    const source = readSibling("./Home.tsx");
    expect(source).not.toContain('from "@/components/CryptoTerminal"');
    expect(source).not.toContain("<CryptoTerminal />");
    expect(source).toContain("U.S. Equities");
    expect(source).toContain("Binance Crypto");
  });

  it("keeps the Binance page dedicated to crypto while exposing the reciprocal switcher", () => {
    const source = readSibling("./BinanceDashboard.tsx");
    expect(source).toContain("<CryptoTerminal />");
    expect(source).toContain("U.S. Equities Dashboard");
    expect(source).toContain("Binance Crypto Dashboard");
    expect(source).toContain("switcher-mobile-label");
    expect(source).toContain("U.S. Equities");
    expect(source).toContain("Binance Crypto");
    expect(source).not.toContain("Search all U.S. symbols");
  });
});
