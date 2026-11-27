/**
 * Daily wearable readings for every patient: resting heart rate, sleep hours and steps,
 * for the last 30 days. Run with: npm run db:wearables
 *
 * - Deterministic: each value comes from a random generator seeded with the patient's MRN,
 *   the kind and the date, so the same patient and day always get the same value.
 * - Believable: each patient has their own baseline (lower steps with age; fewer steps and a
 *   higher heart rate with type 2 diabetes or obesity), small day-to-day changes, and weekends.
 * - Safe to re-run: upserts on (patient, kind, day) and removes readings older than the window.
 */
import { Pool } from "@neondatabase/serverless";

const WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;
/** Type 2 diabetes, and BMI 30+ / 40+ obesity (SNOMED). */
const LESS_ACTIVE_CONDITIONS = ["44054006", "162864005", "408512008"];

/** FNV-1a string hash, used as a seed. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small seeded random generator returning numbers in [0, 1). */
function seeded(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Roughly bell-shaped noise in [-1, 1]. */
const noise = (rand: () => number) => (rand() + rand() + rand()) / 1.5 - 1;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

type Patient = { id: string; mrn: string; birth_date: string; less_active: boolean };

function baseline(p: Patient, today: string) {
  const rand = seeded(`${p.mrn}|baseline`);
  const age = Number(today.slice(0, 4)) - Number(p.birth_date.slice(0, 4));
  const ageFactor = age < 50 ? 1 : age < 65 ? 0.9 : age < 75 ? 0.78 : 0.65;
  return {
    heartRate: 58 + rand() * 20 + (p.less_active ? 4 : 0),
    sleep: 6.2 + rand() * 1.6,
    steps: (4000 + rand() * 6000) * ageFactor * (p.less_active ? 0.8 : 1),
  };
}

function reading(p: Patient, base: ReturnType<typeof baseline>, day: string) {
  const weekend = [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay());
  const r = (kind: string) => seeded(`${p.mrn}|${kind}|${day}`);
  return {
    heart_rate: Math.round(clamp(base.heartRate + noise(r("heart_rate")) * 4, 48, 100)),
    sleep_hours: Math.round(clamp(base.sleep + (weekend ? 0.5 : 0) + noise(r("sleep_hours")) * 0.7, 4, 9.5) * 10) / 10,
    steps: Math.round(clamp(base.steps * (weekend ? 0.85 : 1) * (1 + noise(r("steps")) * 0.25), 500, 20000)),
  };
}

const UNITS = { heart_rate: "bpm", sleep_hours: "h", steps: "steps" } as const;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set. Add it to .env.local.");

  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) =>
    new Date(Date.parse(today) - (WINDOW_DAYS - 1 - i) * DAY_MS).toISOString().slice(0, 10),
  );

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows: patients } = await pool.query<Patient>(
      `SELECT p.id, p.mrn, p.birth_date::text AS birth_date,
              EXISTS (SELECT 1 FROM conditions c WHERE c.patient_id = p.id AND c.code = ANY($1)) AS less_active
       FROM patients p ORDER BY p.mrn`,
      [LESS_ACTIVE_CONDITIONS],
    );

    const ids: string[] = [], kinds: string[] = [], values: number[] = [], units: string[] = [], dates: string[] = [];
    for (const p of patients) {
      const base = baseline(p, today);
      for (const day of days) {
        const r = reading(p, base, day);
        for (const kind of Object.keys(UNITS) as (keyof typeof UNITS)[]) {
          ids.push(p.id);
          kinds.push(kind);
          values.push(r[kind]);
          units.push(UNITS[kind]);
          dates.push(day);
        }
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const removed = await client.query("DELETE FROM wearable_readings WHERE measured_on < $1", [days[0]]);
      const written = await client.query(
        `INSERT INTO wearable_readings (patient_id, kind, value, unit, measured_on)
         SELECT * FROM unnest($1::uuid[], $2::text[], $3::numeric[], $4::text[], $5::date[])
         ON CONFLICT (patient_id, kind, measured_on) DO UPDATE SET value = EXCLUDED.value, unit = EXCLUDED.unit`,
        [ids, kinds, values, units, dates],
      );
      await client.query("COMMIT");
      console.log(
        `Wearables for ${patients.length} patients, ${days[0]} to ${days[days.length - 1]}: ` +
          `${written.rowCount} readings written, ${removed.rowCount} older readings removed.`,
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
