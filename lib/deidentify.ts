import { randomInt } from "node:crypto";
import { addDays } from "@/lib/clinic-date";
import { ageFrom } from "@/lib/format";

/**
 * The de-identification rules for the Admin export, as plain functions with no
 * database access, so they are easy to read, show and test on their own.
 *
 * - Names and identifiers (name, MRN, phone, email, address, insurance member ID,
 *   database and Synthea IDs) are never copied. Each patient gets a new ID, P-0001…,
 *   numbered after a random shuffle, so the order can't be matched back to MRNs.
 * - Birth dates become the year only. Anyone aged 90 or over gets no year at all,
 *   just age_90_plus: true, because a birth year alone can identify very old patients.
 * - Every date is shifted by a random number of days, the same for all of one
 *   patient's records, so the gaps between their visits and results stay true.
 *   A shift that would move any record onto the patient's own birth date is redrawn.
 *   Shifts are never stored or written out, and each export draws new ones.
 * - Free text: tasks and intake documents are not exported at all. Visit reasons,
 *   medication doses and allergy reactions are coded Synthea text; any of them that
 *   contains a patient's or provider's name is removed (redactedFields counts them).
 */

export const EXPORT_RULES = [
  "Names and identifiers removed: name, MRN, phone, email, address, insurance member ID and internal IDs.",
  "Each patient has a new ID (P-0001…), assigned in random order for every export.",
  "Birth dates reduced to the year. Patients aged 90 or over have no birth year, only age_90_plus.",
  "Every date is shifted by a random number of days, the same for all of one patient's records, so the gaps between records stay true.",
  "Dates are shifted per patient, not removed, so this export does not meet HIPAA Safe Harbor.",
  "Staff-written text (tasks, intake documents) is not included. Coded text that contains a name is removed.",
] as const;

/** Shifts are 30 to 365 days, earlier or later, never zero. */
export const MIN_SHIFT_DAYS = 30;
export const MAX_SHIFT_DAYS = 365;
export const OLDEST_EXACT_AGE = 89;

/** Random source, injectable so the check script can test fixed cases. */
export type Rng = (minInclusive: number, maxExclusive: number) => number;
const cryptoRng: Rng = (min, max) => randomInt(min, max);

export function randomShiftDays(rng: Rng = cryptoRng): number {
  const days = rng(MIN_SHIFT_DAYS, MAX_SHIFT_DAYS + 1);
  return rng(0, 2) === 0 ? -days : days;
}

/** Whole days from one "YYYY-MM-DD" date to another. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / 86_400_000);
}

/**
 * A shift for one patient that never moves any of their records onto their own
 * birth date (a record from early in life, shifted back, could otherwise land on it
 * exactly and show the full date of birth). Redraws until it's safe.
 */
export function safeShiftDays(birthDate: string, recordDates: Iterable<string | null>, rng: Rng = cryptoRng): number {
  const unsafe = new Set<number>();
  for (const d of recordDates) if (d) unsafe.add(daysBetween(d, birthDate));
  for (let i = 0; i < 100; i++) {
    const days = randomShiftDays(rng);
    if (!unsafe.has(days)) return days;
  }
  throw new Error("Couldn't find a safe date shift for a patient.");
}

/** A date or timestamp moved by whole days, as "YYYY-MM-DD" (time of day dropped). */
export function shiftDate(date: string, days: number): string;
export function shiftDate(date: string | null, days: number): string | null;
export function shiftDate(date: string | null, days: number): string | null {
  return date ? addDays(date.slice(0, 10), days) : null;
}

/** "P-0007" */
export function exportId(n: number): string {
  return `P-${String(n).padStart(4, "0")}`;
}

/** Year of birth, or none for anyone aged 90 or over on the export date. */
export function birthYearOf(birthDate: string, today: Date): { birth_year: number | null; age_90_plus: boolean } {
  if (ageFrom(birthDate, today) > OLDEST_EXACT_AGE) return { birth_year: null, age_90_plus: true };
  return { birth_year: Number(birthDate.slice(0, 4)), age_90_plus: false };
}

/** Fisher–Yates shuffle into a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng = cryptoRng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng(0, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const WORD = /[\p{L}][\p{L}'’-]*/gu;
const NOT_NAMES = new Set(["dr", "mr", "mrs", "ms", "md"]);

