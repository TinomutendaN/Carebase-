import { sql } from "@/lib/db/client";

/**
 * Sidebar badge counts: intake documents waiting for review, and the account's
 * own open tasks. Both are 0 (badge hidden) until Steps 6 and 7 add rows.
 */
export async function getSidebarCounts(accountId: number): Promise<{ intake: number; tasks: number }> {
  const rows = await sql`
    SELECT
      (SELECT count(*) FROM intake_documents WHERE status = 'pending')::int AS intake,
      (SELECT count(*) FROM tasks WHERE status = 'open' AND assignee_id = ${accountId})::int AS tasks
  `;
  return { intake: Number(rows[0].intake), tasks: Number(rows[0].tasks) };
}
