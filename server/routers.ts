import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { massiveNews, massiveProvider } from "./massive";
import { addWatchlistItem, createAlertRule, createBacktestRun, createPaperOrder, createWatchlist, deleteAlertRule, deleteLayout, deletePreset, deleteWatchlist, deleteWatchlistItem, listAlertRules, listBacktestRuns, listLayouts, listPaperOrders, listPresets, listWatchlistItems, listWatchlists, paperAccountSummary, saveLayout, savePreset } from "./db";
import { assertPaperOnlyOrder, replayBars, runScannerBacktest } from "./backtest";

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
    quotes: publicProcedure.input(z.object({ symbols: z.array(z.string().min(1).max(12)).min(1).max(50) })).query(({ input }) => massiveProvider.getQuotes(input.symbols)),
    news: publicProcedure.input(z.object({ ticker: z.string().min(1).max(12).optional(), limit: z.number().int().min(1).max(100).default(20) })).query(({ input }) => massiveNews(input.ticker, input.limit)),
    bars: publicProcedure.input(z.object({ symbol: z.string().min(1).max(12), from: z.string(), to: z.string() })).query(({ input }) => massiveProvider.getBars(input.symbol, input.from, input.to)),
    trades: publicProcedure.input(z.object({ symbol: z.string().min(1).max(12), from: z.string(), to: z.string() })).query(({ input }) => massiveProvider.getTrades(input.symbol, input.from, input.to)),
  }),

  workspace: router({
    watchlists: protectedProcedure.query(({ ctx }) => listWatchlists(ctx.user.id)),
    createWatchlist: protectedProcedure.input(z.object({ name: z.string().min(1).max(120), columns: z.array(z.string()).max(20) })).mutation(({ ctx, input }) => createWatchlist(ctx.user.id, input.name, input.columns)),
    deleteWatchlist: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteWatchlist(ctx.user.id, input.id)),
    watchlistItems: protectedProcedure.input(z.object({ watchlistId: z.number().int().positive() })).query(({ ctx, input }) => listWatchlistItems(ctx.user.id, input.watchlistId)),
    addWatchlistItem: protectedProcedure.input(z.object({ watchlistId: z.number().int().positive(), symbol: z.string().min(1).max(16) })).mutation(({ ctx, input }) => addWatchlistItem(ctx.user.id, input.watchlistId, input.symbol)),
    deleteWatchlistItem: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteWatchlistItem(ctx.user.id, input.id)),
    presets: protectedProcedure.query(({ ctx }) => listPresets(ctx.user.id)),
    savePreset: protectedProcedure.input(z.object({ name: z.string().min(1).max(120), scanner: z.string().max(80), thresholds: z.record(z.string(), z.unknown()) })).mutation(({ ctx, input }) => savePreset(ctx.user.id, input.name, input.scanner, input.thresholds)),
    deletePreset: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deletePreset(ctx.user.id, input.id)),
    layouts: protectedProcedure.query(({ ctx }) => listLayouts(ctx.user.id)),
    saveLayout: protectedProcedure.input(z.object({ name: z.string().min(1).max(120), layout: z.record(z.string(), z.unknown()) })).mutation(({ ctx, input }) => saveLayout(ctx.user.id, input.name, input.layout)),
    deleteLayout: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteLayout(ctx.user.id, input.id)),
    alertRules: protectedProcedure.query(({ ctx }) => listAlertRules(ctx.user.id)),
    createAlertRule: protectedProcedure.input(z.object({ name: z.string().min(1).max(120), symbol: z.string().max(16).optional(), condition: z.record(z.string(), z.unknown()) })).mutation(({ ctx, input }) => createAlertRule(ctx.user.id, input.name, input.symbol, input.condition)),
    deleteAlertRule: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteAlertRule(ctx.user.id, input.id)),
    submitPaperOrder: protectedProcedure.input(z.object({ symbol: z.string().min(1).max(16), side: z.enum(["buy", "sell"]), quantity: z.string(), orderType: z.enum(["market", "limit"]), limitPrice: z.string().optional(), mode: z.literal("paper") })).mutation(({ ctx, input }) => { assertPaperOnlyOrder(input.mode); return createPaperOrder(ctx.user.id, input); }),
    paperOrders: protectedProcedure.query(({ ctx }) => listPaperOrders(ctx.user.id)),
    paperAccount: protectedProcedure.input(z.object({ prices: z.record(z.string(), z.number()).default({}) })).query(({ ctx, input }) => paperAccountSummary(ctx.user.id, input.prices)),
    backtestRuns: protectedProcedure.query(({ ctx }) => listBacktestRuns(ctx.user.id)),
    replay: protectedProcedure.input(z.object({ bars: z.array(z.object({ timestamp: z.number(), open: z.number(), high: z.number(), low: z.number(), close: z.number(), volume: z.number() })).min(1), speed: z.number().positive().default(1) })).query(({ input }) => replayBars(input.bars, input.speed)),
    backtest: protectedProcedure.input(z.object({ name: z.string().min(1).max(120), bars: z.array(z.object({ timestamp: z.number(), open: z.number(), high: z.number(), low: z.number(), close: z.number(), volume: z.number() })).min(2), config: z.object({ minChangePct: z.number(), minRvol: z.number(), initialCapital: z.number().positive(), positionSize: z.number().positive() }) })).mutation(async ({ ctx, input }) => { const metrics = runScannerBacktest(input.bars, input.config); await createBacktestRun(ctx.user.id, input.name, input.config, metrics); return metrics; }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
