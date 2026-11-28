import { sql } from "@/lib/db/client";
import { labShortName, labStatus, type LabStatus } from "@/lib/lab-display";
import { labRange } from "@/lib/lab-ranges";

/**
 * Read-only queries behind the assistant's tools (lib/ai/tools.ts). Each takes
 * the patient id fixed by the server, never one from the model. Every row
 * carries a `ref`, the id the assistant cites and the panel links to.
 * Callers check access with can() first.
 */

export const LAB_ROW_LIMIT = 150;

/** Everyday words for groups of labs, by short name: "blood sugar" means HbA1c and glucose. */
const LAB_GROUPS: Record<string, string[]> = {
  "blood sugar": ["hba1c", "glucose"],
  sugar: ["hba1c", "glucose"],
  cholesterol: ["ldl", "hdl", "total cholesterol", "triglycerides"],
  lipids: ["ldl", "hdl", "total cholesterol", "triglycerides"],
  kidney: ["creatinine", "egfr", "microalbumin/creatinine", "urea nitrogen"],
};

export type AssistantLab = {
  ref: string;
  code: string;
  name: string;
  value: number;
  unit: string;
  low: number | null;
  high: number | null;
  status: LabStatus;
  date: string;
};

export type LabsResult = {
  results: AssistantLab[];
  /** True when more than LAB_ROW_LIMIT results matched; the newest are kept. */
  truncated: boolean;
  /** When nothing matched the lab asked for: the labs this patient has. */
  availableLabs?: string[];
};

/**
 * Lab results in the last 5 years, oldest first. `lab` matches a LOINC code,
 * or part of a short or long name ("HbA1c", "glucose"), ignoring case.
 */
export async function assistantLabs(
  patientId: string,
  { lab, from, to }: { lab?: string; from?: string; to?: string },
): Promise<LabsResult> {
  const codes = await sql`
    SELECT code, max(name) AS name FROM lab_results
    WHERE patient_id = ${patientId} AND taken_at >= now() - interval '5 years'
    GROUP BY code
  `;
  const named = codes.map((c) => ({ code: c.code as string, short: labShortName(c.code, c.name), long: c.name as string }));

  let wanted = named.map((c) => c.code);
  const term = lab?.trim().toLowerCase();
  if (term) {
    const group = LAB_GROUPS[term];
    wanted = named
      .filter((c) => {
        const short = c.short.toLowerCase();
        if (group) return group.includes(short);
        return c.code === term || short.includes(term) || c.long.toLowerCase().includes(term) || term.includes(short);
      })
      .map((c) => c.code);
    if (wanted.length === 0) {
      return { results: [], truncated: false, availableLabs: [...new Set(named.map((c) => c.short))].sort() };
    }
  }

  const rows = await sql`
    SELECT id::text, code, name, value::float8 AS value, unit, normal_low::float8 AS low,
           normal_high::float8 AS high, taken_at::date::text AS date
    FROM lab_results
    WHERE patient_id = ${patientId} AND code = ANY(${wanted}::text[])
      AND taken_at >= now() - interval '5 years'
      AND (${from ?? null}::date IS NULL OR taken_at::date >= ${from ?? null}::date)
      AND (${to ?? null}::date IS NULL OR taken_at::date <= ${to ?? null}::date)
    ORDER BY taken_at DESC, code
    LIMIT ${LAB_ROW_LIMIT + 1}
  `;
  const truncated = rows.length > LAB_ROW_LIMIT;
  const results = rows.slice(0, LAB_ROW_LIMIT).reverse().map((r): AssistantLab => {
    const fallback = labRange(r.code);
    const low = r.low ?? fallback?.low ?? null;
    const high = r.high ?? fallback?.high ?? null;
    const value = Number(r.value);
    return {
      ref: `lab-${r.id}`,
      code: r.code,
      name: labShortName(r.code, r.name),
      value,
      unit: r.unit,
      low,
      high,
      status: labStatus(value, low, high),
      date: r.date,
    };
  });
  return { results, truncated };
}

