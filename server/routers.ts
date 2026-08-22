import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { assertRateLimit, clientKey, isAbortError, requestId, safeAudit } from "./production";
import { z } from "zod";
import type { MarketQuote } from "@shared/scanner";
import { massiveNews, massiveProvider } from "./massive";
import { finnhubNews, finnhubProvider, finnhubSymbols } from "./finnhub";
import { addWatchlistItem, createAlertRule, createBacktestRun, createPaperOrder, createWatchlist, deleteAlertRule, deleteLayout, deletePreset, deleteWatchlist, deleteWatchlistItem, getProviderHealth, listAlertRules, listBacktestRuns, listLayouts, listPaperOrders, listPresets, listWatchlistItems, listWatchlists, paperAccountSummary, saveLayout, savePreset } from "./db";
import { assertPaperOnlyOrder, replayBars, runScannerBacktest } from "./backtest";
import { checkMassiveFlatFileHealth } from "./massive-flatfiles";

const activeMarketProvider = process.env.FINNHUB_API_KEY ? finnhubProvider : massiveProvider;
const activeProviderName = process.env.FINNHUB_API_KEY ? "finnhub" : "massive";

function unavailableQuote(symbol: string, message: string): MarketQuote { return { symbol, price: 0, bid: 0, ask: 0, changePct: 0, volume: 0, rvol: 0, floatM: 0, marketCapM: 0, dollarVolumeM: 0, vwap: 0, sessionHigh: 0, sessionLow: 0, halted: false, lastUpdated: Date.now(), source: "unavailable", providerError: message }; }
async function marketQuotes(symbols: string[]) { if (!process.env.FINNHUB_API_KEY) { try { return await massiveProvider.getQuotes(symbols); } catch (error) { if (isAbortError(error)) return symbols.map(symbol => unavailableQuote(symbol, "Market data request aborted")); throw error; } } try { const primary = await finnhubProvider.getQuotes(symbols); const missing = primary.filter(item => item.source === "unavailable").map(item => item.symbol); if (!missing.length) return primary; try { const fallback = await massiveProvider.getQuotes(missing); const bySymbol = new Map(fallback.map(item => [item.symbol, item])); return primary.map(item => { const candidate = bySymbol.get(item.symbol); return candidate && candidate.source !== "unavailable" ? candidate : item; }); } catch (error) { if (isAbortError(error)) return primary; return primary; } } catch (error) { if (isAbortError(error)) return symbols.map(symbol => unavailableQuote(symbol, "Market data request aborted")); throw error; } }
async function marketBars(symbol: string, from: string, to: string) { if (!process.env.FINNHUB_API_KEY) { try { return await massiveProvider.getBars(symbol, from, to); } catch (error) { if (isAbortError(error)) return []; throw error; } } try { return await finnhubProvider.getBars(symbol, from, to); } catch (error) { if (isAbortError(error)) return []; try { return await massiveProvider.getBars(symbol, from, to); } catch (fallbackError) { if (isAbortError(fallbackError)) return []; throw fallbackError; } } }
async function marketTrades(symbol: string, from: string, to: string) { if (!process.env.FINNHUB_API_KEY) { try { return await massiveProvider.getTrades(symbol, from, to); } catch (error) { if (isAbortError(error)) return []; throw error; } } try { return await finnhubProvider.getTrades(symbol, from, to); } catch (error) { if (isAbortError(error)) return []; try { return await massiveProvider.getTrades(symbol, from, to); } catch (fallbackError) { if (isAbortError(fallbackError)) return []; throw fallbackError; } } }

