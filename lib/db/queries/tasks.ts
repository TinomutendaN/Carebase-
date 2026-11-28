import type { TaskScope } from "@/lib/access";
import { clinicTimeZone, weekStart } from "@/lib/clinic-date";
import { sql } from "@/lib/db/client";
import { initialsOf } from "@/lib/format";

/**
 * Tasks for the Tasks screen, the sidebar badge, the top-bar bell and (Step 11)
 * the Dashboard. Every function takes a TaskScope from lib/access.ts, so all of
 * them agree on whose tasks count. "today" is clinicToday(), never the server's date.
 */

export type DueStatus = "overdue" | "today" | "upcoming";

export function dueStatus(dueOn: string, today: string): DueStatus {
  return dueOn < today ? "overdue" : dueOn === today ? "today" : "upcoming";
}

export type TaskRow = {
  id: number;
  title: string;
  detail: string | null;
  source: "lab" | "staff";
  dueOn: string;
  status: DueStatus;
  patientId: string;
  patientName: string;
  patientInitials: string;
  assigneeId: number;
  assigneeName: string;
};

export type TaskSummary = { open: number; overdue: number; dueToday: number; doneThisWeek: number };

/** Open tasks, most urgent first: due date, then lab before staff, then patient. */
export async function listOpenTasks(scope: TaskScope, today: string): Promise<TaskRow[]> {
  const rows = await sql`
    SELECT t.id::int AS id, t.title, t.detail, t.source, t.due_on::text AS due_on,
           p.id AS patient_id, p.first_name, p.last_name,
           a.id::int AS assignee_id, a.name AS assignee_name
    FROM tasks t
    JOIN patients p ON p.id = t.patient_id
    JOIN accounts a ON a.id = t.assignee_id
    WHERE t.status = 'open' AND (${scope.all} OR t.assignee_id = ${scope.accountId})
    ORDER BY t.due_on, (t.source = 'staff'), p.last_name, p.first_name, t.id
  `;
  return rows.map((r) => ({
    id: Number(r.id),
    title: r.title,
    detail: r.detail,
    source: r.source,
    dueOn: r.due_on,
    status: dueStatus(r.due_on, today),
    patientId: r.patient_id,
    patientName: `${r.first_name} ${r.last_name}`,
    patientInitials: initialsOf(r.first_name, r.last_name),
    assigneeId: Number(r.assignee_id),
    assigneeName: r.assignee_name,
  }));
}

/** The four summary cards: open, overdue, due today, and done since Monday (clinic time). */
export async function getTaskSummary(scope: TaskScope, today: string): Promise<TaskSummary> {
  const tz = clinicTimeZone();
  const monday = weekStart(today);
  const rows = await sql`
    SELECT
      count(*) FILTER (WHERE status = 'open')::int AS open,
      count(*) FILTER (WHERE status = 'open' AND due_on < ${today}::date)::int AS overdue,
      count(*) FILTER (WHERE status = 'open' AND due_on = ${today}::date)::int AS due_today,
      count(*) FILTER (WHERE status = 'done' AND (completed_at AT TIME ZONE ${tz})::date >= ${monday}::date)::int AS done_this_week
    FROM tasks
    WHERE ${scope.all} OR assignee_id = ${scope.accountId}
  `;
  const r = rows[0];
  return { open: Number(r.open), overdue: Number(r.overdue), dueToday: Number(r.due_today), doneThisWeek: Number(r.done_this_week) };
}

/** Open tasks due today or earlier, for the top-bar bell. */
export async function countDueToday(scope: TaskScope, today: string): Promise<number> {
  const rows = await sql`
    SELECT count(*)::int AS n FROM tasks
    WHERE status = 'open' AND due_on <= ${today}::date AND (${scope.all} OR assignee_id = ${scope.accountId})
  `;
  return Number(rows[0].n);
}

export type LatestAutoTask = {
  taskId: number;
  title: string;
  dueOn: string;
  labDay: string;
  assigneeName: string;
  patientName: string;
  result: { code: string; name: string; value: number; unit: string; low: number | null; high: number | null } | null;
};

/**
 * The most recently created automatic (lab) task, for the "Automatic follow-ups"
 * panel. Includes lab values: callers check can(role, "lab_results") first.
 */
export async function getLatestAutoTask(): Promise<LatestAutoTask | null> {
  const rows = await sql`
    SELECT t.id::int AS id, t.title, t.due_on::text AS due_on, t.lab_day::text AS lab_day,
           a.name AS assignee_name, p.first_name || ' ' || p.last_name AS patient_name,
           l.code, l.name AS lab_name, l.value::float8 AS value, l.unit,
           l.normal_low::float8 AS low, l.normal_high::float8 AS high
    FROM tasks t
    JOIN accounts a ON a.id = t.assignee_id
    JOIN patients p ON p.id = t.patient_id
    LEFT JOIN lab_results l ON l.id = t.lab_result_id
    WHERE t.source = 'lab'
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    taskId: Number(r.id),
    title: r.title,
    dueOn: r.due_on,
    labDay: r.lab_day,
    assigneeName: r.assignee_name,
    patientName: r.patient_name,
    result: r.code
      ? {
          code: r.code,
          name: r.lab_name,
          value: Number(r.value),
          unit: r.unit,
          low: r.low == null ? null : Number(r.low),
          high: r.high == null ? null : Number(r.high),
        }
      : null,
  };
}

export type TaskForCompletion = { id: number; title: string; status: string; assigneeId: number; assigneeName: string; patientName: string };

export async function getTaskForCompletion(id: number): Promise<TaskForCompletion | null> {
  const rows = await sql`
    SELECT t.id::int AS id, t.title, t.status, t.assignee_id::int AS assignee_id, a.name AS assignee_name,
           p.first_name || ' ' || p.last_name AS patient_name
    FROM tasks t JOIN accounts a ON a.id = t.assignee_id JOIN patients p ON p.id = t.patient_id
    WHERE t.id = ${id}
  `;
  const r = rows[0];
  if (!r) return null;
  return { id: Number(r.id), title: r.title, status: r.status, assigneeId: Number(r.assignee_id), assigneeName: r.assignee_name, patientName: r.patient_name };
}

/** Marks an open task done. False if it was already done (or doesn't exist). */
export async function completeTask(id: number): Promise<boolean> {
  const rows = await sql`
    UPDATE tasks SET status = 'done', completed_at = now() WHERE id = ${id} AND status = 'open' RETURNING id
  `;
  return rows.length > 0;
}
