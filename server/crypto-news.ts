import { type CryptoNewsFeed, type CryptoNewsItem, unavailableCryptoNews } from "@shared/crypto";
import { fetchWithTimeout } from "./production";

const COINDESK_RSS_URL = "https://www.coindesk.com/arc/outboundfeeds/rss/";
const CACHE_MS = 45_000;
let cachedFeed: CryptoNewsFeed | undefined;

function decodeXml(value: string): string {
  return value.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i, "$1").replace(/<[^>]+>/g, "").replace(/&(amp|lt|gt|quot|apos|#39);/gi, (_, entity: string) => ({ amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", "#39": "'" }[entity.toLowerCase()] ?? "")).replace(/\s+/g, " ").trim();
}

function xmlTag(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  const value = match?.[1] ? decodeXml(match[1]) : "";
  return value || undefined;
}

function canonicalUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeCoinDeskRss(xml: string, fetchedAt = Date.now(), limit = 12): CryptoNewsFeed {
  const items: CryptoNewsItem[] = (xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? []).flatMap(block => {
    const title = xmlTag(block, "title");
    const url = canonicalUrl(xmlTag(block, "link"));
    const parsedTime = Date.parse(xmlTag(block, "pubDate") ?? "");
    if (!title || !url || !Number.isFinite(parsedTime)) return [];
    return [{ id: `${url}|${parsedTime}`, title, source: "CoinDesk", url, publishedAt: parsedTime }];
  }).sort((left, right) => right.publishedAt - left.publishedAt).slice(0, Math.max(1, Math.min(20, limit)));

  if (!items.length) return unavailableCryptoNews("CoinDesk RSS returned no valid news items", fetchedAt);
  return { provider: "CoinDesk RSS", availability: "available", freshness: "near-real-time", refreshIntervalMs: 60_000, fetchedAt, items };
}

function limitFeed(feed: CryptoNewsFeed, limit: number): CryptoNewsFeed {
  return { ...feed, items: feed.items.slice(0, Math.max(1, Math.min(20, limit))) };
}

export async function fetchPublicCryptoNews(limit = 12): Promise<CryptoNewsFeed> {
  const now = Date.now();
  if (cachedFeed && now - cachedFeed.fetchedAt < CACHE_MS) return limitFeed(cachedFeed, limit);
  try {
    const response = await fetchWithTimeout(COINDESK_RSS_URL, { headers: { Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8" } }, 8_000);
    if (!response.ok) return unavailableCryptoNews(`CoinDesk RSS request failed: ${response.status}`, now);
    const feed = normalizeCoinDeskRss(await response.text(), now, 20);
    if (feed.availability === "available") cachedFeed = feed;
    return limitFeed(feed, limit);
  } catch (error) {
    return unavailableCryptoNews(error instanceof Error ? error.message : "CoinDesk RSS request failed", now);
  }
}

export function resetPublicCryptoNewsCacheForTests() { cachedFeed = undefined; }
