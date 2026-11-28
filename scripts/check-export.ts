/**
 * Checks the de-identified export against the database: `npm run check:export`.
 *
 * Builds the export with the same code as POST /api/export, then compares it with
 * the database using its own queries (not the export's). It fails if any name,
 * MRN, identifier or full birth date is found, or if the date shift is wrong.
 * `--sample` also prints the first 3 patients with a few rows of each table.
 * Reads only: it writes nothing to the database and no audit row.
 */
import { sql } from "@/lib/db/client";
import { loadExportSource } from "@/lib/db/queries/export";
import {
  deidentify, MAX_SHIFT_DAYS, MIN_SHIFT_DAYS, type ExportSource, type SourcePatient,
} from "@/lib/deidentify";

const SIZE_LIMIT = 3.5 * 1024 * 1024; // Vercel's response limit is about 4.5 MB.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const failures: string[] = [];
const notes: string[] = [];
function check(ok: boolean, label: string, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wholeWord = (w: string) => new RegExp(`(?<![\\p{L}\\d])${escape(w)}(?![\\p{L}\\d])`, "iu");

/** Every string in the file, with where it sits (e.g. patients.labs). */
function strings(value: unknown, path: string, out: { path: string; text: string }[]) {
  if (typeof value === "string") out.push({ path, text: value });
  else if (Array.isArray(value)) value.forEach((v) => strings(v, path, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) strings(v, path ? `${path}.${k}` : k, out);
  return out;
}

function keys(value: unknown, out = new Set<string>()) {
  if (Array.isArray(value)) value.forEach((v) => keys(v, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) { out.add(k); keys(v, out); }
  return out;
}

/** The ways a birth date could be written. */
function dateForms(iso: string): string[] {
  const [y, m, d] = iso.split("-").map(Number);
  const dd = String(d).padStart(2, "0"), mm = String(m).padStart(2, "0");
  return [
    iso, `${mm}/${dd}/${y}`, `${dd}/${mm}/${y}`, `${m}/${d}/${y}`, `${d}/${m}/${y}`, `${y}${mm}${dd}`,
    `${d} ${MONTHS[m - 1]} ${y}`, `${dd} ${MONTHS[m - 1]} ${y}`, `${d} ${MONTHS_LONG[m - 1]} ${y}`, `${MONTHS_LONG[m - 1]} ${d}, ${y}`,
  ];
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);

async function main() {
  const today = new Date();
  const source: ExportSource = await loadExportSource();
  const { file, shifts } = deidentify(source, { today, exportedOn: today.toISOString().slice(0, 10) });
  const body = JSON.stringify(file);
  const bytes = Buffer.byteLength(body);

  // ----- The truth, read independently of the export's loader.
  const patients = await sql`
    SELECT id::text, mrn, first_name, last_name, birth_date::text AS birth_date, phone, email, address,
           insurance_member_id, synthea_id
    FROM patients
  `;
  const providers = await sql`SELECT DISTINCT provider_name FROM visits WHERE provider_name IS NOT NULL`;
  const syntheaIds = await sql`
    SELECT synthea_id FROM visits WHERE synthea_id IS NOT NULL
    UNION ALL SELECT synthea_id FROM lab_results WHERE synthea_id IS NOT NULL LIMIT 5000
  `;

  console.log(`Export: ${file.patient_count} patients, ${(bytes / 1024 / 1024).toFixed(2)} MB, ${file.redacted_fields} coded text fields removed by the name check\n`);

  // ----- Shape and size.
  check(bytes < SIZE_LIMIT, "Under 3.5 MB (Vercel's limit is about 4.5 MB)", `${bytes.toLocaleString("en-US")} bytes`);
  check(file.patient_count === patients.length, "Every patient exported", `${file.patient_count} of ${patients.length}`);
  const ids = file.patients.map((p) => p.id);
  check(new Set(ids).size === ids.length && ids.every((id) => /^P-\d{4}$/.test(id)), "Each patient has a unique new ID like P-0007");
  const banned = ["mrn", "first_name", "last_name", "name_full", "phone", "email", "address", "insurance_member_id", "birth_date", "synthea_id", "provider_name", "patient_id"];
  const found = banned.filter((k) => keys(file).has(k));
  check(found.length === 0, "No identifier fields in the file", found.join(", "));
  check(
    file.rules.includes("Dates are shifted per patient, not removed, so this export does not meet HIPAA Safe Harbor."),
    "The file states it does not meet HIPAA Safe Harbor",
  );

  // ----- Names, MRNs and identifiers, searched in every string of the file.
  const all = strings(file, "", []);
  const freeText = all.filter((s) => /^patients\.(visits|medications|allergies)$/.test(s.path) || s.path === "patients.insurance_provider");
  const text = all.map((s) => s.text).join("\n");

  const fullNames = patients.map((p) => `${p.first_name} ${p.last_name}`);
  const fullHits = fullNames.filter((n) => wholeWord(n).test(text));
  check(fullHits.length === 0, "No patient's full name anywhere", fullHits.slice(0, 5).join(", "));

  const providerHits = providers.map((p) => p.provider_name as string).filter((n) => text.toLowerCase().includes(n.toLowerCase()));
  check(providerHits.length === 0, "No provider's name anywhere", providerHits.slice(0, 5).join(", "));

  const nameWords = [...new Set(patients.flatMap((p) => [p.first_name, p.last_name]).concat(
    providers.flatMap((p) => (p.provider_name as string).replace(/^Dr\.\s*/, "").split(/\s+/)),
  ))].filter((w) => w.length > 1);
  const freeTextHits = freeText.filter((s) => nameWords.some((w) => wholeWord(w).test(s.text)));
  check(freeTextHits.length === 0, "No first or last name in any free-text field (visits, doses, reactions, insurer)",
    freeTextHits.slice(0, 5).map((h) => h.text).join(" | "));
  // Coded vocabulary (condition, lab and medication names) can share a word with a surname, e.g. "hand".
  const codedHits = new Map<string, string>();
  for (const s of all) {
    if (freeText.includes(s)) continue;
    for (const w of nameWords) if (wholeWord(w).test(s.text)) codedHits.set(w, s.text);
  }
  if (codedHits.size > 0) {
    notes.push(`Coded clinical terms that share a word with a patient's name (not names): ${[...codedHits].map(([w, t]) => `"${w}" in "${t}"`).join("; ")}`);
  }

  const mrnHits = patients.filter((p) => all.some((s) => wholeWord(p.mrn).test(s.text)));
  check(mrnHits.length === 0, "No MRN anywhere", mrnHits.slice(0, 5).map((p) => p.mrn).join(", "));

  const identifiers = patients.flatMap((p) => [p.id, p.phone, p.email, p.address, p.insurance_member_id, p.synthea_id].filter(Boolean) as string[]);
  const idHits = identifiers.filter((v) => text.includes(v));
  check(idHits.length === 0, "No phone, email, address, insurance member ID, database ID or Synthea ID anywhere",
    `${identifiers.length} values searched${idHits.length ? `; found ${idHits.slice(0, 3).join(", ")}` : ""}`);
  const sidHits = syntheaIds.filter((r) => text.includes(r.synthea_id));
  check(sidHits.length === 0, "No visit or lab Synthea IDs anywhere", `${syntheaIds.length} searched`);

  // ----- Birth dates: the year only.
  const byExportId = new Map(file.patients.map((p) => [p.id, p]));
  const recordText = new Map(file.patients.map((p) => [p.id, JSON.stringify(p)]));
  let yearWrong = 0;
  const dobLeaks: string[] = [];
  for (const p of patients) {
    const shift = shifts.get(p.id);
    const exported = shift && byExportId.get(shift.exportId);
    if (!exported) { yearWrong += 1; continue; }
    const own = recordText.get(exported.id)!;
    const form = dateForms(p.birth_date).find((f) => own.includes(f));
    if (form) dobLeaks.push(`${exported.id} contains "${form}"`);
    if (exported.birth_year !== Number(p.birth_date.slice(0, 4)) || exported.age_90_plus) yearWrong += 1;
  }
  check(dobLeaks.length === 0, "No patient's full birth date in their own record, in 10 date formats", dobLeaks.slice(0, 3).join("; "));
  // Synthea records go back decades, so a shifted record date can land on some other
  // patient's birth date by chance. That's a date, not that person's birth date: check
  // each one sits in a different patient's record.
  let elsewhere = 0, ownHits = 0;
  for (const p of patients) {
    for (const [id, json] of recordText) {
      if (!json.includes(p.birth_date)) continue;
      if (shifts.get(p.id)?.exportId === id) ownHits += 1;
      else elsewhere += 1;
    }
  }
  check(ownHits === 0, "Every date that equals a patient's birth date is in a different patient's record", `${elsewhere} chance matches`);
  if (elsewhere > 0) notes.push(`${elsewhere} shifted record dates happen to equal another patient's birth date (different patients; a new export draws new shifts).`);
  check(yearWrong === 0, "Each birth_year is the real year of birth (no one here is 90+)");

  // ----- 90 or over, on made-up patients (none in the data is that old).
  // 1 January, so the birthday has passed and the age is exact (the check never runs on 1 January).
  const born = (age: number) => `${today.getUTCFullYear() - age}-01-01`;
  const fake = (id: string, birth: string): SourcePatient => ({
    id, mrn: "0", first_name: "Test", last_name: "Patient", birth_date: birth, sex: null, phone: null, email: null,
    address: null, insurance_provider: null, insurance_member_id: null,
  });
  const old = deidentify(
    { ...source, patients: [fake("a", born(89)), fake("b", born(90)), fake("c", born(97))], visits: [], labs: [], medications: [], allergies: [], conditions: [], wearables: [] },
    { today, exportedOn: "x" },
  );
  const byFake = (id: string) => old.file.patients.find((p) => p.id === old.shifts.get(id)!.exportId)!;
  check(byFake("a").birth_year !== null && !byFake("a").age_90_plus, "Aged 89: birth year kept");
  check(byFake("b").birth_year === null && byFake("b").age_90_plus && byFake("c").birth_year === null, "Aged 90 and 97: no birth year, age_90_plus: true");

  // ----- Date shifts: one per patient, never zero, and the gaps between records unchanged.
  const dbLabs = await sql`SELECT patient_id::text, taken_at::date::text AS date FROM lab_results ORDER BY 1, 2`;
  const dbVisits = await sql`SELECT patient_id::text, visited_at::date::text AS date FROM visits ORDER BY 1, 2`;
  const dbWear = await sql`SELECT patient_id::text, measured_on::text AS date FROM wearable_readings ORDER BY 1, 2`;
  const dbConditions = await sql`SELECT patient_id::text, onset_on::text AS date FROM conditions WHERE onset_on IS NOT NULL ORDER BY 1, 2`;
  const group = (rows: Record<string, string>[]) => {
    const m = new Map<string, string[]>();
    for (const r of rows) m.set(r.patient_id, [...(m.get(r.patient_id) ?? []), r.date]);
    return m;
  };
  const tables = [
    { name: "labs", db: group(dbLabs as Record<string, string>[]), col: 0 },
    { name: "visits", db: group(dbVisits as Record<string, string>[]), col: 0 },
    { name: "wearables", db: group(dbWear as Record<string, string>[]), col: 0 },
    { name: "conditions", db: group(dbConditions as Record<string, string>[]), col: 3 },
  ] as const;
  let badShift = 0, notConstant = 0, compared = 0;
  const distinctShifts = new Set<number>();
  for (const p of patients) {
    const { exportId, days } = shifts.get(p.id)!;
    distinctShifts.add(days);
    if (days === 0 || Math.abs(days) < MIN_SHIFT_DAYS || Math.abs(days) > MAX_SHIFT_DAYS) badShift += 1;
    const exported = byExportId.get(exportId)!;
    for (const t of tables) {
      const want = t.db.get(p.id) ?? [];
      const got = exported[t.name].map((row) => row[t.col] as string | null).filter((d): d is string => !!d).sort();
      if (want.length !== got.length) { notConstant += 1; continue; }
      for (let i = 0; i < want.length; i++) {
        compared += 1;
        // Every record moved by the same number of days, so every gap between them is unchanged.
        if (dayDiff(got[i], want[i]) !== days) { notConstant += 1; break; }
      }
    }
  }
  check(badShift === 0, `Every patient's shift is between ${MIN_SHIFT_DAYS} and ${MAX_SHIFT_DAYS} days, earlier or later, never zero`,
    `${distinctShifts.size} different shifts across ${patients.length} patients`);
  check(notConstant === 0, "Each patient's dates all move by the same number of days, so gaps stay true",
    `${compared.toLocaleString("en-US")} lab, visit, wearable and condition dates compared with the database`);

  for (const n of notes) console.log(`\nNOTE  ${n}`);

  if (process.argv.includes("--sample")) {
    const sample = {
      ...file,
      lab_tests: Object.fromEntries(Object.entries(file.lab_tests).slice(0, 4)),
      patients: file.patients.slice(0, 3).map((p) => ({
        ...p,
        visits: p.visits.slice(0, 2), labs: p.labs.slice(-4), medications: p.medications.slice(0, 2),
        allergies: p.allergies.slice(0, 2), conditions: p.conditions.slice(0, 2), wearables: p.wearables.slice(-3),
      })),
    };
    console.log("\nSample (first 3 patients, a few rows of each table):\n" + JSON.stringify(sample, null, 1));
  }

  console.log(failures.length ? `\n${failures.length} check(s) failed.` : "\nAll checks passed.");
  process.exitCode = failures.length ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
