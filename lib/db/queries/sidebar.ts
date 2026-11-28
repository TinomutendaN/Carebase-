import type { TaskScope } from "@/lib/access";
import { sql } from "@/lib/db/client";

/**
 * Sidebar badge counts: intake documents waiting for review, and open tasks in
 * the account's scope (everyone's with tasks_all, otherwise their own).
 */
export async function getSidebarCounts(scope: TaskScope): Promise<{ intake: number; tasks: number }> {
  const rows = await sql`
    SELECT
      (SELECT count(*) FROM intake_documents WHERE status = 'pending')::int AS intake,
      (SELECT count(*) FROM tasks WHERE status = 'open' AND (${scope.all} OR assignee_id = ${scope.accountId}))::int AS tasks
  `;
  return { intake: Number(rows[0].intake), tasks: Number(rows[0].tasks) };
}