/** Every word of the given names, lower-cased, for whole-word matching. */
export function nameWords(names: Iterable<string | null>): Set<string> {
  const words = new Set<string>();
  for (const name of names) {
    for (const w of name?.toLowerCase().match(WORD) ?? []) if (w.length > 1 && !NOT_NAMES.has(w)) words.add(w);
  }
  return words;
}

/** True when the text contains any of the names as a whole word. */
export function containsName(text: string, words: Set<string>): boolean {
  return (text.toLowerCase().match(WORD) ?? []).some((w) => words.has(w));
}

// ---------- The export itself ----------

export type SourcePatient = {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  sex: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  insurance_provider: string | null;
  insurance_member_id: string | null;
};
export type SourceVisit = { patient_id: string; date: string; kind: string | null; reason: string | null; provider_name: string | null };
/** One distinct lab test (code, name, unit and normal range), numbered by the loader. */
export type SourceLabTest = { n: number; code: string; name: string; unit: string; normal_low: number | null; normal_high: number | null };
/** A patient's lab results as [date, test number, value], grouped by the database. */
export type SourceLabRows = { patient_id: string; rows: [string, number, number][] };
export type SourceMedication = {
  patient_id: string; code: string | null; name: string; dose: string | null; status: string;
  started_on: string | null; stopped_on: string | null;
};
export type SourceAllergy = { patient_id: string; substance: string; reaction: string | null; severity: string | null; recorded_on: string | null };
export type SourceCondition = {
  patient_id: string; code: string | null; name: string; status: string; onset_on: string | null; resolved_on: string | null;
};
/** A patient's wearable readings as [date, kind, value], grouped by the database. */
export type SourceWearableRows = { patient_id: string; rows: [string, string, number][] };

export type ExportSource = {
  patients: SourcePatient[];
  visits: SourceVisit[];
  labTests: SourceLabTest[];
  labs: SourceLabRows[];
  medications: SourceMedication[];
  allergies: SourceAllergy[];
  conditions: SourceCondition[];
  wearableUnits: Record<string, string>;
  wearables: SourceWearableRows[];
};

/**
 * Each table's columns, listed once for the whole file. A patient's rows are arrays
 * in this order, which keeps 36,000 lab results small enough to download in one
 * response (row objects with repeated keys came to about 7.9 MB).
 */
export const COLUMNS = {
  visits: ["date", "kind", "reason"],
  labs: ["date", "test", "value"],
  medications: ["code", "name", "dose", "status", "started_on", "stopped_on"],
  allergies: ["substance", "reaction", "severity", "recorded_on"],
  conditions: ["code", "name", "status", "onset_on", "resolved_on"],
  wearables: ["date", "kind", "value"],
} as const;

type Cell = string | number | null;

export type LabTest = { code: string; name: string; unit: string; normal_low: number | null; normal_high: number | null };

export type ExportPatient = {
  id: string;
  sex: string | null;
  birth_year: number | null;
  age_90_plus: boolean;
  insurance_provider: string | null;
} & Record<keyof typeof COLUMNS, Cell[][]>;

export type DeidentifiedExport = {
  title: string;
  exported_on: string;
  rules: readonly string[];
  patient_count: number;
  redacted_fields: number;
  columns: typeof COLUMNS;
  /** Lab rows name a test ("T001"); its LOINC code, name, unit and normal range are here. */
  lab_tests: Record<string, LabTest>;
  wearable_units: Record<string, string>;
  patients: ExportPatient[];
};

function groupBy<T extends { patient_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const list = map.get(r.patient_id);
    if (list) list.push(r);
    else map.set(r.patient_id, [r]);
  }
  return map;
}

/** "T007" */
export function labTestKey(n: number): string {
  return `T${String(n).padStart(3, "0")}`;
}

/**
 * Builds the export. `today` is the real export date (for the 90+ rule); exportedOn
 * is written in the file. Also returns each patient's shift, for the check script
 * only; the API never sends it.
 */
