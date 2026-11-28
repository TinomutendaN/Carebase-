import { sql } from "@/lib/db/client";
import { clinicTimeZone } from "@/lib/clinic-date";
import { initialsOf, timeAgo } from "@/lib/format";

export type RecentPatient = {
  id: string;
  name: string;
  initials: string;
  mrn: string;
  birthDate: string;
  viewedAt: string;
  /** "5 min ago", worked out on the server so every render agrees. */
  viewedLabel: string;
};

/**
 * The patients this account opened most recently, newest first, read from the
 * audit log's "Viewed record" rows (no separate table).
 */
export async function getRecentlyViewed(email: string, limit = 6): Promise<RecentPatient[]> {
  const rows = await sql`
    SELECT p.id, p.first_name, p.last_name, p.mrn, p.birth_date::text AS birth_date, r.viewed_at
    FROM (
      SELECT record_id, max(occurred_at) AS viewed_at
      FROM audit_log
      WHERE account_email = ${email} AND kind = 'view' AND action = 'Viewed record' AND record_type = 'patient'
      GROUP BY record_id
      ORDER BY viewed_at DESC
      LIMIT ${limit}
    ) r
    JOIN patients p ON p.id::text = r.record_id
    ORDER BY r.viewed_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    name: `${r.first_name} ${r.last_name}`,
    initials: initialsOf(r.first_name, r.last_name),
    mrn: r.mrn,
    birthDate: r.birth_date,
    viewedAt: new Date(r.viewed_at).toISOString(),
    viewedLabel: timeAgo(new Date(r.viewed_at).toISOString()),
  }));
}

/** The audit action for every assistant question. The daily cap counts these rows. */
export const ASKED_ASSISTANT = "Asked the assistant about";

/**
 * Assistant questions asked today (clinic time zone). The demo accounts are shared, so
 * this counts everyone on them. Test runner accounts have a cap of their own (test: true),
 * so test runs never use up the public demo's questions.
 */
export async function countAssistantQuestionsToday(today: string, { test = false }: { test?: boolean } = {}): Promise<number> {
  const rows = await sql`
    SELECT count(*)::int AS n FROM audit_log
    WHERE action = ${ASKED_ASSISTANT} AND (occurred_at AT TIME ZONE ${clinicTimeZone()})::date = ${today}::date
      AND (account_email IN (SELECT email FROM accounts WHERE is_test)) = ${test}
  `;
  return Number(rows[0].n);
}