export type WearableKind = "heart_rate" | "sleep_hours" | "steps";

const WEARABLE_LABELS: Record<WearableKind, string> = {
  heart_rate: "Resting heart rate",
  sleep_hours: "Sleep",
  steps: "Steps",
};

export type WearablesResult = {
  ref: string;
  kind: WearableKind;
  label: string;
  unit: string;
  average: number | null;
  readings: { date: string; value: number }[];
}[];

/** Daily wearable readings for the patient's last `days` days of data, oldest first. */
export async function assistantWearables(patientId: string, { kind, days }: { kind?: WearableKind; days: number }): Promise<WearablesResult> {
  const rows = await sql`
    SELECT kind, unit, value::float8 AS value, measured_on::text AS date
    FROM wearable_readings
    WHERE patient_id = ${patientId}
      AND (${kind ?? null}::text IS NULL OR kind = ${kind ?? null})
      AND measured_on > (SELECT max(measured_on) FROM wearable_readings WHERE patient_id = ${patientId}) - ${days}::int
    ORDER BY kind, measured_on
  `;
  const kinds = [...new Set(rows.map((r) => r.kind as WearableKind))];
  return kinds.map((k) => {
    const mine = rows.filter((r) => r.kind === k);
    const values = mine.map((r) => Number(r.value));
    return {
      ref: `wearable-${k}`,
      kind: k,
      label: WEARABLE_LABELS[k],
      unit: mine[0].unit,
      average: values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null,
      readings: mine.map((r) => ({ date: r.date, value: Number(r.value) })),
    };
  });
}

export type AssistantMedication = {
  ref: string;
  name: string;
  dose: string | null;
  status: "active" | "stopped";
  startedOn: string | null;
  stoppedOn: string | null;
};

export async function assistantMedications(patientId: string, status: "active" | "stopped" | "all"): Promise<AssistantMedication[]> {
  const rows = await sql`
    SELECT id::text, name, dose, status, started_on::text AS started_on, stopped_on::text AS stopped_on
    FROM medications
    WHERE patient_id = ${patientId} AND (${status} = 'all' OR status = ${status})
    ORDER BY status, started_on DESC NULLS LAST, name
  `;
  return rows.map((r) => ({
    ref: `med-${r.id}`,
    name: r.name,
    dose: r.dose,
    status: r.status,
    startedOn: r.started_on,
    stoppedOn: r.stopped_on,
  }));
}

export type AssistantCondition = {
  ref: string;
  name: string;
  status: "active" | "resolved";
  onsetOn: string | null;
  resolvedOn: string | null;
};

export async function assistantConditions(patientId: string, status: "active" | "resolved" | "all"): Promise<AssistantCondition[]> {
  const rows = await sql`
    SELECT id::text, name, status, onset_on::text AS onset_on, resolved_on::text AS resolved_on
    FROM conditions
    WHERE patient_id = ${patientId} AND (${status} = 'all' OR status = ${status})
    ORDER BY status, onset_on DESC NULLS LAST, name
  `;
  return rows.map((r) => ({ ref: `cond-${r.id}`, name: r.name, status: r.status, onsetOn: r.onset_on, resolvedOn: r.resolved_on }));
}

export type AssistantAllergy = {
  ref: string;
  substance: string;
  reaction: string | null;
  severity: string | null;
  recordedOn: string | null;
};

export async function assistantAllergies(patientId: string): Promise<AssistantAllergy[]> {
  const rows = await sql`
    SELECT id::text, substance, reaction, severity, recorded_on::text AS recorded_on
    FROM allergies WHERE patient_id = ${patientId}
    ORDER BY substance
  `;
  return rows.map((r) => ({ ref: `allergy-${r.id}`, substance: r.substance, reaction: r.reaction, severity: r.severity, recordedOn: r.recorded_on }));
}
