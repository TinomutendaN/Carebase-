import { sql } from "@/lib/db/client";
import { ageFrom, capitalize, initialsOf } from "@/lib/format";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Patient ids are UUIDs; anything else can't match a record. */
export function isPatientId(value: string): boolean {
  return UUID.test(value);
}

// ---------- Search ----------

export type PatientMatch = { id: string; name: string; initials: string; mrn: string; birthDate: string };
export type SearchResult = { patients: PatientMatch[]; total: number; ms: number };

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_LIMIT = 8;

/** Escapes LIKE wildcards so "%" or "_" in a search match literally. */
function likeEscape(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Patients whose full name or MRN contains the text (trigram indexes on both).
 * Exact MRN first, then names that start with it, then A–Z. `ms` is the time
 * the database query took, measured here on the server.
 */
export async function searchPatients(query: string): Promise<SearchResult> {
  const q = query.trim();
  const contains = `%${likeEscape(q)}%`;
  const prefix = `${likeEscape(q)}%`;

  const started = performance.now();
  const rows = await sql`
    SELECT id, first_name, last_name, mrn, birth_date::text AS birth_date, count(*) OVER ()::int AS total
    FROM patients
    WHERE (first_name || ' ' || last_name) ILIKE ${contains} OR mrn ILIKE ${contains}
    ORDER BY (mrn = ${q}) DESC,
             ((first_name || ' ' || last_name) ILIKE ${prefix} OR last_name ILIKE ${prefix}) DESC,
             last_name, first_name
    LIMIT ${SEARCH_LIMIT}
  `;
  const ms = Math.round(performance.now() - started);

  return {
    patients: rows.map((r) => ({
      id: r.id,
      name: `${r.first_name} ${r.last_name}`,
      initials: initialsOf(r.first_name, r.last_name),
      mrn: r.mrn,
      birthDate: r.birth_date,
    })),
    total: rows.length ? Number(rows[0].total) : 0,
    ms,
  };
}

// ---------- Patient page ----------

export type PatientSummary = {
  id: string;
  name: string;
  initials: string;
  mrn: string;
  age: number;
  sex: string | null;
  lastVisit: string | null;
};

/** Header details, or null when no patient has this id. */
export async function getPatient(id: string): Promise<PatientSummary | null> {
  if (!isPatientId(id)) return null;
  const rows = await sql`
    SELECT p.id, p.first_name, p.last_name, p.mrn, p.birth_date::text AS birth_date, p.sex,
           (SELECT max(visited_at)::date::text FROM visits v WHERE v.patient_id = p.id) AS last_visit
    FROM patients p WHERE p.id = ${id}
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    name: `${r.first_name} ${r.last_name}`,
    initials: initialsOf(r.first_name, r.last_name),
    mrn: r.mrn,
    age: ageFrom(r.birth_date),
    sex: r.sex ? capitalize(r.sex) : null,
    lastVisit: r.last_visit,
  };
}

export type Allergy = { id: string; substance: string; severity: string | null };

export async function getAllergies(patientId: string): Promise<Allergy[]> {
  const rows = await sql`
    SELECT id::text, substance, severity FROM allergies
    WHERE patient_id = ${patientId}
    ORDER BY (severity = 'severe') DESC NULLS LAST, substance
  `;
  return rows as Allergy[];
}

export type Condition = { id: string; name: string; onsetOn: string | null };

/** Active conditions, newest onset first. */
export async function getActiveConditions(patientId: string): Promise<Condition[]> {
  const rows = await sql`
    SELECT id::text, name, onset_on::text AS onset_on FROM conditions
    WHERE patient_id = ${patientId} AND status = 'active'
    ORDER BY onset_on DESC NULLS LAST, name
  `;
  return rows.map((r) => ({ id: r.id, name: r.name, onsetOn: r.onset_on }));
}

export type WearableKind = "heart_rate" | "sleep_hours" | "steps";
export type WearableSeries = { kind: WearableKind; values: number[]; average: number | null };

/** The last 14 days of each wearable reading, oldest first, with the 14-day average. */
export async function getWearables(patientId: string): Promise<Record<WearableKind, WearableSeries>> {
  const rows = await sql`
    SELECT kind, value::float8 AS value
    FROM wearable_readings
    WHERE patient_id = ${patientId}
      AND measured_on > (SELECT max(measured_on) FROM wearable_readings WHERE patient_id = ${patientId}) - 14
    ORDER BY kind, measured_on
  `;
  const series = (kind: WearableKind): WearableSeries => {
    const values = rows.filter((r) => r.kind === kind).map((r) => Number(r.value));
    const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    return { kind, values, average };
  };
  return { heart_rate: series("heart_rate"), sleep_hours: series("sleep_hours"), steps: series("steps") };
}

export type TimelineEntry =
  | { type: "visit"; id: string; date: string; title: string; detail: string | null }
  | { type: "medication"; id: string; date: string; title: string; detail: string | null; event: "started" | "stopped" }
  | {
      type: "lab";
      id: string;
      date: string;
      code: string;
      name: string;
      value: number;
      unit: string;
      low: number | null;
      high: number | null;
    };

export const TIMELINE_LIMIT = 300;

/**
 * Visits, medication starts and stops, and lab results, newest first. Within a day:
 * visits, then the main labs in `labCodes` order, then other labs, then medications.
 * Lab rows: every result for `labCodes` plus any out-of-range result.
 * With `includeLabs` false (Front Desk) the database returns no lab rows at all.
 */
export async function getTimeline(
  patientId: string,
  { includeLabs, labCodes }: { includeLabs: boolean; labCodes: string[] },
): Promise<TimelineEntry[]> {
  const rows = await sql`
    SELECT * FROM (
      SELECT 'visit' AS type, 'visit-' || id AS id, visited_at AS sort_at, visited_at::date::text AS date,
             kind AS title, coalesce(reason, 'With ' || provider_name) AS detail,
             NULL::text AS code, NULL::float8 AS value, NULL::text AS unit, NULL::float8 AS low, NULL::float8 AS high, NULL::text AS event
      FROM visits WHERE patient_id = ${patientId}
      UNION ALL
      SELECT 'medication', 'med-start-' || id, started_on::timestamptz, started_on::text,
             name, dose, NULL, NULL, NULL, NULL, NULL, 'started'
      FROM medications WHERE patient_id = ${patientId} AND started_on IS NOT NULL
      UNION ALL
      SELECT 'medication', 'med-stop-' || id, stopped_on::timestamptz, stopped_on::text,
             name, dose, NULL, NULL, NULL, NULL, NULL, 'stopped'
      FROM medications WHERE patient_id = ${patientId} AND stopped_on IS NOT NULL
      UNION ALL
      SELECT 'lab', 'lab-' || id, taken_at, taken_at::date::text,
             name, NULL, code, value::float8, unit, normal_low::float8, normal_high::float8, NULL
      FROM lab_results
      WHERE ${includeLabs}::boolean AND patient_id = ${patientId}
        AND (code = ANY(${labCodes}::text[]) OR value > normal_high OR value < normal_low)
    ) t
    ORDER BY date DESC,
             CASE type WHEN 'visit' THEN 0 WHEN 'lab' THEN 1 ELSE 2 END,
             array_position(${labCodes}::text[], code) NULLS LAST,
             sort_at DESC, title
    LIMIT ${TIMELINE_LIMIT}
  `;

  return rows.map((r): TimelineEntry => {
    if (r.type === "lab") {
      return {
        type: "lab",
        id: r.id,
        date: r.date,
        code: r.code,
        name: r.title,
        value: Number(r.value),
        unit: r.unit,
        low: r.low == null ? null : Number(r.low),
        high: r.high == null ? null : Number(r.high),
      };
    }
    if (r.type === "medication") {
      return { type: "medication", id: r.id, date: r.date, title: r.title, detail: r.detail, event: r.event };
    }
    return { type: "visit", id: r.id, date: r.date, title: r.title, detail: r.detail };
  });
}