const auditedProtectedProcedure = protectedProcedure.use(async ({ ctx, next, path }) => { const result = await next(); void safeAudit({ userId: ctx.user.id, action: "protected_procedure", resource: path, requestId: requestId(ctx.req) }); return result; });

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  market: router({
    quotes: publicProcedure.input(z.object({ symbols: z.array(z.string().trim().toUpperCase().regex(/^[A-Z.\-]{1,12}$/)).min(1).max(50) })).query(({ ctx, input }) => { assertRateLimit(`quotes:${clientKey(ctx.req)}`, 30, 60_000); return marketQuotes(input.symbols); }),
    news: publicProcedure.input(z.object({ ticker: z.string().trim().toUpperCase().regex(/^[A-Z.\-]{1,12}$/).optional(), limit: z.number().int().min(1).max(100).default(20) })).query(({ ctx, input }) => { assertRateLimit(`news:${clientKey(ctx.req)}`, 20, 60_000); if (process.env.FINNHUB_API_KEY && input.ticker) { const to = new Date().toISOString().slice(0, 10); const from = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10); return finnhubNews(input.ticker, from, to).then(items => items.slice(0, input.limit)).catch(() => massiveNews(input.ticker, input.limit)); } return massiveNews(input.ticker, input.limit); }),
    symbols: publicProcedure.query(({ ctx }) => { assertRateLimit(`symbols:${clientKey(ctx.req)}`, 5, 60_000); if (!process.env.FINNHUB_API_KEY) return []; return finnhubSymbols().catch(() => []); }),
    health: publicProcedure.query(() => getProviderHealth(activeProviderName)),
    flatFileHealth: publicProcedure.query(() => checkMassiveFlatFileHealth()),
    bars: publicProcedure.input(z.object({ symbol: z.string().trim().toUpperCase().regex(/^[A-Z.\-]{1,12}$/), from: z.string().min(1).max(40), to: z.string().min(1).max(40) })).query(async ({ ctx, input }) => { try { assertRateLimit(`bars:${clientKey(ctx.req)}`, 10, 60_000); } catch (error) { if (error instanceof TRPCError && error.code === "TOO_MANY_REQUESTS") return []; throw error; } return marketBars(input.symbol, input.from, input.to); }),
    trades: publicProcedure.input(z.object({ symbol: z.string().trim().toUpperCase().regex(/^[A-Z.\-]{1,12}$/), from: z.string().min(1).max(40), to: z.string().min(1).max(40) })).query(({ ctx, input }) => { assertRateLimit(`trades:${clientKey(ctx.req)}`, 10, 60_000); return marketTrades(input.symbol, input.from, input.to); }),
  }),

  workspace: router({
    watchlists: auditedProtectedProcedure.query(({ ctx }) => listWatchlists(ctx.user.id)),
    createWatchlist: auditedProtectedProcedure.input(z.object({ name: z.string().min(1).max(120), columns: z.array(z.string()).max(20) })).mutation(({ ctx, input }) => createWatchlist(ctx.user.id, input.name, input.columns)),
    deleteWatchlist: auditedProtectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteWatchlist(ctx.user.id, input.id)),
    watchlistItems: auditedProtectedProcedure.input(z.object({ watchlistId: z.number().int().positive() })).query(({ ctx, input }) => listWatchlistItems(ctx.user.id, input.watchlistId)),
    addWatchlistItem: auditedProtectedProcedure.input(z.object({ watchlistId: z.number().int().positive(), symbol: z.string().min(1).max(16) })).mutation(({ ctx, input }) => addWatchlistItem(ctx.user.id, input.watchlistId, input.symbol)),
    deleteWatchlistItem: auditedProtectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteWatchlistItem(ctx.user.id, input.id)),
    presets: auditedProtectedProcedure.query(({ ctx }) => listPresets(ctx.user.id)),
    savePreset: auditedProtectedProcedure.input(z.object({ name: z.string().min(1).max(120), scanner: z.string().max(80), thresholds: z.record(z.string(), z.unknown()) })).mutation(({ ctx, input }) => savePreset(ctx.user.id, input.name, input.scanner, input.thresholds)),
    deletePreset: auditedProtectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deletePreset(ctx.user.id, input.id)),
    layouts: auditedProtectedProcedure.query(({ ctx }) => listLayouts(ctx.user.id)),
    saveLayout: auditedProtectedProcedure.input(z.object({ name: z.string().min(1).max(120), layout: z.record(z.string(), z.unknown()) })).mutation(({ ctx, input }) => saveLayout(ctx.user.id, input.name, input.layout)),
    deleteLayout: auditedProtectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteLayout(ctx.user.id, input.id)),
    alertRules: auditedProtectedProcedure.query(({ ctx }) => listAlertRules(ctx.user.id)),
    createAlertRule: auditedProtectedProcedure.input(z.object({ name: z.string().min(1).max(120), symbol: z.string().max(16).optional(), condition: z.record(z.string(), z.unknown()) })).mutation(({ ctx, input }) => createAlertRule(ctx.user.id, input.name, input.symbol, input.condition)),
    deleteAlertRule: auditedProtectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteAlertRule(ctx.user.id, input.id)),
    submitPaperOrder: auditedProtectedProcedure.input(z.object({ idempotencyKey: z.string().trim().min(8).max(80).optional(), symbol: z.string().trim().toUpperCase().regex(/^[A-Z.\-]{1,16}$/), side: z.enum(["buy", "sell"]), quantity: z.string().regex(/^\d+(\.\d{1,4})?$/), orderType: z.enum(["market", "limit"]), limitPrice: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(), markPrice: z.number().finite().positive().optional(), mode: z.literal("paper") })).mutation(async ({ ctx, input }) => { try { assertPaperOnlyOrder(input.mode); if (Number(input.quantity) <= 0 || Number(input.quantity) > 1_000_000) throw new Error("Quantity outside permitted paper-trading range"); if (input.orderType === "limit" && !input.limitPrice) throw new Error("Limit orders require a limit price"); if (input.orderType === "market" && !input.markPrice) throw new Error("Market paper orders require a current mark price"); const key = input.idempotencyKey ?? requestId(ctx.req); const result = await createPaperOrder(ctx.user.id, { ...input, idempotencyKey: key }); await safeAudit({ userId: ctx.user.id, action: "paper_order_created", resource: input.symbol, metadata: { side: input.side, quantity: input.quantity, orderType: input.orderType, mode: "paper", idempotencyKey: key }, requestId: key }); return result; } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Paper order rejected" }); } }),
    paperOrders: auditedProtectedProcedure.query(({ ctx }) => listPaperOrders(ctx.user.id)),
    paperAccount: auditedProtectedProcedure.input(z.object({ prices: z.record(z.string(), z.number()).default({}) })).query(({ ctx, input }) => paperAccountSummary(ctx.user.id, input.prices)),
    backtestRuns: auditedProtectedProcedure.query(({ ctx }) => listBacktestRuns(ctx.user.id)),
    replay: auditedProtectedProcedure.input(z.object({ bars: z.array(z.object({ timestamp: z.number(), open: z.number(), high: z.number(), low: z.number(), close: z.number(), volume: z.number() })).min(1), speed: z.number().positive().default(1) })).query(({ input }) => replayBars(input.bars, input.speed)),
    backtest: auditedProtectedProcedure.input(z.object({ name: z.string().trim().min(1).max(120), bars: z.array(z.object({ timestamp: z.number().int().nonnegative(), open: z.number().positive(), high: z.number().positive(), low: z.number().positive(), close: z.number().positive(), volume: z.number().nonnegative() })).min(2).max(100_000), config: z.object({ minChangePct: z.number().finite().min(-100).max(1_000), minRvol: z.number().finite().min(0).max(1_000), initialCapital: z.number().positive().max(100_000_000), positionSize: z.number().positive().max(100_000_000), slippageBps: z.number().finite().min(0).max(1_000).default(0), feePerTrade: z.number().finite().min(0).max(100_000).default(0) }) })).mutation(async ({ ctx, input }) => { const metrics = runScannerBacktest(input.bars, input.config); await createBacktestRun(ctx.user.id, input.name, input.config, metrics); await safeAudit({ userId: ctx.user.id, action: "backtest_completed", resource: input.name, metadata: { bars: input.bars.length }, requestId: requestId(ctx.req) }); return metrics; }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
