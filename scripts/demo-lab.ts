/**
 * Add one lab result for a patient, as a lab feed would, to show that an
 * out-of-range result creates a follow-up task by itself. Uses addLabResult(),
 * the same code path as "Simulate lab result (demo)" on the Tasks screen.
 *
 *   npm run demo:lab -- --mrn 28910 --code 6298-4 --value 3.1
 */
import { parseArgs } from "node:util";
import { sql } from "../lib/db/client";
import { addLabResult } from "../lib/db/queries/labs";

async function main() {
  const { values } = parseArgs({ options: { mrn: { type: "string" }, code: { type: "string" }, value: { type: "string" } } });
  const value = Number(values.value);
  if (!values.mrn || !values.code || !Number.isFinite(value)) {
    throw new Error("Usage: npm run demo:lab -- --mrn 28910 --code 6298-4 --value 3.1");
  }

  const rows = await sql`SELECT id, first_name || ' ' || last_name AS name FROM patients WHERE mrn = ${values.mrn}`;
  if (rows.length === 0) throw new Error(`No patient with MRN ${values.mrn}.`);

  const added = await addLabResult({ patientId: rows[0].id, code: values.code, value });
  console.log(`Lab result #${added.resultId} added for ${rows[0].name}: ${values.code} = ${value} (${added.outOfRange ? "out of range" : "in range"}).`);
  for (const t of added.followUps.created) console.log(`  + task #${t.taskId}: ${t.title}, due ${t.dueOn}`);
  for (const t of added.followUps.updated) console.log(`  ~ task #${t.taskId}: ${t.title}, due ${t.dueOn}`);
  for (const t of added.followUps.reopened) console.log(`  ↺ task #${t.taskId} reopened: ${t.title}, due ${t.dueOn}`);
  const { created, updated, reopened } = added.followUps;
  if (!created.length && !updated.length && !reopened.length) console.log("  No task change.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