export function deidentify(
  source: ExportSource,
  { today, exportedOn, rng = cryptoRng }: { today: Date; exportedOn: string; rng?: Rng },
): { file: DeidentifiedExport; shifts: Map<string, { exportId: string; days: number }> } {
  const names = nameWords([
    ...source.patients.flatMap((p) => [p.first_name, p.last_name]),
    ...source.visits.map((v) => v.provider_name),
  ]);
  let redacted = 0;
  const clean = (text: string | null): string | null => {
    if (!text || !containsName(text, names)) return text;
    redacted += 1;
    return null;
  };

  const tests: Record<string, LabTest> = {};
  for (const { n, ...test } of source.labTests) tests[labTestKey(n)] = test;

  const visits = groupBy(source.visits);
  const labs = new Map(source.labs.map((l) => [l.patient_id, l.rows]));
  const meds = groupBy(source.medications);
  const allergies = groupBy(source.allergies);
  const conditions = groupBy(source.conditions);
  const wearables = new Map(source.wearables.map((w) => [w.patient_id, w.rows]));
  const shifts = new Map<string, { exportId: string; days: number }>();

  const patients = shuffle(source.patients, rng).map((p, i): ExportPatient => {
    const id = exportId(i + 1);
    const days = safeShiftDays(p.birth_date, [
      ...(visits.get(p.id) ?? []).map((v) => v.date),
      ...(labs.get(p.id) ?? []).map((l) => l[0]),
      ...(meds.get(p.id) ?? []).flatMap((m) => [m.started_on, m.stopped_on]),
      ...(allergies.get(p.id) ?? []).map((a) => a.recorded_on),
      ...(conditions.get(p.id) ?? []).flatMap((c) => [c.onset_on, c.resolved_on]),
      ...(wearables.get(p.id) ?? []).map((w) => w[0]),
    ], rng);
    shifts.set(p.id, { exportId: id, days });
    const s = (d: string | null) => shiftDate(d, days);
    const rows = <T,>(list: T[] | undefined, row: (r: T) => Cell[]) => (list ?? []).map(row);
    return {
      id,
      sex: p.sex,
      ...birthYearOf(p.birth_date, today),
      insurance_provider: clean(p.insurance_provider),
      visits: rows(visits.get(p.id), (v) => [s(v.date), clean(v.kind), clean(v.reason)]),
      labs: rows(labs.get(p.id), ([date, test, value]) => [s(date), labTestKey(test), value]),
      medications: rows(meds.get(p.id), (m) => [m.code, m.name, clean(m.dose), m.status, s(m.started_on), s(m.stopped_on)]),
      allergies: rows(allergies.get(p.id), (a) => [a.substance, clean(a.reaction), a.severity, s(a.recorded_on)]),
      conditions: rows(conditions.get(p.id), (c) => [c.code, c.name, c.status, s(c.onset_on), s(c.resolved_on)]),
      wearables: rows(wearables.get(p.id), ([date, kind, value]) => [s(date), kind, value]),
    };
  });

  return {
    file: {
      title: "Carebase de-identified export (synthetic data)",
      exported_on: exportedOn,
      rules: EXPORT_RULES,
      patient_count: patients.length,
      redacted_fields: redacted,
      columns: COLUMNS,
      lab_tests: tests,
      wearable_units: source.wearableUnits,
      patients,
    },
    shifts,
  };
}

// ---------- The preview row on the Admin page ----------

export type PreviewField = { field: string; before: string; after: string };

/**
 * One real patient's identifying fields, before and after, using the same rules
 * as the export with a fresh random shift. Only fields the patient has are shown.
 */
export function previewRows(
  p: SourcePatient,
  latestLabDate: string | null,
  { today, patientCount, format, rng = cryptoRng }: {
    today: Date;
    patientCount: number;
    format: (date: string) => string;
    rng?: Rng;
  },
): PreviewField[] {
  const days = safeShiftDays(p.birth_date, [latestLabDate], rng);
  const year = birthYearOf(p.birth_date, today);
  const rows: (PreviewField | null)[] = [
    { field: "NAME", before: `${p.first_name} ${p.last_name}`, after: "(removed)" },
    { field: "MRN", before: p.mrn, after: exportId(rng(1, Math.max(patientCount, 1) + 1)) },
    { field: "BIRTH DATE", before: format(p.birth_date), after: year.birth_year ? String(year.birth_year) : "90+" },
    p.phone ? { field: "PHONE", before: p.phone, after: "(removed)" } : null,
    p.email ? { field: "EMAIL", before: p.email, after: "(removed)" } : null,
    p.address ? { field: "ADDRESS", before: p.address, after: "(removed)" } : null,
    p.insurance_member_id ? { field: "MEMBER ID", before: p.insurance_member_id, after: "(removed)" } : null,
    latestLabDate ? { field: "LAB DATE", before: format(latestLabDate), after: format(shiftDate(latestLabDate, days)) } : null,
  ];
  return rows.filter((r): r is PreviewField => r !== null);
}
