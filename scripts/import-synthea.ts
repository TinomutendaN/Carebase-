/**
 * Load Synthea's FHIR bundles (.synthea/output/fhir) into Postgres: patients, visits,
 * lab results, medications, allergies and conditions. Run with: npm run db:import
 *
 * - Safe to re-run: every row is upserted on its synthea_id, so nothing is duplicated.
 * - Keeps the data current: every clinical date is shifted forward by the days between
 *   Synthea's reference date and today, so the history always ends today. Birth dates are not shifted.
 * - Strips the numbers Synthea adds to names, and gives each patient a unique 5-digit MRN
 *   that stays the same across re-imports.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient } from "@neondatabase/serverless";
import { labRange, roundLabValue } from "../lib/lab-ranges";

const FHIR_DIR = join(process.cwd(), ".synthea", "output", "fhir");
/** Must match -r in the synthea:generate script. */
const REFERENCE_DATE = "2026-11-27";
const CONCURRENCY = 4;
const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// FHIR shapes (only the fields we read)

type Coding = { system?: string; code?: string; display?: string };
type CodeableConcept = { coding?: Coding[]; text?: string };
type Reference = { reference?: string; display?: string };
type FhirResource = { resourceType: string; id: string };

type Patient = FhirResource & {
  name?: { use?: string; given?: string[]; family?: string }[];
  gender?: string;
  birthDate: string;
  telecom?: { system?: string; value?: string }[];
  address?: { line?: string[]; city?: string; state?: string; postalCode?: string }[];
};
type Encounter = FhirResource & {
  period: { start: string };
  type?: CodeableConcept[];
  reasonCode?: CodeableConcept[];
  participant?: { individual?: Reference }[];
};
type Observation = FhirResource & {
  category?: CodeableConcept[];
  code: CodeableConcept;
  valueQuantity?: { value?: number; unit?: string; code?: string };
  effectiveDateTime?: string;
  encounter?: Reference;
};
type Dosage = {
  text?: string;
  asNeededBoolean?: boolean;
  timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } };
  doseAndRate?: { doseQuantity?: { value?: number } }[];
};
type MedicationRequest = FhirResource & {
  status: string;
  medicationCodeableConcept?: CodeableConcept;
  medicationReference?: Reference;
  authoredOn: string;
  dosageInstruction?: Dosage[];
};
type Medication = FhirResource & { code?: CodeableConcept };
type AllergyIntolerance = FhirResource & {
  code?: CodeableConcept;
  reaction?: { manifestation?: CodeableConcept[]; severity?: string }[];
  recordedDate?: string;
};
type Condition = FhirResource & {
  code?: CodeableConcept;
  clinicalStatus?: CodeableConcept;
  onsetDateTime?: string;
  abatementDateTime?: string;
};
type Bundle = { entry: { fullUrl: string; resource: FhirResource }[] };

// ---------------------------------------------------------------------------
// Rules

/** Clinical SNOMED findings that count as diagnoses. Every other finding is social or administrative. */
const KEPT_FINDINGS = new Set([
  "162864005", // Body mass index 30+ - obesity
  "408512008", // Body mass index 40+ - severely obese
  "714628002", // Prediabetes
  "82423001", // Chronic pain
  "278860009", // Chronic low back pain
  "1121000119107", // Chronic neck pain
  "80583007", // Severe anxiety (panic)
]);
/** ICD-10 chapters kept: neoplasms (C, D), digestive and dental (K), musculoskeletal and jaw (M), injuries (S). */
const KEPT_ICD10 = /^[CDKMS]/;
/** "Allergic disposition (finding)" names no substance, so it isn't imported. */
const SKIPPED_ALLERGY_CODE = "609328004";
/** HbA1c below this is a Synthea artifact and is dropped. */
const HBA1C_CODE = "4548-4";
const HBA1C_MIN = 3.5;

const SEMANTIC_TAG =
  /\s*\((disorder|finding|procedure|situation|substance|organism|product|person|morphologic abnormality|qualifier value|observable entity|event|regime\/therapy|environment)\)$/;

// ---------------------------------------------------------------------------
// Helpers

const stripDigits = (s: string) => s.replace(/\d+/g, "").replace(/\s+/g, " ").trim();
const stripTag = (s: string) => s.replace(SEMANTIC_TAG, "").trim();
const tagOf = (s: string) => SEMANTIC_TAG.exec(s)?.[1] ?? null;
const display = (c?: CodeableConcept) => c?.text ?? c?.coding?.[0]?.display ?? null;
const uuidOf = (ref?: string) => ref?.replace(/^urn:uuid:/, "") ?? null;

