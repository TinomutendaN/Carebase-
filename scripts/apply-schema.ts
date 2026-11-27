/**
 * Apply db/schema.sql to Neon and seed the three demo accounts.
 * Safe to run more than once. Run with: npm run db:schema
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "@neondatabase/serverless";

const DEMO_ACCOUNTS_SQL = `
  INSERT INTO accounts (email, name, initials, role) VALUES
    ('frontdesk@carebase.demo', 'Demo Front Desk', 'FD', 'front_desk'),
    ('clinician@carebase.demo', 'Demo Clinician',  'CL', 'clinician'),
    ('admin@carebase.demo',     'Demo Admin',      'AD', 'admin')
  ON CONFLICT (email) DO NOTHING
`;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set. Add it to .env.local.");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // Pool uses the simple query protocol, so the whole file runs in one call.
    await pool.query(readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8"));
    const seeded = await pool.query(DEMO_ACCOUNTS_SQL);

    const { rows } = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    );
    console.log(`Schema applied. ${rows.length} tables:`);
    for (const row of rows) console.log(`  ${row.table_name}`);
    console.log(`Demo accounts inserted: ${seeded.rowCount} (existing ones are left as they are).`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
