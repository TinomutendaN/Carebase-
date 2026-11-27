import { sql } from "@/lib/db/client";

/** The account's open tasks due today or earlier, for the top-bar bell. 0 until Step 7 adds tasks. */
export async function countDueToday(accountId: number): Promise<number> {
  const rows = await sql`
    SELECT count(*)::int AS n FROM tasks
    WHERE assignee_id = ${accountId} AND status = 'open' AND due_on <= current_date
  `;
  return Number(rows[0].n);
}
