CREATE TABLE `alertRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`symbol` varchar(16),
	`condition` text NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alertRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `backtestRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`strategy` text NOT NULL,
	`metrics` text NOT NULL,
	`status` enum('queued','running','completed','failed') NOT NULL DEFAULT 'queued',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `backtestRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paperOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(16) NOT NULL,
	`side` enum('buy','sell') NOT NULL,
	`quantity` decimal(18,4) NOT NULL,
	`orderType` enum('market','limit') NOT NULL DEFAULT 'market',
	`limitPrice` decimal(18,4),
	`fillPrice` decimal(18,4),
	`status` enum('submitted','filled','cancelled') NOT NULL DEFAULT 'submitted',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `paperOrders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `replaySessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(16) NOT NULL,
	`startAt` timestamp NOT NULL,
	`endAt` timestamp NOT NULL,
	`speed` decimal(8,2) NOT NULL DEFAULT '1',
	`status` enum('created','running','paused','completed') NOT NULL DEFAULT 'created',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `replaySessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scannerPresets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`scanner` varchar(80) NOT NULL,
	`thresholds` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scannerPresets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `watchlistItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`watchlistId` int NOT NULL,
	`symbol` varchar(16) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`alertsMuted` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `watchlistItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `watchlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`columns` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `watchlists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspaceLayouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`layout` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspaceLayouts_id` PRIMARY KEY(`id`)
);
