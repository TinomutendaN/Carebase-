/**
 * Apply db/seed.sql (sample staff tasks), with due dates relative to the
 * clinic's today. Safe to run more than once. Run with: npm run db:seed
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "@neondatabase/serverless";
import { clinicTimeZone, clinicToday } from "../lib/clinic-date";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set. Add it to .env.local.");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    // Session settings read by seed.sql; one client so they apply to the same connection.
    await client.query("SELECT set_config('carebase.today', $1, false), set_config('carebase.tz', $2, false)", [
      clinicToday(),
      clinicTimeZone(),
    ]);
    const result = await client.query(readFileSync(join(process.cwd(), "db", "seed.sql"), "utf8"));
    console.log(`Clinic today: ${clinicToday()} (${clinicTimeZone()})`);
    console.log(`Staff tasks inserted: ${result.rowCount ?? 0} (existing ones are left as they are).`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
