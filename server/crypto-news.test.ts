import { describe, expect, it } from "vitest";
import { normalizeCoinDeskRss } from "./crypto-news";

const validFeed = `<?xml version="1.0"?><rss><channel><item><title><![CDATA[Bitcoin &amp; Ether move]]></title><link>https://www.coindesk.com/markets/example/</link><pubDate>Fri, 22 Aug 2026 08:00:00 GMT</pubDate></item><item><title>Malformed item</title><link>javascript:alert(1)</link><pubDate>Fri, 22 Aug 2026 07:00:00 GMT</pubDate></item></channel></rss>`;

describe("CoinDesk RSS news normalization", () => {
  it("returns only complete provider-returned headlines with canonical article links", () => {
    const feed = normalizeCoinDeskRss(validFeed, 1_000);
    expect(feed.availability).toBe("available");
    expect(feed.items).toEqual([{ id: "https://www.coindesk.com/markets/example/|1787385600000", title: "Bitcoin & Ether move", source: "CoinDesk", url: "https://www.coindesk.com/markets/example/", publishedAt: 1787385600000 }]);
    expect(feed.freshness).toBe("near-real-time");
  });

  it("surfaces an unavailable feed rather than synthesizing a headline", () => {
    const feed = normalizeCoinDeskRss("<rss><channel><item><title>Missing link</title></item></channel></rss>", 2_000);
    expect(feed.availability).toBe("unavailable");
    expect(feed.items).toEqual([]);
    expect(feed.providerError).toMatch(/no valid news/i);
  });
});
