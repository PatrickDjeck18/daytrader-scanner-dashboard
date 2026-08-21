CREATE INDEX `backtestRuns_userId_idx` ON `backtestRuns` (`userId`);--> statement-breakpoint
CREATE INDEX `paperOrders_userId_idx` ON `paperOrders` (`userId`);--> statement-breakpoint
CREATE INDEX `paperOrders_symbol_idx` ON `paperOrders` (`symbol`);--> statement-breakpoint
CREATE INDEX `watchlistItems_watchlistId_idx` ON `watchlistItems` (`watchlistId`);--> statement-breakpoint
CREATE INDEX `watchlists_userId_idx` ON `watchlists` (`userId`);