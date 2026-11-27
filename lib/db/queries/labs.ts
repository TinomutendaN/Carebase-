import { sql } from "@/lib/db/client";
import { labShortName, MAIN_LAB_GROUPS, rangeCaption } from "@/lib/lab-display";
import { labRange } from "@/lib/lab-ranges";

/**
 * Lab results for the Patient page and the labs API. Callers must check
 * can(role, "lab_results") first; these functions don't know who is asking.
 */

export type LabCode = { code: string; name: string; unit: string; count: number };

export type LabSeries = {
  code: string;
  /** Short name, e.g. "HbA1c". */
  name: string;
  unit: string;
  low: number | null;
  high: number | null;
  /** "Normal range 4.0–5.6%" */
  rangeLabel: string;
  points: { id: string; date: string; value: number }[];
};

/**
 * The patient's main labs for the switcher (up to 3): HbA1c, glucose and LDL
 * when they have them, then their most frequent other lab codes.
 */
export async function getMainLabCodes(patientId: string): Promise<LabCode[]> {
  const rows = await sql`
    SELECT code, max(name) AS name, max(unit) AS unit, count(*)::int AS count
    FROM lab_results
    WHERE patient_id = ${patientId} AND taken_at >= now() - interval '5 years'
    GROUP BY code
    ORDER BY count DESC, code
  `;
  const all = rows.map((r) => ({
    code: r.code as string,
    name: labShortName(r.code, r.name),
    unit: r.unit as string,
    count: Number(r.count),
  }));

  const picked: LabCode[] = [];
  for (const group of MAIN_LAB_GROUPS) {
    const match = group.map((code) => all.find((l) => l.code === code)).find(Boolean);
    if (match) picked.push(match);
  }
  // Fill to three with the most frequent others, skipping a second code for a name already shown.
  for (const lab of all) {
    if (picked.length >= 3) break;
    if (!picked.some((p) => p.code === lab.code || p.name === lab.name)) picked.push(lab);
  }
  return picked.slice(0, 3);
}

/** Every result for one lab code in the last 5 years, oldest first. */
export async function getLabSeries(patientId: string, code: string): Promise<LabSeries | null> {
  const rows = await sql`
    SELECT id::text, taken_at::date::text AS date, value::float8 AS value, name, unit,
           normal_low::float8 AS low, normal_high::float8 AS high
    FROM lab_results
    WHERE patient_id = ${patientId} AND code = ${code} AND taken_at >= now() - interval '5 years'
    ORDER BY taken_at
  `;
  if (rows.length === 0) return null;

  const latest = rows[rows.length - 1];
  const fallback = labRange(code);
  const low = latest.low ?? fallback?.low ?? null;
  const high = latest.high ?? fallback?.high ?? null;
  const unit = latest.unit as string;
  return {
    code,
    name: labShortName(code, latest.name),
    unit,
    low,
    high,
    rangeLabel: rangeCaption(code, low, high, unit),
    points: rows.map((r) => ({ id: r.id, date: r.date, value: Number(r.value) })),
  };
}
