import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
try {
  const result = await pool.query(`
    SELECT c."id", c."userId", c."scheduleMinutes", c."enabled", c."tradingMode", c."scheduleCronTaskUid", c."lastRunAt", c."lastRunStatus",
           t."intervalMinutes", t."taskUid" AS "registeredTaskUid"
    FROM "paperBotConfigs" c
    LEFT JOIN "paperBotScheduleTasks" t ON t."intervalMinutes" = c."scheduleMinutes"
    WHERE c."enabled" = 1 AND c."tradingMode" = 'paper'
    ORDER BY c."id"
  `);
  console.log(JSON.stringify(result.rows, null, 2));
} finally {
  await pool.end();
}
