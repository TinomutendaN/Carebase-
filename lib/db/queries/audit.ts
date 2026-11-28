import { sql } from "@/lib/db/client";
import { clinicClock, clinicTimeZone } from "@/lib/clinic-date";
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

// ---------- The Admin audit log viewer ----------

export const AUDIT_KINDS = ["view", "change", "blocked"] as const;
export type AuditKind = (typeof AUDIT_KINDS)[number];

/** The audit action for every export, used to find the last one. */
export const EXPORTED_DATA = "Exported de-identified data";

export type AuditEvent = {
  id: number;
  occurredAt: string;
  /** Clinic wall-clock time and zone, e.g. "11:42" and "EST". */
  time: string;
  zone: string;
  kind: AuditKind;
  action: string;
  /** Role at the time of the event (system for automatic actions). */
  role: string;
  email: string;
  /** Account name and initials now, or null if the account no longer exists. */
  name: string | null;
  initials: string | null;
  isTest: boolean;
  recordLabel: string | null;
  recordType: string;
  /** The patient this record belongs to, when there is one that still exists. */
  patientId: string | null;
};

export type AuditCounts = Record<"all" | AuditKind, number> & { testRows: number };

/**
 * One page of a clinic day's events, newest first. The day is the clinic's midnight
 * to midnight, as a time range so the occurred_at index is used. Paged by id
 * (`before`), so new rows arriving don't shift the pages. Read-only: nothing here
 * changes audit rows.
 */
export async function listAuditEvents({ day, kind, includeTests, before, limit = 25 }: {
  day: string;
  kind: "all" | AuditKind;
  includeTests: boolean;
  before?: number;
  limit?: number;
}): Promise<{ events: AuditEvent[]; nextBefore: number | null }> {
  const zone = clinicTimeZone();
  const rows = await sql`
    SELECT a.id::int, a.occurred_at, a.kind, a.action, a.role, a.account_email, a.record_type, a.record_label,
           acc.name, acc.initials, coalesce(acc.is_test, false) AS is_test,
           coalesce(p.id, tp.id, dp.id)::text AS patient_id
    FROM audit_log a
    LEFT JOIN accounts acc ON acc.email = a.account_email
    LEFT JOIN patients p ON a.record_type = 'patient' AND p.id::text = a.record_id
    LEFT JOIN tasks t ON a.record_type = 'task' AND t.id::text = a.record_id
    LEFT JOIN patients tp ON tp.id = t.patient_id
    LEFT JOIN intake_documents d ON a.record_type = 'intake_document' AND d.id::text = a.record_id
    LEFT JOIN patients dp ON dp.id = d.patient_id
    WHERE a.occurred_at >= (${day}::date::timestamp AT TIME ZONE ${zone})
      AND a.occurred_at < ((${day}::date + 1)::timestamp AT TIME ZONE ${zone})
      AND (${includeTests} OR a.account_email NOT IN (SELECT email FROM accounts WHERE is_test))
      AND (${kind} = 'all' OR a.kind = ${kind})
      AND (${before ?? null}::bigint IS NULL OR a.id < ${before ?? null}::bigint)
    ORDER BY a.id DESC
    LIMIT ${limit + 1}
  `;
  const events = rows.slice(0, limit).map((r) => ({
    id: Number(r.id),
    occurredAt: new Date(r.occurred_at).toISOString(),
    ...clinicClock(new Date(r.occurred_at)),
    kind: r.kind as AuditKind,
    action: r.action,
    role: r.role,
    email: r.account_email,
    name: r.name,
    initials: r.initials,
    isTest: r.is_test,
    recordLabel: r.record_label,
    recordType: r.record_type,
    patientId: r.patient_id,
  }));
  return { events, nextBefore: rows.length > limit ? events[events.length - 1].id : null };
}

/** The tab counts for one clinic day, and how many test-account rows that day has. */
export async function countAuditEvents(day: string, includeTests: boolean): Promise<AuditCounts> {
  const zone = clinicTimeZone();
  const rows = await sql`
    SELECT a.kind, (a.account_email IN (SELECT email FROM accounts WHERE is_test)) AS is_test, count(*)::int AS n
    FROM audit_log a
    WHERE a.occurred_at >= (${day}::date::timestamp AT TIME ZONE ${zone})
      AND a.occurred_at < ((${day}::date + 1)::timestamp AT TIME ZONE ${zone})
    GROUP BY 1, 2
  `;
  const counts: AuditCounts = { all: 0, view: 0, change: 0, blocked: 0, testRows: 0 };
  for (const r of rows) {
    if (r.is_test) counts.testRows += r.n;
    if (r.is_test && !includeTests) continue;
    counts.all += r.n;
    counts[r.kind as AuditKind] += r.n;
  }
  return counts;
}

/** The most recent export, by anyone, for "Last export 11:05 today by Demo Admin". */
export async function getLastExport(): Promise<{ occurredAt: string; name: string } | null> {
  const rows = await sql`
    SELECT a.occurred_at, coalesce(acc.name, a.account_email) AS name
    FROM audit_log a LEFT JOIN accounts acc ON acc.email = a.account_email
    WHERE a.action = ${EXPORTED_DATA} AND a.kind = 'change'
    ORDER BY a.id DESC LIMIT 1
  `;
  return rows[0] ? { occurredAt: new Date(rows[0].occurred_at).toISOString(), name: rows[0].name } : null;
}
