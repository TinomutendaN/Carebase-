import { sql } from "@/lib/db/client";
import { PRODUCTION_URL, type TestRun } from "@/lib/test-runs";

export { PRODUCTION_URL, TEST_CATEGORIES, type TestCategory, type TestResult, type TestRun } from "@/lib/test-runs";

/**
 * Saved test runs (scripts/run-tests.ts). The public Tests page shows the latest
 * run against the live site; local runs are kept but only shown when asked for.
 */

/** Which run to show: the latest live one (default), the latest local one, or one by its id. */
export type RunChoice = { kind: "live" } | { kind: "latest-local" } | { kind: "id"; id: number };

/** "?run=latest-local" or "?run=12"; anything else means the latest live run. */
export function runChoice(param: string | string[] | undefined): RunChoice {
  if (param === "latest-local") return { kind: "latest-local" };
  if (typeof param === "string" && /^\d{1,9}$/.test(param)) return { kind: "id", id: Number(param) };
  return { kind: "live" };
}

/** The chosen run with every result, or null if there's none. */
export async function getRun(choice: RunChoice): Promise<TestRun | null> {
  const runs =
    choice.kind === "id"
      ? await sql`SELECT id::int AS id, ran_at, model, total, passed, base_url, duration_ms FROM test_runs WHERE id = ${choice.id}`
      : await sql`
          SELECT id::int AS id, ran_at, model, total, passed, base_url, duration_ms
          FROM test_runs
          WHERE (base_url IS NOT DISTINCT FROM ${PRODUCTION_URL}) = ${choice.kind === "live"}
          ORDER BY ran_at DESC
          LIMIT 1
        `;
  const run = runs[0];
  if (!run) return null;
  const rows = await sql`
    SELECT case_id, category, question, expected, passed, actual, reason, patient
    FROM test_results WHERE run_id = ${run.id}
    ORDER BY position NULLS LAST, case_id
  `;
  return {
    id: run.id,
    ranAt: new Date(run.ran_at).toISOString(),
    model: run.model,
    total: run.total,
    passed: run.passed,
    baseUrl: run.base_url,
    live: run.base_url === PRODUCTION_URL,
    durationMs: run.duration_ms,
    results: rows.map((r) => ({
      caseId: r.case_id,
      category: r.category,
      question: r.question,
      expected: r.expected,
      passed: r.passed,
      actual: r.actual,
      reason: r.reason,
      patient: r.patient,
    })),
  };
}