/** Whole days from Synthea's reference date to today (local time). */
function dayOffset(): number {
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
  return Math.round((Date.parse(today) - Date.parse(REFERENCE_DATE)) / DAY_MS);
}

function makeShifter(offsetDays: number) {
  return {
    timestamp: (s: string) => new Date(Date.parse(s) + offsetDays * DAY_MS).toISOString(),
    /** Uses the calendar date as Synthea wrote it, then moves it. */
    date: (s: string) => new Date(Date.parse(s.slice(0, 10)) + offsetDays * DAY_MS).toISOString().slice(0, 10),
  };
}

/** FNV-1a, for a stable starting point when assigning MRNs. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function isDiagnosis(c: Coding, skipped: Map<string, number>): boolean {
  const name = c.display ?? "";
  let keep = false;
  if (c.system?.includes("snomed")) {
    const tag = tagOf(name);
    keep = tag === null || tag === "disorder" || (tag === "finding" && KEPT_FINDINGS.has(c.code ?? ""));
  } else if (c.system?.includes("icd-10")) {
    keep = KEPT_ICD10.test(c.code ?? "");
  }
  if (!keep) skipped.set(name, (skipped.get(name) ?? 0) + 1);
  return keep;
}

const UNIT_WORDS: Record<string, string> = { h: "hour", d: "day", wk: "week", mo: "month" };

/** For example "1 dose, twice a day", "As needed". */
function formatDose(d?: Dosage): string | null {
  if (!d) return null;
  if (d.asNeededBoolean) return "As needed";
  const r = d.timing?.repeat;
  const unit = r?.periodUnit ? UNIT_WORDS[r.periodUnit] : undefined;
  if (!r?.frequency || !r.period || !unit) return d.text ? stripTag(d.text) : null;
  const times = r.frequency === 1 ? "once" : r.frequency === 2 ? "twice" : `${r.frequency} times`;
  const per = unit === "hour" ? "an hour" : `a ${unit}`;
  const how = r.period === 1 ? `${times} ${per}` : r.frequency === 1 ? `every ${r.period} ${unit}s` : `${times} every ${r.period} ${unit}s`;
  const q = d.doseAndRate?.[0]?.doseQuantity?.value;
  return q ? `${q} dose${q === 1 ? "" : "s"}, ${how}` : how[0].toUpperCase() + how.slice(1);
}

const SEVERITY_RANK: Record<string, number> = { mild: 1, moderate: 2, severe: 3 };

// ---------------------------------------------------------------------------
// Import

type Stats = {
  patients: number;
  visits: number;
  labs: number;
  medications: number;
  allergies: number;
  conditions: number;
  hba1cDropped: number;
  labsSkippedNoUnit: number;
  labsWithoutRange: Map<string, number>;
  allergiesSkipped: number;
  conditionsSkipped: Map<string, number>;
  patientsWithoutLabs: number;
};

