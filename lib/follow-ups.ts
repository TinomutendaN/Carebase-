import { logChange, SYSTEM_ACTOR } from "@/lib/audit";
import { addDays, clinicTimeZone, clinicToday } from "@/lib/clinic-date";
import { sql } from "@/lib/db/client";
import { labShortName, labStatus, labValueText } from "@/lib/lab-display";

/**
 * Out-of-range lab result → follow-up task. One task per patient per lab day,
 * titled after that day's most important result, with the others listed in the
 * detail. Assigned to the clinician, due 2 days after the result.
 *
 * Safe to run any number of times: a (patient, lab day) that already has a task
 * is never given a second one. If new results arrive for a day that already has
 * a task, that task is updated (or reopened, if it was done). Run after importing
 * (npm run db:follow-ups) and whenever a lab result is added (addLabResult).
 */

/** Only recent results create tasks: today and the 6 days before it. */
export const FOLLOW_UP_WINDOW_DAYS = 7;
/** Tasks are due this many days after the result. */
export const DUE_AFTER_DAYS = 2;

export type OutOfRangeResult = {
  id: number;
  code: string;
  /** Short name, e.g. "HbA1c". */
  name: string;
  value: number;
  unit: string;
  low: number | null;
  high: number | null;
};

type Direction = "above" | "below";

/**
 * Which results matter most, in order. HbA1c counts only when it's high (a low
 * HbA1c isn't a diabetes concern). Anything not listed ranks below these, by how
 * far it is outside its range.
 */
const PRIORITY: { codes: string[]; only?: Direction }[] = [
  { codes: ["4548-4"], only: "above" }, // HbA1c
  { codes: ["2339-0", "2345-7"] }, // Glucose
  { codes: ["2160-0", "38483-4"] }, // Creatinine
  { codes: ["33914-3"] }, // eGFR
  { codes: ["18262-6"] }, // LDL
  { codes: ["6298-4", "2823-3"] }, // Potassium
  { codes: ["2947-0", "2951-2"] }, // Sodium
];

function direction(r: OutOfRangeResult): Direction {
  return labStatus(r.value, r.low, r.high) === "below" ? "below" : "above";
}

/** How far outside its range, relative to the limit it crossed (0.3 = 30% past it). */
function distance(r: OutOfRangeResult): number {
  const limit = direction(r) === "above" ? r.high : r.low;
  if (limit == null) return 0;
  return Math.abs(r.value - limit) / Math.max(Math.abs(limit), 1e-9);
}

function rank(r: OutOfRangeResult): number {
  const i = PRIORITY.findIndex((p) => p.codes.includes(r.code) && (!p.only || p.only === direction(r)));
  return i === -1 ? PRIORITY.length : i;
}

/** The result a day's task is titled after: highest priority, then furthest out of range, then lowest id. */
export function pickMainResult(results: OutOfRangeResult[]): OutOfRangeResult {
  if (results.length === 0) throw new Error("pickMainResult needs at least one result.");
  return [...results].sort((a, b) => rank(a) - rank(b) || distance(b) - distance(a) || a.id - b.id)[0];
}

