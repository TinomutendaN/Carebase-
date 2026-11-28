import { sql } from "@/lib/db/client";
import type {
  ExportSource, SourceAllergy, SourceCondition, SourceLabRows, SourceLabTest, SourceMedication, SourcePatient, SourceVisit,
  SourceWearableRows,
} from "@/lib/deidentify";

/**
 * Everything the de-identified export reads, in one query per table (not one per
 * patient). Dates are cast ::text so they stay calendar dates. lib/deidentify.ts
 * decides what is kept; this only loads.
 *
 * Lab results (about 36,000) and wearable readings (18,000) are grouped per patient
 * in the database as compact [date, …, value] arrays, and each distinct lab test is
 * numbered once. Sending every row with its full lab name took 8–18 s from a laptop
 * and sometimes broke the connection; grouped, it's a few seconds.
 */
export async function loadExportSource(): Promise<ExportSource> {
  const [patients, visits, labTests, labs, medications, allergies, conditions, units, wearables] = await Promise.all([
    sql`
      SELECT id::text, mrn, first_name, last_name, birth_date::text AS birth_date, sex, phone, email, address,
             insurance_provider, insurance_member_id
      FROM patients ORDER BY mrn
    `,
    sql`
      SELECT patient_id::text, visited_at::date::text AS date, kind, reason, provider_name
      FROM visits ORDER BY patient_id, visited_at
    `,
    // Each distinct lab test (code, name, unit, normal range), numbered in a stable order.
    sql`
      SELECT code, name, unit, normal_low::float8 AS normal_low, normal_high::float8 AS normal_high,
             row_number() OVER (ORDER BY code, name, unit, normal_low, normal_high)::int AS n
      FROM (SELECT DISTINCT code, name, unit, normal_low, normal_high FROM lab_results) d
      ORDER BY n
    `,
    sql`
      WITH t AS (
        SELECT code, name, unit, normal_low, normal_high,
               row_number() OVER (ORDER BY code, name, unit, normal_low, normal_high)::int AS n
        FROM (SELECT DISTINCT code, name, unit, normal_low, normal_high FROM lab_results) d
      )
      SELECT l.patient_id::text,
             json_agg(json_build_array(l.taken_at::date::text, t.n, l.value::float8) ORDER BY l.taken_at, l.code)::text AS rows
      FROM lab_results l
      JOIN t ON t.code = l.code AND t.name = l.name AND t.unit = l.unit
        AND t.normal_low IS NOT DISTINCT FROM l.normal_low AND t.normal_high IS NOT DISTINCT FROM l.normal_high
      GROUP BY l.patient_id
    `,
    sql`
      SELECT patient_id::text, code, name, dose, status, started_on::text AS started_on, stopped_on::text AS stopped_on
      FROM medications ORDER BY patient_id, started_on NULLS LAST, name
    `,
    sql`
      SELECT patient_id::text, substance, reaction, severity, recorded_on::text AS recorded_on
      FROM allergies ORDER BY patient_id, substance
    `,
    sql`
      SELECT patient_id::text, code, name, status, onset_on::text AS onset_on, resolved_on::text AS resolved_on
      FROM conditions ORDER BY patient_id, onset_on NULLS LAST, name
    `,
    sql`SELECT DISTINCT kind, unit FROM wearable_readings ORDER BY kind`,
    sql`
      SELECT patient_id::text,
             json_agg(json_build_array(measured_on::text, kind, value::float8) ORDER BY measured_on, kind)::text AS rows
      FROM wearable_readings GROUP BY patient_id
    `,
  ]);
  return {
    patients: patients as SourcePatient[],
    visits: visits as SourceVisit[],
    labTests: labTests as SourceLabTest[],
    labs: labs.map((r) => ({ patient_id: r.patient_id, rows: JSON.parse(r.rows) })) as SourceLabRows[],
    medications: medications as SourceMedication[],
    allergies: allergies as SourceAllergy[],
    conditions: conditions as SourceCondition[],
    wearableUnits: Object.fromEntries(units.map((u) => [u.kind, u.unit])),
    wearables: wearables.map((r) => ({ patient_id: r.patient_id, rows: JSON.parse(r.rows) })) as SourceWearableRows[],
  };
}

export async function countPatients(): Promise<number> {
  const rows = await sql`SELECT count(*)::int AS n FROM patients`;
  return Number(rows[0].n);
}

/** The preview patient's identifying fields and latest lab date, or null if not found. */
export async function loadPreviewPatient(mrn: string): Promise<{ patient: SourcePatient; latestLabDate: string | null } | null> {
  const rows = await sql`
    SELECT p.id::text, p.mrn, p.first_name, p.last_name, p.birth_date::text AS birth_date, p.sex, p.phone, p.email,
           p.address, p.insurance_provider, p.insurance_member_id,
           (SELECT max(taken_at)::date::text FROM lab_results l WHERE l.patient_id = p.id) AS latest_lab
    FROM patients p WHERE p.mrn = ${mrn}
  `;
  if (!rows[0]) return null;
  const { latest_lab, ...patient } = rows[0];
  return { patient: patient as SourcePatient, latestLabDate: latest_lab };
}