async function importBundle(
  client: PoolClient,
  file: string,
  mrn: string,
  shift: ReturnType<typeof makeShifter>,
  stats: Stats,
) {
  const bundle = JSON.parse(readFileSync(join(FHIR_DIR, file), "utf8")) as Bundle;
  const byType = (type: string) => bundle.entry.filter((e) => e.resource.resourceType === type).map((e) => e.resource);
  const byUrl = new Map(bundle.entry.map((e) => [e.fullUrl, e.resource]));

  const patient = byType("Patient")[0] as Patient;
  const name = patient.name?.find((n) => n.use === "official") ?? patient.name?.[0];
  const addr = patient.address?.[0];

  // Visits
  const encounters = byType("Encounter") as Encounter[];

  // Lab results: numeric laboratory observations with a unit
  const labs = (byType("Observation") as Observation[]).filter((o) => {
    if (!o.category?.some((c) => c.coding?.some((x) => x.code === "laboratory"))) return false;
    if (typeof o.valueQuantity?.value !== "number" || !o.effectiveDateTime) return false;
    const unit = o.valueQuantity.unit ?? o.valueQuantity.code;
    if (!unit || unit === "{presence}") {
      stats.labsSkippedNoUnit++;
      return false;
    }
    if (o.code.coding?.[0]?.code === HBA1C_CODE && o.valueQuantity.value < HBA1C_MIN) {
      stats.hba1cDropped++;
      return false;
    }
    return true;
  });

  // Medications: one row per RxNorm code, built from every request for it
  const medGroups = new Map<string, { name: string; requests: MedicationRequest[] }>();
  for (const req of byType("MedicationRequest") as MedicationRequest[]) {
    const concept =
      req.medicationCodeableConcept ??
      (byUrl.get(req.medicationReference?.reference ?? "") as Medication | undefined)?.code;
    const code = concept?.coding?.[0]?.code;
    if (!code) continue;
    const group = medGroups.get(code) ?? { name: display(concept) ?? code, requests: [] };
    group.requests.push(req);
    medGroups.set(code, group);
  }

  // Allergies
  const allergies = (byType("AllergyIntolerance") as AllergyIntolerance[]).filter((a) => {
    if (a.code?.coding?.[0]?.code === SKIPPED_ALLERGY_CODE) {
      stats.allergiesSkipped++;
      return false;
    }
    return Boolean(display(a.code));
  });

  // Conditions: diagnoses only
  const conditions = (byType("Condition") as Condition[]).filter((c) => {
    const coding = c.code?.coding?.[0];
    return coding ? isDiagnosis(coding, stats.conditionsSkipped) : false;
  });

  await client.query("BEGIN");
  try {
    const { rows: pRows } = await client.query(
      `INSERT INTO patients (mrn, first_name, last_name, birth_date, sex, phone, address, source, synthea_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'synthea', $8)
       ON CONFLICT (synthea_id) DO UPDATE SET
         first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date,
         sex = EXCLUDED.sex, phone = EXCLUDED.phone, address = EXCLUDED.address
       RETURNING id`,
      [
        mrn,
        stripDigits(name?.given?.[0] ?? ""),
        stripDigits(name?.family ?? ""),
        patient.birthDate,
        patient.gender === "female" || patient.gender === "male" ? patient.gender : "other",
        patient.telecom?.find((t) => t.system === "phone")?.value ?? null,
        addr ? `${(addr.line ?? []).join(" ")}, ${addr.city}, ${addr.state} ${addr.postalCode ?? ""}`.trim() : null,
        patient.id,
      ],
    );
    const patientId = pRows[0].id as string;

    const { rows: vRows } = await client.query(
      `INSERT INTO visits (patient_id, visited_at, kind, reason, provider_name, synthea_id)
       SELECT $1, * FROM unnest($2::timestamptz[], $3::text[], $4::text[], $5::text[], $6::text[])
       ON CONFLICT (synthea_id) DO UPDATE SET
         visited_at = EXCLUDED.visited_at, kind = EXCLUDED.kind, reason = EXCLUDED.reason,
         provider_name = EXCLUDED.provider_name
       RETURNING id, synthea_id`,
      [
        patientId,
        encounters.map((e) => shift.timestamp(e.period.start)),
        encounters.map((e) => {
          const t = display(e.type?.[0]);
          return t ? stripTag(t) : null;
        }),
        encounters.map((e) => {
          const r = e.reasonCode?.[0]?.coding?.[0]?.display;
          return r ? stripTag(r) : null;
        }),
        encounters.map((e) => {
          const p = e.participant?.[0]?.individual?.display;
          return p ? stripDigits(p) : null;
        }),
        encounters.map((e) => e.id),
      ],
    );
    const visitIds = new Map(vRows.map((r) => [r.synthea_id as string, r.id as string]));

    const labCodes = labs.map((o) => o.code.coding?.[0]?.code ?? "");
    for (const code of labCodes) {
      if (!labRange(code)) stats.labsWithoutRange.set(code, (stats.labsWithoutRange.get(code) ?? 0) + 1);
    }
    await client.query(
      `INSERT INTO lab_results (patient_id, visit_id, code, name, value, unit, normal_low, normal_high, taken_at, synthea_id)
       SELECT $1, * FROM unnest($2::bigint[], $3::text[], $4::text[], $5::numeric[], $6::text[],
                                $7::numeric[], $8::numeric[], $9::timestamptz[], $10::text[])
       ON CONFLICT (synthea_id) DO UPDATE SET
         visit_id = EXCLUDED.visit_id, code = EXCLUDED.code, name = EXCLUDED.name, value = EXCLUDED.value,
         unit = EXCLUDED.unit, normal_low = EXCLUDED.normal_low, normal_high = EXCLUDED.normal_high,
         taken_at = EXCLUDED.taken_at`,
      [
        patientId,
        labs.map((o) => visitIds.get(uuidOf(o.encounter?.reference) ?? "") ?? null),
        labCodes,
        labs.map((o, i) => display(o.code) ?? labCodes[i]),
        labs.map((o, i) => roundLabValue(labCodes[i], o.valueQuantity!.value!)),
        labs.map((o) => o.valueQuantity!.unit ?? o.valueQuantity!.code!),
        labCodes.map((c) => labRange(c)?.low ?? null),
        labCodes.map((c) => labRange(c)?.high ?? null),
        labs.map((o) => shift.timestamp(o.effectiveDateTime!)),
        labs.map((o) => o.id),
      ],
    );

    const meds = [...medGroups].map(([code, { name: medName, requests }]) => {
      const sorted = [...requests].sort((a, b) => Date.parse(a.authoredOn) - Date.parse(b.authoredOn));
      const latest = sorted[sorted.length - 1];
      const active = latest.status === "active";
      return {
        code,
        name: medName,
        dose: formatDose(latest.dosageInstruction?.[0]),
        status: active ? "active" : "stopped",
        started: shift.date(sorted[0].authoredOn),
        stopped: active ? null : shift.date(latest.authoredOn),
        syntheaId: `${patient.id}:${code}`,
      };
    });
    await client.query(
      `INSERT INTO medications (patient_id, code, name, dose, status, started_on, stopped_on, synthea_id)
       SELECT $1, * FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::date[], $7::date[], $8::text[])
       ON CONFLICT (synthea_id) DO UPDATE SET
         code = EXCLUDED.code, name = EXCLUDED.name, dose = EXCLUDED.dose, status = EXCLUDED.status,
         started_on = EXCLUDED.started_on, stopped_on = EXCLUDED.stopped_on`,
      [
        patientId,
        meds.map((m) => m.code),
        meds.map((m) => m.name),
        meds.map((m) => m.dose),
        meds.map((m) => m.status),
        meds.map((m) => m.started),
        meds.map((m) => m.stopped),
        meds.map((m) => m.syntheaId),
      ],
    );

    const allergyRows = allergies.map((a) => {
      // The most severe reaction describes the allergy best.
      const worst = [...(a.reaction ?? [])].sort(
        (x, y) => (SEVERITY_RANK[y.severity ?? ""] ?? 0) - (SEVERITY_RANK[x.severity ?? ""] ?? 0),
      )[0];
      const reaction = display(worst?.manifestation?.[0]);
      return {
        substance: stripTag(display(a.code)!),
        reaction: reaction ? stripTag(reaction) : null,
        severity: worst?.severity && SEVERITY_RANK[worst.severity] ? worst.severity : null,
        recorded: a.recordedDate ? shift.date(a.recordedDate) : null,
        syntheaId: a.id,
      };
    });
    await client.query(
      `INSERT INTO allergies (patient_id, substance, reaction, severity, recorded_on, synthea_id)
       SELECT $1, * FROM unnest($2::text[], $3::text[], $4::text[], $5::date[], $6::text[])
       ON CONFLICT (synthea_id) DO UPDATE SET
         substance = EXCLUDED.substance, reaction = EXCLUDED.reaction, severity = EXCLUDED.severity,
         recorded_on = EXCLUDED.recorded_on`,
      [
        patientId,
        allergyRows.map((a) => a.substance),
        allergyRows.map((a) => a.reaction),
        allergyRows.map((a) => a.severity),
        allergyRows.map((a) => a.recorded),
        allergyRows.map((a) => a.syntheaId),
      ],
    );

    await client.query(
      `INSERT INTO conditions (patient_id, code, name, status, onset_on, resolved_on, synthea_id)
       SELECT $1, * FROM unnest($2::text[], $3::text[], $4::text[], $5::date[], $6::date[], $7::text[])
       ON CONFLICT (synthea_id) DO UPDATE SET
         code = EXCLUDED.code, name = EXCLUDED.name, status = EXCLUDED.status,
         onset_on = EXCLUDED.onset_on, resolved_on = EXCLUDED.resolved_on`,
      [
        patientId,
        conditions.map((c) => c.code!.coding![0].code ?? null),
        conditions.map((c) => stripTag(display(c.code)!)),
        conditions.map((c) =>
          ["active", "recurrence", "relapse"].includes(c.clinicalStatus?.coding?.[0]?.code ?? "") ? "active" : "resolved",
        ),
        conditions.map((c) => (c.onsetDateTime ? shift.date(c.onsetDateTime) : null)),
        conditions.map((c) => (c.abatementDateTime ? shift.date(c.abatementDateTime) : null)),
        conditions.map((c) => c.id),
      ],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw new Error(`${file}: ${error instanceof Error ? error.message : error}`);
  }

  stats.patients++;
  stats.visits += encounters.length;
  stats.labs += labs.length;
  stats.medications += medGroups.size;
  stats.allergies += allergies.length;
  stats.conditions += conditions.length;
  if (!labs.length) stats.patientsWithoutLabs++;
}

/** Keeps existing MRNs, and gives new patients a stable, unused 5-digit one. */
async function assignMrns(pool: Pool, syntheaIds: string[]): Promise<Map<string, string>> {
  const { rows } = await pool.query("SELECT synthea_id, mrn FROM patients");
  const taken = new Set(rows.map((r) => r.mrn as string));
  const existing = new Map(rows.filter((r) => r.synthea_id).map((r) => [r.synthea_id as string, r.mrn as string]));
  const mrns = new Map<string, string>();
  for (const id of [...syntheaIds].sort()) {
    const known = existing.get(id);
    if (known) {
      mrns.set(id, known);
      continue;
    }
    let n = 10000 + (fnv1a(id) % 90000);
    while (taken.has(String(n))) n = n === 99999 ? 10000 : n + 1;
    taken.add(String(n));
    mrns.set(id, String(n));
  }
  return mrns;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set. Add it to .env.local.");

  const files = readdirSync(FHIR_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("hospital") && !f.startsWith("practitioner"))
    .sort();
  const idOf = (f: string) => {
    const m = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.json$/.exec(f);
    if (!m) throw new Error(`Can't read the patient id from ${f}`);
    return m[1];
  };

  const offset = dayOffset();
  const shift = makeShifter(offset);
  console.log(`Importing ${files.length} patients. Date offset: +${offset} days (${REFERENCE_DATE} → today).`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const stats: Stats = {
    patients: 0,
    visits: 0,
    labs: 0,
    medications: 0,
    allergies: 0,
    conditions: 0,
    hba1cDropped: 0,
    labsSkippedNoUnit: 0,
    labsWithoutRange: new Map(),
    allergiesSkipped: 0,
    conditionsSkipped: new Map(),
    patientsWithoutLabs: 0,
  };

  try {
    const mrns = await assignMrns(pool, files.map(idOf));
    const queue = [...files];
    const started = Date.now();

    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        const client = await pool.connect();
        try {
          for (let file = queue.shift(); file; file = queue.shift()) {
            await importBundle(client, file, mrns.get(idOf(file))!, shift, stats);
            if (stats.patients % 25 === 0) console.log(`  ${stats.patients}/${files.length} patients`);
          }
        } finally {
          client.release();
        }
      }),
    );

    console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(0)} s. Date offset used: +${offset} days.`);
    console.log(`  patients     ${stats.patients} (${stats.patientsWithoutLabs} with no lab results)`);
    console.log(`  visits       ${stats.visits}`);
    console.log(`  lab results  ${stats.labs}`);
    console.log(`  medications  ${stats.medications}`);
    console.log(`  allergies    ${stats.allergies}`);
    console.log(`  conditions   ${stats.conditions}`);
    console.log(`\nSkipped:`);
    console.log(`  HbA1c below ${HBA1C_MIN}% (Synthea artifacts): ${stats.hba1cDropped}`);
    console.log(`  lab results with no unit or a {presence} unit: ${stats.labsSkippedNoUnit}`);
    console.log(`  "Allergic disposition" entries with no substance: ${stats.allergiesSkipped}`);
    const skipped = [...stats.conditionsSkipped].sort((a, b) => b[1] - a[1]);
    console.log(`  conditions that aren't diagnoses: ${skipped.reduce((n, [, c]) => n + c, 0)} (${skipped.length} kinds)`);
    for (const [cname, count] of skipped) console.log(`    ${String(count).padStart(5)}  ${cname}`);
    const noRange = [...stats.labsWithoutRange].sort((a, b) => b[1] - a[1]);
    console.log(`\nLab results stored with no normal range: ${noRange.reduce((n, [, c]) => n + c, 0)}`);
    for (const [code, count] of noRange) console.log(`  ${code.padEnd(8)} ${count}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