/** "HbA1c" stays as it is; "Glucose" → "glucose", for use mid-sentence. */
function inSentence(name: string): string {
  return /[A-Z]/.test(name.slice(1)) ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

/** "Review high HbA1c result" */
export function taskTitle(main: OutOfRangeResult): string {
  return `Review ${direction(main) === "above" ? "high" : "low"} ${inSentence(main.name)} result`;
}

/** "HbA1c 7.3%, above range · 2 more out of range: Glucose, LDL" */
export function taskDetail(main: OutOfRangeResult, results: OutOfRangeResult[]): string {
  const lead = `${main.name} ${labValueText(main.value, main.unit)}, ${direction(main)} range`;
  const others = [...new Set(
    [...results].sort((a, b) => rank(a) - rank(b) || distance(b) - distance(a)).map((r) => r.name),
  )].filter((n) => n !== main.name);
  return others.length ? `${lead} · ${others.length} more out of range: ${others.join(", ")}` : lead;
}

export type FollowUpChange = {
  taskId: number;
  patientId: string;
  patientName: string;
  labDay: string;
  title: string;
  dueOn: string;
};

type ResultRow = OutOfRangeResult & { patientId: string; patientName: string; labDay: string; addedAt: number };
type TaskRow = {
  id: number;
  status: string;
  title: string;
  detail: string | null;
  labResultId: number | null;
  completedAt: number | null;
};

/**
 * Create (or update) follow-up tasks for recent out-of-range results.
 * Pass patientId to look at one patient only, e.g. after adding their result.
 */
export async function createFollowUps(options: { patientId?: string; windowDays?: number } = {}): Promise<{
  created: FollowUpChange[];
  updated: FollowUpChange[];
  reopened: FollowUpChange[];
}> {
  const windowDays = options.windowDays ?? FOLLOW_UP_WINDOW_DAYS;
  const patientId = options.patientId ?? null;
  const tz = clinicTimeZone();
  const today = clinicToday();
  const firstDay = addDays(today, -(windowDays - 1));

  const rows = await sql`
    SELECT l.id::int AS id, l.patient_id, l.code, l.name, l.value::float8 AS value, l.unit,
           l.normal_low::float8 AS low, l.normal_high::float8 AS high,
           (l.taken_at AT TIME ZONE ${tz})::date::text AS lab_day,
           l.created_at, p.first_name || ' ' || p.last_name AS patient_name
    FROM lab_results l
    JOIN patients p ON p.id = l.patient_id
    WHERE (l.value < l.normal_low OR l.value > l.normal_high)
      AND l.taken_at >= ${firstDay}::date - 1          -- coarse bound so the taken_at index is used
      AND (l.taken_at AT TIME ZONE ${tz})::date BETWEEN ${firstDay}::date AND ${today}::date
      AND (${patientId}::uuid IS NULL OR l.patient_id = ${patientId}::uuid)
    ORDER BY l.patient_id, lab_day, l.id
  `;
  const results: ResultRow[] = rows.map((r) => ({
    id: Number(r.id),
    patientId: r.patient_id,
    patientName: r.patient_name,
    labDay: r.lab_day,
    code: r.code,
    name: labShortName(r.code, r.name),
    value: Number(r.value),
    unit: r.unit,
    low: r.low == null ? null : Number(r.low),
    high: r.high == null ? null : Number(r.high),
    addedAt: new Date(r.created_at).getTime(),
  }));
  if (results.length === 0) return { created: [], updated: [], reopened: [] };

  const groups = new Map<string, ResultRow[]>();
  for (const r of results) {
    const key = `${r.patientId}|${r.labDay}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const taskRows = await sql`
    SELECT id::int AS id, patient_id, lab_day::text AS lab_day, status, title, detail,
           lab_result_id::int AS lab_result_id, completed_at
    FROM tasks
    WHERE source = 'lab' AND lab_day BETWEEN ${firstDay}::date AND ${today}::date
      AND (${patientId}::uuid IS NULL OR patient_id = ${patientId}::uuid)
  `;
  const existing = new Map<string, TaskRow>(
    taskRows.map((t) => [
      `${t.patient_id}|${t.lab_day}`,
      {
        id: Number(t.id),
        status: t.status,
        title: t.title,
        detail: t.detail,
        labResultId: t.lab_result_id == null ? null : Number(t.lab_result_id),
        completedAt: t.completed_at == null ? null : new Date(t.completed_at).getTime(),
      },
    ]),
  );

  const assignee = await clinicianAccount();
  const created: FollowUpChange[] = [];
  const updated: FollowUpChange[] = [];
  const reopened: FollowUpChange[] = [];

  // Oldest lab day first, so the newest result's task is the one created last
  // (the "latest" in the Automatic follow-ups panel).
  const ordered = [...groups].sort(([, a], [, b]) => a[0].labDay.localeCompare(b[0].labDay));
  for (const [key, group] of ordered) {
    const { patientId: pid, patientName, labDay } = group[0];
    const main = pickMainResult(group);
    const title = taskTitle(main);
    const detail = taskDetail(main, group);
    const dueOn = addDays(labDay, DUE_AFTER_DAYS);
    const change: Omit<FollowUpChange, "taskId"> = { patientId: pid, patientName, labDay, title, dueOn };
    const task = existing.get(key);

    if (!task) {
      // ON CONFLICT covers two runs racing each other.
      const inserted = await sql`
        INSERT INTO tasks (patient_id, title, detail, source, lab_result_id, lab_day, assignee_id, due_on)
        VALUES (${pid}, ${title}, ${detail}, 'lab', ${main.id}, ${labDay}, ${assignee.id}, ${dueOn})
        ON CONFLICT (patient_id, lab_day) WHERE source = 'lab' DO NOTHING
        RETURNING id::int AS id
      `;
      if (inserted.length === 0) continue;
      const taskId = Number(inserted[0].id);
      created.push({ taskId, ...change });
      await logChange(SYSTEM_ACTOR, "Created follow-up task", { type: "task", id: String(taskId), label: patientName }, {
        title,
        lab_result_id: main.id,
        results: group.length,
        assignee: assignee.name,
        due_on: dueOn,
      });
      continue;
    }

    if (task.status === "done") {
      // Reopen only for results that arrived after the task was completed; a
      // reviewed task stays done when nothing new has come in.
      const arrivedAfter = group.filter((r) => task.completedAt != null && r.addedAt > task.completedAt);
      if (arrivedAfter.length === 0) continue;
      const opened = await sql`
        UPDATE tasks SET status = 'open', completed_at = NULL, title = ${title}, detail = ${detail}, lab_result_id = ${main.id}
        WHERE id = ${task.id} AND status = 'done'
        RETURNING id
      `;
      if (opened.length === 0) continue;
      reopened.push({ taskId: task.id, ...change });
      await logChange(SYSTEM_ACTOR, "Reopened follow-up task", { type: "task", id: String(task.id), label: patientName }, {
        title,
        ...(task.title !== title ? { previous_title: task.title } : {}),
        title_changed: task.title !== title,
        lab_result_id: main.id,
        new_result_ids: arrivedAfter.map((r) => r.id),
        result_ids: group.map((r) => r.id),
        results: group.length,
      });
      continue;
    }

    if (task.title === title && task.detail === detail && task.labResultId === main.id) continue;

    const changed = await sql`
      UPDATE tasks SET title = ${title}, detail = ${detail}, lab_result_id = ${main.id}
      WHERE id = ${task.id} AND status = 'open'
      RETURNING id
    `;
    if (changed.length === 0) continue;
    updated.push({ taskId: task.id, ...change });
    await logChange(SYSTEM_ACTOR, "Updated follow-up task", { type: "task", id: String(task.id), label: patientName }, {
      title,
      ...(task.title !== title ? { previous_title: task.title } : {}),
      title_changed: task.title !== title,
      lab_result_id: main.id,
      result_ids: group.map((r) => r.id),
      results: group.length,
    });
  }

  return { created, updated, reopened };
}

/** Lab follow-ups go to the clinician (the first clinician account). */
async function clinicianAccount(): Promise<{ id: number; name: string }> {
  const rows = await sql`SELECT id::int AS id, name FROM accounts WHERE role = 'clinician' ORDER BY id LIMIT 1`;
  if (rows.length === 0) throw new Error("No clinician account to assign follow-up tasks to. Run npm run db:schema.");
  return { id: Number(rows[0].id), name: rows[0].name };
}
