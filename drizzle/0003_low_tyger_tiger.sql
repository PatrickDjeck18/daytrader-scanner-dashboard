ALTER TABLE `paperOrders` ADD `idempotencyKey` varchar(80);--> statement-breakpoint
ALTER TABLE `paperOrders` ADD CONSTRAINT `paperOrders_idempotencyKey_unique` UNIQUE(`idempotencyKey`);