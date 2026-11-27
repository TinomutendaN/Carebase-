/**
 * Checks the imported data: row counts, database size, coverage, patient search speed
 * and demo patient candidates. Run with: npm run db:check
 */
import { neon, Pool } from "@neondatabase/serverless";

const TABLES = [
  "accounts", "patients", "visits", "lab_results", "medications", "allergies", "conditions",
  "wearable_readings", "tasks", "intake_documents", "audit_log", "evidence_chunks", "test_runs", "test_results",
];

/** The kind of query the Step 5 search API will run: name or MRN contains the term. */
const SEARCH_SQL = `
  SELECT id, mrn, first_name, last_name FROM patients
  WHERE (first_name || ' ' || last_name) ILIKE $1 OR mrn ILIKE $1
  ORDER BY last_name, first_name LIMIT 10`;
const RUNS = 20;

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.ceil(xs.length * 0.95) - 1];
const ms = (n: number) => `${n.toFixed(1)} ms`;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set. Add it to .env.local.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const http = neon(process.env.DATABASE_URL);

  try {
    console.log("Row counts");
    for (const t of TABLES) {
      const { rows } = await pool.query(`SELECT count(*)::int AS n, pg_size_pretty(pg_total_relation_size('${t}')) AS size FROM ${t}`);
      console.log(`  ${t.padEnd(18)} ${String(rows[0].n).padStart(7)}   ${rows[0].size}`);
    }
    const { rows: size } = await pool.query("SELECT pg_size_pretty(pg_database_size(current_database())) AS size");
    console.log(`  Database size: ${size[0].size}`);

    const { rows: cov } = await pool.query(`
      SELECT
        count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM lab_results x WHERE x.patient_id = p.id))::int AS no_labs,
        count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM medications x WHERE x.patient_id = p.id))::int AS no_meds,
        count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM allergies x WHERE x.patient_id = p.id))::int AS no_allergies,
        count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM conditions x WHERE x.patient_id = p.id))::int AS no_conditions,
        count(*) FILTER (WHERE (SELECT count(DISTINCT measured_on) FROM wearable_readings x WHERE x.patient_id = p.id) < 14)::int AS under_14_wearable_days,
        count(DISTINCT mrn)::int AS distinct_mrns,
        count(*) FILTER (WHERE mrn !~ '^[0-9]{5}$')::int AS bad_mrns,
        count(*) FILTER (WHERE first_name ~ '[0-9]' OR last_name ~ '[0-9]')::int AS names_with_digits
      FROM patients p`);
    const { rows: dates } = await pool.query(
      "SELECT min(taken_at)::date AS first_lab, max(taken_at)::date AS last_lab, max(visited_at)::date AS last_visit FROM lab_results, (SELECT max(visited_at) AS visited_at FROM visits) v",
    );
    console.log("\nCoverage (patients missing each)");
    console.log(" ", cov[0]);
    console.log(" ", dates[0]);

    // Search speed
    const { rows: sample } = await pool.query("SELECT mrn FROM patients ORDER BY mrn LIMIT 1");
    const terms = ["Hammes", "missy", "bue", "an", sample[0].mrn as string];
    const client = await pool.connect();
    try {
      await client.query(SEARCH_SQL, ["%warm%"]);
      console.log(`\nSearch timing, ${RUNS} runs per term (round trip from this machine)`);
      console.log("  term        matches  pool median / p95      http median / p95      server exec");
      for (const term of terms) {
        const pattern = `%${term}%`;
        const poolTimes: number[] = [];
        const httpTimes: number[] = [];
        let matches = 0;
        for (let i = 0; i < RUNS; i++) {
          let t = performance.now();
          matches = (await client.query(SEARCH_SQL, [pattern])).rowCount ?? 0;
          poolTimes.push(performance.now() - t);
          t = performance.now();
          await http.query(SEARCH_SQL, [pattern]);
          httpTimes.push(performance.now() - t);
        }
        const { rows: plan } = await client.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${SEARCH_SQL}`, [pattern]);
        const exec = plan[0]["QUERY PLAN"][0]["Execution Time"] as number;
        console.log(
          `  ${term.padEnd(10)} ${String(matches).padStart(8)}  ${(ms(median(poolTimes)) + " / " + ms(p95(poolTimes))).padEnd(22)} ` +
            `${(ms(median(httpTimes)) + " / " + ms(p95(httpTimes))).padEnd(22)} ${ms(exec)}`,
        );
      }

      const show = async (title: string) => {
        const { rows } = await client.query(`EXPLAIN ANALYZE ${SEARCH_SQL}`, ["%Hammes%"]);
        console.log(`\n${title}`);
        for (const r of rows) console.log(`  ${r["QUERY PLAN"]}`);
      };
      await show("Plan the database picks (200 rows, so a sequential scan is cheapest):");
      await client.query("BEGIN");
      await client.query("SET LOCAL enable_seqscan = off");
      await show("Plan with sequential scans off, showing the trigram index is usable:");
      await client.query("COMMIT");
    } finally {
      client.release();
    }

    // Demo patients: type 2 diabetes, 3+ HbA1c results, latest above range and higher than the first.
    const { rows: demo } = await pool.query(`
      WITH a1c AS (
        SELECT patient_id, count(*)::int AS n,
               (array_agg(value ORDER BY taken_at))[1] AS first_value,
               (array_agg(value ORDER BY taken_at DESC))[1] AS last_value,
               max(normal_high) AS high,
               string_agg(value || ' (' || to_char(taken_at, 'YYYY-MM-DD') || ')', ' → ' ORDER BY taken_at) AS series
        FROM lab_results WHERE code = '4548-4' GROUP BY patient_id)
      SELECT p.first_name || ' ' || p.last_name AS name, p.mrn, a.n, a.series
      FROM a1c a JOIN patients p ON p.id = a.patient_id
      WHERE EXISTS (SELECT 1 FROM conditions c WHERE c.patient_id = p.id AND c.code = '44054006')
        AND a.n >= 3 AND a.last_value > a.high AND a.last_value > a.first_value
      ORDER BY a.last_value - a.first_value DESC`);
    console.log(`\nDemo patient candidates (${demo.length})`);
    for (const d of demo) console.log(`  ${d.name}, MRN ${d.mrn}, ${d.n} results: ${d.series}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
