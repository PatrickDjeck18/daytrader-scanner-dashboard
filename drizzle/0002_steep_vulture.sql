CREATE TABLE `auditEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(80) NOT NULL,
	`resource` varchar(120) NOT NULL,
	`metadata` text NOT NULL,
	`requestId` varchar(80),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `providerHealth` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(40) NOT NULL,
	`status` enum('healthy','degraded','offline') NOT NULL DEFAULT 'offline',
	`lastSuccessAt` timestamp,
	`lastFailureAt` timestamp,
	`lastError` text,
	`latencyMs` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `providerHealth_id` PRIMARY KEY(`id`),
	CONSTRAINT `providerHealth_provider_unique` UNIQUE(`provider`)
);
